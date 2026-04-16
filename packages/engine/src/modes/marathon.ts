/**
 * Marathon mode helpers. Progression is determined purely from the total
 * cleared-line count; level caps at {@link MAX_LEVEL}.
 */

import { MARATHON_LINES_PER_LEVEL, MAX_LEVEL } from '@engine/constants'

/** Returns the Marathon level for a given cumulative line count. */
export function marathonLevel(totalLines: number): number {
  const raw = 1 + Math.floor(totalLines / MARATHON_LINES_PER_LEVEL)
  return Math.min(raw, MAX_LEVEL)
}
