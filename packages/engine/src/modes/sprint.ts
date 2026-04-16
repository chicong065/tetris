/**
 * Sprint mode helpers. The session ends the moment the player reaches
 * {@link SPRINT_TARGET_LINES} cleared lines; the elapsed time is captured
 * for the finish screen and leaderboard.
 */

import { SPRINT_TARGET_LINES } from '@engine/constants'

/** Inputs the sprint finish-check examines. */
export type SprintCheckInput = {
  readonly lines: number
  readonly elapsedMs: number
}

/** Either "still running" or "finished at elapsed time". */
export type SprintCheckResult = { readonly finished: false } | { readonly finished: true; readonly timeMs: number }

/** Returns whether the sprint goal has been hit, capturing finish time. */
export function sprintFinishCheck(input: SprintCheckInput): SprintCheckResult {
  if (input.lines >= SPRINT_TARGET_LINES) {
    return { finished: true, timeMs: input.elapsedMs }
  }
  return { finished: false }
}
