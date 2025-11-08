// Simplified Voice Interviewer Core
// Requirements:
//  - Single button starts/stops entire interview session
//  - ElevenLabs TTS asks predefined QUESTIONS sequentially
//  - After each question playback, user's spoken answer is recorded
//  - Silence auto-detect ends an answer, transcribes with Vosk (/transcribe)
//  - Waveform visualizes live audio while session active
// - Waveform visualizes live mic audio

const QUESTIONS = [
  "Tell me about a time you had to figure something out on your own.",
  "When you learn something new, what helps you understand it best?",
  "Describe working with classmates on a project recently.",
  "What do you do when homework feels really confusing?",
  "Share something interesting you learned lately and why it stuck.",
];

// Elements
const statusEl = document.getElementById('status');
const recordBtn = document.getElementById('recordBtn');
const questionEl = document.getElementById('currentQuestion');
const transcriptEl = document.getElementById('transcript');
const canvas = document.getElementById('waveform');
const ctx = canvas.getContext('2d');

// Audio state
let audioCtx, analyser, mediaStream, mic, recorderNode;
let mediaRecorder;
let pcmChunks = []; // Float32 buffers for STT
let isSessionActive = false;
let isAnswerRecording = false;
let currentQuestionIndex = -1;
let rafId;
let silenceMsRequired = 1500;
let minAnswerMs = 800;
let lastSpeechTs = 0;
let answerStartTs = 0;

// Transcript storage
const answers = []; // {question, recognized}

function setStatus(msg) { statusEl.textContent = msg; }

function drawBaseline() {
  ctx.fillStyle = '#f5f5f5';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.strokeStyle='#ccc';
  ctx.beginPath();
  ctx.moveTo(0, canvas.height/2);
  ctx.lineTo(canvas.width, canvas.height/2);
  ctx.stroke();
}

async function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext||window.webkitAudioContext)();
  if (!mediaStream) mediaStream = await navigator.mediaDevices.getUserMedia({audio:true, video:false});
  if (!mic) mic = audioCtx.createMediaStreamSource(mediaStream);
  if (!analyser) {
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.7;
  }
  mic.connect(analyser);
  if (!recorderNode && audioCtx.audioWorklet) {
    try {
      await audioCtx.audioWorklet.addModule('./src/recorder-worklet.js');
      recorderNode = new AudioWorkletNode(audioCtx,'recorder-processor');
      mic.connect(recorderNode);
      recorderNode.port.onmessage = e => { if (isAnswerRecording) pcmChunks.push(new Float32Array(e.data)); };
    } catch (e) { console.warn('AudioWorklet init failed; STT disabled.', e); }
  }
}

function startWaveform() {
  const freqData = new Uint8Array(analyser.frequencyBinCount);
  const timeData = new Uint8Array(analyser.fftSize);

  function frame() {
    rafId = requestAnimationFrame(frame);
    analyser.getByteFrequencyData(freqData);
    analyser.getByteTimeDomainData(timeData);

    // Compute RMS for silence detection
    if (isAnswerRecording) {
      let sum=0; for (let i=0;i<timeData.length;i++){ const v=(timeData[i]-128)/128; sum+=v*v; }
      const rms = Math.sqrt(sum/timeData.length); // ~0..1
      const now = performance.now();
      if (rms > 0.02) { // speech threshold tuned empirically
        lastSpeechTs = now;
      }
      if (now - answerStartTs > minAnswerMs && now - lastSpeechTs > silenceMsRequired) {
        finishAnswer();
      }
    }

    // Draw bars
    ctx.fillStyle = '#101010';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    const barW = (canvas.width / freqData.length) * 1.8;
    let x=0;
    for (let i=0;i<freqData.length;i++) {
      const h = freqData[i];
      const hue = 190 + (h/255)*40;
      ctx.fillStyle = `hsl(${hue},70%,55%)`;
      ctx.fillRect(x, canvas.height - h/2, barW, h/2);
      x += barW + 1;
    }
  }
  frame();
}

function stopWaveform(){ if (rafId) cancelAnimationFrame(rafId); drawBaseline(); }

function startSession() {
  isSessionActive = true;
  recordBtn.textContent = 'Stop Interview';
  answers.length = 0;
  currentQuestionIndex = -1;
  transcriptEl.innerHTML = '';
  askNextQuestion();
}

function stopSession() {
  isSessionActive = false;
  recordBtn.textContent = 'Start Interview';
  if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
  isAnswerRecording = false;
  stopWaveform();
  setStatus('Interview stopped.');
}

function askNextQuestion() {
  currentQuestionIndex++;
  if (currentQuestionIndex >= QUESTIONS.length) {
    endSession();
    return;
  }
  const q = QUESTIONS[currentQuestionIndex];
  questionEl.textContent = `Question ${currentQuestionIndex+1}/${QUESTIONS.length}: ${q}`;
  setStatus('Playing question...');
  speakQuestion(q).then(() => {
    setTimeout(() => startAnswer(), 250); // brief gap
  }).catch(()=> startAnswer());
}

function endSession() {
  stopSession();
  setStatus('Interview complete.');
}

function startAnswer() {
  if (!isSessionActive) return;
  setStatus('Listening for your answer...');
  lastSpeechTs = performance.now();
  answerStartTs = performance.now();
  pcmChunks = [];
  mediaRecorder = new MediaRecorder(mediaStream, {mimeType: chooseMime()});
  const chunks = [];
  mediaRecorder.ondataavailable = e => { if (e.data.size>0) chunks.push(e.data); };
  mediaRecorder.onstop = () => {
    isAnswerRecording = false;
    const blob = new Blob(chunks, {type: mediaRecorder.mimeType});
    processTranscription(blob);
  };
  mediaRecorder.start();
  isAnswerRecording = true;
}

function finishAnswer() {
  if (!isAnswerRecording) return;
  setStatus('Processing answer...');
  isAnswerRecording = false;
  mediaRecorder.stop();
}

function chooseMime(){
  const list=['audio/webm;codecs=opus','audio/ogg;codecs=opus','audio/mp4'];
  for (const t of list) if (MediaRecorder.isTypeSupported(t)) return t; return '';
}

async function processTranscription(blob) {
  let recognized = '';
  try {
    if (pcmChunks.length) {
      const wavBlob = buildWavFromPcm(pcmChunks, audioCtx.sampleRate, 16000);
      recognized = await transcribeWithServer(wavBlob);
    }
  } catch(e){ console.error('Transcription failed', e); }
  renderTranscriptItem(currentQuestionIndex, recognized);
  // Move to next question automatically
  askNextQuestion();
}

function renderTranscriptItem(idx, text){
  const div=document.createElement('div');
  div.className='transcript-item';
  div.innerHTML = `<h3>Q${idx+1}</h3><p>${QUESTIONS[idx]}</p><p><strong>Answer:</strong> ${text||'(no speech detected)'}</p>`;
  transcriptEl.appendChild(div);
}

// --- TTS Handling (prefers ElevenLabs; falls back to browser) ---
function speakQuestion(text){
  return speakWithElevenLabs(text).catch(()=> speakWithBrowserTts(text));
}

async function speakWithElevenLabs(text){
  const res = await fetch('/tts',{method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({text})});
  if (!res.ok) throw new Error('TTS failed');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  return new Promise((resolve,reject)=>{
    const audio = new Audio(url);
    audio.onended = ()=>{ URL.revokeObjectURL(url); resolve(); };
    audio.onerror = ()=>{ URL.revokeObjectURL(url); reject(); };
    audio.play().catch(err=>{ URL.revokeObjectURL(url); reject(err); });
  });
}

function speakWithBrowserTts(text){
  return new Promise((resolve,reject)=>{
    if (!('speechSynthesis' in window)) { reject(); return; }
    const u = new SpeechSynthesisUtterance(text);
    u.rate=0.95; u.onend=()=>resolve(); u.onerror=()=>reject();
    speechSynthesis.speak(u);
  });
}

// --- WAV building helpers ---
function buildWavFromPcm(chunks, sourceRate, targetRate){
  let total=0; for (const c of chunks) total+=c.length;
  const all=new Float32Array(total); let o=0; for(const c of chunks){ all.set(c,o); o+=c.length; }
  const resampled = resampleFloat32(all, sourceRate, targetRate);
  const pcm16 = float32ToInt16(resampled);
  return encodeWav(pcm16, targetRate);
}
function resampleFloat32(input,inRate,outRate){ if(inRate===outRate) return input; const ratio=inRate/outRate; const newLen=Math.round(input.length/ratio); const out=new Float32Array(newLen); for(let i=0;i<newLen;i++){ const idx=i*ratio; const i0=Math.floor(idx); const i1=Math.min(i0+1,input.length-1); const frac=idx-i0; out[i]=input[i0]*(1-frac)+input[i1]*frac; } return out; }
function float32ToInt16(f){ const o=new Int16Array(f.length); for(let i=0;i<f.length;i++){ let s=Math.max(-1,Math.min(1,f[i])); o[i]= s<0 ? s*0x8000 : s*0x7FFF; } return o; }
function encodeWav(pcm16, sampleRate){ const buffer=new ArrayBuffer(44+pcm16.length*2); const view=new DataView(buffer); writeString(view,0,'RIFF'); view.setUint32(4,36+pcm16.length*2,true); writeString(view,8,'WAVE'); writeString(view,12,'fmt '); view.setUint32(16,16,true); view.setUint16(20,1,true); view.setUint16(22,1,true); view.setUint32(24,sampleRate,true); view.setUint32(28,sampleRate*2,true); view.setUint16(32,2,true); view.setUint16(34,16,true); writeString(view,36,'data'); view.setUint32(40,pcm16.length*2,true); let off=44; for(let i=0;i<pcm16.length;i++,off+=2) view.setInt16(off, pcm16[i], true); return new Blob([view],{type:'audio/wav'}); }
function writeString(view, offset, str){ for(let i=0;i<str.length;i++) view.setUint8(offset+i,str.charCodeAt(i)); }

async function transcribeWithServer(wavBlob){ const fd=new FormData(); fd.append('file', wavBlob, 'answer.wav'); const res=await fetch('/transcribe',{method:'POST', body:fd}); if(!res.ok) throw new Error('Transcribe failed'); const data=await res.json(); return data.text||''; }

// --- Session wiring ---
recordBtn.addEventListener('click', async ()=>{
  if (!isSessionActive) {
    try { await initAudio(); await audioCtx.resume(); drawBaseline(); startWaveform(); startSession(); }
    catch(e){ console.error(e); setStatus('Microphone access denied or unavailable.'); }
  } else {
    stopSession();
  }
});

// Accessibility resume for Safari/iOS
window.addEventListener('click', async ()=>{ if(audioCtx && audioCtx.state==='suspended'){ try{ await audioCtx.resume(); }catch{} } });
window.addEventListener('click', async ()=>{ if(audioCtx && audioCtx.state==='suspended'){ try{ await audioCtx.resume(); }catch(e){} } });

// Initial baseline draw
drawBaseline();

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
  
  // Check if auto mode is enabled
  const autoModeCheckbox = document.getElementById('autoModeCheckbox');
  isAutoMode = autoModeCheckbox ? autoModeCheckbox.checked : false;
  
  // Update silence settings if in auto mode
  if (isAutoMode) {
    const thresholdSlider = document.getElementById('silenceThreshold');
    const durationSlider = document.getElementById('silenceDuration');
    const minAnswerSlider = document.getElementById('minAnswerDuration');
    
    if (thresholdSlider) silenceThreshold = parseInt(thresholdSlider.value);
    if (durationSlider) silenceDuration = parseInt(durationSlider.value);
    if (minAnswerSlider) minAnswerDuration = parseInt(minAnswerSlider.value);
  }

  try {
    await initAudio();
    await audioCtx.resume();
    initCanvas();
    initTts();
    startVisualize();
    
    if (isAutoMode) {
      setStatus('Smart interviewer mode activated. Starting interview...');
      // Start with the first question in auto mode
      currentQuestionIndex = 0;
      await askQuestion();
    } else {
      setStatus('Microphone ready. Beginning interview...');
      await nextQuestion();
    }
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
// Smart controls event listeners
document.addEventListener('DOMContentLoaded', () => {
  // Update slider value displays
  const silenceThresholdSlider = document.getElementById('silenceThreshold');
  const silenceDurationSlider = document.getElementById('silenceDuration');
  const minAnswerSlider = document.getElementById('minAnswerDuration');
  
  const thresholdValueSpan = document.getElementById('silenceThresholdValue');
  const durationValueSpan = document.getElementById('silenceDurationValue');
  const minAnswerValueSpan = document.getElementById('minAnswerDurationValue');
  
  if (silenceThresholdSlider && thresholdValueSpan) {
    silenceThresholdSlider.addEventListener('input', (e) => {
      thresholdValueSpan.textContent = e.target.value;
    });
  }
  
  if (silenceDurationSlider && durationValueSpan) {
    silenceDurationSlider.addEventListener('input', (e) => {
      durationValueSpan.textContent = e.target.value;
    });
  }
  
  if (minAnswerSlider && minAnswerValueSpan) {
    minAnswerSlider.addEventListener('input', (e) => {
      minAnswerValueSpan.textContent = e.target.value;
    });
  }
  
  // Show/hide silence settings based on auto mode
  const autoModeCheckbox = document.getElementById('autoModeCheckbox');
  const silenceSettings = document.getElementById('silenceSettings');
  
  if (autoModeCheckbox && silenceSettings) {
    function toggleSilenceSettings() {
      silenceSettings.style.display = autoModeCheckbox.checked ? 'block' : 'none';
    }
    
    autoModeCheckbox.addEventListener('change', toggleSilenceSettings);
    toggleSilenceSettings(); // Set initial state
  }
});

// Accessibility: resume audio context on user gesture for iOS/macOS Safari quirks
window.addEventListener('click', async () => {
  if (audioCtx && audioCtx.state === 'suspended') {
    try { await audioCtx.resume(); } catch {}
  }
}, { once: false });
