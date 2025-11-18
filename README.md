# TIM-BRIDGE

is the code that runs on the edge devices: the various raspberry pie (Zero, 4B & 5).
The bridge is designed to be simple. For example a change like:

```json
{
  "leftLightOn": true // was false
}
```

will turn the left light on.

The cycle is:

1. listen to firestore changes
2. when an incoming change is received use the raspberry pi commands to control:
   a. voice via speakers
   b. BOX elements: lights (Hillel/Shammai), rotors (2084)
   c. PANEL elements: status LED

# SET UP GUIDE:
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


## Lights

### Status Light (RGB)

| **Mode / State**        | **Color** | **Pattern**  | **Meaning**                                          |
| ----------------------- | --------- | ------------ | ---------------------------------------------------- |
| `idle`                  | Green     | Steady       | System is ready & idle                               |
| `generating`           | Green     | Slow blink   | Generating (L2 model, response creation, processing) |
| `listening`             | Green     | Double-blink | Listening for a user command / audio input           |
| `speaking` / `playback` | Blue      | Steady       | Speaking / playing audio                             |
| `error`                 | Red       | Steady       | General error state                                  |
| `error-no-internet`     | Red       | Single blink | No network connection                                |
| `error-reset-fail`      | Red       | Double-blink | Reset command failure                                |
| `error-generation-fail` | Red       | Triple-blink | TTS/Generation failure                               |


sudo apt install omxplayer
