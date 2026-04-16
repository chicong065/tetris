# tetris-toolkit

A headless, deterministic, Guideline compliant Tetris game engine written in pure TypeScript with zero framework dependencies. The engine owns all game state, rules, and timing. You own the presentation layer (canvas, React, DOM, Three.js, game framework, or a server tick loop).

## Features

- **Guideline compliant** &mdash; SRS rotation with full wall kick tables (including dedicated I-piece kicks and 180 degree kicks), 7-bag randomizer, lock delay with move-reset cap, T-spin detection (3-corner rule, full vs mini), back-to-back bonus, combo counter, perfect clear bonus, Guideline scoring table, level-up progression with exponential gravity curve.
- **Deterministic and reproducible** &mdash; seeded PRNG, fixed-timestep tick loop, all state immutable. Same seed plus same inputs equals same result, bit for bit.
- **Built for integration** &mdash; Redux-style `dispatch`, React-friendly `getSnapshot` plus `subscribe` (works with `useSyncExternalStore`), and a typed event emitter for imperative UIs.
- **Replay API** &mdash; every input is recorded with its timestamp. Feed the log plus the original seed into `createReplayEngine` to replay a match exactly.
- **Serializable state** &mdash; snapshot the game to JSON and restore it later.
- **Multiple modes** &mdash; Marathon, Sprint (40 lines), Ultra (2 minute score attack), Zen (endless, no top-out).
- **Configurable** &mdash; custom gravity curves, DAS/ARR handling, starting level, preset starting board, and custom session duration.
- **Tiny** &mdash; under 10 KB gzipped, zero runtime dependencies.

## Install

```bash
npm install tetris-toolkit
# or
pnpm add tetris-toolkit
# or
yarn add tetris-toolkit
```

Requires Node.js 18 or higher for bundling. Ships both ESM and CommonJS.

## Quick start

```ts
import { createEngine, isPlaying } from 'tetris-toolkit'

const engine = createEngine({ seed: 42 })

engine.startGame({ mode: 'marathon' })

// Run a game loop; in a browser use requestAnimationFrame.
let previousTimestamp = performance.now()
function frame(now: number) {
  const deltaMs = now - previousTimestamp
  previousTimestamp = now
  engine.tick(deltaMs)

  const state = engine.getSnapshot()
  if (isPlaying(state)) {
    renderYourUi(state)
  }

  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)

// Wire up inputs:
document.addEventListener('keydown', (event) => {
  switch (event.code) {
    case 'ArrowLeft':
      engine.moveLeft()
      break
    case 'ArrowRight':
      engine.moveRight()
      break
    case 'ArrowDown':
      engine.softDrop()
      break
    case 'Space':
      engine.hardDrop()
      break
    case 'ArrowUp':
      engine.rotate('cw')
      break
    case 'KeyZ':
      engine.rotate('ccw')
      break
    case 'ShiftLeft':
      engine.hold()
      break
  }
})
document.addEventListener('keyup', (event) => {
  if (event.code === 'ArrowLeft') {
    engine.releaseMoveLeft()
  }
  if (event.code === 'ArrowRight') {
    engine.releaseMoveRight()
  }
  if (event.code === 'ArrowDown') {
    engine.releaseSoftDrop()
  }
})
```

## Core concepts

### The tick loop

The engine runs on a **fixed 240 Hz internal timestep** with a real-time accumulator. You call `engine.tick(deltaMs)` on every frame of your host loop (typically 60 Hz), and the engine catches up by running however many internal ticks are needed. Gravity, lock delay, autoshift, and the line-clear animation all advance during a tick. Renderers should read `engine.getSnapshot()` after ticking.

### State is immutable

`engine.getSnapshot()` returns a `GameState` record. Every field is `readonly` and structurally shared between ticks (new snapshots reuse unchanged subtrees). You can compare references to detect change without deep equality.

### Inputs go through `dispatch`

Inputs are queued on dispatch and applied on the next tick. The convenience methods (`moveLeft`, `rotate`, `hardDrop`, etc.) are thin wrappers over `dispatch`. Use whichever reads more naturally.

### Subscribing to changes

Two options:

- `subscribe(listener)` &mdash; fires whenever the snapshot changes. Works with React's `useSyncExternalStore`.
- `on(event, handler)` &mdash; fires on specific game events like `pieceLock`, `lineClear`, `gameOver`.

## API reference

### `createEngine(options?)`

```ts
createEngine(options?: EngineOptions): Engine

type EngineOptions = {
  seed?: number                                // PRNG seed. Default: Date.now()
  settings?: Partial<EngineSettings>
  gravity?: GravityFunction | GravityPreset    // Default: 'guideline'
  restore?: SerializedState                    // Rehydrate from engine.serialize()
}

type EngineSettings = {
  dasMs: number                                // Delayed Auto Shift. Default: 167
  arrMs: number                                // Auto Repeat Rate.   Default: 50
  softDropFactor: number                       // Soft drop gravity multiplier. Default: 20
}
```

### The `Engine` handle

#### Lifecycle

```ts
engine.startGame(options: StartGameOptions): void
engine.destroy(): void

type StartGameOptions = {
  mode: GameMode                // 'marathon' | 'sprint' | 'ultra' | 'zen'
  startLevel?: number           // Marathon only. Default: 1
  seed?: number                 // Re-seed the bag for this session
  presetBoard?: Playfield       // Start with this board state
  durationMs?: number           // Ultra session length. Default: 120_000
}
```

#### State reads

```ts
engine.getSnapshot(): GameState
engine.serialize(): SerializedState

type SerializedState = { version: 1; state: GameState }
```

#### Input

```ts
// Raw dispatch
engine.dispatch(input: Input): void

// Convenience methods
engine.moveLeft(): void
engine.releaseMoveLeft(): void
engine.moveRight(): void
engine.releaseMoveRight(): void
engine.softDrop(): void
engine.releaseSoftDrop(): void
engine.hardDrop(): void
engine.rotate(direction: 'cw' | 'ccw' | '180'): void
engine.hold(): void
engine.pause(): void
engine.resume(): void
engine.reset(): void
```

#### Settings

```ts
engine.configure(partial: Partial<EngineSettings>): void
```

#### Simulation

```ts
engine.tick(deltaMs: number): void
```

#### Subscriptions and events

```ts
engine.subscribe(listener: () => void): () => void

engine.on<K extends keyof EngineEvents>(
  event: K,
  handler: (payload: EngineEvents[K]) => void,
): () => void

engine.off<K extends keyof EngineEvents>(
  event: K,
  handler: (payload: EngineEvents[K]) => void,
): void

type EngineEvents = {
  pieceLock:      { piece: ActivePiece; board: Playfield }
  lineClear:      ClearInfo
  levelUp:        { level: number }
  gameOver:       { reason: 'lockOut' | 'blockOut' | 'topOut' }
  tSpin:          { kind: TSpinKind; lines: number }
  hold:           { previous: PieceKind | null; current: PieceKind }
  pause:          void
  resume:         void
  reset:          void
  ultraFinished:  { score: number }
  sprintFinished: { timeMs: number }

  // Fine-grained motion events, fire on every successful cell-level
  // motion whether driven by a direct input, DAS/ARR auto-repeat, or
  // soft-drop. Intended for SFX, VFX, and analytics.
  pieceMove:      { direction: 'left' | 'right' | 'down' }
  pieceRotate:    { direction: RotationDirection }
  pieceHardDrop:  { cellsFallen: number }
  softDropRow:    { cellsFallen: number }
}
```

#### Replay

```ts
engine.getInputLog(): ReadonlyArray<RecordedInput>
engine.clearInputLog(): void

type RecordedInput = {
  input: Input
  atMs: number     // elapsed game time when this input was dispatched
}

// Reconstruct a finished (or mid-game) session:
createReplayEngine(options: ReplayEngineOptions): Engine

type ReplayEngineOptions = {
  seed: number
  mode: GameMode
  startLevel?: number
  settings?: Partial<EngineSettings>
  inputs: ReadonlyArray<RecordedInput>
}
```

### Selectors

Pure functions over `GameState`. Safe to call from render hot paths.

```ts
// Derived piece geometry
getGhostY(state): number | null              // y coordinate the active piece would land on
getGhostCells(state): ReadonlyArray<Offset>  // absolute cells at that landing position
getPiecePreview(kind: PieceKind): PiecePreview
getPieceCells(kind, rotation, x, y): ReadonlyArray<Offset>

// State-phase helpers
isPlaying(state): boolean
isPaused(state): boolean
isMenu(state): boolean
isGameOver(state): boolean
isClearing(state): boolean    // mid line-clear animation
isFinished(state): boolean    // gameOver OR sprintFinished OR ultraFinished

// Stats
getPiecesPerSecond(state): number
getLinesPerMinute(state): number
getPlayTimeSeconds(state): number
```

### Constants

Re-exported for UIs that need to draw the board.

**Board geometry**

| Constant         | Value | Notes                                       |
| ---------------- | ----: | ------------------------------------------- |
| `BOARD_WIDTH`    |  `10` |                                             |
| `BOARD_HEIGHT`   |  `40` | Includes vanish zone above the visible area |
| `VISIBLE_HEIGHT` |  `20` |                                             |
| `VISIBLE_TOP`    |  `20` | Y coordinate of the first visible row       |

**Timing**

| Constant             | Value | Notes                                           |
| -------------------- | ----: | ----------------------------------------------- |
| `LOCK_DELAY_MS`      | `500` | Grace window before a grounded piece locks      |
| `LOCK_RESETS_MAX`    |  `15` | Monotonic per-piece cap on lock-delay refreshes |
| `LINE_CLEAR_ANIM_MS` | `500` |                                                 |

**Input defaults**

| Constant                    |     Value | Notes |
| --------------------------- | --------: | ----- |
| `DEFAULT_DAS_MS`            |     `167` |       |
| `DEFAULT_ARR_MS`            |      `50` |       |
| `DEFAULT_SOFT_DROP_FACTOR`  |      `20` |       |
| `DEFAULT_ULTRA_DURATION_MS` | `120_000` |       |

**Game rules**

| Constant                   | Value                                    | Notes                                   |
| -------------------------- | ---------------------------------------- | --------------------------------------- |
| `NEXT_QUEUE_SIZE`          | `5`                                      | Upcoming pieces generated ahead of time |
| `SPRINT_TARGET_LINES`      | `40`                                     | Sprint mode clear goal                  |
| `MARATHON_LINES_PER_LEVEL` | `10`                                     |                                         |
| `MAX_LEVEL`                | `20`                                     | Gravity curve saturates here            |
| `PIECE_KINDS`              | `readonly ['I','O','T','S','Z','J','L']` |                                         |

### Gravity presets

```ts
import { gravityMsPerRow } from 'tetris-toolkit'

// Guideline formula: time_per_row = (0.8 - (level-1) * 0.007)^(level-1) seconds
gravityMsPerRow(level: number): number
```

Provide a custom curve at engine creation time:

```ts
createEngine({
  gravity: (level) => 500 / level, // simple inverse curve
})
```

## Recipes

### React integration

```ts
import { useSyncExternalStore, useMemo } from 'react'
import { createEngine, Engine, GameState } from 'tetris-toolkit'

function useEngine(): Engine {
  return useMemo(() => createEngine({ seed: Date.now() }), [])
}

function useEngineState(engine: Engine): GameState {
  return useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot)
}
```

### Recording and replaying a session

```ts
const liveEngine = createEngine({ seed: 1234 })
liveEngine.startGame({ mode: 'sprint' })
// ... player plays, inputs get logged automatically ...

// Persist:
const replayData = {
  seed: 1234,
  mode: 'sprint' as const,
  inputs: liveEngine.getInputLog(),
}

// Later, rehydrate:
import { createReplayEngine } from 'tetris-toolkit'
const replayEngine = createReplayEngine(replayData)

// Replay at any speed by ticking through the elapsed time:
const totalMs = replayData.inputs.at(-1)?.atMs ?? 0
for (let elapsed = 0; elapsed <= totalMs; elapsed += 16) {
  replayEngine.tick(16)
}
```

### Save and restore mid-game

```ts
// Save:
const snapshot = engine.serialize()
localStorage.setItem('savedGame', JSON.stringify(snapshot))

// Restore (even in a different browser session):
const restored = createEngine({
  restore: JSON.parse(localStorage.getItem('savedGame')!),
})
```

### Listening for events

```ts
engine.on('lineClear', (info) => {
  console.log(`Cleared ${info.lines} line(s) for ${info.points} points`)
})

engine.on('gameOver', ({ reason }) => {
  console.log(`Game over: ${reason}`)
})

const unsubscribe = engine.on('levelUp', ({ level }) => {
  console.log(`Level ${level}!`)
})

// Later:
unsubscribe()
```

### Custom gravity curve

```ts
// A flat gravity curve at 500 ms per row:
createEngine({ gravity: () => 500 })

// Linear acceleration:
createEngine({ gravity: (level) => Math.max(50, 800 - level * 40) })
```

### Ultra mode

```ts
engine.startGame({ mode: 'ultra', durationMs: 120_000 })

engine.on('ultraFinished', ({ score }) => {
  console.log(`Final score: ${score}`)
})
```

### Zen mode (endless, no top-out)

```ts
engine.startGame({ mode: 'zen' })
// The engine suppresses lock-out and block-out. When a spawn would
// collide, the top rows are cleared to keep play going.
```

### Preset starting board (puzzle or training mode)

```ts
import { BOARD_WIDTH, BOARD_HEIGHT } from 'tetris-toolkit'

// Fill just the bottom row:
const board = Array.from({ length: BOARD_HEIGHT }, (_, rowIndex) =>
  Array.from({ length: BOARD_WIDTH }, () => (rowIndex === BOARD_HEIGHT - 1 ? 'I' : null))
)

engine.startGame({ mode: 'marathon', presetBoard: board })
```

## Types

All public types are exported from the package root. See the generated `.d.ts` bundled alongside the runtime for the full surface.

Key types:

```ts
GameState
Phase
ActivePiece
PieceKind // 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L'
Cell // PieceKind | null
Playfield // ReadonlyArray<ReadonlyArray<Cell>>
Rotation // 0 | 1 | 2 | 3
RotationDirection // 'cw' | 'ccw' | '180'
GameMode // 'marathon' | 'sprint' | 'ultra' | 'zen'
Input // Discriminated union of all input variants
ClearInfo
TSpinKind // 'none' | 'mini' | 'full'
EngineSettings
StartGameOptions
GravityFunction // (level: number) => number
GravityPreset // 'guideline'
SerializedState
RecordedInput
EngineEvents
```

## Determinism notes

- The engine's internal PRNG is mulberry32 seeded from `EngineOptions.seed` (or `Date.now()` at creation time). The seed is re-derived on every refill of the 7-bag, so two engines created with the same seed produce byte-identical piece sequences indefinitely.
- Gravity and lock delay timings are driven purely by the accumulated `deltaMs` passed to `tick`. Replays use the same inputs at the same elapsed times, so downstream state is identical.
- `Date.now()` is not called inside any reducer branch. The only temporal source is the accumulator, which you control.

## License

[MIT](./LICENSE)
