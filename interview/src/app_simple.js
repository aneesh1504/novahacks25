// Simplified interviewer (clean version). See legacy code in app.js (deprecated).
const QUESTIONS = [
  "Tell me about a time you had to figure something out on your own.",
  "When you learn something new, what helps you understand it best?",
  "Describe working with classmates on a project recently.",
  "What do you do when homework feels really confusing?",
  "Share something interesting you learned lately and why it stuck.",
];

const statusEl = document.getElementById('status');
const recordBtn = document.getElementById('recordBtn'); // Will act as Start/Stop until session starts, then label changes
const questionEl = document.getElementById('currentQuestion');
const transcriptEl = document.getElementById('transcript');
const canvas = document.getElementById('waveform');
const ctx = canvas.getContext('2d');

let audioCtx, analyser, streamSrc, mediaStream, mediaRecorder, recorderNode;
let pcmChunks = [];
let recognizedAnswers = []; // accumulate { index, question, answer }
let isSessionActive = false;
let isAnswerRecording = false;
let currentQuestionIndex = -1;
let rafId; let lastSpeechTs = 0; let answerStartTs = 0;
const SILENCE_MS = 1500; const MIN_ANSWER_MS = 800; const RMS_SPEECH_THRESHOLD = 0.02;

function setStatus(m){ statusEl.textContent = m; }
function drawBaseline(){ 
  ctx.clearRect(0,0,canvas.width,canvas.height);
  // Draw a static blob until audio is initialized
  drawStaticBlob();
}

function drawStaticBlob(){
  const cx = canvas.width/2, cy = canvas.height/2;
  const baseR = Math.min(canvas.width, canvas.height) * 0.35;
  
  ctx.beginPath();
  ctx.arc(cx, cy, baseR, 0, Math.PI*2);
  ctx.fillStyle = '#0a0a0a';
  ctx.fill();
  
  // Add a subtle highlight
  ctx.save();
  ctx.clip();
  ctx.globalCompositeOperation = 'lighter';
  ctx.filter = 'blur(6px)';
  ctx.beginPath();
  ctx.arc(cx + baseR*0.3, cy - baseR*0.2, baseR*0.15, 0, Math.PI*2);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fill();
  ctx.restore();
}
drawBaseline();

async function initAudio(){
  if(!audioCtx) audioCtx = new (window.AudioContext||window.webkitAudioContext)();
  if(!mediaStream) mediaStream = await navigator.mediaDevices.getUserMedia({audio:true});
  if(!streamSrc) streamSrc = audioCtx.createMediaStreamSource(mediaStream);
  if(!analyser){ analyser = audioCtx.createAnalyser(); analyser.fftSize=1024; analyser.smoothingTimeConstant=0.7; }
  streamSrc.connect(analyser);
  if(!recorderNode && audioCtx.audioWorklet){
    try { await audioCtx.audioWorklet.addModule('./src/recorder-worklet.js'); recorderNode = new AudioWorkletNode(audioCtx,'recorder-processor'); streamSrc.connect(recorderNode); recorderNode.port.onmessage = e => { if(isAnswerRecording) pcmChunks.push(new Float32Array(e.data)); }; } catch(e){ console.warn('AudioWorklet unavailable, STT disabled.', e); }
  }
}

function startWaveform(){
  const time = new Uint8Array(analyser.fftSize);
  const freq = new Uint8Array(analyser.frequencyBinCount);
  const POINTS = 64;
  const phases = new Array(POINTS).fill(0).map(()=> Math.random()*Math.PI*2);
  let t = 0;
  let audioLevel = 0;
  let smoothedAudio = 0;
  
  function frame(){
    rafId = requestAnimationFrame(frame);
    
    // Always analyze audio for visual effects
    if(analyser) {
      analyser.getByteTimeDomainData(time);
      analyser.getByteFrequencyData(freq);
      
      // Calculate audio level for blob morphing
      let sum = 0;
      for(let i = 0; i < freq.length; i++) sum += freq[i];
      audioLevel = sum / freq.length / 255;
      smoothedAudio = smoothedAudio * 0.85 + audioLevel * 0.15;
    }
    
    // Silence detection only during recording
    if(isAnswerRecording){
      let s=0; for(let i=0;i<time.length;i++){ const v=(time[i]-128)/128; s+=v*v; }
      const rms=Math.sqrt(s/time.length);
      const now=performance.now(); if(rms>RMS_SPEECH_THRESHOLD) lastSpeechTs=now;
      if(now-answerStartTs>MIN_ANSWER_MS && now-lastSpeechTs>SILENCE_MS) finishAnswer();
    }

    // Draw animated organic blob
    ctx.clearRect(0,0,canvas.width,canvas.height);
    const cx = canvas.width/2, cy = canvas.height/2;
    const baseR = Math.min(canvas.width, canvas.height) * 0.35;
    
    // Gentle rotation during silence, vigorous pulsation during speech
    const silenceRotation = t * 0.3; // Slow rotation
    const speechPulsation = smoothedAudio * 8; // Vigorous pulsation
    
    // Base amplitude for gentle morphing + audio-reactive pulsation
    const baseAmp = baseR * 0.06; // Always present gentle morphing
    const audioAmp = baseR * 0.35 * smoothedAudio; // Strong pulsation during speech
    const totalAmp = baseAmp + audioAmp;
    
    // Speed changes: slow during silence, fast during speech
    const baseSpeed = 0.012; // Gentle base movement
    const audioSpeed = 0.15 * smoothedAudio; // Fast during speech
    const speed = baseSpeed + audioSpeed;

    // Build blob path with rotation and pulsation
    ctx.beginPath();
    for(let i=0;i<POINTS;i++){
      const ang = (i/POINTS) * Math.PI*2 + silenceRotation;
      
      // Gentle base morphing + speech-reactive pulsation
      const n1 = Math.sin(ang*3 + t + phases[i]) * 0.3;
      const n2 = Math.sin(ang*2 - t*0.7 + phases[i]*1.3) * 0.2;
      // Additional pulsation layer during speech
      const n3 = Math.sin(ang*6 + t*3 + speechPulsation) * 0.5 * smoothedAudio;
      const n = n1 + n2 + n3;
      
      const r = baseR + totalAmp * n;
      const x = cx + r * Math.cos(ang);
      const y = cy + r * Math.sin(ang);
      if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.closePath();
    ctx.fillStyle = '#0a0a0a';
    ctx.fill();

    // Highlights - subtle during silence, bright during speech
    ctx.save();
    ctx.clip();
    ctx.globalCompositeOperation = 'lighter';
    ctx.filter = 'blur(6px)';
    
    // Main highlight with rotation and audio reactivity
    const highlightOpacity = 0.05 + smoothedAudio * 0.20;
    const highlightX = cx + baseR*0.4*Math.cos(silenceRotation*0.5);
    const highlightY = cy - baseR*0.2*Math.sin(silenceRotation*0.5);
    ctx.beginPath();
    ctx.arc(highlightX, highlightY, baseR*0.18, 0, Math.PI*2);
    ctx.fillStyle = `rgba(255,255,255,${highlightOpacity})`;
    ctx.fill();
    
    ctx.filter = 'none';
    
    // Sparkles - few during silence, many during speech
    const sparkleCount = 2 + Math.floor(smoothedAudio * 8);
    for(let i=0; i<sparkleCount; i++){
      const sa = silenceRotation + t*0.8 + i*1.5 + speechPulsation;
      const sparkleR = baseR * (0.15 + smoothedAudio * 0.4);
      const sx = cx + sparkleR * Math.cos(sa);
      const sy = cy + sparkleR * Math.sin(sa*1.2);
      const sparkleSize = 0.8 + smoothedAudio * 2.5;
      ctx.beginPath(); 
      ctx.arc(sx, sy, sparkleSize, 0, Math.PI*2);
      ctx.fillStyle = `rgba(255,255,255,${0.3 + smoothedAudio * 0.6})`;
      ctx.fill();
    }
    ctx.restore();

    t += speed;
  }
  frame();
}
function stopWaveform(){ 
  if(rafId) {
    cancelAnimationFrame(rafId); 
    rafId = null;
  }
  drawStaticBlob(); 
}

function startSession(){ isSessionActive=true; recordBtn.textContent='Stop Recording'; currentQuestionIndex=-1; transcriptEl.innerHTML=''; askNextQuestion(); }
function stopSession(){ isSessionActive=false; recordBtn.textContent='Start Interview'; if(mediaRecorder && mediaRecorder.state==='recording') mediaRecorder.stop(); isAnswerRecording=false; stopWaveform(); setStatus('Recording stopped.'); }
function endSession(){
  stopSession();
  setStatus('Interview complete. You may export the transcript.');
  if(recognizedAnswers.length){
    const btn = document.getElementById('exportTranscriptBtn');
    if(btn) btn.disabled = false;
  }
}

function askNextQuestion(){ currentQuestionIndex++; if(currentQuestionIndex>=QUESTIONS.length){ endSession(); return; } const q=QUESTIONS[currentQuestionIndex]; questionEl.textContent=`Question ${currentQuestionIndex+1}/${QUESTIONS.length}: ${q}`; setStatus('Playing question...'); speakQuestion(q).then(()=> setTimeout(()=> startAnswer(),250)).catch(()=> startAnswer()); }

function startAnswer(){ if(!isSessionActive) return; setStatus('Listening for your answer...'); lastSpeechTs=performance.now(); answerStartTs=performance.now(); pcmChunks=[]; mediaRecorder=new MediaRecorder(mediaStream,{mimeType:chooseMime()}); const chunks=[]; mediaRecorder.ondataavailable=e=>{ if(e.data.size>0) chunks.push(e.data); }; mediaRecorder.onstop=()=>{ isAnswerRecording=false; const blob=new Blob(chunks,{type:mediaRecorder.mimeType}); processTranscription(blob); }; mediaRecorder.start(); isAnswerRecording=true; }
function finishAnswer(){ if(!isAnswerRecording) return; setStatus('Processing answer...'); isAnswerRecording=false; mediaRecorder.stop(); }
function chooseMime(){ const arr=['audio/webm;codecs=opus','audio/ogg;codecs=opus','audio/mp4']; for(const t of arr) if(MediaRecorder.isTypeSupported(t)) return t; return ''; }

async function processTranscription(_blob){
  let recognized='';
  try{
    if(pcmChunks.length){
      const wavBlob=buildWavFromPcm(pcmChunks,audioCtx.sampleRate,16000);
      recognized=await transcribeWithServer(wavBlob);
    }
  }catch(e){ console.error('Transcription failed',e); }
  recognizedAnswers.push({ index: currentQuestionIndex, question: QUESTIONS[currentQuestionIndex], answer: recognized });
  renderTranscriptItem(currentQuestionIndex,recognized);
  askNextQuestion();
}
function renderTranscriptItem(i,text){ const d=document.createElement('div'); d.className='transcript-item'; d.innerHTML=`<h3>Q${i+1}</h3><p>${QUESTIONS[i]}</p><p><strong>Answer:</strong> ${text||'(no speech detected)'}</p>`; transcriptEl.appendChild(d); }

function speakQuestion(t){ return speakWithElevenLabs(t).catch(()=> speakWithBrowserTts(t)); }
async function speakWithElevenLabs(text){ const r=await fetch('/tts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text})}); if(!r.ok) throw new Error('TTS failed'); const b=await r.blob(); const url=URL.createObjectURL(b); return new Promise((res,rej)=>{ const a=new Audio(url); a.onended=()=>{URL.revokeObjectURL(url); res();}; a.onerror=()=>{URL.revokeObjectURL(url); rej();}; a.play().catch(e=>{URL.revokeObjectURL(url); rej(e);}); }); }
function speakWithBrowserTts(text){ return new Promise((res,rej)=>{ if(!('speechSynthesis' in window)){ rej(); return; } const u=new SpeechSynthesisUtterance(text); u.rate=0.95; u.onend=()=>res(); u.onerror=()=>rej(); speechSynthesis.speak(u); }); }

// WAV helpers
function buildWavFromPcm(chunks, sourceRate, targetRate){ let total=0; for(const c of chunks) total+=c.length; const all=new Float32Array(total); let o=0; for(const c of chunks){ all.set(c,o); o+=c.length; } const res=resampleFloat32(all,sourceRate,targetRate); const pcm16=float32ToInt16(res); return encodeWav(pcm16,targetRate); }
function resampleFloat32(inp,inRate,outRate){ if(inRate===outRate) return inp; const ratio=inRate/outRate; const nl=Math.round(inp.length/ratio); const out=new Float32Array(nl); for(let i=0;i<nl;i++){ const idx=i*ratio; const i0=Math.floor(idx); const i1=Math.min(i0+1,inp.length-1); const frac=idx-i0; out[i]=inp[i0]*(1-frac)+inp[i1]*frac; } return out; }
function float32ToInt16(f){ const o=new Int16Array(f.length); for(let i=0;i<f.length;i++){ let s=Math.max(-1,Math.min(1,f[i])); o[i]= s<0 ? s*0x8000 : s*0x7FFF; } return o; }
function encodeWav(pcm16, sr){ const buf=new ArrayBuffer(44+pcm16.length*2); const v=new DataView(buf); writeString(v,0,'RIFF'); v.setUint32(4,36+pcm16.length*2,true); writeString(v,8,'WAVE'); writeString(v,12,'fmt '); v.setUint32(16,16,true); v.setUint16(20,1,true); v.setUint16(22,1,true); v.setUint32(24,sr,true); v.setUint32(28,sr*2,true); v.setUint16(32,2,true); v.setUint16(34,16,true); writeString(v,36,'data'); v.setUint32(40,pcm16.length*2,true); let off=44; for(let i=0;i<pcm16.length;i++,off+=2) v.setInt16(off,pcm16[i],true); return new Blob([v],{type:'audio/wav'}); }
function writeString(v,o,s){ for(let i=0;i<s.length;i++) v.setUint8(o+i,s.charCodeAt(i)); }
async function transcribeWithServer(wavBlob){ const fd=new FormData(); fd.append('file',wavBlob,'answer.wav'); const r=await fetch('/transcribe',{method:'POST',body:fd}); if(!r.ok) throw new Error('Transcribe failed'); const d=await r.json(); return d.text||''; }

recordBtn.addEventListener('click', async ()=>{
  if(!isSessionActive){
    try{ 
      await initAudio(); 
      await audioCtx.resume(); 
      // Now start the animated blob
      startWaveform(); 
      recognizedAnswers=[]; 
      const exportBtn=document.getElementById('exportTranscriptBtn'); 
      if(exportBtn) exportBtn.disabled=true; 
      startSession(); 
    }
    catch(e){ console.error(e); setStatus('Microphone access denied or unavailable.'); }
  } else { stopSession(); }
});
// Export transcript button handler
const exportBtn = document.getElementById('exportTranscriptBtn');
if(exportBtn){
  exportBtn.addEventListener('click', ()=>{
    if(!recognizedAnswers.length) return;
    const lines = [];
    lines.push('Interview Transcript');
    lines.push(`Total Questions: ${QUESTIONS.length}`);
    lines.push('');
    recognizedAnswers.sort((a,b)=> a.index - b.index).forEach(r=>{
      lines.push(`Q${r.index+1}: ${r.question}`);
      lines.push('Answer: ' + (r.answer || '(no speech detected)'));
      lines.push('');
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'interview_transcript.txt'; a.click();
    URL.revokeObjectURL(url);
  });
}
window.addEventListener('click', async ()=>{ if(audioCtx && audioCtx.state==='suspended'){ try{ await audioCtx.resume(); }catch(e){} } });

// Theme toggle initialization and persistence
const themeToggleBtn = document.getElementById('themeToggle');
(function initTheme(){
  try{
    const pref = localStorage.getItem('theme');
    const shouldDark = pref ? pref === 'dark' : window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if(shouldDark) document.body.classList.add('dark');
  } catch(_) { /* ignore */ }
  if(themeToggleBtn){
    themeToggleBtn.textContent = document.body.classList.contains('dark') ? 'Light Theme' : 'Dark Theme';
    themeToggleBtn.addEventListener('click', ()=>{
      document.body.classList.toggle('dark');
      const isDark = document.body.classList.contains('dark');
      themeToggleBtn.textContent = isDark ? 'Light Theme' : 'Dark Theme';
      try{ localStorage.setItem('theme', isDark ? 'dark' : 'light'); }catch(_){ /* ignore */ }
    });
  }
})();
