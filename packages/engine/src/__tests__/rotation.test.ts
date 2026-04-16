/**
 * Tests for SRS rotation with wall kicks: standard/I-piece/O-piece
 * tables, 180-rotation no-kick behaviour, and failed-rotation rejection
 * when every kick test collides.
 */

import { createEmptyBoard } from '@engine/board'
import { BOARD_HEIGHT, BOARD_WIDTH } from '@engine/constants'
import { tryRotate } from '@engine/rotation'
import type { Playfield } from '@engine/types'
import type { Cell } from '@engine/types'
import { describe, it, expect } from 'vitest'

function makeBoard(): Playfield {
  return createEmptyBoard()
}

describe('rotation', () => {
  it('tryRotate on empty board uses test 1 (0,0) for T rotating CW', () => {
    const board = makeBoard()
    const result = tryRotate(board, 'T', 0, 4, 20, 'cw')
    expect(result).not.toBeNull()
    expect(result!.rotation).toBe(1)
    expect(result!.x).toBe(4)
    expect(result!.y).toBe(20)
    expect(result!.kickIndex).toBe(0)
  })

  it('tryRotate returns null when all 5 tests fail (impossible rotation)', () => {
    // Fill the entire board except a 1x1 hole, no rotation can fit
    const empty: Cell[][] = []
    for (const row of createEmptyBoard()) {
      empty.push([...row])
    }
    for (let y = 0; y < BOARD_HEIGHT; y += 1) {
      for (let x = 0; x < BOARD_WIDTH; x += 1) {
        empty[y]![x] = 'I'
      }
    }
    empty[20]![4] = null
    const result = tryRotate(empty, 'T', 0, 3, 19, 'cw')
    expect(result).toBeNull()
  })

  it('I-piece uses its own kick table (different from standard)', () => {
    // With an empty board, 0toR for I should use test 1 at (0,0) and succeed unkicked
    const board = makeBoard()
    const result = tryRotate(board, 'I', 0, 3, 20, 'cw')
    expect(result).not.toBeNull()
    expect(result!.kickIndex).toBe(0)
  })

  it('180° rotation on empty board succeeds with no kick', () => {
    const board = makeBoard()
    const result = tryRotate(board, 'T', 0, 4, 20, '180')
    expect(result).not.toBeNull()
    expect(result!.rotation).toBe(2)
  })

  it('CCW rotation: T from R0 to R3', () => {
    const board = makeBoard()
    const result = tryRotate(board, 'T', 0, 4, 20, 'ccw')
    expect(result).not.toBeNull()
    expect(result!.rotation).toBe(3)
  })

  it('O-piece rotation is a no-op but still returns success', () => {
    const board = makeBoard()
    const result = tryRotate(board, 'O', 0, 4, 20, 'cw')
    expect(result).not.toBeNull()
    expect(result!.rotation).toBe(1)
    expect(result!.x).toBe(4)
    expect(result!.y).toBe(20)
  })

  it('wall kick: T against right wall rotates successfully with kick', () => {
    // Place T at R0 with origin such that CW rotation would overflow right wall
    // T at R0 has cells at (1,0)(0,1)(1,1)(2,1), width 3, so x=7 puts cells at cols 7,8,9 (max)
    // CW to R1 has cells at (1,0)(1,1)(2,1)(1,2), column 2 filled at x=9 which is still valid
    // So try with an obstacle instead
    const emptyBoard = createEmptyBoard()
    // Place a wall blocking the no-kick rotation at column 10 (right wall handles this naturally)
    const result = tryRotate(emptyBoard, 'T', 0, 8, 20, 'cw')
    // R1 at x=8 has cells (1,0),(1,1),(2,1),(1,2) to global (9,20),(9,21),(10,21),(9,22)
    // (10,21) is outside to fails test 1. Test 2 is (-1,0) to x=7
    expect(result).not.toBeNull()
    expect(result!.kickIndex).toBeGreaterThanOrEqual(1)
    expect(result!.x).toBeLessThan(8)
  })
})
