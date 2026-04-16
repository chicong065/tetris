/**
 * Public barrel for `@tetris/engine`. Re-exports the engine factory,
 * game-state/input types, the canonical piece tables + selectors, and
 * the tuning constants a consumer needs to build a compliant UI,
 * custom mode, or training tool. Everything else in `src/` is
 * implementation detail and not considered stable API.
 */

export type { Engine, EngineOptions } from '@engine/store'
export { createEngine } from '@engine/store'
export type {
  GameState,
  Phase,
  ActivePiece,
  PieceKind,
  Cell,
  Playfield,
  GameMode,
  Input,
  ClearInfo,
  TSpinKind,
  EngineSettings,
  Rotation,
  RotationDirection,
  StartGameOptions,
  GravityFunction,
  GravityPreset,
  SerializedState,
  RecordedInput,
  EngineEvents,
} from '@engine/types'
export { PIECE_KINDS, getPieceCells } from '@engine/pieces'
export {
  // Board geometry.
  BOARD_WIDTH,
  BOARD_HEIGHT,
  VISIBLE_HEIGHT,
  VISIBLE_TOP,
  // Lock-delay tuning.
  LOCK_DELAY_MS,
  LOCK_RESETS_MAX,
  // Animation.
  LINE_CLEAR_ANIM_MS,
  // Handling defaults.
  DEFAULT_DAS_MS,
  DEFAULT_ARR_MS,
  DEFAULT_SOFT_DROP_FACTOR,
  // Queue + mode tuning.
  NEXT_QUEUE_SIZE,
  SPRINT_TARGET_LINES,
  MARATHON_LINES_PER_LEVEL,
  MAX_LEVEL,
} from '@engine/constants'
export {
  getGhostY,
  getGhostCells,
  getPiecePreview,
  isPlaying,
  isPaused,
  isMenu,
  isGameOver,
  isClearing,
  isFinished,
} from '@engine/selectors'
export type { PiecePreview, Offset } from '@engine/selectors'
export { getPiecesPerSecond, getLinesPerMinute, getPlayTimeSeconds } from '@engine/stats'
export { gravityMsPerRow } from '@engine/gravity'
export { createReplayEngine } from '@engine/replay'
export type { ReplayEngineOptions } from '@engine/replay'
export { DEFAULT_ULTRA_DURATION_MS } from '@engine/modes/ultra'
