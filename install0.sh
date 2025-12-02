#!/bin/bash
set -e
echo "========== Updating System For Raspberry ZERO =========="

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
nvm install 16.20.2
nvm use 16.20.2
node -v
echo "install bash: Verify it's v16.20.2 above this line"

echo "========== Verifying Node Installation =========="
node -v
npm -v

echo "========== Installing tim-bridge Dependencies =========="
npm install


echo "========== Installing autojump =========="
sudo apt install autojump
echo '. /usr/share/autojump/autojump.bash' >> ~/.bashrc
source ~/.bashrc

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

# echo "========== Starting PM2 Service =========="
# pm2 start src/index.js --name houses --watch
# echo "Add PM2 to system startup"
# pm2 startup systemd -u $USER --hp $HOME
# echo "and print their comnmand, probably:"
# echo "sudo env PATH=$PATH:/usr/local/node16/bin pm2 startup systemd -u admin --hp /home/admin"

echo "========== Installation Complete =========="
echo ""
echo "⚠️  IMPORTANT MANUAL STEPS:"
echo "1. Visit the env file: https://prompt-haus.web.app/env.md"
echo "2. First time opening Chromium: when asked for keyring password, leave both fields EMPTY."
echo ""
echo "🎉 Setup finished! Logs:"
pm2 logs tim
