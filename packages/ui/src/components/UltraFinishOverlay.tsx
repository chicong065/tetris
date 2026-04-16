/**
 * Finish overlay for Ultra mode. Shows the final score reached within the
 * two minute timer, records the entry on the Ultra leaderboard, and
 * highlights a new personal best.
 */

import { useEffect, useState } from 'react'

import { padScore } from '@/format'
import { addUltraScore } from '@/storage/persist'

/** Props for {@link UltraFinishOverlay}: final score, line count, and callbacks. */
export type UltraFinishOverlayProps = {
  readonly score: number
  readonly lines: number
  readonly onRestart: () => void
  readonly onExit: () => void
}

/** Modal shown when the Ultra timer expires. Records the score. */
export function UltraFinishOverlay({ score, lines, onRestart, onExit }: UltraFinishOverlayProps) {
  const [isNewPersonalBest, setIsNewPersonalBest] = useState(false)

  useEffect(() => {
    const insertion = addUltraScore({ score, lines, date: Date.now() })
    setIsNewPersonalBest(insertion.rank === 0)
  }, [])

  return (
    <div className="game-overlay" role="dialog" aria-label="Ultra finished">
      <div className="panel game-overlay-panel">
        <h2 className="panel-title">TIME UP</h2>
        {isNewPersonalBest && <div className="game-overlay-best">NEW BEST!</div>}
        <div className="game-overlay-stats">
          <div>
            Score: <strong>{padScore(score)}</strong>
          </div>
          <div>
            Lines: <strong>{lines}</strong>
          </div>
        </div>
        <button type="button" className="btn btn-primary" onClick={onRestart} autoFocus>
          Play again
        </button>
        <button type="button" className="btn btn-secondary" onClick={onExit}>
          Exit to menu
        </button>
      </div>
    </div>
  )
}
