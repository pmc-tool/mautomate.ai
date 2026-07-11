"""
The Pipecat bot — one instance per web voice call.

Lifecycle (mirrors the CallDone PATTERN, native to mAutomate):

  1. The FastAPI server receives POST /api/pipelines/start and spawns a
     `BotSession.run()` task (fire-and-forget).
  2. The bot JOINS the already-created Daily room as the 2nd participant using a
     freshly minted meeting token (DAILY_API_KEY).
  3. It PULLS the compiled agent config from the control plane
     (POST /telephony/agent-config) — first_message, system_prompt, tools, voice.
  4. It builds and runs the standard Pipecat pipeline:
        DailyTransport.input()
          -> Deepgram STT (nova-2 for en, nova-3 otherwise)
          -> OpenAI LLM context aggregator (user)
          -> OpenAI LLM (system_prompt + tools as function schemas)
          -> ElevenLabs TTS (voice_id from config)
          -> DailyTransport.output()
          -> OpenAI LLM context aggregator (assistant)
     with Silero VAD + interruption handling.
  5. On every LLM function call it POSTs /telephony/tool-execute and feeds the
     in-band result back to the model; `setDisposition` is captured for the
     end-of-call webhook, and an `end_call` / `transfer` action ends the session.
  6. On hangup (user leaves / stop / error / safety timeout) it POSTs
     /telephony/call-ended with the transcript, optional summary, disposition,
     and duration.

TARGET: pipecat-ai == 0.0.80 (namespaced service imports + `FunctionCallParams`
single-arg function-call signature). See README for version notes.
"""

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import aiohttp

from config import Settings
from control_plane import AgentConfig, ControlPlaneClient
from logging_config import get_logger

log = get_logger("voice.bot")


@dataclass
class StartParams:
    """Body of POST /api/pipelines/start."""

    call_id: str
    playbook_id: str
    tenant_id: str
    room_url: str
    room_name: Optional[str] = None
    locale: Optional[str] = None
    order_id: Optional[str] = None


def _deepgram_model(language: str) -> str:
    """nova-2 for English, nova-3 for everything else (better multilingual)."""
    lang = (language or "en").lower()
    return "nova-2" if lang.startswith("en") else "nova-3"


def resolve_voice_id(config: AgentConfig, settings: Settings) -> str:
    """
    Pick the ElevenLabs voice. The playbook voice_id is the intended value, but
    some playbooks ship a human-readable PLACEHOLDER (e.g. "bn-female-warm")
    that is NOT a real ElevenLabs voice id. A real ElevenLabs id is a 20-char
    alphanumeric token with no hyphen; when the config value doesn't look like
    one we fall back to ELEVENLABS_VOICE_ID from the environment.
    """
    cfg = (config.voice_id or "").strip()
    looks_real = cfg and "-" not in cfg and len(cfg) >= 15
    if looks_real:
        return cfg
    if settings.elevenlabs_voice_id:
        if cfg and not looks_real:
            log.warning(
                "playbook voice_id is a placeholder; using ELEVENLABS_VOICE_ID",
                extra={"playbook_voice_id": cfg},
            )
        return settings.elevenlabs_voice_id
    # Last resort: hand the raw config value to ElevenLabs and let it error
    # loudly rather than silently picking a wrong default.
    return cfg


class BotSession:
    """One live call. Owns the pipeline task and the end-of-call reporting."""

    def __init__(self, params: StartParams, settings: Settings):
        self.params = params
        self.settings = settings
        self.control = ControlPlaneClient(
            settings.backend_url, settings.telephony_secret
        )

        self._task = None  # pipecat PipelineTask
        self._runner = None  # pipecat PipelineRunner
        self._context = None  # OpenAILLMContext
        self._started_at = time.monotonic()
        self._ended = asyncio.Event()
        self._reported = False

        # End-of-call artifacts collected during the call.
        self._disposition: Optional[str] = None
        self._ended_reason: Optional[str] = None
        self._transcript: List[Dict[str, Any]] = []

        # Call recording (real, lossless audio of both voices).
        self._audiobuffer = None  # pipecat AudioBufferProcessor
        self._recording_stopped = False
        self._recording_path: Optional[str] = None

    # -- public API -----------------------------------------------------------

    @property
    def call_id(self) -> str:
        return self.params.call_id

    async def run(self) -> None:
        """
        Full call lifecycle. Isolated: any exception is caught, logged, and the
        call is still reported ended — a single bad call never crashes the
        server (the server also wraps this in its own guard).
        """
        cid = self.params.call_id
        config: Optional[AgentConfig] = None
        try:
            config = await self.control.fetch_agent_config(
                playbook_id=self.params.playbook_id,
                tenant_id=self.params.tenant_id,
                locale=self.params.locale,
                order_id=self.params.order_id,
                call_id=cid,
            )
            log.info(
                "agent-config pulled",
                extra={
                    "call_id": cid,
                    "playbook_id": config.playbook_id,
                    "tool_count": len(config.tools),
                    "voice_provider": config.voice_provider,
                    "locale": config.locale,
                },
            )
        except Exception as exc:  # noqa: BLE001
            # Config fetch failed -> we cannot run a meaningful bot. Log and end
            # the call cleanly so the backend still records a completed call.
            log.error(
                "agent-config fetch failed; ending call",
                extra={"call_id": cid, "error": str(exc)},
                exc_info=True,
            )
            self._ended_reason = "config_fetch_failed"
            await self._report_ended()
            return

        try:
            await self._run_pipeline(config)
        except asyncio.CancelledError:
            self._ended_reason = self._ended_reason or "cancelled"
            raise
        except Exception as exc:  # noqa: BLE001
            log.error(
                "pipeline crashed",
                extra={"call_id": cid, "error": str(exc)},
                exc_info=True,
            )
            self._ended_reason = self._ended_reason or "pipeline_error"
        finally:
            await self._report_ended()

    async def stop(self, reason: str = "stop_requested") -> None:
        """Externally requested stop (POST /api/pipelines/stop or shutdown)."""
        if self._ended.is_set():
            return
        self._ended_reason = self._ended_reason or reason
        await self._end_pipeline()

    # -- pipeline -------------------------------------------------------------

    async def _run_pipeline(self, config: AgentConfig) -> None:
        # Imports are local so a missing optional dependency surfaces per-call
        # (logged + reported) instead of failing the whole server at import time.
        from deepgram import LiveOptions
        from pipecat.audio.vad.silero import SileroVADAnalyzer
        from pipecat.pipeline.pipeline import Pipeline
        from pipecat.pipeline.runner import PipelineRunner
        from pipecat.pipeline.task import PipelineParams, PipelineTask
        from pipecat.processors.aggregators.openai_llm_context import (
            OpenAILLMContext,
        )
        from pipecat.services.deepgram.stt import DeepgramSTTService
        from pipecat.services.elevenlabs.tts import ElevenLabsTTSService
        from pipecat.services.openai.llm import OpenAILLMService
        from pipecat.transports.services.daily import DailyParams, DailyTransport

        cid = self.params.call_id
        settings = self.settings

        # 1. Mint a Daily meeting token for the (already-created) room.
        token = await self._mint_token(self.params.room_url)

        # 2. Transport — join the room as the 2nd participant.
        transport = DailyTransport(
            self.params.room_url,
            token,
            settings.bot_name,
            DailyParams(
                audio_in_enabled=True,
                audio_out_enabled=True,
                transcription_enabled=False,  # we run Deepgram STT in-pipeline
                vad_analyzer=SileroVADAnalyzer(),
            ),
        )

        # 3. STT (Deepgram, streaming).
        stt = DeepgramSTTService(
            api_key=settings.deepgram_api_key,
            live_options=LiveOptions(
                model=_deepgram_model(config.voice_language),
                language=config.voice_language,
                smart_format=True,
                numerals=True,
                interim_results=True,
                punctuate=True,
            ),
            addons={"keepalive": "true"},
        )

        # 4. LLM (OpenAI) with the pulled system prompt + tools as function schemas.
        llm = OpenAILLMService(
            api_key=settings.openai_api_key,
            model=settings.openai_model,
        )

        messages: List[Dict[str, Any]] = [
            {"role": "system", "content": config.system_prompt},
        ]
        # Seed the fixed greeting as the assistant's opening line so the model
        # has continuity with what the caller heard (we speak it via TTS below).
        if config.first_message:
            messages.append({"role": "assistant", "content": config.first_message})

        context = OpenAILLMContext(messages, tools=config.tools or None)
        self._context = context
        context_aggregator = llm.create_context_aggregator(context)

        # Register a catch-all function handler routed through /telephony/tool-execute.
        self._register_tools(llm, config)

        # 5. TTS (ElevenLabs).
        tts = ElevenLabsTTSService(
            api_key=settings.elevenlabs_api_key,
            voice_id=resolve_voice_id(config, settings),
        )

        # 6. The pipeline. The audio recorder sits right after transport.output()
        #    so it captures BOTH the caller's mic and the agent's spoken audio,
        #    exactly as heard (lossless PCM — never re-synthesized).
        audiobuffer = self._make_audio_recorder()
        pipeline = Pipeline(
            [
                transport.input(),
                stt,
                context_aggregator.user(),
                llm,
                tts,
                transport.output(),
                audiobuffer,
                context_aggregator.assistant(),
            ]
        )

        task = PipelineTask(
            pipeline,
            params=PipelineParams(
                allow_interruptions=True,
                enable_metrics=True,
            ),
        )
        self._task = task
        self._runner = PipelineRunner(handle_sigint=False)

        self._wire_transport_events(transport, task, config)

        # Safety net: hard wall-clock cap so a stuck call can never live forever.
        watchdog = asyncio.create_task(self._watchdog())

        log.info("pipeline starting", extra={"call_id": cid})
        try:
            await self._runner.run(task)
        finally:
            watchdog.cancel()
            self._ended.set()
            # Best-effort transcript snapshot from the live context.
            self._snapshot_transcript()


    # -- Twilio Media Streams (inbound phone) --------------------------------

    async def run_twilio_stream(self, websocket, stream_sid: str) -> None:
        """
        Full inbound-phone lifecycle over a Twilio Media Stream WebSocket. Mirrors
        `run()` (pull config -> build pipeline -> report ended) but the transport
        is a FastAPIWebsocketTransport with a TwilioFrameSerializer (8kHz mu-law).
        Isolated: any exception is logged and the call is still reported ended.
        """
        cid = self.params.call_id
        config = None
        try:
            config = await self.control.fetch_agent_config(
                playbook_id=self.params.playbook_id,
                tenant_id=self.params.tenant_id,
                locale=self.params.locale,
                order_id=self.params.order_id,
                call_id=cid,
            )
            log.info(
                "agent-config pulled (twilio)",
                extra={"call_id": cid, "playbook_id": config.playbook_id,
                       "tool_count": len(config.tools)},
            )
        except Exception as exc:  # noqa: BLE001
            log.error("agent-config fetch failed (twilio); ending",
                      extra={"call_id": cid, "error": str(exc)}, exc_info=True)
            self._ended_reason = "config_fetch_failed"
            await self._report_ended()
            return

        try:
            await self._run_twilio_pipeline(websocket, stream_sid, config)
        except asyncio.CancelledError:
            self._ended_reason = self._ended_reason or "cancelled"
            raise
        except Exception as exc:  # noqa: BLE001
            log.error("twilio pipeline crashed",
                      extra={"call_id": cid, "error": str(exc)}, exc_info=True)
            self._ended_reason = self._ended_reason or "pipeline_error"
        finally:
            await self._report_ended()

    async def _run_twilio_pipeline(self, websocket, stream_sid: str, config) -> None:
        from deepgram import LiveOptions
        from pipecat.audio.vad.silero import SileroVADAnalyzer
        from pipecat.pipeline.pipeline import Pipeline
        from pipecat.pipeline.runner import PipelineRunner
        from pipecat.pipeline.task import PipelineParams, PipelineTask
        from pipecat.processors.aggregators.openai_llm_context import OpenAILLMContext
        from pipecat.serializers.twilio import TwilioFrameSerializer
        from pipecat.services.deepgram.stt import DeepgramSTTService
        from pipecat.services.elevenlabs.tts import ElevenLabsTTSService
        from pipecat.services.openai.llm import OpenAILLMService
        from pipecat.transports.network.fastapi_websocket import (
            FastAPIWebsocketParams,
            FastAPIWebsocketTransport,
        )

        cid = self.params.call_id
        settings = self.settings

        # Twilio streams 8kHz mu-law. The serializer handles (de)framing and, given
        # account creds, can hang the call up at end.
        serializer = TwilioFrameSerializer(
            stream_sid=stream_sid,
            call_sid=cid,
            account_sid=getattr(settings, "twilio_account_sid", "") or "",
            auth_token=getattr(settings, "twilio_auth_token", "") or "",
        )

        transport = FastAPIWebsocketTransport(
            websocket=websocket,
            params=FastAPIWebsocketParams(
                audio_in_enabled=True,
                audio_out_enabled=True,
                # Twilio Media Streams are 8kHz mono mu-law both ways.
                audio_in_sample_rate=8000,
                audio_out_sample_rate=8000,
                add_wav_header=False,
                vad_analyzer=SileroVADAnalyzer(),
                serializer=serializer,
            ),
        )

        stt = DeepgramSTTService(
            api_key=settings.deepgram_api_key,
            live_options=LiveOptions(
                model=_deepgram_model(config.voice_language),
                language=config.voice_language,
                smart_format=True,
                numerals=True,
                interim_results=True,
                punctuate=True,
                encoding="mulaw",
                sample_rate=8000,
            ),
            addons={"keepalive": "true"},
        )

        llm = OpenAILLMService(
            api_key=settings.openai_api_key, model=settings.openai_model
        )
        messages = [{"role": "system", "content": config.system_prompt}]
        if config.first_message:
            messages.append({"role": "assistant", "content": config.first_message})
        context = OpenAILLMContext(messages, tools=config.tools or None)
        self._context = context
        context_aggregator = llm.create_context_aggregator(context)
        self._register_tools(llm, config)

        tts = ElevenLabsTTSService(
            api_key=settings.elevenlabs_api_key,
            voice_id=resolve_voice_id(config, settings),
            # 8kHz PCM mu-law output for Twilio.
            output_format="ulaw_8000",
        )

        audiobuffer = self._make_audio_recorder()
        pipeline = Pipeline(
            [
                transport.input(),
                stt,
                context_aggregator.user(),
                llm,
                tts,
                transport.output(),
                audiobuffer,
                context_aggregator.assistant(),
            ]
        )
        task = PipelineTask(
            pipeline,
            params=PipelineParams(allow_interruptions=True, enable_metrics=True),
        )
        self._task = task
        self._runner = PipelineRunner(handle_sigint=False)

        from pipecat.frames.frames import TTSSpeakFrame

        @transport.event_handler("on_client_connected")
        async def _on_conn(_t, _client):  # noqa: ANN001
            log.info("twilio client connected; greeting", extra={"call_id": cid})
            await self._start_recording()
            if config.first_message:
                await task.queue_frames([TTSSpeakFrame(config.first_message)])

        @transport.event_handler("on_client_disconnected")
        async def _on_disc(_t, _client):  # noqa: ANN001
            log.info("twilio client disconnected; ending", extra={"call_id": cid})
            self._ended_reason = self._ended_reason or "caller_hung_up"
            await self._end_pipeline()

        watchdog = asyncio.create_task(self._watchdog())
        log.info("twilio pipeline starting", extra={"call_id": cid})
        try:
            await self._runner.run(task)
        finally:
            watchdog.cancel()
            self._ended.set()
            self._snapshot_transcript()

    # -- transport events -----------------------------------------------------

    def _wire_transport_events(self, transport, task, config: AgentConfig) -> None:
        from pipecat.frames.frames import TTSSpeakFrame

        cid = self.params.call_id

        @transport.event_handler("on_first_participant_joined")
        async def _on_join(_transport, participant):  # noqa: ANN001
            log.info(
                "participant joined; speaking greeting",
                extra={"call_id": cid, "participant": participant.get("id")},
            )
            await self._start_recording()
            if config.first_message:
                await task.queue_frames([TTSSpeakFrame(config.first_message)])

        @transport.event_handler("on_participant_left")
        async def _on_left(_transport, participant, reason):  # noqa: ANN001
            log.info(
                "participant left; ending call",
                extra={"call_id": cid, "reason": reason},
            )
            self._ended_reason = self._ended_reason or "user_left"
            await self._end_pipeline()

        @transport.event_handler("on_call_state_updated")
        async def _on_state(_transport, state):  # noqa: ANN001
            log.info("daily call state", extra={"call_id": cid, "state": state})
            if state == "left":
                self._ended_reason = self._ended_reason or "room_closed"
                await self._end_pipeline()

    # -- tools ----------------------------------------------------------------

    def _register_tools(self, llm, config: AgentConfig) -> None:
        """
        Register a single catch-all handler for every function the model may
        call. On each call we POST /telephony/tool-execute and feed the in-band
        result straight back to the LLM. Disposition + flow-control actions
        (end_call / transfer) are captured here.
        """
        cid = self.params.call_id
        tenant_id = self.params.tenant_id

        async def handle_function(params) -> None:  # FunctionCallParams (pipecat >=0.0.59)
            name = getattr(params, "function_name", None)
            args = getattr(params, "arguments", None) or {}
            log.info(
                "tool call",
                extra={"call_id": cid, "tool_name": name, "arguments": args},
            )
            out = await self.control.tool_execute(
                call_id=cid,
                tenant_id=tenant_id,
                tool_name=name or "",
                arguments=args,
            )

            # Capture the disposition the model recorded.
            if name == "setDisposition":
                outcome = args.get("outcome") or args.get("disposition")
                if isinstance(outcome, str) and outcome:
                    self._disposition = outcome

            # Feed the in-band result (or error) back to the model.
            result_payload: Any = out
            await params.result_callback(result_payload)

            # Flow control: end / transfer the call after the model's turn.
            action = out.get("action") if isinstance(out, dict) else None
            if action == "end_call":
                self._ended_reason = self._ended_reason or "end_call_tool"
                asyncio.create_task(self._end_pipeline(after_speech=True))
            elif action == "transfer":
                self._ended_reason = self._ended_reason or "transfer_to_human"
                if not self._disposition:
                    self._disposition = "transfer_to_human"
                asyncio.create_task(self._end_pipeline(after_speech=True))

        # `None` registers a default handler invoked for ANY function name.
        llm.register_function(None, handle_function)

    # -- helpers --------------------------------------------------------------

    async def _mint_token(self, room_url: str) -> Optional[str]:
        """
        Mint a short-lived owner meeting token for the existing Daily room via
        the Daily REST helper. If token minting fails we still attempt to join
        (a public room may not require a token); the failure is logged.
        """
        try:
            from pipecat.transports.services.helpers.daily_rest import (
                DailyRESTHelper,
                DailyMeetingTokenParams,
            )
        except Exception:  # noqa: BLE001
            # Older/newer layout without the params dataclass — fall back below.
            DailyMeetingTokenParams = None  # type: ignore
            try:
                from pipecat.transports.services.helpers.daily_rest import (
                    DailyRESTHelper,
                )
            except Exception as exc:  # noqa: BLE001
                log.warning(
                    "Daily REST helper unavailable; joining without a token",
                    extra={"call_id": self.params.call_id, "error": str(exc)},
                )
                return None

        expiry = float(self.settings.max_call_seconds + 120)
        try:
            async with aiohttp.ClientSession() as session:
                helper = DailyRESTHelper(
                    daily_api_key=self.settings.daily_api_key,
                    daily_api_url=self.settings.daily_api_url,
                    aiohttp_session=session,
                )
                # API has shifted across versions; try the current signature
                # first, then older positional/keyword forms.
                try:
                    return await helper.get_token(
                        self.params.room_url, expiry_time=expiry
                    )
                except TypeError:
                    return await helper.get_token(self.params.room_url, expiry)
        except Exception as exc:  # noqa: BLE001
            log.warning(
                "failed to mint Daily token; joining without one",
                extra={"call_id": self.params.call_id, "error": str(exc)},
            )
            return None

    async def _watchdog(self) -> None:
        try:
            await asyncio.sleep(self.settings.max_call_seconds)
            log.warning(
                "max call duration reached; force-ending",
                extra={"call_id": self.params.call_id},
            )
            self._ended_reason = self._ended_reason or "max_duration"
            await self._end_pipeline()
        except asyncio.CancelledError:
            pass

    async def _end_pipeline(self, after_speech: bool = False) -> None:
        """Ask the pipeline to stop. `after_speech` lets a goodbye finish first."""
        # Flush the recording while the pipeline is still alive so the WAV is
        # written reliably (independent of teardown timing).
        await self._stop_recording()
        task = self._task
        if task is None:
            self._ended.set()
            return
        try:
            if after_speech and hasattr(task, "stop_when_done"):
                await task.stop_when_done()
            else:
                await task.cancel()
        except Exception as exc:  # noqa: BLE001
            log.warning(
                "error while ending pipeline",
                extra={"call_id": self.params.call_id, "error": str(exc)},
            )

    # -- recording ------------------------------------------------------------

    def _make_audio_recorder(self):
        """Create an AudioBufferProcessor that captures the REAL call audio — the
        caller's mic and the agent's spoken (ElevenLabs) voice, merged to a
        single track, losslessly. The audio is the actual PCM that flowed through
        the call; it is NEVER re-synthesized, so the recorded voice is exactly
        what was heard. On stop, it writes a 16-bit WAV to the shared dir."""
        from pipecat.processors.audio.audio_buffer_processor import (
            AudioBufferProcessor,
        )

        ab = AudioBufferProcessor(num_channels=1)
        self._audiobuffer = ab

        @ab.event_handler("on_audio_data")
        async def _on_audio_data(_buffer, audio, sample_rate, num_channels):  # noqa: ANN001
            self._write_wav(audio, sample_rate, num_channels)

        return ab

    def _write_wav(self, pcm: bytes, sample_rate: int, num_channels: int) -> None:
        """Persist merged PCM as a 16-bit WAV in the shared recordings dir."""
        try:
            import os
            import wave

            if not pcm:
                return
            rec_dir = os.environ.get(
                "CALL_RECORDINGS_DIR", "/home/ratul/call-recordings"
            )
            os.makedirs(rec_dir, exist_ok=True)
            path = os.path.join(rec_dir, f"{self.params.call_id}.wav")
            with wave.open(path, "wb") as wf:
                wf.setnchannels(num_channels or 1)
                wf.setsampwidth(2)  # 16-bit PCM
                wf.setframerate(sample_rate or 16000)
                wf.writeframes(pcm)
            self._recording_path = path
            log.info(
                "recording saved",
                extra={
                    "call_id": self.params.call_id,
                    "bytes": len(pcm),
                    "sample_rate": sample_rate,
                },
            )
        except Exception as exc:  # noqa: BLE001
            log.info(
                "recording write failed",
                extra={"call_id": self.params.call_id, "error": str(exc)},
            )

    async def _start_recording(self) -> None:
        ab = self._audiobuffer
        if ab is None:
            return
        try:
            await ab.start_recording()
            log.info("recording started", extra={"call_id": self.params.call_id})
        except Exception as exc:  # noqa: BLE001
            log.info(
                "start_recording failed",
                extra={"call_id": self.params.call_id, "error": str(exc)},
            )

    async def _stop_recording(self) -> None:
        """Flush the recorder to a WAV. Idempotent — safe to call from multiple
        teardown paths."""
        ab = self._audiobuffer
        if ab is None or self._recording_stopped:
            return
        self._recording_stopped = True
        try:
            await ab.stop_recording()
        except Exception as exc:  # noqa: BLE001
            log.info(
                "stop_recording failed",
                extra={"call_id": self.params.call_id, "error": str(exc)},
            )

    def _snapshot_transcript(self) -> None:
        """Build the transcript from the live LLM context (role/content pairs)."""
        ctx = self._context
        if ctx is None:
            return
        try:
            raw_messages = ctx.get_messages()
        except Exception:  # noqa: BLE001
            return
        transcript: List[Dict[str, Any]] = []
        for msg in raw_messages:
            role = msg.get("role") if isinstance(msg, dict) else None
            # Keep only what was actually SPOKEN. Drop system prompts, tool
            # results (role "tool"/"function" — raw JSON), and the assistant's
            # tool-call stubs (no spoken text). Those are internal machinery, not
            # human-readable conversation.
            if role not in ("user", "assistant"):
                continue
            content = msg.get("content") if isinstance(msg, dict) else None
            if isinstance(content, list):
                # Multimodal content parts -> join text parts.
                content = " ".join(
                    p.get("text", "")
                    for p in content
                    if isinstance(p, dict) and p.get("type") == "text"
                ).strip()
            if not isinstance(content, str) or not content.strip():
                continue
            transcript.append({"role": role, "content": content.strip()})
        if transcript:
            self._transcript = transcript

    async def _maybe_summary(self) -> Optional[Dict[str, Any]]:
        """Best-effort call analysis (summary + sentiment). Never raises.

        Returns {"summary": str|None, "sentiment": str|None} or None.
        """
        if not self.settings.generate_summary or not self._transcript:
            return None
        try:
            import json as _json

            from openai import AsyncOpenAI

            lines = "\n".join(
                f"{m.get('role')}: {m.get('content')}"
                for m in self._transcript
                if m.get("content")
            )
            if not lines.strip():
                return None
            client = AsyncOpenAI(api_key=self.settings.openai_api_key)
            resp = await client.chat.completions.create(
                model=self.settings.openai_model,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "Analyze this customer support call. Reply with ONLY a "
                            'JSON object of the form {"summary": "...", '
                            '"sentiment": "..."}, where summary is a 1-2 sentence '
                            "description of the outcome, and sentiment is exactly "
                            "one word — positive, neutral, or negative — for the "
                            "customer's overall mood."
                        ),
                    },
                    {"role": "user", "content": lines[:6000]},
                ],
                max_tokens=180,
                temperature=0.2,
                response_format={"type": "json_object"},
            )
            raw = (resp.choices[0].message.content or "").strip()
            data = _json.loads(raw) if raw else {}
            summary = (data.get("summary") or "").strip() or None
            sentiment = (data.get("sentiment") or "").strip().lower() or None
            if sentiment not in ("positive", "neutral", "negative"):
                sentiment = None
            return {"summary": summary, "sentiment": sentiment}
        except Exception as exc:  # noqa: BLE001
            log.info(
                "summary generation skipped",
                extra={"call_id": self.params.call_id, "error": str(exc)},
            )
            return None

    async def _report_ended(self) -> None:
        """POST /telephony/call-ended exactly once."""
        if self._reported:
            return
        self._reported = True
        self._ended.set()
        # Fallback flush in case the pipeline ended without routing through
        # _end_pipeline (e.g. a crash). Idempotent.
        await self._stop_recording()

        if not self._transcript:
            self._snapshot_transcript()

        duration = int(max(0.0, time.monotonic() - self._started_at))
        analysis = await self._maybe_summary()
        summary = analysis.get("summary") if analysis else None
        sentiment = analysis.get("sentiment") if analysis else None

        log.info(
            "reporting call ended",
            extra={
                "call_id": self.params.call_id,
                "duration_seconds": duration,
                "disposition": self._disposition,
                "ended_reason": self._ended_reason,
                "transcript_len": len(self._transcript),
            },
        )
        await self.control.call_ended(
            call_id=self.params.call_id,
            tenant_id=self.params.tenant_id,
            transcript=self._transcript,
            summary=summary,
            sentiment=sentiment,
            disposition=self._disposition,
            duration_seconds=duration,
            ended_reason=self._ended_reason,
        )
