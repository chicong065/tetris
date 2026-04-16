/**
 * Tests for {@link Engine.startGame} option handling: startLevel,
 * presetBoard, seed override, and durationMs.
 */

import { createEmptyBoard } from '@engine/board'
import { DEFAULT_ULTRA_DURATION_MS } from '@engine/modes/ultra'
import { createEngine } from '@engine/store'
import type { Cell, Playfield } from '@engine/types'
import { describe, it, expect } from 'vitest'

describe('startGame options', () => {
  it('startLevel sets the initial Marathon level', () => {
    const engine = createEngine({ seed: 1 })
    engine.startGame({ mode: 'marathon', startLevel: 5 })
    expect(engine.getSnapshot().level).toBe(5)
  })

  it('startLevel floors and clamps to at least 1', () => {
    const engine = createEngine({ seed: 1 })
    engine.startGame({ mode: 'marathon', startLevel: 0 })
    expect(engine.getSnapshot().level).toBe(1)
  })

  it('presetBoard seeds the starting board', () => {
    const baseBoard = createEmptyBoard()
    const preset: Cell[][] = []
    for (const row of baseBoard) {
      preset.push([...row])
    }
    preset[39]![0] = 'I'
    preset[39]![1] = 'I'
    const board: Playfield = preset
    const engine = createEngine({ seed: 1 })
    engine.startGame({ mode: 'marathon', presetBoard: board })
    const snapshot = engine.getSnapshot()
    expect(snapshot.board[39]![0]).toBe('I')
    expect(snapshot.board[39]![1]).toBe('I')
  })

  it('seed override produces a deterministic piece sequence', () => {
    const engineA = createEngine({ seed: 1 })
    engineA.startGame({ mode: 'marathon', seed: 99 })
    const engineB = createEngine({ seed: 2 })
    engineB.startGame({ mode: 'marathon', seed: 99 })
    expect(engineA.getSnapshot().active!.kind).toBe(engineB.getSnapshot().active!.kind)
    expect(engineA.getSnapshot().queue).toEqual(engineB.getSnapshot().queue)
  })

  it('Ultra mode defaults durationMs to the module constant', () => {
    const engine = createEngine({ seed: 1 })
    engine.startGame({ mode: 'ultra' })
    expect(engine.getSnapshot().durationMs).toBe(DEFAULT_ULTRA_DURATION_MS)
  })

  it('Ultra mode honours a custom durationMs', () => {
    const engine = createEngine({ seed: 1 })
    engine.startGame({ mode: 'ultra', durationMs: 30_000 })
    expect(engine.getSnapshot().durationMs).toBe(30_000)
  })
})
