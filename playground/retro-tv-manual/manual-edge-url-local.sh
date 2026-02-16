ssh admin@10.0.0.53 "bash -lc '
set -e
DISPLAY=:0 XAUTHORITY=$(ps aux | grep '[X]org' | sed -n 's/.*-auth \([^ ]*\).*/\1/p') \
chromium \
  --kiosk \
  --incognito \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  http://localhost:3000
'"