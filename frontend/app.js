// ============================================================
// CLINICAL SCRIBE FRONTEND
// ============================================================


// ============================================================
// ELEMENTS
// ============================================================

const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const clearBtn = document.getElementById("clearBtn");
const saveBtn = document.getElementById("saveBtn");

const processBtn = document.getElementById("processBtn");
const clearSummaryBtn = document.getElementById("clearSummaryBtn");
const copyBtn = document.getElementById("copyBtn");
const hpi =
    document.getElementById("hpi");

const transcriptBox =
    document.getElementById("transcriptBox");

const statusBox =
    document.getElementById("statusBox");

const wordCount =
    document.getElementById("wordCount");

const chunkCount =
    document.getElementById("chunkCount");

const clinicalSummary =
    document.getElementById("clinicalSummary");

const complaints =
    document.getElementById("complaints");

const symptoms =
    document.getElementById("symptoms");

const diagnosis =
    document.getElementById("diagnosis");

const medications =
    document.getElementById("medications");

const examinations =
    document.getElementById("examinations");

const allergies =
    document.getElementById("allergies");

const medicalHistory =
    document.getElementById("medicalHistory");

const followUp =
    document.getElementById("followUp");

const patientName =
    document.getElementById("patientName");

const patientAge =
    document.getElementById("patientAge");

const patientGender =
    document.getElementById("patientGender");


// ============================================================
// STATE
// ============================================================

let socket = null;

let audioContext = null;

let mediaStream = null;

let processor = null;

let source = null;

let isRecording = false;

let transcript = [];

let chunks = 0;


// ============================================================
// START RECORDING
// ============================================================

startBtn.addEventListener("click", startRecording);


async function startRecording() {

    try {

        transcript = [];

        chunks = 0;

        renderTranscript();

        updateStats();

        // ----------------------------------------
        // GET MICROPHONE
        // ----------------------------------------

        mediaStream =
            await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });


        // ----------------------------------------
        // CONNECT WEBSOCKET
        // ----------------------------------------

        const protocol =
            window.location.protocol === "https:"
                ? "wss:"
                : "ws:";

        socket = new WebSocket(
            `${protocol}//${window.location.host}/ws/transcribe`
        );

        socket.binaryType = "arraybuffer";


        socket.onopen = async () => {

            console.log("WebSocket connected.");

            await setupAudio();

            isRecording = true;

            startBtn.disabled = true;

            stopBtn.disabled = false;

            startBtn.innerHTML =
                `<span class="recording-dot"></span> Recording`;

            startBtn.classList.add("recording");

            statusBox.innerHTML = `
                <div class="status-icon">
                    🔴
                </div>

                <div>
                    <strong>Recording...</strong>
                    Speak naturally. VAD is detecting speech.
                </div>
            `;
        };


        socket.onmessage = (event) => {

            let data = null;

            try {
                // Handle text messages
                if (typeof event.data === "string") {
                    data = JSON.parse(event.data);

                // Handle binary frames that may contain UTF-8 JSON/text
                } else if (event.data instanceof ArrayBuffer) {
                    const text = new TextDecoder().decode(event.data);

                    try {
                        data = JSON.parse(text);
                    } catch (e) {
                        // treat raw text as transcript payload
                        data = { type: "transcript", text };
                    }

                // Already an object (some environments)
                } else {
                    data = event.data;
                }

            } catch (err) {
                console.error("Failed to parse WebSocket message:", err, event.data);
                return;
            }

            console.log("Backend:", data);


            // ------------------------------------
            // NEW TRANSCRIPT
            // ------------------------------------

            if (data && data.type === "transcript") {

                // tolerate different property names
                const text = data.text ?? data.message ?? data.data ?? "";

                const timestamp = data.timestamp ?? data.time ?? null;

                addTranscript(text, timestamp);
            }


            // ------------------------------------
            // RECORDING STOPPED
            // ------------------------------------

            if (data && data.type === "stopped") {

                cleanupAudio();

                statusBox.innerHTML = `
                    <div class="status-icon">
                        ✓
                    </div>

                    <div>
                        <strong>Recording stopped.</strong>
                        Transcript is ready for AI processing.
                    </div>
                `;
            }


            // ------------------------------------
            // ERROR
            // ------------------------------------

            if (data && data.type === "error") {

                console.error(data.message);

                alert(data.message);
            }
        };


        socket.onerror = (error) => {

            console.error(
                "WebSocket error:",
                error
            );

            alert(
                "Could not connect to the backend."
            );

            cleanupAudio();
        };


    } catch (error) {

        console.error(error);

        alert(
            "Microphone permission is required."
        );
    }
}


// ============================================================
// AUDIO SETUP
// ============================================================

async function setupAudio() {

    audioContext =
        new AudioContext();

    source =
        audioContext.createMediaStreamSource(
            mediaStream
        );


    /*
     * ScriptProcessorNode is simple and suitable
     * for this student-project MVP.
     *
     * Browser audio is usually 44100/48000 Hz.
     * We convert it to 16000 Hz PCM16 before
     * sending it to FastAPI.
     */

    processor =
        audioContext.createScriptProcessor(
            4096,
            1,
            1
        );


    processor.onaudioprocess =
        (event) => {

            if (!isRecording) {
                return;
            }

            const input =
                event.inputBuffer
                    .getChannelData(0);


            const pcm16 =
                downsampleTo16k(input);


            if (
                socket &&
                socket.readyState === WebSocket.OPEN
            ) {

                socket.send(pcm16);
            }
        };


    source.connect(processor);

    processor.connect(
        audioContext.destination
    );
}


// ============================================================
// DOWNSAMPLE TO 16 KHZ PCM16
// ============================================================

function downsampleTo16k(buffer) {

    const inputSampleRate =
        audioContext.sampleRate;

    const outputSampleRate = 16000;


    if (inputSampleRate === outputSampleRate) {

        return convertFloat32ToPCM16(buffer);
    }


    const ratio =
        inputSampleRate / outputSampleRate;

    const newLength =
        Math.round(
            buffer.length / ratio
        );

    const result =
        new Int16Array(newLength);


    let offsetResult = 0;

    let offsetBuffer = 0;


    while (
        offsetResult < result.length
    ) {

        const nextOffsetBuffer =
            Math.round(
                (offsetResult + 1) * ratio
            );

        let accum = 0;

        let count = 0;


        for (
            let i = offsetBuffer;
            i < nextOffsetBuffer &&
            i < buffer.length;
            i++
        ) {

            accum += buffer[i];

            count++;
        }


        const sample =
            count > 0
                ? accum / count
                : 0;


        const clamped =
            Math.max(
                -1,
                Math.min(1, sample)
            );


        result[offsetResult] =
            clamped < 0
                ? clamped * 32768
                : clamped * 32767;


        offsetResult++;

        offsetBuffer =
            nextOffsetBuffer;
    }


    return result.buffer;
}


// ============================================================
// FLOAT32 → PCM16
// ============================================================

function convertFloat32ToPCM16(buffer) {

    const result =
        new Int16Array(buffer.length);


    for (
        let i = 0;
        i < buffer.length;
        i++
    ) {

        const sample =
            Math.max(
                -1,
                Math.min(1, buffer[i])
            );


        result[i] =
            sample < 0
                ? sample * 32768
                : sample * 32767;
    }


    return result.buffer;
}


// ============================================================
// STOP RECORDING
// ============================================================

stopBtn.addEventListener(
    "click",
    stopRecording
);


function stopRecording() {

    if (!socket) {
        return;
    }


    isRecording = false;

    startBtn.disabled = false;

    stopBtn.disabled = true;

    startBtn.innerHTML =
        "🎙 Start Mic";

    startBtn.classList.remove(
        "recording"
    );


    // Tell backend to flush VAD
    if (
        socket.readyState === WebSocket.OPEN
    ) {

        socket.send("stop");
    }
}


// ============================================================
// CLEANUP AUDIO
// ============================================================

function cleanupAudio() {

    isRecording = false;


    if (processor) {

        processor.disconnect();

        processor = null;
    }


    if (source) {

        source.disconnect();

        source = null;
    }


    if (audioContext) {

        audioContext.close();

        audioContext = null;
    }


    if (mediaStream) {

        mediaStream
            .getTracks()
            .forEach(track =>
                track.stop()
            );

        mediaStream = null;
    }


    startBtn.disabled = false;

    stopBtn.disabled = true;

    startBtn.innerHTML =
        "🎙 Start Mic";

    startBtn.classList.remove(
        "recording"
    );
}


// ============================================================
// ADD TRANSCRIPT
// ============================================================

function addTranscript(
    text,
    timestamp
) {

    if (!text || !text.trim()) {
        return;
    }


    transcript.push({
        timestamp:
            timestamp ||
            new Date().toLocaleTimeString(),

        text: text.trim()
    });


    chunks++;

    renderTranscript();

    updateStats();
}


// ============================================================
// RENDER TRANSCRIPT
// ============================================================

function renderTranscript() {

    transcriptBox.innerHTML = "";


    transcript.forEach(item => {

        const line =
            document.createElement(
                "div"
            );


        line.className =
            "transcript-line";


        line.innerHTML = `
            <span class="timestamp">
                [${escapeHTML(item.timestamp)}]
            </span>

            ${escapeHTML(item.text)}
        `;


        transcriptBox.appendChild(line);
    });


    transcriptBox.scrollTop =
        transcriptBox.scrollHeight;
}
function toArray(value) {
    if (Array.isArray(value)) return value;
    if (typeof value === "string" && value.trim()) return [value];
    return [];
}

// ============================================================
// STATS
// ============================================================

function updateStats() {

    const text =
        transcript
            .map(item => item.text)
            .join(" ");


    const words =
        text.trim()
            ? text.trim().split(/\s+/).length
            : 0;


    wordCount.textContent =
        words;

    chunkCount.textContent =
        chunks;
}


// ============================================================
// CLEAR TRANSCRIPT
// ============================================================

clearBtn.addEventListener(
    "click",
    () => {

        transcript = [];

        chunks = 0;

        renderTranscript();

        updateStats();


        statusBox.innerHTML = `
            <div class="status-icon">
                ✨
            </div>

            <div>
                <strong>Ready</strong> —
                click Start Mic and speak naturally.
                VAD will auto-chunk your speech.
            </div>
        `;
    }
);


// ============================================================
// PROCESS TRANSCRIPT WITH AI
// ============================================================

processBtn.addEventListener(
    "click",
    processWithAI
);


async function processWithAI() {

    if (transcript.length === 0) {

        alert(
            "Please record some speech first."
        );

        return;
    }


    const fullTranscript =
        transcript
            .map(item => item.text)
            .join("\n");


    processBtn.disabled = true;

    processBtn.textContent =
        "⏳ Processing with AI...";


    statusBox.innerHTML = `
        <div class="status-icon">
            ⏳
        </div>

        <div>
            <strong>Analyzing transcript...</strong>
            Qwen3 is extracting clinical information.
        </div>
    `;


    try {

        const response =
            await fetch(
                "/api/process",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        transcript:
                            fullTranscript
                    })
                }
            );


        const data =
            await response.json();


        if (!data.success) {

            throw new Error(
                data.error ||
                "AI processing failed."
            );
        }


        displayClinicalData(
            data.structured,
            data.summary
        );


        statusBox.innerHTML = `
            <div class="status-icon">
                ✓
            </div>

            <div>
                <strong>AI processing complete.</strong>
                Clinical information extracted successfully.
            </div>
        `;


    } catch (error) {

        console.error(error);

        alert(
            "AI processing failed: " +
            error.message
        );


        statusBox.innerHTML = `
            <div class="status-icon">
                ⚠
            </div>

            <div>
                <strong>Processing failed.</strong>
                Check the FastAPI terminal.
            </div>
        `;

    } finally {

        processBtn.disabled = false;

        processBtn.textContent =
            "⚡ Process Transcript with AI";
    }
}


// ============================================================
// DISPLAY CLINICAL INFORMATION
// ============================================================

function displayClinicalData(
    data,
    summary
) {

    // ----------------------------------------
    // PATIENT
    // ----------------------------------------

    const patient =
        data.patient_details || {};


    patientName.textContent =
        patient.name || "Not mentioned";


    patientAge.textContent =
        patient.age || "Not mentioned";


    patientGender.textContent =
        patient.sex || "Not mentioned";


    // ----------------------------------------
    // SUMMARY
    // ----------------------------------------

    clinicalSummary.value =
        summary || "";


    // ----------------------------------------
    // CHIEF COMPLAINT
    // ----------------------------------------

    const complaint =
        data.chief_complaint;


    complaints.innerHTML =
        complaint
            ? createDataHTML([complaint])
            : "No complaints extracted yet";

    const hpiData =
    data.history_of_present_illness || {};

    const hpiItems = [
        hpiData.onset ? `Onset: ${hpiData.onset}` : null,
        hpiData.duration ? `Duration: ${hpiData.duration}` : null,
        hpiData.progression ? `Progression: ${hpiData.progression}` : null,
        ...toArray(hpiData.aggravating_factors).map(f => `Aggravating: ${f}`),
        ...toArray(hpiData.relieving_factors).map(f => `Relieving: ${f}`),
    ].filter(Boolean);
    hpi.innerHTML =
       createDataHTML(hpiItems);

    if (hpiItems.length === 0) {
        hpi.innerHTML =
            "No history of present illness extracted";
    }
    // ----------------------------------------
    // SYMPTOMS
    // ----------------------------------------

    const positiveSymptoms =
        data.symptoms?.positive || [];


    symptoms.innerHTML =
        createDataHTML(
            positiveSymptoms
        );


    // ----------------------------------------
    // DIAGNOSIS
    // ----------------------------------------

    const assessment =
        data.assessment || {};


    const diagnoses = [];


    if (
        assessment.provisional_diagnosis
    ) {

        diagnoses.push(
            assessment.provisional_diagnosis
        );
    }


    if (
        assessment.differentials
    ) {

        diagnoses.push(
            ...assessment.differentials
        );
    }


    diagnosis.innerHTML =
        createDataHTML(diagnoses);


    // ----------------------------------------
    // MEDICATIONS
    // ----------------------------------------

    const meds =
        data.medication_history
            ?.current_medications || [];


    medications.innerHTML =
        createDataHTML(
            meds.map(med => {

                if (typeof med === "string") {
                    return med;
                }

                return [
                    med.name,
                    med.dosage
                ]
                    .filter(Boolean)
                    .join(" — ");
            })
        );


    // ----------------------------------------
    // EXAMINATIONS
    // ----------------------------------------

    const exams =
        data.clinical_observations
            ?.examination_findings || [];


    const investigations =
        data.plan
            ?.investigations || [];


    examinations.innerHTML =
        createDataHTML([
            ...exams,
            ...investigations
        ]);


    // ----------------------------------------
    // ALLERGIES
    // ----------------------------------------

    const allergyData =
        data.medication_history
            ?.allergies || [];


    allergies.innerHTML =
        createDataHTML(
            allergyData
        );


    // ----------------------------------------
    // MEDICAL HISTORY
    // ----------------------------------------

    const history =
        data.past_medical_history || {};


    medicalHistory.innerHTML =
        createDataHTML([
            ...(history.conditions || []),
            ...(history.surgeries || []),
            ...(history.hospitalisations || [])
        ]);


    // ----------------------------------------
    // FOLLOW UP
    // ----------------------------------------

    const plan =
        data.plan || {};


    followUp.innerHTML =
        createDataHTML([
            ...(plan.advice || []),
            ...(plan.prescriptions || []),
            plan.follow_up
        ].filter(Boolean));
}


// ============================================================
// CREATE DATA HTML
// ============================================================

function createDataHTML(data) {

    if (!data || data.length === 0) {

        return `
            <div class="empty-state">
                No information extracted
            </div>
        `;
    }


    return `
        <div class="data-list">
            ${
                data.map(item => `
                    <div class="data-item">
                        ${escapeHTML(String(item))}
                    </div>
                `).join("")
            }
        </div>
    `;
}


// ============================================================
// CLEAR SUMMARY
// ============================================================

clearSummaryBtn.addEventListener(
    "click",
    () => {

        clinicalSummary.value = "";

        complaints.innerHTML =
            "No complaints extracted yet";

        symptoms.innerHTML =
            "No symptoms extracted yet";

        diagnosis.innerHTML =
            "No diagnosis inferred";

        medications.innerHTML =
            "No medications extracted yet";

        examinations.innerHTML =
            "No examinations extracted yet";

        allergies.innerHTML =
            "No allergies extracted yet";

        medicalHistory.innerHTML =
            "No past medical history extracted";

        followUp.innerHTML =
            "No follow-up information extracted";
    }
);


// ============================================================
// SAVE TRANSCRIPT
// ============================================================

saveBtn.addEventListener(
    "click",
    () => {

        if (transcript.length === 0) {

            alert(
                "There is no transcript to save."
            );

            return;
        }


        const text =
            transcript
                .map(item =>
                    `[${item.timestamp}] ${item.text}`
                )
                .join("\n");


        const blob =
            new Blob(
                [text],
                {
                    type:
                        "text/plain"
                }
            );


        const url =
            URL.createObjectURL(blob);


        const link =
            document.createElement("a");


        link.href = url;

        link.download =
            `clinical_transcript_${Date.now()}.txt`;


        link.click();


        URL.revokeObjectURL(url);
    }
);


// ============================================================
// COPY TO PRESCRIPTION
// ============================================================

copyBtn.addEventListener(
    "click",
    async () => {

        const text = `
CLINICAL SUMMARY

${clinicalSummary.value}

CHIEF COMPLAINTS
${complaints.innerText}

SYMPTOMS
${symptoms.innerText}

CLINICAL IMPRESSION
${diagnosis.innerText}

MEDICATIONS
${medications.innerText}

EXAMINATIONS & TESTS
${examinations.innerText}

ALLERGIES
${allergies.innerText}

PAST MEDICAL HISTORY
${medicalHistory.innerText}

HISTORY & FOLLOW-UP
${followUp.innerText}
`;


        try {

            await navigator.clipboard.writeText(
                text
            );


            copyBtn.textContent =
                "✓ Copied";


            setTimeout(() => {

                copyBtn.textContent =
                    "Copy to Prescription";

            }, 1500);


        } catch (error) {

            alert(
                "Unable to copy information."
            );
        }
    }
);


// ============================================================
// HELPER
// ============================================================

function escapeHTML(text) {

    const div =
        document.createElement("div");

    div.textContent = text;

    return div.innerHTML;
}