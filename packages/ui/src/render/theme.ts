/**
 * Visual theme: an 8-bit inspired per-piece palette (base / highlight /
 * shadow used by the bevel renderer) plus global UI colours, grid
 * styling, and the pixel font stack.
 */

import type { PieceKind } from '@tetris/engine'

/**
 * Solid base fill for each piece kind. Brighter and slightly pastel
 * hues tuned for high contrast against the near-black playfield. Paired
 * with {@link PIECE_COLORS_LIGHT} and {@link PIECE_COLORS_DARK} to
 * produce the beveled 3-tone shading used by the block renderer.
 *
 * Notes on the palette:
 *   I (aqua cyan)     pops clearly on dark
 *   O (warm yellow)   unchanged in character, slightly warmer
 *   T (lavender)      brighter than traditional purple so bevel reads
 *   S (vivid green)   saturated but not neon
 *   Z (coral pink)    softened from harsh red, still clearly "Z"
 *   J (sky blue)      much brighter than classic navy; was hardest to
 *                     see against the dark background
 *   L (warm orange)   lightly saturated for balance with the cyan I
 */
export const PIECE_COLORS: Record<PieceKind, string> = {
  I: '#4de8f7',
  O: '#ffd834',
  T: '#c56bff',
  S: '#52e352',
  Z: '#ff5070',
  J: '#5a80ff',
  L: '#ff9133',
}

/** Top/left bevel highlight for each piece. Roughly base + 30 percent white. */
export const PIECE_COLORS_LIGHT: Record<PieceKind, string> = {
  I: '#b5f3fb',
  O: '#ffec8e',
  T: '#e1b0ff',
  S: '#a9f2a9',
  Z: '#ffa0b0',
  J: '#b0c3ff',
  L: '#ffc888',
}

/** Bottom/right bevel shadow for each piece. Roughly base at 40 percent luminance. */
export const PIECE_COLORS_DARK: Record<PieceKind, string> = {
  I: '#1a8aa0',
  O: '#b08818',
  T: '#7030a8',
  S: '#2d7a2d',
  Z: '#a82040',
  J: '#2040a0',
  L: '#a85518',
}

/**
 * Global UI colours, grid styling, and the pixel font stack.
 *
 * Values track the CSS token system in `index.css`:
 *   `--paper`     → text + frame stroke
 *   `--ink`       → grid/lineClearFlash backdrops for contrast
 *   `--accent`    → highlighted text (combo / B2B)
 *
 * The playfield interior stays near-black so the bevelled blocks pop;
 * it is the only dark surface in the otherwise sunset-hued UI.
 */
export const THEME = {
  background: '#1a0a2e',
  panelBackground: '#0f0820',
  panelBorder: '#fff4e8',
  gridLine: 'rgba(255, 194, 221, 0.14)',
  gridBorder: '#fff4e8',
  text: '#fff4e8',
  textDim: '#ffc2dd',
  accent: '#ffd99f',
  ghostAlpha: 0.35,
  lineClearFlash: '#fff4e8',
  pixelFont: '"Press Start 2P", ui-monospace, monospace',
} as const
