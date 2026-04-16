/**
 * Integration tests for the engine event emitter: pieceLock, lineClear,
 * gameOver, pause/resume, and reset events fire at the right moments and
 * with the right payloads.
 */

import { createEngine } from '@engine/store'
import { describe, it, expect } from 'vitest'

describe('engine events', () => {
  it('fires pieceLock after a hard drop', () => {
    const engine = createEngine({ seed: 1 })
    engine.startGame({ mode: 'marathon' })
    let locks = 0
    engine.on('pieceLock', () => {
      locks += 1
    })
    engine.dispatch({ kind: 'hardDrop' })
    engine.tick(1)
    expect(locks).toBe(1)
  })

  it('on() returns an unsubscribe that prevents later emissions', () => {
    const engine = createEngine({ seed: 1 })
    engine.startGame({ mode: 'marathon' })
    let locks = 0
    const unsubscribe = engine.on('pieceLock', () => {
      locks += 1
    })
    engine.dispatch({ kind: 'hardDrop' })
    engine.tick(1)
    expect(locks).toBe(1)
    unsubscribe()
    engine.dispatch({ kind: 'hardDrop' })
    engine.tick(1)
    expect(locks).toBe(1)
  })

  it('fires pause and resume events', () => {
    const engine = createEngine({ seed: 1 })
    engine.startGame({ mode: 'marathon' })
    let pauses = 0
    let resumes = 0
    engine.on('pause', () => {
      pauses += 1
    })
    engine.on('resume', () => {
      resumes += 1
    })
    engine.pause()
    engine.tick(1)
    engine.resume()
    engine.tick(1)
    expect(pauses).toBe(1)
    expect(resumes).toBe(1)
  })

  it('fires hold with previous and current kinds', () => {
    const engine = createEngine({ seed: 1 })
    engine.startGame({ mode: 'marathon' })
    const firstKind = engine.getSnapshot().active!.kind
    let payload: { previous: unknown; current: unknown } | null = null
    engine.on('hold', (event) => {
      payload = event
    })
    engine.hold()
    engine.tick(1)
    expect(payload).not.toBeNull()
    expect(payload!.previous).toBeNull()
    expect(payload!.current).toBe(firstKind)
  })

  it('fires reset when reset is dispatched', () => {
    const engine = createEngine({ seed: 1 })
    engine.startGame({ mode: 'marathon' })
    let resets = 0
    engine.on('reset', () => {
      resets += 1
    })
    engine.reset()
    engine.tick(1)
    expect(resets).toBe(1)
  })

  it('off() removes a specific handler', () => {
    const engine = createEngine({ seed: 1 })
    engine.startGame({ mode: 'marathon' })
    let locks = 0
    const handler = () => {
      locks += 1
    }
    engine.on('pieceLock', handler)
    engine.off('pieceLock', handler)
    engine.dispatch({ kind: 'hardDrop' })
    engine.tick(1)
    expect(locks).toBe(0)
  })

  it('fires pieceMove with direction left on a successful moveLeft', () => {
    const engine = createEngine({ seed: 1 })
    engine.startGame({ mode: 'marathon' })
    const moves: Array<{ direction: string }> = []
    engine.on('pieceMove', (payload) => {
      moves.push(payload)
    })
    engine.dispatch({ kind: 'moveLeftPress' })
    engine.tick(1)
    expect(moves.length).toBeGreaterThanOrEqual(1)
    expect(moves[0]!.direction).toBe('left')
  })

  it('fires pieceMove repeatedly while DAS auto-shift is active', () => {
    // DAS = 133 ms, ARR = 10 ms. Holding the key, then ticking ~250 ms should
    // produce one immediate move (on press) plus several ARR-driven moves.
    const engine = createEngine({ seed: 1 })
    engine.startGame({ mode: 'marathon' })
    let moveCount = 0
    engine.on('pieceMove', () => {
      moveCount += 1
    })
    // Press once, then tick enough real time to cross DAS and emit several
    // ARR shifts. The piece spawns near the centre and travels left without
    // hitting the wall for at least the first handful of shifts.
    engine.dispatch({ kind: 'moveLeftPress' })
    engine.tick(250)
    expect(moveCount).toBeGreaterThan(1)
  })

  it('fires pieceRotate with the requested direction on a successful rotation', () => {
    const engine = createEngine({ seed: 1 })
    engine.startGame({ mode: 'marathon' })
    const rotations: Array<{ direction: string }> = []
    engine.on('pieceRotate', (payload) => {
      rotations.push(payload)
    })
    engine.dispatch({ kind: 'rotateCW' })
    engine.tick(1)
    expect(rotations.length).toBe(1)
    expect(rotations[0]!.direction).toBe('cw')
  })

  it('fires pieceHardDrop with the cellsFallen count', () => {
    const engine = createEngine({ seed: 1 })
    engine.startGame({ mode: 'marathon' })
    const before = engine.getSnapshot().active!
    let payload: { cellsFallen: number } | null = null
    engine.on('pieceHardDrop', (event) => {
      payload = event
    })
    engine.dispatch({ kind: 'hardDrop' })
    engine.tick(1)
    expect(payload).not.toBeNull()
    // The piece falls from its spawn y to the floor on an empty board, so
    // cellsFallen should be a positive integer matching the actual drop.
    expect(payload!.cellsFallen).toBeGreaterThan(0)
    expect(Number.isInteger(payload!.cellsFallen)).toBe(true)
    // The first piece on the seeded board lands far below spawn.
    expect(payload!.cellsFallen).toBeGreaterThan(before.y - before.lowestY)
  })

  it('fires softDropRow while soft-drop is active and the piece advances', () => {
    const engine = createEngine({ seed: 1 })
    engine.startGame({ mode: 'marathon' })
    let softRows = 0
    engine.on('softDropRow', () => {
      softRows += 1
    })
    engine.dispatch({ kind: 'softDropPress' })
    // Soft drop floor in the engine is 20 ms/row, so 200 ms is ~10 rows.
    engine.tick(200)
    expect(softRows).toBeGreaterThan(0)
  })
})

describe('event emitter primitives', () => {
  it('off() for an event that has no subscribers is a no-op', async () => {
    const { createEventEmitter } = await import('@engine/events')
    const emitter = createEventEmitter()
    expect(() => {
      emitter.off('pieceLock', () => {})
    }).not.toThrow()
  })

  it('clear() drops every listener across every event', async () => {
    const { createEventEmitter } = await import('@engine/events')
    const emitter = createEventEmitter()
    let lockCount = 0
    let gameOverCount = 0
    emitter.on('pieceLock', () => {
      lockCount += 1
    })
    emitter.on('gameOver', () => {
      gameOverCount += 1
    })
    emitter.clear()
    emitter.emit('pieceLock', { piece: {} as never, board: [] })
    emitter.emit('gameOver', { reason: 'topOut' })
    expect(lockCount).toBe(0)
    expect(gameOverCount).toBe(0)
  })
})
