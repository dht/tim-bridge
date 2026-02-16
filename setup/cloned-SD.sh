#!/bin/bash
set -e

# ===== CONFIG =====
NEW_HOSTNAME="SD1IP54"
CONN_NAME="NETGEAR67-5G"
NEW_IP="10.0.0.54/24"
GATEWAY="10.0.0.1"
DNS="10.0.0.1 8.8.8.8"
# ==================

echo "🔧 Setting hostname to $NEW_HOSTNAME"
sudo hostnamectl set-hostname "$NEW_HOSTNAME"
echo "✅ Hostname set to: $(hostname)"

echo "🌐 Checking network connection: $CONN_NAME"
if ! nmcli connection show "$CONN_NAME" >/dev/null 2>&1; then
  echo "❌ NetworkManager connection '$CONN_NAME' not found"
  exit 1
fi
echo "✅ Connection found"

echo "📡 Setting static IP $NEW_IP on $CONN_NAME"
sudo nmcli connection modify "$CONN_NAME" \
  ipv4.method manual \
  ipv4.addresses "$NEW_IP" \
  ipv4.gateway "$GATEWAY" \
  ipv4.dns "$DNS"
echo "✅ Static IP configured"

echo "🆔 Regenerating machine-id"
sudo rm -f /etc/machine-id
sudo systemd-machine-id-setup
echo "✅ New machine-id: $(cat /etc/machine-id)"

echo "🔐 Regenerating SSH host keys"
sudo rm -f /etc/ssh/ssh_host_*
sudo dpkg-reconfigure openssh-server
echo "✅ SSH host keys regenerated"

echo "🔄 Restarting Wi-Fi connection..."
sudo nmcli connection down "$CONN_NAME" || true
sudo nmcli connection up "$CONN_NAME"
echo "✅ Network restarted"

echo "♻️ Rebooting to apply hostname + IP + SSH keys"
sleep 2
sudo reboot
