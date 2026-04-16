/**
 * Touch controls for mobile: horizontal swipes move, downward drag starts
 * soft drop, a fast downward flick triggers hard drop, and a tap (short
 * duration + small movement) rotates clockwise. Thresholds are tuned for
 * comfortable one-handed play.
 */

import type { Engine } from '@tetris/engine'
import { useEffect } from 'react'

/** Horizontal delta (px) that fires one tap-move per threshold crossed. */
const SWIPE_THRESHOLD_PX = 20
/** Total downward delta (px) interpreted as a hard-drop gesture. */
const HARD_DROP_THRESHOLD_PX = 60
/** Max duration (ms) of a tap that counts as a rotate. */
const TAP_MAX_DURATION_MS = 200
/** Max total movement (px) allowed during a tap rotation. */
const TAP_MAX_MOVEMENT_PX = 10
/** Vertical delta (px) that promotes a drag into the soft-drop state. */
const SOFT_DROP_TRIGGER_PX = 5

/** Per-gesture scratch state tracked across touchstart/move/end. */
type TouchGestureState = {
  startX: number
  startY: number
  startTime: number
  lastX: number
  lastY: number
  softDropActive: boolean
  totalMovementX: number
  totalMovementY: number
}

/**
 * Attaches touch listeners to `targetRef` for the component lifetime.
 *
 * Thresholds are in CSS pixels via `touch.clientX`/`touch.clientY`,
 * which are stable regardless of any CSS transforms on the target
 * element — so the tuning holds even though the game stage is
 * usually under a `transform: scale(...)`.
 */
export function useTouch(targetRef: React.RefObject<HTMLElement | null>, engine: Engine): void {
  useEffect(() => {
    const target = targetRef.current
    if (!target) {
      return
    }

    let gesture: TouchGestureState | null = null

    function onTouchStart(event: TouchEvent): void {
      const firstTouch = event.touches[0]
      if (!firstTouch) {
        return
      }
      gesture = {
        startX: firstTouch.clientX,
        startY: firstTouch.clientY,
        startTime: performance.now(),
        lastX: firstTouch.clientX,
        lastY: firstTouch.clientY,
        softDropActive: false,
        totalMovementX: 0,
        totalMovementY: 0,
      }
    }

    function onTouchMove(event: TouchEvent): void {
      if (!gesture) {
        return
      }
      const firstTouch = event.touches[0]
      if (!firstTouch) {
        return
      }
      event.preventDefault()
      const deltaX = firstTouch.clientX - gesture.lastX
      const deltaY = firstTouch.clientY - gesture.lastY
      gesture.lastX = firstTouch.clientX
      gesture.lastY = firstTouch.clientY
      gesture.totalMovementX += Math.abs(deltaX)
      gesture.totalMovementY += Math.abs(deltaY)

      // One move per frame to avoid runaways on big swipes.
      if (Math.abs(deltaX) >= SWIPE_THRESHOLD_PX) {
        if (deltaX > 0) {
          engine.moveRight()
          engine.releaseMoveRight()
        } else {
          engine.moveLeft()
          engine.releaseMoveLeft()
        }
      }

      if (deltaY > SOFT_DROP_TRIGGER_PX && !gesture.softDropActive) {
        gesture.softDropActive = true
        engine.softDrop()
      }
    }

    function onTouchEnd(): void {
      if (!gesture) {
        return
      }
      const durationMs = performance.now() - gesture.startTime
      const totalDeltaY = gesture.lastY - gesture.startY

      if (gesture.softDropActive) {
        engine.releaseSoftDrop()
      }

      const isHardDropFlick = totalDeltaY > HARD_DROP_THRESHOLD_PX && gesture.totalMovementY > gesture.totalMovementX
      const isTap =
        durationMs < TAP_MAX_DURATION_MS &&
        gesture.totalMovementX < TAP_MAX_MOVEMENT_PX &&
        gesture.totalMovementY < TAP_MAX_MOVEMENT_PX

      if (isHardDropFlick) {
        engine.hardDrop()
      } else if (isTap) {
        engine.rotate('cw')
      }

      gesture = null
    }

    target.addEventListener('touchstart', onTouchStart, { passive: true })
    target.addEventListener('touchmove', onTouchMove, { passive: false })
    target.addEventListener('touchend', onTouchEnd, { passive: true })
    target.addEventListener('touchcancel', onTouchEnd, { passive: true })

    return () => {
      target.removeEventListener('touchstart', onTouchStart)
      target.removeEventListener('touchmove', onTouchMove)
      target.removeEventListener('touchend', onTouchEnd)
      target.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [targetRef, engine])
}
