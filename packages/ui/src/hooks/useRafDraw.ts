/**
 * Render loop hook. Sets up the HiDPI canvas once, then drives the engine
 * tick and a redraw on every `requestAnimationFrame`. Cancels the frame
 * on unmount so a stale canvas is never drawn after teardown.
 */

import type { Engine } from '@tetris/engine'
import { useEffect, useRef } from 'react'

import { drawGame, createDrawContext, PLAYFIELD_CANVAS_WIDTH, PLAYFIELD_CANVAS_HEIGHT } from '@/render/canvas'
import { setupHiDpiCanvas } from '@/render/hidpi'

/**
 * Attaches a rAF-driven tick+draw loop to `canvasRef` for the lifetime
 * of the component. `reducedMotion` is threaded into the draw context so
 * individual renderers can opt out of animation.
 */
export function useRafDraw(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  engine: Engine,
  reducedMotion: boolean
): void {
  const frameHandleRef = useRef<number>(0)
  const lastFrameTimeRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    const context = setupHiDpiCanvas(canvas, {
      cssWidth: PLAYFIELD_CANVAS_WIDTH,
      cssHeight: PLAYFIELD_CANVAS_HEIGHT,
    })
    const drawContext = createDrawContext(canvas, context, reducedMotion)

    function renderFrame(currentTime: number): void {
      const previousTime = lastFrameTimeRef.current || currentTime
      const deltaMs = currentTime - previousTime
      lastFrameTimeRef.current = currentTime
      engine.tick(deltaMs)
      drawGame(drawContext, engine.getSnapshot(), deltaMs)
      frameHandleRef.current = requestAnimationFrame(renderFrame)
    }

    lastFrameTimeRef.current = 0
    frameHandleRef.current = requestAnimationFrame(renderFrame)

    return () => {
      cancelAnimationFrame(frameHandleRef.current)
    }
  }, [canvasRef, engine, reducedMotion])
}
