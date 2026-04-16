/**
 * Unit tests for the stats selectors: PPS / LPM / play-time. Each is
 * safe at zero elapsed time and scales linearly otherwise.
 */

import { getPiecesPerSecond, getLinesPerMinute, getPlayTimeSeconds } from '@engine/stats'
import type { GameState } from '@engine/types'
import { describe, it, expect } from 'vitest'

function baseState(override: Partial<GameState>): GameState {
  return {
    mode: 'marathon',
    phase: { kind: 'playing' },
    board: [],
    active: null,
    hold: null,
    holdUsedThisTurn: false,
    bag: { seed: 0, upcoming: [] },
    queue: [],
    score: 0,
    level: 1,
    lines: 0,
    combo: -1,
    backToBack: false,
    elapsedMs: 0,
    lastClear: null,
    gravityAccumulatorMs: 0,
    autoshift: { direction: 0, chargedMs: 0, arrAccumulatorMs: 0 },
    softDropping: false,
    lockCount: 0,
    durationMs: null,
    ...override,
  }
}

describe('stats', () => {
  it('returns 0 when elapsedMs is zero', () => {
    const state = baseState({ elapsedMs: 0, lockCount: 10, lines: 40 })
    expect(getPiecesPerSecond(state)).toBe(0)
    expect(getLinesPerMinute(state)).toBe(0)
    expect(getPlayTimeSeconds(state)).toBe(0)
  })

  it('computes PPS from lockCount and elapsed seconds', () => {
    const state = baseState({ elapsedMs: 10_000, lockCount: 20 })
    expect(getPiecesPerSecond(state)).toBe(2)
  })

  it('computes LPM from lines and elapsed minutes', () => {
    const state = baseState({ elapsedMs: 30_000, lines: 60 })
    expect(getLinesPerMinute(state)).toBe(120)
  })

  it('getPlayTimeSeconds converts ms to seconds', () => {
    const state = baseState({ elapsedMs: 2500 })
    expect(getPlayTimeSeconds(state)).toBe(2.5)
  })
})
