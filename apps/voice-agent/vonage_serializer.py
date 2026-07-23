"""
Vonage (Nexmo) Voice API websocket frame serializer.

Vonage's websocket protocol is far simpler than Twilio's: after an initial
JSON text event (``websocket:connected``), the socket carries RAW linear PCM
(L16, mono, 16-bit little-endian) BINARY frames in both directions at the rate
negotiated in the NCCO (we always request ``audio/l16;rate=16000``). There is
no framing envelope, no base64, and no clear/mark events.

Pipecat 0.0.80 has no built-in Vonage serializer, so this one exists. It
resamples between the pipeline rate and Vonage's 16 kHz only when they differ.
"""

import json
from typing import Optional, Union

from pipecat.audio.utils import create_stream_resampler
from pipecat.frames.frames import (
    AudioRawFrame,
    Frame,
    InputAudioRawFrame,
    StartFrame,
)
from pipecat.serializers.base_serializer import (
    FrameSerializer,
    FrameSerializerType,
)

VONAGE_SAMPLE_RATE = 16000


class VonageFrameSerializer(FrameSerializer):
    """Raw L16 passthrough serializer for Vonage Voice websockets."""

    def __init__(self, call_uuid: str, sample_rate: int = VONAGE_SAMPLE_RATE):
        self._call_uuid = call_uuid
        self._vonage_rate = sample_rate
        self._pipeline_in_rate = 0
        self._input_resampler = create_stream_resampler()
        self._output_resampler = create_stream_resampler()

    @property
    def type(self) -> FrameSerializerType:
        return FrameSerializerType.BINARY

    async def setup(self, frame: StartFrame):
        self._pipeline_in_rate = frame.audio_in_sample_rate

    async def serialize(self, frame: Frame) -> Optional[Union[str, bytes]]:
        # Outbound: agent speech to the caller — raw L16 binary.
        if isinstance(frame, AudioRawFrame):
            data = frame.audio
            if frame.sample_rate != self._vonage_rate:
                data = await self._output_resampler.resample(
                    data, frame.sample_rate, self._vonage_rate
                )
            return bytes(data) if data else None
        return None

    async def deserialize(self, data: Union[str, bytes]) -> Optional[Frame]:
        # Text frames are Vonage control events (websocket:connected) — no
        # audio, nothing for the pipeline.
        if isinstance(data, str):
            try:
                json.loads(data)
            except Exception:  # noqa: BLE001
                pass
            return None

        audio = data
        in_rate = self._pipeline_in_rate or self._vonage_rate
        if in_rate != self._vonage_rate:
            audio = await self._input_resampler.resample(
                bytes(audio), self._vonage_rate, in_rate
            )
        if not audio:
            return None
        return InputAudioRawFrame(
            audio=bytes(audio), num_channels=1, sample_rate=in_rate
        )
