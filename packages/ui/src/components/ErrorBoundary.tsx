/**
 * Top-level React error boundary. Catches render-phase errors in the
 * game tree, displays a minimal fallback UI, and offers a reload button
 * so the user can recover without restarting the browser tab.
 */

import { Component, type ReactNode } from 'react'

type Props = { readonly children: ReactNode }
type State = { readonly hasError: boolean; readonly message: string }

/** React class boundary that swaps broken subtrees for a recovery panel. */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message }
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>Something went wrong</h2>
          <p>{this.state.message}</p>
          <button onClick={() => window.location.reload()}>Reload</button>
        </div>
      )
    }
    return this.props.children
  }
}
