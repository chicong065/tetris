/**
 * SRS rotation with wall-kick resolution. Includes the standard J/L/S/T/Z
 * kick table, the separate I-piece table, and the O-piece identity table.
 * Kick offsets are given in y-down coordinates (inverted from the
 * canonical SRS spec, which is y-up).
 */

import { canPlacePiece } from '@engine/board'
import type { PieceKind, Rotation, RotationDirection, Playfield } from '@engine/types'

type Offset = readonly [number, number]
type KickTable = readonly Offset[]

/** Kick transition key: e.g. "0->1" means rotating from R0 to R1 (CW). */
type KickKey = '0->1' | '1->0' | '1->2' | '2->1' | '2->3' | '3->2' | '3->0' | '0->3' | '0->2' | '2->0' | '1->3' | '3->1'

/**
 * Standard SRS kick table for J, L, S, T, Z pieces.
 * Values are in y-down coordinates (y inverted from the canonical SRS spec).
 */
const STANDARD_KICKS: Record<KickKey, KickTable> = {
  '0->1': [
    [0, 0],
    [-1, 0],
    [-1, -1],
    [0, 2],
    [-1, 2],
  ],
  '1->0': [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, -2],
    [1, -2],
  ],
  '1->2': [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, -2],
    [1, -2],
  ],
  '2->1': [
    [0, 0],
    [-1, 0],
    [-1, -1],
    [0, 2],
    [-1, 2],
  ],
  '2->3': [
    [0, 0],
    [1, 0],
    [1, -1],
    [0, 2],
    [1, 2],
  ],
  '3->2': [
    [0, 0],
    [-1, 0],
    [-1, 1],
    [0, -2],
    [-1, -2],
  ],
  '3->0': [
    [0, 0],
    [-1, 0],
    [-1, 1],
    [0, -2],
    [-1, -2],
  ],
  '0->3': [
    [0, 0],
    [1, 0],
    [1, -1],
    [0, 2],
    [1, 2],
  ],
  // 180° transitions, single no-kick test
  '0->2': [[0, 0]],
  '2->0': [[0, 0]],
  '1->3': [[0, 0]],
  '3->1': [[0, 0]],
}

/**
 * SRS kick table for the I piece. Values are y-down.
 */
const I_KICKS: Record<KickKey, KickTable> = {
  '0->1': [
    [0, 0],
    [-2, 0],
    [1, 0],
    [-2, 1],
    [1, -2],
  ],
  '1->0': [
    [0, 0],
    [2, 0],
    [-1, 0],
    [2, -1],
    [-1, 2],
  ],
  '1->2': [
    [0, 0],
    [-1, 0],
    [2, 0],
    [-1, -2],
    [2, 1],
  ],
  '2->1': [
    [0, 0],
    [1, 0],
    [-2, 0],
    [1, 2],
    [-2, -1],
  ],
  '2->3': [
    [0, 0],
    [2, 0],
    [-1, 0],
    [2, -1],
    [-1, 2],
  ],
  '3->2': [
    [0, 0],
    [-2, 0],
    [1, 0],
    [-2, 1],
    [1, -2],
  ],
  '3->0': [
    [0, 0],
    [1, 0],
    [-2, 0],
    [1, 2],
    [-2, -1],
  ],
  '0->3': [
    [0, 0],
    [-1, 0],
    [2, 0],
    [-1, -2],
    [2, 1],
  ],
  '0->2': [[0, 0]],
  '2->0': [[0, 0]],
  '1->3': [[0, 0]],
  '3->1': [[0, 0]],
}

/**
 * O piece has no kicks, rotation is visually a no-op.
 */
const O_KICKS: Record<KickKey, KickTable> = {
  '0->1': [[0, 0]],
  '1->0': [[0, 0]],
  '1->2': [[0, 0]],
  '2->1': [[0, 0]],
  '2->3': [[0, 0]],
  '3->2': [[0, 0]],
  '3->0': [[0, 0]],
  '0->3': [[0, 0]],
  '0->2': [[0, 0]],
  '2->0': [[0, 0]],
  '1->3': [[0, 0]],
  '3->1': [[0, 0]],
}

/** Returns the target rotation index for a requested direction. */
export function nextRotation(current: Rotation, direction: RotationDirection): Rotation {
  if (direction === 'cw') {
    return ((current + 1) % 4) as Rotation
  }
  if (direction === 'ccw') {
    return ((current + 3) % 4) as Rotation
  }
  return ((current + 2) % 4) as Rotation
}

/** Picks the appropriate kick table for the piece kind and transition. */
function kickTableFor(kind: PieceKind, from: Rotation, to: Rotation): KickTable {
  const key = `${from}->${to}` as KickKey
  if (kind === 'I') {
    return I_KICKS[key]
  }
  if (kind === 'O') {
    return O_KICKS[key]
  }
  return STANDARD_KICKS[key]
}

/**
 * Outcome of a successful rotation: the new rotation index, the kicked
 * position, and which row of the kick table (0-based) was accepted ,
 * the last fact is needed for T-spin detection and achievements.
 */
export type RotationResult = {
  readonly rotation: Rotation
  readonly x: number
  readonly y: number
  readonly kickIndex: number
}

/**
 * Attempts an SRS rotation, walking the kick table in order and returning
 * the first position that fits on the board. Returns null when every kick
 * test collides (the rotation is rejected).
 */
export function tryRotate(
  board: Playfield,
  kind: PieceKind,
  currentRotation: Rotation,
  x: number,
  y: number,
  direction: RotationDirection
): RotationResult | null {
  const target = nextRotation(currentRotation, direction)
  // Identity rotation (no orientation change) is a defensive guard for
  // future direction additions; current directions (cw/ccw/180) always
  // produce a different rotation index.
  if (target === currentRotation) {
    return { rotation: target, x, y, kickIndex: 0 }
  }
  const table = kickTableFor(kind, currentRotation, target)
  for (let testIndex = 0; testIndex < table.length; testIndex += 1) {
    const offset = table[testIndex]!
    const [dx, dy] = offset
    const testX = x + dx
    const testY = y + dy
    if (canPlacePiece(board, kind, target, testX, testY)) {
      return { rotation: target, x: testX, y: testY, kickIndex: testIndex }
    }
  }
  return null
}
