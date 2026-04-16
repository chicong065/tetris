/**
 * Hold slot. Dims the preview when the player has already used hold
 * this turn (mirrors the canvas behavior).
 */

import type { GameState } from '@tetris/engine'

import { HudPanel } from '@/components/hud/HudPanel'
import { PiecePreview } from '@/components/hud/PiecePreview'
import { HOLD_X, HOLD_Y, HOLD_SIZE } from '@/render/layout'

const HOLD_INNER_PADDING = 10
const HOLD_PREVIEW_CELL_SIZE = 24
const HOLD_USED_ALPHA = 0.35
const PREVIEW_INNER_SIZE = HOLD_SIZE - HOLD_INNER_PADDING * 2

export function HoldPanel({ state }: { readonly state: GameState }) {
  const previewAlpha = state.holdUsedThisTurn ? HOLD_USED_ALPHA : 1
  return (
    <HudPanel x={HOLD_X} y={HOLD_Y} width={HOLD_SIZE} height={HOLD_SIZE} label="HOLD">
      <div className="hold-preview" style={{ left: HOLD_INNER_PADDING, top: HOLD_INNER_PADDING }}>
        <PiecePreview
          kind={state.hold ?? null}
          width={PREVIEW_INNER_SIZE}
          height={PREVIEW_INNER_SIZE}
          cellSize={HOLD_PREVIEW_CELL_SIZE}
          alpha={previewAlpha}
        />
      </div>
    </HudPanel>
  )
}
