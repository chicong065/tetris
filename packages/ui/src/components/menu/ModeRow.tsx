/**
 * Reusable menu row: a left-stripe bordered button with the mode name
 * (or label) on top and a dim subtitle underneath. Optional `children`
 * lets the Marathon row dock its level picker on the right side.
 */

import type { ReactNode } from 'react'

export type ModeRowProps = {
  readonly className: string
  readonly name: string
  readonly subtitle: string
  readonly onSelect: () => void
  readonly children?: ReactNode
}

export function ModeRow({ className, name, subtitle, onSelect, children }: ModeRowProps) {
  return (
    <button type="button" className={`menu-mode-row ${className}`} onClick={onSelect}>
      <span className="menu-mode-info">
        <span className="menu-mode-name">{name}</span>
        <span className="menu-mode-best">{subtitle}</span>
      </span>
      {children}
    </button>
  )
}
