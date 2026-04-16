# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

pnpm workspace (`pnpm-workspace.yaml`) with two packages under `packages/`:

- **`@tetris/engine`** — the publishable library (ships on npm as **`tetris-toolkit`**). Headless, deterministic, Guideline-compliant Tetris engine. Pure TypeScript, zero runtime deps. Builds to ESM + CJS with `tsup`. Everything re-exported from `src/index.ts` is stable public API; everything else is implementation detail.
- **`@tetris/ui`** — private Vite + React 19 reference app that consumes the engine via `workspace:*`. Not published. Acts as both the demo and the integration-test harness.

## Commands

Root-level scripts operate across the workspace:

```bash
pnpm dev          # Start the UI dev server (only the UI has a dev server)
pnpm build        # Build every package (engine → dist, ui → dist)
pnpm test         # Run every package's test suite (engine only; UI has none)
pnpm lint         # oxlint over the whole workspace
pnpm lint:fix     # oxlint with autofix
pnpm format       # oxfmt rewrite
pnpm format:check # oxfmt check-only
pnpm release      # publish the engine to npm as `tetris-toolkit`
```

Release flow (see `packages/engine/scripts/publish.sh`): builds with `tsup`, temporarily renames `@tetris/engine` → `tetris-toolkit` in `package.json` so the npm-visible name matches the public package, runs `pnpm publish --access public --no-git-checks`, then restores the internal name on exit (even on failure, via `trap`). Forward extra flags verbatim, e.g. `pnpm release --dry-run` or `pnpm release --tag next`.

Engine-specific (run from `packages/engine/`):

```bash
pnpm test                                   # vitest watch mode
pnpm test:run                               # vitest single run
./node_modules/.bin/vitest run <file>       # single test file
./node_modules/.bin/vitest run -t 'name'    # tests whose name matches
./node_modules/.bin/vitest run --coverage   # coverage report (v8, text + json-summary)
pnpm build                                  # tsup: ESM + CJS + .d.ts/.d.cts
```

UI-specific (from `packages/ui/`):

```bash
pnpm dev      # vite dev server
pnpm build    # tsc -b && vite build
pnpm preview  # serve the production build
```

## Architecture

### Engine (`packages/engine/src/`)

Pure state machine driven by an external render loop. No DOM, no timers of its own. The top-level shape:

- `store.ts` — `createEngine()` factory. Owns state, dispatches inputs through a reducer, runs a **fixed 240 Hz internal timestep with a real-time accumulator** (`TICK_HZ`, `TICK_MS`). Consumers call `engine.tick(deltaMs)` and the engine catches up by running as many internal ticks as needed. State is immutable; `getSnapshot()` + `subscribe()` works with React `useSyncExternalStore`.
- `types.ts` — every public type lives here. `GameState` is the full snapshot; `Phase` and `Input` are discriminated unions, exhaustively matched via native `switch` with an `assertNever(value: never)` default.
- `index.ts` — the barrel. Anything not exported here is NOT public API.
- `pieces.ts`, `rotation.ts`, `bag.ts`, `board.ts` — tetromino shapes, SRS kick tables (standard + I-piece + O-piece + 180°), 7-bag randomizer, board ops.
- `lockDelay.ts` — grounded-piece bookkeeping. `lockResets` is **monotonic per piece** (step-progression resets the timer but never refunds the counter) to prevent infinite stalling via wall-kick chains.
- `gravity.ts`, `input.ts` — gravity curve (default: Tetris Guideline exponential) and DAS/ARR autoshift state machine.
- `tspin.ts`, `scoring.ts` — T-spin detection (3-corner rule, full/mini), Guideline scoring table, B2B multiplier, combo bonus, Perfect Clear bonus.
- `events.ts` — typed event emitter. Events listed on `EngineEvents` (`pieceLock`, `lineClear`, `gameOver`, `pieceMove`, `pieceRotate`, `pieceHardDrop`, `softDropRow`, `hold`, `pause`, `resume`, `reset`, `levelUp`, `ultraFinished`, `sprintFinished`, `tSpin`).
- `modes/` — mode-specific logic (`marathon`, `sprint`, `ultra`, `zen`). Zen uses a top-row rescue instead of ending on block-out.
- `selectors.ts`, `stats.ts` — pure read-only derivations over `GameState` (ghost piece geometry, piece previews, phase predicates, PPS/LPM).
- `replay.ts` — `createReplayEngine` wraps `createEngine` with a timestamped input queue for deterministic playback.

**Determinism invariant.** Given the same seed and the same input log, the engine reproduces state bit-for-bit. Any change that breaks that invariant is a bug.

### UI (`packages/ui/src/`)

React 19 app. Renders the HUD in HTML and the playfield on a single `<canvas>`; the two share layout constants via `src/render/layout.ts`.

- `App.tsx` — top-level screen state machine (menu / game / settings).
- `components/Game.tsx` — running-game screen. Composes a scaled-stage wrapper containing HUD panels + the playfield canvas + overlays.
- `components/hud/` — `HoldPanel`, `NextPanel`, `StatsPanel`, `HudPanel`, `PiecePreview`. Piece previews are small HiDPI canvases that reuse `render/blocks.ts` so HUD blocks are byte-identical to playfield blocks.
- `components/menu/`, `components/settings/` — subcomponents for the menu and settings screens (decomposed to keep each file focused).
- `hooks/` — `useEngine` / `useEngineSnapshot` / `useEngineSettings` (engine lifecycle), `useRafDraw` (RAF loop), `useKeyboard` (bindings), `useTouch` (swipe/tap), `useStageScale` (fits stage into viewport, prefers integer scales so pixel fonts stay crisp), `useGameAudio` (wires engine events to SFX + music players).
- `render/` — canvas-side: `playfield.ts` (grid / cells / ghost / active / line-clear anim), `blocks.ts` (bevelled 8-bit block primitive), `panels.ts`, `hidpi.ts`, `theme.ts`, `layout.ts`, `canvas.ts`.
- `audio/` — `sfx.ts` (procedural Web Audio synth with per-effect rate limiting), `music.ts` (looping `HTMLAudioElement`).
- `storage/` — versioned `localStorage` schema + type guards for settings and mode leaderboards.
- `styles/` — separate CSS files imported from `src/index.css`.

### Cross-cutting conventions

- **Path aliases, no relative imports.** Engine uses `@engine/*` → `src/*` (see `packages/engine/tsconfig.json` + `vitest.config.ts`). UI uses `@/*` → `src/*` (see `packages/ui/tsconfig.json` + `vite.config.ts`). CSS imports inside the UI use the same `@/` alias (e.g. `@import url('@/styles/base.css')`). Do not introduce `./` or `../` imports.
- **No single-letter / abbreviated variable names.** Use `context` not `ctx`, `column` not `c`, `deltaMs` not `dt`. The refactored codebase already follows this everywhere.
- **Always brace single-line `if`s.** `if (x) return;` is spelled `if (x) { return; }`.
- **JSDoc on every public export.** The engine's public API has a docstring on every function, type, and constant. The bar is demonstrated by files like `render/playfield.ts` and `engine/src/lockDelay.ts`.
- **Coverage.** Engine tests live in `packages/engine/src/__tests__/` named by topic (`scoring.test.ts`, `rotation.test.ts`, etc). Tests are organized around domain concepts, **not** around which uncovered lines they happen to hit. Don't create files like `coverage.test.ts` just to paper over gaps, and don't add `/* v8 ignore */` comments to defensive branches — leave honest coverage numbers.

### Things to preserve

- The 1:1 mapping between canvas block rendering and HUD block rendering (both go through `render/blocks.ts`). Changing the block primitive must update both surfaces.
- The playfield grid loops span `0..BOARD_WIDTH` and `0..VISIBLE_HEIGHT` _inclusive_ so edge cells have a visible grid line. Rotating pieces through those cells would otherwise look like they "erase" the background.
- The stage-scale hook snaps to integer scales when possible; changing it to fractional-always will blur the pixel font on common viewports.
- Lock-delay `lockResets` is monotonic per piece. Do not reintroduce a refund on step-progression or on gravity-driven falls — that's the infinite-spin bug.
