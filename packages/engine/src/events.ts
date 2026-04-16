/**
 * Tiny typed event emitter used by the engine to fan out gameplay
 * transitions to external subscribers. Listeners are stored per-event in
 * plain `Set`s so subscribe/unsubscribe stays O(1) and event delivery
 * stays synchronous.
 */

import type { EngineEvents } from '@engine/types'

/**
 * Imperative facade returned by {@link createEventEmitter}. `emit` fires a
 * named event, `on` registers a handler and returns an unsubscribe
 * callback, `off` removes a specific handler, and `clear` drops every
 * listener (used during engine teardown).
 */
export type EventEmitter = {
  readonly emit: <K extends keyof EngineEvents>(event: K, payload: EngineEvents[K]) => void
  readonly on: <K extends keyof EngineEvents>(event: K, handler: (payload: EngineEvents[K]) => void) => () => void
  readonly off: <K extends keyof EngineEvents>(event: K, handler: (payload: EngineEvents[K]) => void) => void
  readonly clear: () => void
}

/**
 * Creates a fresh emitter. Handlers added during an `emit` call for the
 * same event are skipped in that delivery pass (we snapshot the handler
 * set before iterating) to avoid surprising re-entrancy.
 */
export function createEventEmitter(): EventEmitter {
  const handlers = new Map<keyof EngineEvents, Set<(payload: unknown) => void>>()

  function bucket(event: keyof EngineEvents): Set<(payload: unknown) => void> {
    let existing = handlers.get(event)
    if (!existing) {
      existing = new Set()
      handlers.set(event, existing)
    }
    return existing
  }

  return {
    emit: (event, payload) => {
      const entry = handlers.get(event)
      if (!entry || entry.size === 0) {
        return
      }
      const snapshot = Array.from(entry)
      for (const handler of snapshot) {
        handler(payload as unknown)
      }
    },
    on: (event, handler) => {
      const entry = bucket(event)
      entry.add(handler as (payload: unknown) => void)
      return () => {
        entry.delete(handler as (payload: unknown) => void)
      }
    },
    off: (event, handler) => {
      const entry = handlers.get(event)
      if (!entry) {
        return
      }
      entry.delete(handler as (payload: unknown) => void)
    },
    clear: () => {
      handlers.clear()
    },
  }
}
