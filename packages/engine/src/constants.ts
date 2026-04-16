/**
 * Tuning constants for board dimensions, spawn positions, lock delay,
 * DAS/ARR defaults, and mode-specific goals. These values are the
 * canonical Tetris Guideline numbers and should not be changed lightly ,
 * gameplay tests depend on them.
 */

/** Playfield is 10 columns wide (Guideline). */
export const BOARD_WIDTH = 10
/**
 * Full internal board height, including the hidden vanish zone above the
 * visible 20 rows. Pieces spawn inside the vanish zone.
 */
export const BOARD_HEIGHT = 40
/** Rows the player actually sees. */
export const VISIBLE_HEIGHT = 20
/** First visible row index (y=20 when BOARD_HEIGHT=40). */
export const VISIBLE_TOP = BOARD_HEIGHT - VISIBLE_HEIGHT

/** Spawn x for the top-left of a piece's 4x4 bounding box. */
export const SPAWN_X = 3
/** Spawn y, one row above the visible area so pieces enter cleanly. */
export const SPAWN_Y = 19

/** Milliseconds a piece rests on a surface before locking. */
export const LOCK_DELAY_MS = 500
/**
 * Move-reset cap: maximum number of lock-delay refreshes allowed per
 * piece across its entire stall. The counter is monotonic per piece:
 * step-resets (new lowest row) still clear the timer but do not refund
 * any counter. 15 leaves room for complex T-spin / wall-kick setups
 * while bounding the total stall at roughly 15 moves + one lock delay.
 */
export const LOCK_RESETS_MAX = 15

/**
 * Default Delayed Auto Shift. Time a left/right key must be held before
 * the piece starts auto-repeating sideways. 167 ms is the modern
 * consensus (Tetr.io, Puyo Puyo Tetris, 10 frames at 60 fps). Fast
 * enough to feel responsive, slow enough that a quick tap reliably
 * produces a single-cell move.
 */
export const DEFAULT_DAS_MS = 167
/**
 * Default Auto Repeat Rate. Interval between auto-shifted moves once
 * DAS has charged. 50 ms (3 frames at 60 fps) is the comfortable casual
 * default, matching Tetris 99, Puyo Puyo Tetris "easy", and Tetris
 * Friends. Fast enough to feel smooth, slow enough that new players
 * can reliably stop on the intended column without overshooting.
 * Competitive players can lower this in settings (10 to 33 ms).
 */
export const DEFAULT_ARR_MS = 50
/**
 * Default soft-drop multiplier relative to current gravity. 20 is the
 * Guideline-aligned value: roughly 20 times faster than natural gravity
 * at the current level, clamped by {@link SOFT_DROP_MIN_MS_PER_ROW} so
 * it stays visible at high levels.
 */
export const DEFAULT_SOFT_DROP_FACTOR = 20
/**
 * Minimum milliseconds per row while soft-dropping. Clamps the effective
 * soft-drop speed so that at high levels (where base gravity is already
 * fast) the piece does not teleport to the landing row in a single tick.
 * 20 ms/row caps soft drop at 50 cells/second, fast but visible.
 */
export const SOFT_DROP_MIN_MS_PER_ROW = 20

/** Engine fixed-timestep frequency (ticks per second). */
export const TICK_HZ = 240
/** Milliseconds per engine tick. */
export const TICK_MS = 1000 / TICK_HZ
/** Max ms of real time processed in one tick batch (prevents spiral of death). */
export const MAX_CATCHUP_MS = 250

/** How many upcoming pieces are visible in the Next queue. */
export const NEXT_QUEUE_SIZE = 5

/** Duration of the line-clear flash animation. */
export const LINE_CLEAR_ANIM_MS = 500
/** Sprint goal: first player to clear this many lines wins. */
export const SPRINT_TARGET_LINES = 40
/** Marathon progression: every N lines advances one level. */
export const MARATHON_LINES_PER_LEVEL = 10
/** Maximum marathon level (gravity curve caps here). */
export const MAX_LEVEL = 20
