/**
 * Configures a canvas for HiDPI / retina rendering: scales the backing
 * store by devicePixelRatio and applies a matching transform so logical
 * drawing coordinates stay in CSS pixels.
 */

/** Logical canvas size in CSS pixels. */
export type CanvasCssSize = {
  readonly cssWidth: number
  readonly cssHeight: number
}

/**
 * Resizes `canvas` for the current DPR, sets its CSS size, and returns
 * a 2D context pre-transformed so callers can draw in CSS pixels.
 * Throws if the context is unavailable (e.g. during SSR).
 */
export function setupHiDpiCanvas(canvas: HTMLCanvasElement, size: CanvasCssSize): CanvasRenderingContext2D {
  const devicePixelRatio = Math.max(1, window.devicePixelRatio || 1)
  canvas.width = Math.floor(size.cssWidth * devicePixelRatio)
  canvas.height = Math.floor(size.cssHeight * devicePixelRatio)
  canvas.style.width = `${size.cssWidth}px`
  canvas.style.height = `${size.cssHeight}px`
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('2D canvas context is unavailable')
  }
  context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0)
  return context
}
