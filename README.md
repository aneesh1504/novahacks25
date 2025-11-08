## Voice Interviewer

A minimalist browser-based voice interviewer that:

- Asks a predefined set of interview questions
- Records your answers using the laptop microphone
- Visualizes live audio as a waveform
- Exports a simple transcript at the end

No backend required; runs completely in the browser.

### Run locally (with Vosk speech-to-text)

The app can run fully static, but for speech-to-text it uses a small Flask server with Vosk.

1) Download a Vosk English model (small):

- https://alphacephei.com/vosk/models (e.g., `vosk-model-small-en-us-0.15`)
- Unzip into `novahacks25/models/vosk-model-small-en-us-0.15`

2) Install Python deps and start the server:

```zsh
cd server
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
# Optional if you used a different model path
# export VOSK_MODEL="/absolute/path/to/model"
python app.py
```

This serves the web app at http://localhost:5173 and exposes `POST /transcribe` for STT.

3) Open the app and use it:

- Visit http://localhost:5173
- Click "Start Interview" and allow microphone access
- After each answer, the app uploads a 16kHz mono WAV to the server for transcription
- Use "Export Transcript (With STT)" to download a text file of recognized answers

### Files

- `index.html` – App shell and layout
- `src/style.css` – Minimal white theme styles
- `src/app.js` – Interview flow, waveform, recording, and export logic
- `src/recorder-worklet.js` – AudioWorklet processor to capture raw PCM for STT
- `interview.md` – Original prompt and questions
- `ARCHITECTURE.md` – System architecture and design notes
- `server/app.py` – Flask server with Vosk transcription endpoint
- `server/requirements.txt` – Python dependencies for the server
 - `models/` – Place the downloaded Vosk model here (see step 1)

### Browser support

Modern Chromium/Firefox/Safari with `getUserMedia`, `AudioContext`, and `MediaRecorder`. Safari may select a different audio mime type automatically. AudioWorklet is recommended for STT capture; if not supported, STT will be disabled.

### Notes

- Audio is recorded locally; when STT is enabled, a 16kHz WAV is sent to your local Flask server for offline transcription using Vosk.
- Transcript export includes question content and recognized text (when available); recorded audio remains playable in-page.