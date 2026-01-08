#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)

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

run_cmd() {
  local cmd="$1"
  log "Running: $cmd"
  bash -c "$cmd"
}

run_optional() {
  local cmd="$1"
  log "Running (optional): $cmd"
  if ! bash -c "$cmd"; then
    log "Optional install failed: $cmd"
  fi
}

get_python_minor() {
  python3 - <<'PY'
import sys
print(f"{sys.version_info[0]}.{sys.version_info[1]}")
PY
}

python_version_ok() {
  local version
  version=$(get_python_minor)
  local major=${version%%.*}
  local minor=${version##*.}
  if (( major > 3 )); then
    return 0
  fi
  if (( major == 3 && minor >= 10 )); then
    return 0
  fi
  return 1
}

get_node_major() {
  node -v | sed 's/^v//' | cut -d. -f1
}

node_version_ok() {
  local major
  major=$(get_node_major)
  if (( major >= 18 )); then
    return 0
  fi
  return 1
}

venv_ok() {
  [[ -x "$ROOT_DIR/.venv/bin/python" ]]
}

node_modules_ok() {
  [[ -d "$ROOT_DIR/web-app/node_modules" ]] \
    && [[ -d "$ROOT_DIR/web-app/server/node_modules" ]] \
    && [[ -d "$ROOT_DIR/web-app/client/node_modules" ]]
}

env_ok() {
  [[ -f "$ROOT_DIR/web-app/server/.env" ]]
}

preflight_ok() {
  local python_ok=false
  local node_ok=false

  if command_exists python3; then
    if python_version_ok; then
      python_ok=true
    fi
  fi

  if command_exists node; then
    if node_version_ok; then
      node_ok=true
    fi
  fi

  $python_ok && $node_ok && command_exists npm && venv_ok && node_modules_ok && env_ok
}

ensure_python() {
  if command_exists python3; then
    if python_version_ok; then
      log "Python found: $(python3 --version)"
      return 0
    fi
    log "Python 3.10+ required, found: $(python3 --version)"
  else
    log "Python 3 not found."
  fi

  case "$(uname -s)" in
    Darwin)
      if command_exists brew; then
        if prompt_yes_no "Install Python via Homebrew?"; then
          run_cmd "brew install python"
        fi
      else
        log "Homebrew not found. Install it from https://brew.sh/"
      fi
      ;;
    Linux)
      if command_exists apt-get; then
        if prompt_yes_no "Install Python via apt-get (requires sudo)?"; then
          run_cmd "sudo apt-get update"
          run_cmd "sudo apt-get install -y python3 python3-venv python3-pip"
        fi
      else
        log "apt-get not found. Install Python 3.10+ manually."
      fi
      ;;
    *)
      log "Unsupported OS. Please install Python 3.10+ manually."
      ;;
  esac

  if ! command_exists python3; then
    log "Python 3.10+ is required. Install it and re-run this script."
    exit 1
  fi
  if ! python_version_ok; then
    log "Python 3.10+ is required. Upgrade Python and re-run."
    exit 1
  fi
}

ensure_node() {
  if command_exists node; then
    if node_version_ok; then
      log "Node found: $(node -v)"
      return 0
    fi
    log "Node 18+ required, found: $(node -v)"
  else
    log "Node not found."
  fi

  case "$(uname -s)" in
    Darwin)
      if command_exists brew; then
        if prompt_yes_no "Install Node.js via Homebrew?"; then
          run_cmd "brew install node"
        fi
      else
        log "Homebrew not found. Install it from https://brew.sh/"
      fi
      ;;
    Linux)
      if command_exists apt-get; then
        if prompt_yes_no "Install Node.js via apt-get (requires sudo)?"; then
          run_cmd "sudo apt-get update"
          run_cmd "sudo apt-get install -y nodejs npm"
        fi
      else
        log "apt-get not found. Install Node.js 18+ manually."
      fi
      ;;
    *)
      log "Unsupported OS. Please install Node.js 18+ manually."
      ;;
  esac

  if ! command_exists node; then
    log "Node.js 18+ is required. Install it and re-run this script."
    exit 1
  fi
  if ! node_version_ok; then
    log "Node.js 18+ is required. Upgrade Node.js and re-run."
    exit 1
  fi
  if ! command_exists npm; then
    log "npm not found. Please install npm and re-run."
    exit 1
  fi
}

ensure_optional_deps() {
  local missing=()
  command_exists soffice || missing+=("libreoffice")
  command_exists pdftoppm || missing+=("poppler")

  if (( ${#missing[@]} == 0 )); then
    log "Optional screenshot dependencies are installed."
    return 0
  fi

  log "Optional screenshot dependencies missing: ${missing[*]}"

  case "$(uname -s)" in
    Darwin)
      if command_exists brew; then
        if prompt_yes_no "Install LibreOffice + Poppler via Homebrew?"; then
          run_optional "brew install --cask libreoffice"
          run_optional "brew install poppler"
        fi
      else
        log "Homebrew not found. Install LibreOffice and Poppler manually."
      fi
      ;;
    Linux)
      if command_exists apt-get; then
        if prompt_yes_no "Install LibreOffice + Poppler via apt-get (requires sudo)?"; then
          run_optional "sudo apt-get update"
          run_optional "sudo apt-get install -y libreoffice poppler-utils"
        fi
      else
        log "apt-get not found. Install LibreOffice and Poppler manually."
      fi
      ;;
    *)
      log "Unsupported OS. Install LibreOffice and Poppler manually if needed."
      ;;
  esac
}

install_python_deps() {
  local venv_dir="$ROOT_DIR/.venv"
  if [[ -d "$venv_dir" ]]; then
    log "Using existing virtual environment: $venv_dir"
  else
    log "Creating virtual environment: $venv_dir"
    python3 -m venv "$venv_dir"
  fi

  local venv_python="$venv_dir/bin/python"
  "$venv_python" -m pip install --upgrade pip
  "$venv_python" -m pip install -r "$ROOT_DIR/requirements.txt"
}

install_node_deps() {
  log "Installing web app dependencies..."
  (cd "$ROOT_DIR/web-app" && npm install)
  (cd "$ROOT_DIR/web-app/server" && npm install)
  (cd "$ROOT_DIR/web-app/client" && npm install)
}

ensure_env_file() {
  local env_file="$ROOT_DIR/web-app/server/.env"
  local env_example="$ROOT_DIR/web-app/server/.env.example"

  if [[ -f "$env_file" ]]; then
    log "Found existing .env at web-app/server/.env"
    return 0
  fi

  if [[ -f "$env_example" ]]; then
    cp "$env_example" "$env_file"
    log "Created web-app/server/.env from .env.example"
  else
    log "No .env example found. Create web-app/server/.env manually if needed."
  fi
}

log "PPT to Learning setup"
log "Root: $ROOT_DIR"

optional_checked=false
if preflight_ok; then
  log "Everything you need is already installed."
  ensure_optional_deps
  optional_checked=true
  if ! prompt_yes_no "Reinstall/update dependencies anyway?"; then
    log "Setup complete."
    log "Next: npm run dev"
    log "Backend: http://localhost:3001 | Frontend: http://localhost:5173"
    log "Add GEMINI_API_KEY in web-app/server/.env or in the app Settings modal."
    exit 0
  fi
fi

ensure_python
ensure_node
if [[ "$optional_checked" != "true" ]]; then
  ensure_optional_deps
fi
install_python_deps
install_node_deps
ensure_env_file

log "Setup complete."
log "Next: ./run.sh (or npm run dev)"
log "Backend: http://localhost:3001 | Frontend: http://localhost:5173"
log "Add GEMINI_API_KEY in web-app/server/.env or in the app Settings modal."
