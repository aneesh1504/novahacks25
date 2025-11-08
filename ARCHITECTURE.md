# Voice Interviewer – Architecture and Design Notes

Date: 2025-11-08

## Goals
- Browser-based voice interviewer with a predefined list of questions
- Capture audio answers using the laptop microphone
- Display a live waveform visualization
- Export a simple transcript at the end
- Keep it simple, private, and offline-capable (no backend required)

## High-level Architecture
- Single-page web app (SPA) with optional STT backend
- Technologies: HTML, CSS, vanilla JavaScript, Web Audio API, AudioWorklet, MediaRecorder API
- Optional Flask + Vosk server for offline speech-to-text

```
User
  ⬇ permission prompt
MediaDevices.getUserMedia (audio)
  ⮕ MediaStream → AudioContext(MediaStreamSource) → AnalyserNode → Canvas waveform
  ⮕ MediaRecorder(MediaStream) → audio blobs per answer → Transcript view/export
UI: Start / Stop / Export buttons, current question, transcript list
```

## Components
### UI Layer
- `index.html`: buttons, waveform canvas, STT status, transcript list
- `style.css`: minimalist white theme

### Audio Capture & Visualization
- `AudioContext` + `AnalyserNode` for waveform
- `MediaRecorder` for compressed playback blobs (Opus/webm/ogg)
- `AudioWorklet` (`recorder-worklet.js`) captures raw Float32 PCM for STT

### Interview Flow
- Predefined `QUESTIONS[]`
- State: idle → recording answer N → finalize → next question → finish

### STT Backend (optional)
- Flask server (`server/app.py`) exposes `POST /transcribe`
- Vosk model loaded lazily; expects mono 16kHz 16-bit PCM WAV
- Frontend resamples raw PCM to 16 kHz and encodes WAV before upload

### Export
- Basic transcript (questions only)
- STT transcript (questions + recognized text)

## Key Design Choices
- Progressive enhancement: runs without STT; adds Vosk if backend started
- Offline speech-to-text: Vosk model served locally; no cloud dependency
- Separation of concerns: compressed playback (MediaRecorder) vs. raw PCM (AudioWorklet) so STT unaffected by codec
- Resampling client-side: linear interpolation to 16kHz keeps server simple
- Error resilience: STT failure does not block interview flow

## Data Model
- `QUESTIONS: string[]`
- `recordedAnswers: { qIndex: number; blob: Blob; audioUrl: string; recognized: string }[]`
- In-memory only; page refresh clears data

## Limitations & Future Enhancements
- Model size: user must manually download/unpack Vosk model (~50-70MB for small)
- No partial/interim STT shown; only final result per answer
- No persistence; consider IndexedDB for saving sessions
- Possible improvements: re-record answers, show input volume meter, add punctuation model/post-processing

## Browser Support
- Requires modern browser with `getUserMedia`, `AudioContext`, `MediaRecorder`. `AudioWorklet` required for STT path.
- Safari: may need user gesture to resume audio context; if AudioWorklet unsupported, STT is disabled gracefully.

## Security/Privacy
- Mic access only after explicit user consent
- Raw audio sent only to local Flask server (same machine)
- No external network calls; STT processed locally

## Build/Deploy
- Static mode: any HTTP server (without STT)
- STT mode: run Flask app (`server/app.py`) which serves frontend + endpoint
- Download model separately; path configurable via `VOSK_MODEL` env variable
