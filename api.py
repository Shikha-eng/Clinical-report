from dotenv import load_dotenv
load_dotenv()
import asyncio
import time


from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import config
from vad import VADSegmenter
from asr import ASREngine
from clinical_extractor import ClinicalExtractor


app = FastAPI(title="Clinical Scribe API")



print("Loading Whisper model...")

asr_engine = ASREngine(
    config.WHISPER_MODEL_SIZE,
    config.WHISPER_DEVICE,
    config.WHISPER_COMPUTE_TYPE,
)

print("Whisper model loaded.")


# ============================================================
# CLINICAL EXTRACTION REQUEST
# ============================================================

class TranscriptRequest(BaseModel):
    transcript: str


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "service": "clinical-scribe"
    }


# ============================================================
# WEBSOCKET — LIVE TRANSCRIPTION
# ============================================================

@app.websocket("/ws/transcribe")
async def transcribe_websocket(websocket: WebSocket):

    await websocket.accept()

    print("Browser connected.")

    # New VAD instance for this recording session
    vad = VADSegmenter(
        sample_rate=config.SAMPLE_RATE,
        frame_ms=config.FRAME_MS,
        aggressiveness=config.VAD_AGGRESSIVENESS,
        padding_ms=config.PADDING_MS,
        ratio_trigger=config.RATIO_TRIGGER,
    )

    # Browser sends arbitrary sized audio chunks.
    # We buffer them until we have exactly one VAD frame.
    audio_buffer = bytearray()

    # 16-bit PCM = 2 bytes/sample
    # 16 kHz * 30 ms = 480 samples
    # 480 * 2 = 960 bytes
    frame_size_bytes = (
        int(config.SAMPLE_RATE * config.FRAME_MS / 1000) * 2
    )

    try:

        while True:

            message = await websocket.receive()

            # ------------------------------------------------
            # TEXT MESSAGE
            # ------------------------------------------------

            if "text" in message and message["text"]:

                command = message["text"]

                if command == "stop":

                    print("Stopping recording...")

                    # Process remaining VAD audio
                    tail = vad.flush()

                    if tail:

                        text = asr_engine.transcribe_pcm16(tail)

                        if text:

                            timestamp = time.strftime("%H:%M:%S")

                            await websocket.send_json({
                                "type": "transcript",
                                "text": text,
                                "timestamp": timestamp
                            })

                    await websocket.send_json({
                        "type": "stopped"
                    })

                    break

            # ------------------------------------------------
            # AUDIO BYTES
            # ------------------------------------------------

            if "bytes" in message and message["bytes"]:

                audio_buffer.extend(message["bytes"])

                # Process complete 30 ms frames
                while len(audio_buffer) >= frame_size_bytes:

                    frame = bytes(
                        audio_buffer[:frame_size_bytes]
                    )

                    del audio_buffer[:frame_size_bytes]

                    # -----------------------------
                    # VAD
                    # -----------------------------

                    segment = vad.process_frame(frame)

                    # -----------------------------
                    # ASR
                    # -----------------------------

                    if segment:

                        # faster-whisper is CPU-bound,
                        # so run it in a worker thread
                        text = await asyncio.to_thread(
                            asr_engine.transcribe_pcm16,
                            segment
                        )

                        if text:

                            timestamp = time.strftime("%H:%M:%S")

                            await websocket.send_json({
                                "type": "transcript",
                                "text": text,
                                "timestamp": timestamp
                            })

    except WebSocketDisconnect:

        print("Browser disconnected.")

    except Exception as e:

        print("WebSocket error:", e)

        try:
            await websocket.send_json({
                "type": "error",
                "message": str(e)
            })
        except Exception:
            pass


# ============================================================
# PROCESS COMPLETE TRANSCRIPT WITH OLLAMA
# ============================================================

@app.post("/api/process")
async def process_transcript(request: TranscriptRequest):

    transcript = request.transcript.strip()

    if not transcript:
        return {"success": False, "error": "Transcript is empty."}

    print("\nProcessing transcript...")

    try:
        extractor = ClinicalExtractor()
        result = await asyncio.to_thread(extractor.extract, transcript)
    except Exception as e:
        print("Extraction error:", e)
        return {"success": False, "error": str(e)}

    return {
        "success": True,
        "structured": result["structured"],
        "summary": result["summary"]
    }


# ============================================================
# SERVE FRONTEND
# ============================================================

app.mount(
    "/",
    StaticFiles(
        directory="frontend",
        html=True
    ),
    name="frontend"
)