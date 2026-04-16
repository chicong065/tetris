/**
 * Replay harness. Wraps {@link createEngine} with a queue of previously
 * recorded inputs, dispatching each one exactly when the replay engine's
 * `elapsedMs` reaches the original `atMs`. Because every engine subsystem
 * is deterministic (seeded 7-bag, fixed-timestep tick, pure reducers) the
 * replay reproduces the original session state bit-for-bit.
 */

import { createEngine, type Engine } from '@engine/store'
import type { EngineSettings, GameMode, RecordedInput, StartGameOptions } from '@engine/types'

/**
 * Options for {@link createReplayEngine}. `seed` and `inputs` are
 * required; everything else mirrors the original session configuration.
 */
export type ReplayEngineOptions = {
  readonly seed: number
  readonly mode: GameMode
  readonly startLevel?: number
  readonly durationMs?: number
  readonly settings?: Partial<EngineSettings>
  readonly inputs: ReadonlyArray<RecordedInput>
}

/**
 * Creates an engine that will deterministically replay `inputs`. Call
 * `engine.tick(deltaMs)` in a loop; queued inputs are dispatched as
 * their recorded `atMs` values are reached.
 *
 * The returned engine behaves like a normal {@link Engine} otherwise:
 * listeners, serialization, and selectors all work. If you need to
 * compare the final state against a reference, tick until
 * `engine.getInputLog()` length matches the number of inputs, or simply
 * tick past the last `atMs`.
 */
export function createReplayEngine(options: ReplayEngineOptions): Engine {
  const pending: RecordedInput[] = options.inputs.toSorted((left, right) => left.atMs - right.atMs)

  const startOptions: StartGameOptions = { mode: options.mode, seed: options.seed }
  if (options.startLevel !== undefined) {
    ;(startOptions as { startLevel?: number }).startLevel = options.startLevel
  }
  if (options.durationMs !== undefined) {
    ;(startOptions as { durationMs?: number }).durationMs = options.durationMs
  }

  const inner = createEngine(
    options.settings ? { seed: options.seed, settings: options.settings } : { seed: options.seed }
  )
  inner.startGame(startOptions)

  function release(): void {
    const now = inner.getSnapshot().elapsedMs
    while (pending.length > 0 && pending[0]!.atMs <= now) {
      const next = pending.shift()!
      inner.dispatch(next.input)
    }
  }

  // Release any inputs that fell at or before elapsedMs === 0.
  release()

  /**
   * Proxy that wraps `tick` so we release inputs before and after each
   * slice of advancing time. Other members pass through untouched.
   */
  const proxy: Engine = {
    ...inner,
    tick: (deltaMs) => {
      release()
      inner.tick(deltaMs)
      release()
      // Allow trailing same-tick inputs to actually apply before returning.
      // The zero-delta follow-up fires only on a rare boundary race —
      // an input recorded at exactly this tick's elapsed time — and is
      // kept as a safety net so such an input still takes effect.
      if (pending.length === 0 || pending[0]!.atMs > inner.getSnapshot().elapsedMs) {
        return
      }
      inner.tick(0)
    },
  }
  return proxy
}
