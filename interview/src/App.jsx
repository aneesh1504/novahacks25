import LiquidBlob from './components/LiquidBlob.jsx';
import { QUESTIONS, useInterviewEngine } from './hooks/useInterviewEngine.js';

export default function App() {
  const {
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
  } = useInterviewEngine();

  const questionText =
    currentIndex >= 0 ? QUESTIONS[currentIndex] : 'Tap start to hear your first prompt.';
  const progress = currentIndex >= 0 ? ((currentIndex + 1) / QUESTIONS.length) * 100 : 0;

  return (
    <div className="app-shell">
      <div className="bg-aurora aurora-one" />
      <div className="bg-aurora aurora-two" />
      <div className="grain" />
      <main className="glass-panel">
        <header className="hero">
          <p className="eyebrow">Voice Interview Studio</p>
          <h1>Soft-spoken prep with liquid-glass vibes.</h1>
          <p className="lede">
            Flow through curated prompts, listen to neural voiceovers, and capture polished
            transcripts without leaving your browser.
          </p>
        </header>

        <section className="blob-stage">
          <LiquidBlob level={audioLevel} />
          <div className="status-chip">{status}</div>
          <p className="microcopy">
            {sessionActive
              ? isAnswering
                ? 'We are detecting your answer in real time. Stay conversational.'
                : 'Prompt is playing. Take a breath before you respond.'
              : 'Neural voice questions, offline transcription, and exportable notes.'}
          </p>
        </section>

        <section className="controls">
          <button
            className="primary"
            onClick={sessionActive ? stopInterview : startInterview}
            disabled={isBusy && !sessionActive}
          >
            {sessionActive ? 'Stop Session' : 'Start Session'}
          </button>
          <button className="ghost" onClick={downloadTranscript} disabled={!transcripts.length}>
            Export Transcript
          </button>
        </section>

        <section className="question-card">
          <div className="question-meta">
            <div>
              <span className="label">{currentIndex >= 0 ? 'Now asking' : 'Standing by'}</span>
              <p className="question-count">
                {currentIndex >= 0
                  ? `Question ${currentIndex + 1} / ${QUESTIONS.length}`
                  : `${QUESTIONS.length} prompts ready`}
              </p>
            </div>
            <div className="progress">
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>
          <h2>{questionText}</h2>
          <p className="helper-text">
            {sessionActive
              ? 'Answer naturally. Silence detection will stop the recording for you.'
              : 'When you are ready, tap start to hear the first question read aloud.'}
          </p>
        </section>

        <section className="transcript-panel">
          <header className="panel-header">
            <div>
              <p className="eyebrow">Live transcript</p>
              <h3>{transcripts.length ? 'Captured responses' : 'Waiting for your first answer'}</h3>
            </div>
            <span className="chip">{`${transcripts.length}/${QUESTIONS.length}`}</span>
          </header>
          <div className="transcript-list">
            {transcripts.length === 0 && (
              <p className="empty-state">
                Each response you give will appear here with its matching prompt.
              </p>
            )}
            {transcripts.map((entry) => (
              <article key={entry.index} className="transcript-item">
                <div className="bubble">Q{entry.index + 1}</div>
                <div>
                  <p className="question">{entry.question}</p>
                  <p className="answer">{entry.answer || '(no speech detected)'}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
