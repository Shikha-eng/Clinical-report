import json
import os

from groq import Groq

import config


SCHEMA_DESCRIPTION = """Return a single JSON object with exactly these top-level keys:

- patient_details: {name, age, sex, identifiers}

- chief_complaint: string, in the patient's own words as far as possible

- history_of_present_illness: {onset, duration, progression, aggravating_factors, relieving_factors}

- symptoms: {positive: [list of strings], negative: [list of strings — explicitly denied symptoms]}

- past_medical_history: {conditions: [list], surgeries: [list], hospitalisations: [list]}

- medication_history: {current_medications: [{name, dosage, adherence}], allergies: [list]}

- clinical_observations: {vitals: {temperature, blood_pressure, pulse, respiratory_rate, spo2, other}, examination_findings: [list]}

- assessment: {provisional_diagnosis: string or null, differentials: [list]}

- plan: {investigations: [list], prescriptions: [list], advice: [list], follow_up: string or null}

Rules:

- Use null (for strings/objects) or [] (for lists) for anything not mentioned. Never invent values.

- Keep stated positives and stated negatives in "symptoms" strictly separate.
- Do not provide explanations or reasoning.

- Preserve clinician-stated diagnoses/differentials verbatim rather than inferring new ones.
"""


SUMMARY_INSTRUCTIONS = """After the JSON object, on its own line write exactly:

---SUMMARY---

followed by a concise clinical summary (50-70 words) suitable for a medical
record, in standard clinical note style, using only information present in
the transcript. Do not repeat the raw JSON in the summary."""


class ClinicalExtractor:

    def __init__(self, model=None, api_key=None):
        key = api_key or os.environ.get("GROQ_API_KEY")
        print("GROQ_API_KEY loaded:", "yes" if key else "MISSING")
        self.client = Groq(api_key=key)
        self.model = model or config.GROQ_MODEL

    def extract(self, transcript):

        prompt = (
            "You are a clinical scribe assistant. Below is a raw transcript "
            "of a doctor-patient consultation.\n\n"
            f"TRANSCRIPT:\n{transcript}\n\n"
            f"{SCHEMA_DESCRIPTION}\n"
            f"{SUMMARY_INSTRUCTIONS}"
        )
        print("Calling Groq now, model:", self.model)

        response = self.client.chat.completions.create(
            model=self.model,
            max_tokens=2000,
            messages=[
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        )
        print("Groq call returned.")

        raw = response.choices[0].message.content

        json_part, _, summary_part = raw.partition(
            "---SUMMARY---"
        )

        structured = self._parse_json(json_part)

        return {
            "structured": structured,
            "summary": summary_part.strip()
        }

    @staticmethod
    def _parse_json(text: str) -> dict:
        cleaned = text.strip().strip("`").strip()

        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:].strip()

        try:
            return json.loads(cleaned)

        except json.JSONDecodeError:
            return {
                "_parse_error": True,
                "raw_model_output": cleaned,
            }