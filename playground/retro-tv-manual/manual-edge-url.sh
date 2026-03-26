ssh admin@10.0.0.50 'sudo -u pi bash -lc "
export XDG_RUNTIME_DIR=/run/user/\$(id -u)
export WAYLAND_DISPLAY=wayland-0
export DISPLAY=:0
chromium \
  --ozone-platform=wayland \
  --kiosk \
  --incognito \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --no-first-run \
  https://tim-os.web.app/A-002-dev/edge \
  >/tmp/chromium-kiosk.log 2>&1 &
disown
"'