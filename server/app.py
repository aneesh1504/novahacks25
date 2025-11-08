import io
import json
import os
import wave
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory
from vosk import Model, KaldiRecognizer

ROOT = Path(__file__).resolve().parent.parent
STATIC_DIR = ROOT
DEFAULT_MODEL_PATH = os.environ.get("VOSK_MODEL", str(ROOT / "models" / "vosk-model-small-en-us-0.15"))
SAMPLE_RATE = 16000

app = Flask(__name__, static_folder=str(STATIC_DIR), static_url_path="")

# Lazy model load so server can start without model present
_model: Model | None = None

def get_model() -> Model:
    global _model
    if _model is None:
        model_path = DEFAULT_MODEL_PATH
        if not os.path.isdir(model_path):
            raise RuntimeError(
                f"Vosk model not found at {model_path}. Set VOSK_MODEL env or place model there."
            )
        _model = Model(model_path)
    return _model

@app.route("/")
def index():
    return send_from_directory(STATIC_DIR, "index.html")

@app.post("/transcribe")
def transcribe():
    # Expect a single WAV file field named 'file'
    if "file" not in request.files:
        return jsonify({"error": "missing file field"}), 400

    file = request.files["file"]
    data = file.read()

    try:
        wav = wave.open(io.BytesIO(data), "rb")
    except wave.Error:
        return jsonify({"error": "invalid wav"}), 400

    if wav.getnchannels() != 1 or wav.getframerate() != SAMPLE_RATE or wav.getsampwidth() != 2:
        return jsonify({"error": "wav must be mono, 16kHz, 16-bit PCM"}), 400

    rec = KaldiRecognizer(get_model(), SAMPLE_RATE)

    # Stream in chunks
    text = ""
    while True:
        chunk = wav.readframes(4000)
        if len(chunk) == 0:
            break
        if rec.AcceptWaveform(chunk):
            pass
    final = rec.FinalResult()
    try:
        final_json = json.loads(final)
        text = final_json.get("text", "")
    except Exception:
        text = ""

    return jsonify({"text": text})

# Serve other static files (JS, CSS, etc.)
@app.route('/<path:path>')
def static_proxy(path):
    return send_from_directory(STATIC_DIR, path)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5173)), debug=True)
