/**
 * Chunky retro HUD panel. Mirrors the canvas primitives in
 * `render/panels.ts`: a solid white 4px frame around a black interior.
 * An optional pixel-font label is rendered above the panel at
 * LABEL_Y_OFFSET distance, horizontally centered on the panel.
 *
 * Position is given in stage coordinates (interior top-left). The
 * component absolutely positions itself to match, so its ancestor
 * must establish a positioning context (e.g. `.game-stage` with
 * `position: absolute`).
 */

import type { ReactNode, CSSProperties } from 'react'

import { FRAME_WIDTH, LABEL_Y_OFFSET } from '@/render/layout'

export type HudPanelProps = {
  /** Interior x in stage coords (same origin as `render/layout`). */
  readonly x: number
  /** Interior y in stage coords. */
  readonly y: number
  /** Interior width (inside the white frame). */
  readonly width: number
  /** Interior height (inside the white frame). */
  readonly height: number
  /** Optional pixel-font caption rendered above the panel. */
  readonly label?: string
  readonly children?: ReactNode
}

export function HudPanel({ x, y, width, height, label, children }: HudPanelProps) {
  const frameStyle: CSSProperties = {
    left: x - FRAME_WIDTH,
    top: y - FRAME_WIDTH,
    width: width + FRAME_WIDTH * 2,
    height: height + FRAME_WIDTH * 2,
  }
  const labelStyle: CSSProperties = {
    left: x,
    top: y - LABEL_Y_OFFSET,
    width,
  }
  return (
    <>
      {label && (
        <div className="hud-label" style={labelStyle}>
          {label}
        </div>
      )}
      <div className="hud-panel" style={frameStyle}>
        <div className="hud-panel-inner">{children}</div>
      </div>
    </>
  )
}
