/**
 * Display formatters for HUD values: elapsed time (mm:ss.cs) and
 * zero-padded score/level/lines counters. All are pure and side-effect
 * free so they can be called from render hot paths.
 */

/** `MM:SS.CC`, minutes, seconds, centiseconds, all zero-padded. */
export function formatTime(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const centiseconds = Math.floor((milliseconds % 1000) / 10)
  const paddedMinutes = minutes.toString().padStart(2, '0')
  const paddedSeconds = seconds.toString().padStart(2, '0')
  const paddedCentiseconds = centiseconds.toString().padStart(2, '0')
  return `${paddedMinutes}:${paddedSeconds}.${paddedCentiseconds}`
}

/** Zero-pads the score to at least 6 digits. */
export function padScore(value: number): string {
  return value.toString().padStart(6, '0')
}

/** Zero-pads the level to at least 2 digits. */
export function padLevel(value: number): string {
  return value.toString().padStart(2, '0')
}

/** Zero-pads the line count to at least 3 digits. */
export function padLines(value: number): string {
  return value.toString().padStart(3, '0')
}
