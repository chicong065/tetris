/**
 * Labelled range-input row used by every numeric setting. Three-column
 * grid so the label, range, and readout align across sibling rows.
 */

export type SettingSliderProps = {
  readonly label: string
  readonly value: number
  readonly min: number
  readonly max: number
  readonly step: number
  readonly onChange: (nextValue: number) => void
}

export function SettingSlider({ label, value, min, max, step, onChange }: SettingSliderProps) {
  return (
    <label className="settings-row">
      <span className="settings-label">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
      <span className="settings-value">{value}</span>
    </label>
  )
}
