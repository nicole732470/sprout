#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_NAME="Super Mario.app"
ARCH="$(uname -m)"
DIST_DIR="$ROOT/dist/mac-${ARCH}"
SRC_APP="$DIST_DIR/$APP_NAME"
DEST_APP="/Applications/$APP_NAME"

cd "$ROOT"
npm run build:mac

if [[ ! -d "$SRC_APP" ]]; then
  echo "Build failed: $SRC_APP not found" >&2
  exit 1
fi

if [[ -d "$DEST_APP" ]]; then
  rm -rf "$DEST_APP"
fi

cp -R "$SRC_APP" "$DEST_APP"
echo "Installed $DEST_APP"
echo "Open from Launchpad, Spotlight, or Applications folder."
