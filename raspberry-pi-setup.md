# 🧰 Raspberry Pi — Ultra-Concise Setup Guide (Everything in ONE Block)

# --- Flash Correct OS (via Raspberry Pi Imager) ---
# Pi Zero → Raspberry Pi OS Legacy 32-bit (armhf)
# Pi 4/5  → Raspberry Pi OS 64-bit (aarch64)

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

# --- Create a Projects Folder ---
mkdir -p ~/projects && cd ~/projects

# --- Clone + Run tim-bridge ---
git clone https://github.com/dht/tim-bridge.git
cd tim-bridge
npm install
node src/index.js   # or: npm run dev

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
