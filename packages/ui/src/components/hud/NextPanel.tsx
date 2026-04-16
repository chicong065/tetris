/**
 * Next queue. Shows up to {@link NEXT_QUEUE_VISIBLE_COUNT} upcoming
 * pieces, one per row. Panel height grows with the number of visible
 * slots.
 */

import type { GameState } from '@tetris/engine'

import { HudPanel } from '@/components/hud/HudPanel'
import { PiecePreview } from '@/components/hud/PiecePreview'
import { NEXT_X, NEXT_Y, NEXT_BOX_WIDTH, NEXT_CELL, NEXT_SLOT_HEIGHT } from '@/render/layout'

const NEXT_PANEL_INNER_PADDING = 6
const NEXT_QUEUE_VISIBLE_COUNT = 5

export function NextPanel({ state }: { readonly state: GameState }) {
  const visibleCount = Math.min(NEXT_QUEUE_VISIBLE_COUNT, state.queue.length)
  const panelInnerHeight = NEXT_SLOT_HEIGHT * visibleCount + NEXT_PANEL_INNER_PADDING * 2
  const slotWidth = NEXT_BOX_WIDTH - NEXT_PANEL_INNER_PADDING * 2

  return (
    <HudPanel x={NEXT_X} y={NEXT_Y} width={NEXT_BOX_WIDTH} height={panelInnerHeight} label="NEXT">
      <div className="next-slots" style={{ padding: NEXT_PANEL_INNER_PADDING }}>
        {Array.from({ length: visibleCount }, (_, slotIndex) => {
          const kind = state.queue[slotIndex] ?? null
          // Key on slot position, not piece kind — reusing the same
          // canvas node when the queue shifts lets React skip DOM
          // churn and only redraw the canvas contents.
          return (
            <div key={slotIndex} className="next-slot" style={{ height: NEXT_SLOT_HEIGHT, width: slotWidth }}>
              <PiecePreview kind={kind} width={slotWidth} height={NEXT_SLOT_HEIGHT} cellSize={NEXT_CELL} />
            </div>
          )
        })}
      </div>
    </HudPanel>
  )
}
