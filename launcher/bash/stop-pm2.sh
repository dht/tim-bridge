#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${1:-houses}"

pm2 stop "$APP_NAME" || true
