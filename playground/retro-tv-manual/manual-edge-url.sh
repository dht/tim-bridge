ssh admin@10.0.0.53
DISPLAY=:0 XAUTHORITY=$(ps aux | grep '[X]org' | sed -n 's/.*-auth \([^ ]*\).*/\1/p') \
chromium \
  --kiosk \
  --incognito \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  https://tim-os.web.app/A-002-dev/edge
