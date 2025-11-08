## Voice Interviewer

A minimalist browser-based voice interviewer that:

- Asks a predefined set of interview questions **using XTTS neural text-to-speech**
- Records your answers using the laptop microphone
- Visualizes live audio as a waveform
- **Transcribes responses** using Vosk speech-to-text
- Exports transcripts with recognized text

No backend required; runs completely in the browser.

### Run locally (with Vosk speech-to-text and XTTS neural voice)

The app can run fully static, but for speech-to-text and neural TTS it uses a Flask server with Vosk and XTTS.

1) Download a Vosk English model (small):

- https://alphacephei.com/vosk/models (e.g., `vosk-model-small-en-us-0.15`)
- Unzip into `novahacks25/models/vosk-model-small-en-us-0.15`

2) Install Python deps and start the server:

```zsh
cd server
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
# Note: First run will download XTTS model (~2GB)
# Optional if you used a different model path
# export VOSK_MODEL="/absolute/path/to/model"
python app.py
```

This serves the web app at http://localhost:5173 and exposes:
- `POST /transcribe` for STT
- `POST /tts` for neural voice generation

3) Open the app and use it:

- Visit http://localhost:5173
- **Select "XTTS (Neural Voice)"** from the dropdown for high-quality AI voice, or browser TTS as fallback
- **Ensure "Enable voice questions" is checked** (default: on)
- Click "Start Interview" and allow microphone access
- **Listen** as the interviewer speaks each question with natural neural voice
- **Answer** the question (your voice will be recorded and transcribed)
- Use "Replay Question" anytime during recording to hear it again
- After each answer, the app uploads a 16kHz mono WAV to the server for transcription
- Use "Export Transcript (With STT)" to download a text file of recognized answers

### Files

- `index.html` – App shell and layout
- `src/style.css` – Minimal white theme styles
- `src/app.js` – Interview flow, **XTTS + browser TTS**, waveform, recording, and export logic
- `src/recorder-worklet.js` – AudioWorklet processor to capture raw PCM for STT
- `interview.md` – Original prompt and questions
- `ARCHITECTURE.md` – System architecture and design notes
- `server/app.py` – Flask server with Vosk transcription + **XTTS neural voice** endpoints
- `server/requirements.txt` – Python dependencies for the server
 - `models/` – Place the downloaded Vosk model here (see step 1)

### Browser support

Modern Chromium/Firefox/Safari with `getUserMedia`, `AudioContext`, and `MediaRecorder`. AudioWorklet is recommended for STT capture; if not supported, STT will be disabled. **Neural TTS** requires server backend; **browser TTS fallback** uses `speechSynthesis` API.

### Notes

- Audio is recorded locally; when STT is enabled, a 16kHz WAV is sent to your local Flask server for offline transcription using Vosk.
- **Neural voice questions** are generated server-side using XTTS and streamed to the browser. Browser TTS is available as fallback.
- Transcript export includes question content and recognized text (when available); recorded audio remains playable in-page.