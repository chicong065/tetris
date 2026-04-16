/**
 * Engine orchestrator, owns the GameState, dispatches inputs, runs the
 * fixed-timestep tick loop, and notifies subscribers. All substantive
 * logic delegates to the focused modules (board/rotation/gravity/etc);
 * this file is the glue that sequences them.
 */

import { createBag, takeNextPiece, refillBag } from '@engine/bag'
import { createEmptyBoard, canPlacePiece, lockPiece, clearFullRows, isBoardEmpty, isAboveVisible } from '@engine/board'
import {
  VISIBLE_TOP,
  SPAWN_X,
  SPAWN_Y,
  TICK_MS,
  MAX_CATCHUP_MS,
  NEXT_QUEUE_SIZE,
  DEFAULT_DAS_MS,
  DEFAULT_ARR_MS,
  DEFAULT_SOFT_DROP_FACTOR,
  LINE_CLEAR_ANIM_MS,
  SOFT_DROP_MIN_MS_PER_ROW,
} from '@engine/constants'
import { createEventEmitter, type EventEmitter } from '@engine/events'
import { resolveGravity } from '@engine/gravity'
import { initialAutoshift, tickAutoshift, pressDirection, releaseDirection } from '@engine/input'
import { tickLockTimer, shouldLock, resetLockOnMove, clearLockTimer } from '@engine/lockDelay'
import { marathonLevel } from '@engine/modes/marathon'
import { sprintFinishCheck } from '@engine/modes/sprint'
import { ultraFinishCheck, DEFAULT_ULTRA_DURATION_MS } from '@engine/modes/ultra'
import { clearTopForZenSpawn } from '@engine/modes/zen'
import { tryRotate } from '@engine/rotation'
import { computeLineClearScore, computeDropScore } from '@engine/scoring'
import { detectTspin } from '@engine/tspin'
import type {
  GameState,
  ActivePiece,
  PieceKind,
  GameMode,
  Input,
  EngineSettings,
  ClearInfo,
  TSpinKind,
  StartGameOptions,
  GravityFunction,
  GravityPreset,
  SerializedState,
  RecordedInput,
  EngineEvents,
  Playfield,
  RotationDirection,
} from '@engine/types'
/** Compile-time exhaustiveness helper: reached only if a case is missed. */
function assertNeverInput(value: never): never {
  throw new Error(`Unhandled input: ${String(value)}`)
}

// ─── Types ─────────────────────────────────────────────────────────────

/**
 * Options accepted by {@link createEngine}. `seed` and `settings` seed
 * initial state; `gravity` swaps out the level-to-ms curve; `restore`
 * boots the engine directly from a previously serialised snapshot.
 */
export type EngineOptions = {
  readonly seed?: number
  readonly settings?: Partial<EngineSettings>
  /** Custom gravity curve or named preset. Defaults to `'guideline'`. */
  readonly gravity?: GravityFunction | GravityPreset
  /**
   * Bootstraps the engine from a snapshot produced by
   * {@link Engine.serialize}. `seed` is ignored when `restore` is present.
   */
  readonly restore?: SerializedState
}

/**
 * Public engine handle: a small imperative facade around the reducer,
 * tick loop, events, and lifecycle. Advanced users can still
 * {@link Engine.dispatch} raw {@link Input} values; the convenience
 * methods below are thin wrappers.
 */
export type Engine = {
  /** Returns the current immutable snapshot. */
  readonly getSnapshot: () => GameState
  /** Subscribes to state changes; returns the unsubscribe callback. */
  readonly subscribe: (listener: () => void) => () => void
  /** Queues a raw input to be applied on the next tick. */
  readonly dispatch: (input: Input) => void
  /** Advances the simulation by `deltaMs` of real time. */
  readonly tick: (deltaMs: number) => void
  /**
   * Starts a fresh session with the given options. Clears the input log
   * and resets elapsed time.
   */
  readonly startGame: (options: StartGameOptions) => void
  /** Merges a partial settings override into the current configuration. */
  readonly configure: (partial: Partial<EngineSettings>) => void
  /** Tears down the engine: clears listeners, subscribers, and queues. */
  readonly destroy: () => void

  /** Dispatches a `moveLeftPress` input. */
  readonly moveLeft: () => void
  /** Dispatches a `moveLeftRelease` input. */
  readonly releaseMoveLeft: () => void
  /** Dispatches a `moveRightPress` input. */
  readonly moveRight: () => void
  /** Dispatches a `moveRightRelease` input. */
  readonly releaseMoveRight: () => void
  /** Dispatches a `softDropPress` input. */
  readonly softDrop: () => void
  /** Dispatches a `softDropRelease` input. */
  readonly releaseSoftDrop: () => void
  /** Dispatches a `hardDrop` input. */
  readonly hardDrop: () => void
  /** Dispatches the rotation input matching `direction`. */
  readonly rotate: (direction: RotationDirection) => void
  /** Dispatches a `hold` input. */
  readonly hold: () => void
  /** Dispatches a `pause` input. */
  readonly pause: () => void
  /** Dispatches a `resume` input. */
  readonly resume: () => void
  /** Dispatches a `reset` input, restarting the current mode. */
  readonly reset: () => void

  /**
   * Registers an event handler. The returned callback unsubscribes; you
   * can also call {@link Engine.off} with the same handler.
   */
  readonly on: <K extends keyof EngineEvents>(event: K, handler: (payload: EngineEvents[K]) => void) => () => void
  /** Removes a previously registered event handler. */
  readonly off: <K extends keyof EngineEvents>(event: K, handler: (payload: EngineEvents[K]) => void) => void

  /** Returns a schema-versioned snapshot suitable for persistence. */
  readonly serialize: () => SerializedState

  /** Returns the inputs recorded during the current session. */
  readonly getInputLog: () => ReadonlyArray<RecordedInput>
  /** Clears the recorded input log; called internally on `startGame`. */
  readonly clearInputLog: () => void
}

// ─── State construction ────────────────────────────────────────────────

/** Builds a full settings record from an optional partial override. */
function defaultSettings(overrides?: Partial<EngineSettings>): EngineSettings {
  return {
    dasMs: overrides?.dasMs ?? DEFAULT_DAS_MS,
    arrMs: overrides?.arrMs ?? DEFAULT_ARR_MS,
    softDropFactor: overrides?.softDropFactor ?? DEFAULT_SOFT_DROP_FACTOR,
  }
}

/**
 * Runtime fields that should be reset every time the game (re)starts.
 * Reused by both `initialState` (first boot) and `startSession` (reset).
 */
function freshRuntime() {
  return {
    board: createEmptyBoard(),
    active: null,
    hold: null,
    holdUsedThisTurn: false,
    queue: [] as readonly PieceKind[],
    score: 0,
    level: 1,
    lines: 0,
    combo: -1,
    backToBack: false,
    elapsedMs: 0,
    lastClear: null,
    gravityAccumulatorMs: 0,
    autoshift: initialAutoshift(),
    softDropping: false,
    lockCount: 0,
    durationMs: null as number | null,
  }
}

/** Boot-time game state. Phase starts at `menu`; no active piece yet. */
function initialState(mode: GameMode, seed: number): GameState {
  return {
    ...freshRuntime(),
    mode,
    phase: { kind: 'menu' },
    bag: createBag(seed),
  }
}

/** Fills the upcoming queue so there is always enough to show the Next UI. */
function ensureQueue(state: GameState): GameState {
  let bag = state.bag
  const queue = [...state.queue]
  while (queue.length < NEXT_QUEUE_SIZE + 1) {
    const refilled = refillBag(bag)
    const taken = takeNextPiece(refilled)
    queue.push(taken.piece)
    bag = taken.bag
  }
  return { ...state, bag, queue }
}

/**
 * Constructs a fresh ActivePiece at spawn and reports whether spawn itself
 * collides (block-out game over).
 */
function spawnActive(state: GameState, kind: PieceKind): { active: ActivePiece; blockOut: boolean } {
  const active: ActivePiece = {
    kind,
    rotation: 0,
    x: SPAWN_X,
    y: SPAWN_Y,
    lockTimerMs: 0,
    lockResets: 0,
    lowestY: SPAWN_Y,
    lastActionWasRotation: false,
  }
  const blockOut = !canPlacePiece(state.board, kind, 0, SPAWN_X, SPAWN_Y)
  return { active, blockOut }
}

/** Pops the first piece off the upcoming queue, refilling if needed. */
function popNextPiece(state: GameState): { state: GameState; next: PieceKind } {
  const ensured = ensureQueue(state)
  // ensureQueue guarantees queue.length >= NEXT_QUEUE_SIZE + 1, so the first
  // element is always defined.
  const [next, ...rest] = ensured.queue
  return { state: { ...ensured, queue: rest }, next: next! }
}

/**
 * Handles a block-out attempt. In Zen mode the top rows of the board are
 * wiped and the spawn is retried; every other mode transitions to a
 * block-out game-over.
 */
function resolveBlockOut(state: GameState, kind: PieceKind): GameState {
  if (state.mode === 'zen') {
    const rescuedBoard = clearTopForZenSpawn(state.board)
    const rescuedState: GameState = { ...state, board: rescuedBoard }
    const retry = spawnActive(rescuedState, kind)
    // Defensive: clearTopForZenSpawn cuts the spawn rows, so a second
    // block-out here would require a piece whose footprint spans the
    // newly-cleared rows AND the rows below them. Kept as a safety
    // hatch to guarantee zen never ends.
    if (retry.blockOut) {
      return rescuedState
    }
    return { ...rescuedState, active: retry.active }
  }
  return { ...state, active: null, phase: { kind: 'gameOver', reason: 'blockOut' } }
}

/**
 * Resets runtime state and spawns the first piece of a new session from a
 * fully-formed {@link StartGameOptions} record.
 */
function startSession(state: GameState, options: StartGameOptions): GameState {
  const { mode, startLevel, seed, presetBoard, durationMs } = options
  const base = freshRuntime()
  const startingLevel =
    mode === 'marathon' && startLevel !== undefined ? Math.max(1, Math.floor(startLevel)) : base.level
  const board = presetBoard ?? base.board
  const bag = seed !== undefined ? createBag(seed) : state.bag
  const sessionDuration = mode === 'ultra' ? (durationMs ?? DEFAULT_ULTRA_DURATION_MS) : null
  const fresh: GameState = {
    ...state,
    ...base,
    mode,
    board,
    bag,
    level: startingLevel,
    durationMs: sessionDuration,
    phase: { kind: 'playing' },
  }
  const withQueue = ensureQueue(fresh)
  const { state: afterPop, next } = popNextPiece(withQueue)
  const { active, blockOut } = spawnActive(afterPop, next)
  if (blockOut) {
    return resolveBlockOut(afterPop, next)
  }
  return { ...afterPop, active }
}

/** Replaces `state.active` without disturbing any other field. */
function withActive(state: GameState, active: ActivePiece): GameState {
  return { ...state, active }
}

// ─── Piece movement ────────────────────────────────────────────────────

/** Result of {@link tryMove}: next state, plus whether the move succeeded. */
type MoveResult = { readonly state: GameState; readonly moved: boolean }

/**
 * Attempts a translation by `(dx, dy)`. On success, updates the active
 * piece and handles lock-timer bookkeeping (reset-on-ground, clear
 * otherwise). Returns the input state unchanged when the move collides.
 * The returned `moved` flag tells callers whether to emit a pieceMove event.
 */
function tryMove(state: GameState, dx: number, dy: number): MoveResult {
  if (!state.active) return { state, moved: false }
  const { active } = state
  const nextX = active.x + dx
  const nextY = active.y + dy
  if (!canPlacePiece(state.board, active.kind, active.rotation, nextX, nextY)) {
    return { state, moved: false }
  }
  const touching = !canPlacePiece(state.board, active.kind, active.rotation, nextX, nextY + 1)
  const movedPiece: ActivePiece = {
    ...active,
    x: nextX,
    y: nextY,
    lastActionWasRotation: false,
  }
  if (touching) {
    return { state: withActive(state, resetLockOnMove(movedPiece, nextY)), moved: true }
  }
  return { state: withActive(state, { ...movedPiece, lockTimerMs: 0 }), moved: true }
}

/**
 * Attempts an SRS rotation in the given direction. Sets
 * `lastActionWasRotation` for T-spin detection at lock time.
 */
/** Result of {@link tryRotateActive}: next state plus success flag. */
type RotateResult = { readonly state: GameState; readonly rotated: boolean }

function tryRotateActive(state: GameState, direction: RotationDirection): RotateResult {
  if (!state.active) return { state, rotated: false }
  const { active } = state
  const result = tryRotate(state.board, active.kind, active.rotation, active.x, active.y, direction)
  if (!result) return { state, rotated: false }
  const updated: ActivePiece = {
    ...active,
    rotation: result.rotation,
    x: result.x,
    y: result.y,
    lastActionWasRotation: true,
  }
  const touching = !canPlacePiece(state.board, updated.kind, updated.rotation, updated.x, updated.y + 1)
  if (touching) {
    return { state: withActive(state, resetLockOnMove(updated, updated.y)), rotated: true }
  }
  return { state: withActive(state, { ...updated, lockTimerMs: 0 }), rotated: true }
}

/** How many rows the piece can fall before it lands. */
function dropDistance(state: GameState, active: ActivePiece): number {
  let distance = 0
  while (canPlacePiece(state.board, active.kind, active.rotation, active.x, active.y + distance + 1)) {
    distance += 1
  }
  return distance
}

// ─── Side-effect buffer ────────────────────────────────────────────────

/**
 * Reducer-observable events collected during a single state transition.
 * We accumulate them in the returned `Transition` record instead of
 * emitting from inside the reducer so the emission order stays after
 * `setState` (listeners see the new snapshot).
 *
 * Repeating motion events (pieceMove, pieceRotate, softDropRow) use arrays
 * because a single tick can emit many of them, e.g. ARR-driven shifts or
 * multi-cell soft-drop advances.
 */
type PendingEvents = {
  pieceLock?: EngineEvents['pieceLock']
  lineClear?: EngineEvents['lineClear']
  levelUp?: EngineEvents['levelUp']
  gameOver?: EngineEvents['gameOver']
  tSpin?: EngineEvents['tSpin']
  hold?: EngineEvents['hold']
  pause?: true
  resume?: true
  reset?: true
  ultraFinished?: EngineEvents['ultraFinished']
  sprintFinished?: EngineEvents['sprintFinished']
  pieceMoves?: EngineEvents['pieceMove'][]
  pieceRotates?: EngineEvents['pieceRotate'][]
  pieceHardDrop?: EngineEvents['pieceHardDrop']
  softDropRows?: EngineEvents['softDropRow'][]
}

/** A next-state plus the events that should fire after it is committed. */
type Transition = { readonly state: GameState; readonly events: PendingEvents }

/** Returns a no-event transition wrapping `state`. */
function transition(state: GameState, events: PendingEvents = {}): Transition {
  return { state, events }
}

/**
 * Merges two pending-event bags. Singleton events use last-write-wins.
 * Array events (pieceMoves, pieceRotates, softDropRows) are concatenated
 * so a single tick can accumulate multiple emissions in dispatch order.
 */
function mergeEvents(left: PendingEvents, right: PendingEvents): PendingEvents {
  const merged: PendingEvents = { ...left, ...right }
  if (left.pieceMoves || right.pieceMoves) {
    merged.pieceMoves = [...(left.pieceMoves ?? []), ...(right.pieceMoves ?? [])]
  }
  if (left.pieceRotates || right.pieceRotates) {
    merged.pieceRotates = [...(left.pieceRotates ?? []), ...(right.pieceRotates ?? [])]
  }
  if (left.softDropRows || right.softDropRows) {
    merged.softDropRows = [...(left.softDropRows ?? []), ...(right.softDropRows ?? [])]
  }
  return merged
}

/**
 * Applies the collected events to the emitter in a stable order. Always
 * fires `pieceLock` first so downstream listeners that react to line
 * clears / level-ups have already seen the post-lock board.
 */
function flushEvents(events: PendingEvents, emitter: EventEmitter): void {
  if (events.pieceMoves) {
    for (const payload of events.pieceMoves) {
      emitter.emit('pieceMove', payload)
    }
  }
  if (events.pieceRotates) {
    for (const payload of events.pieceRotates) {
      emitter.emit('pieceRotate', payload)
    }
  }
  if (events.softDropRows) {
    for (const payload of events.softDropRows) {
      emitter.emit('softDropRow', payload)
    }
  }
  if (events.pieceHardDrop) emitter.emit('pieceHardDrop', events.pieceHardDrop)
  if (events.pieceLock) emitter.emit('pieceLock', events.pieceLock)
  if (events.hold) emitter.emit('hold', events.hold)
  if (events.tSpin) emitter.emit('tSpin', events.tSpin)
  if (events.lineClear) emitter.emit('lineClear', events.lineClear)
  if (events.levelUp) emitter.emit('levelUp', events.levelUp)
  if (events.sprintFinished) emitter.emit('sprintFinished', events.sprintFinished)
  if (events.ultraFinished) emitter.emit('ultraFinished', events.ultraFinished)
  if (events.pause) emitter.emit('pause', undefined)
  if (events.resume) emitter.emit('resume', undefined)
  if (events.reset) emitter.emit('reset', undefined)
  if (events.gameOver) emitter.emit('gameOver', events.gameOver)
}

// ─── Locking + line clears ─────────────────────────────────────────────

/** Instantly drops the piece to its landing row, awards drop points, and locks. */
function hardDropAndLock(state: GameState): Transition {
  if (!state.active) return transition(state)
  const distance = dropDistance(state, state.active)
  const dropped: ActivePiece = { ...state.active, y: state.active.y + distance, lastActionWasRotation: false }
  const droppedScore = state.score + computeDropScore('hard', distance)
  const lockTransition = lockAndAdvance({ ...state, active: dropped, score: droppedScore })
  // Emit pieceHardDrop ahead of the pieceLock that lockAndAdvance produced.
  return transition(
    lockTransition.state,
    mergeEvents({ pieceHardDrop: { cellsFallen: distance } }, lockTransition.events)
  )
}

/** Scans a board for full rows and returns their y-indexes in ascending order. */
function findFullRows(board: Playfield): readonly number[] {
  const rows: number[] = []
  for (let y = 0; y < board.length; y += 1) {
    const row = board[y]
    if (row && row.every((cell) => cell !== null)) {
      rows.push(y)
    }
  }
  return rows
}

/**
 * Locks the active piece into the board. When one or more rows are full,
 * enters the `lineClearAnim` phase (the animation plays for the configured
 * duration, then `finishLineClear` runs when the timer expires). Otherwise
 * spawns the next piece immediately.
 */
function lockAndAdvance(state: GameState): Transition {
  if (!state.active) return transition(state)
  const { active } = state
  const locked = lockPiece(state.board, active.kind, active.rotation, active.x, active.y)
  const pieceLockEvent: EngineEvents['pieceLock'] = { piece: active, board: locked }

  // Lock-out branch: only reachable when the piece's entire footprint
  // lies in the hidden vanish zone at lock time. Defensive terminal
  // path — natural play can trigger it with an extreme preset, but
  // it's not in the routine test matrix.
  if (isAboveVisible(active.kind, active.rotation, active.x, active.y, VISIBLE_TOP)) {
    if (state.mode === 'zen') {
      // Zen never ends: drop the piece into the board and continue.
      const afterLock: GameState = {
        ...state,
        board: locked,
        active: null,
        holdUsedThisTurn: false,
        lockCount: state.lockCount + 1,
      }
      return finishLineClear(afterLock, 'none', [], { pieceLock: pieceLockEvent })
    }
    const goEvent: EngineEvents['gameOver'] = { reason: 'lockOut' }
    return transition(
      { ...state, board: locked, active: null, phase: { kind: 'gameOver', reason: 'lockOut' } },
      { pieceLock: pieceLockEvent, gameOver: goEvent }
    )
  }
  const tSpin = detectTspin(state.board, active.kind, active.rotation, active.x, active.y, active.lastActionWasRotation)
  const fullRows = findFullRows(locked)

  const afterLockBase: GameState = {
    ...state,
    board: locked,
    active: null,
    holdUsedThisTurn: false,
    lockCount: state.lockCount + 1,
  }

  const pending: PendingEvents = { pieceLock: pieceLockEvent }
  // T-spin detection fires only on a very specific geometry (T piece
  // rotated into a 3-corner spot). Exercised by tspin unit tests at
  // the detector level; the event-wiring itself is trivial pass-through.
  if (tSpin !== 'none') {
    pending.tSpin = { kind: tSpin, lines: fullRows.length }
  }

  if (fullRows.length > 0) {
    return transition(
      {
        ...afterLockBase,
        phase: { kind: 'lineClearAnim' as const, rows: fullRows, animMs: 0, tSpin },
      },
      pending
    )
  }

  return finishLineClear(afterLockBase, tSpin, [], pending)
}

/**
 * Called when the line-clear animation ends (or immediately if no rows
 * were cleared). Removes full rows, computes scoring, checks mode
 * conditions, and spawns the next piece. `carryEvents` are pending events
 * from the lock transition that should fire after this flush.
 */
function finishLineClear(
  state: GameState,
  tSpin: TSpinKind,
  clearedRows: readonly number[],
  carryEvents: PendingEvents = {}
): Transition {
  const linesCleared = clearedRows.length
  const { board: afterClear } = linesCleared > 0 ? clearFullRows(state.board) : { board: state.board }
  const perfect = linesCleared > 0 && isBoardEmpty(afterClear)
  const score = computeLineClearScore({
    linesCleared,
    tSpin,
    level: state.level,
    combo: state.combo,
    backToBackActive: state.backToBack,
    isPerfectClear: perfect,
  })
  const totalLines = state.lines + linesCleared
  const nextLevel = state.mode === 'marathon' ? Math.max(state.level, marathonLevel(totalLines)) : state.level
  const lastClear: ClearInfo = {
    lines: linesCleared,
    tSpin,
    isBackToBack: score.backToBack && state.backToBack,
    combo: score.combo,
    isPerfectClear: perfect,
    points: score.points,
  }
  const afterLock: GameState = {
    ...state,
    board: afterClear,
    active: null,
    score: state.score + score.points,
    lines: totalLines,
    level: nextLevel,
    combo: score.combo,
    backToBack: score.backToBack,
    lastClear,
    holdUsedThisTurn: false,
    phase: { kind: 'playing' },
  }

  const events: PendingEvents = { ...carryEvents }
  if (linesCleared > 0) {
    events.lineClear = lastClear
  }
  // levelUp only fires on a 10-line threshold crossing from a single
  // lock; requires a combined Tetris-clear path the suite doesn't
  // replay in one lock.
  if (nextLevel > state.level) {
    events.levelUp = { level: nextLevel }
  }

  // Sprint-finished dispatch: requires reaching the 40-line target.
  // The finish-check itself is covered by modes/sprint tests; this
  // wiring is the terminal dispatch.
  if (state.mode === 'sprint') {
    const sprint = sprintFinishCheck({ lines: totalLines, elapsedMs: afterLock.elapsedMs })
    if (sprint.finished) {
      return transition(
        { ...afterLock, phase: { kind: 'sprintFinished', timeMs: sprint.timeMs } },
        { ...events, sprintFinished: { timeMs: sprint.timeMs } }
      )
    }
  }
  const { state: afterPop, next } = popNextPiece(afterLock)
  const { active: nextActive, blockOut } = spawnActive(afterPop, next)
  // Defensive post-line-clear block-out: a clearing move just opened
  // rows, so the next spawn rarely collides. Reachable only with a
  // pathological preset (covered by the start-of-game block-out tests).
  if (blockOut) {
    if (state.mode === 'zen') {
      const rescued = resolveBlockOut(afterPop, next)
      return transition(rescued, events)
    }
    const gameOverEvents = mergeEvents(events, { gameOver: { reason: 'blockOut' } })
    return transition({ ...afterPop, active: null, phase: { kind: 'gameOver', reason: 'blockOut' } }, gameOverEvents)
  }
  return transition({ ...afterPop, active: nextActive }, events)
}

/**
 * Hold / swap. First use fills an empty hold slot and spawns the next
 * queued piece; subsequent uses swap the active piece with the held one.
 * The flag `holdUsedThisTurn` prevents spamming until the next lock.
 */
function holdSwap(state: GameState): Transition {
  if (!state.active || state.holdUsedThisTurn) return transition(state)
  const currentKind = state.active.kind
  const previousHold = state.hold
  if (state.hold === null) {
    const { state: afterPop, next } = popNextPiece(state)
    const { active, blockOut } = spawnActive(afterPop, next)
    // Defensive: block-out during the first-hold path requires the
    // next-queue piece to also collide with an already-crowded spawn
    // — virtually never reached (if it could, the previous spawn
    // would have block-outed first).
    if (blockOut) {
      if (state.mode === 'zen') {
        return transition({ ...resolveBlockOut(afterPop, next), hold: currentKind, holdUsedThisTurn: true })
      }
      return transition(
        { ...afterPop, active: null, phase: { kind: 'gameOver', reason: 'blockOut' } },
        { gameOver: { reason: 'blockOut' } }
      )
    }
    return transition(
      { ...afterPop, hold: currentKind, active, holdUsedThisTurn: true },
      { hold: { previous: previousHold, current: currentKind } }
    )
  }
  const { active, blockOut } = spawnActive(state, state.hold)
  // Symmetric to the first-hold branch above: the already-held piece
  // colliding at spawn is only reachable with a pathological preset.
  if (blockOut) {
    if (state.mode === 'zen') {
      return transition({ ...resolveBlockOut(state, state.hold), hold: currentKind, holdUsedThisTurn: true })
    }
    return transition(
      { ...state, active: null, phase: { kind: 'gameOver', reason: 'blockOut' } },
      { gameOver: { reason: 'blockOut' } }
    )
  }
  return transition(
    { ...state, hold: currentKind, active, holdUsedThisTurn: true },
    { hold: { previous: previousHold, current: currentKind } }
  )
}

// ─── Input reducer ─────────────────────────────────────────────────────

/**
 * Reducer for a single input event. `reset` is always honoured; during
 * line-clear animation all inputs are ignored (the anim is only 500 ms);
 * outside `playing` phase only `resume` from `paused` does anything.
 */
function applyInput(
  state: GameState,
  input: Input,
  _settings: EngineSettings,
  lastStartOptions: StartGameOptions
): Transition {
  if (input.kind === 'reset') {
    const restarted = startSession(state, lastStartOptions)
    return transition(restarted, { reset: true })
  }
  // During line-clear animation, block all inputs (animation is only 500ms).
  if (state.phase.kind === 'lineClearAnim') {
    return transition(state)
  }
  if (state.phase.kind !== 'playing') {
    if (input.kind === 'resume' && state.phase.kind === 'paused') {
      return transition({ ...state, phase: { kind: 'playing' } }, { resume: true })
    }
    return transition(state)
  }
  switch (input.kind) {
    case 'moveLeftPress': {
      const result = pressDirection(state.autoshift, 'left')
      let next: GameState = { ...state, autoshift: result.state }
      const pieceMoves: EngineEvents['pieceMove'][] = []
      for (let moveIndex = 0; moveIndex < result.emits; moveIndex += 1) {
        const moveResult = tryMove(next, -1, 0)
        next = moveResult.state
        if (moveResult.moved) {
          pieceMoves.push({ direction: 'left' })
        }
      }
      return transition(next, pieceMoves.length > 0 ? { pieceMoves } : {})
    }
    case 'moveRightPress': {
      const result = pressDirection(state.autoshift, 'right')
      let next: GameState = { ...state, autoshift: result.state }
      const pieceMoves: EngineEvents['pieceMove'][] = []
      for (let moveIndex = 0; moveIndex < result.emits; moveIndex += 1) {
        const moveResult = tryMove(next, 1, 0)
        next = moveResult.state
        if (moveResult.moved) {
          pieceMoves.push({ direction: 'right' })
        }
      }
      return transition(next, pieceMoves.length > 0 ? { pieceMoves } : {})
    }
    case 'moveLeftRelease':
      return transition({ ...state, autoshift: releaseDirection(state.autoshift, 'left') })
    case 'moveRightRelease':
      return transition({ ...state, autoshift: releaseDirection(state.autoshift, 'right') })
    // Reset the gravity accumulator on both softDropPress AND softDropRelease.
    // Without this, time accumulated under the previous (slower or faster)
    // gravity regime unleashes as a multi-row burst on the next tick after
    // the rate changes. Zeroing the accumulator keeps soft drop smooth.
    case 'softDropPress':
      return transition({ ...state, softDropping: true, gravityAccumulatorMs: 0 })
    case 'softDropRelease':
      return transition({ ...state, softDropping: false, gravityAccumulatorMs: 0 })
    case 'hardDrop':
      return hardDropAndLock(state)
    case 'rotateCW': {
      const rotateResult = tryRotateActive(state, 'cw')
      return transition(rotateResult.state, rotateResult.rotated ? { pieceRotates: [{ direction: 'cw' }] } : {})
    }
    case 'rotateCCW': {
      const rotateResult = tryRotateActive(state, 'ccw')
      return transition(rotateResult.state, rotateResult.rotated ? { pieceRotates: [{ direction: 'ccw' }] } : {})
    }
    case 'rotate180': {
      const rotateResult = tryRotateActive(state, '180')
      return transition(rotateResult.state, rotateResult.rotated ? { pieceRotates: [{ direction: '180' }] } : {})
    }
    case 'hold':
      return holdSwap(state)
    case 'pause':
      return transition({ ...state, phase: { kind: 'paused' } }, { pause: true })
    case 'resume':
      return transition(state)
    default:
      return assertNeverInput(input)
  }
}

// ─── Tick loop ─────────────────────────────────────────────────────────

/**
 * Advances gravity by `deltaMs`, possibly dropping the piece by one or
 * more rows. At 20G (level 20+) gravity is instant: the piece snaps to
 * its landing row in a single call.
 */
/** Result of {@link applyGravity}: next state plus rows the piece fell. */
type GravityResult = {
  readonly state: GameState
  /** Total cells the piece advanced this tick (0 when nothing moved). */
  readonly cellsFallen: number
  /** Whether the advance happened while the player was holding soft drop. */
  readonly softDropActive: boolean
}

function applyGravity(
  state: GameState,
  deltaMs: number,
  settings: EngineSettings,
  gravityFn: GravityFunction
): GravityResult {
  if (state.phase.kind !== 'playing' || !state.active) {
    return { state, cellsFallen: 0, softDropActive: false }
  }
  const baseMs = gravityFn(state.level)
  // Soft drop: divide gravity by the factor, then clamp with a minimum
  // floor so the piece stays visible even at high levels where base
  // gravity itself is already fast. Without the clamp, softDropFactor=20
  // at level 19 would produce 0.65 ms/row and one tick could drop the
  // piece to its landing row in a single visible frame.
  const effectiveMs = state.softDropping
    ? Math.max(SOFT_DROP_MIN_MS_PER_ROW, baseMs / Math.max(1, settings.softDropFactor))
    : baseMs
  // 20G gravity path: fires once the gravity curve hits level 20.
  // The `distance === 0` subbranch fires only during the single tick
  // the piece is already grounded under instant-gravity.
  if (effectiveMs === 0) {
    const distance = dropDistance(state, state.active)
    if (distance === 0) return { state, cellsFallen: 0, softDropActive: state.softDropping }
    const advanced = withActive(state, { ...state.active, y: state.active.y + distance, lastActionWasRotation: false })
    return { state: advanced, cellsFallen: distance, softDropActive: state.softDropping }
  }
  const accumulator = state.gravityAccumulatorMs + deltaMs
  if (accumulator < effectiveMs) {
    return {
      state: { ...state, gravityAccumulatorMs: accumulator },
      cellsFallen: 0,
      softDropActive: state.softDropping,
    }
  }
  const rows = Math.floor(accumulator / effectiveMs)
  const remainder = accumulator - rows * effectiveMs
  let targetY = state.active.y
  let dropped = 0
  for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
    if (canPlacePiece(state.board, state.active.kind, state.active.rotation, state.active.x, targetY + 1)) {
      targetY += 1
      dropped += 1
    } else {
      break
    }
  }
  const moved: ActivePiece = dropped === 0 ? state.active : { ...state.active, y: targetY }
  let next: GameState = { ...state, active: moved, gravityAccumulatorMs: remainder }
  if (state.softDropping && dropped > 0) {
    next = { ...next, score: next.score + computeDropScore('soft', dropped) }
  }
  if (moved.y > state.active.y) {
    // Gravity fall: update lowestY and clear the lock timer (piece is
    // airborne again), but preserve the lockResets counter so the
    // per-piece cap stays monotonic across airborne/grounded cycles.
    next = withActive(next, {
      ...moved,
      lowestY: Math.max(moved.lowestY, moved.y),
      lockTimerMs: 0,
      lastActionWasRotation: false,
    })
  }
  return { state: next, cellsFallen: dropped, softDropActive: state.softDropping }
}

/**
 * Ticks the lock timer while the piece is grounded; off the ground the
 * timer is zeroed. When the timer exceeds the grace window, locks the
 * piece and advances the turn.
 */
function applyLockDelay(state: GameState, deltaMs: number): Transition {
  if (state.phase.kind !== 'playing' || !state.active) return transition(state)
  const touching = !canPlacePiece(
    state.board,
    state.active.kind,
    state.active.rotation,
    state.active.x,
    state.active.y + 1
  )
  if (!touching) {
    return transition(withActive(state, clearLockTimer(state.active)))
  }
  const ticked = tickLockTimer(state.active, deltaMs)
  if (shouldLock(ticked)) {
    return lockAndAdvance({ ...state, active: ticked })
  }
  return transition(withActive(state, ticked))
}

/** Result of {@link applyAutoshift}: state plus the moves it produced. */
type AutoshiftApplyResult = {
  readonly state: GameState
  readonly pieceMoves: EngineEvents['pieceMove'][]
}

/** Advances DAS/ARR and applies any shifts it emits this tick. */
function applyAutoshift(state: GameState, deltaMs: number, settings: EngineSettings): AutoshiftApplyResult {
  if (state.phase.kind !== 'playing' || !state.active) {
    return { state, pieceMoves: [] }
  }
  const result = tickAutoshift(state.autoshift, deltaMs, settings)
  let next: GameState = { ...state, autoshift: result.state }
  const direction = state.autoshift.direction
  const pieceMoves: EngineEvents['pieceMove'][] = []
  const namedDirection = direction === -1 ? 'left' : direction === 1 ? 'right' : null
  for (let shiftIndex = 0; shiftIndex < result.emits; shiftIndex += 1) {
    const moveResult = tryMove(next, direction, 0)
    next = moveResult.state
    if (moveResult.moved && namedDirection) {
      pieceMoves.push({ direction: namedDirection })
    }
  }
  return { state: next, pieceMoves }
}

/**
 * One fixed-timestep simulation step. Advances elapsed time, autoshift,
 * gravity, and lock-delay in that order. During line-clear animation,
 * only the animation timer advances; when the animation expires, the
 * cleared rows are finalised and the next piece spawns.
 */
function stepOnce(state: GameState, settings: EngineSettings, gravityFn: GravityFunction): Transition {
  let pending: PendingEvents = {}
  let next = state

  // During line-clear animation: advance the timer, and when it expires
  // call finishLineClear to actually remove the rows and spawn next piece.
  if (next.phase.kind === 'lineClearAnim') {
    const phase = next.phase
    const newAnimMs = phase.animMs + TICK_MS
    if (newAnimMs >= LINE_CLEAR_ANIM_MS) {
      const finished = finishLineClear(next, phase.tSpin, phase.rows)
      return transition(finished.state, mergeEvents(pending, finished.events))
    }
    return transition(
      {
        ...next,
        phase: { ...phase, animMs: newAnimMs },
        elapsedMs: next.elapsedMs + TICK_MS,
      },
      pending
    )
  }

  if (next.phase.kind === 'playing') {
    next = { ...next, elapsedMs: next.elapsedMs + TICK_MS }
  }
  const autoshiftResult = applyAutoshift(next, TICK_MS, settings)
  next = autoshiftResult.state
  if (autoshiftResult.pieceMoves.length > 0) {
    pending = mergeEvents(pending, { pieceMoves: autoshiftResult.pieceMoves })
  }
  const gravityResult = applyGravity(next, TICK_MS, settings, gravityFn)
  next = gravityResult.state
  if (gravityResult.cellsFallen > 0 && gravityResult.softDropActive) {
    // Player-driven soft drop: emit one softDropRow per cell so the UI can
    // play a per-row tick. Natural gravity advancement (no soft drop) is
    // intentionally silent: those cells are background falls, not user input.
    const softRows: EngineEvents['softDropRow'][] = []
    for (let cellIndex = 0; cellIndex < gravityResult.cellsFallen; cellIndex += 1) {
      softRows.push({ cellsFallen: 1 })
    }
    pending = mergeEvents(pending, { softDropRows: softRows })
  }
  const lockResult = applyLockDelay(next, TICK_MS)
  next = lockResult.state
  pending = mergeEvents(pending, lockResult.events)

  // Ultra mode timer expiry: fires only while still in `playing` phase.
  if (next.mode === 'ultra' && next.phase.kind === 'playing' && next.durationMs !== null) {
    const check = ultraFinishCheck({ elapsedMs: next.elapsedMs, durationMs: next.durationMs })
    if (check.finished) {
      const ultraEvent: EngineEvents['ultraFinished'] = { score: next.score }
      next = {
        ...next,
        phase: { kind: 'ultraFinished', score: next.score, timeMs: check.timeMs },
      }
      pending = mergeEvents(pending, { ultraFinished: ultraEvent })
    }
  }

  return transition(next, pending)
}

// ─── Public engine API ─────────────────────────────────────────────────

/**
 * Builds a new engine instance.
 *
 * The returned {@link Engine} is a small imperative facade: callers
 * dispatch inputs (either via the convenience methods or
 * {@link Engine.dispatch}), call `tick(deltaMs)` from their render
 * loop, and read state via `getSnapshot` / `subscribe`.
 *
 * ## Initialization contract
 *
 * - If `options.restore` is provided, the returned engine resumes from
 *   that serialized snapshot (including the RNG seed and Marathon /
 *   Sprint / Ultra / Zen mode carried in the state). Otherwise the
 *   engine boots into `marathon` mode at level 1 and the `menu` phase,
 *   waiting for a `startGame()` call.
 * - `options.seed` seeds the 7-bag RNG; identical seeds across runs
 *   produce byte-identical piece sequences, so the engine is fully
 *   deterministic given the same input log.
 * - `options.settings` overrides DAS / ARR / soft-drop factor at
 *   construction time; these can be reconfigured later via
 *   {@link Engine.configure}. Fields left undefined use the
 *   `DEFAULT_*` constants from `@tetris/engine`.
 * - `options.gravity` accepts a custom gravity curve (either a function
 *   of level or a preset name). Omit for the Tetris-Guideline default.
 *
 * ## Lifecycle
 *
 * The engine holds no DOM / audio / timer resources of its own — it's
 * a pure state machine driven by external `tick` calls. On teardown,
 * call {@link Engine.destroy} to clear subscriber lists and pending
 * inputs so the instance is safe to discard.
 */
export function createEngine(options: EngineOptions = {}): Engine {
  let settings = defaultSettings(options.settings)
  const gravityFn: GravityFunction = resolveGravity(options.gravity)
  let state: GameState = options.restore ? options.restore.state : initialState('marathon', options.seed ?? Date.now())
  let lastStartOptions: StartGameOptions = { mode: state.mode }
  const listeners = new Set<() => void>()
  const emitter = createEventEmitter()
  const inputQueue: Input[] = []
  let inputLog: RecordedInput[] = []
  let accumulator = 0

  function notify(): void {
    for (const listener of listeners) {
      listener()
    }
  }

  function setState(next: GameState): boolean {
    if (next === state) {
      return false
    }
    state = next
    notify()
    return true
  }

  function commit(next: Transition): void {
    const changed = setState(next.state)
    if (changed) {
      flushEvents(next.events, emitter)
    } else if (hasEvents(next.events)) {
      flushEvents(next.events, emitter)
    }
  }

  function dispatchInput(input: Input): void {
    inputQueue.push(input)
  }

  const api: Engine = {
    getSnapshot: () => state,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    dispatch: dispatchInput,
    tick: (deltaMs) => {
      // Drain input queue first, recording each at its dispatch-time mark.
      let current = state
      let pending: PendingEvents = {}
      while (inputQueue.length > 0) {
        const input = inputQueue.shift()!
        inputLog.push({ input, atMs: current.elapsedMs })
        const applied = applyInput(current, input, settings, lastStartOptions)
        current = applied.state
        pending = mergeEvents(pending, applied.events)
      }
      // Fixed timestep
      const cappedDelta = Math.min(deltaMs, MAX_CATCHUP_MS)
      accumulator += cappedDelta
      while (accumulator >= TICK_MS) {
        const stepped = stepOnce(current, settings, gravityFn)
        current = stepped.state
        pending = mergeEvents(pending, stepped.events)
        accumulator -= TICK_MS
      }
      commit({ state: current, events: pending })
    },
    startGame: (startOptions) => {
      lastStartOptions = { ...startOptions }
      inputLog = []
      const next = startSession(state, startOptions)
      commit({ state: next, events: {} })
    },
    configure: (partial) => {
      settings = { ...settings, ...partial }
    },
    destroy: () => {
      listeners.clear()
      emitter.clear()
      inputQueue.length = 0
      inputLog = []
    },

    moveLeft: () => dispatchInput({ kind: 'moveLeftPress' }),
    releaseMoveLeft: () => dispatchInput({ kind: 'moveLeftRelease' }),
    moveRight: () => dispatchInput({ kind: 'moveRightPress' }),
    releaseMoveRight: () => dispatchInput({ kind: 'moveRightRelease' }),
    softDrop: () => dispatchInput({ kind: 'softDropPress' }),
    releaseSoftDrop: () => dispatchInput({ kind: 'softDropRelease' }),
    hardDrop: () => dispatchInput({ kind: 'hardDrop' }),
    rotate: (direction) => {
      if (direction === 'cw') dispatchInput({ kind: 'rotateCW' })
      else if (direction === 'ccw') dispatchInput({ kind: 'rotateCCW' })
      else dispatchInput({ kind: 'rotate180' })
    },
    hold: () => dispatchInput({ kind: 'hold' }),
    pause: () => dispatchInput({ kind: 'pause' }),
    resume: () => dispatchInput({ kind: 'resume' }),
    reset: () => dispatchInput({ kind: 'reset' }),

    on: (event, handler) => emitter.on(event, handler),
    off: (event, handler) => {
      emitter.off(event, handler)
    },

    serialize: () => ({ version: 1, state }),

    getInputLog: () => inputLog,
    clearInputLog: () => {
      inputLog = []
    },
  }

  return api
}

/** Returns true when any event-flag is set on `events`. */
function hasEvents(events: PendingEvents): boolean {
  return (
    events.pieceLock !== undefined ||
    events.lineClear !== undefined ||
    events.levelUp !== undefined ||
    events.gameOver !== undefined ||
    events.tSpin !== undefined ||
    events.hold !== undefined ||
    events.pause !== undefined ||
    events.resume !== undefined ||
    events.reset !== undefined ||
    events.ultraFinished !== undefined ||
    events.sprintFinished !== undefined ||
    (events.pieceMoves !== undefined && events.pieceMoves.length > 0) ||
    (events.pieceRotates !== undefined && events.pieceRotates.length > 0) ||
    events.pieceHardDrop !== undefined ||
    (events.softDropRows !== undefined && events.softDropRows.length > 0)
  )
}
