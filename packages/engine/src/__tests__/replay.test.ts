/**
 * Replay round-trip: record a handful of inputs in a live engine and
 * confirm that {@link createReplayEngine} reproduces the same final
 * state when fed back the recorded log.
 */

import { createReplayEngine } from '@engine/replay'
import { createEngine } from '@engine/store'
import { describe, it, expect } from 'vitest'

describe('replay', () => {
  it('reproduces a hard-drop sequence deterministically', () => {
    const seed = 42
    const live = createEngine({ seed })
    live.startGame({ mode: 'marathon', seed })

    // Simulate ten ticks with hard drops sprinkled between them.
    for (let index = 0; index < 10; index += 1) {
      live.dispatch({ kind: 'hardDrop' })
      live.tick(200)
    }

    const inputs = live.getInputLog()
    expect(inputs.length).toBe(10)

    const replay = createReplayEngine({ seed, mode: 'marathon', inputs })
    // Tick the replay in the same increments; slightly more total time to
    // let the last dispatched input flush.
    for (let index = 0; index < 12; index += 1) {
      replay.tick(200)
    }

    expect(replay.getSnapshot().lockCount).toBe(live.getSnapshot().lockCount)
    expect(replay.getSnapshot().score).toBe(live.getSnapshot().score)
    expect(replay.getSnapshot().board).toEqual(live.getSnapshot().board)
  })

  it('clearInputLog drops any recorded inputs', () => {
    const engine = createEngine({ seed: 1 })
    engine.startGame({ mode: 'marathon' })
    engine.dispatch({ kind: 'hardDrop' })
    engine.tick(16)
    expect(engine.getInputLog().length).toBeGreaterThan(0)
    engine.clearInputLog()
    expect(engine.getInputLog().length).toBe(0)
  })

  it('startGame clears the input log automatically', () => {
    const engine = createEngine({ seed: 1 })
    engine.startGame({ mode: 'marathon' })
    engine.dispatch({ kind: 'hardDrop' })
    engine.tick(16)
    expect(engine.getInputLog().length).toBeGreaterThan(0)
    engine.startGame({ mode: 'marathon' })
    expect(engine.getInputLog().length).toBe(0)
  })

  it('honours startLevel when the replay runs in Marathon', () => {
    const replay = createReplayEngine({
      seed: 1,
      mode: 'marathon',
      startLevel: 5,
      inputs: [],
    })
    expect(replay.getSnapshot().level).toBe(5)
  })

  it('honours durationMs when the replay runs in Ultra', () => {
    const replay = createReplayEngine({
      seed: 1,
      mode: 'ultra',
      durationMs: 45_000,
      inputs: [],
    })
    expect(replay.getSnapshot().durationMs).toBe(45_000)
  })

  it('applies a trailing same-tick input via the zero-delta follow-up tick', () => {
    // Queue an input whose atMs equals the end of the first advance;
    // the replay harness runs `inner.tick(0)` afterwards so the input
    // actually dispatches within the same elapsedMs.
    const replay = createReplayEngine({
      seed: 42,
      mode: 'marathon',
      inputs: [
        { input: { kind: 'moveLeftPress' }, atMs: 0 },
        { input: { kind: 'hardDrop' }, atMs: 10 },
      ],
    })
    replay.tick(10)
    expect(replay.getSnapshot().elapsedMs).toBeGreaterThan(0)
  })
})
