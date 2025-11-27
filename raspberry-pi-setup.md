# 🧰 Raspberry Pi — Ultra-Concise Setup Guide (Everything in ONE Block)

# --- Flash Correct OS (via Raspberry Pi Imager) ---

# Pi Zero → Raspberry Pi OS Legacy 32-bit (armhf)

# Pi 4/5 → Raspberry Pi OS 64-bit (aarch64)

# --- Update System ---

sudo apt update && sudo apt upgrade -y

# --- Install NVM ---

curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/master/install.sh | bash
source ~/.bashrc

# --- Install Node.js 20 ---

nvm install 20
nvm use 20
nvm alias default 20

# --- Verify Node ---

node -v
npm -v

# --- Install mpg123 for audio playing ---

sudo apt update
sudo apt install mpg123

# --- Create a Projects Folder ---

mkdir -p ~/projects && cd ~/projects

# --- Clone + Run tim-bridge ---

git clone https://github.com/dht/tim-bridge.git
cd tim-bridge
npm install

# --- Get Env ---

from:
https://prompt-haus.web.app/env.md

# --- Use passwordless chromium ---

when entering chromium at first and it asks for a key enter both password and confirm empty

# --- PM2 to autoload index on boot ---

npm install -g pm2
go to project folder
pm2 start index.js --name tim-bridge


# --- Optional: Install VS Code ---

sudo apt install code -y
code ~/projects/tim-bridge

# --- Tips ---

# Reset git repo:

git reset --hard HEAD

# If running Node gives "couldn't find bcm...":

which node

# then:

sudo /path/to/node yourfile.js

# --- To run the file: ---

node src/index.js from the tim-bridge repo
