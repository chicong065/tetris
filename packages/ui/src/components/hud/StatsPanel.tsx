/**
 * Stats panel. The list of rows is computed each frame from the current
 * {@link GameState} — mode-specific (level is Marathon only, TIME
 * becomes a countdown in Ultra) and conditional (combo / B2B rows only
 * appear when active). PPS and LPM selectors come from the engine.
 */

import type { GameState } from '@tetris/engine'
import { getPiecesPerSecond, getLinesPerMinute } from '@tetris/engine'

import { HudPanel } from '@/components/hud/HudPanel'
import { formatTime, padScore, padLevel, padLines } from '@/format'
import { STATS_X, STATS_Y, STATS_W, STAT_ROW_H } from '@/render/layout'

/** Threshold (ms) below which the Ultra countdown turns accent-coloured. */
const ULTRA_LOW_TIME_MS = 10_000

type StatRow = {
  readonly label: string
  readonly value: string
  readonly highlight?: boolean
}

function buildTimeRow(state: GameState): StatRow {
  if (state.mode === 'ultra' && state.durationMs != null) {
    const remainingMs = Math.max(0, state.durationMs - state.elapsedMs)
    return {
      label: 'TIME',
      value: formatTime(remainingMs),
      highlight: remainingMs < ULTRA_LOW_TIME_MS,
    }
  }
  return { label: 'TIME', value: formatTime(state.elapsedMs) }
}

function buildStatRows(state: GameState): StatRow[] {
  const rows: StatRow[] = [{ label: 'SCORE', value: padScore(state.score) }]
  if (state.mode === 'marathon') {
    rows.push({ label: 'LEVEL', value: padLevel(state.level) })
  }
  rows.push({ label: 'LINES', value: padLines(state.lines) })
  rows.push(buildTimeRow(state))
  rows.push({ label: 'PPS', value: getPiecesPerSecond(state).toFixed(1) })
  rows.push({ label: 'LPM', value: getLinesPerMinute(state).toFixed(0) })
  if (state.combo > 0) {
    rows.push({ label: 'COMBO', value: state.combo.toString(), highlight: true })
  }
  if (state.backToBack) {
    rows.push({ label: 'B2B', value: 'x1.5', highlight: true })
  }
  return rows
}

export function StatsPanel({ state }: { readonly state: GameState }) {
  const rows = buildStatRows(state)
  const panelHeight = rows.length * STAT_ROW_H
  return (
    <HudPanel x={STATS_X} y={STATS_Y} width={STATS_W} height={panelHeight}>
      <ul className="stats-rows">
        {rows.map((row) => (
          <li key={row.label} className="stats-row" style={{ height: STAT_ROW_H }}>
            <span className="stats-label">{row.label}</span>
            <span className={row.highlight ? 'stats-value highlight' : 'stats-value'}>{row.value}</span>
          </li>
        ))}
      </ul>
    </HudPanel>
  )
}
