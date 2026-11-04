import { useCallback, useState } from 'react'
import { findLanguage } from '../languages.ts'

export interface Settings {
  targetCode: string
  nativeCode: string
  silenceSeconds: number
  holdToTalk: boolean
}

export const SILENCE_OPTIONS = [1, 1.5, 2, 3, 4, 5]

const STORAGE_KEY = 'tutor-settings'
const DEFAULT_SETTINGS: Settings = {
  targetCode: 'en',
  nativeCode: 'uk',
  silenceSeconds: 2,
  holdToTalk: false,
}

// Browser storage can be blocked or hold old values, so nothing here may break the page
function loadSettings(): Settings {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<Settings>
    const targetCode = findLanguage(saved.targetCode ?? '') ? saved.targetCode : undefined
    const nativeCode = findLanguage(saved.nativeCode ?? '') ? saved.nativeCode : undefined
    return {
      targetCode: targetCode ?? DEFAULT_SETTINGS.targetCode,
      nativeCode: nativeCode ?? DEFAULT_SETTINGS.nativeCode,
      silenceSeconds: SILENCE_OPTIONS.includes(saved.silenceSeconds ?? NaN)
        ? (saved.silenceSeconds as number)
        : DEFAULT_SETTINGS.silenceSeconds,
      holdToTalk: saved.holdToTalk === true,
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

function saveSettings(settings: Settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // The settings still apply until the page is closed
  }
}

export function useSettings() {
  const [settings, setSettings] = useState(loadSettings)

  const updateSettings = useCallback(
    (changes: Partial<Settings>) => {
      const updated = { ...settings, ...changes }
      setSettings(updated)
      saveSettings(updated)
    },
    [settings],
  )

  return { settings, updateSettings }
}
