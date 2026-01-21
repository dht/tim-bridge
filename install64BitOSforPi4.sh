#!/bin/bash
set -e
echo "========== Updating System For Raspberry 4 model B =========="

echo "========== Updating System =========="
sudo apt update && sudo apt upgrade -y

echo "========== Installing Dependencies =========="
sudo apt install -y curl git mpg123

echo "========== Installing NVM =========="
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/master/install.sh | bash

# Load NVM into this script session
export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
source "$NVM_DIR/nvm.sh"

echo "========== Installing Node.js =========="
nvm install 20
nvm use 20
node -v

echo "========== Verifying Node Installation =========="
node -v
npm -v

echo "========== Installing tim-bridge Dependencies =========="
npm install

echo "========== Installing PM2 =========="
npm install -g pm2

echo "========== Installing autojump =========="
sudo apt install -y autojump

# Enable autojump for bash
echo "========== Installing autojump =========="
sudo apt install -y autojump

if ! grep -q "autojump.bash" ~/.bashrc; then
  echo "" >> ~/.bashrc
  echo "# autojump" >> ~/.bashrc
  echo ". /usr/share/autojump/autojump.bash" >> ~/.bashrc
fi


echo "========== Installation Complete =========="
echo ""
echo "⚠️  IMPORTANT MANUAL STEPS:"
echo "1. Visit the env file: https://prompt-haus.web.app/env.md"
echo "2. First time opening Chromium: when asked for keyring password, leave both fields EMPTY."
echo ""
echo "🎉 Setup finished! Logs:"
pm2 logs tim
