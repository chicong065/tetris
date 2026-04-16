/**
 * Keyboard cheat-sheet rendered as a 4-column label/key grid. Labels
 * are on the left in the dim text colour; keys are on the right in
 * the accent-alt colour with inline pixel-arrow icons for the
 * directional keys.
 */

import { ArrowLeftIcon, ArrowRightIcon, ArrowDownIcon } from '@/components/menu/ArrowIcons'

export function KeyHintLegend() {
  return (
    <div className="menu-hint">
      <span className="menu-hint-label">MOVE</span>
      <span className="menu-hint-key menu-hint-icons">
        <ArrowLeftIcon />
        <ArrowRightIcon />
      </span>
      <span className="menu-hint-label">ROTATE</span>
      <span className="menu-hint-key">Z X</span>

      <span className="menu-hint-label">SOFT</span>
      <span className="menu-hint-key menu-hint-icons">
        <ArrowDownIcon />
      </span>
      <span className="menu-hint-label">HARD</span>
      <span className="menu-hint-key">SPACE</span>

      <span className="menu-hint-label">HOLD</span>
      <span className="menu-hint-key">SHIFT</span>
      <span className="menu-hint-label">PAUSE</span>
      <span className="menu-hint-key">ESC</span>
    </div>
  )
}
