/**
 * UI-layer constants: pixel sizing for the canvas playfield and the
 * namespaced localStorage keys used by the persistence layer.
 */

/** Rendered size of one board cell, in CSS pixels. */
export const CELL_PX = 34
/** Width of the playfield canvas in CSS pixels (10 columns × CELL_PX). */
export const PLAYFIELD_PX_WIDTH = 10 * CELL_PX
/** Height of the visible playfield canvas in CSS pixels (20 rows × CELL_PX). */
export const PLAYFIELD_PX_HEIGHT = 20 * CELL_PX

/** localStorage keys, versioned so schema changes don't clobber old users. */
export const STORAGE_KEYS = {
  settings: 'tetris:settings:v1',
  highScores: 'tetris:highScores:v1',
} as const
