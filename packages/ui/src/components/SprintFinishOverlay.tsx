/**
 * Finish overlay for Sprint mode. Shows the final time, records the
 * entry on the Sprint leaderboard, and highlights a new personal best.
 */

import { useEffect, useState } from 'react'

import { formatTime } from '@/format'
import { addSprintScore } from '@/storage/persist'

/** Line goal that defines a completed Sprint run (matches the engine rule). */
const SPRINT_GOAL_LINES = 40

/** Props for {@link SprintFinishOverlay}: finish time + navigation callbacks. */
export type SprintFinishOverlayProps = {
  readonly timeMs: number
  readonly onRestart: () => void
  readonly onExit: () => void
}

/** Modal shown when the Sprint target is reached. Records the score. */
export function SprintFinishOverlay({ timeMs, onRestart, onExit }: SprintFinishOverlayProps) {
  const [isNewPersonalBest, setIsNewPersonalBest] = useState(false)

  useEffect(() => {
    const insertion = addSprintScore({
      timeMs,
      lines: SPRINT_GOAL_LINES,
      date: Date.now(),
    })
    setIsNewPersonalBest(insertion.rank === 0)
  }, [])

  return (
    <div className="game-overlay" role="dialog" aria-label="Sprint finished">
      <div className="panel game-overlay-panel">
        <h2 className="panel-title">CLEARED</h2>
        {isNewPersonalBest && <div className="game-overlay-best">NEW BEST!</div>}
        <div className="game-overlay-stats">
          <div>
            Time: <strong>{formatTime(timeMs)}</strong>
          </div>
        </div>
        <button type="button" className="btn btn-primary" onClick={onRestart} autoFocus>
          Try again
        </button>
        <button type="button" className="btn btn-secondary" onClick={onExit}>
          Exit to menu
        </button>
      </div>
    </div>
  )
}
