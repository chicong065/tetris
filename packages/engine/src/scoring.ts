/**
 * Guideline scoring: line clears with T-spin bonuses, back-to-back
 * multiplier, combo progression, and Perfect Clear bonuses. Also handles
 * soft- and hard-drop point awards. All numbers follow the published
 * Tetris Guideline tables.
 */

import type { TSpinKind } from '@engine/types'

/** Compile-time exhaustiveness helper: reached only if a case is missed. */
function assertNever(value: never): never {
  throw new Error(`Unhandled scoring action: ${String(value)}`)
}

/** Facts the scorer needs about a single lock event. */
export type ScoreInput = {
  readonly linesCleared: number
  readonly tSpin: TSpinKind
  readonly level: number
  readonly combo: number
  readonly backToBackActive: boolean
  readonly isPerfectClear: boolean
}

/** Output of the line-clear scorer: points earned and updated combo/B2B. */
export type ScoreResult = {
  readonly points: number
  readonly combo: number
  readonly backToBack: boolean
}

/** Discriminant for the scoring table, one entry per canonical action. */
type ActionKind =
  | 'nothing'
  | 'single'
  | 'double'
  | 'triple'
  | 'tetris'
  | 'tspinZero'
  | 'tspinSingle'
  | 'tspinDouble'
  | 'tspinTriple'
  | 'tspinMiniZero'
  | 'tspinMiniSingle'
  | 'tspinMiniDouble'

/** Maps raw clear counts + T-spin classification to a scoring action. */
function classify(input: ScoreInput): ActionKind {
  const { linesCleared, tSpin } = input
  if (tSpin === 'full') {
    if (linesCleared === 0) return 'tspinZero'
    if (linesCleared === 1) return 'tspinSingle'
    if (linesCleared === 2) return 'tspinDouble'
    if (linesCleared === 3) return 'tspinTriple'
  }
  if (tSpin === 'mini') {
    if (linesCleared === 0) return 'tspinMiniZero'
    if (linesCleared === 1) return 'tspinMiniSingle'
    if (linesCleared === 2) return 'tspinMiniDouble'
  }
  if (linesCleared === 1) return 'single'
  if (linesCleared === 2) return 'double'
  if (linesCleared === 3) return 'triple'
  if (linesCleared === 4) return 'tetris'
  return 'nothing'
}

/** Base (level-1) point value per scoring action. */
function basePoints(action: ActionKind): number {
  switch (action) {
    case 'nothing':
      return 0
    case 'single':
      return 100
    case 'double':
      return 300
    case 'triple':
      return 500
    case 'tetris':
      return 800
    case 'tspinZero':
      return 400
    case 'tspinSingle':
      return 800
    case 'tspinDouble':
      return 1200
    case 'tspinTriple':
      return 1600
    case 'tspinMiniZero':
      return 100
    case 'tspinMiniSingle':
      return 200
    case 'tspinMiniDouble':
      return 400
    default:
      return assertNever(action)
  }
}

/** True if the action counts as "difficult" for back-to-back chaining. */
function isDifficult(action: ActionKind): boolean {
  return (
    action === 'tetris' ||
    action === 'tspinSingle' ||
    action === 'tspinDouble' ||
    action === 'tspinTriple' ||
    action === 'tspinMiniSingle' ||
    action === 'tspinMiniDouble'
  )
}

/** How many rows actually cleared for the purposes of combo/PC bonuses. */
function clearedLines(action: ActionKind): number {
  switch (action) {
    case 'nothing':
    case 'tspinZero':
    case 'tspinMiniZero':
      return 0
    case 'single':
    case 'tspinSingle':
    case 'tspinMiniSingle':
      return 1
    case 'double':
    case 'tspinDouble':
    case 'tspinMiniDouble':
      return 2
    case 'triple':
    case 'tspinTriple':
      return 3
    case 'tetris':
      return 4
    default:
      return assertNever(action)
  }
}

/**
 * Level-1 Perfect Clear bonus per number of lines cleared. The caller
 * only invokes this when at least one line cleared, so the 1..4 entries
 * are the inputs seen in practice; the `return 0` fallback stays as a
 * defensive guard for out-of-range inputs.
 */
function perfectClearBonus(lines: number): number {
  if (lines === 1) return 800
  if (lines === 2) return 1200
  if (lines === 3) return 1800
  if (lines === 4) return 2000
  return 0
}

/**
 * Computes the score earned for a single lock, and the resulting combo /
 * back-to-back state. No-line T-spins are a special case: they don't
 * extend the combo but also don't reset it.
 */
export function computeLineClearScore(input: ScoreInput): ScoreResult {
  const action = classify(input)
  const linesActuallyCleared = clearedLines(action)

  // No-line T-spins don't break combo but don't extend it either.
  if (linesActuallyCleared === 0) {
    const points = basePoints(action) * Math.max(1, input.level)
    const nextCombo = input.linesCleared > 0 ? input.combo : -1
    return {
      points,
      combo: nextCombo,
      backToBack: input.backToBackActive,
    }
  }

  const difficult = isDifficult(action)
  const b2bMultiplier = difficult && input.backToBackActive ? 1.5 : 1
  const base = Math.floor(basePoints(action) * Math.max(1, input.level) * b2bMultiplier)

  const nextCombo = input.combo + 1
  const comboBonus = nextCombo > 0 ? 50 * nextCombo * Math.max(1, input.level) : 0

  const pcBonus = input.isPerfectClear ? perfectClearBonus(linesActuallyCleared) * Math.max(1, input.level) : 0

  return {
    points: base + comboBonus + pcBonus,
    combo: nextCombo,
    backToBack: difficult,
  }
}

/** Points awarded for a soft (1/row) or hard (2/row) drop over `distance` rows. */
export function computeDropScore(kind: 'soft' | 'hard', distance: number): number {
  return kind === 'soft' ? distance : distance * 2
}
