/**
 * React bindings for `@tetris/engine`: owns the engine instance for the
 * component lifecycle, exposes its state via {@link useSyncExternalStore},
 * and syncs settings overrides back into the engine.
 */

import { createEngine, type Engine, type EngineOptions, type EngineSettings } from '@tetris/engine'
import { useMemo, useSyncExternalStore, useEffect } from 'react'

/** Creates an engine once on mount and tears it down on unmount. */
export function useEngine(options?: EngineOptions): Engine {
  const engine = useMemo(() => createEngine(options), [])
  useEffect(() => {
    return () => {
      engine.destroy()
    }
  }, [engine])
  return engine
}

/** Subscribes to the engine and returns its current immutable state. */
export function useEngineSnapshot(engine: Engine) {
  return useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot)
}

/**
 * Pushes DAS/ARR/soft-drop overrides into the engine whenever they
 * change. Deps list is tuned to the relevant values to avoid retriggering
 * on identity-changed `settings` objects.
 */
export function useEngineSettings(engine: Engine, settings: Partial<EngineSettings>): void {
  useEffect(() => {
    engine.configure(settings)
  }, [engine, settings.dasMs, settings.arrMs, settings.softDropFactor])
}
