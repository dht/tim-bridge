#!/bin/bash

### --- CONFIGURATION --- ###
PI_IP="10.0.0.8"          # Pi's current IP to connect to
PI_USER="admin"            # or 'pi' depending on your Pi
WIFI_NAME="NETGEAR67-5G"   # your Wi-Fi SSID as shown in nmcli
STATIC_IP="10.0.0.51"      # the static IP you want the Pi to have
GATEWAY_IP="10.0.0.1"      # usually your router IP
DNS_IPS="10.0.0.1 8.8.8.8" # router + google dns
#############################

echo "Connecting to Raspberry Pi at $PI_IP ..."
echo "Setting static IP $STATIC_IP for Wi-Fi '$WIFI_NAME' ..."

ssh ${PI_USER}@${PI_IP} "sudo nmcli connection modify \"$WIFI_NAME\" ipv4.addresses ${STATIC_IP}/24"
ssh ${PI_USER}@${PI_IP} "sudo nmcli connection modify \"$WIFI_NAME\" ipv4.gateway ${GATEWAY_IP}"
ssh ${PI_USER}@${PI_IP} "sudo nmcli connection modify \"$WIFI_NAME\" ipv4.dns \"$DNS_IPS\""
ssh ${PI_USER}@${PI_IP} "sudo nmcli connection modify \"$WIFI_NAME\" ipv4.method manual"

echo "Restarting the Wi-Fi connection ..."
ssh ${PI_USER}@${PI_IP} "sudo nmcli connection down \"$WIFI_NAME\""
ssh ${PI_USER}@${PI_IP} "sudo nmcli connection up \"$WIFI_NAME\""

echo "Done!"
echo "Your Pi should now be reachable at: ${STATIC_IP}"
