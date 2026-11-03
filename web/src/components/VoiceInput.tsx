import { useVoiceInput } from '../hooks/useVoiceInput.ts'

function VoiceInput() {
  const { micState, appState, transcript, notice, error, enableMicrophone, toggleRecording } =
    useVoiceInput()

  return (
    <section className="voice-input">
      {micState === 'on' ? (
        <>
          <button
            type="button"
            onClick={toggleRecording}
            disabled={appState !== 'idle' && appState !== 'recording'}
          >
            {appState === 'recording' ? 'Finish' : 'Start speaking'}
          </button>
          <p role="status" data-state={appState}>
            {appState === 'idle' && 'Press Space and speak.'}
            {appState === 'recording' && 'Listening… Pause or press Space to finish.'}
            {appState === 'transcribing' && 'Recognizing…'}
          </p>
        </>
      ) : (
        <>
          <button type="button" onClick={enableMicrophone} disabled={micState !== 'off'}>
            {micState === 'off' ? 'Turn on microphone' : 'Turning on…'}
          </button>
          <p role="status">
            {micState === 'calibrating' && 'Measuring background noise, stay quiet for half a second…'}
          </p>
        </>
      )}

      {transcript && (
        <p className="transcript">
          <strong>You said:</strong> {transcript}
        </p>
      )}
      {notice && <p>{notice}</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}

export default VoiceInput
