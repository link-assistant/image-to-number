#!/usr/bin/env sh
#
# image-to-number bootstrap
# -------------------------
# Download image-to-number.mjs straight from GitHub and run it with Node,
# forwarding every argument. This is what lets you run the tool without
# cloning the repo or installing anything:
#
#   curl -fsSL https://raw.githubusercontent.com/link-assistant/image-to-number/main/image-to-number.sh | sh -s -- <image>
#   wget -qO- https://raw.githubusercontent.com/link-assistant/image-to-number/main/image-to-number.sh | sh -s -- <image>
#
# The mjs itself has zero npm dependencies (it loads them at runtime via use-m),
# so a working `node` and `claude` CLI are the only prerequisites.
#
# Override the source with IMAGE_TO_NUMBER_URL or pin a ref with
# IMAGE_TO_NUMBER_REF (defaults to "main").

set -eu

REF="${IMAGE_TO_NUMBER_REF:-main}"
URL="${IMAGE_TO_NUMBER_URL:-https://raw.githubusercontent.com/link-assistant/image-to-number/${REF}/image-to-number.mjs}"

if ! command -v node >/dev/null 2>&1; then
  echo "image-to-number: 'node' (Node.js >= 20) is required but was not found." >&2
  exit 1
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
SCRIPT="$TMP_DIR/image-to-number.mjs"

if command -v curl >/dev/null 2>&1; then
  curl -fsSL "$URL" -o "$SCRIPT"
elif command -v wget >/dev/null 2>&1; then
  wget -qO "$SCRIPT" "$URL"
else
  echo "image-to-number: need either 'curl' or 'wget' to download the script." >&2
  exit 1
fi

exec node "$SCRIPT" "$@"
