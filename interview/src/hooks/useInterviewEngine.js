import { useEffect, useRef, useState } from 'react';
import { buildWavFromPcm } from '../lib/audio.js';

export const QUESTIONS = [
  'Tell me about a time you had to figure something out on your own.',
  'When you learn something new, what helps you understand it best?',
  'Describe working with classmates on a project recently.',
  'What do you do when homework feels really confusing?',
  'Share something interesting you learned lately and why it stuck.',
];

const SILENCE_MS = 1500;
const MIN_ANSWER_MS = 900;
const RMS_THRESHOLD = 0.022;
const TARGET_SAMPLE_RATE = 16000;

export function useInterviewEngine() {
  const [status, setStatus] = useState('Tap start to begin your mock interview.');
  const [sessionActive, setSessionActive] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [transcripts, setTranscripts] = useState([]);
  const [isAnswering, setIsAnswering] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0.05);
  const [isBusy, setIsBusy] = useState(false);

  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const workletNodeRef = useRef(null);
  const pcmChunksRef = useRef([]);
  const sessionActiveRef = useRef(false);
  const isAnsweringRef = useRef(false);
  const questionIndexRef = useRef(-1);
  const rafRef = useRef(null);
  const lastSpeechRef = useRef(0);
  const answerStartRef = useRef(0);
  const levelRef = useRef(0.05);
  const finishAnswerRef = useRef(() => {});
  const startAnswerRef = useRef(() => {});
  const askNextQuestionRef = useRef(() => {});
  const handleRecordingCompleteRef = useRef(() => {});
  const workletReadyRef = useRef(true);

  useEffect(() => {
    const resumeAudio = () => {
      const ctx = audioCtxRef.current;
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
    };
    window.addEventListener('click', resumeAudio);
    return () => window.removeEventListener('click', resumeAudio);
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
    };
  }, []);

  const ensureMeterLoop = () => {
    if (!analyserRef.current || rafRef.current) return;
    const analyser = analyserRef.current;
    const freq = new Uint8Array(analyser.frequencyBinCount);
    const time = new Uint8Array(analyser.fftSize);

    const tick = () => {
      rafRef.current = requestAnimationFrame(tick);
      analyser.getByteFrequencyData(freq);
      let sum = 0;
      for (let i = 0; i < freq.length; i += 1) sum += freq[i];
      const normalized = sum / freq.length / 255;
      levelRef.current = levelRef.current * 0.85 + normalized * 0.15;
      setAudioLevel(levelRef.current);

      if (isAnsweringRef.current) {
        analyser.getByteTimeDomainData(time);
        let s = 0;
        for (let i = 0; i < time.length; i += 1) {
          const v = (time[i] - 128) / 128;
          s += v * v;
        }
        const rms = Math.sqrt(s / time.length);
        const now = performance.now();
        if (rms > RMS_THRESHOLD) lastSpeechRef.current = now;
        if (
          now - answerStartRef.current > MIN_ANSWER_MS &&
          now - lastSpeechRef.current > SILENCE_MS
        ) {
          finishAnswerRef.current();
        }
      }
    };

    tick();
  };

  const initAudio = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Microphone permissions are unavailable in this browser.');
    }

    if (!audioCtxRef.current) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      audioCtxRef.current = new Ctx();
    }
    const audioCtx = audioCtxRef.current;

    if (!mediaStreamRef.current) {
      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    }

    if (!sourceRef.current) {
      sourceRef.current = audioCtx.createMediaStreamSource(mediaStreamRef.current);
    }

    if (!analyserRef.current) {
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.7;
      analyserRef.current = analyser;
      sourceRef.current.connect(analyser);
    }

    if (!workletNodeRef.current && audioCtx.audioWorklet) {
      try {
        await audioCtx.audioWorklet.addModule('/worklets/recorder-worklet.js');
        const node = new AudioWorkletNode(audioCtx, 'recorder-processor');
        sourceRef.current.connect(node);
        node.port.onmessage = (event) => {
          if (isAnsweringRef.current) {
            pcmChunksRef.current.push(new Float32Array(event.data));
          }
        };
        workletNodeRef.current = node;
      } catch (error) {
        console.warn('AudioWorklet unavailable; STT disabled.', error);
        workletReadyRef.current = false;
      }
    }

    await audioCtx.resume();
    ensureMeterLoop();
  };

  const completeSession = () => {
    sessionActiveRef.current = false;
    setSessionActive(false);
    setIsAnswering(false);
    setStatus('Interview complete. Export the transcript whenever you like.');
  };

  const handleRecordingComplete = async () => {
    setIsBusy(true);
    let recognized = '';
    try {
      if (pcmChunksRef.current.length && audioCtxRef.current && workletReadyRef.current) {
        const wavBlob = buildWavFromPcm(
          pcmChunksRef.current,
          audioCtxRef.current.sampleRate,
          TARGET_SAMPLE_RATE,
        );
        recognized = await transcribeWithServer(wavBlob);
      }
    } catch (error) {
      console.error('Transcription failed', error);
    } finally {
      pcmChunksRef.current = [];
    }

    setTranscripts((prev) => [
      ...prev,
      {
        index: questionIndexRef.current,
        question: QUESTIONS[questionIndexRef.current],
        answer: recognized,
      },
    ]);
    setIsBusy(false);

    if (questionIndexRef.current >= QUESTIONS.length - 1) {
      completeSession();
    } else if (sessionActiveRef.current) {
      setTimeout(() => askNextQuestionRef.current(), 420);
    }
  };

  handleRecordingCompleteRef.current = handleRecordingComplete;

  const startAnswer = () => {
    if (!mediaStreamRef.current) return;
    setStatus('Listening for your answer...');

    const mime = chooseMime();
    const recorder = new MediaRecorder(mediaStreamRef.current, mime ? { mimeType: mime } : undefined);
    recorder.ondataavailable = () => {};
    recorder.onstop = () => handleRecordingCompleteRef.current();

    mediaRecorderRef.current = recorder;
    pcmChunksRef.current = [];
    lastSpeechRef.current = performance.now();
    answerStartRef.current = performance.now();
    isAnsweringRef.current = true;
    setIsAnswering(true);
    recorder.start();
  };

  startAnswerRef.current = startAnswer;

  const finishAnswer = () => {
    if (!isAnsweringRef.current) return;
    setStatus('Processing answer...');
    isAnsweringRef.current = false;
    setIsAnswering(false);
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === 'recording') {
      recorder.stop();
    }
  };

  finishAnswerRef.current = finishAnswer;

  const askNextQuestion = async () => {
    if (!sessionActiveRef.current) return;
    const nextIndex = questionIndexRef.current + 1;
    if (nextIndex >= QUESTIONS.length) {
      completeSession();
      return;
    }

    questionIndexRef.current = nextIndex;
    setCurrentIndex(nextIndex);
    setStatus('Playing question...');

    try {
      await speakQuestion(QUESTIONS[nextIndex]);
    } catch (error) {
      console.warn('Falling back to browser TTS', error);
      try {
        await speakWithBrowserTts(QUESTIONS[nextIndex]);
      } catch (_) {
        setStatus('Question ready. Speak when you are.');
      }
    }

    if (sessionActiveRef.current) {
      setTimeout(() => startAnswerRef.current(), 220);
    }
  };

  askNextQuestionRef.current = askNextQuestion;

  const startInterview = async () => {
    if (sessionActiveRef.current) return;
    try {
      setStatus('Initializing audio hardware...');
      await initAudio();
      sessionActiveRef.current = true;
      setSessionActive(true);
      setTranscripts([]);
      questionIndexRef.current = -1;
      setCurrentIndex(-1);
      setStatus('Find your pace—first prompt landing.');
      await askNextQuestionRef.current();
    } catch (error) {
      console.error(error);
      setStatus('Microphone access denied or unavailable.');
    }
  };

  const stopInterview = () => {
    if (!sessionActiveRef.current) return;
    sessionActiveRef.current = false;
    setSessionActive(false);
    setStatus('Interview paused.');
    finishAnswerRef.current();
  };

  const downloadTranscript = () => {
    if (!transcripts.length) return;
    const lines = [];
    lines.push('Voice Interviewer Transcript');
    lines.push(`Questions answered: ${transcripts.length}/${QUESTIONS.length}`);
    lines.push('');
    transcripts.forEach((entry) => {
      lines.push(`Q${entry.index + 1}: ${entry.question}`);
      lines.push(`Answer: ${entry.answer || '(no speech detected)'}`);
      lines.push('');
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'voice-interviewer-transcript.txt';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return {
    status,
    transcripts,
    currentIndex,
    sessionActive,
    isAnswering,
    audioLevel,
    isBusy,
    startInterview,
    stopInterview,
    downloadTranscript,
  };
}

function chooseMime() {
  const candidates = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
}

async function speakQuestion(text) {
  try {
    await speakWithElevenLabs(text);
  } catch (error) {
    console.warn('Neural TTS unavailable, falling back to browser voice.', error);
    await speakWithBrowserTts(text);
  }
}

async function speakWithElevenLabs(text) {
  const response = await fetch('/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!response.ok) throw new Error('TTS endpoint failed');
  const blob = await response.blob();
  return playBlob(blob);
}

function playBlob(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.onended = () => {
      URL.revokeObjectURL(url);
      resolve();
    };
    audio.onerror = (event) => {
      URL.revokeObjectURL(url);
      reject(event);
    };
    audio.play().catch((err) => {
      URL.revokeObjectURL(url);
      reject(err);
    });
  });
}

function speakWithBrowserTts(text) {
  return new Promise((resolve, reject) => {
    if (!('speechSynthesis' in window)) {
      reject(new Error('speechSynthesis unsupported'));
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1.05;
    utterance.onend = () => resolve();
    utterance.onerror = (event) => reject(event);
    window.speechSynthesis.speak(utterance);
  });
}

async function transcribeWithServer(wavBlob) {
  const form = new FormData();
  form.append('file', wavBlob, 'answer.wav');
  const response = await fetch('/transcribe', {
    method: 'POST',
    body: form,
  });
  if (!response.ok) throw new Error('Transcription endpoint failed');
  const data = await response.json();
  return data.text || '';
}
