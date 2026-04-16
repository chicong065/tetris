/**
 * Application entry point. Mounts the React tree inside the `#root`
 * element, wrapping it in StrictMode and the top-level ErrorBoundary
 * so unexpected render-phase failures degrade gracefully.
 */

import '@/index.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from '@/App'
import { ErrorBoundary } from '@/components/ErrorBoundary'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element #root not found')
}

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
)
