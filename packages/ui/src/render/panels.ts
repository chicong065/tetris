/**
 * Primitives for the retro-framed UI panels (Hold / Next / Stats) plus
 * a pixel-font label helper used by every labelled panel.
 */

import { FRAME_WIDTH } from '@/render/layout'
import { THEME } from '@/render/theme'

const LABEL_FONT = `10px ${THEME.pixelFont}`

/**
 * Draws a chunky retro panel, a thick white frame around a solid inner
 * fill. No rounded corners, no gradients.
 */
export function drawPanel(
  context: CanvasRenderingContext2D,
  interiorX: number,
  interiorY: number,
  interiorWidth: number,
  interiorHeight: number
): void {
  context.fillStyle = THEME.panelBorder
  context.fillRect(
    interiorX - FRAME_WIDTH,
    interiorY - FRAME_WIDTH,
    interiorWidth + FRAME_WIDTH * 2,
    interiorHeight + FRAME_WIDTH * 2
  )
  context.fillStyle = THEME.panelBackground
  context.fillRect(interiorX, interiorY, interiorWidth, interiorHeight)
}

/**
 * Draws a horizontally-centered pixel-font label at `(centerX, y)`, using
 * the theme's dim text color by default. Used for panel captions (HOLD,
 * NEXT, etc.).
 */
export function drawPixelLabel(
  context: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  topY: number,
  color: string = THEME.textDim
): void {
  context.fillStyle = color
  context.font = LABEL_FONT
  context.textAlign = 'center'
  context.textBaseline = 'top'
  context.fillText(text, centerX, topY)
}
