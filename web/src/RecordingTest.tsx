import { useEffect, useState } from 'react'
import { transcribeAudio } from './api.ts'
import { useRecorder } from './useRecorder.ts'

const TEST_RECORDING_MS = 3000

type TestState = 'idle' | 'recording' | 'transcribing'

/** Temporary check of the audio pipeline, to be replaced by the Space key flow. */
function RecordingTest() {
  const { micState, micError, enableMicrophone, startRecording, stopRecording } = useRecorder()
  const [testState, setTestState] = useState<TestState>('idle')
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [text, setText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!audioUrl) {
      return
    }
    return () => URL.revokeObjectURL(audioUrl)
  }, [audioUrl])

  async function recordTest() {
    setError(null)
    setText(null)
    setAudioUrl(null)
    setTestState('recording')

    startRecording()
    await new Promise((resolve) => setTimeout(resolve, TEST_RECORDING_MS))
    const wav = await stopRecording()
    setAudioUrl(URL.createObjectURL(wav))

    setTestState('transcribing')
    try {
      const result = await transcribeAudio(wav)
      setText(result.text)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not recognize the recording.')
    }
    setTestState('idle')
  }

  return (
    <section className="recording-test">
      <h2>Recording test</h2>

      {micState === 'on' ? (
        <button type="button" onClick={recordTest} disabled={testState !== 'idle'}>
          {testState === 'recording' ? 'Recording…' : 'Record 3 seconds'}
        </button>
      ) : (
        <button type="button" onClick={enableMicrophone} disabled={micState === 'starting'}>
          {micState === 'starting' ? 'Turning on…' : 'Turn on microphone'}
        </button>
      )}

      {testState === 'transcribing' && <p>Recognizing…</p>}
      {audioUrl && <audio controls src={audioUrl} />}
      {text !== null && (
        <p className="recognized-text">{text || 'No speech recognized in this recording.'}</p>
      )}
      {(micError ?? error) && (
        <p className="error" role="alert">
          {micError ?? error}
        </p>
      )}
    </section>
  )
}

export default RecordingTest
