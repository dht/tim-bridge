# 🧰 Raspberry Pi — Ultra-Concise Setup Guide

**Everything in ONE block**

---

## 1️⃣ Flash the Correct OS (via Raspberry Pi Imager)

- **Raspberry Pi Zero** → _Raspberry Pi OS (Legacy) 32-bit_ (`armhf`)
- **Raspberry Pi 4 / 5** → _Raspberry Pi OS 64-bit_ (`aarch64`)

---

## 2️⃣ Update System

```bash
sudo apt update && sudo apt upgrade -y
```

---

## 3️⃣ Install NVM

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/master/install.sh | bash
source ~/.bashrc
```

---

## 4️⃣ Install Node.js 20

```bash
nvm install 20
nvm use 20
nvm alias default 20
```

### ✅ Verify

```bash
node -v
npm -v
```

---

## 🔐 SSH Setup (Mac → Raspberry Pi)

### A) (Optional) Create SSH Key on Mac

_(Skip if you already have `~/.ssh/id_edpi`)_

```bash
ssh-keygen -t ed25519 -f ~/.ssh/id_edpi
```

Leave passphrase empty if you want passwordless SSH.

---

### B) Copy SSH Key to Raspberry Pi

```bash
ssh-copy-id -i ~/.ssh/id_edpi.pub admin@<PI_IP>
```

Test:

```bash
ssh -i ~/.ssh/id_edpi admin@<PI_IP>
```

✅ You should log in without a password.

---

## 🌐 Permanent IP (NetworkManager / nmcli)

### A) List Available Networks

```bash
nmcli device wifi list
```

✅ Make sure **`NETGEAR67-5G`** exists
✅ Prefer it over 2.4GHz networks

---

### B) Connect (if not already connected)

```bash
sudo nmcli device wifi connect "NETGEAR67-5G"
```

---

### C) Set Static IP (after SSH connection)

```bash
sudo nmcli connection modify "NETGEAR67-5G" ipv4.addresses 10.0.0.51/24
sudo nmcli connection modify "NETGEAR67-5G" ipv4.gateway 10.0.0.1
sudo nmcli connection modify "NETGEAR67-5G" ipv4.dns "10.0.0.1 8.8.8.8"
sudo nmcli connection modify "NETGEAR67-5G" ipv4.method manual
```

Apply:

```bash
sudo nmcli connection down "NETGEAR67-5G"
sudo nmcli connection up "NETGEAR67-5G"
```

✅ SSH will now always work at:

```
ssh admin@10.0.0.51
```

---

## 5️⃣ Install Audio Support (mpg123)

```bash
sudo apt update
sudo apt install -y mpg123
```

---

## 6️⃣ Create Projects Folder

```bash
mkdir -p ~/projects
cd ~/projects
```

---

## 7️⃣ Clone & Install `tim-bridge`

```bash
git clone https://github.com/dht/tim-bridge.git
cd tim-bridge
npm install
```

---

## 8️⃣ Environment Variables

Get `.env` from:
👉 [https://prompt-haus.web.app/env.md](https://prompt-haus.web.app/env.md)

Place it in the `tim-bridge` root folder.

---

## 9️⃣ Chromium (Password-less Keyring)

On first Chromium launch, when prompted for a keyring password:

- **Leave password empty**
- **Leave confirm empty**
- Press **Enter**

✅ Required for headless / installation use.

---

## 🔁 Auto-Start with PM2 (on Boot)

```bash
npm install -g pm2
cd ~/projects/tim-bridge
pm2 start index.js --name tim --watch
pm2 save
```

### Logs

```bash
pm2 logs tim
```

> `--name` can be anything
> `--watch` restarts on file changes

---

## 🧑‍💻 Optional: Install VS Code

```bash
sudo apt install -y code
code ~/projects/tim-bridge
```

---

## 🛠 Tips & Fixes

### Reset Git Repo

```bash
git reset --hard HEAD
```

---

### Node Error: “couldn’t find bcm…”

```bash
which node
sudo /full/path/to/node yourfile.js
```

---

## ▶️ Run Manually

From inside `tim-bridge`:

```bash
node src/index.js
```
