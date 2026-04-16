# Tetris — Design Spec

**Date:** 2026-04-11
**Project:** `tetris/` (new)
**Status:** Approved for implementation planning

## Goal

Build a production-ready, Guideline-compliant Tetris game for the web. Faithful to the modern Tetris Guideline (SRS, 7-bag, hold, ghost, lock delay, T-spin, B2B, combo) with polished visuals and 60fps feel. Desktop-first with touch support for mobile.

## Scope

### In scope

- **Marathon mode** — endless, level-based gravity, game-over on top-out
- **Sprint mode** — clear 40 lines as fast as possible
- Full Tetris Guideline rules (see _Rules_ below)
- Keyboard controls (rebindable) + touch controls for mobile
- High scores per mode, resume-last-session for Marathon, persisted settings (all via `localStorage`)
- Audio (SFX + background loop), mutable, off by default on first load
- Single polished dark theme with Guideline piece colors
- `prefers-reduced-motion` support (disables shake, particles, non-essential animation)
- Vitest test suite covering the engine

### Out of scope (YAGNI)

- Multiplayer / versus / netcode
- Replay recording/export
- Custom piece or board editor
- Multiple themes / skins
- Accounts / cloud saves
- Ultra, Zen, Cheese, or any mode beyond Marathon + Sprint
- Internationalization (English only)
- Server component of any kind — purely static build

## Rules (Tetris Guideline)

| System                  | Behavior                                                                                                                                                         |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Playfield**           | 10 columns × 20 visible rows, with 20 hidden buffer rows above for spawn/rotation                                                                                |
| **Pieces**              | 7 tetrominoes: I, O, T, S, Z, J, L with Guideline colors (cyan, yellow, purple, green, red, blue, orange)                                                        |
| **Randomizer**          | 7-bag: each bag is a shuffled permutation of all 7 pieces; bags concatenated                                                                                     |
| **Spawn**               | Pieces spawn at rows 20–21 (top of hidden buffer), centered; I spawns flat                                                                                       |
| **Rotation**            | SRS with standard J/L/S/T/Z kick table + distinct I kick table (5 test offsets per rotation)                                                                     |
| **Rotation directions** | CW, CCW, 180° (180 uses a dedicated kick table; no-op if all kicks fail)                                                                                         |
| **Hold**                | Swap active piece with hold slot; at most one swap between locks; held piece respawns at top                                                                     |
| **Next queue**          | Preview of next 5 pieces                                                                                                                                         |
| **Gravity**             | Guideline formula: `time_per_row = (0.8 − ((level − 1) × 0.007))^(level − 1)` seconds, capped to 20G at level 20+                                                |
| **Soft drop**           | Multiplies gravity by configurable factor (default ×20); awarded 1 pt/row                                                                                        |
| **Hard drop**           | Instant drop to landing position; 2 pts/row; locks immediately                                                                                                   |
| **Lock delay**          | 500ms after piece touches stack; resets on successful move/rotate; capped at 15 resets                                                                           |
| **Line clear**          | Cleared simultaneously; gravity drops rows above; no sticky/cascade gravity                                                                                      |
| **Top-out**             | Lock out: piece locks entirely above visible field → game over. Block out: spawn overlaps stack → game over                                                      |
| **T-spin detection**    | 3-corner rule: T-shaped piece rotation where ≥3 of 4 corner cells around its center are blocked; "mini" if the two corners in front of the T are NOT both filled |
| **Back-to-Back**        | Chain of "difficult" clears (Tetris, T-spin single/double/triple): +50% of clear score                                                                           |
| **Combo**               | Consecutive clears: +50 × combo × level points per clear after the first                                                                                         |

### Scoring table (Guideline)

| Action                                  | Points                                                     |
| --------------------------------------- | ---------------------------------------------------------- |
| Single                                  | 100 × level                                                |
| Double                                  | 300 × level                                                |
| Triple                                  | 500 × level                                                |
| Tetris                                  | 800 × level                                                |
| T-spin (no lines)                       | 400 × level                                                |
| T-spin mini (no lines)                  | 100 × level                                                |
| T-spin single                           | 800 × level                                                |
| T-spin mini single                      | 200 × level                                                |
| T-spin double                           | 1200 × level                                               |
| T-spin triple                           | 1600 × level                                               |
| Soft drop                               | 1 per row                                                  |
| Hard drop                               | 2 per row                                                  |
| B2B bonus                               | × 1.5 on qualifying clears                                 |
| Combo                                   | + 50 × combo × level                                       |
| Perfect clear (empty board after clear) | + 800/1200/1800/2000 × level (single/double/triple/tetris) |

Marathon level-up: every 10 lines cleared.

## Architecture

### Principle

The game engine is a **pure, framework-agnostic TypeScript module** with no React, DOM, or browser dependencies (except for `performance.now` which is polyfilled for tests). React is a thin view layer that reads engine state and draws it to a canvas. This makes the engine:

- **Deterministic** — given the same input sequence + RNG seed, produces identical state
- **Testable** — full coverage without a browser, milliseconds per test
- **Loop-isolated** — the game loop is independent of React's render schedule; no lag when a tab is backgrounded or the React tree re-renders
- **Replaceable UI** — if we ever want to port to another framework, the engine comes along unchanged

### Approach comparison (decision record)

| Approach                                          | Decision                                                                       |
| ------------------------------------------------- | ------------------------------------------------------------------------------ |
| **A. Pure functional engine + React canvas view** | **Chosen.** Clear boundary, unit-testable, deterministic.                      |
| B. Class-based imperative engine                  | Rejected: harder to test, state tangled with object lifecycle.                 |
| C. Game logic inside `useReducer`                 | Rejected: logic coupled to React, brittle under Strict Mode double-invocation. |

| Rendering approach               | Decision                                                            |
| -------------------------------- | ------------------------------------------------------------------- |
| **A. Canvas 2D**                 | **Chosen.** 60fps, cheap redraw, subpixel-precise, no DOM reflow.   |
| B. DOM grid (divs with CSS grid) | Rejected: reflow cost, subpixel jitter, animation limitations.      |
| C. WebGL / Three.js              | Rejected: overkill for a 2D block game; bundle and complexity cost. |

### Game loop

Fixed-timestep accumulator pattern:

- Logic ticks at a constant **240 Hz** (4.17ms/tick). High resolution is needed to precisely represent 20G gravity and tight DAS/ARR timings.
- Rendering runs on `requestAnimationFrame` and reads the latest state; render rate is decoupled from logic rate.
- On each RAF, compute `delta = now − lastNow`, accumulate into a `lag` budget, consume ticks in `4.17ms` steps until drained, then render once.
- When the tab is backgrounded and `delta` spikes, cap accumulated lag at 250ms so we don't simulate minutes of dropped frames.

### State & subscription

The engine exposes a store with:

- `getSnapshot(): GameState` — immutable current state
- `subscribe(listener: () => void): () => void` — for `useSyncExternalStore`
- `dispatch(input: Input): void` — queue an input to be consumed on the next tick
- `start(mode)`, `pause()`, `resume()`, `reset()`, `destroy()` — lifecycle

The React layer:

- `useEngine()` → `useSyncExternalStore(engine.subscribe, engine.getSnapshot)`
- `Game.tsx` owns the canvas ref and drives a separate RAF draw loop that reads `engine.getSnapshot()` on every frame and calls `canvas.draw(state)` — the canvas is NOT a React render target, so React re-renders only affect the HUD.

This keeps React out of the hot path. HUD (`Hud.tsx`) subscribes via `useEngine` and re-renders when score/level/lines/time change — slow updates, React handles them fine.

## File layout

```
tetris/
├── index.html
├── package.json
├── pnpm-lock.yaml
├── vite.config.ts
├── vitest.config.ts
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── oxlint.json
├── public/
│   └── favicon.svg
└── src/
    ├── main.tsx
    ├── App.tsx
    │
    ├── engine/                    # pure TypeScript, no React imports
    │   ├── index.ts               # public API barrel
    │   ├── types.ts               # GameState, Piece, Cell, Input, Mode, Event
    │   ├── board.ts               # collision, lock, lineClear, isTopOut
    │   ├── pieces.ts               # tetromino shape matrices + spawn offsets
    │   ├── rotation.ts             # SRS kick tables (standard + I + 180)
    │   ├── bag.ts                  # seeded 7-bag randomizer (mulberry32)
    │   ├── gravity.ts              # level → ms-per-row table + soft-drop factor
    │   ├── lockDelay.ts            # lock timer + move-reset cap
    │   ├── tspin.ts                # 3-corner rule, full vs mini
    │   ├── scoring.ts              # scoring table + B2B + combo
    │   ├── input.ts                # DAS/ARR state machine
    │   ├── modes/
    │   │   ├── marathon.ts         # Marathon-specific rules (level up every 10 lines)
    │   │   └── sprint.ts           # Sprint-specific rules (40 lines, stopwatch, end condition)
    │   ├── store.ts                # createEngine: tick loop, snapshot, subscribe, dispatch
    │   └── __tests__/              # vitest specs mirroring module names
    │
    ├── render/
    │   ├── canvas.ts               # draw playfield, active, ghost, hold, next, grid
    │   ├── particles.ts            # particle system for line clears
    │   ├── theme.ts                # piece colors, grid color, palette
    │   └── hidpi.ts                # devicePixelRatio-aware canvas setup
    │
    ├── components/
    │   ├── Game.tsx                # top-level: canvas, keyboard/touch wiring, RAF draw
    │   ├── Hud.tsx                 # score, level, lines, time, mode, combo, B2B
    │   ├── Menu.tsx                # main menu: Marathon / Sprint / Settings
    │   ├── PauseOverlay.tsx
    │   ├── GameOverOverlay.tsx
    │   ├── SprintFinishOverlay.tsx
    │   ├── Settings.tsx            # DAS/ARR sliders, key rebind, volumes, reduced-motion
    │   └── TouchControls.tsx
    │
    ├── hooks/
    │   ├── useEngine.ts            # useSyncExternalStore wrapper
    │   ├── useKeyboard.ts          # DOM events → engine.dispatch(Input)
    │   ├── useTouch.ts             # gesture detection → engine.dispatch(Input)
    │   └── useRafDraw.ts           # RAF loop calling canvas.draw(engine.getSnapshot())
    │
    ├── storage/
    │   ├── persist.ts              # typed read/write + schema version + type guards
    │   └── schema.ts               # StoredSettings, StoredHighScores, version tag
    │
    ├── audio/
    │   ├── sfx.ts                  # Web Audio API, lazy init, preloaded buffers
    │   └── samples.ts              # small base64-encoded WAVs or procedural generators
    │
    ├── constants.ts                # board size, timings, default DAS/ARR, storage keys
    ├── types.ts                    # app-level (non-engine) types
    ├── styles/                     # one CSS file per component (wordly convention)
    │   ├── game.css
    │   ├── hud.css
    │   ├── menu.css
    │   ├── overlays.css
    │   ├── settings.css
    │   └── touch.css
    └── index.css
```

**Size discipline:** Each engine module has one job and should stay under ~150 lines. If a module grows, split it — e.g., `rotation.ts` into `rotation/kicks.ts` + `rotation/apply.ts`.

## Engine type sketch

```ts
// engine/types.ts
export type PieceKind = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L'
export type Cell = PieceKind | null
export type Rotation = 0 | 1 | 2 | 3

export type ActivePiece = {
  kind: PieceKind
  rotation: Rotation
  x: number // column of piece origin in playfield coords
  y: number // row (0 = top of hidden buffer)
  lockTimerMs: number // elapsed lock delay
  lockResets: number // count of move-resets used (max 15)
}

export type Playfield = ReadonlyArray<ReadonlyArray<Cell>>

export type GameMode = 'marathon' | 'sprint'

export type Phase =
  | { kind: 'menu' }
  | { kind: 'playing' }
  | { kind: 'paused' }
  | { kind: 'lineClearAnim'; rows: readonly number[]; elapsedMs: number }
  | { kind: 'gameOver'; reason: 'lockOut' | 'blockOut' }
  | { kind: 'sprintFinished'; timeMs: number }

export type GameState = {
  mode: GameMode
  phase: Phase
  board: Playfield
  active: ActivePiece | null
  hold: PieceKind | null
  holdUsedThisTurn: boolean
  queue: readonly PieceKind[] // at least 5 ahead
  bagState: BagState
  score: number
  level: number // marathon
  lines: number // total lines cleared
  combo: number // -1 = no combo
  backToBack: boolean
  elapsedMs: number
  lastClear: ClearInfo | null // surfaced for HUD flashes + scoring
}

export type Input =
  | { kind: 'moveLeft' }
  | { kind: 'moveRight' }
  | { kind: 'softDropStart' }
  | { kind: 'softDropEnd' }
  | { kind: 'hardDrop' }
  | { kind: 'rotateCW' }
  | { kind: 'rotateCCW' }
  | { kind: 'rotate180' }
  | { kind: 'hold' }
  | { kind: 'pause' }
  | { kind: 'resume' }
  | { kind: 'reset' }
```

## Data flow

```
keyboard / touch
       │
       ▼
 useKeyboard / useTouch  ───► engine.dispatch(Input)
                                      │
RAF tick ──► engine internal loop ────┤
                                      ▼
                            engine.getSnapshot()
                               │              │
                               ▼              ▼
                      canvas.draw(state)   useSyncExternalStore
                                               │
                                               ▼
                                        HUD / overlays re-render
```

## Error handling

- **Engine is pure** — no thrown errors except developer-error invariants (assertions in debug builds only).
- **Storage**: `persist.read()` wraps `JSON.parse` in try/catch and validates with type guards (`isStoredSettings`, `isStoredHighScores`). Bad/missing/old-version data → fall back to defaults, never propagate.
- **Schema versioning**: `StoredSettings` carries `version: 1`. Future migrations live in `storage/migrations.ts` (not created until needed).
- **Audio**: `AudioContext` initializes lazily on first user gesture to respect autoplay policy. If it can't start (rare), audio silently no-ops — gameplay is unaffected.
- **Canvas**: if `getContext('2d')` returns null, `Game.tsx` renders a text fallback with a "Your browser doesn't support canvas" message.
- **React errors**: one top-level `ErrorBoundary` in `main.tsx` with a minimal "something went wrong, reload" UI.

## Testing strategy

Vitest, pure unit tests against `src/engine/`. No jsdom, no React Testing Library (UI is thin and visual).

**Coverage targets:**

1. **Board ops** (`board.test.ts`) — collision for every piece/rotation at edges and corners; `lock` correctness; `lineClear` for 1/2/3/4-line clears; gravity drop after clear.
2. **Pieces** (`pieces.test.ts`) — all 7 pieces × 4 rotations produce correct shape matrices.
3. **Rotation** (`rotation.test.ts`) — SRS kick tables for standard pieces + I piece + 180° kicks; each of the 5 test offsets exercised; verify known Guideline kick outcomes (e.g., T-spin triple setups).
4. **Bag** (`bag.test.ts`) — each bag contains exactly one of each piece; no piece repeats within a bag; seed determinism.
5. **Gravity** (`gravity.test.ts`) — level→ms table matches formula; 20G cap; soft drop multiplier.
6. **Lock delay** (`lockDelay.test.ts`) — 500ms fires; successful move/rotate resets; reset count capped at 15.
7. **T-spin** (`tspin.test.ts`) — 3-corner rule; full vs mini; rotation-only vs movement (must be entered by rotation); known T-spin patterns (T-spin double on a simple setup, T-spin triple via SRS kick).
8. **Scoring** (`scoring.test.ts`) — Guideline table; B2B multiplier; combo additive; perfect clear bonus.
9. **Input (DAS/ARR)** (`input.test.ts`) — initial delay, repeat interval, cancel on release, reset on direction change.
10. **Modes** (`marathon.test.ts`, `sprint.test.ts`) — Marathon: level up every 10 lines; Sprint: stopwatch, terminates at 40 lines.
11. **Top-out** (`topout.test.ts`) — lock-out (piece locks fully above visible rows) and block-out (spawn overlaps stack).
12. **Integration** (`store.test.ts`) — end-to-end: run a deterministic input script against a seeded engine, assert final state (line count, score, top-out).

No UI tests. Manually verified: menu navigation, pause/resume, settings persistence, touch gestures.

## Persistence

**`localStorage` keys** (namespaced `tetris:`):

- `tetris:settings:v1` — `{ version, dasMs, arrMs, softDropFactor, keyBinds, sfxVolume, musicVolume, audioEnabled, reducedMotion }`
- `tetris:highScores:v1` — `{ version, marathon: { score, level, lines, timeMs }[], sprint: { timeMs, lines }[] }` (top 10 each, sorted)
- `tetris:lastSession:v1` — Marathon resume state (board, active, hold, queue, bag, score, level, lines, elapsedMs, combo, b2b). Cleared on game over.

All reads are type-guarded. Writes happen on: settings change, game over / sprint finish, every N seconds during Marathon (for resume). Debounced to avoid thrashing.

## Tooling & dependencies

Matches the `wordly` convention:

**Runtime:**

- `react` ^19, `react-dom` ^19
- `ts-pattern` ^5 — exhaustive matching for `Phase`, `Input`, `GameMode`

**Dev:**

- `vite` ^5, `@vitejs/plugin-react` ^4
- `typescript` ~5.9 (strict + `noUncheckedIndexedAccess` + `noImplicitOverride`)
- `oxlint` + `oxfmt`
- `@types/react`, `@types/react-dom`, `@types/node`
- **`vitest` ^2** — new addition (wordly has no tests; Tetris engine must)

**No runtime deps beyond React and ts-pattern.** No state library, no UI library, no game engine, no audio library, no Tailwind. Keeps bundle lean and design intentional.

**Path alias:** `@/` → `src/`, configured in both `tsconfig.app.json` and `vite.config.ts`.

## Visual & UX details

- **Layout (desktop):** Hold panel (left) | Playfield 10×20 (center) | Next queue + HUD (right). Centered vertically. Max width ~900px.
- **Layout (mobile, <640px):** Playfield top, HUD strip above, Hold + Next mini strips below, Touch controls at bottom. Portrait only.
- **Palette:** Dark background (#0b0d12), grid subtle `rgba(255,255,255,0.04)`, piece colors Guideline-standard, ghost piece = outline only in piece color at 40% alpha.
- **Active piece:** slight inner gradient for depth, no skeuomorphism.
- **Ghost piece:** 1px outline at landing row.
- **Line clear anim:** 150ms — rows flash white, collapse with ease-out translate. Particle burst on Tetris and T-spins.
- **Screen shake:** only on Tetris and T-spin double/triple; 4px peak, 150ms. Disabled under `prefers-reduced-motion`.
- **Level up:** brief cyan tint on playfield border, 200ms.
- **Game over:** board grays out top-down, then overlay.
- **Sprint finish:** playfield fades, finish time displayed large.

## Default controls

| Action          | Key                                                    |
| --------------- | ------------------------------------------------------ |
| Move left       | `←`                                                    |
| Move right      | `→`                                                    |
| Soft drop       | `↓`                                                    |
| Hard drop       | `Space`                                                |
| Rotate CW       | `X` or `↑`                                             |
| Rotate CCW      | `Z` or `Ctrl`                                          |
| Rotate 180°     | `A`                                                    |
| Hold            | `Shift` or `C`                                         |
| Pause / unpause | `Esc` or `P`                                           |
| Reset           | `R` (held 500ms to confirm, to avoid accidental reset) |

All rebindable in Settings. Defaults saved to `localStorage` on first run.

## Success criteria

Tetris is "production-ready" when:

1. All engine tests pass.
2. Build succeeds (`pnpm build`) with zero TS errors and zero oxlint errors.
3. Game runs at a stable 60fps in Chrome desktop on a playfield with a near-full stack.
4. All Guideline rules above behave correctly when exercised manually: 7-bag never repeats inside a bag, ghost piece accurate, hold swaps once per turn, SRS kicks produce a T-spin triple on the classic setup, lock delay resets on move, B2B and combo increment correctly.
5. Settings + high scores + Marathon resume survive page reload.
6. Mobile touch controls work on iOS Safari + Android Chrome.
7. `prefers-reduced-motion: reduce` disables shake and particles.
8. Bundle size under 250KB gzipped (realistic for this scope without heavy deps).

## Open questions

None at approval time — all decisions made in brainstorm.
