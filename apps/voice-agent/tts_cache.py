"""
On-disk TTS phrase cache — "say it from a recording".

Repeated phrases (the store greeting, tool fillers, hold / busy lines) are
identical across calls, so paying the TTS vendor to re-synthesize them every
call is pure waste. This module synthesizes a phrase ONCE (raw linear16 PCM),
stores it under a content hash, and thereafter serves the audio straight from
disk as output frames — zero TTS cost, zero TTS latency.

Two providers are supported, each keyed independently so they never collide:

  * "elevenlabs" — Ava's voice, via the ElevenLabs REST API at 16 kHz. This is
    the original path and its cache key is byte-for-byte unchanged, so Ava's
    existing cache stays warm across this change.

  * "deepgram"   — Pixi's voice (Deepgram Aura-2), via the Deepgram Speak REST
    API. Rendered at the SAME sample rate the live Aura-2 pipeline outputs
    (24 kHz on the web/Daily path) so cached playback is pitch-perfect — a
    mismatched rate causes chipmunk / slow-mo distortion.

Personalized greetings ("Hi Sarah! Thanks for calling …") cache per unique
text, so a repeat caller also converges to cached audio after their first call.

Fail-open: ANY problem (no key, API error, tiny/invalid audio) returns None and
the caller falls back to live TTS through the normal pipeline.
"""

import asyncio
import hashlib
import os
from typing import List, Optional

CACHE_DIR = os.getenv("VOICE_TTS_CACHE_DIR", "/home/ratul/voice-tts-cache")

# Per-provider default master sample rates. The cached PCM is tagged at this
# rate on its output frames and the output transport resamples to the live call
# rate (Daily / Twilio 8k) as needed.
#   ElevenLabs — 16 kHz (pcm_16000), the original cached rate.
#   Deepgram Aura-2 — 24 kHz, matching PipelineParams.audio_out_sample_rate
#     (24000) on the web/Daily Pixi pipeline. MUST match or playback distorts.
ELEVEN_SAMPLE_RATE = 16000
DEEPGRAM_SAMPLE_RATE = 24000
SAMPLE_RATE = ELEVEN_SAMPLE_RATE  # back-compat alias (ElevenLabs master rate)

_MIN_BYTES = 3200  # < 100 ms of audio = something went wrong; don't cache it

_locks: dict = {}


def _default_rate(provider: str) -> int:
    return DEEPGRAM_SAMPLE_RATE if provider == "deepgram" else ELEVEN_SAMPLE_RATE


def _key_path(
    text: str, voice_id: str, model: str, sample_rate: int, provider: str
) -> str:
    if provider == "deepgram":
        # Provider-prefixed so Aura keys never collide with ElevenLabs keys; the
        # Aura voice + sample_rate fully identify the rendered audio.
        raw = f"deepgram|{voice_id}|{sample_rate}|{text}"
    else:
        # UNCHANGED original ElevenLabs key so Ava's existing cache stays valid.
        raw = f"{voice_id}|{model}|{sample_rate}|{text}"
    key = hashlib.sha1(raw.encode("utf-8")).hexdigest()
    return os.path.join(CACHE_DIR, f"{key}.pcm")


async def _synthesize(text: str, voice_id: str, api_key: str, model: str) -> Optional[bytes]:
    """ElevenLabs REST → raw 16 kHz mono s16le PCM (or None on any failure)."""
    import httpx

    url = (
        f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
        f"?output_format=pcm_16000"
    )
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                url,
                headers={"xi-api-key": api_key},
                json={"text": text, "model_id": model},
            )
        if resp.status_code != 200:
            return None
        return resp.content
    except Exception:  # noqa: BLE001
        return None


async def _synthesize_deepgram(
    text: str, voice: str, api_key: str, sample_rate: int
) -> Optional[bytes]:
    """Deepgram Aura-2 Speak REST → raw linear16 mono PCM (or None on failure).

    Rendered at `sample_rate` (the same rate the live Aura-2 service outputs) so
    cached playback matches live playback exactly. `container=none` yields
    headerless raw PCM, ready to frame straight to the transport.
    """
    import httpx

    url = (
        f"https://api.deepgram.com/v1/speak"
        f"?model={voice}&encoding=linear16&container=none&sample_rate={sample_rate}"
    )
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                url,
                headers={
                    "Authorization": f"Token {api_key}",
                    "Content-Type": "application/json",
                },
                json={"text": text},
            )
        if resp.status_code != 200:
            return None
        return resp.content
    except Exception:  # noqa: BLE001
        return None


async def cached_pcm(
    text: str,
    voice_id: str,
    api_key: str,
    model: str,
    provider: str = "elevenlabs",
    sample_rate: Optional[int] = None,
) -> Optional[bytes]:
    """Raw mono s16le PCM for `text`, from cache or one-time synthesis.

    `provider` selects the synth backend ("deepgram" | "elevenlabs") and the
    default sample rate; `sample_rate` overrides it (must match the live
    pipeline's output rate for that provider).
    """
    if not text or not voice_id or not api_key:
        return None
    provider = (provider or "elevenlabs").lower()
    rate = sample_rate or _default_rate(provider)
    path = _key_path(text, voice_id, model, rate, provider)

    if os.path.exists(path):
        try:
            data = await asyncio.to_thread(lambda: open(path, "rb").read())
            if len(data) >= _MIN_BYTES:
                return data
        except Exception:  # noqa: BLE001
            pass

    # One synthesis per phrase even under concurrent calls.
    lock = _locks.setdefault(path, asyncio.Lock())
    async with lock:
        if os.path.exists(path):
            try:
                data = await asyncio.to_thread(lambda: open(path, "rb").read())
                if len(data) >= _MIN_BYTES:
                    return data
            except Exception:  # noqa: BLE001
                pass
        if provider == "deepgram":
            data = await _synthesize_deepgram(text, voice_id, api_key, rate)
        else:
            data = await _synthesize(text, voice_id, api_key, model)
        if not data or len(data) < _MIN_BYTES:
            return None
        try:
            os.makedirs(CACHE_DIR, exist_ok=True)
            tmp = f"{path}.tmp.{os.getpid()}"
            await asyncio.to_thread(lambda: open(tmp, "wb").write(data))
            os.replace(tmp, path)
        except Exception:  # noqa: BLE001
            pass  # caching failed but we still have the audio in hand
        return data


async def cached_audio_frames(
    text: str,
    voice_id: str,
    api_key: str,
    model: str = "eleven_flash_v2_5",
    provider: str = "elevenlabs",
    sample_rate: Optional[int] = None,
) -> Optional[List[object]]:
    """
    The phrase as a list of 20 ms OutputAudioRawFrames at the provider's master
    rate, or None when unavailable (caller falls back to live TTS). The output
    transport resamples per-call, so tagging at the render rate is correct.
    """
    provider = (provider or "elevenlabs").lower()
    rate = sample_rate or _default_rate(provider)
    data = await cached_pcm(text, voice_id, api_key, model, provider, rate)
    if not data:
        return None
    from pipecat.frames.frames import OutputAudioRawFrame

    chunk_bytes = int(rate * 0.02) * 2  # 20 ms mono s16le at this rate
    frames: List[object] = []
    for i in range(0, len(data), chunk_bytes):
        chunk = data[i : i + chunk_bytes]
        if len(chunk) < 4:
            break
        frames.append(
            OutputAudioRawFrame(audio=chunk, sample_rate=rate, num_channels=1)
        )
    return frames or None
