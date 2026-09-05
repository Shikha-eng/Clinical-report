

import collections
import webrtcvad


class VADSegmenter:
    def __init__(
        self,
        sample_rate: int,
        frame_ms: int,
        aggressiveness: int,
        padding_ms: int,
        ratio_trigger: float,
    ):
        self.vad = webrtcvad.Vad(aggressiveness)
        self.sample_rate = sample_rate
        num_padding_frames = max(1, padding_ms // frame_ms)
        self.ring_buffer = collections.deque(maxlen=num_padding_frames)
        self.ratio_trigger = ratio_trigger
        self.triggered = False
        self.voiced_frames = []

    def process_frame(self, frame: bytes):
        """Feed one frame. Returns completed segment bytes, or None."""
        is_speech = self.vad.is_speech(frame, self.sample_rate)

        if not self.triggered:
            self.ring_buffer.append((frame, is_speech))
            num_voiced = sum(1 for _, speech in self.ring_buffer if speech)
            if num_voiced > self.ratio_trigger * self.ring_buffer.maxlen:
                self.triggered = True
                self.voiced_frames.extend(f for f, _ in self.ring_buffer)
                self.ring_buffer.clear()
            return None

        self.voiced_frames.append(frame)
        self.ring_buffer.append((frame, is_speech))
        num_unvoiced = sum(1 for _, speech in self.ring_buffer if not speech)
        if num_unvoiced > self.ratio_trigger * self.ring_buffer.maxlen:
            segment = b"".join(self.voiced_frames)
            self._reset()
            return segment
        return None

    def flush(self):
        """Call at session end to recover any in-progress segment."""
        if self.voiced_frames:
            segment = b"".join(self.voiced_frames)
            self._reset()
            return segment
        return None

    def _reset(self):
        self.triggered = False
        self.ring_buffer.clear()
        self.voiced_frames = []
