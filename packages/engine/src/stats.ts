/**
 * Pure read-only statistics over {@link GameState}. Every selector is
 * safe to call on a fresh/paused engine (no active piece, zero elapsed
 * time) and returns `0` rather than dividing by zero.
 */

import type { GameState } from '@engine/types'

/** Total elapsed play-time, expressed in whole seconds. */
export function getPlayTimeSeconds(state: GameState): number {
  return state.elapsedMs / 1000
}

/**
 * Pieces-per-second throughput: `lockCount / elapsedSeconds`. Returns `0`
 * on a fresh state so callers can render it without guarding.
 */
export function getPiecesPerSecond(state: GameState): number {
  if (state.elapsedMs <= 0) {
    return 0
  }
  const seconds = state.elapsedMs / 1000
  return state.lockCount / seconds
}

/** Lines-per-minute throughput: `lines * 60 / elapsedSeconds`. */
export function getLinesPerMinute(state: GameState): number {
  if (state.elapsedMs <= 0) {
    return 0
  }
  const seconds = state.elapsedMs / 1000
  return (state.lines * 60) / seconds
}
