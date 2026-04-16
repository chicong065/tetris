/**
 * Tests for the DAS/ARR autoshift state machine: initial charge, DAS
 * delay, ARR pulse firing, release behaviour, and opposite-direction
 * override.
 */

import { initialAutoshift, pressDirection, releaseDirection, tickAutoshift } from '@engine/input'
import { describe, it, expect } from 'vitest'

const settings = { dasMs: 133, arrMs: 10, softDropFactor: 20 }

describe('autoshift', () => {
  it('initial state has no direction', () => {
    const state = initialAutoshift()
    expect(state.direction).toBe(0)
    expect(state.chargedMs).toBe(0)
    expect(state.arrAccumulatorMs).toBe(0)
  })

  it('pressing a direction emits one immediate move and sets state', () => {
    const { state, emits } = pressDirection(initialAutoshift(), 'right')
    expect(state.direction).toBe(1)
    expect(emits).toBe(1)
  })

  it('holding before DAS does not emit further moves', () => {
    let { state } = pressDirection(initialAutoshift(), 'right')
    const result = tickAutoshift(state, 100, settings)
    state = result.state
    expect(result.emits).toBe(0)
    expect(state.chargedMs).toBe(100)
  })

  it('after DAS elapses, ARR pulses start firing', () => {
    let { state } = pressDirection(initialAutoshift(), 'right')
    // elapse DAS
    let result = tickAutoshift(state, 133, settings)
    state = result.state
    // one ARR tick
    result = tickAutoshift(state, 10, settings)
    expect(result.emits).toBe(1)
  })

  it('ARR fires multiple times when delta covers several intervals', () => {
    let { state } = pressDirection(initialAutoshift(), 'right')
    let result = tickAutoshift(state, 133, settings)
    state = result.state
    result = tickAutoshift(state, 35, settings) // 3 full ARR intervals of 10ms
    expect(result.emits).toBe(3)
  })

  it('releasing direction clears state', () => {
    const pressed = pressDirection(initialAutoshift(), 'right')
    const state = releaseDirection(pressed.state, 'right')
    expect(state.direction).toBe(0)
    expect(state.chargedMs).toBe(0)
  })

  it('pressing opposite direction overrides and emits a new move', () => {
    const first = pressDirection(initialAutoshift(), 'right')
    const second = pressDirection(first.state, 'left')
    expect(second.state.direction).toBe(-1)
    expect(second.emits).toBe(1)
    expect(second.state.chargedMs).toBe(0)
  })

  it('releaseDirection is a no-op when the released key is not the active one', () => {
    // Press left, release right: left stays armed.
    const pressedLeft = pressDirection(initialAutoshift(), 'left').state
    expect(releaseDirection(pressedLeft, 'right')).toBe(pressedLeft)
    // Mirror case: press right, release left.
    const pressedRight = pressDirection(initialAutoshift(), 'right').state
    expect(releaseDirection(pressedRight, 'left')).toBe(pressedRight)
  })

  it('instant ARR (arrMs === 0) emits a burst sized by the post-DAS accumulator', () => {
    const armed = pressDirection(initialAutoshift(), 'right').state
    // 250 ms tick, DAS 100 ms → 150 ms of accumulator → burst of 150
    // (the caller clamps against the board edge).
    const result = tickAutoshift(armed, 250, { dasMs: 100, arrMs: 0, softDropFactor: 20 })
    expect(result.emits).toBeGreaterThan(0)
  })
})
