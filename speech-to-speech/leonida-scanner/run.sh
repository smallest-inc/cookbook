#!/usr/bin/env bash
# Leonida Scanner. One command: ./run.sh  then open http://127.0.0.1:8787 in Chrome.
# Needs SMALLEST_API_KEY exported in this terminal (never on screen). No Node needed: the UI is pre-built in static/.
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v python3 >/dev/null; then
  echo "python3 is required."
  exit 1
fi

if [[ -z "${SMALLEST_API_KEY:-}" ]]; then
  echo "Set SMALLEST_API_KEY in this terminal first."
  echo "Do not paste the key into the browser, a post, or a screen recording."
  exit 1
fi

if [[ ! -f static/index.html ]]; then
  echo "The UI is not built. Run: (cd web && npm ci && npm run build)"
  exit 1
fi

exec python3 server.py
