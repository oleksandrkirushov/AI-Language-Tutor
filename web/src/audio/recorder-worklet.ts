// Runs on the audio thread and sends the microphone samples to useRecorder in batches

const BATCH_FRAMES = 512 // small, so little audio is lost when recording stops mid-batch

class RecorderProcessor extends AudioWorkletProcessor {
  private batch = new Float32Array(BATCH_FRAMES)
  private filled = 0

  process(inputs: Float32Array[][]): boolean {
    const channel = inputs[0]?.[0]
    if (!channel) {
      return true
    }

    let offset = 0
    while (offset < channel.length) {
      const count = Math.min(channel.length - offset, BATCH_FRAMES - this.filled)
      this.batch.set(channel.subarray(offset, offset + count), this.filled)
      this.filled += count
      offset += count

      if (this.filled === BATCH_FRAMES) {
        this.port.postMessage(this.batch, [this.batch.buffer])
        this.batch = new Float32Array(BATCH_FRAMES)
        this.filled = 0
      }
    }
    return true
  }
}

registerProcessor('recorder', RecorderProcessor)
