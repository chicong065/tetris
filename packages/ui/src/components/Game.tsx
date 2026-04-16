/**
 * The running-game screen. Owns the engine instance, canvas, keyboard/
 * touch inputs, audio cues, and all phase overlays (pause, game over,
 * sprint finish, ultra finish). Settings are loaded once on mount and
 * applied to the engine; audio side-effects live in {@link useGameAudio}.
 */

import type { GameMode, GameState } from '@tetris/engine'
import { isPaused, isGameOver } from '@tetris/engine'
import { useRef, useMemo, useEffect, useCallback, type CSSProperties } from 'react'

import { GameOverOverlay } from '@/components/GameOverOverlay'
import { HoldPanel, NextPanel, StatsPanel } from '@/components/hud'
import { PauseOverlay } from '@/components/PauseOverlay'
import { SprintFinishOverlay } from '@/components/SprintFinishOverlay'
import { TouchControls } from '@/components/TouchControls'
import { UltraFinishOverlay } from '@/components/UltraFinishOverlay'
import { useEngine, useEngineSnapshot, useEngineSettings } from '@/hooks/useEngine'
import { useGameAudio } from '@/hooks/useGameAudio'
import { useKeyboard } from '@/hooks/useKeyboard'
import { useRafDraw } from '@/hooks/useRafDraw'
import { useStageScale } from '@/hooks/useStageScale'
import { useTouch } from '@/hooks/useTouch'
import { PLAYFIELD_CANVAS_WIDTH, PLAYFIELD_CANVAS_HEIGHT } from '@/render/canvas'
import { STAGE_WIDTH, STAGE_HEIGHT, PLAYFIELD_STAGE_X, PLAYFIELD_STAGE_Y, FRAME_WIDTH } from '@/render/layout'
import { loadSettings, addZenScore } from '@/storage/persist'

/** Props for the {@link Game} screen. `onExit` returns the user to the menu. */
export type GameProps = {
  readonly mode: GameMode
  /** Marathon starting level. Ignored for other modes. */
  readonly startLevel?: number
  readonly onExit: () => void
}

/**
 * CSS custom properties the stage / overlay styles read to size and
 * position themselves. Expressed as a typed helper so the Game render
 * body stays compact.
 */
function buildStageCssVars(): CSSProperties {
  return {
    '--stage-width': `${STAGE_WIDTH}px`,
    '--stage-height': `${STAGE_HEIGHT}px`,
    '--playfield-x': `${PLAYFIELD_STAGE_X - FRAME_WIDTH}px`,
    '--playfield-y': `${PLAYFIELD_STAGE_Y - FRAME_WIDTH}px`,
    '--playfield-w': `${PLAYFIELD_CANVAS_WIDTH}px`,
    '--playfield-h': `${PLAYFIELD_CANVAS_HEIGHT}px`,
  } as CSSProperties
}

/** Inline position of the playfield canvas inside the scaled stage. */
function buildPlayfieldCanvasStyle(): CSSProperties {
  return {
    left: PLAYFIELD_STAGE_X - FRAME_WIDTH,
    top: PLAYFIELD_STAGE_Y - FRAME_WIDTH,
    width: PLAYFIELD_CANVAS_WIDTH,
    height: PLAYFIELD_CANVAS_HEIGHT,
  }
}

/** Full-screen game view for a single Marathon / Sprint / Ultra / Zen session. */
export function Game({ mode, startLevel, onExit }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stageWrapperRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)

  const storedSettings = useMemo(() => loadSettings(), [])
  const engine = useEngine({
    seed: Date.now(),
    settings: {
      dasMs: storedSettings.dasMs,
      arrMs: storedSettings.arrMs,
      softDropFactor: storedSettings.softDropFactor,
    },
  })
  useEngineSettings(engine, {
    dasMs: storedSettings.dasMs,
    arrMs: storedSettings.arrMs,
    softDropFactor: storedSettings.softDropFactor,
  })
  useStageScale(stageRef, stageWrapperRef)
  useRafDraw(canvasRef, engine, storedSettings.reducedMotion)
  useKeyboard(engine, storedSettings.keyBinds)
  useTouch(stageWrapperRef, engine)
  useGameAudio(engine, {
    audioEnabled: storedSettings.audioEnabled,
    sfxVolume: storedSettings.sfxVolume,
    musicVolume: storedSettings.musicVolume,
  })

  const state = useEngineSnapshot(engine)

  // Start the session on mount. Runs once per (engine, mode) pair —
  // the engine instance is stable (created via useMemo) and `mode` is
  // a prop that determines the game variant.
  useEffect(() => {
    if (mode === 'marathon' && startLevel != null) {
      engine.startGame({ mode, startLevel })
    } else {
      engine.startGame({ mode })
    }
  }, [engine, mode, startLevel])

  // Stable ref to the latest snapshot so the exit handler can read
  // current state without re-subscribing on every frame.
  const latestStateRef = useRef<GameState>(state)
  latestStateRef.current = state

  // Record a Zen session's stats on exit, then hand off to the parent.
  const handleExit = useCallback(() => {
    const snapshot = latestStateRef.current
    if (snapshot.mode === 'zen' && snapshot.lines > 0) {
      addZenScore({
        lines: snapshot.lines,
        timeMs: snapshot.elapsedMs,
        date: Date.now(),
      })
    }
    onExit()
  }, [onExit])

  const handleRestart = useCallback(() => {
    engine.reset()
  }, [engine])

  const handleResume = useCallback(() => {
    engine.resume()
  }, [engine])

  return (
    <div className="game" role="application" aria-label="Tetris game">
      <div className="game-stage-wrapper" ref={stageWrapperRef} style={buildStageCssVars()}>
        <div className="game-stage" ref={stageRef}>
          <HoldPanel state={state} />
          <StatsPanel state={state} />
          <canvas
            ref={canvasRef}
            width={PLAYFIELD_CANVAS_WIDTH}
            height={PLAYFIELD_CANVAS_HEIGHT}
            className="game-canvas"
            style={buildPlayfieldCanvasStyle()}
          />
          <NextPanel state={state} />
        </div>
        {isPaused(state) && <PauseOverlay onResume={handleResume} onExit={handleExit} />}
        {isGameOver(state) && <GameOverOverlay state={state} onRestart={handleRestart} onExit={handleExit} />}
        {state.phase.kind === 'sprintFinished' && (
          <SprintFinishOverlay timeMs={state.phase.timeMs} onRestart={handleRestart} onExit={handleExit} />
        )}
        {state.phase.kind === 'ultraFinished' && (
          <UltraFinishOverlay
            score={state.phase.score}
            lines={state.lines}
            onRestart={handleRestart}
            onExit={handleExit}
          />
        )}
      </div>
      <TouchControls engine={engine} />
    </div>
  )
}
