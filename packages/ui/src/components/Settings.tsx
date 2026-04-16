/**
 * Settings screen. Lets the player tune handling (DAS / ARR / soft-drop
 * factor), audio (master enable, SFX, music volumes), and accessibility
 * (reduced motion). Each change is persisted immediately so the user
 * can preview effects by backing out to a game.
 */

import { useState } from 'react'

import { SettingSlider } from '@/components/settings/SettingSlider'
import { SettingToggle } from '@/components/settings/SettingToggle'
import { loadSettings, saveSettings, DEFAULT_SETTINGS } from '@/storage/persist'
import type { StoredSettings } from '@/storage/schema'

const VOLUME_PERCENT_MAX = 100
const DAS_MS_MAX = 500
const ARR_MS_MAX = 100
const SOFT_DROP_FACTOR_MIN = 1
const SOFT_DROP_FACTOR_MAX = 50

/** Props for {@link Settings}: the callback that returns the user to the menu. */
export type SettingsProps = {
  readonly onClose: () => void
}

/** Settings dialog. Changes persist to localStorage as the user adjusts them. */
export function Settings({ onClose }: SettingsProps) {
  const [settings, setSettings] = useState<StoredSettings>(() => loadSettings())

  function updateSetting<Key extends keyof StoredSettings>(key: Key, value: StoredSettings[Key]): void {
    const nextSettings = { ...settings, [key]: value }
    setSettings(nextSettings)
    saveSettings(nextSettings)
  }

  function resetToDefaults(): void {
    setSettings(DEFAULT_SETTINGS)
    saveSettings(DEFAULT_SETTINGS)
  }

  return (
    <div className="settings" role="dialog" aria-label="Settings">
      <h2 className="settings-title screen-title">SETTINGS</h2>

      <section className="settings-section settings-section-handling">
        <h3>HANDLING</h3>
        <SettingSlider
          label="DAS (ms)"
          value={settings.dasMs}
          min={0}
          max={DAS_MS_MAX}
          step={1}
          onChange={(value) => updateSetting('dasMs', value)}
        />
        <SettingSlider
          label="ARR (ms)"
          value={settings.arrMs}
          min={0}
          max={ARR_MS_MAX}
          step={1}
          onChange={(value) => updateSetting('arrMs', value)}
        />
        <SettingSlider
          label="Soft drop x"
          value={settings.softDropFactor}
          min={SOFT_DROP_FACTOR_MIN}
          max={SOFT_DROP_FACTOR_MAX}
          step={1}
          onChange={(value) => updateSetting('softDropFactor', value)}
        />
      </section>

      <section className="settings-section settings-section-audio">
        <h3>AUDIO</h3>
        <SettingToggle
          label="Enabled"
          value={settings.audioEnabled}
          onChange={(value) => updateSetting('audioEnabled', value)}
        />
        <SettingSlider
          label="SFX"
          value={Math.round(settings.sfxVolume * VOLUME_PERCENT_MAX)}
          min={0}
          max={VOLUME_PERCENT_MAX}
          step={1}
          onChange={(value) => updateSetting('sfxVolume', value / VOLUME_PERCENT_MAX)}
        />
        <SettingSlider
          label="Music"
          value={Math.round(settings.musicVolume * VOLUME_PERCENT_MAX)}
          min={0}
          max={VOLUME_PERCENT_MAX}
          step={1}
          onChange={(value) => updateSetting('musicVolume', value / VOLUME_PERCENT_MAX)}
        />
        <p className="settings-credit">
          TRACK: ARPANAUTS BY ERIC SKIFF
          <br />
          LICENSED{' '}
          <a href="https://ericskiff.com/music/" target="_blank" rel="noreferrer">
            CC BY 4.0
          </a>
        </p>
      </section>

      <section className="settings-section settings-section-access">
        <h3>ACCESSIBILITY</h3>
        <SettingToggle
          label="Reduced motion"
          value={settings.reducedMotion}
          onChange={(value) => updateSetting('reducedMotion', value)}
        />
      </section>

      <div className="settings-actions">
        <button type="button" onClick={resetToDefaults} className="btn btn-secondary">
          Reset defaults
        </button>
        <button type="button" onClick={onClose} className="btn btn-primary">
          Back to menu
        </button>
      </div>
    </div>
  )
}
