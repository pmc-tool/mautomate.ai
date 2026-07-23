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
import os
import random
import time
import uuid
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import aiohttp

import langfuse_tracing
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


# ---------------------------------------------------------------------------
# Voice -> card bridge: sanitize + cap helpers (mirror the text SSE route.ts)
# ---------------------------------------------------------------------------

# Additive side-channel only. These bound what the browser receives so a large
# or awkward tool payload can never bloat an app-message. Caps mirror the text
# SSE route (apps/backend/.../jarvis/route.ts): args depth-1 primitives with
# 500-char string truncation; data capped at ~32KB with array shrink to 10.
_CARD_MAX_BYTES = 32 * 1024


def _sanitize_card_args(args: Any) -> Dict[str, Any]:
    """Depth-1, primitives only, long strings truncated. No secrets today."""
    out: Dict[str, Any] = {}
    if not isinstance(args, dict):
        return out
    for k, v in args.items():
        key = str(k)
        if v is None:
            out[key] = None
        elif isinstance(v, bool):  # bool before int (bool is an int subclass)
            out[key] = v
        elif isinstance(v, (int, float)):
            out[key] = v
        elif isinstance(v, str):
            out[key] = (v[:500] + "\u2026") if len(v) > 500 else v
        elif isinstance(v, (list, tuple)):
            out[key] = "[%d items]" % len(v)
        elif isinstance(v, dict):
            out[key] = "[object]"
        # functions/other dropped
    return out


def _cap_card_data(value: Any) -> Any:
    """Bound a read result to ~32KB, shrinking arrays; always JSON-safe."""
    import json

    try:
        blob = json.dumps(value, default=str)
    except Exception:  # noqa: BLE001
        return {"_unserializable": True}
    if len(blob) <= _CARD_MAX_BYTES:
        try:
            return json.loads(blob)
        except Exception:  # noqa: BLE001
            return value
    if isinstance(value, list):
        return {"_truncated": True, "_count": len(value), "items": value[:10]}
    if isinstance(value, dict):
        shrunk: Dict[str, Any] = {}
        for k, v in value.items():
            shrunk[str(k)] = v[:10] if isinstance(v, list) else v
        shrunk["_truncated"] = True
        try:
            reblob = json.dumps(shrunk, default=str)
            if len(reblob) <= _CARD_MAX_BYTES:
                return json.loads(reblob)
        except Exception:  # noqa: BLE001
            pass
    return {"_truncated": True, "_note": "result too large to display"}


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

# A filler only speaks if the tool hasn't ALREADY answered within this window —
# fast lookups stay seamless, slow ones get covered. (Cancelled on result.)
FILLER_DELAY_SECONDS = 0.4


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


# ---------------------------------------------------------------------------
# Pixi fixed-phrase pre-warm (Deepgram Aura-2 TTS cache)
# ---------------------------------------------------------------------------

# The Pixi greeting is now static (no per-call variables) → fully cacheable.
JARVIS_STATIC_GREETING = "Hey boss, it is Pixi. How can I help you today?"

# Deepgram Aura-2 voice Pixi speaks in (per-call config.voice_id overrides;
# this is the default and what we pre-warm).
JARVIS_TTS_VOICE = "aura-2-thalia-en"

# Ultra-common short acknowledgments. The LLM normally produces these live, but
# warming them in Aura-2 is cheap and makes them instant + free if they recur
# verbatim. Warming-only — nothing forces the model to use these exact strings.
JARVIS_COMMON_PHRASES = [
    "One moment.",
    "Let me pull that up.",
    "Thanks!",
    "You're welcome.",
    "Sure thing.",
]


def _jarvis_fixed_phrases() -> List[str]:
    """Every fixed phrase Pixi can speak through the cache — the greeting, all
    tool fillers, the idle check-ins / goodbye, the LLM-failure line, and the
    common acknowledgments. Deduped, order-preserved."""
    phrases: List[str] = [JARVIS_STATIC_GREETING]
    for group in TOOL_FILLERS.values():
        phrases.extend(group)
    phrases.extend(DEFAULT_FILLERS)
    phrases.extend(IDLE_FIRST_CHECKINS)
    phrases.extend(IDLE_SECOND_CHECKINS)
    phrases.append(IDLE_GOODBYE)
    phrases.append(LLM_FAILURE_SPEECH)
    phrases.extend(JARVIS_COMMON_PHRASES)
    seen: set = set()
    out: List[str] = []
    for p in phrases:
        if p and p not in seen:
            seen.add(p)
            out.append(p)
    return out


async def warm_jarvis_phrase_cache(settings) -> int:
    """Pre-render the fixed Pixi phrases in Deepgram Aura-2 so even the FIRST
    call is instant + free.

    DEEPGRAM-ONLY: never touches Ava's ElevenLabs cache. Best-effort — returns
    how many phrases are cached; any per-phrase error is swallowed so warmup can
    never affect call handling.
    """
    try:
        import tts_cache
    except Exception:  # noqa: BLE001
        return 0
    api_key = getattr(settings, "deepgram_api_key", "") or ""
    if not api_key:
        return 0
    warmed = 0
    for phrase in _jarvis_fixed_phrases():
        try:
            data = await tts_cache.cached_pcm(
                text=phrase,
                voice_id=JARVIS_TTS_VOICE,
                api_key=api_key,
                model="",
                provider="deepgram",
                sample_rate=tts_cache.DEEPGRAM_SAMPLE_RATE,
            )
            if data:
                warmed += 1
        except Exception:  # noqa: BLE001
            pass
    return warmed


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
            # Cached on the Pixi (Deepgram) path so even the failure line is
            # free; Ava (ElevenLabs) keeps the plain live TTSSpeakFrame exactly
            # as before. push_frame defaults to DOWNSTREAM (toward the output).
            await self._session._push_cached_or_speak(
                processor, LLM_FAILURE_SPEECH, self._session._active_config
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


async def _make_llm(settings: Settings, call_id: str, config=None):
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

    # Per-session override (Pixi voice pins the CHEAP Novita/Kimi brain for
    # THIS call only). Ava's agent-config carries no `llm`, so she is entirely
    # unaffected. Only honour a provider we actually hold a key for.
    cfg_llm = getattr(config, "llm", None) or {}
    cfg_provider = str(cfg_llm.get("provider") or "").strip().lower()
    if cfg_provider == "novita" and settings.novita_api_key:
        provider = "novita"
    elif cfg_provider == "openai" and settings.openai_api_key:
        provider = "openai"

    # --- Groq for Pixi voice: fast + cheap tool-caller, prompt-cache-friendly.
    # Chosen when the backend pins provider "groq" OR this is the Pixi playbook
    # and Groq is enabled (default). Ava's playbooks are never "jarvis" and her
    # config carries no llm.provider, so she is entirely untouched. On ANY build
    # failure we fall through to the Novita/OpenAI path below so a live call
    # never breaks.
    is_jarvis = (
        (getattr(config, "playbook_id", "") or "").strip().lower() == "jarvis"
    )
    want_groq = (cfg_provider == "groq") or (
        is_jarvis and settings.jarvis_llm_provider == "groq"
    )
    if want_groq and settings.groq_api_key:
        try:
            try:
                groq_params = OpenAILLMService.InputParams(
                    temperature=settings.llm_temperature,
                    max_tokens=settings.groq_max_tokens,
                )
            except Exception as exc:  # noqa: BLE001
                log.warning(
                    "groq tuning params unavailable",
                    extra={"error": str(exc)[:120]},
                )
                groq_params = None
            groq_extra = {"params": groq_params} if groq_params is not None else {}
            groq_llm = OpenAILLMService(
                api_key=settings.groq_api_key,
                model=settings.groq_model,
                base_url=settings.groq_base_url,
                **groq_extra,
            )
            groq_llm._lf_provider = "groq"
            groq_llm._lf_model = settings.groq_model
            log.info(
                "jarvis llm = groq",
                extra={
                    "call_id": call_id,
                    "provider": "groq",
                    "model": settings.groq_model,
                    "max_tokens": settings.groq_max_tokens,
                },
            )
            return groq_llm
        except Exception as exc:  # noqa: BLE001
            log.warning(
                "groq llm build failed; falling back to novita/openai",
                extra={"call_id": call_id, "error": str(exc)[:200]},
            )

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
        llm = OpenAILLMService(
            api_key=settings.novita_api_key,
            model=settings.novita_model,
            base_url=settings.novita_base_url,
            **extra,
        )
        # Non-functional tags read only by the (guarded) Langfuse trace setup.
        llm._lf_provider = "novita"
        llm._lf_model = settings.novita_model
        return llm

    log.info(
        "llm provider selected",
        extra={
            "call_id": call_id,
            "provider": "openai",
            "model": settings.openai_model,
        },
    )
    llm = OpenAILLMService(
        api_key=settings.openai_api_key,
        model=settings.openai_model,
        **extra,
    )
    # Non-functional tags read only by the (guarded) Langfuse trace setup.
    llm._lf_provider = "openai"
    llm._lf_model = settings.openai_model
    return llm


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


# Process-lifetime aiohttp session shared by every Piper TTS instance.
# pipecat PiperTTSService NEVER closes the session it is given (verified
# across TTSService/AIService/FrameProcessor: none touch _session), so the
# CALLER owns its lifetime. We keep ONE session for the whole voice-agent
# process (uvicorn = one event loop) and never close it per-call. A per-call
# session closed at call end raced with in-flight/goodbye TTS -> aiohttp
# "Session is closed". aiohttp sessions are designed for concurrent reuse.
_PIPER_HTTP_SESSION: Optional[aiohttp.ClientSession] = None


def _get_piper_session() -> aiohttp.ClientSession:
    """Lazily create (once) and return the shared Piper HTTP session.
    Created inside the running uvicorn loop on first Pixi call; reused for
    the life of the process. Recreated only if somehow found closed."""
    global _PIPER_HTTP_SESSION
    if _PIPER_HTTP_SESSION is None or _PIPER_HTTP_SESSION.closed:
        _PIPER_HTTP_SESSION = aiohttp.ClientSession()
    return _PIPER_HTTP_SESSION


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
        # Human-transfer hold (ring-the-team) in progress.
        self._transfer_holding = False

        # The moment a human actually connected (joined the room / answered).
        # Billing and the max-duration cap run from HERE, not from bot start —
        # a pre-warmed bot waiting alone in a room costs the merchant nothing.
        self._connected_at: Optional[float] = None

        # Whether this call runs on the speech-to-speech (Realtime) pilot.
        self._realtime_active = False

        # Per-call Langfuse trace (super-admin LLM cost visibility). Always a
        # CallTrace object; inert (no-op) when tracing is disabled. Fully
        # guarded so it can never affect the call (Pixi or Ava).
        self._call_trace: Optional[langfuse_tracing.CallTrace] = None
        # The config in effect for this call and the transport family in use
        # ("daily" / "vonage" / "twilio"). Captured for per-call cost pricing at
        # finalization (STT/TTS/transport components on the Langfuse trace).
        self._active_config: Optional[AgentConfig] = None
        self._transport_kind: str = ""

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

    def _realtime_enabled(self, config: AgentConfig) -> bool:
        """
        Speech-to-speech pilot gate. On when VOICE_REALTIME=true (global) or the
        playbook id is listed in VOICE_REALTIME_AGENTS (comma-separated), and an
        OpenAI key exists. Web (Daily) calls only for now.
        """
        s = self.settings
        if not s.openai_api_key:
            return False
        if s.realtime_enabled:
            return True
        agents = {a.strip() for a in (s.realtime_agents or "").split(",") if a.strip()}
        return (config.playbook_id or "") in agents or self.params.playbook_id in agents

    def _make_realtime_llm(self, config: AgentConfig):
        """
        OpenAI Realtime (speech-to-speech). One model hears and speaks: no
        STT/TTS relay, native prosody, and SERVER-SIDE semantic turn detection —
        the model itself decides whether the caller is done or mid-thought.
        Tools still route through /telephony/tool-execute unchanged.
        """
        from pipecat.services.openai_realtime_beta import (
            OpenAIRealtimeBetaLLMService,
        )
        from pipecat.services.openai_realtime_beta.events import (
            SemanticTurnDetection,
            SessionProperties,
        )

        # Realtime tool schemas are FLAT ({type, name, ...}), not the nested
        # chat-completions shape the config ships.
        tools: List[Dict[str, Any]] = []
        for t in config.tools or []:
            fn = t.get("function") if isinstance(t, dict) else None
            if fn and fn.get("name"):
                tools.append(
                    {
                        "type": "function",
                        "name": fn.get("name"),
                        "description": fn.get("description") or "",
                        "parameters": fn.get("parameters") or {},
                    }
                )

        instructions = self._compose_system_prompt(config)
        if config.first_message:
            instructions += (
                "\n\nBegin the call by greeting the caller with exactly: "
                f'"{config.first_message}"'
            )

        props = SessionProperties(
            instructions=instructions,
            voice=self.settings.realtime_voice,
            turn_detection=SemanticTurnDetection(),
            tools=tools or None,
        )
        log.info(
            "llm provider selected",
            extra={
                "call_id": self.params.call_id,
                "provider": "openai-realtime",
                "model": self.settings.realtime_model,
                "voice": self.settings.realtime_voice,
            },
        )
        return OpenAIRealtimeBetaLLMService(
            api_key=self.settings.openai_api_key,
            model=self.settings.realtime_model,
            session_properties=props,
            send_transcription_frames=True,
        )

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
        # FREE TTS (Pixi voice): self-hosted Piper via its HTTP server
        # (pm2 b2d-piper on 127.0.0.1:5060). Taken ONLY when the agent-config
        # voice.provider is "piper" (Pixi sessions). Ava plays back
        # "elevenlabs"/empty and NEVER enters this branch. Any failure falls
        # through to ElevenLabs below, so a call is never lost.
        if (getattr(config, "voice_provider", "") or "").lower() == "piper":
            try:
                import os
                from pipecat.services.piper.tts import PiperTTSService

                base_url = os.environ.get("PIPER_BASE_URL", "http://127.0.0.1:5060")
                # Shared, process-lifetime session (see _get_piper_session).
                # PiperTTSService does not own/close it, so it survives the
                # whole call incl. goodbye/fallback speech and every turn.
                return PiperTTSService(
                    base_url=base_url,
                    aiohttp_session=_get_piper_session(),
                    # en_US-lessac-medium is 22050 Hz; raw PCM is tagged at
                    # this rate and the output transport resamples to the
                    # call rate (Daily / Twilio 8k).
                    sample_rate=22050,
                )
            except Exception as exc:  # noqa: BLE001
                log.warning(
                    "piper TTS unavailable; using ElevenLabs",
                    extra={"call_id": self.params.call_id, "error": str(exc)[:120]},
                )

        # CHEAP TTS (Pixi voice): Deepgram Aura-2 reuses the existing Deepgram
        # key (no extra vendor) and is far cheaper than ElevenLabs. Taken ONLY
        # when the agent-config voice.provider is "deepgram"; Ava's playbooks
        # return "elevenlabs", so she keeps ElevenLabs. Any failure falls
        # through to the ElevenLabs path below, so a call is never lost.
        if (getattr(config, "voice_provider", "") or "").lower() == "deepgram":
            try:
                from pipecat.services.deepgram.tts import DeepgramTTSService
                from pipecat.utils.text.markdown_text_filter import (
                    MarkdownTextFilter as _DgMarkdownFilter,
                )

                aura_voice = (config.voice_id or "aura-2-thalia-en").strip()
                dg_kwargs: Dict[str, Any] = dict(
                    api_key=self.settings.deepgram_api_key,
                    voice=aura_voice,
                    text_filters=[_DgMarkdownFilter()],
                )
                if twilio:
                    dg_kwargs["sample_rate"] = 8000
                log.info(
                    "jarvis tts = deepgram aura",
                    extra={"call_id": self.params.call_id, "voice": aura_voice},
                )
                return DeepgramTTSService(**dg_kwargs)
            except Exception as exc:  # noqa: BLE001
                log.warning(
                    "deepgram TTS unavailable; using ElevenLabs",
                    extra={"call_id": self.params.call_id, "error": str(exc)[:120]},
                )

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

        from pipecat.processors.user_idle_processor import UserIdleProcessor

        async def handle_idle(processor, retry_count: int) -> bool:
            log.info(
                "caller idle",
                extra={"call_id": self.params.call_id, "retry": retry_count},
            )
            # Fixed idle lines are cached on the Pixi (Deepgram) path so they
            # cost nothing; Ava (ElevenLabs) keeps a plain live TTSSpeakFrame.
            cfg = self._active_config
            if retry_count == 1:
                await self._push_cached_or_speak(
                    processor, random.choice(IDLE_FIRST_CHECKINS), cfg
                )
                return True
            if retry_count == 2:
                await self._push_cached_or_speak(
                    processor, random.choice(IDLE_SECOND_CHECKINS), cfg
                )
                return True
            await self._push_cached_or_speak(processor, IDLE_GOODBYE, cfg)
            self._ended_reason = self._ended_reason or "user_idle_timeout"
            asyncio.create_task(self._end_pipeline(after_speech=True))
            return False

        return UserIdleProcessor(
            callback=handle_idle, timeout=self.settings.idle_timeout_secs
        )

    def _begin_trace(self, config: AgentConfig, llm) -> list:
        """Open the per-call Langfuse trace and return its pipecat observers.

        Fully guarded: returns [] on any problem or when tracing is disabled,
        so PipelineTask gets no extra observers and the call is unchanged. The
        observer only reads metrics frames — it never alters the pipeline, so
        both Pixi and Ava are behaviourally untouched.
        """
        try:
            self._active_config = config
            # Explicit, cache-aware LLM pricing is applied ONLY to the Novita
            # (Kimi) brain that Pixi uses — Novita auto-caches the stable
            # system+tools prefix, so pricing every input token at the full rate
            # overstates cost. All other providers (OpenAI for the auto/Ava
            # path, Groq gpt-oss whose caching is not observable) keep Langfuse's
            # own model-based pricing unchanged. See langfuse_tracing.log_generation.
            lf_provider = (getattr(llm, "_lf_provider", None) or "").lower()
            llm_pricing = {
                "apply": lf_provider == "novita",
                "approximate_cache": lf_provider == "novita",
                "input_per_1m": self.settings.voice_llm_input_usd_per_1m,
                "output_per_1m": self.settings.voice_llm_output_usd_per_1m,
                "cached_per_1m": self.settings.voice_llm_cached_usd_per_1m,
                "prefix_tokens": self.settings.voice_llm_cached_prefix_tokens,
            }
            self._call_trace = langfuse_tracing.start_call_trace(
                call_id=self.params.call_id,
                tenant_id=self.params.tenant_id,
                playbook_id=(getattr(config, "playbook_id", None)
                             or self.params.playbook_id),
                locale=getattr(config, "locale", None) or self.params.locale,
                provider=getattr(llm, "_lf_provider", None),
                model=getattr(llm, "_lf_model", None),
                llm_pricing=llm_pricing,
            )
            return langfuse_tracing.make_observers(self._call_trace)
        except Exception as exc:  # noqa: BLE001 - tracing must never break a call
            log.debug("langfuse trace setup skipped", extra={"error": str(exc)[:160]})
            return []

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

    def _make_tool_gate(self, context, config):
        # DISABLED by default after the spike: the naive stateless gate can drop
        # tools mid-task ("tool_choice is none, but model called a tool"). Set
        # VOICE_TOOL_GATE=1 to re-enable while building the state-aware version.
        import os as _os
        if _os.environ.get("VOICE_TOOL_GATE") != "1":
            return None
        """SPIKE: per-turn tool gate for the JARVIS playbook only. Sits between
        the user context aggregator and the LLM; on each finished user turn it
        attaches the tool set ONLY when the utterance looks operational, else
        sends [] (zero tool tokens). Returns None for Ava / any non-jarvis
        playbook (no behaviour change). Fully guarded: any failure just passes
        the frame through unchanged."""
        if (getattr(config, "playbook_id", "") or "") != "jarvis":
            return None
        try:
            from pipecat.processors.frame_processor import FrameProcessor
        except Exception:  # noqa: BLE001
            return None

        full_tools = list(config.tools or [])
        OPS = (
            "order", "product", "sale", "stock", "inventory", "restock",
            "price", "refund", "cancel", "fulfil", "fulfill", "ship",
            "deliver", "customer", "inbox", "message", "reply", "revenue",
            "how many", "how much", "show me", "find", "search", "status",
            "pending", "attention", "report", "sell", "credit", "delivery",
        )
        parent = self

        class _ToolGate(FrameProcessor):
            async def process_frame(self, frame, direction):
                await super().process_frame(frame, direction)
                try:
                    if frame.__class__.__name__ in (
                        "OpenAILLMContextFrame", "LLMContextFrame"
                    ):
                        ctx = getattr(frame, "context", None) or context
                        last = ""
                        for m in reversed(ctx.get_messages() or []):
                            role = (
                                m.get("role") if isinstance(m, dict)
                                else getattr(m, "role", None)
                            )
                            if role == "user":
                                c = (
                                    m.get("content") if isinstance(m, dict)
                                    else getattr(m, "content", "")
                                )
                                last = c if isinstance(c, str) else ""
                                break
                        text = (last or "").lower()
                        needs = any(k in text for k in OPS)
                        ctx.set_tools(full_tools if needs else [])
                        log.info(
                            "tool gate",
                            extra={
                                "call_id": parent.params.call_id,
                                "needs_tools": needs,
                                "tool_count": len(full_tools) if needs else 0,
                                "utter": text[:60],
                            },
                        )
                except Exception as exc:  # noqa: BLE001
                    log.warning(
                        "tool gate error (passthrough)",
                        extra={"error": str(exc)[:120]},
                    )
                await self.push_frame(frame, direction)

        return _ToolGate()

    def _pipeline_processors(
        self, transport, stt, context_aggregator, llm_guard, llm, tts,
        audiobuffer, tool_gate=None
    ) -> list:
        """The shared processor chain for both transports."""
        chain: list = [transport.input(), stt]
        user_idle = self._make_user_idle()
        if user_idle is not None:
            chain.append(user_idle)
        chain.append(context_aggregator.user())
        # SPIKE: per-turn tool gate (jarvis web path only) — chooses THIS turn's
        # tool subset just before the LLM. None on Ava / phone paths.
        if tool_gate is not None:
            chain.append(tool_gate)
        chain.extend(
            [
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
        self._transport_kind = "daily"

        # 1. Mint a Daily meeting token for the (already-created) room.
        token = await self._mint_token(self.params.room_url)

        # 2. Transport — join the room as the 2nd participant, with tuned
        #    turn-taking (smart turn when available, tuned VAD otherwise).
        turn_analyzer = self._make_turn_analyzer(config)
        daily_params = DailyParams(
            audio_out_mixer=self._make_mixer(),
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

        # 3-6. Two brains, one bot:
        #   classic  — Deepgram STT -> GPT -> ElevenLabs TTS (default)
        #   realtime — OpenAI speech-to-speech (pilot, env-gated): the model
        #              HEARS the caller (tone, hesitation) and speaks natively,
        #              with server-side semantic turn detection. No STT/TTS.
        audiobuffer = self._make_audio_recorder()
        self._realtime_active = self._realtime_enabled(config)

        if self._realtime_active:
            llm = self._make_realtime_llm(config)
            # Instructions live in the realtime session; context stays empty
            # and simply accumulates the conversation for the transcript.
            context = OpenAILLMContext([], tools=None)
            self._context = context
            context_aggregator = llm.create_context_aggregator(context)
            self._register_tools(llm, config)
            pipeline = Pipeline(
                [
                    transport.input(),
                    context_aggregator.user(),
                    llm,
                    transport.output(),
                    audiobuffer,
                    context_aggregator.assistant(),
                ]
            )
        else:
            stt = self._make_stt(config)
            llm = await _make_llm(settings, self.params.call_id, config)

            messages: List[Dict[str, Any]] = [
                {"role": "system", "content": self._compose_system_prompt(config)},
            ]
            # Seed the fixed greeting as the assistant's opening line so the
            # model has continuity with what the caller heard (spoken via TTS).
            if config.first_message:
                messages.append(
                    {"role": "assistant", "content": config.first_message}
                )

            context = OpenAILLMContext(messages, tools=config.tools or None)
            self._context = context
            context_aggregator = llm.create_context_aggregator(context)

            # Catch-all function handler routed through /telephony/tool-execute.
            self._register_tools(llm, config)

            tts = self._make_tts(config)
            llm_guard = LLMFailureGuard(self)
            # The audio recorder sits right after transport.output() so it
            # captures BOTH voices exactly as heard (lossless PCM).
            tool_gate = self._make_tool_gate(context, config)
            pipeline = Pipeline(
                self._pipeline_processors(
                    transport, stt, context_aggregator, llm_guard, llm, tts,
                    audiobuffer, tool_gate,
                )
            )

        _lf_observers = self._begin_trace(config, llm)
        task = PipelineTask(
            pipeline, params=self._pipeline_params(), observers=_lf_observers
        )
        self._task = task
        self._runner = PipelineRunner(handle_sigint=False)

        self._wire_transport_events(transport, task, config, context_aggregator)

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

    async def run_vonage_stream(self, websocket) -> None:
        """
        Full inbound-phone lifecycle over a Vonage Voice websocket. Mirrors
        `run_twilio_stream` but the media is raw 16kHz linear PCM handled by
        VonageFrameSerializer (see vonage_serializer.py) — wideband, so the
        normal linear STT/TTS path applies (no mu-law narrowband settings).
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
                "agent-config pulled (vonage)",
                extra={"call_id": cid, "playbook_id": config.playbook_id,
                       "tool_count": len(config.tools)},
            )
        except Exception as exc:  # noqa: BLE001
            log.error("agent-config fetch failed (vonage); ending",
                      extra={"call_id": cid, "error": str(exc)}, exc_info=True)
            self._ended_reason = "config_fetch_failed"
            await self._report_ended()
            return

        try:
            await self._run_vonage_pipeline(websocket, config)
        except asyncio.CancelledError:
            self._ended_reason = self._ended_reason or "cancelled"
            raise
        except Exception as exc:  # noqa: BLE001
            log.error("vonage pipeline crashed",
                      extra={"call_id": cid, "error": str(exc)}, exc_info=True)
            self._ended_reason = self._ended_reason or "pipeline_error"
        finally:
            await self._report_ended()

    async def _run_vonage_pipeline(self, websocket, config) -> None:
        from pipecat.pipeline.pipeline import Pipeline
        from pipecat.pipeline.runner import PipelineRunner
        from pipecat.pipeline.task import PipelineTask
        from pipecat.processors.aggregators.openai_llm_context import OpenAILLMContext
        from pipecat.transports.network.fastapi_websocket import (
            FastAPIWebsocketParams,
            FastAPIWebsocketTransport,
        )

        from vonage_serializer import VonageFrameSerializer

        self._transport_kind = "vonage"
        cid = self.params.call_id
        settings = self.settings

        # Vonage websockets carry raw L16 at the rate we requested in the NCCO
        # (16kHz). Keep phone-tuned VAD; no smart turn.
        transport = FastAPIWebsocketTransport(
            websocket=websocket,
            params=FastAPIWebsocketParams(
                audio_out_mixer=self._make_mixer(),
                audio_in_enabled=True,
                audio_out_enabled=True,
                audio_in_sample_rate=16000,
                audio_out_sample_rate=16000,
                add_wav_header=False,
                vad_analyzer=self._make_vad(False),
                serializer=VonageFrameSerializer(call_uuid=cid),
            ),
        )

        stt = self._make_stt(config)

        llm = await _make_llm(settings, self.params.call_id, config)
        messages = [
            {"role": "system", "content": self._compose_system_prompt(config)}
        ]
        if config.first_message:
            messages.append({"role": "assistant", "content": config.first_message})
        context = OpenAILLMContext(messages, tools=config.tools or None)
        self._context = context
        context_aggregator = llm.create_context_aggregator(context)
        self._register_tools(llm, config)

        tts = self._make_tts(config)

        audiobuffer = self._make_audio_recorder()
        llm_guard = LLMFailureGuard(self)
        pipeline = Pipeline(
            self._pipeline_processors(
                transport, stt, context_aggregator, llm_guard, llm, tts, audiobuffer
            )
        )
        _lf_observers = self._begin_trace(config, llm)
        task = PipelineTask(
            pipeline, params=self._pipeline_params(), observers=_lf_observers
        )
        self._task = task
        self._runner = PipelineRunner(handle_sigint=False)

        from pipecat.frames.frames import TTSSpeakFrame

        @transport.event_handler("on_client_connected")
        async def _on_conn(_t, _client):  # noqa: ANN001
            log.info("vonage client connected; greeting", extra={"call_id": cid})
            self._mark_connected()
            await self._start_recording()
            if config.first_message:
                await self._speak_cached_or_tts(config.first_message, config)

        @transport.event_handler("on_client_disconnected")
        async def _on_disc(_t, _client):  # noqa: ANN001
            log.info("vonage client disconnected; ending", extra={"call_id": cid})
            self._ended_reason = self._ended_reason or "caller_hung_up"
            await self._end_pipeline()

        watchdog = asyncio.create_task(self._watchdog())
        log.info("vonage pipeline starting", extra={"call_id": cid})
        try:
            await self._runner.run(task)
        finally:
            watchdog.cancel()
            self._ended.set()
            self._snapshot_transcript()

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

        self._transport_kind = "twilio"
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
                audio_out_mixer=self._make_mixer(),
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

        llm = await _make_llm(settings, self.params.call_id, config)
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
        _lf_observers = self._begin_trace(config, llm)
        task = PipelineTask(
            pipeline, params=self._pipeline_params(), observers=_lf_observers
        )
        self._task = task
        self._runner = PipelineRunner(handle_sigint=False)

        from pipecat.frames.frames import TTSSpeakFrame

        @transport.event_handler("on_client_connected")
        async def _on_conn(_t, _client):  # noqa: ANN001
            log.info("twilio client connected; greeting", extra={"call_id": cid})
            self._mark_connected()
            await self._start_recording()
            if config.first_message:
                await self._speak_cached_or_tts(config.first_message, config)

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

    def _wire_transport_events(
        self, transport, task, config: AgentConfig, context_aggregator=None
    ) -> None:
        from pipecat.frames.frames import TTSSpeakFrame

        cid = self.params.call_id

        @transport.event_handler("on_first_participant_joined")
        async def _on_join(_transport, participant):  # noqa: ANN001
            log.info(
                "participant joined; speaking greeting",
                extra={"call_id": cid, "participant": participant.get("id")},
            )
            self._mark_connected()
            await self._start_recording()
            if self._realtime_active and context_aggregator is not None:
                # Speech-to-speech: the greeting is in the session instructions;
                # kick the first response off with the current context.
                await task.queue_frames(
                    [context_aggregator.user().get_context_frame()]
                )
            elif config.first_message:
                await self._speak_cached_or_tts(config.first_message, config)

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

    async def _cached_frames(self, text: str, config):
        """Cached "recorded" audio frames for a fixed phrase, or None (live TTS).

        Routes to the cache matching this call's TTS vendor so a cached phrase is
        played back in the SAME voice as the rest of the call:
          - "deepgram" (Pixi / Aura-2): rendered ONCE via Deepgram Speak at the
            live pipeline's 24 kHz output rate, then served free from disk.
          - "elevenlabs" (Ava): the original ElevenLabs cache, unchanged.
        Any other provider (e.g. Piper) has no cache and falls back to live TTS.
        """
        provider = (getattr(config, "voice_provider", "") or "").lower()
        try:
            import tts_cache

            if provider == "deepgram":
                # Pixi: cache in the SAME Aura-2 voice, at the SAME sample rate
                # the live DeepgramTTSService emits (PipelineParams default =
                # 24 kHz on the web/Daily path). The output transport resamples
                # to the call rate, so phone (8 kHz) stays correct too.
                return await tts_cache.cached_audio_frames(
                    text=text,
                    voice_id=(config.voice_id or "aura-2-thalia-en").strip(),
                    api_key=self.settings.deepgram_api_key,
                    provider="deepgram",
                    sample_rate=tts_cache.DEEPGRAM_SAMPLE_RATE,
                )
            if provider == "elevenlabs":
                return await tts_cache.cached_audio_frames(
                    text=text,
                    voice_id=resolve_voice_id(config, self.settings),
                    api_key=self.settings.elevenlabs_api_key,
                    model=getattr(self.settings, "elevenlabs_model", "") or "eleven_flash_v2_5",
                    provider="elevenlabs",
                )
            # No phrase cache for other providers (e.g. Piper) → live TTS.
            return None
        except Exception as exc:  # noqa: BLE001
            log.warning(
                "tts cache unavailable; falling back to live TTS",
                extra={"call_id": self.params.call_id, "error": str(exc)[:120]},
            )
            return None

    async def _push_cached_or_speak(self, processor, text: str, config) -> None:
        """Push a fixed phrase to a specific processor — cached "recording"
        first (zero TTS cost), live TTS as the fallback. Used for phrases spoken
        from inside pipeline callbacks (idle check-ins, LLM-failure fallback)
        that must push to their own processor rather than the task queue.

        Deepgram (Pixi) prefers the cache; every other provider keeps the exact
        prior behaviour (a plain TTSSpeakFrame) so Ava is untouched."""
        from pipecat.frames.frames import TTSSpeakFrame

        provider = (getattr(config, "voice_provider", "") or "").lower()
        if provider == "deepgram" and text:
            try:
                frames = await self._cached_frames(text, config)
            except Exception:  # noqa: BLE001
                frames = None
            if frames:
                for f in frames:
                    await processor.push_frame(f)
                return
        await processor.push_frame(TTSSpeakFrame(text))

    async def _speak_cached_or_tts(self, text: str, config) -> None:
        """Speak a fixed phrase — from the recording cache first (zero TTS
        cost), live TTS as the fallback."""
        if not text or not self._task:
            return
        frames = await self._cached_frames(text, config)
        if frames:
            await self._task.queue_frames(frames)
            return
        from pipecat.frames.frames import TTSSpeakFrame

        await self._task.queue_frames([TTSSpeakFrame(text)])

    async def _music(self, enable: bool) -> None:
        """Toggle the synthesized background pad (best-effort, never fatal)."""
        if not self._task:
            return
        try:
            from pipecat.frames.frames import MixerEnableFrame

            await self._task.queue_frames([MixerEnableFrame(enable)])
        except Exception:  # noqa: BLE001
            pass

    def _make_mixer(self):
        """Output mixer for the subtle hold/lookup pad (VOICE_HOLD_MUSIC=0 disables)."""
        if (os.getenv("VOICE_HOLD_MUSIC", "1") or "1") == "0":
            return None
        try:
            from music_mixer import HoldMusicMixer

            return HoldMusicMixer()
        except Exception:  # noqa: BLE001
            return None

    async def _transfer_wait(self, transfer_id: str, config) -> None:
        """
        Hold-and-ring: the dashboard is ringing the store team. Keep the caller
        reassured (recorded lines + soft pad), poll the control plane, and
        either bow out when a human answers (they join this same call) or
        apologize and resume when nobody picks up in time.
        """
        cid = self.params.call_id
        hold_line = (
            "Of course - please hold on for a moment while I connect you to one of our team members."
        )
        busy_line = (
            "All of our customer service executives are busy right now. Thank you for your patience."
        )
        connected_line = "You're connected now - go ahead."
        missed_line = (
            "I'm so sorry - everyone is still busy at the moment. I can take a message and have "
            "someone call you back, or keep helping you myself."
        )
        timeout = 60.0
        try:
            timeout = float(os.getenv("VOICE_TRANSFER_TIMEOUT_SECS", "60") or 60)
        except ValueError:
            pass

        # Guardrail while holding: short, calm, no new actions until resolved.
        try:
            if self._context is not None:
                self._context.add_message(
                    {
                        "role": "system",
                        "content": (
                            "A transfer to a human team member is IN PROGRESS. Until it completes: "
                            "keep every reply to one short, calm sentence; do not call any tools "
                            "except endCall; do not start new topics or actions; reassure the "
                            "caller they are being connected."
                        ),
                    }
                )
        except Exception:  # noqa: BLE001
            pass

        try:
            await self._speak_cached_or_tts(hold_line, config)
            await self._music(True)
            waited = 0.0
            last_busy = 0.0
            while waited < timeout:
                await asyncio.sleep(3.0)
                waited += 3.0
                status = await self.control.transfer_status(transfer_id)
                if status == "answered":
                    await self._music(False)
                    await self._speak_cached_or_tts(connected_line, config)
                    self._disposition = "transfer_to_human"
                    self._ended_reason = self._ended_reason or "handed_to_human"
                    log.info(
                        "transfer answered; bot bowing out",
                        extra={"call_id": cid, "transfer_id": transfer_id},
                    )
                    await asyncio.sleep(2.0)
                    asyncio.create_task(self._end_pipeline(after_speech=True))
                    return
                if status in ("declined", "missed", "canceled"):
                    break
                if waited - last_busy >= 15.0:
                    last_busy = waited
                    await self._speak_cached_or_tts(busy_line, config)
            await self.control.transfer_update(transfer_id, "missed")
            await self._music(False)
            try:
                if self._context is not None:
                    self._context.add_message(
                        {
                            "role": "system",
                            "content": (
                                "The human transfer did NOT connect (nobody answered). Apologize "
                                "once, offer to take a message or a callback number, and continue "
                                "helping normally."
                            ),
                        }
                    )
            except Exception:  # noqa: BLE001
                pass
            await self._speak_cached_or_tts(missed_line, config)
        except Exception as exc:  # noqa: BLE001
            log.error(
                "transfer wait failed",
                extra={"call_id": cid, "error": str(exc)},
                exc_info=True,
            )
            await self._music(False)
        finally:
            self._transfer_holding = False

    def _schedule_tool_filler(self, llm_processor, tool_name: str, config=None):
        """
        Arm a spoken acknowledgment for a slow lookup — "one sec, let me pull
        that up" in the agent's own voice — but only if the tool hasn't already
        answered within FILLER_DELAY_SECONDS (the caller of this method cancels
        the returned task when the result lands first). Fast lookups stay
        seamless; slow ones never leave dead air. Rate-limited so chained tool
        calls in one turn don't stack fillers.
        """
        if not self.settings.fillers_enabled or tool_name in SILENT_TOOLS:
            return None
        if self._realtime_active:
            # Speech-to-speech has no TTS stage to speak through; the realtime
            # model handles its own conversational pacing.
            return None

        async def _speak_later() -> None:
            try:
                await asyncio.sleep(self.settings.filler_delay_secs)
                now = time.monotonic()
                if now - self._last_filler_at < FILLER_MIN_GAP_SECONDS:
                    return
                choices = TOOL_FILLERS.get(tool_name, DEFAULT_FILLERS)
                phrase = random.choice(choices)
                if phrase == self._last_filler_text and len(choices) > 1:
                    phrase = random.choice([c for c in choices if c != phrase])
                self._last_filler_at = now
                self._last_filler_text = phrase
                # Soft pad under the lookup — the "searching" feel.
                await self._music(True)
                frames = await self._cached_frames(phrase, config) if config else None
                if frames:
                    for f in frames:
                        await llm_processor.push_frame(f)
                else:
                    from pipecat.frames.frames import TTSSpeakFrame

                    await llm_processor.push_frame(TTSSpeakFrame(phrase))
            except asyncio.CancelledError:
                pass  # tool answered fast — no filler needed
            except Exception as exc:  # noqa: BLE001
                log.warning(
                    "tool filler failed",
                    extra={"call_id": self.params.call_id, "error": str(exc)[:120]},
                )

        return asyncio.create_task(_speak_later())

    async def _emit_card(self, llm_proc, payload: Dict[str, Any]) -> None:
        """
        Voice -> card side-channel. Push a Daily app-message to the browser so a
        spoken tool call spawns the SAME OS card a typed one does. Uses the exact
        mechanism _schedule_tool_filler uses (a frame pushed downstream from the
        LLM processor to transport.output().send_message()). Daily-only, and
        wrapped so a serialization/transport error can NEVER break the voice call.
        """
        if getattr(self, "_transport_kind", "") != "daily":
            return
        try:
            from pipecat.transports.services.daily import (
                DailyTransportMessageUrgentFrame,
            )

            await llm_proc.push_frame(
                DailyTransportMessageUrgentFrame(
                    message={"t": "jarvis_tool", **payload}
                )
            )
        except Exception as exc:  # noqa: BLE001 -- never fail the call
            log.warning("card emit failed", extra={"error": str(exc)[:120]})

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

            # Arm a spoken acknowledgment; it only fires if the tool is slow.
            llm_proc = getattr(params, "llm", None) or llm
            filler_task = self._schedule_tool_filler(llm_proc, name or "", config)

            # Voice -> card bridge (additive): tell the browser a tool STARTED so
            # it spawns the card immediately. `corr` correlates this with the
            # result emit below (pipecat may not expose a stable call id).
            corr = getattr(params, "tool_call_id", None) or uuid.uuid4().hex
            await self._emit_card(
                llm_proc,
                {
                    "phase": "call",
                    "id": corr,
                    "name": name,
                    "args": _sanitize_card_args(args),
                },
            )

            out = await self.control.tool_execute(
                call_id=cid,
                tenant_id=tenant_id,
                tool_name=name or "",
                arguments=args,
            )
            if filler_task is not None and not filler_task.done():
                filler_task.cancel()
            # Lookup finished — fade the pad (unless the caller is on hold).
            if not self._transfer_holding:
                await self._music(False)

            # Voice -> card bridge (additive): tell the browser the tool FINISHED.
            # Reads carry the (capped) payload the card body renders; writes are
            # propose-only, so the card stays pending until its confirm token
            # arrives via the /voice/pending poll (correlated by pending_id).
            _res = out.get("result") if isinstance(out, dict) else None
            _is_write = isinstance(_res, dict) and "proposed" in _res
            await self._emit_card(
                llm_proc,
                {
                    "phase": "result",
                    "id": corr,
                    "name": name,
                    "ok": not (isinstance(out, dict) and bool(out.get("error"))),
                    "kind": "write" if _is_write else "read",
                    "data": None if _is_write else _cap_card_data(_res),
                    "proposed": bool(_res.get("proposed")) if _is_write else False,
                    "tier": _res.get("tier") if isinstance(_res, dict) else None,
                    "require_text": (
                        _res.get("requires_typed_word")
                        if isinstance(_res, dict)
                        else None
                    ),
                    "summary": _res.get("summary") if isinstance(_res, dict) else None,
                    "pending_id": (
                        _res.get("pending_id") if isinstance(_res, dict) else None
                    ),
                    "error": out.get("error") if isinstance(out, dict) else None,
                },
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
            elif action == "transfer_hold":
                # Ring-the-team: hold the caller (recorded lines + soft pad)
                # while the dashboard rings; a human answering joins this same
                # call. Never end the pipeline here.
                tid = str(out.get("transfer_id") or "") if isinstance(out, dict) else ""
                if tid and not self._transfer_holding:
                    self._transfer_holding = True
                    if not self._disposition:
                        self._disposition = "transfer_to_human"
                    asyncio.create_task(self._transfer_wait(tid, config))
                elif not tid:
                    self._ended_reason = self._ended_reason or "transfer_to_human"
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

    def _mark_connected(self) -> None:
        """A human joined — start the clock billing and caps run on."""
        if self._connected_at is None:
            self._connected_at = time.monotonic()

    async def _watchdog(self) -> None:
        try:
            # Pre-join window: a pre-warmed bot nobody joins must not linger
            # (it would otherwise sit in the room for max_call_seconds).
            waited = 0.0
            join_timeout = float(self.settings.prewarm_join_timeout_secs)
            while self._connected_at is None:
                if waited >= join_timeout:
                    log.info(
                        "nobody joined within the pre-warm window; ending",
                        extra={"call_id": self.params.call_id},
                    )
                    self._ended_reason = self._ended_reason or "never_joined"
                    await self._end_pipeline()
                    return
                await asyncio.sleep(2)
                waited += 2
            # Live window: the hard cap runs from the moment the caller
            # connected, so pre-warm time never eats into the conversation.
            while True:
                elapsed = time.monotonic() - self._connected_at
                remaining = float(self.settings.max_call_seconds) - elapsed
                if remaining <= 0:
                    break
                await asyncio.sleep(min(remaining, 30.0))
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

        # Billable duration = talk time, from the moment a human connected.
        # A pre-warmed bot that nobody joined reports 0 and is never charged.
        if self._connected_at is not None:
            duration = int(max(0.0, time.monotonic() - self._connected_at))
        else:
            duration = 0
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

        # Finalise + flush the Langfuse trace (guarded no-op when disabled).
        # Attach the non-LLM voice cost components (STT / TTS / transport) so the
        # super-admin AI Usage & Cost page reflects the WHOLE per-call cost, not
        # just the brain. All pricing lives in langfuse_tracing.finalize_costs;
        # this only assembles the inputs. Fully guarded — a metering failure must
        # never affect the call (Pixi or Ava) or the call-ended report above.
        try:
            if self._call_trace is not None:
                cfg = self._active_config
                cost_ctx = {
                    "duration_seconds": duration,
                    "voice_provider": (
                        getattr(cfg, "voice_provider", "") or ""
                    ).lower(),
                    "voice_transport": self._transport_kind,
                    "realtime": bool(self._realtime_active),
                    "rates": {
                        "stt_per_min": self.settings.voice_stt_usd_per_min,
                        "aura_per_1k": self.settings.voice_tts_aura_usd_per_1k_chars,
                        "eleven_per_1k": (
                            self.settings.voice_tts_elevenlabs_usd_per_1k_chars
                        ),
                        "daily_per_participant_min": (
                            self.settings.voice_daily_usd_per_participant_min
                        ),
                    },
                }
                self._call_trace.end(self._ended_reason, cost_ctx=cost_ctx)
        except Exception:  # noqa: BLE001 - never let tracing affect call teardown
            pass
