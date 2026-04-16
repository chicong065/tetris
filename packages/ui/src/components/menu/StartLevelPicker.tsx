/**
 * Small stepper control for selecting Marathon's starting level.
 * Docked on the right of the Marathon mode row; stops click events
 * from propagating so clicking the picker doesn't also start the game.
 */

import type { MouseEvent } from 'react'

/** Min/max starting level for Marathon. */
export const MIN_START_LEVEL = 1
export const MAX_START_LEVEL = 20

/** Clamps any numeric input to the accepted start-level range. */
export function clampStartLevel(candidate: number): number {
  if (!Number.isFinite(candidate)) {
    return MIN_START_LEVEL
  }
  const asInteger = Math.round(candidate)
  if (asInteger < MIN_START_LEVEL) {
    return MIN_START_LEVEL
  }
  if (asInteger > MAX_START_LEVEL) {
    return MAX_START_LEVEL
  }
  return asInteger
}

function stopPropagation(event: MouseEvent): void {
  event.stopPropagation()
}

export type StartLevelPickerProps = {
  readonly startLevel: number
  readonly onChange: (nextLevel: number) => void
}

export function StartLevelPicker({ startLevel, onChange }: StartLevelPickerProps) {
  const isAtMin = startLevel <= MIN_START_LEVEL
  const isAtMax = startLevel >= MAX_START_LEVEL
  return (
    <div className="menu-mode-level" role="group" aria-label="Marathon starting level" onClick={stopPropagation}>
      <span className="menu-mode-level-label">LV</span>
      <button
        type="button"
        className="menu-mode-level-step"
        aria-label="Decrease start level"
        onClick={() => onChange(startLevel - 1)}
        disabled={isAtMin}
      >
        &lt;
      </button>
      <span className="menu-mode-level-value">{startLevel}</span>
      <button
        type="button"
        className="menu-mode-level-step"
        aria-label="Increase start level"
        onClick={() => onChange(startLevel + 1)}
        disabled={isAtMax}
      >
        &gt;
      </button>
    </div>
  )
}
