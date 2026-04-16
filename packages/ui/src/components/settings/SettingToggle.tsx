/**
 * Pixel-styled two-cell ON/OFF toggle. Occupies the same row width as
 * a {@link SettingSlider} so boolean settings align with numeric ones.
 */

export type SettingToggleProps = {
  readonly label: string
  readonly value: boolean
  readonly onChange: (nextValue: boolean) => void
}

export function SettingToggle({ label, value, onChange }: SettingToggleProps) {
  const onClassName = value ? 'settings-toggle-cell is-active' : 'settings-toggle-cell'
  const offClassName = !value ? 'settings-toggle-cell is-active' : 'settings-toggle-cell'
  return (
    <div className="settings-row">
      <span className="settings-label">{label}</span>
      <div className="settings-toggle" role="group" aria-label={label}>
        <button type="button" className={onClassName} aria-pressed={value} onClick={() => onChange(true)}>
          ON
        </button>
        <button type="button" className={offClassName} aria-pressed={!value} onClick={() => onChange(false)}>
          OFF
        </button>
      </div>
      <span className="settings-value" aria-hidden="true" />
    </div>
  )
}
