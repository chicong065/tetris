/**
 * Gravity curves. The canonical Guideline formula maps a level to
 * milliseconds-per-row. Named {@link GravityPreset}s and custom
 * {@link GravityFunction}s resolve to concrete functions here.
 */

import type { GravityFunction, GravityPreset } from '@engine/types'

/**
 * Returns milliseconds per row at the given level using the Tetris
 * Guideline formula `time_per_row = (0.8 − (level − 1) × 0.007)^(level − 1)`
 * seconds.
 *
 * Reference curve endpoints:
 *   level 1  to 1000 ms/row
 *   level 9  to  ~158 ms/row
 *   level 15 to  ~42 ms/row
 *   level 19 to  ~13 ms/row
 *   level 20+ to 0 ms/row (20G, piece snaps to landing row in one tick)
 */
export function gravityMsPerRow(level: number): number {
  const effectiveLevel = Math.max(1, Math.floor(level))
  if (effectiveLevel >= 20) {
    return 0
  }
  const seconds = Math.pow(0.8 - (effectiveLevel - 1) * 0.007, effectiveLevel - 1)
  return seconds * 1000
}

/**
 * Built-in gravity presets, keyed by {@link GravityPreset}. Currently
 * only the canonical Guideline curve is provided.
 */
export const GRAVITY_PRESETS: Record<GravityPreset, GravityFunction> = {
  guideline: gravityMsPerRow,
}

/**
 * Resolves the public `gravity` option to a concrete {@link GravityFunction}.
 * Accepts a preset name, an arbitrary function, or `undefined` (defaults
 * to the Guideline curve).
 */
export function resolveGravity(option: GravityFunction | GravityPreset | undefined): GravityFunction {
  if (typeof option === 'function') {
    return option
  }
  const presetName: GravityPreset = option ?? 'guideline'
  return GRAVITY_PRESETS[presetName]
}
