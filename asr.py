"""Wraps faster-whisper for transcribing individual VAD-detected segments."""

import numpy as np
from faster_whisper import WhisperModel


class ASREngine:
    def __init__(self, model_size: str, device: str, compute_type: str):
       
        self.model = WhisperModel(model_size, device=device, compute_type=compute_type)

    def transcribe_pcm16(self, pcm_bytes: bytes, language: str = "en") -> str:
        if len(pcm_bytes) == 0:
            return ""
        audio = np.frombuffer(pcm_bytes, dtype=np.int16).astype(np.float32) / 32768.0
       
        segments, _info = self.model.transcribe(
            audio, language=language, beam_size=5, vad_filter=False
        )
        return " ".join(seg.text.strip() for seg in segments).strip()
