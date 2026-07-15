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

    # Require N transcribed words before a caller sound interrupts the bot
    # (0 = raw VAD barge-in). Useful on noisy phone lines.
    interrupt_min_words: int

    # --- Safety / behaviour ---
    max_call_seconds: int
    bot_name: str
    log_level: str
    generate_summary: bool

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
            interrupt_min_words=_get_int("VOICE_INTERRUPT_MIN_WORDS", 0),
            max_call_seconds=_get_int("VOICE_AGENT_MAX_CALL_SECONDS", 600),
            bot_name=_get("VOICE_AGENT_BOT_NAME", "AI Agent") or "AI Agent",
            log_level=(_get("VOICE_AGENT_LOG_LEVEL", "INFO") or "INFO").upper(),
            generate_summary=(_get("VOICE_AGENT_GENERATE_SUMMARY", "true") or "true").lower()
            == "true",
        )

        if missing:
            raise ConfigError(
                "Missing required environment variables: " + ", ".join(missing)
            )
        return settings
