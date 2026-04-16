/**
 * T-spin detection using the Guideline 3-corner rule. Only T pieces whose
 * most recent action was a rotation are considered; everything else
 * returns `"none"`. Returns `"full"` when both front corners are blocked,
 * `"mini"` when the 3-corner count is met but the front corners are not.
 */

import { isCellBlocked } from '@engine/board'
import type { PieceKind, Playfield, Rotation, TSpinKind } from '@engine/types'

/**
 * Corners of a T-piece's 3x3 bounding box, in (dx, dy) local coordinates.
 * Index: 0 = top-left, 1 = top-right, 2 = bottom-left, 3 = bottom-right.
 */
const T_CORNERS: readonly (readonly [number, number])[] = [
  [0, 0],
  [2, 0],
  [0, 2],
  [2, 2],
]

/**
 * Which 2 corners are "front" (in the direction the T points) for each rotation.
 * R0 = points up (top corners). R1 = points right (right corners).
 * R2 = points down (bottom corners). R3 = points left (left corners).
 */
const FRONT_CORNERS: Record<Rotation, readonly [number, number]> = {
  0: [0, 1], // top-left, top-right
  1: [1, 3], // top-right, bottom-right
  2: [2, 3], // bottom-left, bottom-right
  3: [0, 2], // top-left, bottom-left
}

/**
 * Detects T-spin type using the 3-corner rule.
 *
 * Returns `none` if the piece is not T, the last action was not a rotation,
 * or fewer than 3 corners are blocked. Returns `full` when at least 3
 * corners are blocked AND both front corners are blocked. Returns `mini`
 * when at least 3 corners are blocked but NOT both front corners.
 */
export function detectTspin(
  board: Playfield,
  kind: PieceKind,
  rotation: Rotation,
  x: number,
  y: number,
  lastActionWasRotation: boolean
): TSpinKind {
  if (kind !== 'T') {
    return 'none'
  }
  if (!lastActionWasRotation) {
    return 'none'
  }
  const blockedCorners = T_CORNERS.map(([dx, dy]) => isCellBlocked(board, x + dx, y + dy))
  const blockedCount = blockedCorners.filter(Boolean).length
  if (blockedCount < 3) {
    return 'none'
  }
  const [frontA, frontB] = FRONT_CORNERS[rotation]
  const bothFrontBlocked = blockedCorners[frontA] && blockedCorners[frontB]
  return bothFrontBlocked ? 'full' : 'mini'
}
