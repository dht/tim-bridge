#!/usr/bin/env bash
set -euo pipefail

INPUT_FILE="./bk.org.mp3"
OUTPUT_FILE="./bk.out.mp3"

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg is required but not installed." >&2
  exit 1
fi

if [[ ! -f "${INPUT_FILE}" ]]; then
  echo "Input file not found: ${INPUT_FILE}" >&2
  exit 1
fi

# Envelope:
# - 0s..1s: 100% volume
# - 1s..2s: fade down to 20%
# - 2s..10s: hold at 20%
# - 10s..11s: fade back to 100%
# - 11s..39s: 100% volume
# - 39s..42s: fade out to silence
ffmpeg -y -i "${INPUT_FILE}" \
  -t 42 \
  -af "volume='
        if(lt(t,1), 1,
        if(lt(t,2), 1 - 0.5*(t-1),
        if(lt(t,10), 0.5,
        if(lt(t,11), 0.5 + 0.5*(t-10),
                   1))))
      ':eval=frame,afade=t=out:st=37:d=5" \
  -c:a libmp3lame -q:a 2 "${OUTPUT_FILE}"



echo "Created ${OUTPUT_FILE}"
