// Simplified interviewer (clean version). See legacy code in app.js (deprecated).
const QUESTIONS = [
  "Tell me about a time you had to figure something out on your own.",
  "When you learn something new, what helps you understand it best?",
  "Describe working with classmates on a project recently.",
  "What do you do when homework feels really confusing?",
  "Share something interesting you learned lately and why it stuck.",
];

const statusEl = document.getElementById('status');
const recordBtn = document.getElementById('recordBtn');
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
function drawBaseline(){ ctx.fillStyle='#f5f5f5'; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.strokeStyle='#ccc'; ctx.beginPath(); ctx.moveTo(0,canvas.height/2); ctx.lineTo(canvas.width,canvas.height/2); ctx.stroke(); }
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

function startWaveform(){ const freq = new Uint8Array(analyser.frequencyBinCount); const time = new Uint8Array(analyser.fftSize); function frame(){ rafId=requestAnimationFrame(frame); analyser.getByteFrequencyData(freq); analyser.getByteTimeDomainData(time); if(isAnswerRecording){ let s=0; for(let i=0;i<time.length;i++){ const v=(time[i]-128)/128; s+=v*v; } const rms=Math.sqrt(s/time.length); const now=performance.now(); if(rms>RMS_SPEECH_THRESHOLD) lastSpeechTs=now; if(now-answerStartTs>MIN_ANSWER_MS && now-lastSpeechTs>SILENCE_MS) finishAnswer(); } ctx.fillStyle='#101010'; ctx.fillRect(0,0,canvas.width,canvas.height); const barW=(canvas.width/freq.length)*1.8; let x=0; for(let i=0;i<freq.length;i++){ const h=freq[i]; const hue=190+(h/255)*40; ctx.fillStyle=`hsl(${hue},70%,55%)`; ctx.fillRect(x,canvas.height-h/2,barW,h/2); x+=barW+1; } } frame(); }
function stopWaveform(){ if(rafId) cancelAnimationFrame(rafId); drawBaseline(); }

function startSession(){ isSessionActive=true; recordBtn.textContent='Stop Interview'; currentQuestionIndex=-1; transcriptEl.innerHTML=''; askNextQuestion(); }
function stopSession(){ isSessionActive=false; recordBtn.textContent='Start Interview'; if(mediaRecorder && mediaRecorder.state==='recording') mediaRecorder.stop(); isAnswerRecording=false; stopWaveform(); setStatus('Interview stopped.'); }
function endSession(){
  stopSession();
  setStatus('Interview complete.');
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
    try{ await initAudio(); await audioCtx.resume(); drawBaseline(); startWaveform(); recognizedAnswers=[]; const exportBtn=document.getElementById('exportTranscriptBtn'); if(exportBtn) exportBtn.disabled=true; startSession(); }
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
