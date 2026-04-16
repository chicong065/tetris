/**
 * Tests for the 7-bag randomizer: seeded determinism, the uniqueness
 * invariant (each bag contains all 7 pieces exactly once), and the
 * lazy refill behaviour.
 */

import { createBag, refillBag } from '@engine/bag'
import { PIECE_KINDS } from '@engine/pieces'
import { describe, it, expect } from 'vitest'

describe('bag', () => {
  it('createBag produces 7 unique pieces', () => {
    const bag = createBag(12345)
    expect(bag.upcoming).toHaveLength(7)
    const unique = new Set(bag.upcoming)
    expect(unique.size).toBe(7)
    for (const kind of PIECE_KINDS) {
      expect(unique.has(kind)).toBe(true)
    }
  })

  it('createBag is deterministic for a given seed', () => {
    const a = createBag(42)
    const b = createBag(42)
    expect(a.upcoming).toEqual(b.upcoming)
  })

  it('different seeds generally produce different orders', () => {
    const a = createBag(1)
    const b = createBag(2)
    expect(a.upcoming).not.toEqual(b.upcoming)
  })

  it('refillBag appends another 7 unique pieces when queue runs low', () => {
    let bag = createBag(99)
    // drain to fewer than 7
    bag = { ...bag, upcoming: bag.upcoming.slice(5) }
    const refilled = refillBag(bag)
    expect(refilled.upcoming.length).toBeGreaterThanOrEqual(7)
    const appended = refilled.upcoming.slice(refilled.upcoming.length - 7)
    expect(new Set(appended).size).toBe(7)
  })

  it('refillBag is a no-op when already has 7+', () => {
    const bag = createBag(7)
    const result = refillBag(bag)
    expect(result.upcoming).toEqual(bag.upcoming)
  })
})
