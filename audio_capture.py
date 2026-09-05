"""Streams raw PCM16 mono audio frames from the default microphone."""

import queue
import sounddevice as sd


class AudioCapture:
    def __init__(self, sample_rate: int, frame_ms: int, device=None):
        self.sample_rate = sample_rate
        self.frame_size = int(sample_rate * frame_ms / 1000)
        self.device = device
        self._q: "queue.Queue[bytes]" = queue.Queue()
        self._stream = None

    def _callback(self, indata, frames, time_info, status):
        
        self._q.put(bytes(indata))

    def start(self):
        self._stream = sd.RawInputStream(
            samplerate=self.sample_rate,
            blocksize=self.frame_size,
            device=self.device,
            dtype="int16",
            channels=1,
            callback=self._callback,
        )
        self._stream.start()

    def stop(self):
        if self._stream is not None:
            self._stream.stop()
            self._stream.close()
            self._stream = None

    def frames(self):
        """Blocking generator yielding one fixed-size PCM16 frame at a time."""
        while True:
            yield self._q.get()

    @staticmethod
    def list_devices():
        return sd.query_devices()
