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
REMOTE_DIR="~/projects/tim-bridge"

echo "Syncing .env.pi to ${REMOTE_USER}@${REMOTE_HOST}"

rsync -avz \
  .env.pi \
  ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/.env.pi
