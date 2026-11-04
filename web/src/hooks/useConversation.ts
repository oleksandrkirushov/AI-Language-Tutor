import { useCallback, useEffect, useRef, useState } from 'react'
import { speakText } from '../audio/speech.ts'
import { ApiError, type ChatMessage, sendChat, transcribeAudio } from '../services/api.ts'
import { useRecorder } from './useRecorder.ts'
import { useSpaceKey } from './useSpaceKey.ts'

export type AppState = 'idle' | 'recording' | 'transcribing' | 'thinking' | 'speaking'

const NOTHING_HEARD = 'Didn’t catch anything clear, please try again.'
const SPEECH_FAILED = 'Could not read the whole reply aloud.'

function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Could not reach the server.'
}

export function useConversation() {
  const { micState, micError, enableMicrophone, recordUntilSilence, stopRecording } = useRecorder()
  const [appState, setAppState] = useState<AppState>('idle')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const speech = useRef<AbortController | null>(null)

  const stopSpeaking = useCallback(() => {
    speech.current?.abort()
  }, [])

  useEffect(() => stopSpeaking, [stopSpeaking])

  const speakReply = useCallback(async (reply: string) => {
    setAppState('speaking')
    const controller = new AbortController()
    speech.current = controller
    if (!(await speakText(reply, controller.signal))) {
      setNotice(SPEECH_FAILED)
    }
  }, [])

  const recognize = useCallback(async (wav: Blob): Promise<string> => {
    setAppState('transcribing')
    const { text } = await transcribeAudio(wav)
    return text
  }, [])

  const takeTurn = useCallback(async () => {
    setNotice(null)
    setError(null)
    setAppState('recording')

    try {
      const wav = await recordUntilSilence()
      const text = wav ? await recognize(wav) : ''
      if (!text) {
        setNotice(NOTHING_HEARD)
        return
      }

      const history: ChatMessage[] = [...messages, { role: 'user', content: text }]
      setMessages(history)
      setAppState('thinking')

      const { reply } = await sendChat({ messages: history }).catch((caught: unknown) => {
        setMessages(messages) // remove the user's message, since there will be no reply
        throw caught
      })
      setMessages([...history, { role: 'assistant', content: reply }])
      await speakReply(reply)
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setAppState('idle')
    }
  }, [messages, recognize, recordUntilSilence, speakReply])

  const handleAction = useCallback(() => {
    if (appState === 'idle') {
      void takeTurn()
    } else if (appState === 'recording') {
      stopRecording()
    } else if (appState === 'speaking') {
      stopSpeaking()
    }
  }, [appState, stopRecording, stopSpeaking, takeTurn])

  useSpaceKey({ enabled: micState === 'on', onSpace: handleAction, onFocusLost: stopRecording })

  return {
    micState,
    appState,
    messages,
    notice,
    error: micError ?? error,
    enableMicrophone,
    handleAction,
  }
}
