#!/usr/bin/env bash
set -e

REMOTE_USER="admin"

if [ -z "${1:-}" ]; then
  echo "Usage: $0 <ip_last_octet (1-254)>"
  exit 1
fi

LAST_OCTET="$1"

if ! [[ "$LAST_OCTET" =~ ^[0-9]+$ ]] || [ "$LAST_OCTET" -lt 1 ] || [ "$LAST_OCTET" -gt 254 ]; then
  echo "Error: IP last octet must be a number between 1 and 254"
  exit 1
fi

REMOTE_HOST="10.0.0.${LAST_OCTET}"

ssh ${REMOTE_USER}@${REMOTE_HOST} '
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

cd ~/projects/tim-bridge &&
pm2 start npm --name houses -- start
'
