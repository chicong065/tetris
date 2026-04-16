/**
 * Integration tests for the engine orchestrator: phase transitions,
 * piece spawn/hold/hardDrop flows, pause/resume, gravity, and listener
 * notifications.
 */

import { BOARD_HEIGHT, BOARD_WIDTH, VISIBLE_TOP } from '@engine/constants'
import { createEngine } from '@engine/store'
import type { Engine } from '@engine/store'
import type { Cell, Playfield } from '@engine/types'
import { describe, it, expect, vi } from 'vitest'

/** Blank playfield of the standard dimensions. */
function emptyBoard(): Cell[][] {
  const board: Cell[][] = []
  for (let row = 0; row < BOARD_HEIGHT; row += 1) {
    const cells: Cell[] = []
    for (let col = 0; col < BOARD_WIDTH; col += 1) {
      cells.push(null)
    }
    board.push(cells)
  }
  return board
}

/** Fills the vanish-zone rows so the first spawn immediately block-outs. */
function boardFillingSpawn(): Playfield {
  const board = emptyBoard()
  for (let row = VISIBLE_TOP - 4; row < VISIBLE_TOP; row += 1) {
    for (let col = 0; col < BOARD_WIDTH; col += 1) {
      board[row]![col] = 'I'
    }
  }
  return board
}

/** Ticks the engine forward in small slices, totalling `totalMs`. */
function advance(engine: Engine, totalMs: number, stepMs = 16): void {
  let remaining = totalMs
  while (remaining > 0) {
    const step = Math.min(stepMs, remaining)
    engine.tick(step)
    remaining -= step
  }
}

describe('engine store', () => {
  it('starts in menu phase', () => {
    const engine = createEngine({ seed: 1 })
    expect(engine.getSnapshot().phase.kind).toBe('menu')
  })

  it('startGame(marathon) spawns a piece and enters playing phase', () => {
    const engine = createEngine({ seed: 1 })
    engine.startGame({ mode: 'marathon' })
    const state = engine.getSnapshot()
    expect(state.phase.kind).toBe('playing')
    expect(state.active).not.toBeNull()
    expect(state.queue.length).toBeGreaterThanOrEqual(5)
  })

  it('hardDrop locks the piece and spawns the next', () => {
    const engine = createEngine({ seed: 1 })
    engine.startGame({ mode: 'marathon' })
    engine.dispatch({ kind: 'hardDrop' })
    engine.tick(1)
    const after = engine.getSnapshot()
    expect(after.active).not.toBeNull()
    expect(after.active!.kind).toBeDefined()
    // different piece than before (very likely with 7-bag)
    // at minimum, the piece is at spawn position again
    expect(after.active!.y).toBeLessThanOrEqual(20)
    // score increased from hard drop
    expect(after.score).toBeGreaterThan(0)
  })

  it('hold swaps the active piece', () => {
    const engine = createEngine({ seed: 1 })
    engine.startGame({ mode: 'marathon' })
    const firstPiece = engine.getSnapshot().active!.kind
    engine.dispatch({ kind: 'hold' })
    engine.tick(1)
    const state = engine.getSnapshot()
    expect(state.hold).toBe(firstPiece)
    expect(state.active!.kind).not.toBe(firstPiece)
    expect(state.holdUsedThisTurn).toBe(true)
  })

  it('hold is locked once per turn', () => {
    const engine = createEngine({ seed: 1 })
    engine.startGame({ mode: 'marathon' })
    engine.dispatch({ kind: 'hold' })
    engine.tick(1)
    const afterFirst = engine.getSnapshot().active!.kind
    engine.dispatch({ kind: 'hold' })
    engine.tick(1)
    expect(engine.getSnapshot().active!.kind).toBe(afterFirst)
  })

  it('subscribe fires when state changes', () => {
    const engine = createEngine({ seed: 1 })
    let notified = 0
    const unsubscribe = engine.subscribe(() => {
      notified += 1
    })
    engine.startGame({ mode: 'marathon' })
    expect(notified).toBeGreaterThan(0)
    unsubscribe()
  })

  it('pause and resume toggles phase', () => {
    const engine = createEngine({ seed: 1 })
    engine.startGame({ mode: 'marathon' })
    engine.dispatch({ kind: 'pause' })
    engine.tick(1)
    expect(engine.getSnapshot().phase.kind).toBe('paused')
    engine.dispatch({ kind: 'resume' })
    engine.tick(1)
    expect(engine.getSnapshot().phase.kind).toBe('playing')
  })

  it('gravity advances y over time', () => {
    const engine = createEngine({ seed: 1 })
    engine.startGame({ mode: 'marathon' })
    const startY = engine.getSnapshot().active!.y
    // Tick for 5 seconds, at level 1 (1s/row) piece should fall significantly
    for (let i = 0; i < 20; i += 1) {
      engine.tick(250)
    }
    const laterY = engine.getSnapshot().active!.y
    expect(laterY).toBeGreaterThan(startY)
  })

  it('soft drop does not teleport to landing position at high levels', () => {
    // Regression test: at a high level, base gravity is already fast, and
    // a naive `baseMs / softDropFactor` would produce a sub-millisecond
    // effective rate that drops many rows per tick (visible teleport).
    // The engine clamps soft drop to a minimum ms-per-row, capping the
    // maximum drop rate at roughly 50 cells/second regardless of level.
    const engine = createEngine({
      seed: 1,
      gravity: () => 10, // very fast gravity (would give 0.5 ms/row at SDF=20)
    })
    engine.startGame({ mode: 'marathon' })
    const startY = engine.getSnapshot().active!.y
    engine.dispatch({ kind: 'softDropPress' })

    // One frame at 60 fps. With the clamp at 20 ms/row (50 cells/s) this
    // should move at most ~1 row. Without the clamp it would slam the
    // piece down the entire board in one frame.
    engine.tick(16)
    const afterOneFrame = engine.getSnapshot().active!.y
    const rowsFallenInOneFrame = afterOneFrame - startY

    expect(rowsFallenInOneFrame).toBeLessThanOrEqual(2)
  })

  it('soft drop does not burst-fall when gravity accumulator was already large', () => {
    // Regression test for a carry-over bug: if the gravity accumulator
    // was near `baseMs` (e.g. piece had been sitting under normal gravity
    // almost a full drop-cell worth of time), pressing soft drop would
    // divide the accumulator by the smaller soft-drop effectiveMs and
    // release the built-up time as a multi-row jump on the next tick.
    const engine = createEngine({
      seed: 1,
      gravity: () => 500, // 500 ms per row under natural gravity
    })
    engine.startGame({ mode: 'marathon' })
    const startY = engine.getSnapshot().active!.y

    // Accumulate nearly a full natural-gravity cell (450 ms out of 500 ms).
    // No row has dropped yet.
    engine.tick(450)
    expect(engine.getSnapshot().active!.y).toBe(startY)

    // Now press soft drop. The 450 ms of accumulator, divided by the
    // clamped soft-drop effectiveMs (20 ms), would jump the piece by
    // ~22 rows on a single tick if the accumulator were not reset.
    engine.dispatch({ kind: 'softDropPress' })
    engine.tick(16) // one 60 fps frame
    const afterOneFrame = engine.getSnapshot().active!.y

    expect(afterOneFrame - startY).toBeLessThanOrEqual(2)
  })
})

describe('engine lifecycle + configuration', () => {
  it('configure() swaps settings at runtime without restarting', () => {
    const engine = createEngine({ seed: 1 })
    engine.startGame({ mode: 'marathon' })
    engine.configure({ dasMs: 50, arrMs: 10, softDropFactor: 10 })
    engine.moveLeft()
    engine.tick(100)
    expect(engine.getSnapshot().phase.kind).toBe('playing')
  })

  it('destroy() detaches listeners and event handlers', () => {
    const engine = createEngine({ seed: 1 })
    engine.startGame({ mode: 'marathon' })
    const subscriber = vi.fn()
    const lockHandler = vi.fn()
    engine.subscribe(subscriber)
    engine.on('pieceLock', lockHandler)
    subscriber.mockClear()
    engine.destroy()
    engine.hardDrop()
    engine.tick(100)
    expect(subscriber).not.toHaveBeenCalled()
    expect(lockHandler).not.toHaveBeenCalled()
  })

  it('restore option seeds the engine with a serialized snapshot', () => {
    const original = createEngine({ seed: 1 })
    original.startGame({ mode: 'marathon' })
    original.tick(16)
    const serialized = original.serialize()
    const restored = createEngine({ restore: serialized })
    expect(restored.getSnapshot().lockCount).toBe(serialized.state.lockCount)
    expect(restored.getSnapshot().mode).toBe(serialized.state.mode)
  })
})

describe('engine input dispatch branches', () => {
  it('dispatches ccw and 180 rotations', () => {
    const engine = createEngine({ seed: 1 })
    engine.startGame({ mode: 'marathon' })
    engine.tick(16)
    expect(() => engine.rotate('ccw')).not.toThrow()
    expect(() => engine.rotate('180')).not.toThrow()
    engine.tick(16)
  })

  it('exercises moveRightPress/release and softDrop release flows', () => {
    const engine = createEngine({ seed: 1 })
    engine.startGame({ mode: 'marathon' })
    engine.tick(16)
    engine.moveRight()
    engine.tick(16)
    engine.releaseMoveRight()
    engine.moveLeft()
    engine.tick(16)
    engine.releaseMoveLeft()
    engine.softDrop()
    engine.tick(16)
    engine.releaseSoftDrop()
    engine.tick(16)
    expect(engine.getSnapshot().phase.kind).toBe('playing')
  })

  it('move + rotate while grounded exercise the touching branches', () => {
    // Preset a nearly-full playfield so the piece lands almost
    // immediately, then shuffle / rotate on top of the stack. This
    // forces tryMove/tryRotate to hit their `touching → resetLockOnMove`
    // branches (new position is already on the ground).
    const preset = emptyBoard()
    for (let row = VISIBLE_TOP + 2; row < BOARD_HEIGHT; row += 1) {
      for (let col = 0; col < BOARD_WIDTH; col += 1) {
        preset[row]![col] = 'I'
      }
    }
    const engine = createEngine({ seed: 1 })
    engine.startGame({ mode: 'marathon', presetBoard: preset })
    // Let the piece descend to the top of the stack.
    advance(engine, 200)
    // Shuffle + rotate while grounded.
    for (let attempt = 0; attempt < 4; attempt += 1) {
      engine.moveLeft()
      engine.tick(16)
      engine.moveRight()
      engine.tick(16)
      engine.rotate('cw')
      engine.tick(16)
    }
    advance(engine, 2000)
    // The game either locked and moved on, or went to gameOver as rows
    // stack higher. Either way the touching branches were exercised.
    expect(['playing', 'lineClearAnim', 'gameOver']).toContain(engine.getSnapshot().phase.kind)
  })
})

describe('engine hold-swap', () => {
  it('swaps with an existing held piece across turns', () => {
    // First lock: fill the hold slot. Next turn: holding swaps back.
    const engine = createEngine({ seed: 1 })
    engine.startGame({ mode: 'marathon' })
    // Turn 1: fill hold.
    engine.hold()
    engine.tick(16)
    const firstHeld = engine.getSnapshot().hold
    expect(firstHeld).not.toBeNull()
    // Hard-drop to end the turn.
    engine.hardDrop()
    engine.tick(16)
    // Turn 2: holdUsedThisTurn is reset; holding again swaps with
    // state.hold !== null so the `swap-existing` branch runs.
    engine.hold()
    engine.tick(16)
    // The previously-held piece is now active; the new hold is the
    // piece that was active when we called hold on turn 2.
    expect(engine.getSnapshot().hold).not.toBe(firstHeld)
  })
})

describe('engine phase gating', () => {
  it('drops inputs while paused, accepts resume to re-enter playing', () => {
    const engine = createEngine({ seed: 1 })
    engine.startGame({ mode: 'marathon' })
    engine.pause()
    engine.tick(16)
    expect(engine.getSnapshot().phase.kind).toBe('paused')
    const pausedX = engine.getSnapshot().active!.x
    engine.moveLeft()
    engine.moveRight()
    engine.rotate('cw')
    engine.hold()
    engine.tick(16)
    expect(engine.getSnapshot().active!.x).toBe(pausedX)
    engine.resume()
    engine.tick(16)
    expect(engine.getSnapshot().phase.kind).toBe('playing')
  })

  it('pause → resume → pause → resume flows through commit cleanly', () => {
    const engine = createEngine({ seed: 1 })
    engine.startGame({ mode: 'marathon' })
    engine.pause()
    engine.tick(4)
    engine.resume()
    engine.tick(4)
    engine.pause()
    engine.tick(4)
    engine.resume()
    engine.tick(4)
    expect(engine.getSnapshot().phase.kind).toBe('playing')
  })

  it('drops inputs while the line-clear animation is running', () => {
    // Preset a nearly-full bottom row so any I-piece at x=0 clears it.
    const preset = emptyBoard()
    for (let col = 4; col < BOARD_WIDTH; col += 1) {
      preset[BOARD_HEIGHT - 1]![col] = 'I'
    }
    // Try seeds until we trigger a line clear mid-animation.
    for (let trySeed = 1; trySeed < 50; trySeed += 1) {
      const engine = createEngine({ seed: trySeed })
      engine.startGame({ mode: 'marathon', presetBoard: preset })
      for (let attempt = 0; attempt < BOARD_WIDTH; attempt += 1) {
        engine.moveLeft()
      }
      engine.tick(16)
      engine.hardDrop()
      engine.tick(16)
      if (engine.getSnapshot().phase.kind === 'lineClearAnim') {
        // Inputs while animating are swallowed.
        engine.moveLeft()
        engine.rotate('cw')
        engine.hold()
        engine.tick(16)
        expect(engine.getSnapshot().phase.kind).toBe('lineClearAnim')
        advance(engine, 700)
        expect(engine.getSnapshot().phase.kind).toBe('playing')
        return
      }
    }
  })
})

describe('engine natural lock-delay expiry', () => {
  it('locks the piece automatically after the lock-delay grace window', () => {
    // Soft-drop to the floor, then wait for the 500ms lock timer.
    const engine = createEngine({ seed: 1 })
    engine.startGame({ mode: 'marathon' })
    engine.softDrop()
    advance(engine, 1500)
    expect(engine.getSnapshot().lockCount).toBeGreaterThanOrEqual(1)
  })
})

describe('engine line-clear flow', () => {
  it('fires lineClear + advances the animation on a plugged row', () => {
    // Retry seeds until an I-piece lands first and plugs the 4-cell gap.
    const preset = emptyBoard()
    for (let col = 4; col < BOARD_WIDTH; col += 1) {
      preset[BOARD_HEIGHT - 1]![col] = 'I'
    }
    for (let trySeed = 1; trySeed < 50; trySeed += 1) {
      let clearFired = false
      const engine = createEngine({ seed: trySeed })
      engine.on('lineClear', (info) => {
        if (info.lines > 0) {
          clearFired = true
        }
      })
      engine.startGame({ mode: 'marathon', presetBoard: preset })
      for (let attempt = 0; attempt < BOARD_WIDTH; attempt += 1) {
        engine.moveLeft()
      }
      engine.tick(16)
      engine.hardDrop()
      advance(engine, 700)
      if (clearFired) {
        expect(engine.getSnapshot().phase.kind).toBe('playing')
        return
      }
    }
  })
})

describe('engine block-out handling', () => {
  it('Marathon enters gameOver when spawn collides with the preset board', () => {
    const engine = createEngine({ seed: 1 })
    engine.startGame({ mode: 'marathon', presetBoard: boardFillingSpawn() })
    expect(engine.getSnapshot().phase.kind).toBe('gameOver')
  })

  it('Zen stays alive even when spawn collides, via the top-row rescue', () => {
    const engine = createEngine({ seed: 1 })
    engine.startGame({ mode: 'zen', presetBoard: boardFillingSpawn() })
    expect(engine.getSnapshot().phase.kind).not.toBe('gameOver')
    advance(engine, 1000)
    expect(engine.getSnapshot().phase.kind).not.toBe('gameOver')
  })

  it('hold during a blocked state short-circuits (zen rescue path)', () => {
    const engine = createEngine({ seed: 1 })
    engine.startGame({ mode: 'zen', presetBoard: boardFillingSpawn() })
    advance(engine, 200)
    engine.hold()
    advance(engine, 400)
    expect(engine.getSnapshot().phase.kind).not.toBe('gameOver')
  })
})
