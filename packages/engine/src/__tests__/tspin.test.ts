/**
 * Tests for T-spin detection using the 3-corner rule: non-T rejection,
 * rotation-required rule, mini vs full classification based on which
 * corners are blocked.
 */

import { createEmptyBoard } from '@engine/board'
import { BOARD_HEIGHT } from '@engine/constants'
import { detectTspin } from '@engine/tspin'
import type { Cell, Playfield } from '@engine/types'
import { describe, it, expect } from 'vitest'

/** Creates a board with the given cells occupied by an `I` marker. */
function withBlocks(coordinates: ReadonlyArray<readonly [number, number]>): Playfield {
  const board: Cell[][] = []
  for (const row of createEmptyBoard()) {
    board.push([...row])
  }
  for (const [x, y] of coordinates) {
    board[y]![x] = 'I'
  }
  return board
}

describe('tspin', () => {
  it('returns "none" for non-T pieces', () => {
    const board = createEmptyBoard()
    expect(detectTspin(board, 'L', 0, 3, 18, true)).toBe('none')
  })

  it('returns "none" if last action was not a rotation', () => {
    const board = createEmptyBoard()
    expect(detectTspin(board, 'T', 0, 3, 18, false)).toBe('none')
  })

  it('returns "none" with fewer than 3 blocked corners', () => {
    const board = createEmptyBoard()
    expect(detectTspin(board, 'T', 0, 3, 18, true)).toBe('none')
  })

  it('returns "full" when all 4 corners blocked and both front corners blocked', () => {
    // T rotation 2 (south, point down): front corners are bottom-left and bottom-right
    // (0,0 and 2,0 in local; check corners relative to origin)
    const originX = 3
    const originY = BOARD_HEIGHT - 3
    const board = withBlocks([
      [originX + 0, originY + 0], // top-left corner
      [originX + 2, originY + 0], // top-right corner
      [originX + 0, originY + 2], // bottom-left corner (front for R2)
      [originX + 2, originY + 2], // bottom-right corner (front for R2)
    ])
    expect(detectTspin(board, 'T', 2, originX, originY, true)).toBe('full')
  })

  it('returns "mini" when 3 corners blocked but not both front corners', () => {
    // T rotation 0 (north, point up): front corners are top-left and top-right (0,0 and 2,0)
    // Block both back corners + one front corner = 3 corners but not both fronts
    const originX = 3
    const originY = BOARD_HEIGHT - 3
    const board = withBlocks([
      [originX + 0, originY + 0], // top-left (front)
      [originX + 0, originY + 2], // bottom-left (back)
      [originX + 2, originY + 2], // bottom-right (back)
    ])
    expect(detectTspin(board, 'T', 0, originX, originY, true)).toBe('mini')
  })
})
