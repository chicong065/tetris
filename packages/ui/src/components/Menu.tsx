/**
 * Main menu screen. Offers Marathon / Sprint / Ultra / Zen plus a
 * Settings row, displays the current best score for each mode, prints
 * the default key cheat sheet, and credits the author in the footer.
 * Marathon exposes a numeric start-level picker that is persisted to
 * settings.
 */

import type { GameMode } from '@tetris/engine'
import { useMemo, useState } from 'react'

import { CreditFooter } from '@/components/menu/CreditFooter'
import { KeyHintLegend } from '@/components/menu/KeyHintLegend'
import { ModeRow } from '@/components/menu/ModeRow'
import { StartLevelPicker, clampStartLevel } from '@/components/menu/StartLevelPicker'
import { TetrisTitle } from '@/components/menu/TetrisTitle'
import { formatTime, padScore } from '@/format'
import { loadHighScores, loadSettings, saveSettings } from '@/storage/persist'

/** Props for {@link Menu}. `onStart` chooses a mode; `onOpenSettings` opens options. */
export type MenuProps = {
  readonly onStart: (mode: GameMode, options?: { readonly startLevel?: number }) => void
  readonly onOpenSettings: () => void
}

/** Top-level menu with mode selection, high-score readouts, and key hints. */
export function Menu({ onStart, onOpenSettings }: MenuProps) {
  const highScores = useMemo(() => loadHighScores(), [])
  const initialSettings = useMemo(() => loadSettings(), [])
  const [startLevel, setStartLevel] = useState<number>(clampStartLevel(initialSettings.marathonStartLevel))

  const bestMarathon = highScores.marathon[0]
  const bestSprint = highScores.sprint[0]
  const bestUltra = highScores.ultra[0]
  const bestZen = highScores.zen[0]

  function persistStartLevel(nextLevel: number): void {
    const clamped = clampStartLevel(nextLevel)
    setStartLevel(clamped)
    const currentSettings = loadSettings()
    saveSettings({ ...currentSettings, marathonStartLevel: clamped })
  }

  function startMarathon(): void {
    persistStartLevel(startLevel)
    onStart('marathon', { startLevel })
  }

  const marathonSubtitle = bestMarathon ? `BEST ${bestMarathon.score.toLocaleString()}` : 'NO SCORE YET'
  const sprintSubtitle = bestSprint ? `BEST ${formatTime(bestSprint.timeMs)}` : 'NO TIME YET'
  const ultraSubtitle = bestUltra ? `BEST ${padScore(bestUltra.score)}` : 'NO SCORE YET'
  const zenSubtitle = bestZen ? `BEST ${bestZen.lines} LINES` : 'ENDLESS'

  return (
    <div className="panel menu" role="dialog" aria-label="Main menu">
      <TetrisTitle />

      <div className="menu-modes">
        <ModeRow className="menu-mode-marathon" name="MARATHON" subtitle={marathonSubtitle} onSelect={startMarathon}>
          <StartLevelPicker startLevel={startLevel} onChange={persistStartLevel} />
        </ModeRow>

        <ModeRow
          className="menu-mode-sprint"
          name="SPRINT 40"
          subtitle={sprintSubtitle}
          onSelect={() => onStart('sprint')}
        />

        <ModeRow
          className="menu-mode-ultra"
          name="ULTRA 2:00"
          subtitle={ultraSubtitle}
          onSelect={() => onStart('ultra')}
        />

        <ModeRow className="menu-mode-zen" name="ZEN" subtitle={zenSubtitle} onSelect={() => onStart('zen')} />

        <ModeRow
          className="menu-options-row"
          name="SETTINGS"
          subtitle="HANDLING · AUDIO · ACCESSIBILITY"
          onSelect={onOpenSettings}
        />
      </div>

      <KeyHintLegend />
      <CreditFooter />
    </div>
  )
}
