#!/bin/bash
#
# Publish the engine to npm under the name "tetris-toolkit".
#
# Internally the package is named "@tetris/engine" so workspace references
# (the UI's `"@tetris/engine": "workspace:*"` dep) resolve. This script
# temporarily renames it for publishing, then restores it on exit — even
# if the publish step fails.
#
# Usage:
#   pnpm release              # from the monorepo root
#
# Extra flags are forwarded to `pnpm publish`, e.g.:
#   pnpm release -- --tag next
#   pnpm release -- --dry-run
#

set -euo pipefail

PACKAGE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PACKAGE_JSON="$PACKAGE_DIR/package.json"

INTERNAL_NAME="@tetris/engine"
PUBLISH_NAME="tetris-toolkit"

# `sed -i ''` is the macOS/BSD form; `sed -i` without the empty argument
# is GNU's. Detect and branch so the script works on both.
sed_inplace() {
  if sed --version >/dev/null 2>&1; then
    sed -i "$@"
  else
    sed -i '' "$@"
  fi
}

# Escape forward slashes so names like `@tetris/engine` are safe in sed.
escape_name() {
  printf '%s\n' "$1" | sed 's|/|\\/|g'
}

swap_name() {
  local from_escaped to_escaped
  from_escaped="$(escape_name "$1")"
  to_escaped="$(escape_name "$2")"
  sed_inplace "s/\"name\": \"$from_escaped\"/\"name\": \"$to_escaped\"/" "$PACKAGE_JSON"
}

restore_name() {
  swap_name "$PUBLISH_NAME" "$INTERNAL_NAME"
}

# ── Build ──────────────────────────────────────
echo "Building..."
cd "$PACKAGE_DIR"
pnpm build

# ── Publish ────────────────────────────────────
swap_name "$INTERNAL_NAME" "$PUBLISH_NAME"
trap restore_name EXIT

echo "Publishing as $PUBLISH_NAME..."
pnpm publish --access public --no-git-checks "$@"

echo "Done."
