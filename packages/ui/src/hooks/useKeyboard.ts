/**
 * Keyboard input hook. Translates browser key events to engine inputs
 * via a configurable binding table. Prevents default for all bound keys,
 * dedupes auto-repeat, and flushes held directions on window blur.
 */

import type { Engine, Input } from '@tetris/engine'
import { isPaused, isPlaying } from '@tetris/engine'
import { useEffect } from 'react'

/** User-configurable key bindings (arrays allow multiple aliases per action). */
export type KeyBinds = {
  readonly moveLeft: readonly string[]
  readonly moveRight: readonly string[]
  readonly softDrop: readonly string[]
  readonly hardDrop: readonly string[]
  readonly rotateCW: readonly string[]
  readonly rotateCCW: readonly string[]
  readonly rotate180: readonly string[]
  readonly hold: readonly string[]
  readonly pause: readonly string[]
  readonly reset: readonly string[]
}

/** Default bindings, arrow keys + standard modern guideline rotations. */
export const DEFAULT_BINDS: KeyBinds = {
  moveLeft: ['ArrowLeft'],
  moveRight: ['ArrowRight'],
  softDrop: ['ArrowDown'],
  hardDrop: ['Space'],
  rotateCW: ['ArrowUp', 'KeyX'],
  rotateCCW: ['KeyZ', 'ControlLeft'],
  rotate180: ['KeyA'],
  hold: ['ShiftLeft', 'KeyC'],
  pause: ['Escape', 'KeyP'],
  reset: ['KeyR'],
}

function isBoundTo(keyCode: string, binds: readonly string[]): boolean {
  return binds.includes(keyCode)
}

/**
 * Attaches keyboard listeners for the lifetime of the component. The
 * optional `onInput` callback fires once per key-down for components
 * that want to observe inputs (e.g. to play SFX).
 */
export function useKeyboard(engine: Engine, binds: KeyBinds = DEFAULT_BINDS, onInput?: (input: Input) => void): void {
  useEffect(() => {
    const pressedCodes = new Set<string>()

    function resolveKeyDown(keyCode: string): Input | null {
      if (isBoundTo(keyCode, binds.moveLeft)) {
        return { kind: 'moveLeftPress' }
      }
      if (isBoundTo(keyCode, binds.moveRight)) {
        return { kind: 'moveRightPress' }
      }
      if (isBoundTo(keyCode, binds.softDrop)) {
        return { kind: 'softDropPress' }
      }
      if (isBoundTo(keyCode, binds.hardDrop)) {
        return { kind: 'hardDrop' }
      }
      if (isBoundTo(keyCode, binds.rotateCW)) {
        return { kind: 'rotateCW' }
      }
      if (isBoundTo(keyCode, binds.rotateCCW)) {
        return { kind: 'rotateCCW' }
      }
      if (isBoundTo(keyCode, binds.rotate180)) {
        return { kind: 'rotate180' }
      }
      if (isBoundTo(keyCode, binds.hold)) {
        return { kind: 'hold' }
      }
      if (isBoundTo(keyCode, binds.pause)) {
        return { kind: 'pause' }
      }
      if (isBoundTo(keyCode, binds.reset)) {
        return { kind: 'reset' }
      }
      return null
    }

    function resolveKeyUp(keyCode: string): Input | null {
      if (isBoundTo(keyCode, binds.moveLeft)) {
        return { kind: 'moveLeftRelease' }
      }
      if (isBoundTo(keyCode, binds.moveRight)) {
        return { kind: 'moveRightRelease' }
      }
      if (isBoundTo(keyCode, binds.softDrop)) {
        return { kind: 'softDropRelease' }
      }
      return null
    }

    function applyInput(input: Input): void {
      switch (input.kind) {
        case 'moveLeftPress':
          engine.moveLeft()
          break
        case 'moveLeftRelease':
          engine.releaseMoveLeft()
          break
        case 'moveRightPress':
          engine.moveRight()
          break
        case 'moveRightRelease':
          engine.releaseMoveRight()
          break
        case 'softDropPress':
          engine.softDrop()
          break
        case 'softDropRelease':
          engine.releaseSoftDrop()
          break
        case 'hardDrop':
          engine.hardDrop()
          break
        case 'rotateCW':
          engine.rotate('cw')
          break
        case 'rotateCCW':
          engine.rotate('ccw')
          break
        case 'rotate180':
          engine.rotate('180')
          break
        case 'hold':
          engine.hold()
          break
        case 'pause': {
          // Toggle between playing and paused only. In terminal phases
          // (gameOver / sprintFinished / ultraFinished), pressing the
          // pause key is a no-op — the overlay's own Exit button is
          // the intended way out.
          const snapshot = engine.getSnapshot()
          if (isPaused(snapshot)) {
            engine.resume()
          } else if (isPlaying(snapshot)) {
            engine.pause()
          }
          break
        }
        case 'resume':
          engine.resume()
          break
        case 'reset':
          engine.reset()
          break
      }
    }

    function onKeyDown(event: KeyboardEvent): void {
      if (event.repeat) {
        return
      }
      if (pressedCodes.has(event.code)) {
        return
      }
      pressedCodes.add(event.code)
      const input = resolveKeyDown(event.code)
      if (!input) {
        return
      }
      event.preventDefault()
      applyInput(input)
      if (onInput) {
        onInput(input)
      }
    }

    function onKeyUp(event: KeyboardEvent): void {
      pressedCodes.delete(event.code)
      const input = resolveKeyUp(event.code)
      if (!input) {
        return
      }
      event.preventDefault()
      applyInput(input)
    }

    function onBlur(): void {
      pressedCodes.clear()
      engine.releaseMoveLeft()
      engine.releaseMoveRight()
      engine.releaseSoftDrop()
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [engine, binds, onInput])
}
