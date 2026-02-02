#!/usr/bin/env bash
set -e

REMOTE_USER="admin"

# Default last octet = 51 if not provided
LAST_OCTET="${1:-51}"

# Basic validation: must be a number between 1–254
if ! [[ "$LAST_OCTET" =~ ^[0-9]+$ ]] || [ "$LAST_OCTET" -lt 1 ] || [ "$LAST_OCTET" -gt 254 ]; then
  echo "Error: IP last octet must be a number between 1 and 254"
  exit 1
fi

REMOTE_HOST="10.0.0.${LAST_OCTET}"
REMOTE_DIR="~/projects/tim-bridge"

echo "Deploying to ${REMOTE_USER}@${REMOTE_HOST}"

# Rsync src directory (mirror)
rsync -avz --delete \
  --exclude node_modules \
  --exclude .env \
  src/ \
  ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/src/

# Copy .env.pi to remote .env
rsync -avz \
  .env.pi \
  ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/.env
