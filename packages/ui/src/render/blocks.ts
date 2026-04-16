/**
 * Block rendering primitives: the beveled 8-bit block, the ghost
 * piece outline, and a helper that centers a spawn-orientation piece
 * inside a bounding box (used by Hold and Next panels).
 */

import type { PieceKind } from '@tetris/engine'
import { getPiecePreview, VISIBLE_TOP } from '@tetris/engine'

import { CELL_PX } from '@/constants'
import { PLAYFIELD_X, PLAYFIELD_Y } from '@/render/layout'
import { PIECE_COLORS, PIECE_COLORS_LIGHT, PIECE_COLORS_DARK } from '@/render/theme'

/** Bevel thickness (px) chosen for a given cell size. */
function bevelThicknessForCellSize(cellSize: number): number {
  if (cellSize >= 20) {
    return 4
  }
  if (cellSize >= 12) {
    return 3
  }
  return 2
}

/**
 * Draws a single beveled 8-bit block at `(pixelX, pixelY)`.
 *
 * Structure, from outermost to innermost:
 *   1. 1px black border.
 *   2. Bevel highlight on top and left edges.
 *   3. Bevel shadow on bottom and right edges.
 *   4. Base color in the center.
 *
 * The black border cleanly separates blocks from each other and the grid.
 * Bevel thickness scales with `size` so both gameplay-sized and preview-
 * sized blocks look coherent.
 */
export function drawBlock(
  context: CanvasRenderingContext2D,
  kind: PieceKind,
  pixelX: number,
  pixelY: number,
  cellSize: number,
  alpha = 1
): void {
  const baseColor = PIECE_COLORS[kind]
  const highlightColor = PIECE_COLORS_LIGHT[kind]
  const shadowColor = PIECE_COLORS_DARK[kind]
  const bevelThickness = bevelThicknessForCellSize(cellSize)

  context.globalAlpha = alpha

  context.fillStyle = '#000000'
  context.fillRect(pixelX, pixelY, cellSize, cellSize)

  context.fillStyle = highlightColor
  context.fillRect(pixelX + 1, pixelY + 1, cellSize - 2, cellSize - 2)

  context.fillStyle = shadowColor
  context.fillRect(pixelX + 1, pixelY + cellSize - 1 - bevelThickness, cellSize - 2, bevelThickness)
  context.fillRect(pixelX + cellSize - 1 - bevelThickness, pixelY + 1, bevelThickness, cellSize - 2)

  context.fillStyle = baseColor
  context.fillRect(
    pixelX + 1 + bevelThickness,
    pixelY + 1 + bevelThickness,
    cellSize - 2 - bevelThickness * 2,
    cellSize - 2 - bevelThickness * 2
  )

  context.globalAlpha = 1
}

/**
 * Draws the ghost piece, a 2px stroked outline per cell using the piece's
 * own color at 50% alpha. Same cell dimensions as real blocks, inset 2px so
 * the outline doesn't bleed into the playfield frame or grid.
 */
export function drawGhostPiece(
  context: CanvasRenderingContext2D,
  kind: PieceKind,
  cells: readonly (readonly [number, number])[]
): void {
  context.globalAlpha = 0.5
  context.strokeStyle = PIECE_COLORS[kind]
  context.lineWidth = 2
  for (const [boardCol, boardRow] of cells) {
    if (boardRow < VISIBLE_TOP) {
      continue
    }
    const pixelX = PLAYFIELD_X + boardCol * CELL_PX
    const pixelY = PLAYFIELD_Y + (boardRow - VISIBLE_TOP) * CELL_PX
    context.strokeRect(pixelX + 2, pixelY + 2, CELL_PX - 4, CELL_PX - 4)
  }
  context.globalAlpha = 1
}

/**
 * Centers a piece (spawn rotation) inside a bounding box. Used by the
 * Hold slot and Next-queue tiles; `cellSize` lets each callsite pick its
 * preferred block size.
 */
export function drawPieceInBox(
  context: CanvasRenderingContext2D,
  kind: PieceKind,
  boxX: number,
  boxY: number,
  boxWidth: number,
  boxHeight: number,
  cellSize: number
): void {
  const { cells, widthCells, heightCells, minX, minY } = getPiecePreview(kind)
  const originX = Math.floor(boxX + (boxWidth - widthCells * cellSize) / 2)
  const originY = Math.floor(boxY + (boxHeight - heightCells * cellSize) / 2)
  for (const [cellCol, cellRow] of cells) {
    const pixelX = originX + (cellCol - minX) * cellSize
    const pixelY = originY + (cellRow - minY) * cellSize
    drawBlock(context, kind, pixelX, pixelY, cellSize)
  }
}
