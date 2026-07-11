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
from typing import List


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
        openai_api_key = required("OPENAI_API_KEY")
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
            elevenlabs_api_key=elevenlabs_api_key,
            # Ultimate fallback voice when a playbook ships a non-ElevenLabs
            # placeholder voice_id (e.g. "bn-female-warm"). See bot.resolve_voice_id.
            elevenlabs_voice_id=_get("ELEVENLABS_VOICE_ID", "") or "",
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
