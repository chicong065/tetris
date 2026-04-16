/**
 * Tests for the Guideline gravity curve: known reference points,
 * monotonic decrease, and the 20G cap at level 20+.
 */

import { gravityMsPerRow } from '@engine/gravity'
import { describe, it, expect } from 'vitest'

describe('gravity', () => {
  it('level 1 is ~1000ms per row', () => {
    expect(gravityMsPerRow(1)).toBeCloseTo(1000, 0)
  })

  it('level 2 is ~793ms per row', () => {
    expect(gravityMsPerRow(2)).toBeGreaterThan(790)
    expect(gravityMsPerRow(2)).toBeLessThan(800)
  })

  it('gravity is strictly decreasing as level increases (up to cap)', () => {
    let previous = Infinity
    for (let level = 1; level < 20; level += 1) {
      const value = gravityMsPerRow(level)
      expect(value).toBeLessThan(previous)
      previous = value
    }
  })

  it('level 20+ returns 0 (20G, instant drop)', () => {
    expect(gravityMsPerRow(20)).toBe(0)
    expect(gravityMsPerRow(30)).toBe(0)
  })

  it('level 0 is treated as level 1', () => {
    expect(gravityMsPerRow(0)).toBeCloseTo(1000, 0)
  })
})
