/**
 * The TETRIS title rendered as six bevelled 8-bit block letters, each
 * coloured from a piece in the palette. The letter shapes are hand-
 * drawn 6×7 bitmaps; each filled bitmap pixel becomes one bevelled
 * block in the SVG (matching the in-game tetromino block treatment).
 */

import type { PieceKind } from '@tetris/engine'
import type { ReactElement } from 'react'

import { PIECE_COLORS, PIECE_COLORS_LIGHT, PIECE_COLORS_DARK } from '@/render/theme'

type LetterBitmap = readonly (readonly number[])[]

const LETTER_T: LetterBitmap = [
  [1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1],
  [0, 0, 1, 1, 0, 0],
  [0, 0, 1, 1, 0, 0],
  [0, 0, 1, 1, 0, 0],
  [0, 0, 1, 1, 0, 0],
  [0, 0, 1, 1, 0, 0],
]
const LETTER_E: LetterBitmap = [
  [1, 1, 1, 1, 1, 1],
  [1, 1, 0, 0, 0, 0],
  [1, 1, 0, 0, 0, 0],
  [1, 1, 1, 1, 1, 0],
  [1, 1, 0, 0, 0, 0],
  [1, 1, 0, 0, 0, 0],
  [1, 1, 1, 1, 1, 1],
]
const LETTER_R: LetterBitmap = [
  [1, 1, 1, 1, 1, 0],
  [1, 1, 0, 0, 1, 1],
  [1, 1, 0, 0, 1, 1],
  [1, 1, 1, 1, 1, 0],
  [1, 1, 1, 1, 0, 0],
  [1, 1, 0, 1, 1, 0],
  [1, 1, 0, 0, 1, 1],
]
const LETTER_I: LetterBitmap = [
  [1, 1, 1, 1, 1, 1],
  [0, 0, 1, 1, 0, 0],
  [0, 0, 1, 1, 0, 0],
  [0, 0, 1, 1, 0, 0],
  [0, 0, 1, 1, 0, 0],
  [0, 0, 1, 1, 0, 0],
  [1, 1, 1, 1, 1, 1],
]
const LETTER_S: LetterBitmap = [
  [0, 1, 1, 1, 1, 1],
  [1, 1, 0, 0, 0, 0],
  [1, 1, 0, 0, 0, 0],
  [0, 1, 1, 1, 1, 0],
  [0, 0, 0, 0, 1, 1],
  [0, 0, 0, 0, 1, 1],
  [1, 1, 1, 1, 1, 0],
]

/** Sequence of (bitmap, piece-kind) pairs that make up the title. */
const TITLE_LETTERS: ReadonlyArray<{
  readonly bitmap: LetterBitmap
  readonly kind: PieceKind
}> = [
  { bitmap: LETTER_T, kind: 'T' },
  { bitmap: LETTER_E, kind: 'Z' },
  { bitmap: LETTER_T, kind: 'I' },
  { bitmap: LETTER_R, kind: 'L' },
  { bitmap: LETTER_I, kind: 'O' },
  { bitmap: LETTER_S, kind: 'S' },
]

/** SVG-unit width of one bitmap pixel when rendered as a bevelled block. */
const TITLE_CELL_SIZE = 6

function buildBevelBlockRects(
  rowIndex: number,
  colIndex: number,
  baseColor: string,
  highlightColor: string,
  shadowColor: string
): ReactElement[] {
  const originX = colIndex * TITLE_CELL_SIZE
  const originY = rowIndex * TITLE_CELL_SIZE
  const key = `${rowIndex}-${colIndex}`
  return [
    <rect
      key={`border-${key}`}
      x={originX}
      y={originY}
      width={TITLE_CELL_SIZE}
      height={TITLE_CELL_SIZE}
      fill="#000000"
    />,
    <rect
      key={`light-${key}`}
      x={originX + 1}
      y={originY + 1}
      width={TITLE_CELL_SIZE - 2}
      height={TITLE_CELL_SIZE - 2}
      fill={highlightColor}
    />,
    <rect
      key={`shadowR-${key}`}
      x={originX + TITLE_CELL_SIZE - 2}
      y={originY + 1}
      width={1}
      height={TITLE_CELL_SIZE - 2}
      fill={shadowColor}
    />,
    <rect
      key={`shadowB-${key}`}
      x={originX + 1}
      y={originY + TITLE_CELL_SIZE - 2}
      width={TITLE_CELL_SIZE - 2}
      height={1}
      fill={shadowColor}
    />,
    <rect
      key={`core-${key}`}
      x={originX + 2}
      y={originY + 2}
      width={TITLE_CELL_SIZE - 4}
      height={TITLE_CELL_SIZE - 4}
      fill={baseColor}
    />,
  ]
}

function PixelLetter({ bitmap, kind }: { readonly bitmap: LetterBitmap; readonly kind: PieceKind }) {
  const baseColor = PIECE_COLORS[kind]
  const highlightColor = PIECE_COLORS_LIGHT[kind]
  const shadowColor = PIECE_COLORS_DARK[kind]
  const rects: ReactElement[] = []
  const rowCount = bitmap.length
  const colCount = bitmap[0]?.length ?? 0
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const rowCells = bitmap[rowIndex] ?? []
    for (let colIndex = 0; colIndex < rowCells.length; colIndex += 1) {
      if (rowCells[colIndex] === 1) {
        rects.push(...buildBevelBlockRects(rowIndex, colIndex, baseColor, highlightColor, shadowColor))
      }
    }
  }
  return (
    <svg
      className="menu-title-letter"
      viewBox={`0 0 ${colCount * TITLE_CELL_SIZE} ${rowCount * TITLE_CELL_SIZE}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {rects}
    </svg>
  )
}

/** Renders "TETRIS" with per-letter piece colouring and 8-bit bevels. */
export function TetrisTitle() {
  return (
    <h1 className="menu-title" aria-label="Tetris">
      {TITLE_LETTERS.map((letter, index) => (
        <PixelLetter key={index} bitmap={letter.bitmap} kind={letter.kind} />
      ))}
    </h1>
  )
}
