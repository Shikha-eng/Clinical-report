from dotenv import load_dotenv
load_dotenv()

import json
from datetime import datetime

from live_transcriber import LiveTranscriber
from clinical_extractor import ClinicalExtractor


def main():
    transcriber = LiveTranscriber()
    transcript = transcriber.run()

    print("\n\n=== Session ended — full transcript ===\n")
    print(transcript if transcript.strip() else "(no speech captured)")

    if not transcript.strip():
        return

    print("\nSending transcript for clinical analysis...\n")
    extractor = ClinicalExtractor()
    result = extractor.extract(transcript)

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    with open(f"transcript_{ts}.txt", "w", encoding="utf-8") as f:
        f.write(transcript)
    with open(f"structured_{ts}.json", "w", encoding="utf-8") as f:
         json.dump(result["structured"], f, indent=2, ensure_ascii=False)
    with open(f"summary_{ts}.md", "w", encoding="utf-8") as f:
         f.write(result["summary"])

    print("=== Structured extraction ===")
    print(json.dumps(result["structured"], indent=2))
    print("\n=== Clinical summary ===")
    print(result["summary"])
    print(f"\nSaved: transcript_{ts}.txt, structured_{ts}.json, summary_{ts}.md")


if __name__ == "__main__":
    main()
