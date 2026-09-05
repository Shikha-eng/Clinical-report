"""Ties audio capture -> VAD -> ASR together with a live terminal display."""

import time

from rich.console import Console
from rich.live import Live
from rich.text import Text

import config
from audio_capture import AudioCapture
from vad import VADSegmenter
from asr import ASREngine


class LiveTranscriber:
    def __init__(self):
        self.capture = AudioCapture(config.SAMPLE_RATE, config.FRAME_MS)
        self.vad = VADSegmenter(
            sample_rate=config.SAMPLE_RATE,
            frame_ms=config.FRAME_MS,
            aggressiveness=config.VAD_AGGRESSIVENESS,
            padding_ms=config.PADDING_MS,
            ratio_trigger=config.RATIO_TRIGGER,
        )
        self.asr = ASREngine(
            config.WHISPER_MODEL_SIZE, config.WHISPER_DEVICE, config.WHISPER_COMPUTE_TYPE
        )
        self.console = Console()
        self.transcript_lines = []

    def run(self) -> str:
        self.capture.start()
        self.console.print(
            "[bold green]Listening — speak normally. Press Ctrl+C to end the session.[/bold green]\n"
        )
        try:
            with Live("", console=self.console, refresh_per_second=8) as live:
                for frame in self.capture.frames():
                    segment = self.vad.process_frame(frame)
                    if segment:
                        self._handle_segment(segment)
                    live.update(self._render())
        except KeyboardInterrupt:
            pass
        finally:
            tail = self.vad.flush()
            if tail:
                self._handle_segment(tail)
            self.capture.stop()

        return "\n".join(self.transcript_lines)

    def _handle_segment(self, segment: bytes):
        text = self.asr.transcribe_pcm16(segment)
        if text:
            timestamp = time.strftime("%H:%M:%S")
            self.transcript_lines.append(f"[{timestamp}] {text}")

    def _render(self) -> Text:
        return Text("\n".join(self.transcript_lines[-25:]))
