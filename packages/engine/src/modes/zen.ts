/**
 * Zen mode helpers. Zen is an endless, judgement-free session: block-out
 * and lock-out never end the game. When a freshly-spawned piece would
 * intersect the stack, the engine clears the top few rows so the spawn
 * point is cleared and play continues uninterrupted.
 */

import { VISIBLE_TOP, BOARD_WIDTH } from '@engine/constants'
import type { Cell, Playfield } from '@engine/types'

/**
 * Number of rows cleared from the top of the board when Zen mode rescues
 * a blocked spawn. Four is enough to re-open every standard spawn cell
 * without tearing down too much of the player's stack.
 */
export const ZEN_SPAWN_CLEAR_ROWS = 4

/**
 * Returns a new board with the top `ZEN_SPAWN_CLEAR_ROWS` rows of the
 * playable area wiped clear. Rows above the visible area (the vanish
 * zone) are also wiped so a piece can re-spawn without collision.
 */
export function clearTopForZenSpawn(board: Playfield): Playfield {
  const emptyRow: readonly Cell[] = Array.from({ length: BOARD_WIDTH }, () => null)
  const copy: Cell[][] = board.map((row) => [...row])
  const wipeFrom = 0
  const wipeTo = VISIBLE_TOP + ZEN_SPAWN_CLEAR_ROWS
  for (let rowIndex = wipeFrom; rowIndex < wipeTo && rowIndex < copy.length; rowIndex += 1) {
    copy[rowIndex] = [...emptyRow]
  }
  return copy
}
