#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

cd "$ROOT_DIR"

echo "[sync-git] fetch origin nextgen"
git fetch origin nextgen

echo "[sync-git] checkout nextgen (force to remote)"
git checkout -B nextgen origin/nextgen

echo "[sync-git] hard reset to origin/nextgen"
git reset --hard origin/nextgen

echo "[sync-git] clean untracked files"
git clean -fd

git rev-parse HEAD
