/**
 * localStorage persistence for user settings and top-10 leaderboards.
 * Reads are defensive (invalid/missing JSON to defaults); writes swallow
 * quota errors. High-score inserts return the inserted entry's rank so
 * the UI can flash the player's position.
 */

import { DEFAULT_DAS_MS, DEFAULT_ARR_MS, DEFAULT_SOFT_DROP_FACTOR } from '@tetris/engine'

import { STORAGE_KEYS } from '@/constants'
import { DEFAULT_BINDS } from '@/hooks/useKeyboard'
import {
  STORAGE_SCHEMA_VERSION,
  isStoredSettings,
  isStoredHighScores,
  type StoredSettings,
  type StoredHighScores,
  type MarathonScore,
  type SprintScore,
  type UltraScore,
  type ZenScore,
} from '@/storage/schema'

/**
 * Fallback settings used on a fresh install or when stored data is
 * invalid. Values are tuned against the modern Tetris consensus
 * (Tetr.io, Puyo Puyo Tetris, TETRIS.com) so a first-time player gets
 * a responsive but controllable default experience.
 *
 *   Handling (via engine constants):
 *     DAS 167 ms,  ARR 33 ms,  Soft Drop Factor 20
 *   Audio:
 *     Enabled by default. SFX at 50 percent, music at 30 percent.
 *   Accessibility:
 *     Reduced motion off by default (user opts in).
 *   Marathon:
 *     Start at level 1 (standard).
 */
export const DEFAULT_SETTINGS: StoredSettings = {
  version: STORAGE_SCHEMA_VERSION,
  dasMs: DEFAULT_DAS_MS,
  arrMs: DEFAULT_ARR_MS,
  softDropFactor: DEFAULT_SOFT_DROP_FACTOR,
  sfxVolume: 0.5,
  musicVolume: 0.3,
  audioEnabled: true,
  reducedMotion: false,
  keyBinds: DEFAULT_BINDS,
  marathonStartLevel: 1,
}

/** Empty leaderboards used on a fresh install. */
export const DEFAULT_HIGH_SCORES: StoredHighScores = {
  version: STORAGE_SCHEMA_VERSION,
  marathon: [],
  sprint: [],
  ultra: [],
  zen: [],
}

/** Reads + parses JSON from localStorage; returns null on any error. */
function safeRead(key: string): unknown {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/** Writes JSON to localStorage; swallows quota/availability errors. */
function safeWrite(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // quota exceeded or unavailable, ignore
  }
}

/** Loads persisted settings, merging onto defaults (handles partial records). */
export function loadSettings(): StoredSettings {
  const value = safeRead(STORAGE_KEYS.settings)
  if (isStoredSettings(value)) {
    return { ...DEFAULT_SETTINGS, ...value }
  }
  return DEFAULT_SETTINGS
}

/** Persists the current settings snapshot. */
export function saveSettings(settings: StoredSettings): void {
  safeWrite(STORAGE_KEYS.settings, settings)
}

/**
 * Loads the stored leaderboards, returning empty defaults if absent. Older
 * records written before Ultra and Zen existed have those arrays filled in
 * from {@link DEFAULT_HIGH_SCORES} so users don't lose their other scores.
 */
export function loadHighScores(): StoredHighScores {
  const value = safeRead(STORAGE_KEYS.highScores)
  if (isStoredHighScores(value)) {
    return {
      version: value.version,
      marathon: value.marathon,
      sprint: value.sprint,
      ultra: value.ultra ?? [],
      zen: value.zen ?? [],
    }
  }
  return DEFAULT_HIGH_SCORES
}

/**
 * Return payload of {@link addMarathonScore} / {@link addSprintScore}:
 * the updated scores record plus where the new entry landed. `rank` is
 * -1 when the entry didn't break into the top 10.
 */
export type ScoreAddResult<T> = {
  readonly scores: StoredHighScores
  /** Index of the inserted entry in the sorted list. -1 if it didn't make the top 10. */
  readonly rank: number
  readonly entry: T
}

/** Inserts a Marathon result, keeping only the top 10 by score. */
export function addMarathonScore(entry: MarathonScore): ScoreAddResult<MarathonScore> {
  const current = loadHighScores()
  const sorted = [...current.marathon, entry].toSorted((a, b) => b.score - a.score)
  const top = sorted.slice(0, 10)
  const rank = top.indexOf(entry)
  const scores: StoredHighScores = { ...current, marathon: top }
  safeWrite(STORAGE_KEYS.highScores, scores)
  return { scores, rank, entry }
}

/** Inserts a Sprint result, keeping only the top 10 by fastest time. */
export function addSprintScore(entry: SprintScore): ScoreAddResult<SprintScore> {
  const current = loadHighScores()
  const sorted = [...current.sprint, entry].toSorted((a, b) => a.timeMs - b.timeMs)
  const top = sorted.slice(0, 10)
  const rank = top.indexOf(entry)
  const scores: StoredHighScores = { ...current, sprint: top }
  safeWrite(STORAGE_KEYS.highScores, scores)
  return { scores, rank, entry }
}

/** Inserts an Ultra result, keeping only the top 10 by highest score. */
export function addUltraScore(entry: UltraScore): ScoreAddResult<UltraScore> {
  const current = loadHighScores()
  const sorted = [...current.ultra, entry].toSorted((a, b) => b.score - a.score)
  const top = sorted.slice(0, 10)
  const rank = top.indexOf(entry)
  const scores: StoredHighScores = { ...current, ultra: top }
  safeWrite(STORAGE_KEYS.highScores, scores)
  return { scores, rank, entry }
}

/** Inserts a Zen result, keeping only the top 10 by most lines cleared. */
export function addZenScore(entry: ZenScore): ScoreAddResult<ZenScore> {
  const current = loadHighScores()
  const sorted = [...current.zen, entry].toSorted((a, b) => b.lines - a.lines)
  const top = sorted.slice(0, 10)
  const rank = top.indexOf(entry)
  const scores: StoredHighScores = { ...current, zen: top }
  safeWrite(STORAGE_KEYS.highScores, scores)
  return { scores, rank, entry }
}
