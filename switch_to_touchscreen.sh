#!/bin/bash
set -e

echo "========== SPI 5-inch ILI9341 + XPT2046 Setup =========="

# -------------------------------------------------
# Enable SPI
# -------------------------------------------------
echo "Enabling SPI..."
sudo raspi-config nonint do_spi 0

# -------------------------------------------------
# Disable HDMI (optional, recommended)
# -------------------------------------------------
if ! grep -q "hdmi_blanking=2" /boot/config.txt; then
  echo "hdmi_blanking=2" | sudo tee -a /boot/config.txt
fi

# -------------------------------------------------
# Install dependencies
# -------------------------------------------------
echo "Installing dependencies..."
sudo apt update
sudo apt install -y \
  git \
  cmake \
  build-essential \
  libts-bin \
  evtest

# -------------------------------------------------
# Clone fbcp-ili9341
# -------------------------------------------------
cd ~
if [ ! -d fbcp-ili9341 ]; then
  git clone https://github.com/juj/fbcp-ili9341.git
fi

# -------------------------------------------------
# Build fbcp-ili9341
# -------------------------------------------------
cd fbcp-ili9341
mkdir -p build
cd build

cmake .. \
  -DILI9341=ON \
  -DSPI_BUS_CLOCK_DIVISOR=6 \
  -DGPIO_TFT_CS=8 \
  -DGPIO_TFT_DC=25 \
  -DGPIO_TFT_RST=24 \
  -DDISPLAY_ROTATE_180_DEGREES=OFF

make -j$(nproc)

sudo install fbcp-ili9341 /usr/local/bin/fbcp-ili9341

# -------------------------------------------------
# Install fbcp service
# -------------------------------------------------
sudo tee /etc/systemd/system/fbcp-ili9341.service > /dev/null <<'EOF'
[Unit]
Description=Framebuffer copy to ILI9341 SPI display
After=multi-user.target

[Service]
ExecStart=/usr/local/bin/fbcp-ili9341
Restart=always
RestartSec=1

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reexec
sudo systemctl enable fbcp-ili9341

# -------------------------------------------------
# Enable XPT2046 touch
# -------------------------------------------------
if ! grep -q "dtoverlay=xpt2046" /boot/config.txt; then
  sudo tee -a /boot/config.txt > /dev/null <<'EOF'

# ---- XPT2046 touch ----
dtoverlay=xpt2046,cs=1,penirq=17,speed=2000000,swapxy=1
# ----------------------
EOF
fi

echo "========== Setup complete =========="
echo "Reboot REQUIRED: sudo reboot"
