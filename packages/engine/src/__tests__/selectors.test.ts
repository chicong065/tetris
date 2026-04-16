/**
 * Tests for the read-only selectors over GameState: ghost-piece geometry,
 * spawn-orientation piece previews, and the phase predicates used by the
 * UI to branch on playing / paused / menu / gameOver / clearing / finished.
 */

import { createEmptyBoard } from '@engine/board'
import {
  getGhostY,
  getGhostCells,
  getPiecePreview,
  isPlaying,
  isPaused,
  isMenu,
  isGameOver,
  isClearing,
  isFinished,
} from '@engine/selectors'
import { createEngine } from '@engine/store'
import type { GameState, Phase } from '@engine/types'
import { describe, it, expect } from 'vitest'

function withPhase(overrides: Partial<GameState> & { readonly phase: Phase }): GameState {
  return {
    mode: 'marathon',
    board: createEmptyBoard(),
    queue: [],
    bag: { shuffled: [], indexInShuffled: 0, rngState: 0 },
    active: null,
    hold: null,
    holdUsedThisTurn: false,
    score: 0,
    level: 1,
    lines: 0,
    combo: 0,
    backToBack: false,
    gravityAccumulatorMs: 0,
    lockDelayResetCount: 0,
    autoshift: { direction: 0, chargedMs: 0, arrAccumulatorMs: 0 },
    softDropping: false,
    elapsedMs: 0,
    piecesLocked: 0,
    rngSeed: 0,
    rngState: 0,
    durationMs: null,
    startLevel: 1,
    ...overrides,
  } as GameState
}

describe('selectors — phase predicates', () => {
  it('isPlaying matches only the playing phase', () => {
    expect(isPlaying(withPhase({ phase: { kind: 'playing' } }))).toBe(true)
    expect(isPlaying(withPhase({ phase: { kind: 'paused' } }))).toBe(false)
    expect(isPlaying(withPhase({ phase: { kind: 'menu' } }))).toBe(false)
  })

  it('isPaused matches only the paused phase', () => {
    expect(isPaused(withPhase({ phase: { kind: 'paused' } }))).toBe(true)
    expect(isPaused(withPhase({ phase: { kind: 'playing' } }))).toBe(false)
  })

  it('isMenu matches only the menu phase', () => {
    expect(isMenu(withPhase({ phase: { kind: 'menu' } }))).toBe(true)
    expect(isMenu(withPhase({ phase: { kind: 'playing' } }))).toBe(false)
  })

  it('isGameOver matches only the gameOver phase', () => {
    const phase: Phase = { kind: 'gameOver', reason: 'lockOut' }
    expect(isGameOver(withPhase({ phase }))).toBe(true)
    expect(isGameOver(withPhase({ phase: { kind: 'playing' } }))).toBe(false)
  })

  it('isClearing matches only the line-clear animation phase', () => {
    const phase: Phase = { kind: 'lineClearAnim', rows: [20], animMs: 0, tSpin: 'none' }
    expect(isClearing(withPhase({ phase }))).toBe(true)
    expect(isClearing(withPhase({ phase: { kind: 'playing' } }))).toBe(false)
  })

  it('isFinished matches every terminal phase (gameOver, sprintFinished, ultraFinished)', () => {
    expect(isFinished(withPhase({ phase: { kind: 'gameOver', reason: 'topOut' } }))).toBe(true)
    expect(isFinished(withPhase({ phase: { kind: 'sprintFinished', timeMs: 10_000 } }))).toBe(true)
    expect(isFinished(withPhase({ phase: { kind: 'ultraFinished', score: 0, timeMs: 120_000 } }))).toBe(true)
    expect(isFinished(withPhase({ phase: { kind: 'playing' } }))).toBe(false)
    expect(isFinished(withPhase({ phase: { kind: 'paused' } }))).toBe(false)
    expect(isFinished(withPhase({ phase: { kind: 'menu' } }))).toBe(false)
  })
})

describe('selectors — ghost piece geometry', () => {
  it('getGhostY returns null when there is no active piece', () => {
    const state = withPhase({ phase: { kind: 'menu' }, active: null })
    expect(getGhostY(state)).toBeNull()
  })

  it('getGhostY drops the active piece to the bottom of the empty board', () => {
    // Fresh engine, spawn a piece, then query.
    const engine = createEngine({ seed: 1 })
    engine.startGame({ mode: 'marathon' })
    const state = engine.getSnapshot()
    expect(state.active).not.toBeNull()
    const ghostY = getGhostY(state)
    expect(ghostY).not.toBeNull()
    // Ghost must be at or below the spawn Y.
    expect(ghostY!).toBeGreaterThanOrEqual(state.active!.y)
  })

  it('getGhostCells returns an empty array when no active piece', () => {
    const state = withPhase({ phase: { kind: 'menu' }, active: null })
    expect(getGhostCells(state)).toEqual([])
  })

  it('getGhostCells returns cells at the ghost landing position', () => {
    const engine = createEngine({ seed: 1 })
    engine.startGame({ mode: 'marathon' })
    const state = engine.getSnapshot()
    const cells = getGhostCells(state)
    // A tetromino has 4 cells; on an empty board the ghost must be below
    // the active piece, so we expect a non-empty list.
    expect(cells.length).toBe(4)
  })

  it('getGhostCells returns empty array when the active piece is already at landing', () => {
    // Place the active piece as far down as its footprint allows and
    // verify the ghost coincides with the active position — in that
    // case getGhostCells() short-circuits to an empty list.
    const engine = createEngine({ seed: 1 })
    engine.startGame({ mode: 'marathon' })
    const snapshot = engine.getSnapshot()
    const active = snapshot.active!
    // First ask the selector where the piece would land, then move the
    // active piece to that y so active.y === ghostY.
    const landed = getGhostY(snapshot)!
    const onFloor = withPhase({
      phase: { kind: 'playing' },
      active: { ...active, y: landed },
    })
    expect(getGhostY(onFloor)).toBe(onFloor.active!.y)
    expect(getGhostCells(onFloor)).toEqual([])
  })
})

describe('selectors — piece previews', () => {
  it('getPiecePreview returns spawn cells and tight bounding box for I', () => {
    const preview = getPiecePreview('I')
    // Spawn-orientation I occupies row 1 across columns 0..3 in a 4×4 box.
    expect(preview.widthCells).toBe(4)
    expect(preview.heightCells).toBe(1)
    expect(preview.minX).toBe(0)
    expect(preview.minY).toBe(1)
    expect(preview.cells.length).toBe(4)
  })

  it('getPiecePreview returns spawn cells and tight bounding box for O', () => {
    const preview = getPiecePreview('O')
    expect(preview.widthCells).toBe(2)
    expect(preview.heightCells).toBe(2)
    expect(preview.cells.length).toBe(4)
  })

  it('getPiecePreview returns spawn cells and tight bounding box for T', () => {
    const preview = getPiecePreview('T')
    expect(preview.widthCells).toBe(3)
    expect(preview.heightCells).toBe(2)
    expect(preview.cells.length).toBe(4)
  })

  it('getPiecePreview works for every piece kind', () => {
    for (const kind of ['I', 'O', 'T', 'S', 'Z', 'J', 'L'] as const) {
      const preview = getPiecePreview(kind)
      expect(preview.cells.length).toBe(4)
      expect(preview.widthCells).toBeGreaterThan(0)
      expect(preview.heightCells).toBeGreaterThan(0)
    }
  })
})
