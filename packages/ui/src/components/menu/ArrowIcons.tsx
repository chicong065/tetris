/**
 * Pixel-art arrow icons hand-drawn as 1×1 SVG rects on a 5×5 grid.
 * Used by the Marathon level picker and the key-hint footer; their
 * displayed size is controlled by per-context CSS (`.pixel-arrow`).
 */

const ARROW_VIEWBOX = '0 0 5 5'

export function ArrowLeftIcon() {
  return (
    <svg
      className="pixel-arrow"
      viewBox={ARROW_VIEWBOX}
      xmlns="http://www.w3.org/2000/svg"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      <rect x="2" y="0" width="1" height="1" fill="currentColor" />
      <rect x="1" y="1" width="4" height="1" fill="currentColor" />
      <rect x="0" y="2" width="5" height="1" fill="currentColor" />
      <rect x="1" y="3" width="4" height="1" fill="currentColor" />
      <rect x="2" y="4" width="1" height="1" fill="currentColor" />
    </svg>
  )
}

export function ArrowRightIcon() {
  return (
    <svg
      className="pixel-arrow"
      viewBox={ARROW_VIEWBOX}
      xmlns="http://www.w3.org/2000/svg"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      <rect x="2" y="0" width="1" height="1" fill="currentColor" />
      <rect x="0" y="1" width="4" height="1" fill="currentColor" />
      <rect x="0" y="2" width="5" height="1" fill="currentColor" />
      <rect x="0" y="3" width="4" height="1" fill="currentColor" />
      <rect x="2" y="4" width="1" height="1" fill="currentColor" />
    </svg>
  )
}

export function ArrowDownIcon() {
  return (
    <svg
      className="pixel-arrow"
      viewBox={ARROW_VIEWBOX}
      xmlns="http://www.w3.org/2000/svg"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      <rect x="1" y="0" width="3" height="2" fill="currentColor" />
      <rect x="0" y="2" width="5" height="1" fill="currentColor" />
      <rect x="1" y="3" width="3" height="1" fill="currentColor" />
      <rect x="2" y="4" width="1" height="1" fill="currentColor" />
    </svg>
  )
}
