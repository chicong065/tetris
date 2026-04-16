/**
 * Main-screen TETRIS wordmark. The visible word "TETRIS" is rendered
 * with the shared `.screen-title` Bungee 3D treatment; the layout
 * styling (size, vertical rhythm) lives on the local `.menu-title`
 * class. The same wordmark approach is reused on Settings.
 */

export function TetrisTitle() {
  return (
    <h1 className="menu-title screen-title" aria-label="Tetris">
      TETRIS
    </h1>
  )
}
