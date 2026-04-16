/**
 * DAS (Delayed Auto Shift) and ARR (Auto Repeat Rate) state machine for
 * held left/right inputs. The engine ticks this on every frame to emit
 * the correct number of one-cell shifts: one on press, a delay, then
 * repeats at the ARR rate (or instant moves when ARR is 0).
 */

import type { AutoshiftState, EngineSettings } from '@engine/types'

/** Horizontal direction, used both by pressed keys and the DAS state. */
export type Direction = 'left' | 'right'

/** Fresh autoshift state with no direction active. */
export function initialAutoshift(): AutoshiftState {
  return { direction: 0, chargedMs: 0, arrAccumulatorMs: 0 }
}

/** Tick/press result: updated state plus how many shifts should fire right now. */
export type AutoshiftResult = {
  readonly state: AutoshiftState
  readonly emits: number
}

/**
 * Handles a key-down for the given direction. Always emits one immediate
 * shift and resets the DAS/ARR charge so the hold starts from zero.
 */
export function pressDirection(_state: AutoshiftState, direction: Direction): AutoshiftResult {
  const sign: -1 | 1 = direction === 'left' ? -1 : 1
  return {
    state: { direction: sign, chargedMs: 0, arrAccumulatorMs: 0 },
    emits: 1,
  }
}

/**
 * Handles a key-up. Only clears the state if the released key matches the
 * currently-active direction, so overlapping presses don't cancel each
 * other prematurely.
 */
export function releaseDirection(state: AutoshiftState, direction: Direction): AutoshiftState {
  const sign: -1 | 1 = direction === 'left' ? -1 : 1
  if (state.direction !== sign) {
    return state
  }
  return initialAutoshift()
}

/**
 * Advances the autoshift clock by `deltaMs`. Returns how many auto-shift
 * moves should be applied this tick. When `settings.arrMs === 0` (instant
 * ARR) a single burst emit is produced with a count equal to the
 * accumulated time, the caller clamps against the board edge.
 */
export function tickAutoshift(state: AutoshiftState, deltaMs: number, settings: EngineSettings): AutoshiftResult {
  if (state.direction === 0) {
    return { state, emits: 0 }
  }
  const newCharged = state.chargedMs + deltaMs
  if (newCharged < settings.dasMs) {
    return { state: { ...state, chargedMs: newCharged }, emits: 0 }
  }
  // DAS satisfied, spend the remainder on ARR
  const remainder = newCharged - settings.dasMs
  const arrMs = Math.max(1, settings.arrMs)
  let accumulator = state.arrAccumulatorMs + remainder
  let emits = 0
  if (settings.arrMs === 0) {
    // Instant ARR, count rows spanned. Treat any remainder as 1 burst of "many" moves.
    // Cap at board width to be safe.
    emits = Math.max(1, Math.floor(accumulator))
    accumulator = 0
  } else {
    while (accumulator >= arrMs) {
      emits += 1
      accumulator -= arrMs
    }
  }
  return {
    state: { direction: state.direction, chargedMs: settings.dasMs, arrAccumulatorMs: accumulator },
    emits,
  }
}
