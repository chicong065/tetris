/**
 * Lock-delay bookkeeping for a grounded piece. Implements the Guideline
 * "move reset" rule: every accepted move/rotation while on the ground
 * resets the lock timer, but only up to {@link LOCK_RESETS_MAX} times
 * unless the piece makes new downward progress.
 */

import { LOCK_DELAY_MS, LOCK_RESETS_MAX } from '@engine/constants'
import type { ActivePiece } from '@engine/types'

/** Advances the lock timer by `deltaMs`; returns an updated copy. */
export function tickLockTimer(active: ActivePiece, deltaMs: number): ActivePiece {
  return { ...active, lockTimerMs: active.lockTimerMs + deltaMs }
}

/** Returns true once the lock timer has exceeded the allowed grace window. */
export function shouldLock(active: ActivePiece): boolean {
  return active.lockTimerMs >= LOCK_DELAY_MS
}

/**
 * Resets the lock timer after a successful move or rotation on the ground.
 *
 * The reset counter is monotonic per piece, never refunded. Reaching a
 * new deeper row ("step progression") still clears the timer and
 * updates `lowestY`, but does not refund the counter; without this,
 * wall-kicks that step the piece one row down would grant a fresh
 * budget every kick and let a skilled player stall forever.
 *
 * Once {@link LOCK_RESETS_MAX} resets have been consumed, further
 * resets are ignored — the timer keeps running and the piece locks
 * deterministically after the remainder of the current lock delay.
 */
export function resetLockOnMove(active: ActivePiece, currentY: number): ActivePiece {
  const nextLowestY = Math.max(active.lowestY, currentY)
  if (active.lockResets >= LOCK_RESETS_MAX) {
    // Budget exhausted: only update lowestY (purely bookkeeping); do
    // not refund counter or clear the timer.
    return nextLowestY === active.lowestY ? active : { ...active, lowestY: nextLowestY }
  }
  return {
    ...active,
    lockTimerMs: 0,
    lockResets: active.lockResets + 1,
    lowestY: nextLowestY,
  }
}

/** Zeros the lock timer without touching the reset counter. */
export function clearLockTimer(active: ActivePiece): ActivePiece {
  return { ...active, lockTimerMs: 0 }
}
