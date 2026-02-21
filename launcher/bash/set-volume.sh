#!/usr/bin/env bash
set -euo pipefail

VOLUME="${1:-}"

if [[ ! "$VOLUME" =~ ^[0-9]+$ ]]; then
  echo "set-volume.sh: expected numeric volume 0-100" >&2
  exit 1
fi

if [ "$VOLUME" -lt 0 ] || [ "$VOLUME" -gt 100 ]; then
  echo "set-volume.sh: volume out of range: $VOLUME" >&2
  exit 1
fi

if command -v amixer >/dev/null 2>&1; then
  amixer -q sset Master "${VOLUME}%"
  echo "Volume set via amixer to ${VOLUME}%"
  exit 0
fi

if command -v pactl >/dev/null 2>&1; then
  pactl set-sink-volume @DEFAULT_SINK@ "${VOLUME}%"
  echo "Volume set via pactl to ${VOLUME}%"
  exit 0
fi

echo "set-volume.sh: no supported volume command (amixer/pactl)" >&2
exit 1
