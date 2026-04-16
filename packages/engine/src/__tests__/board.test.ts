/**
 * Tests for board operations: creation, collision checks against walls
 * and cells, piece locking, and full-row clearing. Uses a compact ASCII
 * board builder to keep fixtures readable.
 */

import { createEmptyBoard, isCellBlocked, canPlacePiece, lockPiece, clearFullRows, isBoardEmpty } from '@engine/board'
import { BOARD_WIDTH, BOARD_HEIGHT } from '@engine/constants'
import type { Cell, Playfield } from '@engine/types'
import { describe, it, expect } from 'vitest'

/** Build a board from bottom-up rows of `.` (empty) + piece-kind chars. */
function board(rows: readonly string[]): Playfield {
  // rows with '.' (empty) and single-letter piece kinds; filled bottom-up
  const filled: Cell[][] = Array.from({ length: BOARD_HEIGHT }, () => Array.from({ length: BOARD_WIDTH }, () => null))
  rows.forEach((rowString, rowIndex) => {
    const targetY = BOARD_HEIGHT - rows.length + rowIndex
    // Row fixtures are ASCII-only (piece kinds + `.`); a plain index
    // loop avoids the locale-aware string iteration overhead.
    for (let columnIndex = 0; columnIndex < rowString.length; columnIndex += 1) {
      const char = rowString[columnIndex]
      filled[targetY]![columnIndex] = char === '.' || char === undefined ? null : (char as Cell)
    }
  })
  return filled
}

describe('board', () => {
  it('createEmptyBoard has correct dimensions and all null cells', () => {
    const b = createEmptyBoard()
    expect(b).toHaveLength(BOARD_HEIGHT)
    for (const row of b) {
      expect(row).toHaveLength(BOARD_WIDTH)
      for (const cell of row) {
        expect(cell).toBeNull()
      }
    }
  })

  it('isCellBlocked returns true for walls and floor', () => {
    const b = createEmptyBoard()
    expect(isCellBlocked(b, -1, 20)).toBe(true)
    expect(isCellBlocked(b, BOARD_WIDTH, 20)).toBe(true)
    expect(isCellBlocked(b, 0, BOARD_HEIGHT)).toBe(true)
  })

  it('isCellBlocked returns false for empty in-bounds cells, including ceiling', () => {
    const b = createEmptyBoard()
    expect(isCellBlocked(b, 0, 0)).toBe(false)
    expect(isCellBlocked(b, 5, 20)).toBe(false)
    expect(isCellBlocked(b, 0, -1)).toBe(false) // above ceiling allowed
  })

  it('canPlacePiece returns true for T at spawn on empty board', () => {
    const b = createEmptyBoard()
    expect(canPlacePiece(b, 'T', 0, 3, 19)).toBe(true)
  })

  it('canPlacePiece returns false when piece overlaps a locked block', () => {
    const b = board(['..........', 'TTTTTTTTTT'])
    expect(canPlacePiece(b, 'T', 0, 3, BOARD_HEIGHT - 2)).toBe(false)
  })

  it('canPlacePiece returns false when piece goes through left wall', () => {
    const b = createEmptyBoard()
    expect(canPlacePiece(b, 'T', 0, -2, 19)).toBe(false)
  })

  it('lockPiece places T cells into the board', () => {
    const b = createEmptyBoard()
    const locked = lockPiece(b, 'T', 0, 3, 38)
    expect(locked[38]![4]).toBe('T')
    expect(locked[39]![3]).toBe('T')
    expect(locked[39]![4]).toBe('T')
    expect(locked[39]![5]).toBe('T')
  })

  it('clearFullRows returns empty array when nothing is full', () => {
    const b = createEmptyBoard()
    const { board: nb, clearedRows } = clearFullRows(b)
    expect(clearedRows).toEqual([])
    expect(nb).toBe(b)
  })

  it('clearFullRows removes a single full row and shifts above rows down', () => {
    const filled = 'IIIIIIIIII'
    const b = board(['..........', filled])
    const { board: nb, clearedRows } = clearFullRows(b)
    expect(clearedRows).toEqual([BOARD_HEIGHT - 1])
    for (let x = 0; x < BOARD_WIDTH; x += 1) {
      expect(nb[BOARD_HEIGHT - 1]![x]).toBeNull()
    }
  })

  it('clearFullRows removes a Tetris (4 rows)', () => {
    const full = 'IIIIIIIIII'
    const b = board([full, full, full, full])
    const { clearedRows } = clearFullRows(b)
    expect(clearedRows).toHaveLength(4)
  })

  it('isBoardEmpty true for fresh board, false after lock', () => {
    expect(isBoardEmpty(createEmptyBoard())).toBe(true)
    const b = lockPiece(createEmptyBoard(), 'T', 0, 3, 38)
    expect(isBoardEmpty(b)).toBe(false)
  })

  it('lockPiece silently skips cells above the board ceiling', () => {
    // Place an I-piece with origin above the visible area so one of its
    // cells would sit at y = -1. The off-board cells must be dropped
    // without throwing; on-board cells still land.
    const locked = lockPiece(createEmptyBoard(), 'I', 0, 0, -1)
    const row0 = locked[0]!
    expect(row0.filter((cell) => cell === 'I').length).toBeGreaterThan(0)
  })

  it('lockPiece silently skips cells past the right wall', () => {
    // Place an I-piece so two of its cells sit past BOARD_WIDTH. The
    // on-board columns still fill; the row length is unchanged.
    const locked = lockPiece(createEmptyBoard(), 'I', 0, 8, 20)
    expect(locked[21]!.length).toBe(BOARD_WIDTH)
  })
})
