/**
 * Root application component. Owns the top-level screen state machine
 * (menu / game / settings) and routes between them. A `key` that
 * includes `Date.now()` on the Game screen forces a fresh mount so
 * each run starts with a new engine instance.
 */

import type { GameMode } from '@tetris/engine'
import { useCallback, useState } from 'react'

import { Game } from '@/components/Game'
import { Menu } from '@/components/Menu'
import { Settings } from '@/components/Settings'

/** Tagged union representing which screen is currently active. */
type ActiveScreen =
  | { readonly kind: 'menu' }
  | { readonly kind: 'game'; readonly mode: GameMode; readonly startLevel?: number }
  | { readonly kind: 'settings' }

const MENU_SCREEN: ActiveScreen = { kind: 'menu' }

/** Top-level router-as-state-machine for the SPA. */
export function App() {
  const [screen, setScreen] = useState<ActiveScreen>(MENU_SCREEN)

  const goToMenu = useCallback(() => {
    setScreen(MENU_SCREEN)
  }, [])

  const startGame = useCallback((mode: GameMode, options?: { readonly startLevel?: number }) => {
    const nextScreen: ActiveScreen =
      options?.startLevel != null ? { kind: 'game', mode, startLevel: options.startLevel } : { kind: 'game', mode }
    setScreen(nextScreen)
  }, [])

  const openSettings = useCallback(() => {
    setScreen({ kind: 'settings' })
  }, [])

  return (
    <main className="app">
      {screen.kind === 'menu' && <Menu onStart={startGame} onOpenSettings={openSettings} />}
      {screen.kind === 'game' && (
        <Game
          key={`${screen.mode}-${Date.now()}`}
          mode={screen.mode}
          {...(screen.startLevel != null ? { startLevel: screen.startLevel } : {})}
          onExit={goToMenu}
        />
      )}
      {screen.kind === 'settings' && <Settings onClose={goToMenu} />}
    </main>
  )
}
