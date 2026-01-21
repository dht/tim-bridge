#!/bin/bash
set -e

echo "========== SPI 5-inch ILI9341 + XPT2046 Setup =========="

# -------------------------------------------------
# Enable SPI (always)
# -------------------------------------------------
echo "Enabling SPI..."
sudo raspi-config nonint do_spi 0

# -------------------------------------------------
# DO NOT disable HDMI (fbcp needs it)
# -------------------------------------------------
if grep -q "hdmi_blanking=2" /boot/config.txt; then
  echo "Removing hdmi_blanking=2 (breaks fbcp)..."
  sudo sed -i '/hdmi_blanking=2/d' /boot/config.txt
fi

# -------------------------------------------------
# Dependencies (install only if missing)
# -------------------------------------------------
DEPS=(
  git
  cmake
  build-essential
  libts-bin
  evtest
  libraspberrypi-dev
)

MISSING=()
for pkg in "${DEPS[@]}"; do
  dpkg -s "$pkg" >/dev/null 2>&1 || MISSING+=("$pkg")
done

if [ ${#MISSING[@]} -gt 0 ]; then
  echo "Installing missing dependencies: ${MISSING[*]}"
  sudo apt update
  sudo apt install -y "${MISSING[@]}"
else
  echo "All dependencies already installed, skipping"
fi

# -------------------------------------------------
# Clone fbcp-ili9341 if missing
# -------------------------------------------------
cd ~
if [ ! -d fbcp-ili9341 ]; then
  echo "Cloning fbcp-ili9341..."
  git clone https://github.com/juj/fbcp-ili9341.git
else
  echo "fbcp-ili9341 already present, skipping clone"
fi

# -------------------------------------------------
# Build fbcp-ili9341 if binary missing
# -------------------------------------------------
if [ ! -x /usr/local/bin/fbcp-ili9341 ]; then
  echo "Building fbcp-ili9341..."
  cd ~/fbcp-ili9341
  rm -rf build
  mkdir build && cd build

  cmake .. \
    -DILI9341=ON \
    -DSPI_BUS_CLOCK_DIVISOR=16 \
    -DGPIO_TFT_DATA_CONTROL=25 \
    -DDISPLAY_ROTATE_180_DEGREES=OFF

  make -j$(nproc)
  sudo install fbcp-ili9341 /usr/local/bin/fbcp-ili9341
else
  echo "fbcp-ili9341 already installed, skipping build"
fi

# -------------------------------------------------
# Install / fix systemd service (FORCE root)
# -------------------------------------------------
echo "Installing fbcp-ili9341 systemd service (root)..."

sudo tee /etc/systemd/system/fbcp-ili9341.service > /dev/null <<'EOF'
[Unit]
Description=Framebuffer copy to ILI9341 SPI display
After=multi-user.target

[Service]
Type=simple
ExecStart=/usr/local/bin/fbcp-ili9341
Restart=always
RestartSec=1
User=root

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable fbcp-ili9341
sudo systemctl restart fbcp-ili9341

# -------------------------------------------------
# Enable XPT2046 touch (only once)
# -------------------------------------------------
if ! grep -q "dtoverlay=xpt2046" /boot/config.txt; then
  echo "Enabling XPT2046 touch..."
  sudo tee -a /boot/config.txt > /dev/null <<'EOF'

# ---- XPT2046 touch ----
dtoverlay=xpt2046,cs=1,penirq=17,speed=2000000,swapxy=1
# ----------------------
EOF
else
  echo "XPT2046 already enabled, skipping"
fi

echo "========== Setup complete =========="
echo "Reboot REQUIRED: sudo reboot"
