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
          -> Deepgram STT (nova-3, streaming interims)
          -> user idle monitor (re-prompts a silent caller, then ends politely)
          -> OpenAI LLM context aggregator (user)
          -> OpenAI LLM (system_prompt + spoken-style rules + tools)
          -> ElevenLabs TTS (low-latency conversational model, tuned voice)
          -> DailyTransport.output()
          -> OpenAI LLM context aggregator (assistant)
     with Silero VAD (tuned endpointing), optional Smart Turn v2 semantic
     turn-taking, and interruption handling.
  5. On every LLM function call it POSTs /telephony/tool-execute and feeds the
     in-band result back to the model; slow lookups get an immediate spoken
     acknowledgment so the caller never hears dead air. `setDisposition` is
     captured for the end-of-call webhook, and an `end_call` / `transfer`
     action ends the session.
  6. On hangup (user leaves / stop / error / safety timeout) it POSTs
     /telephony/call-ended with the transcript, optional summary, disposition,
     and duration.

TARGET: pipecat-ai == 0.0.80 (namespaced service imports + `FunctionCallParams`
single-arg function-call signature). See README for version notes.

NATURALNESS NOTES (why the knobs are set the way they are):
  - The single biggest "the bot feels slow / gappy" lever is turn-end
    detection. Stock VAD waits `stop_secs` (0.8s default) of silence before the
    bot even STARTS thinking. We run tuned VAD (VOICE_VAD_STOP_SECS, default
    0.5) and, when enabled, Smart Turn v2 — a semantic turn-completion model
    (the same idea as Vapi's "smart endpointing") that lets the VAD trigger at
    0.2s and then decides "is the caller actually done, or mid-thought?".
  - Dead air during order lookups reads as a broken line. A deterministic
    filler ("One sec, let me pull that up") is spoken the moment a slow tool
    starts, in the agent's own voice.
  - ElevenLabs Flash v2.5 cuts TTS first-byte latency to ~75ms (vs ~300ms for
    turbo) and the stability/similarity settings are the canonical
    conversational tuning.
  - The spoken-style rules appended to every system prompt stop the LLM from
    producing markdown lists and paragraph-long monologues that no human would
    ever SAY.
"""

from __future__ import annotations

import asyncio
import random
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import aiohttp

from config import Settings
from control_plane import AgentConfig, ControlPlaneClient
from logging_config import get_logger

log = get_logger("voice.bot")


# ---------------------------------------------------------------------------
# Spoken-delivery rules appended to EVERY agent's system prompt
# ---------------------------------------------------------------------------

# The playbook prompt defines WHO the agent is and WHAT it may do. This block
# defines how a voice sounds like a person instead of a chatbot being read
# aloud. It is appended runtime-side so every agent — old and new, any tenant —
# gets it without re-training playbooks.
VOICE_STYLE_RULES = """
[Voice delivery — these rules govern HOW you speak and override any conflicting style guidance above]
You are on a live voice call. Everything you write is spoken aloud by a text-to-speech voice, so write exactly the way a warm, competent human support agent talks:
- Keep every reply SHORT: one or two spoken sentences, then stop or ask exactly ONE question. Never deliver lists, menus of options, or monologues.
- Use contractions and everyday words (I'm, you'll, that's, no problem, sure thing).
- Plain sentences only: no markdown, no bullet points, no numbered lists, no emojis, no headings, no stage directions, no text in parentheses.
- Vary your acknowledgments naturally (Sure. / Got it. / Okay, let me see. / Alright.) — never use the same one twice in a row, and don't start every turn with one.
- Read numbers the way a person would: order numbers and codes digit by digit ("seven seven three three zero five"), prices naturally ("nineteen ninety-nine"), dates conversationally ("the fourteenth of July").
- When you need to look something up, just call the tool — do not announce that you are checking; a short acknowledgment is played automatically.
- After a lookup, lead with the answer, not the process. Say "Your order shipped yesterday" — never "According to the system, the status field shows...".
- If a lookup finds nothing, say so plainly and offer the next step. Never invent orders, prices, dates, or policies.
- If you didn't catch something, ask naturally ("Sorry, what was that last part?"). Never mention transcription, audio quality, or being an AI system unless the caller directly asks.
- If the caller interrupts you, drop your sentence and respond to what they said.
- Confirm critical details by reading them back (addresses, order numbers, email addresses — spell emails out letter by letter only when confirming).
- Use the caller's name once you learn it, sparingly — once or twice in the whole call, the way a person would.
- Match the caller's language, formality, and energy. Be personable but efficient: their time matters more than your script.
""".strip()


# ---------------------------------------------------------------------------
# Spoken fillers so tool latency is never dead air
# ---------------------------------------------------------------------------

# Tools that must stay silent: bookkeeping and flow control, not lookups.
SILENT_TOOLS = {
    "setDisposition",
    "endCall",
    "end_call",
    "transfer",
    "transferToHuman",
}

TOOL_FILLERS: Dict[str, List[str]] = {
    "getOrder": [
        "One sec, let me pull that up.",
        "Sure, just a moment while I find that order.",
        "Okay, let me take a look.",
    ],
    "getOrderStatus": [
        "Let me check on that for you.",
        "One moment, I'll look that up.",
    ],
    "findOrders": [
        "Alright, give me a second to find that.",
        "Let me look that up for you.",
    ],
    "listCustomerOrders": [
        "One moment while I pull up your orders.",
        "Let me grab those for you.",
    ],
    "searchProducts": [
        "Let me have a quick look.",
        "One sec, checking what we've got.",
    ],
    "getProduct": [
        "Just a second, let me check that one.",
    ],
    "searchKnowledge": [
        "Good question — one moment.",
        "Let me double-check that for you.",
    ],
    "cancelOrder": [
        "Okay, one moment while I take care of that.",
    ],
    "confirmOrder": [
        "Great, one second while I confirm that.",
    ],
    "updateShippingAddress": [
        "Alright, let me update that now.",
    ],
}

DEFAULT_FILLERS = [
    "One moment.",
    "Just a second.",
    "Let me check that for you.",
]

# Minimum seconds between spoken fillers so chained tool calls in one turn
# don't stack "one moment... one moment... one moment".
FILLER_MIN_GAP_SECONDS = 6.0


# ---------------------------------------------------------------------------
# Idle-caller handling — a human agent would say something; so do we
# ---------------------------------------------------------------------------

IDLE_FIRST_CHECKINS = [
    "Sorry — are you still there?",
    "Take your time. I'm still here whenever you're ready.",
]
IDLE_SECOND_CHECKINS = [
    "I can't hear anything from your side. If you're still there, just say something and we'll carry on.",
]
IDLE_GOODBYE = (
    "It sounds like now might not be a good time. I'll let you go — "
    "feel free to call back any time. Bye for now!"
)


# ---------------------------------------------------------------------------
# Never leave a caller listening to silence
# ---------------------------------------------------------------------------

# What the agent says when its brain is unreachable. Deliberately honest and
# short: the caller's time is worth more than an excuse.
LLM_FAILURE_SPEECH = (
    "I'm really sorry — I'm having a technical problem on my side and I can't "
    "answer that right now. Please try again in a few minutes, and someone from "
    "the team will follow up with you."
)


class LLMFailureGuard:
    """
    Speak when the LLM cannot.

    When OpenAI ran out of quota, the pipeline did exactly what it was told: the
    LLM raised, pipecat logged "Something went wrong", and the ErrorFrame died in
    the task. Nobody told the CALLER. Two people sat on the phone listening to an
    open line, said their order number into nothing, and hung up.

    Dead air is the worst failure mode a phone agent has: silence reads as "this
    business is broken", not "this service is degraded". So the error is caught on
    its way upstream, the agent apologises out loud in its own voice (TTS is a
    different vendor and is still perfectly alive), and the call is ended cleanly
    instead of left hanging.
    """

    def __init__(self, session: "BotSession") -> None:
        from pipecat.processors.frame_processor import FrameProcessor

        guard_self = self
        self._session = session
        self._handled = False

        class _Guard(FrameProcessor):
            async def process_frame(self, frame, direction):
                await super().process_frame(frame, direction)
                await guard_self._maybe_speak(self, frame, direction)
                await self.push_frame(frame, direction)

        self.processor = _Guard()

    async def _maybe_speak(self, processor, frame, direction) -> None:
        from pipecat.frames.frames import ErrorFrame, TTSSpeakFrame
        from pipecat.processors.frame_processor import FrameDirection

        if not isinstance(frame, ErrorFrame) or self._handled:
            return
        self._handled = True

        log.error(
            "llm failed mid-call — speaking the fallback instead of going silent",
            extra={
                "call_id": self._session.params.call_id,
                "error": str(getattr(frame, "error", ""))[:300],
            },
        )

        try:
            await processor.push_frame(
                TTSSpeakFrame(LLM_FAILURE_SPEECH), FrameDirection.DOWNSTREAM
            )
        except Exception as exc:  # noqa: BLE001
            log.warning("could not speak the fallback", extra={"error": str(exc)})

        # Give the sentence time to actually reach the caller, then hang up.
        async def _end_after_speaking() -> None:
            await asyncio.sleep(9)
            await self._session.stop("llm_unavailable")

        asyncio.create_task(_end_after_speaking())


# ---------------------------------------------------------------------------
# LLM provider selection + failover
# ---------------------------------------------------------------------------

# The result of the last provider health probe, so we do not pay for one on
# every call: (provider_name, expires_at_monotonic).
_LLM_HEALTH_CACHE: Dict[str, float] = {}
_LLM_HEALTH_TTL_SECONDS = 300


async def _openai_is_usable(settings: Settings) -> bool:
    """
    Is the OpenAI account actually able to answer right now?

    A key can be perfectly valid and still be useless: when the account runs out
    of credit OpenAI returns 429 `insufficient_quota` on every completion. That is
    exactly what happened here — the agent kept its keys, kept its voice, and went
    silent for two whole calls because the ONE service with no redundancy had
    quietly stopped answering.

    So we ask it, cheaply (1 token), before we bet a phone call on it. The answer
    is cached for five minutes: a call must not pay for this probe every time.
    """
    if not settings.openai_api_key:
        return False

    cached = _LLM_HEALTH_CACHE.get("openai_ok_until", 0.0)
    if cached > time.monotonic():
        return True
    failed_until = _LLM_HEALTH_CACHE.get("openai_bad_until", 0.0)
    if failed_until > time.monotonic():
        return False

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {settings.openai_api_key}"},
                json={
                    "model": settings.openai_model,
                    "messages": [{"role": "user", "content": "hi"}],
                    "max_tokens": 1,
                },
                timeout=aiohttp.ClientTimeout(total=8),
            ) as resp:
                ok = resp.status == 200
                if not ok:
                    body = (await resp.text())[:200]
                    log.warning(
                        "openai health probe failed",
                        extra={"status": resp.status, "body": body},
                    )
    except Exception as exc:  # noqa: BLE001
        log.warning("openai health probe errored", extra={"error": str(exc)})
        ok = False

    key = "openai_ok_until" if ok else "openai_bad_until"
    _LLM_HEALTH_CACHE[key] = time.monotonic() + _LLM_HEALTH_TTL_SECONDS
    return ok


def _llm_tuning_params(settings: Settings):
    """
    Sampling settings for the conversational brain. Default OpenAI temperature
    is 1.0 — noticeably rambly on a phone call. ~0.6-0.7 keeps replies focused
    and consistent while still sounding human. Guarded: if this pipecat build's
    InputParams differs, we fall back to service defaults rather than fail a call.
    """
    from pipecat.services.openai.llm import OpenAILLMService

    try:
        return OpenAILLMService.InputParams(temperature=settings.llm_temperature)
    except Exception as exc:  # noqa: BLE001
        log.warning("llm tuning params unavailable", extra={"error": str(exc)[:120]})
        return None


async def _make_llm(settings: Settings, call_id: str):
    """
    Build the LLM service for THIS call, on a provider that is actually working.

    Novita is OpenAI-wire-compatible, so the fallback is the same service class
    with a different base_url — and it is a proven tool-caller, which matters:
    a voice agent that cannot call getOrder cannot answer the only questions
    anyone phones about.
    """
    from pipecat.services.openai.llm import OpenAILLMService

    provider = settings.llm_provider
    if provider == "auto":
        provider = "openai" if await _openai_is_usable(settings) else "novita"

    tuning = _llm_tuning_params(settings)
    extra: Dict[str, Any] = {"params": tuning} if tuning is not None else {}

    if provider == "novita" and settings.novita_api_key:
        log.info(
            "llm provider selected",
            extra={
                "call_id": call_id,
                "provider": "novita",
                "model": settings.novita_model,
            },
        )
        return OpenAILLMService(
            api_key=settings.novita_api_key,
            model=settings.novita_model,
            base_url=settings.novita_base_url,
            **extra,
        )

    log.info(
        "llm provider selected",
        extra={
            "call_id": call_id,
            "provider": "openai",
            "model": settings.openai_model,
        },
    )
    return OpenAILLMService(
        api_key=settings.openai_api_key,
        model=settings.openai_model,
        **extra,
    )


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
    """
    nova-3 across the board: it is Deepgram's current best for BOTH English and
    multilingual real-time transcription (lower word-error rate than nova-2,
    better numerals — which is what order numbers, prices and phone numbers
    ride on).
    """
    return "nova-3"


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

        # Spoken tool-filler pacing (never two fillers back to back).
        self._last_filler_at = 0.0
        self._last_filler_text = ""

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

    # -- shared naturalness builders ------------------------------------------

    def _compose_system_prompt(self, config: AgentConfig) -> str:
        """Playbook persona + the runtime spoken-delivery rules."""
        base = (config.system_prompt or "").rstrip()
        if not base:
            return VOICE_STYLE_RULES
        return base + "\n\n" + VOICE_STYLE_RULES

    def _make_turn_analyzer(self, config: AgentConfig):
        """
        Smart Turn v2 — a semantic end-of-turn model. Instead of "0.8s of
        silence means they're done", it listens to HOW the caller stopped
        (intonation, mid-thought pauses) and either releases the turn almost
        immediately or grants them more time. This is the mechanism behind the
        'it never talks over me, yet answers instantly' feel of the best
        commercial agents. Optional: requires torch (VOICE_SMART_TURN=true) and
        is skipped for languages the model doesn't cover (Bengali).
        """
        if not self.settings.smart_turn:
            return None
        lang = (config.voice_language or "en").lower()
        if lang.startswith("bn"):
            log.info(
                "smart turn skipped for unsupported language",
                extra={"call_id": self.params.call_id, "language": lang},
            )
            return None
        try:
            from pipecat.audio.turn.smart_turn.base_smart_turn import SmartTurnParams
            from pipecat.audio.turn.smart_turn.local_smart_turn_v2 import (
                LocalSmartTurnAnalyzerV2,
            )

            analyzer = LocalSmartTurnAnalyzerV2(
                smart_turn_model_path=self.settings.smart_turn_model_path or None,
                params=SmartTurnParams(
                    stop_secs=self.settings.smart_turn_stop_secs,
                ),
            )
            log.info("smart turn v2 enabled", extra={"call_id": self.params.call_id})
            return analyzer
        except Exception as exc:  # noqa: BLE001
            log.warning(
                "smart turn unavailable — using tuned VAD endpointing",
                extra={"call_id": self.params.call_id, "error": str(exc)[:200]},
            )
            return None

    def _make_vad(self, smart_turn_active: bool):
        """
        Tuned Silero VAD. With smart turn active the VAD only needs to detect
        the CANDIDATE pause (0.2s) — the model decides if the turn is over.
        Without it, VOICE_VAD_STOP_SECS (default 0.5s, down from pipecat's
        0.8s) is the response-gap floor.
        """
        from pipecat.audio.vad.silero import SileroVADAnalyzer
        from pipecat.audio.vad.vad_analyzer import VADParams

        s = self.settings
        stop_secs = 0.2 if smart_turn_active else s.vad_stop_secs
        return SileroVADAnalyzer(
            params=VADParams(
                confidence=s.vad_confidence,
                start_secs=s.vad_start_secs,
                stop_secs=stop_secs,
                min_volume=s.vad_min_volume,
            )
        )

    def _make_stt(self, config: AgentConfig, *, twilio: bool = False):
        from deepgram import LiveOptions
        from pipecat.services.deepgram.stt import DeepgramSTTService

        opts: Dict[str, Any] = dict(
            model=_deepgram_model(config.voice_language),
            language=config.voice_language,
            smart_format=True,
            numerals=True,
            interim_results=True,
            punctuate=True,
        )
        if twilio:
            opts["encoding"] = "mulaw"
            opts["sample_rate"] = 8000
        return DeepgramSTTService(
            api_key=self.settings.deepgram_api_key,
            live_options=LiveOptions(**opts),
            addons={"keepalive": "true"},
        )

    def _make_tts(self, config: AgentConfig, *, twilio: bool = False):
        """
        ElevenLabs, tuned for live conversation:
          - flash v2.5 (default): ~75ms model latency, the realtime
            conversational model — the difference between "walkie talkie" and
            "person".
          - stability/similarity at the canonical conversational values so the
            voice breathes instead of sounding flat.
          - a markdown filter so a stray "**" or list bullet from the LLM is
            never read out loud.
        """
        from pipecat.services.elevenlabs.tts import ElevenLabsTTSService
        from pipecat.utils.text.markdown_text_filter import MarkdownTextFilter

        s = self.settings
        params = ElevenLabsTTSService.InputParams(
            stability=s.tts_stability,
            similarity_boost=s.tts_similarity,
            style=s.tts_style if s.tts_style > 0 else None,
            use_speaker_boost=True,
            speed=s.tts_speed,
            auto_mode=True,
        )
        kwargs: Dict[str, Any] = dict(
            api_key=s.elevenlabs_api_key,
            voice_id=resolve_voice_id(config, s),
            model=s.elevenlabs_model,
            params=params,
            text_filters=[MarkdownTextFilter()],
        )
        if twilio:
            # Twilio Media Streams are 8kHz; the serializer encodes to mu-law.
            kwargs["sample_rate"] = 8000
        return ElevenLabsTTSService(**kwargs)

    def _make_user_idle(self):
        """
        A human agent never lets 10 seconds of silence pass without a word.
        First a gentle check-in, then a clearer one, then a polite goodbye and
        a clean hangup (disposition preserved). Timer resets whenever the
        caller speaks.
        """
        if not self.settings.idle_enabled:
            return None

        from pipecat.frames.frames import TTSSpeakFrame
        from pipecat.processors.user_idle_processor import UserIdleProcessor

        async def handle_idle(processor, retry_count: int) -> bool:
            log.info(
                "caller idle",
                extra={"call_id": self.params.call_id, "retry": retry_count},
            )
            if retry_count == 1:
                await processor.push_frame(
                    TTSSpeakFrame(random.choice(IDLE_FIRST_CHECKINS))
                )
                return True
            if retry_count == 2:
                await processor.push_frame(
                    TTSSpeakFrame(random.choice(IDLE_SECOND_CHECKINS))
                )
                return True
            await processor.push_frame(TTSSpeakFrame(IDLE_GOODBYE))
            self._ended_reason = self._ended_reason or "user_idle_timeout"
            asyncio.create_task(self._end_pipeline(after_speech=True))
            return False

        return UserIdleProcessor(
            callback=handle_idle, timeout=self.settings.idle_timeout_secs
        )

    def _pipeline_params(self):
        from pipecat.pipeline.task import PipelineParams

        kwargs: Dict[str, Any] = dict(
            allow_interruptions=True,
            enable_metrics=True,
            enable_usage_metrics=True,
        )
        if self.settings.interrupt_min_words > 0:
            try:
                from pipecat.audio.interruptions.min_words_interruption_strategy import (
                    MinWordsInterruptionStrategy,
                )

                kwargs["interruption_strategies"] = [
                    MinWordsInterruptionStrategy(
                        min_words=self.settings.interrupt_min_words
                    )
                ]
            except Exception as exc:  # noqa: BLE001
                log.warning(
                    "interruption strategy unavailable",
                    extra={"error": str(exc)[:120]},
                )
        return PipelineParams(**kwargs)

    def _pipeline_processors(
        self, transport, stt, context_aggregator, llm_guard, llm, tts, audiobuffer
    ) -> list:
        """The shared processor chain for both transports."""
        chain: list = [transport.input(), stt]
        user_idle = self._make_user_idle()
        if user_idle is not None:
            chain.append(user_idle)
        chain.extend(
            [
                context_aggregator.user(),
                # The guard sits directly BEFORE the LLM because an ErrorFrame
                # travels UPSTREAM — a guard placed after the LLM would never
                # see the failure it exists to catch.
                llm_guard.processor,
                llm,
                tts,
                transport.output(),
                audiobuffer,
                context_aggregator.assistant(),
            ]
        )
        return chain

    # -- pipeline (Daily / web) -------------------------------------------------

    async def _run_pipeline(self, config: AgentConfig) -> None:
        # Imports are local so a missing optional dependency surfaces per-call
        # (logged + reported) instead of failing the whole server at import time.
        from pipecat.pipeline.pipeline import Pipeline
        from pipecat.pipeline.runner import PipelineRunner
        from pipecat.pipeline.task import PipelineTask
        from pipecat.processors.aggregators.openai_llm_context import (
            OpenAILLMContext,
        )
        from pipecat.transports.services.daily import DailyParams, DailyTransport

        cid = self.params.call_id
        settings = self.settings

        # 1. Mint a Daily meeting token for the (already-created) room.
        token = await self._mint_token(self.params.room_url)

        # 2. Transport — join the room as the 2nd participant, with tuned
        #    turn-taking (smart turn when available, tuned VAD otherwise).
        turn_analyzer = self._make_turn_analyzer(config)
        daily_params = DailyParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
            transcription_enabled=False,  # we run Deepgram STT in-pipeline
            vad_analyzer=self._make_vad(turn_analyzer is not None),
        )
        if turn_analyzer is not None:
            daily_params.turn_analyzer = turn_analyzer
        transport = DailyTransport(
            self.params.room_url,
            token,
            settings.bot_name,
            daily_params,
        )

        # 3. STT (Deepgram nova-3, streaming).
        stt = self._make_stt(config)

        # 4. LLM (OpenAI) with the pulled system prompt + tools as function schemas.
        llm = await _make_llm(settings, self.params.call_id)

        messages: List[Dict[str, Any]] = [
            {"role": "system", "content": self._compose_system_prompt(config)},
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

        # 5. TTS (ElevenLabs, conversational tuning).
        tts = self._make_tts(config)

        # 6. The pipeline. The audio recorder sits right after transport.output()
        #    so it captures BOTH the caller's mic and the agent's spoken audio,
        #    exactly as heard (lossless PCM — never re-synthesized).
        audiobuffer = self._make_audio_recorder()
        llm_guard = LLMFailureGuard(self)
        pipeline = Pipeline(
            self._pipeline_processors(
                transport, stt, context_aggregator, llm_guard, llm, tts, audiobuffer
            )
        )

        task = PipelineTask(pipeline, params=self._pipeline_params())
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
        from pipecat.pipeline.pipeline import Pipeline
        from pipecat.pipeline.runner import PipelineRunner
        from pipecat.pipeline.task import PipelineTask
        from pipecat.processors.aggregators.openai_llm_context import OpenAILLMContext
        from pipecat.serializers.twilio import TwilioFrameSerializer
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

        # Phone audio is narrowband and noisier than a web mic: keep the tuned
        # VAD (no smart turn on 8kHz for now) and require a real word before an
        # interruption cancels the bot's speech.
        transport = FastAPIWebsocketTransport(
            websocket=websocket,
            params=FastAPIWebsocketParams(
                audio_in_enabled=True,
                audio_out_enabled=True,
                # Twilio Media Streams are 8kHz mono mu-law both ways.
                audio_in_sample_rate=8000,
                audio_out_sample_rate=8000,
                add_wav_header=False,
                vad_analyzer=self._make_vad(False),
                serializer=serializer,
            ),
        )

        stt = self._make_stt(config, twilio=True)

        llm = await _make_llm(settings, self.params.call_id)
        messages = [
            {"role": "system", "content": self._compose_system_prompt(config)}
        ]
        if config.first_message:
            messages.append({"role": "assistant", "content": config.first_message})
        context = OpenAILLMContext(messages, tools=config.tools or None)
        self._context = context
        context_aggregator = llm.create_context_aggregator(context)
        self._register_tools(llm, config)

        tts = self._make_tts(config, twilio=True)

        audiobuffer = self._make_audio_recorder()
        llm_guard = LLMFailureGuard(self)
        pipeline = Pipeline(
            self._pipeline_processors(
                transport, stt, context_aggregator, llm_guard, llm, tts, audiobuffer
            )
        )
        task = PipelineTask(pipeline, params=self._pipeline_params())
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

    async def _speak_tool_filler(self, llm_processor, tool_name: str) -> None:
        """
        Speak a short, contextual acknowledgment the moment a slow lookup
        starts, in the agent's own voice — the caller hears "one sec, let me
        pull that up" instead of dead air while Medusa answers. Rate-limited so
        chained tool calls in one turn don't stack fillers.
        """
        if not self.settings.fillers_enabled or tool_name in SILENT_TOOLS:
            return
        now = time.monotonic()
        if now - self._last_filler_at < FILLER_MIN_GAP_SECONDS:
            return
        choices = TOOL_FILLERS.get(tool_name, DEFAULT_FILLERS)
        phrase = random.choice(choices)
        if phrase == self._last_filler_text and len(choices) > 1:
            phrase = random.choice([c for c in choices if c != phrase])
        self._last_filler_at = now
        self._last_filler_text = phrase
        try:
            from pipecat.frames.frames import TTSSpeakFrame

            await llm_processor.push_frame(TTSSpeakFrame(phrase))
        except Exception as exc:  # noqa: BLE001
            log.warning(
                "tool filler failed",
                extra={"call_id": self.params.call_id, "error": str(exc)[:120]},
            )

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

            # Fill the lookup latency with a spoken acknowledgment.
            llm_proc = getattr(params, "llm", None) or llm
            await self._speak_tool_filler(llm_proc, name or "")

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
