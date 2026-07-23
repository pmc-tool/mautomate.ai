"""
Environment-driven configuration for the mAutomate voice-agent runtime.

Every value comes from the process environment (see `.env.template`). The lead
sets these on the pm2 process; this module is the single place that reads them
so there are no scattered `os.environ` lookups across the codebase.

`Settings.load()` validates the SERVER-level keys that must exist for the
service to boot (API key, backend URL, telephony secret, provider keys). It does
NOT hard-fail on per-call optionals — a call that is missing something logs and
ends cleanly rather than crashing the server.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import List, Optional


class ConfigError(RuntimeError):
    """Raised at boot when a required server-level env var is missing."""


def _get(name: str, default: str | None = None) -> str | None:
    val = os.environ.get(name)
    if val is None or val == "":
        return default
    return val


def _get_int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def _get_float(name: str, default: float) -> float:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        return float(raw)
    except ValueError:
        return default


def _get_opt_float(name: str) -> Optional[float]:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return None
    try:
        return float(raw)
    except ValueError:
        return None


def _get_bool(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


@dataclass(frozen=True)
class Settings:
    # --- Service / auth ---
    api_key: str
    port: int

    # --- Control plane (Medusa backend) ---
    backend_url: str
    telephony_secret: str

    # --- Media providers ---
    daily_api_key: str
    daily_api_url: str
    deepgram_api_key: str
    openai_api_key: str
    openai_model: str
    elevenlabs_api_key: str
    elevenlabs_voice_id: str
    elevenlabs_model: str

    # --- LLM failover ---
    # The brain is the ONE service with no redundancy: STT (Deepgram) and TTS
    # (ElevenLabs) are separate vendors, so when the OpenAI account ran dry the
    # agent could still hear the caller and still speak — it simply had nothing
    # to say, and sat there in silence for two entire calls.
    #
    # Novita is OpenAI-wire-compatible, so a second brain costs one base_url.
    novita_api_key: str
    novita_model: str
    novita_base_url: str
    # "auto" (default) = use OpenAI, fall back to Novita when OpenAI is unusable.
    # "openai" / "novita" pin one provider explicitly.
    llm_provider: str
    llm_temperature: float

    # --- Groq (fast, cheap tool-caller; used for Pixi voice) ---
    # Groq is OpenAI-wire-compatible (base_url below). Kimi K2 is not hosted
    # on this account, so the default is the strongest available Groq
    # tool-caller. Override with GROQ_MODEL. Novita stays the fallback brain.
    groq_api_key: str
    groq_model: str
    groq_base_url: str
    groq_max_tokens: int
    # Which brain the Pixi voice playbook uses: "groq" (default) or
    # "novita" to fall back to the previous behaviour without a code change.
    jarvis_llm_provider: str

    # --- Naturalness / conversation dynamics ---
    # TTS voice character (ElevenLabs). Canonical conversational tuning:
    # stability 0.5, similarity 0.75. style > 0 adds expressiveness at a small
    # latency/stability cost; speed None = provider default.
    tts_stability: float
    tts_similarity: float
    tts_style: float
    tts_speed: Optional[float]

    # Turn-taking. vad_stop_secs is the silence the bot waits before treating
    # the caller's turn as over — THE response-gap knob. Pipecat's default 0.8s
    # reads as laggy; 0.5s is a good human-ish floor without smart turn.
    vad_confidence: float
    vad_start_secs: float
    vad_stop_secs: float
    vad_min_volume: float

    # Smart Turn v2 (semantic end-of-turn model — needs torch installed).
    smart_turn: bool
    smart_turn_stop_secs: float
    smart_turn_model_path: str

    # Idle-caller handling: check in after N silent seconds, twice, then a
    # polite goodbye. 0/false disables.
    idle_enabled: bool
    idle_timeout_secs: float

    # Spoken acknowledgments while slow tools run ("one sec, let me check").
    fillers_enabled: bool
    # A filler only speaks if the tool hasn't answered within this window.
    filler_delay_secs: float

    # Pre-warm: how long a dispatched bot waits alone in the room for a human
    # to join before giving up (ends unbilled with reason "never_joined").
    prewarm_join_timeout_secs: int

    # --- Speech-to-speech pilot (OpenAI Realtime) ---
    # realtime_enabled turns it on for ALL web calls; realtime_agents pilots it
    # for specific playbook ids (comma-separated). Default: off.
    realtime_enabled: bool
    realtime_agents: str
    realtime_model: str
    realtime_voice: str

    # Require N transcribed words before a caller sound interrupts the bot
    # (0 = raw VAD barge-in). Useful on noisy phone lines.
    interrupt_min_words: int

    # --- Safety / behaviour ---
    max_call_seconds: int
    bot_name: str
    log_level: str
    generate_summary: bool

    # --- Per-call voice cost rates (super-admin AI Usage & Cost visibility) ---
    # These price the non-LLM voice cost components so the traced per-call total
    # reflects the WHOLE call, not just the brain. Defaults are 2026 list-price
    # APPROXIMATIONS and should be verified against each vendor's current
    # pricing; override per environment via the env vars below.
    #
    #   voice_stt_usd_per_min           Deepgram Nova streaming STT, per audio
    #                                   minute (~$0.0043/min list, 2026).
    #   voice_tts_aura_usd_per_1k_chars Deepgram Aura-2 TTS, per 1k characters
    #                                   (~$0.030/1k, i.e. $30/1M chars).
    #   voice_tts_elevenlabs_usd_per_1k_chars
    #                                   ElevenLabs TTS (Ava path), per 1k chars
    #                                   (~$0.10/1k on a typical paid tier;
    #                                   varies a lot by plan — verify).
    #   voice_daily_usd_per_participant_min
    #                                   Daily transport, per participant-minute
    #                                   (~$0.004); the web path assumes 2
    #                                   participants (bot + user).
    #   Piper (self-hosted) is hardcoded $0 in the pricing logic — no env.
    voice_stt_usd_per_min: float
    voice_tts_aura_usd_per_1k_chars: float
    voice_tts_elevenlabs_usd_per_1k_chars: float
    voice_daily_usd_per_participant_min: float

    # --- LLM (brain) token pricing, with prompt-cache discount ---------------
    # Used to price the per-turn LLM cost for the JARVIS voice path (Novita /
    # Kimi) EXPLICITLY, so the super-admin AI Usage & Cost page reflects
    # Novita's automatic prompt-cache discount instead of billing every input
    # token at the full rate. Defaults are the 2026 Novita "moonshotai/kimi-k2"
    # list prices (per 1M tokens); override per environment.
    #
    #   voice_llm_input_usd_per_1m    Uncached input tokens (~$0.57/1M).
    #   voice_llm_output_usd_per_1m   Output tokens (~$2.30/1M).
    #   voice_llm_cached_usd_per_1m   Cache-HIT input tokens (~$0.16/1M) — the
    #                                 stable system+tools prefix Novita caches.
    #   voice_llm_cached_prefix_tokens
    #                                 Approximation size of that stable prefix
    #                                 (tokens). When pipecat does not surface a
    #                                 real cached-token count (the OpenAI-wire
    #                                 path does not), turns after the first are
    #                                 assumed to hit the cache for this many
    #                                 tokens. Verified ~6912 on a real call.
    voice_llm_input_usd_per_1m: float
    voice_llm_output_usd_per_1m: float
    voice_llm_cached_usd_per_1m: float
    voice_llm_cached_prefix_tokens: int

    @staticmethod
    def load() -> "Settings":
        missing: List[str] = []

        def required(name: str) -> str:
            val = _get(name)
            if not val:
                missing.append(name)
                return ""
            return val

        api_key = required("VOICE_AGENT_API_KEY")
        backend_url = required("MEDUSA_BACKEND_URL")
        telephony_secret = required("TELEPHONY_WEBHOOK_SECRET")
        daily_api_key = required("DAILY_API_KEY")
        deepgram_api_key = required("DEEPGRAM_API_KEY")
        # No longer `required`: a store with a Novita key alone is a valid setup,
        # and refusing to boot without OpenAI would be the same single point of
        # failure one level up.
        openai_api_key = _get("OPENAI_API_KEY", "") or ""
        novita_api_key = _get("NOVITA_API_KEY", "") or ""
        if not openai_api_key and not novita_api_key:
            missing.append("OPENAI_API_KEY or NOVITA_API_KEY")
        elevenlabs_api_key = required("ELEVENLABS_API_KEY")

        settings = Settings(
            api_key=api_key,
            port=_get_int("VOICE_AGENT_PORT", 8790),
            backend_url=(backend_url or "").rstrip("/"),
            telephony_secret=telephony_secret,
            daily_api_key=daily_api_key,
            daily_api_url=(_get("DAILY_API_URL", "https://api.daily.co/v1") or "").rstrip("/"),
            deepgram_api_key=deepgram_api_key,
            openai_api_key=openai_api_key,
            openai_model=_get("OPENAI_MODEL", "gpt-4o") or "gpt-4o",
            novita_api_key=novita_api_key,
            # Proven tool-caller on Novita (the chat runtime uses the same model,
            # and a voice agent without working tools cannot answer a single
            # question about an order).
            novita_model=_get("NOVITA_MODEL", "moonshotai/kimi-k2.7-code")
            or "moonshotai/kimi-k2.7-code",
            novita_base_url=(
                _get("NOVITA_BASE_URL", "https://api.novita.ai/v3/openai")
                or "https://api.novita.ai/v3/openai"
            ).rstrip("/"),
            llm_provider=(_get("VOICE_LLM_PROVIDER", "auto") or "auto").lower(),
            llm_temperature=_get_float("VOICE_LLM_TEMPERATURE", 0.7),
            groq_api_key=_get("GROQ_API_KEY", "") or "",
            # Kimi K2 is NOT on this Groq account; gpt-oss-120b is the
            # strongest hosted tool-caller. Override via GROQ_MODEL.
            groq_model=_get("GROQ_MODEL", "openai/gpt-oss-120b")
            or "openai/gpt-oss-120b",
            groq_base_url=(
                _get("GROQ_BASE_URL", "https://api.groq.com/openai/v1")
                or "https://api.groq.com/openai/v1"
            ).rstrip("/"),
            # Voice replies are short; cap output so it never over-generates.
            groq_max_tokens=_get_int("VOICE_GROQ_MAX_TOKENS", 180),
            jarvis_llm_provider=(
                _get("VOICE_JARVIS_LLM_PROVIDER", "groq") or "groq"
            ).lower(),
            elevenlabs_api_key=elevenlabs_api_key,
            # Ultimate fallback voice when a playbook ships a non-ElevenLabs
            # placeholder voice_id (e.g. "bn-female-warm"). See bot.resolve_voice_id.
            elevenlabs_voice_id=_get("ELEVENLABS_VOICE_ID", "") or "",
            # flash v2.5 = ElevenLabs' low-latency conversational model (~75ms).
            # Set ELEVENLABS_MODEL=eleven_turbo_v2_5 to trade latency for polish.
            elevenlabs_model=_get("ELEVENLABS_MODEL", "eleven_flash_v2_5")
            or "eleven_flash_v2_5",
            tts_stability=_get_float("VOICE_TTS_STABILITY", 0.5),
            tts_similarity=_get_float("VOICE_TTS_SIMILARITY", 0.75),
            tts_style=_get_float("VOICE_TTS_STYLE", 0.0),
            tts_speed=_get_opt_float("VOICE_TTS_SPEED"),
            vad_confidence=_get_float("VOICE_VAD_CONFIDENCE", 0.6),
            vad_start_secs=_get_float("VOICE_VAD_START_SECS", 0.15),
            vad_stop_secs=_get_float("VOICE_VAD_STOP_SECS", 0.5),
            vad_min_volume=_get_float("VOICE_VAD_MIN_VOLUME", 0.4),
            smart_turn=_get_bool("VOICE_SMART_TURN", False),
            smart_turn_stop_secs=_get_float("VOICE_SMART_TURN_STOP_SECS", 2.0),
            smart_turn_model_path=_get("VOICE_SMART_TURN_MODEL_PATH", "") or "",
            idle_enabled=_get_bool("VOICE_IDLE_ENABLED", True),
            idle_timeout_secs=_get_float("VOICE_IDLE_TIMEOUT_SECS", 10.0),
            fillers_enabled=_get_bool("VOICE_TOOL_FILLERS", True),
            filler_delay_secs=_get_float("VOICE_FILLER_DELAY_SECS", 0.4),
            prewarm_join_timeout_secs=_get_int(
                "VOICE_PREWARM_JOIN_TIMEOUT_SECS", 300
            ),
            realtime_enabled=_get_bool("VOICE_REALTIME", False),
            realtime_agents=_get("VOICE_REALTIME_AGENTS", "") or "",
            realtime_model=_get("VOICE_REALTIME_MODEL", "gpt-realtime")
            or "gpt-realtime",
            realtime_voice=_get("VOICE_REALTIME_VOICE", "marin") or "marin",
            interrupt_min_words=_get_int("VOICE_INTERRUPT_MIN_WORDS", 0),
            max_call_seconds=_get_int("VOICE_AGENT_MAX_CALL_SECONDS", 600),
            bot_name=_get("VOICE_AGENT_BOT_NAME", "AI Agent") or "AI Agent",
            log_level=(_get("VOICE_AGENT_LOG_LEVEL", "INFO") or "INFO").upper(),
            generate_summary=(_get("VOICE_AGENT_GENERATE_SUMMARY", "true") or "true").lower()
            == "true",
            voice_stt_usd_per_min=_get_float("VOICE_STT_USD_PER_MIN", 0.0043),
            voice_tts_aura_usd_per_1k_chars=_get_float(
                "VOICE_TTS_AURA_USD_PER_1K_CHARS", 0.030
            ),
            voice_tts_elevenlabs_usd_per_1k_chars=_get_float(
                "VOICE_TTS_ELEVENLABS_USD_PER_1K_CHARS", 0.10
            ),
            voice_daily_usd_per_participant_min=_get_float(
                "VOICE_DAILY_USD_PER_PARTICIPANT_MIN", 0.004
            ),
            voice_llm_input_usd_per_1m=_get_float(
                "VOICE_LLM_INPUT_USD_PER_1M", 0.57
            ),
            voice_llm_output_usd_per_1m=_get_float(
                "VOICE_LLM_OUTPUT_USD_PER_1M", 2.30
            ),
            voice_llm_cached_usd_per_1m=_get_float(
                "VOICE_LLM_CACHED_USD_PER_1M", 0.16
            ),
            voice_llm_cached_prefix_tokens=_get_int(
                "VOICE_LLM_CACHED_PREFIX_TOKENS", 6912
            ),
        )

        if missing:
            raise ConfigError(
                "Missing required environment variables: " + ", ".join(missing)
            )
        return settings
