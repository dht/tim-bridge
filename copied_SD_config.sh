#!/bin/bash
set -e

# ===== CONFIG =====
NEW_HOSTNAME="SD2Claygon"
CONN_NAME="NETGEAR67"
NEW_IP="10.0.0.50/24"
GATEWAY="10.0.0.1"
DNS="10.0.0.1 8.8.8.8"
# ==================

echo "🔧 Setting hostname to $NEW_HOSTNAME"
sudo hostnamectl set-hostname "$NEW_HOSTNAME"

echo "🌐 Forcing network connection: $CONN_NAME"

# Ensure connection exists
if ! nmcli connection show "$CONN_NAME" >/dev/null 2>&1; then
  echo "❌ NetworkManager connection '$CONN_NAME' not found"
  exit 1
fi

echo "📡 Setting static IP $NEW_IP on $CONN_NAME"
sudo nmcli connection modify "$CONN_NAME" \
  ipv4.method manual \
  ipv4.addresses "$NEW_IP" \
  ipv4.gateway "$GATEWAY" \
  ipv4.dns "$DNS"

echo "🔐 Regenerating SSH host keys"
sudo rm -f /etc/ssh/ssh_host_*
sudo dpkg-reconfigure openssh-server

echo "🔄 Restarting Wi-Fi connection..."
sudo nmcli connection down "$CONN_NAME" || true
sudo nmcli connection up "$CONN_NAME"

echo "♻️ Rebooting to apply hostname + IP + SSH keys"
sudo reboot
