/**
 * Tests for lock-delay bookkeeping: timer advancement, the lock
 * threshold, move-reset budgeting, and the deeper-row fresh-budget rule.
 */

import { LOCK_DELAY_MS, LOCK_RESETS_MAX } from '@engine/constants'
import { tickLockTimer, resetLockOnMove, shouldLock } from '@engine/lockDelay'
import type { ActivePiece } from '@engine/types'
import { describe, it, expect } from 'vitest'

function piece(overrides: Partial<ActivePiece> = {}): ActivePiece {
  return {
    kind: 'T',
    rotation: 0,
    x: 4,
    y: 20,
    lockTimerMs: 0,
    lockResets: 0,
    lowestY: 20,
    lastActionWasRotation: false,
    ...overrides,
  }
}

describe('lockDelay', () => {
  it('tickLockTimer advances the timer by delta', () => {
    const active = piece({ lockTimerMs: 100 })
    const ticked = tickLockTimer(active, 50)
    expect(ticked.lockTimerMs).toBe(150)
  })

  it('shouldLock returns false before lock delay elapses', () => {
    expect(shouldLock(piece({ lockTimerMs: 499 }))).toBe(false)
  })

  it('shouldLock returns true once lock delay elapsed', () => {
    expect(shouldLock(piece({ lockTimerMs: LOCK_DELAY_MS }))).toBe(true)
    expect(shouldLock(piece({ lockTimerMs: LOCK_DELAY_MS + 10 }))).toBe(true)
  })

  it('resetLockOnMove resets timer and increments reset count when not deeper', () => {
    const active = piece({ lockTimerMs: 300, lockResets: 2, lowestY: 20, y: 20 })
    const result = resetLockOnMove(active, 20)
    expect(result.lockTimerMs).toBe(0)
    expect(result.lockResets).toBe(3)
    expect(result.lowestY).toBe(20)
  })

  it('resetLockOnMove updates lowestY on step progression without refunding the counter', () => {
    // Step progression (piece reached a new deepest row) resets the
    // timer and updates lowestY but does not refund a reset — the
    // counter stays monotonic per piece so wall-kick chains can't
    // grant unlimited fresh budget.
    const active = piece({ lockTimerMs: 300, lockResets: 10, lowestY: 20, y: 21 })
    const result = resetLockOnMove(active, 21)
    expect(result.lockResets).toBe(11)
    expect(result.lowestY).toBe(21)
    expect(result.lockTimerMs).toBe(0)
  })

  it('resetLockOnMove at the cap still bookkeeps lowestY but does not reset the timer', () => {
    const active = piece({ lockTimerMs: 400, lockResets: LOCK_RESETS_MAX, lowestY: 20, y: 22 })
    const result = resetLockOnMove(active, 22)
    expect(result.lockResets).toBe(LOCK_RESETS_MAX)
    expect(result.lockTimerMs).toBe(400)
    expect(result.lowestY).toBe(22)
  })

  it('resetLockOnMove is capped, once max resets reached, timer does not reset', () => {
    const active = piece({ lockTimerMs: 400, lockResets: LOCK_RESETS_MAX })
    const result = resetLockOnMove(active, 20)
    expect(result.lockTimerMs).toBe(400)
    expect(result.lockResets).toBe(LOCK_RESETS_MAX)
  })
})
