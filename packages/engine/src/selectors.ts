/**
 * Pure read-only selectors over {@link GameState}. Computes derived view
 * data (ghost piece position/cells and spawn-orientation piece previews)
 * that the UI needs but the state itself does not store.
 */

import { canPlacePiece } from '@engine/board'
import { SHAPES, getPieceCells } from '@engine/pieces'
import type { GameState, PieceKind } from '@engine/types'

/** `[x, y]` pair in board coordinates. */
export type Offset = readonly [number, number]

/**
 * Computes the y-coordinate where the active piece would land if hard-dropped
 * now (same x, rotation). Returns null if no active piece.
 */
export function getGhostY(state: GameState): number | null {
  const active = state.active
  if (!active) return null
  let y = active.y
  while (canPlacePiece(state.board, active.kind, active.rotation, active.x, y + 1)) {
    y += 1
  }
  return y
}

/**
 * Returns the cells (absolute playfield coordinates) the active piece would
 * occupy at its ghost landing position. Returns an empty array if no ghost
 * exists (active piece is already at landing, or no active piece).
 */
export function getGhostCells(state: GameState): readonly Offset[] {
  const active = state.active
  if (!active) return []
  const ghostY = getGhostY(state)
  if (ghostY === null || ghostY === active.y) return []
  return getPieceCells(active.kind, active.rotation, active.x, ghostY)
}

/**
 * Geometry describing a piece preview (hold slot, next queue tile): the
 * cells of a piece in its spawn (rotation 0) orientation, along with the
 * tight bounding-box dimensions in grid cells. Used by the UI to size and
 * position previews without reaching into the raw `SHAPES` table.
 */
export type PiecePreview = {
  readonly cells: readonly Offset[]
  readonly widthCells: number
  readonly heightCells: number
  readonly minX: number
  readonly minY: number
}

/** True when the game is in the active `playing` phase. */
export function isPlaying(state: GameState): boolean {
  return state.phase.kind === 'playing'
}

/** True when the session is paused (no gravity, no input). */
export function isPaused(state: GameState): boolean {
  return state.phase.kind === 'paused'
}

/** True when the engine is sitting at the pre-game menu. */
export function isMenu(state: GameState): boolean {
  return state.phase.kind === 'menu'
}

/** True when the session ended via lock-out / block-out / top-out. */
export function isGameOver(state: GameState): boolean {
  return state.phase.kind === 'gameOver'
}

/** True during the brief line-clear animation window. */
export function isClearing(state: GameState): boolean {
  return state.phase.kind === 'lineClearAnim'
}

/**
 * True when the session is in any terminal phase (sprint goal reached,
 * ultra timer expired, or game-over).
 */
export function isFinished(state: GameState): boolean {
  const kind = state.phase.kind
  return kind === 'gameOver' || kind === 'sprintFinished' || kind === 'ultraFinished'
}

/** Returns the spawn-rotation cells plus the tight bounding box. */
export function getPiecePreview(kind: PieceKind): PiecePreview {
  const cells = SHAPES[kind][0]!
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const [dx, dy] of cells) {
    if (dx < minX) minX = dx
    if (dx > maxX) maxX = dx
    if (dy < minY) minY = dy
    if (dy > maxY) maxY = dy
  }
  return {
    cells,
    widthCells: maxX - minX + 1,
    heightCells: maxY - minY + 1,
    minX,
    minY,
  }
}
