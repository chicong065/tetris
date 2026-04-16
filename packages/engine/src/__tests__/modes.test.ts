/**
 * Tests for mode helpers: Marathon level progression/cap and Sprint's
 * finish condition.
 */

import { SPRINT_TARGET_LINES, MAX_LEVEL } from '@engine/constants'
import { marathonLevel } from '@engine/modes/marathon'
import { sprintFinishCheck } from '@engine/modes/sprint'
import { describe, it, expect } from 'vitest'

describe('marathon', () => {
  it('level 1 at 0 lines', () => {
    expect(marathonLevel(0)).toBe(1)
  })

  it('level 1 at 9 lines, level 2 at 10', () => {
    expect(marathonLevel(9)).toBe(1)
    expect(marathonLevel(10)).toBe(2)
  })

  it('level caps at MAX_LEVEL', () => {
    expect(marathonLevel(500)).toBe(MAX_LEVEL)
  })
})

describe('sprint', () => {
  it('returns unfinished until target lines reached', () => {
    expect(sprintFinishCheck({ lines: SPRINT_TARGET_LINES - 1, elapsedMs: 1000 }).finished).toBe(false)
  })

  it('returns finished at exactly target lines', () => {
    const result = sprintFinishCheck({ lines: SPRINT_TARGET_LINES, elapsedMs: 50000 })
    expect(result.finished).toBe(true)
    if (result.finished) {
      expect(result.timeMs).toBe(50000)
    }
  })
})
