import io
import json
import os
import wave
from pathlib import Path
import tempfile

from flask import Flask, jsonify, request, send_from_directory, send_file
from vosk import Model, KaldiRecognizer
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# TTS imports
try:
    from elevenlabs.client import ElevenLabs
    from elevenlabs import VoiceSettings
    TTS_AVAILABLE = True
except ImportError:
    TTS_AVAILABLE = False
    ElevenLabs = None
    VoiceSettings = None

ROOT = Path(__file__).resolve().parent.parent
STATIC_DIR = ROOT
DEFAULT_MODEL_PATH = os.environ.get("VOSK_MODEL", str(ROOT / "models" / "vosk-model-small-en-us-0.15"))
SAMPLE_RATE = 16000

app = Flask(__name__, static_folder=str(STATIC_DIR), static_url_path="")

# Lazy model loading so server can start without models present
_model = None  # Model | None
_tts_model = None  # TTS | None

def get_model():
    global _model
    if _model is None:
        model_path = DEFAULT_MODEL_PATH
        if not os.path.isdir(model_path):
            raise RuntimeError(
                f"Vosk model not found at {model_path}. Set VOSK_MODEL env or place model there."
            )
        _model = Model(model_path)
    return _model

def get_tts_model():
    global _tts_model
    if _tts_model is None:
        if not TTS_AVAILABLE:
            raise RuntimeError("ElevenLabs library not installed. Run: pip install elevenlabs")
        
        # Get API key from environment variable
        api_key = os.environ.get("ELEVENLABS_API_KEY")
        if not api_key:
            raise RuntimeError("ELEVENLABS_API_KEY environment variable not set")
        
        # Initialize ElevenLabs client
        _tts_model = ElevenLabs(api_key=api_key)
    return _tts_model

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

@app.post("/tts")
def text_to_speech():
    if not TTS_AVAILABLE:
        return jsonify({"error": "TTS not available"}), 500
    
    data = request.get_json()
    if not data or "text" not in data:
        return jsonify({"error": "missing text field"}), 400
    
    text = data["text"]
    voice = data.get("voice", "Sarah")  # Default to Sarah voice (available in your account)
    stability = data.get("stability", 0.5)  # Voice stability (0.0-1.0)
    similarity_boost = data.get("similarity_boost", 0.5)  # Voice similarity (0.0-1.0)
    
    if not text.strip():
        return jsonify({"error": "empty text"}), 400
    
    try:
        # Get ElevenLabs client
        client = get_tts_model()
        
        # Configure voice settings
        voice_settings = VoiceSettings(
            stability=stability,
            similarity_boost=similarity_boost,
            style=0.0,
            use_speaker_boost=True
        )
        
        # Generate audio using ElevenLabs
        audio_generator = client.generate(
            text=text,
            voice=voice,
            voice_settings=voice_settings,
            model="eleven_multilingual_v2"
        )
        
        # Convert generator to bytes
        audio_bytes = b"".join(audio_generator)
        
        # Create temporary file for output
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp_file:
            output_path = tmp_file.name
            tmp_file.write(audio_bytes)
        
        # Return the audio file
        return send_file(
            output_path,
            mimetype="audio/mp3",
            as_attachment=False,
            download_name="tts.mp3"
        )
    
    except Exception as e:
        return jsonify({"error": f"TTS generation failed: {str(e)}"}), 500
    finally:
        # Clean up temp file after sending
        try:
            if 'output_path' in locals():
                os.unlink(output_path)
        except:
            pass

# Serve other static files (JS, CSS, etc.)
@app.route('/<path:path>')
def static_proxy(path):
    return send_from_directory(STATIC_DIR, path)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5173)), debug=True)
