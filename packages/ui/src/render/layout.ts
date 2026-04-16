/**
 * Static layout constants. The game is composed in two layers: an HTML
 * stage that hosts the HUD (Hold, Stats, Next) and a single canvas that
 * hosts only the playfield. All positions and sizes are CSS pixels.
 *
 * Two coordinate systems live here:
 *   - Stage coords (stage-wide HTML layout): used by HUD panels.
 *   - Playfield-canvas-local coords: used by the canvas renderer. The
 *     canvas's (0, 0) is its own top-left, so playfield drawing starts
 *     inside the 4px frame at (FRAME_WIDTH, FRAME_WIDTH).
 */

import { BOARD_WIDTH, VISIBLE_HEIGHT } from '@tetris/engine'

import { CELL_PX } from '@/constants'

/** Thickness of the chunky white frame around each panel. */
export const FRAME_WIDTH = 4

/** Vertical distance from a panel's interior top to the label above it. */
export const LABEL_Y_OFFSET = 22

/** Padding between sibling panels horizontally. */
export const PANEL_GAP_X = 24

/** Padding at top of stage above panels (leaves room for HOLD/NEXT labels). */
export const PANEL_TOP_PADDING = 24

/** Padding below the playfield to the bottom of the stage. */
export const STAGE_BOTTOM_PADDING = 8

/** Padding from the right edge of the stage. */
export const CANVAS_RIGHT_PADDING = 20

/** Vertical space between HOLD panel and stats panel below it. */
export const STATS_TOP_GAP = 16

/** Height of one stat row inside the stats panel. */
export const STAT_ROW_H = 50

// Hold panel, left column, top (stage coords)
export const HOLD_SIZE = 120
export const HOLD_X = 20
export const HOLD_Y = PANEL_TOP_PADDING

// Playfield interior (in stage coords — used for HTML placement of the canvas)
export const PLAYFIELD_WIDTH = BOARD_WIDTH * CELL_PX
export const PLAYFIELD_HEIGHT = VISIBLE_HEIGHT * CELL_PX
export const PLAYFIELD_STAGE_X = HOLD_X + HOLD_SIZE + PANEL_GAP_X
export const PLAYFIELD_STAGE_Y = HOLD_Y

/** Outer dimensions of the playfield canvas element (interior + 4px frame). */
export const PLAYFIELD_CANVAS_WIDTH = PLAYFIELD_WIDTH + FRAME_WIDTH * 2
export const PLAYFIELD_CANVAS_HEIGHT = PLAYFIELD_HEIGHT + FRAME_WIDTH * 2

// Playfield interior position in canvas-local coords (used by render/*.ts).
export const PLAYFIELD_X = FRAME_WIDTH
export const PLAYFIELD_Y = FRAME_WIDTH

// Next panel, right column, top (stage coords)
export const NEXT_BOX_WIDTH = 120
export const NEXT_CELL = 22
export const NEXT_SLOT_HEIGHT = 72
export const NEXT_X = PLAYFIELD_STAGE_X + PLAYFIELD_WIDTH + PANEL_GAP_X
export const NEXT_Y = PLAYFIELD_STAGE_Y

// Stats panel, left column, below HOLD (stage coords)
export const STATS_X = HOLD_X
export const STATS_Y = HOLD_Y + HOLD_SIZE + STATS_TOP_GAP
export const STATS_W = HOLD_SIZE

/** Full stage size at native pixels (HTML + canvas composition). */
export const STAGE_WIDTH = NEXT_X + NEXT_BOX_WIDTH + CANVAS_RIGHT_PADDING
export const STAGE_HEIGHT = PLAYFIELD_STAGE_Y + PLAYFIELD_HEIGHT + FRAME_WIDTH * 2 + STAGE_BOTTOM_PADDING
