/**
 * Wires the engine's event emitter to the SFX and music players and
 * applies the current audio settings. Keeps all audio side-effects in
 * one place so the {@link Game} component doesn't grow them inline.
 *
 * The SFX player is routed to engine events so every successful motion
 * (direct, DAS auto-shift, soft drop) produces the same audible cue —
 * the sound for "I moved one cell" is identical regardless of whether
 * the user pressed or the engine's auto-shift produced it.
 *
 * The music player mirrors the engine phase transitions (pause/resume/
 * gameOver/reset) and is stopped on unmount so leaving the game screen
 * never leaks the chiptune into the menu.
 */

import type { Engine } from '@tetris/engine'
import { useEffect, useRef } from 'react'

import { createMusicPlayer, type MusicPlayer } from '@/audio/music'
import { createSfxPlayer, type SfxPlayer } from '@/audio/sfx'

/** Line-clear threshold that triggers the distinctive "tetris" fanfare. */
const TETRIS_LINE_COUNT = 4

/** Subset of the stored settings this hook needs. */
export type AudioSettings = {
  readonly audioEnabled: boolean
  readonly sfxVolume: number
  readonly musicVolume: number
}

/** Creates the SFX + music players and keeps them in sync with `settings`. */
export function useGameAudio(engine: Engine, settings: AudioSettings): void {
  // Lazy-init the players on first render so no AudioContext is created
  // during SSR / test environments and each player is only constructed
  // once over the component lifetime.
  const sfxPlayerRef = useRef<SfxPlayer | null>(null)
  const musicPlayerRef = useRef<MusicPlayer | null>(null)
  if (!sfxPlayerRef.current) {
    sfxPlayerRef.current = createSfxPlayer()
  }
  if (!musicPlayerRef.current) {
    musicPlayerRef.current = createMusicPlayer()
  }
  const sfxPlayer = sfxPlayerRef.current
  const musicPlayer = musicPlayerRef.current

  // Push the current audio settings into both players.
  useEffect(() => {
    sfxPlayer.setEnabled(settings.audioEnabled)
    sfxPlayer.setVolume(settings.sfxVolume)
    musicPlayer.setEnabled(settings.audioEnabled)
    musicPlayer.setVolume(settings.musicVolume)
  }, [sfxPlayer, musicPlayer, settings.audioEnabled, settings.sfxVolume, settings.musicVolume])

  // Subscribe SFX to gameplay events.
  useEffect(() => {
    const unsubscribes = [
      engine.on('pieceMove', () => sfxPlayer.play('move')),
      engine.on('pieceRotate', () => sfxPlayer.play('rotate')),
      engine.on('pieceHardDrop', () => sfxPlayer.play('hardDrop')),
      engine.on('softDropRow', () => sfxPlayer.play('softDrop')),
      engine.on('pieceLock', () => sfxPlayer.play('lock')),
      engine.on('hold', () => sfxPlayer.play('hold')),
      engine.on('lineClear', (info) => {
        if (info.lines >= TETRIS_LINE_COUNT) {
          sfxPlayer.play('tetris')
        } else if (info.tSpin !== 'none') {
          sfxPlayer.play('tspin')
        } else {
          sfxPlayer.play('lineClear')
        }
      }),
      engine.on('levelUp', () => sfxPlayer.play('levelUp')),
      engine.on('gameOver', () => sfxPlayer.play('gameOver')),
    ]
    return () => {
      for (const unsubscribe of unsubscribes) {
        unsubscribe()
      }
    }
  }, [engine, sfxPlayer])

  // Drive background music off the engine's phase transitions.
  useEffect(() => {
    musicPlayer.start()
    const unsubscribes = [
      engine.on('pause', () => musicPlayer.pause()),
      engine.on('resume', () => musicPlayer.resume()),
      engine.on('gameOver', () => musicPlayer.stop()),
      engine.on('reset', () => musicPlayer.start()),
    ]
    return () => {
      musicPlayer.stop()
      for (const unsubscribe of unsubscribes) {
        unsubscribe()
      }
    }
  }, [engine, musicPlayer])
}
