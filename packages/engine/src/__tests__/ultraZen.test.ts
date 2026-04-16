/**
 * Tests for Ultra mode (timer-expiry transition) and Zen mode (block-out
 * suppression via top-row clear). These tests tick enough simulated time
 * to exercise each mode's end-condition branch.
 */

import { createEmptyBoard } from '@engine/board'
import { ultraFinishCheck } from '@engine/modes/ultra'
import { clearTopForZenSpawn } from '@engine/modes/zen'
import { createEngine } from '@engine/store'
import type { Cell, Playfield } from '@engine/types'
import { describe, it, expect } from 'vitest'

describe('ultra mode', () => {
  it('ultraFinishCheck flips at the duration boundary', () => {
    expect(ultraFinishCheck({ elapsedMs: 1000, durationMs: 5000 }).finished).toBe(false)
    const hit = ultraFinishCheck({ elapsedMs: 5100, durationMs: 5000 })
    expect(hit.finished).toBe(true)
    if (hit.finished) {
      expect(hit.timeMs).toBe(5000)
    }
  })

  it('transitions to ultraFinished when the timer expires', () => {
    const engine = createEngine({ seed: 1 })
    engine.startGame({ mode: 'ultra', durationMs: 2000 })
    // Tick past the duration in coarse slices.
    for (let index = 0; index < 30; index += 1) {
      engine.tick(100)
    }
    const snapshot = engine.getSnapshot()
    expect(snapshot.phase.kind).toBe('ultraFinished')
    if (snapshot.phase.kind === 'ultraFinished') {
      expect(snapshot.phase.timeMs).toBe(2000)
    }
  })

  it('fires ultraFinished event with the final score', () => {
    const engine = createEngine({ seed: 1 })
    let finalScore: number | null = null
    engine.on('ultraFinished', (payload) => {
      finalScore = payload.score
    })
    engine.startGame({ mode: 'ultra', durationMs: 1000 })
    for (let index = 0; index < 20; index += 1) {
      engine.tick(100)
    }
    expect(finalScore).not.toBeNull()
  })
})

describe('zen mode', () => {
  it('clearTopForZenSpawn wipes the upper rows', () => {
    const baseRow: Cell[] = Array.from({ length: 10 }, () => 'I' as Cell)
    const baseBoard: Playfield = Array.from({ length: 40 }, () => [...baseRow])
    const cleared = clearTopForZenSpawn(baseBoard)
    // Every cell above row 24 should be null; the bottom rows stay intact.
    expect(cleared[0]!.every((cell) => cell === null)).toBe(true)
    expect(cleared[23]!.every((cell) => cell === null)).toBe(true)
    expect(cleared[39]!.every((cell) => cell === 'I')).toBe(true)
  })

  it('does not transition to gameOver on a block-out spawn', () => {
    // Preset a board with cells in the spawn zone so the first piece
    // would normally block out.
    const empty = createEmptyBoard()
    const dirty: Cell[][] = []
    for (const row of empty) {
      dirty.push([...row])
    }
    for (let rowIndex = 19; rowIndex < 23; rowIndex += 1) {
      for (let columnIndex = 0; columnIndex < 10; columnIndex += 1) {
        dirty[rowIndex]![columnIndex] = 'I'
      }
    }
    const engine = createEngine({ seed: 1 })
    engine.startGame({ mode: 'zen', presetBoard: dirty })
    const snapshot = engine.getSnapshot()
    expect(snapshot.phase.kind).not.toBe('gameOver')
    expect(snapshot.phase.kind).toBe('playing')
  })
})
