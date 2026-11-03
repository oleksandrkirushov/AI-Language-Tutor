const TARGET_SAMPLE_RATE = 16000 // the format POST /api/transcribe expects
const WAV_HEADER_BYTES = 44
const BYTES_PER_SAMPLE = 2

async function resampleTo16kHz(samples: Float32Array, sampleRate: number): Promise<Float32Array> {
  const length = Math.ceil((samples.length * TARGET_SAMPLE_RATE) / sampleRate)
  const context = new OfflineAudioContext(1, length, TARGET_SAMPLE_RATE)

  const buffer = context.createBuffer(1, samples.length, sampleRate)
  buffer.getChannelData(0).set(samples)

  const source = context.createBufferSource()
  source.buffer = buffer
  source.connect(context.destination)
  source.start()

  const rendered = await context.startRendering()
  return rendered.getChannelData(0)
}

function encodeWav(samples: Float32Array): Blob {
  const dataBytes = samples.length * BYTES_PER_SAMPLE
  const view = new DataView(new ArrayBuffer(WAV_HEADER_BYTES + dataBytes))

  const writeAscii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) {
      view.setUint8(offset + i, text.charCodeAt(i))
    }
  }

  writeAscii(0, 'RIFF')
  view.setUint32(4, WAV_HEADER_BYTES - 8 + dataBytes, true)
  writeAscii(8, 'WAVE')
  writeAscii(12, 'fmt ')
  view.setUint32(16, 16, true) // size of this section
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, TARGET_SAMPLE_RATE, true)
  view.setUint32(28, TARGET_SAMPLE_RATE * BYTES_PER_SAMPLE, true) // bytes per second
  view.setUint16(32, BYTES_PER_SAMPLE, true) // bytes per frame
  view.setUint16(34, BYTES_PER_SAMPLE * 8, true) // bits per sample
  writeAscii(36, 'data')
  view.setUint32(40, dataBytes, true)

  samples.forEach((sample, i) => {
    const clamped = Math.max(-1, Math.min(1, sample))
    view.setInt16(WAV_HEADER_BYTES + i * BYTES_PER_SAMPLE, clamped * 32767, true)
  })

  return new Blob([view], { type: 'audio/wav' })
}

/** Converts raw microphone samples to a 16 kHz, mono, 16-bit WAV. */
export async function toWav(samples: Float32Array, sampleRate: number): Promise<Blob> {
  return encodeWav(await resampleTo16kHz(samples, sampleRate))
}
