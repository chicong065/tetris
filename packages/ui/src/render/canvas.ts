/**
 * Playfield canvas composition. `createDrawContext` wraps the canvas and
 * its 2D context into a pixel-art-ready draw handle (nearest-neighbour
 * sampling on); `drawGame` paints the playfield each frame. HUD panels
 * (Hold / Stats / Next) are rendered as HTML, outside this canvas.
 */

import type { GameState } from '@tetris/engine'

import { PLAYFIELD_CANVAS_WIDTH, PLAYFIELD_CANVAS_HEIGHT } from '@/render/layout'
import { drawPlayfield } from '@/render/playfield'

export { PLAYFIELD_CANVAS_WIDTH, PLAYFIELD_CANVAS_HEIGHT }

/** Bundle of handles passed to every per-frame draw call. */
export type DrawContext = {
  readonly canvas: HTMLCanvasElement
  readonly context: CanvasRenderingContext2D
  readonly reducedMotion: boolean
}

/**
 * Builds a {@link DrawContext}, disabling image smoothing so pixel-art
 * scaling stays crisp.
 */
export function createDrawContext(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  reducedMotion: boolean
): DrawContext {
  context.imageSmoothingEnabled = false
  return { canvas, context, reducedMotion }
}

/** Clears the playfield canvas and redraws it for the given state. */
export function drawGame(drawContext: DrawContext, state: GameState, _deltaMs: number): void {
  const { context } = drawContext
  context.clearRect(0, 0, PLAYFIELD_CANVAS_WIDTH, PLAYFIELD_CANVAS_HEIGHT)
  drawPlayfield(context, state)
}
