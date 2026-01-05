#!/bin/bash
set -e

echo "========== Updating System For Raspberry Pi Zero 2 W =========="

echo "========== Updating System =========="
sudo apt update && sudo apt upgrade -y

echo "========== Installing Dependencies =========="
sudo apt install -y curl git mpg123 build-essential

echo "========== Installing NVM =========="
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Load NVM into this script session
export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

echo "========== Installing Node.js 20 (LTS) =========="
nvm install 20
nvm alias default 20
nvm use 20

echo "========== Verifying Node Installation =========="
node -v
npm -v
echo "✔ Node should be v20.x above this line"

echo "========== Installing tim-bridge Dependencies =========="
npm install

echo "========== Installing autojump =========="
sudo apt install -y autojump
if ! grep -q autojump ~/.bashrc; then
  echo '. /usr/share/autojump/autojump.bash' >> ~/.bashrc
fi

echo "========== Installing fzf =========="
sudo apt install -y fzf

# Add fzf keybindings + completion for bash (only if not already added)
if [ -f /usr/share/doc/fzf/examples/key-bindings.bash ]; then
  if ! grep -q 'fzf key-bindings' ~/.bashrc; then
    echo '# fzf key-bindings' >> ~/.bashrc
    echo "source /usr/share/doc/fzf/examples/key-bindings.bash" >> ~/.bashrc
  fi
fi

if [ -f /usr/share/doc/fzf/examples/completion.bash ]; then
  if ! grep -q 'fzf completion' ~/.bashrc; then
    echo '# fzf completion' >> ~/.bashrc
    echo "source /usr/share/doc/fzf/examples/completion.bash" >> ~/.bashrc
  fi
fi

source ~/.bashrc

echo "========== Installing PM2 =========="
npm install -g pm2

# Optional: ensure PM2 uses Node 20
pm2 update

echo "========== Installation Complete =========="
echo ""
echo "⚠️  IMPORTANT MANUAL STEPS:"
echo "1. Visit the env file: https://prompt-haus.web.app/env.md"
echo "2. First time opening Chromium: when asked for keyring password, leave both fields EMPTY."
echo ""
echo "🎉 Setup finished!"
