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

# **Robotic Arm (A-003) Positions**

JSON poses live in `positions/A-003/` (e.g. `positions/A-003/pos1.json`).

From the repo root:

```bash
npm run arm -- list --machine A-003
npm run arm -- go pos1 --machine A-003
```

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

### ** 9. Give permissions to GPIO**

In case you current user is admin

```
echo $USER
```

Give it permissions:

```
sudo usermod -aG gpio admin
sudo reboot
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

# ## Install SSH Keys

### **Set up secure trust between your Mac and Raspberry Pi (password-free login)**

This guide explains how to securely generate SSH keys on your **Mac**, copy only the **public** key to the **Raspberry Pi**, and enable password-free login.

SSH keys let your Mac prove its identity to your Pi **without sending a password**, which is much safer and faster.

---

# ### 📁 Where SSH keys live on macOS

On your **Mac**, SSH keys are stored inside your home folder:

```
~/.ssh
```

This folder may contain:

- `id_ed25519` → private key (keep secret!)
- `id_ed25519.pub` → public key (safe to share)
- Other keys like `id_rsa`, or custom ones you create

---

# ## 1. Generate an SSH key on the Mac

Run this in Terminal on the **Mac**:

```sh
ssh-keygen -t ed25519 -f ~/.ssh/id_edpi
```

What this does:

- Creates a **private key**: `~/.ssh/id_edpi`
- Creates a **public key**: `~/.ssh/id_edpi.pub`

Press **Enter** for default options unless you want to add a passphrase.

---

# ## 2. Copy the public key to the Raspberry Pi

The public key is what the Pi uses to trust the Mac.

If `ssh-copy-id` works:

```sh
ssh-copy-id -i ~/.ssh/id_edpi.pub admin@10.0.0.7
```

You will need to enter the Pi password **one last time**.

After this, the Pi knows and trusts the Mac’s key.

---

# ## 3. (Recommended) Add SSH config entry on the Mac

Create or edit this file:

```
code ~/.ssh/config
```

Add:

```conf
Host pi-server
    HostName 10.0.0.7
    User admin
    IdentityFile ~/.ssh/id_edpi
    IdentitiesOnly yes
```

This tells SSH to always use your custom key when connecting to the Pi.

Now connect using:

```sh
ssh pi-server
```

You should **not** be asked for a password 🎉

# ## How It Works (Simple Explanation)

- Your **Mac** keeps a **private key** (never share it).
- Your **Pi** stores the **public key** inside `~/.ssh/authorized_keys`.
- When you connect, the Mac proves it has the private key.
- The Pi checks if the matching public key is trusted.
- If yes → login is automatic, no password needed.

This is secure because:

- The private key never leaves your Mac.
- The public key can’t be used to steal access.

Now you can do this:

```
git add . && git commit -am "wip" && git push && ssh pi-server "cd ~/projects/tim-bridge && git pull"
```
