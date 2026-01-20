#!/bin/bash
#
# ⚠️ IMPORTANT:
# This script MUST be run from inside the already-cloned repository:
#
# git clone https://github.com/dht/tim-bridge.git
# Do NOT git clone inside this script.
# Clone the repo manually beforehand, then run:
#
#   cd tim-bridge
#   ./install0.sh
#
# -------------------------------------------------

set -e

echo "========== Raspberry Pi Zero 2 W Setup =========="

# -------------------------------------------------
# System update
# -------------------------------------------------
echo "========== Updating system =========="
sudo apt update
sudo apt upgrade -y

# -------------------------------------------------
# Base dependencies
# -------------------------------------------------
echo "========== Installing base dependencies =========="
sudo apt install -y \
  curl \
  git \
  mpg123 \
  ca-certificates \
  build-essential \
  autojump

# Enable autojump (bash)
if ! grep -q autojump ~/.bashrc; then
  echo '. /usr/share/autojump/autojump.bash' >> ~/.bashrc
fi

# -------------------------------------------------
# Static IP configuration (wlan0)
# -------------------------------------------------
echo "========== Configuring static IP (10.0.0.54) =========="

if ! grep -q "10.0.0.54" /etc/dhcpcd.conf; then
  sudo tee -a /etc/dhcpcd.conf > /dev/null <<'EOF'

# ---- tim-bridge static IP ----
interface wlan0
static ip_address=10.0.0.54/24
static routers=10.0.0.1
static domain_name_servers=10.0.0.1 8.8.8.8
# ------------------------------
EOF
fi

# -------------------------------------------------
# Install NVM
# -------------------------------------------------
echo "========== Installing NVM =========="

if [ ! -d "$HOME/.nvm" ]; then
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
fi

export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
source "$NVM_DIR/nvm.sh"

# -------------------------------------------------
# Install Node.js 16
# -------------------------------------------------
echo "========== Installing Node.js 16 =========="
nvm install 16.20.2
nvm alias default 16.20.2
nvm use default

echo "Node:"
node -v
npm -v

# -------------------------------------------------
# Install project dependencies
# -------------------------------------------------
echo "========== Ins
