/**
 * Keeps the HTML+canvas game stage sized to the viewport while
 * preserving its native pixel design. The stage is drawn at its
 * intrinsic {@link STAGE_WIDTH} × {@link STAGE_HEIGHT}; this hook
 * computes the largest scale that fits (minus an 8px viewport
 * margin that matches the pre-existing canvas scaling rule) and
 * writes it to the `--stage-scale` CSS variable on both the stage
 * and its wrapper.
 */

import { useLayoutEffect } from 'react'
import type { RefObject } from 'react'

import { STAGE_WIDTH, STAGE_HEIGHT } from '@/render/layout'

const VIEWPORT_MARGIN_PX = 8
/**
 * When the largest fitting scale is within this much of an integer,
 * snap to that integer so a viewport that's a hair shy of the nominal
 * 1×, 2×, 3× size still gets pixel-aligned rendering.
 */
const INTEGER_SNAP_EPSILON = 0.02
/** CSS custom property both the wrapper and stage read to size themselves. */
const STAGE_SCALE_VAR = '--stage-scale'

/**
 * Picks the largest pixel-stable scale that fits the given available
 * space. Prefers an integer scale when one fits (so pixel fonts and
 * canvas bitmaps stay crisp under the CSS transform); falls back to a
 * fractional scale only when even 1× wouldn't fit.
 */
function pickStageScale(availableWidth: number, availableHeight: number): number {
  const rawScale = Math.min(availableWidth / STAGE_WIDTH, availableHeight / STAGE_HEIGHT)
  if (rawScale < 1) {
    return rawScale
  }
  const rounded = Math.round(rawScale)
  if (Math.abs(rawScale - rounded) < INTEGER_SNAP_EPSILON) {
    return rounded
  }
  return Math.floor(rawScale)
}

/**
 * Fits the native-pixel stage into the viewport. `useLayoutEffect`
 * avoids a one-frame flash at the unscaled size on first mount.
 *
 * Also observes devicePixelRatio changes via `matchMedia` so moving
 * the window between displays with different DPRs triggers a recompute.
 * Note: a one-frame unscaled flash is still possible under React
 * concurrent rendering; CSS falls back to `--stage-scale: 1` until the
 * first commit lands.
 */
export function useStageScale(
  stageRef: RefObject<HTMLElement | null>,
  wrapperRef: RefObject<HTMLElement | null>
): void {
  useLayoutEffect(() => {
    const stageElement = stageRef.current
    const wrapperElement = wrapperRef.current
    if (!stageElement || !wrapperElement) {
      return
    }

    function applyCurrentScale(): void {
      const availableWidth = window.innerWidth - VIEWPORT_MARGIN_PX
      const availableHeight = window.innerHeight - VIEWPORT_MARGIN_PX
      const scale = pickStageScale(availableWidth, availableHeight)
      const scaleValue = String(scale)
      stageElement?.style.setProperty(STAGE_SCALE_VAR, scaleValue)
      wrapperElement?.style.setProperty(STAGE_SCALE_VAR, scaleValue)
    }

    applyCurrentScale()
    window.addEventListener('resize', applyCurrentScale)

    // Re-run when the browser's pixel ratio changes (window moved to
    // a different-DPR display, OS accessibility zoom toggled, etc.).
    const dprQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
    dprQuery.addEventListener('change', applyCurrentScale)

    return () => {
      window.removeEventListener('resize', applyCurrentScale)
      dprQuery.removeEventListener('change', applyCurrentScale)
    }
    // Refs are stable objects, so this effect effectively runs once on
    // mount; listing them keeps the React hook linter satisfied.
  }, [stageRef, wrapperRef])
}
