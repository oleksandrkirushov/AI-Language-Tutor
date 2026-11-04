import type { ChangeEvent } from 'react'
import { type Settings, SILENCE_OPTIONS } from '../hooks/useSettings.ts'
import { LANGUAGES } from '../languages.ts'

interface SettingsPanelProps {
  settings: Settings
  disabled: boolean
  onChange: (changes: Partial<Settings>) => void
}

function SettingsPanel({ settings, disabled, onChange }: SettingsPanelProps) {
  // Leaves the list after a choice, so the next Space records instead of reopening it
  const choose = (event: ChangeEvent<HTMLSelectElement>, changes: Partial<Settings>) => {
    event.currentTarget.blur()
    onChange(changes)
  }

  return (
    <form className="settings">
      <label>
        Learning
        <select
          value={settings.targetCode}
          disabled={disabled}
          onChange={(event) => choose(event, { targetCode: event.target.value })}
        >
          {LANGUAGES.map(({ code, name }) => (
            <option key={code} value={code} disabled={code === settings.nativeCode}>
              {name}
            </option>
          ))}
        </select>
      </label>

      <label>
        Your language
        <select
          value={settings.nativeCode}
          disabled={disabled}
          onChange={(event) => choose(event, { nativeCode: event.target.value })}
        >
          {LANGUAGES.map(({ code, name }) => (
            <option key={code} value={code} disabled={code === settings.targetCode}>
              {name}
            </option>
          ))}
        </select>
      </label>

      <label>
        Space key
        <select
          value={settings.holdToTalk ? 'hold' : 'press'}
          disabled={disabled}
          onChange={(event) => choose(event, { holdToTalk: event.target.value === 'hold' })}
        >
          <option value="press">Press once</option>
          <option value="hold">Hold down</option>
        </select>
      </label>

      <label>
        Pause to finish
        <select
          value={settings.silenceSeconds}
          disabled={disabled || settings.holdToTalk}
          onChange={(event) => choose(event, { silenceSeconds: Number(event.target.value) })}
        >
          {SILENCE_OPTIONS.map((seconds) => (
            <option key={seconds} value={seconds}>
              {seconds} s
            </option>
          ))}
        </select>
      </label>
    </form>
  )
}

export default SettingsPanel
