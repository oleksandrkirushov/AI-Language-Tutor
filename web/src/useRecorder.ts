import { useCallback, useEffect, useRef, useState } from 'react'
import workletUrl from './recorder-worklet.ts?worker&url'
import { toWav } from './wav.ts'

export type MicState = 'off' | 'starting' | 'on'

interface Microphone {
  stream: MediaStream
  context: AudioContext
}

function micErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') {
      return 'Microphone access is blocked. Allow it in the browser’s site settings, then try again.'
    }
    if (error.name === 'NotFoundError') {
      return 'No microphone found. Connect one, then try again.'
    }
  }
  return 'Could not turn on the microphone.'
}

export function useRecorder() {
  const [micState, setMicState] = useState<MicState>('off')
  const [micError, setMicError] = useState<string | null>(null)
  const microphone = useRef<Microphone | null>(null)
  const chunks = useRef<Float32Array[] | null>(null) // null while not recording

  const turnOffMicrophone = useCallback(() => {
    microphone.current?.stream.getTracks().forEach((track) => track.stop())
    void microphone.current?.context.close()
    microphone.current = null
    chunks.current = null
  }, [])

  useEffect(() => turnOffMicrophone, [turnOffMicrophone])

  /** Call this from a click: browsers only start audio after a user action. */
  const enableMicrophone = useCallback(async () => {
    setMicState('starting')
    setMicError(null)

    let stream: MediaStream | undefined
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          // Left off so Whisper and pause detection get the voice unprocessed
          noiseSuppression: false,
          autoGainControl: false,
        },
      })

      // No fixed sampleRate here: Firefox rejects a microphone at a non-default rate
      const context = new AudioContext()
      microphone.current = { stream, context }
      await context.audioWorklet.addModule(workletUrl)

      const source = context.createMediaStreamSource(stream)
      const recorder = new AudioWorkletNode(context, 'recorder', {
        channelCount: 1,
        channelCountMode: 'explicit',
      })
      recorder.port.onmessage = (event: MessageEvent<Float32Array>) => {
        chunks.current?.push(event.data)
      }

      // Silent output: keeps the node running without playing the microphone back
      const silence = context.createGain()
      silence.gain.value = 0
      source.connect(recorder).connect(silence).connect(context.destination)

      await context.resume()
      setMicState('on')
    } catch (error) {
      stream?.getTracks().forEach((track) => track.stop())
      turnOffMicrophone()
      setMicError(micErrorMessage(error))
      setMicState('off')
    }
  }, [turnOffMicrophone])

  const startRecording = useCallback(() => {
    chunks.current = []
  }, [])

  /** Returns the audio recorded since startRecording as a 16 kHz, mono, 16-bit WAV. */
  const stopRecording = useCallback(async (): Promise<Blob> => {
    const recorded = chunks.current ?? []
    chunks.current = null

    const samples = new Float32Array(recorded.reduce((total, chunk) => total + chunk.length, 0))
    let offset = 0
    for (const chunk of recorded) {
      samples.set(chunk, offset)
      offset += chunk.length
    }

    return toWav(samples, microphone.current?.context.sampleRate ?? 48000)
  }, [])

  return { micState, micError, enableMicrophone, startRecording, stopRecording }
}
