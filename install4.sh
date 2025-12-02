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

echo "========== Installing Node.js 10 =========="
nvm install 20
nvm use 20
node -v
echo "install bash: Verify it's v16.20.2 above this line"

echo "========== Verifying Node Installation =========="
node -v
npm -v

echo "========== Installing tim-bridge Dependencies =========="
npm install

echo "========== Installing PM2 =========="
npm install -g pm2

echo "========== Installing autojump =========="
sudo apt install autojump
. /usr/share/autojump/autojump.zsh
source ~/.zshrc

# echo "========== Starting PM2 Service =========="
# pm2 start index.js --name tim --watch
# pm2 save

echo "========== Installation Complete =========="
echo ""
echo "⚠️  IMPORTANT MANUAL STEPS:"
echo "1. Visit the env file: https://prompt-haus.web.app/env.md"
echo "2. First time opening Chromium: when asked for keyring password, leave both fields EMPTY."
echo ""
echo "🎉 Setup finished! Logs:"
pm2 logs tim
