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

| **State**                  | **Color**              | **Pattern / Rhythm**            | **Meaning / Behavior**                 |
| -------------------------- | ---------------------- | ------------------------------- | -------------------------------------- |
| **IDLE**                   | Cyan-Green (`#00C8A0`) | Slow breathing (3s fade in/out) | Waiting for interaction / QR scan      |
| **GENERATING**             | Magenta (`#FF00B4`)    | 1s smooth pulse                 | AI creating assets (voice, text, etc.) |
| **LISTENING**              | Sky Blue (`#00B4FF`)   | Single blink every 2s           | Waiting for user input / voice         |
| **SPEAKING / PLAYBACK**    | Amber (`#FFA000`)      | Amplitude-reactive glow         | AI voice or playback active            |
| **RESETTING**              | White → Blue           | Directional fade / sweep        | Saving session, clearing memory        |
| **ERROR: No Internet**     | Red (`#FF2020`)        | Short double-blink, 1s pause    | Connection attempt failed              |
| **ERROR: Reset Fail**      | Red (`#FF2020`)        | Long fade loop (2.8s)           | Could not return to idle               |
| **ERROR: Generation Fail** | Red (`#FF2020`)        | Triple stutter, 2s pause        | Creation interrupted                   |
| **ERROR: Internal Fault**  | Red (`#FF2020`)        | Uneven heartbeat (short-long)   | Agent or system glitch                 |
| **ERROR: Timeout**         | Red (`#FF2020`)        | Slow rise, hold, sudden drop    | Process stalled or unresponsive        |

## installing oxmplayer

sudo apt install omxplayer
