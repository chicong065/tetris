/**
 * Post-game overlay shown when a Marathon or Zen session ends in a
 * lock/block-out. Persists the finishing Marathon score to the
 * leaderboard on mount (Zen is stored on exit in {@link Game}) and
 * highlights a new best (rank 0) or the player's placement.
 *
 * Session stats (score, level, lines, time, PPS, LPM) stay visible in
 * the HUD stats panel beside the dimmed playfield, so the modal
 * intentionally omits them and focuses on celebration + next action.
 */

import type { GameState } from '@tetris/engine'
import { useEffect, useState } from 'react'

import { padScore } from '@/format'
import { addMarathonScore } from '@/storage/persist'

/** `rank` value from the storage layer meaning "did not place in top 10". */
const RANK_NOT_PLACED = -1
const FINAL_SCORE_ELEMENT_ID = 'game-over-final-score'

export type GameOverOverlayProps = {
  readonly state: GameState
  readonly onRestart: () => void
  readonly onExit: () => void
}

export function GameOverOverlay({ state, onRestart, onExit }: GameOverOverlayProps) {
  const [leaderboardRank, setLeaderboardRank] = useState<number>(RANK_NOT_PLACED)

  useEffect(() => {
    if (state.mode !== 'marathon') {
      return
    }
    const insertion = addMarathonScore({
      score: state.score,
      level: state.level,
      lines: state.lines,
      timeMs: state.elapsedMs,
      date: Date.now(),
    })
    setLeaderboardRank(insertion.rank)
    // Run once when the overlay mounts after game over.
  }, [])

  const isMarathon = state.mode === 'marathon'
  const isNewPersonalBest = isMarathon && leaderboardRank === 0
  const hasLeaderboardPlacement = isMarathon && leaderboardRank > 0

  return (
    <div
      className="game-overlay"
      role="dialog"
      aria-label="Game over"
      aria-describedby={isMarathon ? FINAL_SCORE_ELEMENT_ID : undefined}
    >
      <div className="panel game-overlay-panel">
        <h2 className="panel-title">GAME OVER</h2>

        {isMarathon && (
          <div className="game-over-score-block" id={FINAL_SCORE_ELEMENT_ID}>
            <div className="game-over-score-label">FINAL SCORE</div>
            <div className="game-over-score-value">{padScore(state.score)}</div>
          </div>
        )}

        {(isNewPersonalBest || hasLeaderboardPlacement) && (
          <div className="game-over-ribbon">
            {isNewPersonalBest && <span className="game-overlay-best">NEW BEST!</span>}
            {hasLeaderboardPlacement && <span className="game-over-rank">RANK #{leaderboardRank + 1}</span>}
          </div>
        )}

        <div className="game-over-actions">
          <button type="button" className="btn btn-primary" onClick={onRestart} autoFocus>
            Play again
          </button>
          <button type="button" className="btn btn-secondary" onClick={onExit}>
            Exit to menu
          </button>
        </div>
      </div>
    </div>
  )
}
