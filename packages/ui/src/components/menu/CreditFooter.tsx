/**
 * Author credit shown at the bottom of the main menu. Links to the
 * author's GitHub in a new tab.
 */

const AUTHOR_NAME = 'CONG NGUYEN'
const AUTHOR_URL = 'https://github.com/chicong065'

export function CreditFooter() {
  return (
    <p className="menu-credit">
      MADE BY{' '}
      <a href={AUTHOR_URL} target="_blank" rel="noreferrer">
        {AUTHOR_NAME}
      </a>
    </p>
  )
}
