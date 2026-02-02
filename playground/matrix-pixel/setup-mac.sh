#!/usr/bin/env bash
set -euo pipefail

# Ensure we're on macOS
if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This script is for macOS only."
  exit 1
fi

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
cd "$SCRIPT_DIR"

echo "=== matrix-pixel macOS setup ==="

# ---- Python check ----
if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 not found."
  echo "Install it via Homebrew:"
  echo "  brew install python@3.10"
  exit 1
fi

PY_VERSION="$(python3 - <<'EOF'
import sys
print(f"{sys.version_info.major}.{sys.version_info.minor}")
EOF
)"

echo "Using python3 version: $PY_VERSION"

# ---- Homebrew deps ----
if command -v brew >/dev/null 2>&1; then
  echo "Installing system dependencies via Homebrew..."
  brew update

  # Needed for building some Python wheels
  brew install \
    libffi \
    openssl \
    pkg-config

else
  echo "Homebrew not found."
  echo "Install it from https://brew.sh and re-run."
  exit 1
fi

# ---- Virtualenv ----
if [ ! -d ".venv" ]; then
  echo "Creating venv in $SCRIPT_DIR/.venv..."
  python3 -m venv .venv
fi

echo "Activating venv..."
. .venv/bin/activate

echo "Upgrading pip toolchain..."
python -m pip install --upgrade pip setuptools wheel

# ---- Python deps ----
echo "Installing Python deps..."
if [ -d "python3-idotmatrix-library" ] && [ -f "python3-idotmatrix-library/pyproject.toml" -o -f "python3-idotmatrix-library/setup.py" ]; then
  python -m pip install -e ./python3-idotmatrix-library
else
  if [ -d "python3-idotmatrix-library" ]; then
    echo "Note: ./python3-idotmatrix-library exists but is not installable (missing pyproject.toml/setup.py)."
    echo "      Falling back to PyPI package: idotmatrix"
  fi
  python -m pip install idotmatrix
fi

echo ""
echo "Done."
echo ""
echo "Next steps (macOS):"
echo ""
echo "  1) Grant Bluetooth permissions:"
echo "     System Settings → Privacy & Security → Bluetooth"
echo "     Enable for Terminal / iTerm"
echo ""
echo "  2) Discover your display UUID:"
echo "       ./.venv/bin/python discover.py"
echo ""
echo "  3) Copy env template:"
echo "       cp .env.example .env"
echo ""
echo "  4) Set your address (macOS uses UUID):"
echo "       IDOTMATRIX_ADDRESS_DARWIN=<UUID>"
echo ""
echo "  5) Run:"
echo "       ./.venv/bin/python blue.py"
echo ""
echo "If BLE scanning fails:"
echo "  - Toggle Bluetooth OFF/ON"
echo "  - Quit VPNs (they can break CoreBluetooth)"
echo "  - Re-run once after reboot"
