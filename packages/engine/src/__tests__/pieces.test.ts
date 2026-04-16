/**
 * Tests for tetromino geometry: kind tuple completeness, each rotation's
 * cell count, canonical shape fixtures for T/I/O, and the 4x4 bounding
 * box invariant.
 */

import { SHAPES, PIECE_KINDS, getPieceCells } from '@engine/pieces'
import { describe, it, expect } from 'vitest'

describe('pieces', () => {
  it('has exactly 7 piece kinds', () => {
    expect(PIECE_KINDS).toEqual(['I', 'O', 'T', 'S', 'Z', 'J', 'L'])
  })

  it('each piece has 4 rotations with 4 cells each', () => {
    for (const kind of PIECE_KINDS) {
      expect(SHAPES[kind]).toHaveLength(4)
      for (const rotation of SHAPES[kind]) {
        expect(rotation).toHaveLength(4)
      }
    }
  })

  it('T-piece rotation 0 (north) has cells forming a T pointing up', () => {
    const cells = SHAPES.T[0]
    expect(cells).toEqual([
      [1, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ])
  })

  it('I-piece rotation 0 is horizontal on row 1', () => {
    const cells = SHAPES.I[0]
    expect(cells).toEqual([
      [0, 1],
      [1, 1],
      [2, 1],
      [3, 1],
    ])
  })

  it('I-piece rotation 1 is vertical on column 2', () => {
    const cells = SHAPES.I[1]
    expect(cells).toEqual([
      [2, 0],
      [2, 1],
      [2, 2],
      [2, 3],
    ])
  })

  it('O-piece is identical in all rotations', () => {
    const expected = [
      [1, 0],
      [2, 0],
      [1, 1],
      [2, 1],
    ]
    for (const rotation of [0, 1, 2, 3] as const) {
      expect(SHAPES.O[rotation]).toEqual(expected)
    }
  })

  it('every piece cell fits inside a 4x4 bounding box', () => {
    for (const kind of PIECE_KINDS) {
      for (const rotation of SHAPES[kind]) {
        for (const [dx, dy] of rotation) {
          expect(dx).toBeGreaterThanOrEqual(0)
          expect(dx).toBeLessThanOrEqual(3)
          expect(dy).toBeGreaterThanOrEqual(0)
          expect(dy).toBeLessThanOrEqual(3)
        }
      }
    }
  })

  it('T-piece rotation 2 (south) has cells forming a T pointing down', () => {
    const cells = SHAPES.T[2]!
    const cloned: number[][] = []
    for (const cell of cells) {
      cloned.push([cell[0], cell[1]])
    }
    const sorted = cloned.toSorted((a, b) => a[0]! - b[0]! || a[1]! - b[1]!)
    expect(sorted).toEqual([
      [0, 1],
      [1, 1],
      [1, 2],
      [2, 1],
    ])
  })

  it('getPieceCells throws when asked for an invalid rotation index', () => {
    // Rotation is typed as 0|1|2|3 but the public surface takes a
    // `number`; a NaN input still reaches the defensive throw.
    expect(() => getPieceCells('T', Number.NaN, 0, 0)).toThrow(/Invalid rotation/)
  })
})
