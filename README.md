# **TIM-BRIDGE Documentation**

## **Overview**

**TIM-BRIDGE** is the software running on the edge devices—specifically various Raspberry Pi models (Zero, 4B, and 5).
The bridge listens for state changes in Firestore and updates hardware components on the Pi accordingly.

A state update such as:

```json
{
  "leftLightOn": true
}
```

will directly trigger the left light to turn on.

### **Core Execution Cycle**

1. **Listen** for Firestore document changes.
2. **On change**, control Raspberry Pi–connected hardware:

   - **Audio**: playback via speakers
   - **BOX components**: lights (Hillel/Shammai), rotors (2084)
   - **PANEL components**: status LED

---

# **Setup Guide**

## 🧰 **Raspberry Pi Setup (Concise Single-Block Guide)**

### **1. Flash the Correct OS (Raspberry Pi Imager)**

| Device          | OS Version                            |
| --------------- | ------------------------------------- |
| **Pi Zero**     | Raspberry Pi OS Legacy 32-bit (armhf) |
| **Pi 4 / Pi 5** | Raspberry Pi OS 64-bit (aarch64)      |

---

### **2. Update the System**

```bash
sudo apt update && sudo apt upgrade -y
```

---

### **3. Install NVM**

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/master/install.sh | bash
source ~/.bashrc
```

---

### **4. Install Node.js 20**

```bash
nvm install 20
nvm use 20
nvm alias default 20
```

---

### **5. (Optional but Useful) Install fzf**

```bash
git clone --depth 1 https://github.com/junegunn/fzf.git ~/.fzf
~/.fzf/install
```

---

### **6. Verify Node Installation**

```bash
node -v
npm -v
```

---

### **7. Create Projects Directory**

```bash
mkdir -p ~/projects
cd ~/projects
```

---

### **8. Clone and Run tim-bridge**

```bash
git clone https://github.com/dht/tim-bridge.git
cd tim-bridge
npm install
node src/index.js    # or: npm run dev
```

---

### ** 9. Give permissions **

```
sudo usermod -aG gpio admin
```

---

### **10. (Optional) Install VS Code**

```bash
sudo apt install code -y
code ~/projects/tim-bridge
```

---

### **Common Tips**

- **Reset repo**

  ```bash
  git reset --hard HEAD
  ```

- **If Node reports “couldn’t find bcm…”**

  ```bash
  which node
  sudo /path/to/node yourfile.js
  ```

- **Run the bridge manually**

  ```bash
  node src/index.js
  ```

- **Install omxplayer (for audio playback)**

  ```bash
  sudo apt install omxplayer
  ```

---

# **Lights Documentation**

## **Status Light (RGB)**

| Mode / State            | Color | Pattern      | Meaning                          |
| ----------------------- | ----- | ------------ | -------------------------------- |
| `idle`                  | Green | Steady       | System ready and idle            |
| `generating`            | Green | Slow blink   | L2 model generation / processing |
| `listening`             | Green | Double blink | Awaiting user input              |
| `speaking` / `playback` | Blue  | Steady       | Speaking / playing audio         |
| `error`                 | Red   | Steady       | General error                    |
| `error-no-internet`     | Red   | Single blink | No network connection            |
| `error-reset-fail`      | Red   | Double blink | Reset command failed             |
| `error-generation-fail` | Red   | Triple blink | TTS / Generation failure         |

---
