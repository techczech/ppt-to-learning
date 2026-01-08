#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

log() {
  printf '%s\n' "$*"
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

prompt_yes_no() {
  local prompt="$1"
  local reply
  read -r -p "${prompt} [y/N] " reply
  case "${reply:-}" in
    [Yy]|[Yy][Ee][Ss]) return 0 ;;
    *) return 1 ;;
  esac
}

need_setup=false

if ! command_exists node || ! command_exists npm; then
  need_setup=true
fi

if [[ ! -x "$ROOT_DIR/.venv/bin/python" ]]; then
  need_setup=true
fi

if [[ ! -d "$ROOT_DIR/web-app/node_modules" ]] \
  || [[ ! -d "$ROOT_DIR/web-app/server/node_modules" ]] \
  || [[ ! -d "$ROOT_DIR/web-app/client/node_modules" ]]; then
  need_setup=true
fi

if [[ ! -f "$ROOT_DIR/web-app/server/.env" ]]; then
  need_setup=true
fi

if [[ "$need_setup" == "true" ]]; then
  log "Setup not complete."
  if prompt_yes_no "Run ./setup.sh now?"; then
    "$ROOT_DIR/setup.sh"
  else
    log "Run ./setup.sh first, then re-run ./run.sh."
    exit 1
  fi
fi

log "Starting servers..."
cd "$ROOT_DIR"

npm run dev
