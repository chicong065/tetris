/**
 * Core type definitions for the Tetris engine. All runtime state is
 * described here as readonly immutable records so the reducer/selectors
 * can rely on structural sharing. No runtime code lives in this file.
 */

/** One of the seven canonical tetrominoes (Standard Tetris notation). */
export type PieceKind = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L'

/** A single playfield cell: either a locked piece's kind or empty. */
export type Cell = PieceKind | null

/** Rotation index in the four-state SRS rotation system. */
export type Rotation = 0 | 1 | 2 | 3

/** Direction of a rotation request. */
export type RotationDirection = 'cw' | 'ccw' | '180'

/** Game mode selector. */
export type GameMode = 'marathon' | 'sprint' | 'ultra' | 'zen'

/** Immutable 2D grid of cells. Indexed as `board[y][x]` (y=0 is top). */
export type Playfield = ReadonlyArray<ReadonlyArray<Cell>>

/**
 * The currently-falling piece, including lock-delay bookkeeping needed by
 * the move-reset rule.
 *
 * `lowestY` tracks the deepest y the piece has ever reached; the lock
 * timer only resets while the piece is still descending below this mark.
 */
export type ActivePiece = {
  readonly kind: PieceKind
  readonly rotation: Rotation
  readonly x: number
  readonly y: number
  readonly lockTimerMs: number
  readonly lockResets: number
  readonly lowestY: number
  readonly lastActionWasRotation: boolean
}

/** 7-bag PRNG state plus the prefetched upcoming pieces. */
export type BagState = {
  readonly seed: number
  readonly upcoming: readonly PieceKind[]
}

/** Classification of the most recent lock (used for scoring and animation). */
export type TSpinKind = 'none' | 'mini' | 'full'

/** Summary of the most recent line clear, retained for HUD + scoring. */
export type ClearInfo = {
  readonly lines: number
  readonly tSpin: TSpinKind
  readonly isBackToBack: boolean
  readonly combo: number
  readonly isPerfectClear: boolean
  readonly points: number
}

/** Top-level phase of the game state machine. */
export type Phase =
  | { readonly kind: 'menu' }
  | { readonly kind: 'countdown'; readonly remainingMs: number }
  | { readonly kind: 'playing' }
  | { readonly kind: 'paused' }
  | {
      readonly kind: 'lineClearAnim'
      readonly rows: readonly number[]
      readonly animMs: number
      readonly tSpin: TSpinKind
    }
  | { readonly kind: 'gameOver'; readonly reason: 'lockOut' | 'blockOut' | 'topOut' }
  | { readonly kind: 'sprintFinished'; readonly timeMs: number }
  | {
      readonly kind: 'ultraFinished'
      readonly score: number
      readonly timeMs: number
    }

/**
 * The single source of truth for a running game. Everything the UI renders
 * or the reducer reads/writes lives on this record.
 */
export type GameState = {
  readonly mode: GameMode
  readonly phase: Phase
  readonly board: Playfield
  readonly active: ActivePiece | null
  readonly hold: PieceKind | null
  readonly holdUsedThisTurn: boolean
  readonly bag: BagState
  readonly queue: readonly PieceKind[]
  readonly score: number
  readonly level: number
  readonly lines: number
  readonly combo: number // -1 = no combo
  readonly backToBack: boolean
  readonly elapsedMs: number
  readonly lastClear: ClearInfo | null
  readonly gravityAccumulatorMs: number
  readonly autoshift: AutoshiftState
  readonly softDropping: boolean
  readonly lockCount: number
  /**
   * Mode-dependent session duration in milliseconds. Ultra uses this to
   * decide when the timer expires; other modes leave it `null` and ignore
   * it. Set by {@link StartGameOptions.durationMs} when a session starts.
   */
  readonly durationMs: number | null
}

/** DAS/ARR autoshift tracking for held left/right keys. */
export type AutoshiftState = {
  readonly direction: -1 | 0 | 1
  readonly chargedMs: number
  readonly arrAccumulatorMs: number
}

/**
 * Input event accepted by the engine reducer. Press/release pairs exist
 * for keys whose timing matters (DAS, soft drop); one-shots cover discrete
 * commands.
 */
export type Input =
  | { readonly kind: 'moveLeftPress' }
  | { readonly kind: 'moveLeftRelease' }
  | { readonly kind: 'moveRightPress' }
  | { readonly kind: 'moveRightRelease' }
  | { readonly kind: 'softDropPress' }
  | { readonly kind: 'softDropRelease' }
  | { readonly kind: 'hardDrop' }
  | { readonly kind: 'rotateCW' }
  | { readonly kind: 'rotateCCW' }
  | { readonly kind: 'rotate180' }
  | { readonly kind: 'hold' }
  | { readonly kind: 'pause' }
  | { readonly kind: 'resume' }
  | { readonly kind: 'reset' }

/** User-tunable handling parameters; defaults live in `constants.ts`. */
export type EngineSettings = {
  readonly dasMs: number
  readonly arrMs: number
  readonly softDropFactor: number
}

/**
 * Options for {@link Engine.startGame}. `mode` is required; every other
 * field is optional and falls back to the mode's canonical default.
 */
export type StartGameOptions = {
  readonly mode: GameMode
  /** Marathon starting level (defaults to 1). Ignored for other modes. */
  readonly startLevel?: number
  /** Overrides the engine's bag seed for this session. */
  readonly seed?: number
  /** Optional starting board state; defaults to an empty playfield. */
  readonly presetBoard?: Playfield
  /**
   * Ultra mode session length in milliseconds; defaults to 120000 (two
   * minutes). Accepted (but ignored) for other modes.
   */
  readonly durationMs?: number
}

/**
 * A function that maps a level to milliseconds-per-row for gravity.
 * A return value of `0` means 20G (piece snaps to landing instantly).
 */
export type GravityFunction = (level: number) => number

/**
 * Named preset for {@link createEngine}'s `gravity` option. Currently only
 * `'guideline'` is supported; future presets like `'nes'` or `'tgm'` can
 * slot in without a breaking change.
 */
export type GravityPreset = 'guideline'

/**
 * Schema-versioned envelope returned by {@link Engine.serialize}. Bump
 * `version` only on breaking changes to {@link GameState}'s shape.
 */
export type SerializedState = {
  readonly version: 1
  readonly state: GameState
}

/**
 * A recorded input event and the elapsed-time mark at which it was
 * dispatched. Replayed in order so a deterministic engine reproduces the
 * original session bit-for-bit.
 */
export type RecordedInput = {
  readonly input: Input
  /** Milliseconds since the current session started (state.elapsedMs). */
  readonly atMs: number
}

/**
 * Payload map for {@link Engine.on}. Each key is an event name; the
 * corresponding type is the payload delivered synchronously after the
 * relevant state transition.
 */
export type EngineEvents = {
  readonly pieceLock: { readonly piece: ActivePiece; readonly board: Playfield }
  readonly lineClear: ClearInfo
  readonly levelUp: { readonly level: number }
  readonly gameOver: { readonly reason: 'lockOut' | 'blockOut' | 'topOut' }
  readonly tSpin: { readonly kind: TSpinKind; readonly lines: number }
  readonly hold: { readonly previous: PieceKind | null; readonly current: PieceKind }
  readonly pause: void
  readonly resume: void
  readonly reset: void
  readonly ultraFinished: { readonly score: number }
  readonly sprintFinished: { readonly timeMs: number }
  /**
   * Fired on every successful piece move (one cell), whether from a direct
   * input dispatch, DAS/ARR auto-repeat, soft drop, or gravity in some
   * contexts. `direction` reports what happened.
   */
  readonly pieceMove: { readonly direction: 'left' | 'right' | 'down' }
  /** Fired on every successful rotation. */
  readonly pieceRotate: { readonly direction: RotationDirection }
  /** Fired once per hard drop, before the piece locks. */
  readonly pieceHardDrop: { readonly cellsFallen: number }
  /**
   * Fired once per soft-drop cell advancement. When the player holds the
   * down key, this fires repeatedly at the soft-drop rate.
   */
  readonly softDropRow: { readonly cellsFallen: number }
}
