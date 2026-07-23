"""
Subtle synthesized hold/lookup music — no assets, no extra deps.

A pipecat output-transport mixer that overlays a soft ambient chord pad while
the agent is looking something up or the caller is holding for a human. The
pad is SYNTHESIZED in pure Python at the transport's own sample rate when the
transport starts (two alternating minor-seventh chords with a slow breathing
LFO), so there is no audio file to ship, no resampling, and no soundfile /
numpy dependency.

Starts DISABLED — the bot enables/disables it at runtime with
MixerEnableFrame (searching, holding), so normal conversation stays clean.
"""

import math
import struct
from typing import List

from pipecat.audio.mixers.base_audio_mixer import BaseAudioMixer
from pipecat.frames.frames import MixerControlFrame, MixerEnableFrame

# Peak amplitude of the pad (int16). ~6% of full scale — audible but clearly
# beneath speech.
_DEFAULT_PEAK = 2000.0
_LOOP_SECONDS = 16.0


def _synth_loop(sample_rate: int, peak: float) -> List[int]:
    """Render one seamless pad loop as a list of int16 samples."""
    n = int(sample_rate * _LOOP_SECONDS)
    half = n // 2
    # A minor 7 -> F major 7: gentle, unresolved, "please hold" energy.
    chords = [
        (220.0, 261.63, 329.63, 392.0),  # A3 C4 E4 G4
        (174.61, 220.0, 261.63, 329.63),  # F3 A3 C4 E4
    ]
    out: List[int] = []
    for i in range(n):
        t = i / sample_rate
        chord = chords[0] if i < half else chords[1]
        # Crossfade 1s around the chord change and the loop seam.
        xf = 1.0
        for edge in (0, half, n):
            d = abs(i - edge)
            if d < sample_rate:
                xf = min(xf, d / sample_rate * 0.5 + 0.5)
        # Slow breathing LFO so the pad never feels static.
        breath = 0.75 + 0.25 * math.sin(2.0 * math.pi * t / 8.0)
        s = 0.0
        for j, f in enumerate(chord):
            s += math.sin(2.0 * math.pi * f * t) / (j + 1.5)
        out.append(int(peak * breath * xf * s / 2.5))
    return out


class HoldMusicMixer(BaseAudioMixer):
    """Loops the synthesized pad under outgoing audio while enabled."""

    def __init__(self, *, volume: float = 1.0):
        self._enabled = False
        self._pos = 0
        self._loop: List[int] = []
        self._volume = max(0.0, min(volume, 2.0))

    async def start(self, sample_rate: int):
        self._loop = _synth_loop(sample_rate, _DEFAULT_PEAK * self._volume)
        self._pos = 0

    async def stop(self):
        self._loop = []

    async def process_frame(self, frame: MixerControlFrame):
        if isinstance(frame, MixerEnableFrame):
            self._enabled = frame.enable
            if not frame.enable:
                self._pos = 0  # restart cleanly next time

    async def mix(self, audio: bytes) -> bytes:
        if not self._enabled or not self._loop:
            return audio
        n = len(audio) // 2
        samples = struct.unpack(f"<{n}h", audio[: n * 2])
        loop = self._loop
        ln = len(loop)
        pos = self._pos
        mixed = []
        for s in samples:
            v = s + loop[pos]
            if v > 32767:
                v = 32767
            elif v < -32768:
                v = -32768
            mixed.append(v)
            pos += 1
            if pos >= ln:
                pos = 0
        self._pos = pos
        return struct.pack(f"<{len(mixed)}h", *mixed)
