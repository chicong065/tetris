/**
 * Round-trip tests for {@link Engine.serialize} and `createEngine({ restore })`.
 * Verifies a mid-game snapshot can be rebuilt into an identical engine.
 */

import { createEngine } from '@engine/store'
import { describe, it, expect } from 'vitest'

describe('serialize/restore', () => {
  it('serialises with a schema version tag', () => {
    const engine = createEngine({ seed: 1 })
    engine.startGame({ mode: 'marathon' })
    const snapshot = engine.serialize()
    expect(snapshot.version).toBe(1)
    expect(snapshot.state.phase.kind).toBe('playing')
  })

  it('round-trips mid-game state', () => {
    const engine = createEngine({ seed: 1 })
    engine.startGame({ mode: 'marathon' })
    for (let index = 0; index < 3; index += 1) {
      engine.dispatch({ kind: 'hardDrop' })
      engine.tick(16)
    }
    const snapshot = engine.serialize()
    const rebuilt = createEngine({ restore: snapshot })
    expect(rebuilt.getSnapshot()).toEqual(snapshot.state)
  })

  it('restored engine continues to tick deterministically', () => {
    const engine = createEngine({ seed: 1 })
    engine.startGame({ mode: 'marathon' })
    engine.dispatch({ kind: 'hardDrop' })
    engine.tick(16)
    const snapshot = engine.serialize()
    const rebuilt = createEngine({ restore: snapshot })
    rebuilt.dispatch({ kind: 'hardDrop' })
    rebuilt.tick(16)
    engine.dispatch({ kind: 'hardDrop' })
    engine.tick(16)
    expect(rebuilt.getSnapshot().lockCount).toBe(engine.getSnapshot().lockCount)
    expect(rebuilt.getSnapshot().score).toBe(engine.getSnapshot().score)
  })
})
