// Voice Interviewer App
// Minimal web app that runs fully client-side.
// Features:
// - Prompts a predefined list of questions
// - Captures microphone audio per question
// - Shows live waveform using Web Audio API AnalyserNode
// - Produces a text transcript with timestamps (no cloud dependencies)

const QUESTIONS = [
  "Tell me about a time you had to figure something out on your own at school or at home. What did you do first, and how did you know if your idea worked?",
  "When you read or watch something new for class, what helps you understand it best — pictures, examples, talking it out, or something else?",
  "Think about a time you worked with classmates on a group project. How did you make sure everyone took part and the work got done?",
  "What do you usually do when something feels frustrating or confusing — like when homework gets really hard or instructions aren’t clear?",
  "Can you share something interesting you learned recently that stuck in your memory? How did you remember it?",
];

// App state
let audioCtx;
let analyser;
let mediaStream;
let mediaSource;
let mic;
let recorderNode; // AudioWorkletNode for PCM capture
let isPcmRecording = false;
let pcmChunks = []; // Float32Array chunks
let rafId;
let canvas, ctx;
let currentQuestionIndex = -1;
let mediaRecorder;
let chunks = [];
let interviewStartTs = null;
let questionStartTs = null;

const statusEl = document.getElementById('status');
const startBtn = document.getElementById('startInterviewBtn');
const stopBtn = document.getElementById('stopRecordingBtn');
const exportBtn = document.getElementById('exportBtn');
const exportSttBtn = document.getElementById('exportSttBtn');
const enableTtsBtn = document.getElementById('enableTtsBtn');
const replayQuestionBtn = document.getElementById('replayQuestionBtn');
const voiceSelect = document.getElementById('voiceSelect');
const questionEl = document.getElementById('currentQuestion');
const transcriptEl = document.getElementById('transcript');
const sttStatusEl = document.getElementById('sttStatus');

function setStatus(msg) {
  statusEl.textContent = msg || '';
}

function initCanvas() {
  canvas = document.getElementById('waveform');
  ctx = canvas.getContext('2d');
  drawEmptyWave();
}

function drawEmptyWave() {
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#f5f5f5';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#ccc';
  ctx.beginPath();
  ctx.moveTo(0, canvas.height/2);
  ctx.lineTo(canvas.width, canvas.height/2);
  ctx.stroke();
}

async function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (!mediaStream) {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  }
  if (!mic) {
    mic = audioCtx.createMediaStreamSource(mediaStream);
  }
  if (!analyser) {
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.8;
  }
  if (!mediaSource) {
    mediaSource = mic.connect(analyser);
  }

  // Setup AudioWorklet for raw PCM capture
  if (!recorderNode) {
    try {
      if (audioCtx.audioWorklet) {
        await audioCtx.audioWorklet.addModule('./src/recorder-worklet.js');
        recorderNode = new AudioWorkletNode(audioCtx, 'recorder-processor');
        mic.connect(recorderNode);
        recorderNode.port.onmessage = (e) => {
          if (!isPcmRecording) return;
          const buf = e.data;
          // Clone into a new Float32Array to avoid transfer issues
          pcmChunks.push(new Float32Array(buf));
        };
      } else {
        console.warn('AudioWorklet not supported; STT capture disabled.');
        sttStatusEl.textContent = 'Note: AudioWorklet not supported in this browser; STT disabled.';
      }
    } catch (err) {
      console.error('Failed to init AudioWorklet', err);
      sttStatusEl.textContent = 'STT capture initialization failed.';
    }
  }
}

function startVisualize() {
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  const draw = () => {
    rafId = requestAnimationFrame(draw);
    analyser.getByteTimeDomainData(dataArray);

    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.lineWidth = 2;
    ctx.strokeStyle = '#111';
    ctx.beginPath();

    const sliceWidth = canvas.width * 1.0 / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = v * canvas.height/2;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    ctx.lineTo(canvas.width, canvas.height/2);
    ctx.stroke();
  };

  draw();
}

function stopVisualize() {
  if (rafId) cancelAnimationFrame(rafId);
  drawEmptyWave();
}

function startRecording() {
  chunks = [];
  mediaRecorder = new MediaRecorder(mediaStream, { mimeType: preferredMimeType() });
  mediaRecorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };
  mediaRecorder.onstop = () => {
    const blob = new Blob(chunks, { type: mediaRecorder.mimeType || 'audio/webm' });
    const url = URL.createObjectURL(blob);
    const durationSec = ((performance.now() - questionStartTs) / 1000).toFixed(1);
    // Capture the question index at the time of recording stop to avoid race conditions
    const recordingQuestionIndex = currentQuestionIndex;
    const itemEl = appendTranscriptItem(recordingQuestionIndex, url, blob, durationSec);
    chunks = [];

    // Build WAV from captured PCM (if any) and request STT
    if (pcmChunks.length) {
      try {
        sttStatusEl.textContent = 'Transcribing with Vosk...';
        const wavBlob = buildWavFromPcm(pcmChunks, audioCtx.sampleRate, 16000);
        // Clear buffer for next question
        pcmChunks = [];
        transcribeWithServer(wavBlob).then(text => {
          sttStatusEl.textContent = text ? 'Transcription complete.' : 'No speech detected.';
          updateTranscriptItemWithText(itemEl, text);
          // store text using the captured question index
          const rec = recordedAnswers.find(r => r.qIndex === recordingQuestionIndex);
          if (rec) rec.recognized = text;
          exportSttBtn.disabled = false;
        }).catch(err => {
          console.error('STT error', err);
          sttStatusEl.textContent = 'Transcription failed.';
        });
      } catch (e) {
        console.error('WAV build/STT failed', e);
        sttStatusEl.textContent = 'STT processing failed.';
      }
    }
  };
  mediaRecorder.start();
  // Start PCM capture
  isPcmRecording = true;
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  isPcmRecording = false;
}

function preferredMimeType() {
  const types = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'];
  for (const t of types) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return '';
}

function appendTranscriptItem(qIndex, audioUrl, blob, durationSec) {
  const container = document.createElement('div');
  container.className = 'transcript-item';

  const qTitle = document.createElement('h3');
  qTitle.textContent = `Q${qIndex + 1}`;

  const qText = document.createElement('p');
  qText.textContent = QUESTIONS[qIndex];

  const audio = document.createElement('audio');
  audio.controls = true;
  audio.src = audioUrl;

  const meta = document.createElement('small');
  meta.className = 'meta';
  const ts = new Date().toLocaleString();
  meta.textContent = `Answered at ${ts} • Duration ~${durationSec}s`;

  container.appendChild(qTitle);
  container.appendChild(qText);
  container.appendChild(audio);
  container.appendChild(meta);
  transcriptEl.appendChild(container);

  // Store blob URL for export later
  recordedAnswers.push({ qIndex, audioUrl, blob, recognized: '' });

  if (qIndex < QUESTIONS.length - 1) {
    nextQuestion();
  } else {
    finishInterview();
  }

  return container;
}

const recordedAnswers = [];

// TTS (Text-to-Speech) variables
let ttsSupported = false;
let voices = [];
let currentUtterance = null;

function renderCurrentQuestion() {
  if (currentQuestionIndex >= 0 && currentQuestionIndex < QUESTIONS.length) {
    questionEl.textContent = QUESTIONS[currentQuestionIndex];
    // Speak the question if TTS is enabled
    if (enableTtsBtn.checked && ttsSupported) {
      speakQuestion(QUESTIONS[currentQuestionIndex]);
    }
  } else {
    questionEl.textContent = '';
  }
}

async function nextQuestion() {
  stopBtn.disabled = true;
  replayQuestionBtn.disabled = true;
  currentQuestionIndex += 1;
  if (currentQuestionIndex >= QUESTIONS.length) return finishInterview();

  renderCurrentQuestion();
  setStatus(`Question ${currentQuestionIndex + 1} of ${QUESTIONS.length}. Recording your answer...`);
  questionStartTs = performance.now();

  // Start recording a fresh answer
  startRecording();
  stopBtn.disabled = false;
  replayQuestionBtn.disabled = false;
}

function finishInterview() {
  stopBtn.disabled = true;
  startBtn.disabled = false;
  exportBtn.disabled = false;
  replayQuestionBtn.disabled = true;
  setStatus('Interview finished. You can play back answers or export the transcript.');
  stopVisualize();
  stopSpeaking();
}

function exportTranscript() {
  // Build a simple text transcript block with question text and audio placeholders
  let text = 'Voice Interview Transcript\n\n';
  const startTs = interviewStartTs ? new Date(interviewStartTs).toLocaleString() : new Date().toLocaleString();
  text += `Started: ${startTs}\n`;
  text += `Questions: ${QUESTIONS.length}\n\n`;

  recordedAnswers.sort((a,b)=> a.qIndex - b.qIndex).forEach(({ qIndex }, i) => {
    text += `Q${qIndex + 1}: ${QUESTIONS[qIndex]}\n`;
    text += `Answer: [audio attached]\n\n`;
  });

  // Offer as a downloadable .txt file
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'interview_transcript.txt';
  a.click();
  URL.revokeObjectURL(url);
}

function exportSttTranscript() {
  let lines = [];
  lines.push('Voice Interview Transcript (with STT)');
  lines.push('');
  recordedAnswers.sort((a,b)=> a.qIndex - b.qIndex).forEach(({ qIndex, recognized }) => {
    lines.push(`Q${qIndex + 1}: ${QUESTIONS[qIndex]}`);
    lines.push('Answer (STT): ' + (recognized || '(none)'));
    lines.push('');
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'interview_transcript_stt.txt';
  a.click();
  URL.revokeObjectURL(url);
}

function updateTranscriptItemWithText(container, text) {
  const p = document.createElement('p');
  p.textContent = 'Recognized: ' + (text || '(none)');
  container.appendChild(p);
}

// Build mono 16-bit PCM WAV from captured Float32 chunks; resample to targetRate
function buildWavFromPcm(chunks, sourceRate, targetRate) {
  // Concatenate Float32
  let total = 0;
  for (const c of chunks) total += c.length;
  const floatAll = new Float32Array(total);
  let o = 0;
  for (const c of chunks) { floatAll.set(c, o); o += c.length; }

  const resampled = resampleFloat32(floatAll, sourceRate, targetRate);
  const pcm16 = float32ToInt16(resampled);
  return encodeWav(pcm16, targetRate);
}

function resampleFloat32(input, inRate, outRate) {
  if (inRate === outRate) return input;
  const ratio = inRate / outRate;
  const newLen = Math.round(input.length / ratio);
  const out = new Float32Array(newLen);
  let pos = 0;
  for (let i = 0; i < newLen; i++) {
    const idx = i * ratio;
    const i0 = Math.floor(idx);
    const i1 = Math.min(i0 + 1, input.length - 1);
    const frac = idx - i0;
    out[i] = input[i0] * (1 - frac) + input[i1] * frac;
  }
  return out;
}

function float32ToInt16(float32) {
  const out = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    let s = Math.max(-1, Math.min(1, float32[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return out;
}

function encodeWav(pcm16, sampleRate) {
  const buffer = new ArrayBuffer(44 + pcm16.length * 2);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + pcm16.length * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate (sr * ch * 2)
  view.setUint16(32, 2, true); // block align (ch * 2)
  view.setUint16(34, 16, true); // bits per sample
  writeString(view, 36, 'data');
  view.setUint32(40, pcm16.length * 2, true);

  // PCM samples
  let offset = 44;
  for (let i = 0; i < pcm16.length; i++, offset += 2) {
    view.setInt16(offset, pcm16[i], true);
  }

  return new Blob([view], { type: 'audio/wav' });
}

function writeString(view, offset, str) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

async function transcribeWithServer(wavBlob) {
  const fd = new FormData();
  fd.append('file', wavBlob, 'answer.wav');
  const res = await fetch('/transcribe', { method: 'POST', body: fd });
  if (!res.ok) throw new Error('Transcribe failed');
  const data = await res.json();
  return data.text || '';
}

async function startInterview() {
  startBtn.disabled = true;
  exportBtn.disabled = true;
  transcriptEl.innerHTML = '';
  recordedAnswers.length = 0;
  currentQuestionIndex = -1;
  interviewStartTs = Date.now();

  try {
    await initAudio();
    await audioCtx.resume();
    initCanvas();
    initTts();
    startVisualize();
    setStatus('Microphone ready. Beginning interview...');
    await nextQuestion();
  } catch (err) {
    console.error(err);
    setStatus('Microphone access failed. Please allow mic permissions and reload.');
    startBtn.disabled = false;
  }
}

// Wire up controls
startBtn.addEventListener('click', startInterview);
stopBtn.addEventListener('click', () => {
  setStatus('Stopping current answer...');
  stopBtn.disabled = true;
  stopRecording();
});
exportBtn.addEventListener('click', exportTranscript);
exportSttBtn.addEventListener('click', exportSttTranscript);
replayQuestionBtn.addEventListener('click', () => {
  if (currentQuestionIndex >= 0 && currentQuestionIndex < QUESTIONS.length) {
    speakQuestion(QUESTIONS[currentQuestionIndex]);
  }
});

// TTS Functions
function initTts() {
  // Check if ElevenLabs TTS is available on the server
  checkXttsAvailability();
  
  // Keep browser TTS as fallback but prefer ElevenLabs
  if ('speechSynthesis' in window) {
    loadVoices();
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = loadVoices;
    }
  }
}

async function checkXttsAvailability() {
  try {
    const response = await fetch('/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: "test" })
    });
    
    if (response.ok) {
      ttsSupported = true;
      enableTtsBtn.disabled = false;
      // ElevenLabs voices (based on available voices in your account)
      voiceSelect.innerHTML = `
        <option value="Sarah">Sarah (ElevenLabs - Female)</option>
        <option value="Laura">Laura (ElevenLabs - Female)</option>
        <option value="Alice">Alice (ElevenLabs - Female)</option>
        <option value="Matilda">Matilda (ElevenLabs - Female)</option>
        <option value="Jessica">Jessica (ElevenLabs - Female)</option>
        <option value="Lily">Lily (ElevenLabs - Female)</option>
        <option value="Clyde">Clyde (ElevenLabs - Male)</option>
        <option value="Roger">Roger (ElevenLabs - Male)</option>
        <option value="Charlie">Charlie (ElevenLabs - Male)</option>
        <option value="George">George (ElevenLabs - Male)</option>
        <option value="Callum">Callum (ElevenLabs - Male)</option>
        <option value="Harry">Harry (ElevenLabs - Male)</option>
        <option value="Liam">Liam (ElevenLabs - Male)</option>
        <option value="Will">Will (ElevenLabs - Male)</option>
        <option value="Eric">Eric (ElevenLabs - Male)</option>
        <option value="Chris">Chris (ElevenLabs - Male)</option>
        <option value="Brian">Brian (ElevenLabs - Male)</option>
        <option value="Daniel">Daniel (ElevenLabs - Male)</option>
        <option value="Bill">Bill (ElevenLabs - Male)</option>
        <option value="River">River (ElevenLabs - Unisex)</option>
      `;
      if ('speechSynthesis' in window && speechSynthesis.getVoices().length > 0) {
        voiceSelect.innerHTML += '<option value="">Browser TTS (Fallback)</option>';
      }
    } else {
      setupBrowserTtsOnly();
    }
  } catch (error) {
    console.log('ElevenLabs TTS not available, using browser TTS');
    setupBrowserTtsOnly();
  }
}

function setupBrowserTtsOnly() {
  if (!('speechSynthesis' in window)) {
    ttsSupported = false;
    enableTtsBtn.disabled = true;
    enableTtsBtn.checked = false;
    voiceSelect.innerHTML = '<option>TTS not supported</option>';
    return;
  }
  
  ttsSupported = true;
  loadVoices();
}

function loadVoices() {
  voices = speechSynthesis.getVoices();
  voiceSelect.innerHTML = '';
  
  if (voices.length === 0) {
    voiceSelect.innerHTML = '<option>Loading voices...</option>';
    return;
  }

  // Add default option
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = 'Default voice';
  voiceSelect.appendChild(defaultOption);

  // Add available voices, prefer English ones
  const englishVoices = voices.filter(v => v.lang.startsWith('en'));
  const otherVoices = voices.filter(v => !v.lang.startsWith('en'));
  
  [...englishVoices, ...otherVoices].forEach((voice, index) => {
    const option = document.createElement('option');
    option.value = index;
    option.textContent = `${voice.name} (${voice.lang})`;
    voiceSelect.appendChild(option);
  });

  // Select a good default English voice if available
  const preferredVoice = englishVoices.find(v => v.default) || englishVoices[0];
  if (preferredVoice) {
    const index = voices.indexOf(preferredVoice);
    voiceSelect.value = index;
  }
}

function speakQuestion(text) {
  stopSpeaking(); // Stop any current speech

  const selectedVoice = voiceSelect.value;
  
  if (selectedVoice && selectedVoice !== '') {
    speakWithElevenLabs(text, selectedVoice);
  } else {
    speakWithBrowserTts(text);
  }
}

async function speakWithElevenLabs(text, voice = 'Rachel') {
  try {
    setStatus('Generating ElevenLabs voice...');
    
    const response = await fetch('/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        text: text,
        voice: voice,
        stability: 0.5,
        similarity_boost: 0.5
      })
    });
    
    if (!response.ok) {
      throw new Error('TTS request failed');
    }
    
    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    
    audio.onplay = () => {
      setStatus('Speaking question...');
      currentUtterance = { audio, url: audioUrl }; // Store for cleanup
    };
    
    audio.onended = () => {
      setStatus(`Question ${currentQuestionIndex + 1} of ${QUESTIONS.length}. Recording your answer...`);
      URL.revokeObjectURL(audioUrl);
      currentUtterance = null;
    };
    
    audio.onerror = () => {
      setStatus('ElevenLabs TTS playback failed, falling back to browser TTS');
      URL.revokeObjectURL(audioUrl);
      speakWithBrowserTts(text);
    };

    await audio.play();
    
  } catch (error) {
    console.error('ElevenLabs TTS error:', error);
    setStatus('ElevenLabs TTS failed, using browser TTS');
    speakWithBrowserTts(text);
  }
}

function speakWithBrowserTts(text) {
  if (!('speechSynthesis' in window)) {
    setStatus('TTS not available');
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  
  // Set voice if selected
  const selectedIndex = voiceSelect.selectedIndex;
  if (selectedIndex > 0 && voices.length > 0) {
    const voiceIndex = selectedIndex - 1; // Adjust for XTTS option
    if (voices[voiceIndex]) {
      utterance.voice = voices[voiceIndex];
    }
  }

  utterance.rate = 0.9; // Slightly slower for clarity
  utterance.pitch = 1.0;
  utterance.volume = 0.8;

  utterance.onstart = () => {
    setStatus('Speaking question...');
  };

  utterance.onend = () => {
    setStatus(`Question ${currentQuestionIndex + 1} of ${QUESTIONS.length}. Recording your answer...`);
  };

  utterance.onerror = (e) => {
    console.error('Browser TTS error:', e);
    setStatus(`Question ${currentQuestionIndex + 1} of ${QUESTIONS.length}. Recording your answer...`);
  };

  currentUtterance = utterance;
  speechSynthesis.speak(utterance);
}

function stopSpeaking() {
  if (currentUtterance) {
    if (currentUtterance.audio) {
      // XTTS audio cleanup
      currentUtterance.audio.pause();
      currentUtterance.audio.currentTime = 0;
      if (currentUtterance.url) {
        URL.revokeObjectURL(currentUtterance.url);
      }
    } else if (speechSynthesis.speaking) {
      // Browser TTS cleanup
      speechSynthesis.cancel();
    }
    currentUtterance = null;
  }
}

// Accessibility: resume audio context on user gesture for iOS/macOS Safari quirks
window.addEventListener('click', async () => {
  if (audioCtx && audioCtx.state === 'suspended') {
    try { await audioCtx.resume(); } catch {}
  }
}, { once: false });
