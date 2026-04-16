/**
 * On-screen button row for mobile devices: hold, rotate CCW/CW, and
 * pause. Swipe and tap interactions live separately in {@link useTouch}.
 * Icons are pixel-art SVGs so they render crisply in Press Start 2P
 * layouts instead of falling back to the system font for missing glyphs.
 */

import type { Engine } from '@tetris/engine'

/** Props for {@link TouchControls}: the engine instance to dispatch to. */
export type TouchControlsProps = {
  readonly engine: Engine
}

function RotateCCWIcon() {
  return (
    <svg viewBox="0 0 9 9" xmlns="http://www.w3.org/2000/svg" shapeRendering="crispEdges" aria-hidden="true">
      <rect x="3" y="1" width="3" height="1" fill="currentColor" />
      <rect x="2" y="2" width="1" height="1" fill="currentColor" />
      <rect x="6" y="2" width="1" height="1" fill="currentColor" />
      <rect x="1" y="3" width="1" height="3" fill="currentColor" />
      <rect x="7" y="3" width="1" height="1" fill="currentColor" />
      <rect x="2" y="6" width="1" height="1" fill="currentColor" />
      <rect x="3" y="7" width="3" height="1" fill="currentColor" />
      <rect x="0" y="4" width="2" height="1" fill="currentColor" />
      <rect x="0" y="3" width="1" height="1" fill="currentColor" />
      <rect x="1" y="2" width="1" height="1" fill="currentColor" />
    </svg>
  )
}

function RotateCWIcon() {
  return (
    <svg viewBox="0 0 9 9" xmlns="http://www.w3.org/2000/svg" shapeRendering="crispEdges" aria-hidden="true">
      <rect x="3" y="1" width="3" height="1" fill="currentColor" />
      <rect x="2" y="2" width="1" height="1" fill="currentColor" />
      <rect x="6" y="2" width="1" height="1" fill="currentColor" />
      <rect x="1" y="3" width="1" height="1" fill="currentColor" />
      <rect x="7" y="3" width="1" height="3" fill="currentColor" />
      <rect x="6" y="6" width="1" height="1" fill="currentColor" />
      <rect x="3" y="7" width="3" height="1" fill="currentColor" />
      <rect x="7" y="4" width="2" height="1" fill="currentColor" />
      <rect x="8" y="3" width="1" height="1" fill="currentColor" />
      <rect x="7" y="2" width="1" height="1" fill="currentColor" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 7 9" xmlns="http://www.w3.org/2000/svg" shapeRendering="crispEdges" aria-hidden="true">
      <rect x="1" y="1" width="2" height="7" fill="currentColor" />
      <rect x="4" y="1" width="2" height="7" fill="currentColor" />
    </svg>
  )
}

/** Mobile-only tap button strip rendered beneath the game canvas. */
export function TouchControls({ engine }: TouchControlsProps) {
  return (
    <div className="touch-controls" aria-label="Touch controls">
      <button type="button" onClick={() => engine.hold()} aria-label="Hold">
        HOLD
      </button>
      <button type="button" onClick={() => engine.rotate('ccw')} aria-label="Rotate counter-clockwise">
        <RotateCCWIcon />
      </button>
      <button type="button" onClick={() => engine.rotate('cw')} aria-label="Rotate clockwise">
        <RotateCWIcon />
      </button>
      <button type="button" onClick={() => engine.pause()} aria-label="Pause">
        <PauseIcon />
      </button>
    </div>
  )
}
