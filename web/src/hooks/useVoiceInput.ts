import { useCallback, useState } from 'react'
import { transcribeAudio } from '../services/api.ts'
import { useRecorder } from './useRecorder.ts'
import { useSpaceKey } from './useSpaceKey.ts'

export type AppState = 'idle' | 'recording' | 'transcribing' | 'thinking' | 'speaking'

const NOTHING_HEARD = 'Didn’t catch anything clear, please try again.'

export function useVoiceInput() {
  const { micState, micError, enableMicrophone, recordUntilSilence, stopRecording } = useRecorder()
  const [appState, setAppState] = useState<AppState>('idle')
  const [transcript, setTranscript] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const record = useCallback(async () => {
    setTranscript(null)
    setNotice(null)
    setError(null)
    setAppState('recording')

    try {
      const wav = await recordUntilSilence()
      if (wav) {
        setAppState('transcribing')
        const { text } = await transcribeAudio(wav)
        if (text) {
          setTranscript(text)
        } else {
          setNotice(NOTHING_HEARD)
        }
      } else {
        setNotice(NOTHING_HEARD)
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not recognize the recording.')
    }
    setAppState('idle')
  }, [recordUntilSilence])

  const toggleRecording = useCallback(() => {
    if (appState === 'idle') {
      void record()
    } else if (appState === 'recording') {
      stopRecording()
    }
  }, [appState, record, stopRecording])

  useSpaceKey({ enabled: micState === 'on', onSpace: toggleRecording, onFocusLost: stopRecording })

  return {
    micState,
    appState,
    transcript,
    notice,
    error: micError ?? error,
    enableMicrophone,
    toggleRecording,
  }
}
