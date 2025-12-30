#!/usr/bin/env bash
set -euo pipefail

echo "=== Raspberry Pi full setup starting ==="

# -------------------------------
# SYSTEM UPDATE
# -------------------------------
sudo apt update
sudo apt upgrade -y


# -------------------------------
# INSTALL NVM (if missing)
# -------------------------------
if [ ! -d "$HOME/.nvm" ]; then
  echo "Installing NVM..."
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/master/install.sh | bash
fi

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"


# -------------------------------
# INSTALL NODE 20
# -------------------------------
if ! node -v 2>/dev/null | grep -q "v20"; then
  nvm install 20
fi

nvm use 20
nvm alias default 20
node -v
npm -v


# -------------------------------
# WIFI CONNECT
# -------------------------------
if ! nmcli -t -f NAME connection show | grep -q "^NETGEAR67-5G$"; then
  echo "Connecting to NETGEAR67-5G..."
  sudo nmcli device wifi connect "NETGEAR67-5G"
fi


# -------------------------------
# STATIC IP CONFIG
# -------------------------------
# echo "Configuring static IP..."
# sudo nmcli connection modify "NETGEAR67-5G" ipv4.addresses 10.0.0.51/24
# sudo nmcli connection modify "NETGEAR67-5G" ipv4.gateway 10.0.0.1
# sudo nmcli connection modify "NETGEAR67-5G" ipv4.dns "10.0.0.1 8.8.8.8"
# sudo nmcli connection modify "NETGEAR67-5G" ipv4.method manual
# sudo nmcli connection down "NETGEAR67-5G" || true
# sudo nmcli connection up "NETGEAR67-5G"


# -------------------------------
# AUDIO
# -------------------------------
sudo apt install -y mpg123


# -------------------------------
# PROJECTS DIR
# -------------------------------
mkdir -p "$HOME/projects"
cd "$HOME/projects"


# -------------------------------
# CLONE OR UPDATE tim-bridge
# -------------------------------
if [ ! -d "tim-bridge" ]; then
  git clone https://github.com/dht/tim-bridge.git
fi

cd tim-bridge
npm install


# -------------------------------
# PM2
# -------------------------------
if ! command -v pm2 >/dev/null; then
  npm install -g pm2
fi

pm2 start index.js --name tim --watch || pm2 restart tim
pm2 save


# -------------------------------
# PERMISSIONS
# -------------------------------
sudo usermod -aG i2c "$USER"
sudo usermod -aG gpio "$USER"


echo "=== Setup complete ==="
echo "Reboot recommended."
