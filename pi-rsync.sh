#!/usr/bin/env bash
set -e

REMOTE_USER="admin"
REMOTE_HOST="10.0.0.51"
REMOTE_DIR="~/projects/tim-bridge"

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
