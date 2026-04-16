/**
 * Playfield operations: create/clone, collision checks against board and
 * walls, piece locking, and full-row clearing. All functions are pure ,
 * the board is treated as an immutable 2D array.
 */

import { BOARD_WIDTH, BOARD_HEIGHT } from '@engine/constants'
import { getPieceCells } from '@engine/pieces'
import type { Cell, Playfield, PieceKind } from '@engine/types'

/** Build a fresh board filled with `null` cells. */
export function createEmptyBoard(): Playfield {
  return Array.from({ length: BOARD_HEIGHT }, () => Array.from({ length: BOARD_WIDTH }, () => null as Cell))
}

/**
 * Returns true if placing a single cell at `(x, y)` would collide.
 *
 * Walls and the floor are blocked; the ceiling (negative y) is open so
 * pieces can exist in the vanish zone above the visible field.
 */
export function isCellBlocked(board: Playfield, x: number, y: number): boolean {
  if (x < 0 || x >= BOARD_WIDTH) {
    return true
  }
  if (y >= BOARD_HEIGHT) {
    return true
  }
  if (y < 0) {
    return false // ceiling is open (vanish zone)
  }
  return board[y]![x] !== null
}

/** Returns true if the piece fits at `(x, y)` in the given rotation. */
export function canPlacePiece(board: Playfield, kind: PieceKind, rotation: number, x: number, y: number): boolean {
  const cells = getPieceCells(kind, rotation, x, y)
  for (const [cellX, cellY] of cells) {
    if (isCellBlocked(board, cellX, cellY)) {
      return false
    }
  }
  return true
}

/**
 * Returns a new board with the piece's cells stamped in place. Cells that
 * fall outside the board (e.g. the vanish zone ceiling) are silently
 * skipped so lockouts remain caller-decidable.
 */
export function lockPiece(board: Playfield, kind: PieceKind, rotation: number, x: number, y: number): Playfield {
  const cells = getPieceCells(kind, rotation, x, y)
  const next: Cell[][] = board.map((row) => [...row])
  for (const [cellX, cellY] of cells) {
    if (cellY < 0 || cellY >= BOARD_HEIGHT || cellX < 0 || cellX >= BOARD_WIDTH) {
      continue
    }
    next[cellY]![cellX] = kind
  }
  return next
}

/** Result of {@link clearFullRows}: new board plus the indexes that were cleared. */
export type ClearResult = {
  readonly board: Playfield
  readonly clearedRows: readonly number[]
}

/**
 * Removes every full row and returns a new board with the remaining rows
 * shifted down. The caller uses `clearedRows` for animation and scoring.
 */
export function clearFullRows(board: Playfield): ClearResult {
  const clearedRows: number[] = []
  for (let y = 0; y < BOARD_HEIGHT; y += 1) {
    const row = board[y]!
    if (row.every((cell) => cell !== null)) {
      clearedRows.push(y)
    }
  }
  if (clearedRows.length === 0) {
    return { board, clearedRows: [] }
  }
  const kept = board.filter((_, y) => !clearedRows.includes(y))
  const emptyRow: Cell[] = Array.from({ length: BOARD_WIDTH }, () => null)
  const padding: Cell[][] = Array.from({ length: clearedRows.length }, () => [...emptyRow])
  return {
    board: [...padding, ...kept],
    clearedRows,
  }
}

/** Returns true if no cell on the board is filled (used for Perfect Clear detection). */
export function isBoardEmpty(board: Playfield): boolean {
  for (const row of board) {
    for (const cell of row) {
      if (cell !== null) {
        return false
      }
    }
  }
  return true
}

/**
 * Returns true if every cell of the piece lies strictly above the visible
 * area, used to detect lock-out game-over conditions.
 */
export function isAboveVisible(kind: PieceKind, rotation: number, x: number, y: number, visibleTop: number): boolean {
  const cells = getPieceCells(kind, rotation, x, y)
  return cells.every(([, cellY]) => cellY < visibleTop)
}
