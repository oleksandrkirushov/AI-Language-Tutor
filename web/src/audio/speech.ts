// Reads text aloud in the browser's system voices

import type { Language } from '../languages.ts'

const MAX_CHUNK_CHARS = 200 // Chrome can cut off long text in its network voices
const VOICES_TIMEOUT_MS = 2000 // Chrome lists its network voices first and local ones later

// macOS lists these effects alongside real voices
const NOVELTY_VOICES = new Set([
  'Albert',
  'Bad News',
  'Bahh',
  'Bells',
  'Boing',
  'Bubbles',
  'Cellos',
  'Good News',
  'Jester',
  'Organ',
  'Superstar',
  'Trinoids',
  'Whisper',
  'Wobble',
  'Zarvox',
])

// The clearest of the voices macOS includes by default, best first
const PREFERRED_VOICES = [
  'Samantha',
  'Daniel',
  'Karen',
  'Moira',
  'Tessa',
  'Lesya',
  'Mónica',
  'Paulina',
  'Anna',
  'Thomas',
  'Jacques',
  'Alice',
  'Zosia',
]

// Keeps utterances referenced while they play: Chrome can otherwise drop them and never fire "end"
const activeUtterances = new Set<SpeechSynthesisUtterance>()

// Set once waiting for local voices is over, so a system without any only waits once
let voicesSettled = false

function splitLongSentence(sentence: string): string[] {
  if (sentence.length <= MAX_CHUNK_CHARS) {
    return [sentence]
  }

  const chunks: string[] = []
  let chunk = ''
  for (const part of sentence.split(/(?<=[,;:—])\s+/)) {
    if (chunk && chunk.length + part.length + 1 > MAX_CHUNK_CHARS) {
      chunks.push(chunk)
      chunk = part
    } else {
      chunk = chunk ? `${chunk} ${part}` : part
    }
  }
  chunks.push(chunk)
  return chunks
}

/** Splits text into pieces short enough to speak one at a time, without losing any words. */
export function splitIntoChunks(text: string): string[] {
  const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' })
  return [...segmenter.segment(text.replace(/[*_#`]/g, ''))]
    .map(({ segment }) => segment.trim())
    .filter((sentence) => /[\p{L}\p{N}]/u.test(sentence))
    .flatMap(splitLongSentence)
}

/**
 * Chooses the language by which alphabet most of the letters are in. Two languages that
 * share an alphabet can't be told apart this way, so those pieces use the target language.
 */
export function chooseLanguage(chunk: string, target: Language, native: Language): string {
  const cyrillic = chunk.match(/\p{Script=Cyrillic}/gu)?.length ?? 0
  const latin = chunk.match(/\p{Script=Latin}/gu)?.length ?? 0
  const script = cyrillic > latin ? 'Cyrillic' : 'Latin'
  return native.script !== target.script && script === native.script ? native.code : target.code
}

/** Picks the best voice for a language, preferring ones that run on this computer. */
export function pickVoice(
  voices: SpeechSynthesisVoice[],
  lang: string,
): SpeechSynthesisVoice | undefined {
  const score = (voice: SpeechSynthesisVoice) => {
    const preferredIndex = PREFERRED_VOICES.indexOf(voice.name)
    const preferredRank = preferredIndex === -1 ? 0 : PREFERRED_VOICES.length - preferredIndex
    return (voice.localService ? 100 : 0) + preferredRank * 2 + (voice.default ? 1 : 0)
  }

  return voices
    .filter(
      (voice) =>
        voice.lang.replace('_', '-').toLowerCase().split('-')[0] === lang &&
        !NOVELTY_VOICES.has(voice.name),
    )
    .sort((a, b) => score(b) - score(a))[0]
}

function loadVoices(synth: SpeechSynthesis): Promise<SpeechSynthesisVoice[]> {
  const hasLocalVoice = () => synth.getVoices().some((voice) => voice.localService)
  if (voicesSettled || hasLocalVoice()) {
    return Promise.resolve(synth.getVoices())
  }

  return new Promise((resolve) => {
    const finish = () => {
      voicesSettled = true
      window.clearTimeout(timer)
      synth.removeEventListener('voiceschanged', handleChange)
      resolve(synth.getVoices())
    }
    const handleChange = () => {
      if (hasLocalVoice()) {
        finish()
      }
    }
    const timer = window.setTimeout(finish, VOICES_TIMEOUT_MS)
    synth.addEventListener('voiceschanged', handleChange)
  })
}

function speakChunk(
  synth: SpeechSynthesis,
  utterance: SpeechSynthesisUtterance,
  signal: AbortSignal,
): Promise<boolean> {
  return new Promise((resolve) => {
    const finish = (spoken: boolean) => {
      activeUtterances.delete(utterance)
      signal.removeEventListener('abort', handleAbort)
      resolve(spoken)
    }
    const handleAbort = () => {
      synth.cancel()
      finish(true)
    }

    utterance.onend = () => finish(true)
    utterance.onerror = (event) => finish(event.error === 'canceled' || event.error === 'interrupted')
    signal.addEventListener('abort', handleAbort)

    activeUtterances.add(utterance)
    synth.speak(utterance)
  })
}

/**
 * Reads text aloud one piece at a time, until it ends or the signal aborts.
 * Resolves to false if any piece could not be spoken.
 */
export async function speakText(
  text: string,
  target: Language,
  native: Language,
  signal: AbortSignal,
): Promise<boolean> {
  const synth = window.speechSynthesis
  if (!synth) {
    return false
  }

  const voices = await loadVoices(synth)
  synth.cancel() // clears anything left over from an earlier page load

  let allSpoken = true
  for (const chunk of splitIntoChunks(text)) {
    if (signal.aborted) {
      break
    }
    const lang = chooseLanguage(chunk, target, native)
    const utterance = new SpeechSynthesisUtterance(chunk)
    utterance.lang = lang
    utterance.voice = pickVoice(voices, lang) ?? null

    // A failed piece doesn't stop the rest of the reply
    const spoken = await speakChunk(synth, utterance, signal)
    allSpoken = allSpoken && spoken
  }

  return allSpoken
}
