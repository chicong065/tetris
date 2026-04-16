/**
 * Tests for Guideline scoring: base point values, B2B multiplier,
 * combo bonuses, T-spin variants, Perfect Clear bonus, and drop points.
 */

import { computeLineClearScore, computeDropScore } from '@engine/scoring'
import { describe, it, expect } from 'vitest'

describe('scoring', () => {
  it('awards 100 × level for single at level 1', () => {
    const result = computeLineClearScore({
      linesCleared: 1,
      tSpin: 'none',
      level: 1,
      combo: -1,
      backToBackActive: false,
      isPerfectClear: false,
    })
    expect(result.points).toBe(100)
    expect(result.backToBack).toBe(false)
  })

  it('awards 800 × level for Tetris', () => {
    const result = computeLineClearScore({
      linesCleared: 4,
      tSpin: 'none',
      level: 1,
      combo: -1,
      backToBackActive: false,
      isPerfectClear: false,
    })
    expect(result.points).toBe(800)
    expect(result.backToBack).toBe(true)
  })

  it('awards B2B bonus (×1.5) on back-to-back Tetris', () => {
    const result = computeLineClearScore({
      linesCleared: 4,
      tSpin: 'none',
      level: 1,
      combo: -1,
      backToBackActive: true,
      isPerfectClear: false,
    })
    expect(result.points).toBe(1200)
    expect(result.backToBack).toBe(true)
  })

  it('single at level 5 is 500', () => {
    const result = computeLineClearScore({
      linesCleared: 1,
      tSpin: 'none',
      level: 5,
      combo: -1,
      backToBackActive: false,
      isPerfectClear: false,
    })
    expect(result.points).toBe(500)
  })

  it('T-spin double at level 1 is 1200', () => {
    const result = computeLineClearScore({
      linesCleared: 2,
      tSpin: 'full',
      level: 1,
      combo: -1,
      backToBackActive: false,
      isPerfectClear: false,
    })
    expect(result.points).toBe(1200)
    expect(result.backToBack).toBe(true)
  })

  it('T-spin (no lines) at level 1 is 400', () => {
    const result = computeLineClearScore({
      linesCleared: 0,
      tSpin: 'full',
      level: 1,
      combo: -1,
      backToBackActive: false,
      isPerfectClear: false,
    })
    expect(result.points).toBe(400)
  })

  it('no-line action breaks combo reset but no combo bonus', () => {
    const result = computeLineClearScore({
      linesCleared: 0,
      tSpin: 'none',
      level: 1,
      combo: 5,
      backToBackActive: false,
      isPerfectClear: false,
    })
    expect(result.points).toBe(0)
    expect(result.combo).toBe(-1)
  })

  it('combo adds 50 × combo × level on clears', () => {
    // 2nd consecutive clear (combo becomes 1) with a single at level 2: base 200 + 50*1*2 = 300
    const result = computeLineClearScore({
      linesCleared: 1,
      tSpin: 'none',
      level: 2,
      combo: 0,
      backToBackActive: false,
      isPerfectClear: false,
    })
    expect(result.points).toBe(300)
    expect(result.combo).toBe(1)
  })

  it('perfect clear tetris at level 1 adds 2000 bonus', () => {
    const result = computeLineClearScore({
      linesCleared: 4,
      tSpin: 'none',
      level: 1,
      combo: -1,
      backToBackActive: false,
      isPerfectClear: true,
    })
    expect(result.points).toBe(800 + 2000)
  })

  it('computeDropScore soft drop awards 1 × distance', () => {
    expect(computeDropScore('soft', 5)).toBe(5)
  })

  it('computeDropScore hard drop awards 2 × distance', () => {
    expect(computeDropScore('hard', 5)).toBe(10)
  })

  it('awards full T-spin single at 800 base points', () => {
    const result = computeLineClearScore({
      linesCleared: 1,
      tSpin: 'full',
      level: 1,
      combo: -1,
      backToBackActive: false,
      isPerfectClear: false,
    })
    // Full T-spin single base = 800. No combo bonus on first clear.
    expect(result.points).toBe(800)
  })

  it('awards full T-spin double at 1200 base points', () => {
    const result = computeLineClearScore({
      linesCleared: 2,
      tSpin: 'full',
      level: 1,
      combo: -1,
      backToBackActive: false,
      isPerfectClear: false,
    })
    expect(result.points).toBe(1200)
  })

  it('awards T-spin triple at 1600 base points (full kind, 3 lines)', () => {
    const result = computeLineClearScore({
      linesCleared: 3,
      tSpin: 'full',
      level: 1,
      combo: -1,
      backToBackActive: false,
      isPerfectClear: false,
    })
    expect(result.points).toBe(1600)
    expect(result.backToBack).toBe(true)
  })

  it('awards mini T-spin zero / single / double at their base tables', () => {
    const miniZero = computeLineClearScore({
      linesCleared: 0,
      tSpin: 'mini',
      level: 1,
      combo: -1,
      backToBackActive: false,
      isPerfectClear: false,
    })
    expect(miniZero.points).toBe(100)

    const miniSingle = computeLineClearScore({
      linesCleared: 1,
      tSpin: 'mini',
      level: 1,
      combo: -1,
      backToBackActive: false,
      isPerfectClear: false,
    })
    // First clear of a session has no combo bonus (combo = -1 → 0).
    expect(miniSingle.points).toBe(200)

    const miniDouble = computeLineClearScore({
      linesCleared: 2,
      tSpin: 'mini',
      level: 1,
      combo: -1,
      backToBackActive: false,
      isPerfectClear: false,
    })
    expect(miniDouble.points).toBe(400)
  })

  it('applies the 4-line Perfect Clear bonus (+2000 at level 1)', () => {
    const result = computeLineClearScore({
      linesCleared: 4,
      tSpin: 'none',
      level: 1,
      combo: -1,
      backToBackActive: false,
      isPerfectClear: true,
    })
    // Tetris base 800 + no first-clear combo + PC 2000 = 2800.
    expect(result.points).toBe(2800)
  })

  it('awards full T-spin zero (no lines cleared) at 400 base points', () => {
    const result = computeLineClearScore({
      linesCleared: 0,
      tSpin: 'full',
      level: 1,
      combo: -1,
      backToBackActive: false,
      isPerfectClear: false,
    })
    // Full T-spin zero base = 400. No-line T-spin doesn't extend the combo.
    expect(result.points).toBe(400)
  })

  it('applies the 2-line Perfect Clear bonus (+1200 at level 1)', () => {
    const result = computeLineClearScore({
      linesCleared: 2,
      tSpin: 'none',
      level: 1,
      combo: -1,
      backToBackActive: false,
      isPerfectClear: true,
    })
    // Double base 300 + PC 1200 = 1500.
    expect(result.points).toBe(1500)
  })

  it('applies the 3-line Perfect Clear bonus (+1800 at level 1)', () => {
    const result = computeLineClearScore({
      linesCleared: 3,
      tSpin: 'none',
      level: 1,
      combo: -1,
      backToBackActive: false,
      isPerfectClear: true,
    })
    // Triple base 500 + PC 1800 = 2300.
    expect(result.points).toBe(2300)
  })
})
