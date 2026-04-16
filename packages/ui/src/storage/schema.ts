/**
 * Typed schema for data persisted to localStorage (settings + high
 * scores), plus type guards used to validate loaded JSON. Bumping
 * {@link STORAGE_SCHEMA_VERSION} is intentionally destructive: older
 * records fail the guard and are replaced with defaults.
 */

import type { KeyBinds } from '@/hooks/useKeyboard'

/** Current persisted-schema version; embedded in every stored record. */
export const STORAGE_SCHEMA_VERSION = 1

/** User settings snapshot persisted to localStorage. */
export type StoredSettings = {
  readonly version: 1
  readonly dasMs: number
  readonly arrMs: number
  readonly softDropFactor: number
  readonly sfxVolume: number
  readonly musicVolume: number
  readonly audioEnabled: boolean
  readonly reducedMotion: boolean
  readonly keyBinds: KeyBinds
  /** Marathon starting level (1 to 20). Defaults to 1. */
  readonly marathonStartLevel: number
}

/** One Marathon leaderboard row (higher score is better). */
export type MarathonScore = {
  readonly score: number
  readonly level: number
  readonly lines: number
  readonly timeMs: number
  readonly date: number
}

/** One Sprint leaderboard row (lower timeMs is better). */
export type SprintScore = {
  readonly timeMs: number
  readonly lines: number
  readonly date: number
}

/** One Ultra leaderboard row (higher score is better). */
export type UltraScore = {
  readonly score: number
  readonly lines: number
  readonly date: number
}

/** One Zen leaderboard row (more lines is better). */
export type ZenScore = {
  readonly lines: number
  readonly timeMs: number
  readonly date: number
}

/** Top-10 lists for all modes, versioned together. */
export type StoredHighScores = {
  readonly version: 1
  readonly marathon: readonly MarathonScore[]
  readonly sprint: readonly SprintScore[]
  readonly ultra: readonly UltraScore[]
  readonly zen: readonly ZenScore[]
}

/** Runtime type guard for {@link StoredSettings}; rejects legacy records. */
export function isStoredSettings(value: unknown): value is StoredSettings {
  if (!value || typeof value !== 'object') {
    return false
  }
  const candidate = value as Record<string, unknown>
  return (
    candidate.version === 1 &&
    typeof candidate.dasMs === 'number' &&
    typeof candidate.arrMs === 'number' &&
    typeof candidate.softDropFactor === 'number' &&
    typeof candidate.sfxVolume === 'number' &&
    typeof candidate.musicVolume === 'number' &&
    typeof candidate.audioEnabled === 'boolean' &&
    typeof candidate.reducedMotion === 'boolean' &&
    candidate.keyBinds !== null &&
    typeof candidate.keyBinds === 'object'
  )
}

/**
 * Runtime type guard for {@link StoredHighScores}; rejects legacy records.
 * The ultra and zen arrays are treated as optional for backward compatibility
 * with records written before those modes existed, callers should merge
 * against {@link DEFAULT_HIGH_SCORES} to fill in missing arrays.
 */
export function isStoredHighScores(value: unknown): value is StoredHighScores {
  if (!value || typeof value !== 'object') {
    return false
  }
  const candidate = value as Record<string, unknown>
  if (candidate.version !== 1) {
    return false
  }
  if (!Array.isArray(candidate.marathon) || !Array.isArray(candidate.sprint)) {
    return false
  }
  if (candidate.ultra !== undefined && !Array.isArray(candidate.ultra)) {
    return false
  }
  if (candidate.zen !== undefined && !Array.isArray(candidate.zen)) {
    return false
  }
  return true
}
