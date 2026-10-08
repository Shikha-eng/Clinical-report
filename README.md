# 🩺 Clinical Scribe — Real-Time AI Clinical Documentation

> **Turn doctor-patient conversations into structured clinical notes using Speech-to-Text, NLP, and LLMs.**

Clinical Scribe is an AI-powered clinical documentation system that captures a doctor-patient conversation in real time, converts speech into text, and extracts clinically relevant information into a structured format.

The system combines **Voice Activity Detection (VAD), Faster-Whisper, FastAPI, WebSockets, and LLM-based information extraction** to reduce the manual effort involved in clinical documentation.

---

## ✨ Key Features

- 🎙️ **Real-time speech capture** from the microphone
- 🗣️ **Voice Activity Detection (VAD)** to identify speech segments and avoid processing silence
- 🤗 **Faster-Whisper ASR** for speech-to-text transcription
- ⚡ **Real-time WebSocket communication** between frontend and backend
- 🧠 **LLM-based clinical information extraction**
- 📋 Converts unstructured conversations into a predefined clinical schema
- 📝 Generates a concise clinical summary
- 💊 Extracts medications, allergies, symptoms, medical history, examinations, and clinical assessment
- 💾 Saves transcripts, structured JSON, and clinical summaries
- 🌐 Browser-based interface for live transcription and clinical review

---

## 🏗️ System Architecture

```text
                 Doctor–Patient Conversation
                           │
                           ▼
                  🎙️ Browser Microphone
                           │
                           ▼
                  Audio Streaming
                    (WebSocket)
                           │
                           ▼
                ┌─────────────────────┐
                │ Voice Activity      │
                │ Detection (VAD)     │
                └──────────┬──────────┘
                           │
                    Speech Segments
                           │
                           ▼
                ┌─────────────────────┐
                │    Faster-Whisper   │
                │   Speech-to-Text    │
                └──────────┬──────────┘
                           │
                      Transcript
                           │
                           ▼
                ┌─────────────────────┐
                │   LLM Clinical      │
                │    Extraction       │
                └──────────┬──────────┘
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
      Structured JSON              Clinical Summary
             │                           │
             └─────────────┬─────────────┘
                           ▼
                  Clinical Scribe UI
```

The backend processes audio in small frames, applies VAD to detect speech, sends detected speech segments through Faster-Whisper, and exposes the resulting transcript to the clinical extraction pipeline.

---

## 🧠 Clinical NLP Pipeline

The core NLP component converts an unstructured consultation transcript into a consistent clinical schema.

### Input

```text
Doctor: What brings you in today?

Patient: I've had a cough for about five days
and I've also been feeling feverish.

Doctor: Any difficulty breathing?

Patient: No, I haven't had any breathing problems.
```

### Structured Output

```json
{
  "patient_details": {
    "name": null,
    "age": null,
    "sex": null,
    "identifiers": null
  },
  "chief_complaint": "Cough and feverish feeling",
  "history_of_present_illness": {
    "onset": null,
    "duration": "5 days",
    "progression": null,
    "aggravating_factors": null,
    "relieving_factors": null
  },
  "symptoms": {
    "positive": [
      "Cough",
      "Feverish feeling"
    ],
    "negative": [
      "Difficulty breathing"
    ]
  }
}
```

A major design goal is **not to invent information**. The extraction prompt explicitly instructs the model to use `null` or empty lists for information that was not mentioned and to keep explicitly stated positive and negative symptoms separate.

---

## 📋 Clinical Information Extracted

The system extracts information across several clinical categories:

| Category | Extracted Information |
|---|---|
| Patient Details | Name, age, sex, identifiers |
| Chief Complaint | Primary reason for consultation |
| Present Illness | Onset, duration, progression, aggravating/relieving factors |
| Symptoms | Positive and explicitly denied symptoms |
| Medical History | Conditions, surgeries, hospitalisations |
| Medications | Medication name, dosage, adherence |
| Allergies | Reported allergies |
| Observations | Vitals and examination findings |
| Assessment | Provisional diagnosis and differentials |
| Plan | Investigations, prescriptions, advice, follow-up |
| Summary | Concise clinical note |

The schema and extraction rules are defined in the clinical extraction module.

---

## ⚙️ Technical Stack

### AI / ML

- **Faster-Whisper** — Automatic Speech Recognition
- **LLM / Groq API** — Clinical information extraction and summarization
- **NLP** — Clinical entity and information extraction
- **Structured prompting** — Consistent clinical output schema

### Backend

- **Python**
- **FastAPI**
- **WebSockets**
- **Pydantic**
- **asyncio**

### Audio Processing

- **WebRTC VAD**
- **SoundDevice**
- **16 kHz PCM audio**
- Speech segmentation with configurable padding and trigger thresholds

### Frontend

- HTML
- CSS
- JavaScript
- WebSocket-based real-time communication

The current implementation uses a small Faster-Whisper model on CPU with INT8 computation and streams transcription through a FastAPI WebSocket endpoint.

---

## 🔄 How It Works

### 1. Audio Capture

The browser captures microphone audio and streams audio chunks to the backend through a WebSocket connection.

### 2. Voice Activity Detection

WebRTC VAD processes short audio frames and determines whether the incoming audio contains speech.

Instead of continuously sending silence to the speech recognition model, the system groups speech frames into segments before transcription.

### 3. Speech Recognition

Detected speech segments are processed using Faster-Whisper.

```text
Audio → PCM16 → Whisper → Text
```

The current configuration uses:

```text
Sample Rate:     16 kHz
Frame Size:      30 ms
Whisper Model:   small
Device:          CPU
Compute Type:    INT8
```


### 4. Clinical Information Extraction

The transcript is passed to an LLM with a predefined clinical schema.

The prompt contains explicit constraints such as:

- Do not invent values
- Preserve clinician-stated diagnoses
- Separate positive and negative symptoms
- Return a consistent JSON structure
- Generate a concise clinical summary


### 5. Clinical Summary

The model additionally generates a short clinical summary suitable for documentation.

```text
Transcript
    ↓
Structured Clinical Data
    +
Clinical Summary
```

### 6. Output

The application can save:

```text
transcript_YYYYMMDD_HHMMSS.txt
structured_YYYYMMDD_HHMMSS.json
summary_YYYYMMDD_HHMMSS.md
```


---

## 🌐 API Architecture

The backend exposes a WebSocket endpoint for live transcription:

```text
/ws/transcribe
```

and an HTTP endpoint for processing completed transcripts:

```text
POST /api/process
```

There is also a health-check endpoint:

```text
GET /api/health
```

The WebSocket pipeline handles audio streaming, VAD, transcription, and timestamped transcript responses. The `/api/process` endpoint sends the completed transcript through the clinical extraction pipeline.

---

## 📁 Project Structure

```text
Clinical-report/
│
├── frontend/
│   ├── index.html
│   ├── app.js
│   └── style.css
│
├── api.py                  # FastAPI + WebSocket backend
├── main.py                 # Terminal application entry point
│
├── audio_capture.py        # Microphone/audio capture
├── vad.py                  # Voice Activity Detection
├── asr.py                  # Faster-Whisper ASR
├── live_transcriber.py     # Live transcription pipeline
│
├── clinical_extractor.py   # LLM-based clinical extraction
├── config.py               # Model/audio configuration
│
├── requirements.txt
└── .gitignore
```

---

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/Shikha-eng/Clinical-report.git
cd Clinical-report
```

### 2. Create a virtual environment

```bash
python -m venv venv
```

Activate it:

**Windows**

```bash
venv\Scripts\activate
```

**Linux / macOS**

```bash
source venv/bin/activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

The project uses packages including Faster-Whisper, WebRTC VAD, SoundDevice, FastAPI, and environment-variable support.

### 4. Configure the API key

Create a `.env` file:

```env
GROQ_API_KEY=your_api_key_here
```

The clinical extraction module reads the API key from the environment.

### 5. Start the application

Run:

```bash
uvicorn api:app --reload
```

Then open the application in your browser.

---

## 🎯 Design Challenges

### 1. Processing speech in real time

Continuous audio cannot simply be sent directly to the ASR model. The application uses VAD to identify meaningful speech segments before transcription.

### 2. Maintaining structured clinical output

Medical conversations are highly unstructured. The system therefore uses a predefined schema and explicit extraction rules to convert free-form dialogue into predictable JSON.

### 3. Handling clinical negation

A clinically important distinction is:

```text
"I have chest pain."
```

versus:

```text
"I do not have chest pain."
```

The extraction schema explicitly separates positive and explicitly denied symptoms to reduce this type of information loss.

### 4. Avoiding hallucinated information

The extraction prompt instructs the model to only use information present in the transcript and return `null` or empty lists when information is unavailable.

---

## 🔮 Future Improvements

- [ ] Speaker diarization — distinguish doctor and patient
- [ ] Medical terminology normalization
- [ ] Clinical entity linking
- [ ] Better handling of abbreviations and medical shorthand
- [ ] Evaluation against manually annotated clinical notes
- [ ] Hallucination and factual-consistency evaluation
- [ ] Confidence scores for extracted fields
- [ ] Support for multiple languages
- [ ] HIPAA/DPDP-oriented privacy and security controls
- [ ] Persistent patient/session management
- [ ] Integration with EHR/EMR systems
- [ ] GPU inference optimization
- [ ] Automated clinical note templates such as SOAP



## ⭐ Why This Project?

Clinical documentation is a repetitive part of healthcare workflows. This project explores how **speech recognition + NLP + LLMs** can be combined to transform an unstructured doctor-patient conversation into a structured clinical record.

The main focus is not simply generating text, but building a pipeline that preserves clinically important information while producing a consistent, machine-readable representation.
