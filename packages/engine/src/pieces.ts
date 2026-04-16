/**
 * Tetromino geometry: the canonical SRS shape tables and a helper to
 * project them into playfield coordinates. Rotation indices are
 * 0=spawn, 1=CW, 2=180, 3=CCW. y grows downward.
 */

import type { PieceKind } from '@engine/types'

/** The seven tetrominoes in a stable display/order-indexed tuple. */
export const PIECE_KINDS = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'] as const satisfies readonly PieceKind[]

/** A `[x, y]` pair, either a relative cell offset or an absolute board coord. */
export type Offset = readonly [number, number]

/**
 * SRS piece shapes: for each piece kind, four rotation states
 * (0=spawn, 1=CW, 2=180, 3=CCW) each listing the four cells the piece
 * occupies as `[dx, dy]` offsets from the piece's bounding-box origin
 * (top-left corner of the box).
 *
 * ## Coordinate conventions
 *
 * - The origin is the piece's top-left bounding-box corner, which the
 *   engine tracks as `ActivePiece.x` / `.y`.
 * - `y` grows downward (row 0 is the top of the board, row `BOARD_HEIGHT - 1`
 *   the bottom). Pieces spawn inside the hidden vanish zone above the
 *   visible area — see {@link SPAWN_Y} / {@link VISIBLE_TOP}.
 * - Bounding-box sizes differ per piece to match canonical SRS:
 *     - I uses a 4×4 box, so its offsets span `[0..3, 0..3]`.
 *     - O uses a 2×2 footprint embedded in a 4×4 coordinate space, so
 *       its offsets span a fixed `[1..2, 0..1]` region (O doesn't rotate).
 *     - J, L, T, S, Z use a 3×3 box.
 * - Each rotation has exactly 4 occupied cells (the tetromino invariant).
 *
 * Board collision and wall-kicks translate these offsets by the active
 * piece's `(x, y)` origin; see `getPieceCells` below and `rotation.ts`
 * for the kick tables.
 */
export const SHAPES: Record<PieceKind, readonly (readonly Offset[])[]> = {
  I: [
    [
      [0, 1],
      [1, 1],
      [2, 1],
      [3, 1],
    ],
    [
      [2, 0],
      [2, 1],
      [2, 2],
      [2, 3],
    ],
    [
      [0, 2],
      [1, 2],
      [2, 2],
      [3, 2],
    ],
    [
      [1, 0],
      [1, 1],
      [1, 2],
      [1, 3],
    ],
  ],
  O: [
    [
      [1, 0],
      [2, 0],
      [1, 1],
      [2, 1],
    ],
    [
      [1, 0],
      [2, 0],
      [1, 1],
      [2, 1],
    ],
    [
      [1, 0],
      [2, 0],
      [1, 1],
      [2, 1],
    ],
    [
      [1, 0],
      [2, 0],
      [1, 1],
      [2, 1],
    ],
  ],
  T: [
    [
      [1, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ],
    [
      [1, 0],
      [1, 1],
      [2, 1],
      [1, 2],
    ],
    [
      [0, 1],
      [1, 1],
      [2, 1],
      [1, 2],
    ],
    [
      [1, 0],
      [0, 1],
      [1, 1],
      [1, 2],
    ],
  ],
  S: [
    [
      [1, 0],
      [2, 0],
      [0, 1],
      [1, 1],
    ],
    [
      [1, 0],
      [1, 1],
      [2, 1],
      [2, 2],
    ],
    [
      [1, 1],
      [2, 1],
      [0, 2],
      [1, 2],
    ],
    [
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 2],
    ],
  ],
  Z: [
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [2, 1],
    ],
    [
      [2, 0],
      [1, 1],
      [2, 1],
      [1, 2],
    ],
    [
      [0, 1],
      [1, 1],
      [1, 2],
      [2, 2],
    ],
    [
      [1, 0],
      [0, 1],
      [1, 1],
      [0, 2],
    ],
  ],
  J: [
    [
      [0, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ],
    [
      [1, 0],
      [2, 0],
      [1, 1],
      [1, 2],
    ],
    [
      [0, 1],
      [1, 1],
      [2, 1],
      [2, 2],
    ],
    [
      [1, 0],
      [1, 1],
      [0, 2],
      [1, 2],
    ],
  ],
  L: [
    [
      [2, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ],
    [
      [1, 0],
      [1, 1],
      [1, 2],
      [2, 2],
    ],
    [
      [0, 1],
      [1, 1],
      [2, 1],
      [0, 2],
    ],
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [1, 2],
    ],
  ],
}

/**
 * Returns the absolute playfield cells (x, y) occupied by a piece at the
 * given origin and rotation.
 */
export function getPieceCells(kind: PieceKind, rotation: number, x: number, y: number): readonly Offset[] {
  const shape = SHAPES[kind][((rotation % 4) + 4) % 4]
  if (!shape) {
    throw new Error(`Invalid rotation ${rotation} for ${kind}`)
  }
  return shape.map(([dx, dy]) => [x + dx, y + dy] as const)
}
