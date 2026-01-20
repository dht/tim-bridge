#!/bin/bash
set -e

echo "========== Switching FROM SPI Touchscreen TO HDMI =========="

# -------------------------------------------------
# Stop & disable fbcp (SPI framebuffer copy)
# -------------------------------------------------
echo "Disabling fbcp-ili9341 service..."

if systemctl is-enabled fbcp-ili9341 >/dev/null 2>&1; then
  sudo systemctl stop fbcp-ili9341
  sudo systemctl disable fbcp-ili9341
fi

# -------------------------------------------------
# Remove fbcp binary (optional but clean)
# -------------------------------------------------
if [ -f /usr/local/bin/fbcp-ili9341 ]; then
  sudo rm -f /usr/local/bin/fbcp-ili9341
fi

# -------------------------------------------------
# Clean systemd service file
# ---------------------
