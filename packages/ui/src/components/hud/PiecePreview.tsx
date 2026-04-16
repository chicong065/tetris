/**
 * Small canvas that renders a single tetromino preview, centered inside
 * a box. Reuses {@link drawPieceInBox} from `render/blocks.ts` so the
 * bevelled block pixels are byte-identical to the playfield's.
 *
 * Two-phase lifecycle to keep redraws cheap: the HiDPI canvas backing
 * buffer is rebuilt only when dimensions change, while the piece
 * redraw runs whenever kind / cellSize / alpha change. Both use
 * {@link useLayoutEffect} so the canvas paints synchronously with the
 * React commit — no one-frame blank preview on mount or prop change.
 */

import type { PieceKind } from '@tetris/engine'
import { useLayoutEffect, useRef } from 'react'

import { drawPieceInBox } from '@/render/blocks'
import { setupHiDpiCanvas } from '@/render/hidpi'

export type PiecePreviewProps = {
  readonly kind: PieceKind | null
  readonly width: number
  readonly height: number
  readonly cellSize: number
  readonly alpha?: number
}

export function PiecePreview({ kind, width, height, cellSize, alpha = 1 }: PiecePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Size the HiDPI backing store when dimensions change. Resetting the
  // canvas width/height clears its contents, so a redraw is always
  // needed right after.
  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    const context = setupHiDpiCanvas(canvas, { cssWidth: width, cssHeight: height })
    context.imageSmoothingEnabled = false
  }, [width, height])

  // Draw the piece whenever its identity or styling changes. Runs after
  // the sizing effect on mount so the canvas is ready.
  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    const context = canvas.getContext('2d')
    if (!context) {
      return
    }
    context.clearRect(0, 0, width, height)
    if (!kind) {
      return
    }
    context.globalAlpha = alpha
    drawPieceInBox(context, kind, 0, 0, width, height, cellSize)
    context.globalAlpha = 1
  }, [kind, width, height, cellSize, alpha])

  return <canvas ref={canvasRef} className="piece-preview" style={{ width, height }} />
}
