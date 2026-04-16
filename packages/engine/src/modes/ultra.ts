/**
 * Ultra mode helpers. Ultra is a fixed-duration score attack: clear as
 * many lines (and stack as much score) as possible before the timer runs
 * out. Scoring and gravity mirror Marathon at the caller's chosen start
 * level.
 */

/** Default Ultra session length when {@link StartGameOptions.durationMs} is omitted. */
export const DEFAULT_ULTRA_DURATION_MS = 120_000

/** Inputs the Ultra finish-check examines. */
export type UltraCheckInput = {
  readonly elapsedMs: number
  readonly durationMs: number
}

/** Either "still running" or "finished at the configured duration". */
export type UltraCheckResult = { readonly finished: false } | { readonly finished: true; readonly timeMs: number }

/**
 * Returns whether the Ultra timer has expired. When the timer crosses the
 * duration boundary, the finish time is clamped to exactly `durationMs`
 * so leaderboards report a clean value.
 */
export function ultraFinishCheck(input: UltraCheckInput): UltraCheckResult {
  if (input.elapsedMs >= input.durationMs) {
    return { finished: true, timeMs: input.durationMs }
  }
  return { finished: false }
}
