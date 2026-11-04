// The same pause detection as record_until_silence in main.py

const BLOCK_SECONDS = 0.1 // size of the audio chunk we measure loudness on
const NOISE_MULTIPLIER = 3 // how many times louder than the background a voice must be
const MIN_THRESHOLD = 200 / 32768 // lower bound of the threshold, so rustling is ignored
const SILENCE_BLOCKS = 20 // 2 seconds of silence end the recording
const NO_SPEECH_BLOCKS = 80 // if nothing is said for 8 seconds, cancel the recording
const MAX_BLOCKS = 600 // recordings stop at 60 seconds

export const CALIBRATION_SECONDS = 0.5

/** Returns the voice loudness threshold for a sample of background noise. */
export function calibrateThreshold(noise: Float32Array): number {
  const squares = noise.reduce((total, sample) => total + sample * sample, 0)
  const noiseRms = noise.length > 0 ? Math.sqrt(squares / noise.length) : 0
  return Math.max(noiseRms * NOISE_MULTIPLIER, MIN_THRESHOLD)
}

export class SilenceDetector {
  heardSpeech = false

  private readonly threshold: number
  private readonly framesPerBlock: number
  private frames = 0
  private squares = 0
  private blocks = 0
  private silentBlocks = 0

  constructor(threshold: number, sampleRate: number) {
    this.threshold = threshold
    this.framesPerBlock = Math.round(BLOCK_SECONDS * sampleRate)
  }

  /** Feeds in new samples. Returns true once the recording should stop. */
  push(samples: Float32Array): boolean {
    for (const sample of samples) {
      this.squares += sample * sample
      this.frames += 1
      if (this.frames === this.framesPerBlock && this.finishBlock()) {
        return true
      }
    }
    return false
  }

  private finishBlock(): boolean {
    const blockRms = Math.sqrt(this.squares / this.frames)
    this.frames = 0
    this.squares = 0
    this.blocks += 1

    if (blockRms >= this.threshold) {
      this.heardSpeech = true
      this.silentBlocks = 0
    } else {
      this.silentBlocks += 1
    }

    return (
      this.blocks >= MAX_BLOCKS ||
      this.silentBlocks >= (this.heardSpeech ? SILENCE_BLOCKS : NO_SPEECH_BLOCKS)
    )
  }
}
