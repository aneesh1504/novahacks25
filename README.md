NovaHacks 25 — Monorepo

This repository contains two independent, runnable projects:
- Teacher–Student Matching Platform (Next.js + FastAPI)
- Voice Interviewer (Browser app with Flask server for STT/TTS)

Use the sections below to set up and run either app locally.

Table of contents
- Teacher–Student Matching Platform
    - Overview and key tech
    - Radar model and matching algorithms
    - App flow and repository layout
    - Quick start and detailed setup
    - Troubleshooting and roadmap
- Voice Interviewer
    - Features and overview
    - Run locally (Vosk STT + XTTS neural TTS)
    - Files, browser support, and notes
- Port usage and conflicts
- License

Teacher–Student Matching Platform

Overview
An end-to-end system that pairs students with teachers based on complementary learning needs and teacher strengths—not just by subject. The app extracts profiles, scores them along multiple dimensions, computes optimal assignments, and visualizes every pair with clear radar overlays.

Key tech
- Frontend: Next.js (App Router), TypeScript, Tailwind, shadcn/ui, Recharts
- Backend: FastAPI (Uvicorn), Python, NumPy/Pandas, SciPy
- Matching: Hungarian algorithm (optimal assignment) + cosine similarity for vector alignment

Radar model (what “radar” means here)
- Each profile is an 8‑dimension vector on a 0–10 scale.
    - Student needs: Subject Support, Patience Needed, Innovation Needed, Structure Needed, Communication Needed, Special Needs Support, Engagement Needed, Behavior Support Needed
    - Teacher strengths: Subject Expertise, Patience, Innovation, Structure, Communication, Special Needs Support, Student Engagement, Classroom Management
- Radar charts display these vectors around a circle so you can quickly see where a teacher compensates a student’s high‑need areas.
- Convention in the UI: red = student needs, blue = teacher strengths.

How matching works (in short)
1) Per‑pair score: For each skill dimension i, compute product(student_need_i, teacher_strength_i) → 0…100. Average across 8 dimensions → overall match percent.
2) Optimal assignment: Use the Hungarian algorithm (a.k.a. Kuhn–Munkres; SciPy’s linear_sum_assignment) to create a globally optimal set of assignments subject to class size constraints.
3) Cosine similarity: Where needed, we compare the angle between vectors to ensure orientation similarity (pattern of strengths vs needs), not just magnitude.

App flow
1) Login (root page /): Any email + password advances. Social buttons are decorative only.
2) Upload (/upload):
     - Drop multiple teacher docs (PDF/TXT/DOCX)
     - Upload student CSV
     - Set min/max class sizes
     - Click Process Data
3) Loading (/match/loading):
     - Smooth animated radar appears immediately (dummy data) while files are parsed
     - Backend extracts teacher/student vectors and computes matches
4) Results (/match/results):
     - Expand teachers to see assigned students
     - Per‑pair combined radar (student in red, teacher in blue)
     - “Why this pair?” dialog explains top contributing skills
     - A round purple AI button (bottom-right) opens a chat panel for insights (demo mode)

Repository layout (high‑level)
- api_server.py — FastAPI app with:
    - GET /api/health
    - POST /api/teachers/process (multipart teacher docs)
    - POST /api/students/process (student CSV)
    - POST /api/match (teachers + students + constraints)
- liquid-glass-login/ — Next.js app (App Router)
    - app/page.tsx — Login
    - app/upload/page.tsx — File ingestion
    - app/match/loading/page.tsx — Animated loading + processing
    - app/match/results/page.tsx — Matches and overlays
    - components/chat/ — AI assistant (floating button + panel)
    - lib/api/ — API client endpoints
    - lib/state/ — local session storage and pending file handoff

Quick start (Teacher–Student Matching)

Backend run (use a venv):
```zsh
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python -m uvicorn api_server:app --reload --port 8000
```

Frontend:
```zsh
cd liquid-glass-login
npm install
npm run dev
```

Create env file in liquid-glass-login/.env.local:
```bash
# Copy to .env.local and adjust values for your environment
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_USE_BACKEND=true
```

Detailed setup
1) Backend (Python/FastAPI)
     - Recommended: create a virtualenv and install dependencies
         ```zsh
         python3 -m venv .venv
         source .venv/bin/activate
         python -m pip install --upgrade pip
         python -m pip install -r requirements.txt
         python -m uvicorn api_server:app --reload --port 8000
         ```
     - Health check: http://127.0.0.1:8000/api/health → {"status":"ok"}

2) Frontend (Next.js)
     - From liquid-glass-login, install and run dev server
         ```zsh
         npm install
         npm run dev
         ```
     - Open http://localhost:3000
     - Login with any credentials → /upload

How the backend scores and assigns
- Parsing: teacher documents are processed to extract strength indicators; student CSV is converted to numeric need vectors.
- Scoring: average of per‑skill (need × strength) contributions (0–100) → overall match percent.
- Assignment: Hungarian algorithm finds an optimal pairing across the cohort while respecting min/max class size constraints.
- Similarity: cosine similarity helps align patterns (e.g., “high structure + high patience” teachers for students with those needs).

Troubleshooting
- API 404/connection errors:
    - Ensure the backend is running on port 8000
    - Verify .env.local has NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
    - If running frontend on a different origin, update CORS origins in api_server.py
- No animation or charts on loading page:
    - The page shows animated dummy data instantly; real data swaps in when parsing completes
- Resetting the session:
    - Use the Reset button on results (or clear browser localStorage)
- Virtualenv issues:
    - If `source .venv/bin/activate` fails, create it first: `python3 -m venv .venv`

Roadmap (ideas)
- Weighting per-skill importance (e.g., prioritize “Structure” for certain cohorts)
- Multi-origin CORS presets for team testing
- Exportable match reports (CSV/PDF)
- Optional authentication and persistent profiles

Voice Interviewer

Features
- Asks a predefined set of interview questions using XTTS neural text-to-speech
- Records your answers using the laptop microphone
- Visualizes live audio as a waveform
- Transcribes responses using Vosk speech-to-text
- Exports transcripts with recognized text

Overview
- No backend required for the basic UI; runs in the browser
- For speech-to-text and neural TTS, a Flask server provides Vosk STT and XTTS TTS endpoints

Run locally (with Vosk speech-to-text and XTTS neural voice)
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
- POST /transcribe for STT
- POST /tts for neural voice generation

3) Open the app and use it:
- Visit http://localhost:5173
- Select "XTTS (Neural Voice)" from the dropdown for high-quality AI voice, or browser TTS as fallback
- Ensure "Enable voice questions" is checked (default: on)
- Click "Start Interview" and allow microphone access
- Listen as the interviewer speaks each question with natural neural voice
- Answer the question (your voice will be recorded and transcribed)
- Use "Replay Question" anytime during recording to hear it again
- After each answer, the app uploads a 16kHz mono WAV to the server for transcription
- Use "Export Transcript (With STT)" to download a text file of recognized answers

Files (Voice Interviewer)
- index.html – App shell and layout
- src/style.css – Minimal white theme styles
- src/app.js – Interview flow, XTTS + browser TTS, waveform, recording, and export logic
- src/recorder-worklet.js – AudioWorklet processor to capture raw PCM for STT
- interview.md – Original prompt and questions
- ARCHITECTURE.md – System architecture and design notes
- server/app.py – Flask server with Vosk transcription + XTTS neural voice endpoints
- server/requirements.txt – Python dependencies for the server
- models/ – Place the downloaded Vosk model here (see step 1)

Browser support
- Modern Chromium/Firefox/Safari with getUserMedia, AudioContext, and MediaRecorder
- AudioWorklet is recommended for STT capture; if not supported, STT will be disabled
- Neural TTS requires server backend; browser TTS fallback uses speechSynthesis API

Notes
- Audio is recorded locally; when STT is enabled, a 16kHz WAV is sent to your local Flask server for offline transcription using Vosk
- Neural voice questions are generated server-side using XTTS and streamed to the browser. Browser TTS is available as fallback
- Transcript export includes question content and recognized text (when available); recorded audio remains playable in-page

Port usage and conflicts
- Teacher–Student Matching: FastAPI on 8000, Next.js on 3000
- Voice Interviewer: Flask server and static web on 5173
- If a port is busy, change it in the respective dev server command or config, then update any client URL references accordingly

License
TBD
