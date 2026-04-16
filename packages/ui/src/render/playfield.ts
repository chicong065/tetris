/**
 * Playfield renderer: draws the grid, locked cells, active piece, and
 * ghost preview, plus the two-phase line-clear animation (brief white
 * flash, then pair-by-pair column-eating from the outside in).
 */

import type { GameState } from '@tetris/engine'
import {
  BOARD_WIDTH,
  VISIBLE_HEIGHT,
  VISIBLE_TOP,
  LINE_CLEAR_ANIM_MS,
  getGhostCells,
  getPieceCells,
  isPlaying,
} from '@tetris/engine'

import { CELL_PX } from '@/constants'
import { drawBlock, drawGhostPiece } from '@/render/blocks'
import { PLAYFIELD_X, PLAYFIELD_Y, PLAYFIELD_WIDTH, PLAYFIELD_HEIGHT } from '@/render/layout'
import { drawPanel } from '@/render/panels'
import { THEME } from '@/render/theme'

/**
 * Line-clear animation timing:
 *   Phase 1 (0, FLASH_END_MS):   cleared rows flash solid white, blinking
 *                                 every FLASH_BLINK_MS.
 *   Phase 2 (FLASH_END_MS, end): columns disappear pair-by-pair from the
 *                                 outside edges inward toward the center.
 */
const FLASH_END_MS = 120
const FLASH_BLINK_MS = 40
const COLLAPSE_STEPS = BOARD_WIDTH / 2

/** How many columns have been consumed from each edge at the given anim time. */
function columnsEatenAt(animationMs: number): number {
  if (animationMs < FLASH_END_MS) {
    return 0
  }
  const msPerStep = (LINE_CLEAR_ANIM_MS - FLASH_END_MS) / COLLAPSE_STEPS
  return Math.min(COLLAPSE_STEPS, Math.floor((animationMs - FLASH_END_MS) / msPerStep) + 1)
}

/**
 * Draws the faint internal grid lines inside the playfield frame.
 *
 * Loops span the full closed range (`0..BOARD_WIDTH` and `0..VISIBLE_HEIGHT`)
 * so the cells touching the inner border still have a visible gridline —
 * a piece moving through those cells then cannot appear to "erase" the
 * edge of the background during rotation/movement.
 */
function drawGrid(context: CanvasRenderingContext2D): void {
  context.strokeStyle = THEME.gridLine
  context.lineWidth = 1
  for (let columnIndex = 0; columnIndex <= BOARD_WIDTH; columnIndex += 1) {
    context.beginPath()
    context.moveTo(PLAYFIELD_X + columnIndex * CELL_PX + 0.5, PLAYFIELD_Y)
    context.lineTo(PLAYFIELD_X + columnIndex * CELL_PX + 0.5, PLAYFIELD_Y + PLAYFIELD_HEIGHT)
    context.stroke()
  }
  for (let rowIndex = 0; rowIndex <= VISIBLE_HEIGHT; rowIndex += 1) {
    context.beginPath()
    context.moveTo(PLAYFIELD_X, PLAYFIELD_Y + rowIndex * CELL_PX + 0.5)
    context.lineTo(PLAYFIELD_X + PLAYFIELD_WIDTH, PLAYFIELD_Y + rowIndex * CELL_PX + 0.5)
    context.stroke()
  }
}

/** Converts a board (column, row) pair to canvas (pixelX, pixelY). */
function cellToPixel(boardCol: number, boardRow: number): readonly [number, number] {
  const pixelX = PLAYFIELD_X + boardCol * CELL_PX
  const pixelY = PLAYFIELD_Y + (boardRow - VISIBLE_TOP) * CELL_PX
  return [pixelX, pixelY]
}

/**
 * Draws the locked board cells, applying the line-clear animation on the
 * rows currently being cleared.
 */
function drawBoardCells(
  context: CanvasRenderingContext2D,
  state: GameState,
  clearingRows: ReadonlySet<number> | null,
  columnsEaten: number,
  animationMs: number
): void {
  for (let boardRow = VISIBLE_TOP; boardRow < VISIBLE_TOP + VISIBLE_HEIGHT; boardRow += 1) {
    const rowCells = state.board[boardRow]
    if (!rowCells) {
      continue
    }
    const isRowClearing = clearingRows !== null && clearingRows.has(boardRow)
    for (let boardCol = 0; boardCol < BOARD_WIDTH; boardCol += 1) {
      const cellKind = rowCells[boardCol]
      if (cellKind === null || cellKind === undefined) {
        continue
      }
      const [pixelX, pixelY] = cellToPixel(boardCol, boardRow)

      if (!isRowClearing) {
        drawBlock(context, cellKind, pixelX, pixelY, CELL_PX)
        continue
      }

      if (animationMs < FLASH_END_MS) {
        const flashOn = Math.floor(animationMs / FLASH_BLINK_MS) % 2 === 0
        if (flashOn) {
          context.fillStyle = '#ffffff'
          context.fillRect(pixelX, pixelY, CELL_PX, CELL_PX)
        }
        continue
      }

      // Collapse phase: hide columns from edges inward.
      if (boardCol < columnsEaten || boardCol >= BOARD_WIDTH - columnsEaten) {
        continue
      }
      // Still-visible cells alternate white/normal each step for feedback.
      if (columnsEaten % 2 === 0) {
        context.fillStyle = '#ffffff'
        context.fillRect(pixelX, pixelY, CELL_PX, CELL_PX)
      } else {
        drawBlock(context, cellKind, pixelX, pixelY, CELL_PX)
      }
    }
  }
}

/** Draws the ghost piece, clipped to the playfield interior. */
function drawGhost(context: CanvasRenderingContext2D, state: GameState): void {
  if (!state.active || !isPlaying(state)) {
    return
  }
  const ghostCells = getGhostCells(state)
  if (ghostCells.length === 0) {
    return
  }
  context.save()
  context.beginPath()
  context.rect(PLAYFIELD_X, PLAYFIELD_Y, PLAYFIELD_WIDTH, PLAYFIELD_HEIGHT)
  context.clip()
  drawGhostPiece(context, state.active.kind, ghostCells)
  context.restore()
}

/** Draws the currently-falling (active) piece. */
function drawActivePiece(context: CanvasRenderingContext2D, state: GameState): void {
  if (!state.active) {
    return
  }
  const { kind, rotation, x, y } = state.active
  for (const [cellCol, cellRow] of getPieceCells(kind, rotation, x, y)) {
    if (cellRow < VISIBLE_TOP) {
      continue
    }
    const [pixelX, pixelY] = cellToPixel(cellCol, cellRow)
    drawBlock(context, kind, pixelX, pixelY, CELL_PX)
  }
}

/** Main playfield draw pass: panel, grid, cells, ghost, active piece. */
export function drawPlayfield(context: CanvasRenderingContext2D, state: GameState): void {
  drawPanel(context, PLAYFIELD_X, PLAYFIELD_Y, PLAYFIELD_WIDTH, PLAYFIELD_HEIGHT)
  drawGrid(context)

  const clearingRows = state.phase.kind === 'lineClearAnim' ? new Set(state.phase.rows) : null
  const animationMs = state.phase.kind === 'lineClearAnim' ? state.phase.animMs : 0
  const columnsEaten = clearingRows ? columnsEatenAt(animationMs) : 0

  drawBoardCells(context, state, clearingRows, columnsEaten, animationMs)
  drawGhost(context, state)
  drawActivePiece(context, state)
}
