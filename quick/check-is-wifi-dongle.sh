#!/bin/bash

# Get the interface used for the default route
IFACE=$(ip route | awk '/default/ {print $5}' | head -n1)

if [ -z "$IFACE" ]; then
    echo "❌ No active network interface found"
    exit 1
fi

# Get the driver for that interface
DRIVER=$(basename "$(readlink /sys/class/net/$IFACE/device/driver 2>/dev/null)")

echo "Active interface : $IFACE"
echo "Driver           : $DRIVER"

# Decide internal vs dongle
case "$DRIVER" in
    brcmfmac|bcm2835)
        echo "📡 Connection    : INTERNAL Wi-Fi"
        ;;
    rtl*|ath*|mt76*|8812au|8188cu)
        echo "🔌 Connection    : USB Wi-Fi DONGLE"
        ;;
    *)
        echo "❓ Connection    : UNKNOWN (driver not recognized)"
        ;;
esac
