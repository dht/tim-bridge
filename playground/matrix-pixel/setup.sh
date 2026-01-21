#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
cd "$SCRIPT_DIR"

echo "=== matrix-pixel Raspberry Pi setup ==="

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 not found. Install it first (Raspberry Pi OS: sudo apt install -y python3)."
  exit 1
fi

if command -v apt >/dev/null 2>&1; then
  echo "Installing system packages (BLE + Python build deps)..."
  sudo apt update
  sudo apt install -y \
    python3-venv \
    python3-pip \
    python3-dev \
    bluetooth \
    bluez \
    bluez-tools \
    libffi-dev \
    libssl-dev \
    pkg-config

  if command -v systemctl >/dev/null 2>&1; then
    sudo systemctl enable --now bluetooth || true
  fi

  if getent group bluetooth >/dev/null 2>&1; then
    sudo usermod -aG bluetooth "$USER" || true
  fi
else
  echo "apt not found; skipping system package install."
fi

if [ ! -d ".venv" ]; then
  echo "Creating venv in $SCRIPT_DIR/.venv..."
  python3 -m venv .venv
fi

echo "Installing Python deps..."
. .venv/bin/activate
python -m pip install --upgrade pip setuptools wheel

if [ -d "python3-idotmatrix-library" ]; then
  python -m pip install -e ./python3-idotmatrix-library
else
  python -m pip install idotmatrix
fi

echo ""
echo "Done."
echo ""
echo "Next:"
echo "  1) Find your display address: ./.venv/bin/python discover.py"
echo "  2) Run blue: IDOTMATRIX_ADDRESS=\"AA:BB:CC:DD:EE:FF\" ./.venv/bin/python blue.py"
echo ""
echo "If BLE scanning fails, reboot and/or try running with sudo once:"
echo "  sudo IDOTMATRIX_ADDRESS=\"AA:BB:CC:DD:EE:FF\" ./.venv/bin/python blue.py"
