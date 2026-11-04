import { useCallback, useEffect, useRef, useState } from 'react'
import workletUrl from '../audio/recorder-worklet.ts?worker&url'
import {
  CALIBRATION_SECONDS,
  type RecordingOptions,
  SilenceDetector,
  calibrateThreshold,
} from '../audio/silenceDetector.ts'
import { toWav } from '../audio/wav.ts'

export type MicState = 'off' | 'starting' | 'calibrating' | 'on'

interface Microphone {
  stream: MediaStream
  context: AudioContext
  threshold: number
}

function micErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') {
      return 'Microphone access is blocked. Allow it in the browser’s site settings, then try again.'
    }
    if (error.name === 'NotFoundError') {
      return 'No microphone found. Connect one, then try again.'
    }
    if (error.name === 'NotReadableError') {
      return 'The microphone is busy or unavailable. Close other apps using it, then try again.'
    }
  }
  return 'Could not turn on the microphone.'
}

function concatenate(chunks: Float32Array[]): Float32Array {
  const samples = new Float32Array(chunks.reduce((total, chunk) => total + chunk.length, 0))
  let offset = 0
  for (const chunk of chunks) {
    samples.set(chunk, offset)
    offset += chunk.length
  }
  return samples
}

export function useRecorder() {
  const [micState, setMicState] = useState<MicState>('off')
  const [micError, setMicError] = useState<string | null>(null)
  const microphone = useRef<Microphone | null>(null)
  const onChunk = useRef<((chunk: Float32Array) => void) | null>(null)
  const finishRecording = useRef<(() => void) | null>(null)

  const turnOffMicrophone = useCallback(() => {
    finishRecording.current?.()
    onChunk.current = null
    microphone.current?.stream.getTracks().forEach((track) => track.stop())
    void microphone.current?.context.close()
    microphone.current = null
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
      microphone.current = { stream, context, threshold: 0 }
      await context.audioWorklet.addModule(workletUrl)

      const source = context.createMediaStreamSource(stream)
      const recorder = new AudioWorkletNode(context, 'recorder', {
        channelCount: 1,
        channelCountMode: 'explicit',
      })
      recorder.port.onmessage = (event: MessageEvent<Float32Array>) => {
        onChunk.current?.(event.data)
      }

      // Silent output: keeps the node running without playing the microphone back
      const silence = context.createGain()
      silence.gain.value = 0
      source.connect(recorder).connect(silence).connect(context.destination)

      await context.resume()

      setMicState('calibrating')
      const noise = await new Promise<Float32Array>((resolve) => {
        const chunks: Float32Array[] = []
        onChunk.current = (chunk) => {
          chunks.push(chunk)
          const samples = concatenate(chunks)
          if (samples.length >= CALIBRATION_SECONDS * context.sampleRate) {
            onChunk.current = null
            resolve(samples)
          }
        }
      })
      microphone.current = { stream, context, threshold: calibrateThreshold(noise) }
      setMicState('on')
    } catch (error) {
      stream?.getTracks().forEach((track) => track.stop())
      turnOffMicrophone()
      setMicError(micErrorMessage(error))
      setMicState('off')
    }
  }, [turnOffMicrophone])

  /**
   * Records until there is a pause or stopRecording is called. Resolves to a 16 kHz,
   * mono, 16-bit WAV, or to null if no voice was ever heard.
   */
  const recordUntilSilence = useCallback((options: RecordingOptions): Promise<Blob | null> => {
    return new Promise((resolve, reject) => {
      const mic = microphone.current
      if (!mic) {
        resolve(null)
        return
      }

      const { sampleRate } = mic.context
      const detector = new SilenceDetector(mic.threshold, sampleRate, options)
      const chunks: Float32Array[] = []

      const finish = () => {
        onChunk.current = null
        finishRecording.current = null
        if (detector.heardSpeech) {
          toWav(concatenate(chunks), sampleRate).then(resolve, reject)
        } else {
          resolve(null)
        }
      }

      finishRecording.current = finish
      onChunk.current = (chunk) => {
        chunks.push(chunk)
        if (detector.push(chunk)) {
          finish()
        }
      }
    })
  }, [])

  const stopRecording = useCallback(() => {
    finishRecording.current?.()
  }, [])

  return { micState, micError, enableMicrophone, recordUntilSilence, stopRecording }
}
