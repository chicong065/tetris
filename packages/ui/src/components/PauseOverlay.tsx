/**
 * Pause overlay: covers the game canvas with a Resume / Exit dialog when
 * the `paused` phase is active.
 */

/** Props for {@link PauseOverlay}, resume or exit callbacks. */
export type PauseOverlayProps = {
  readonly onResume: () => void
  readonly onExit: () => void
}

/** Modal rendered while the engine phase is `paused`. */
export function PauseOverlay({ onResume, onExit }: PauseOverlayProps) {
  return (
    <div className="game-overlay" role="dialog" aria-label="Paused">
      <div className="panel game-overlay-panel">
        <h2 className="panel-title">PAUSED</h2>
        <button type="button" className="btn btn-primary" onClick={onResume} autoFocus>
          Resume
        </button>
        <button type="button" className="btn btn-secondary" onClick={onExit}>
          Exit to menu
        </button>
      </div>
    </div>
  )
}
