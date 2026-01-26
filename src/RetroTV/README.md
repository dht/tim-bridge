# RetroTV (Raspberry Pi Chromium photo viewer)

This folder contains a tiny helper to open **Chromium** on Raspberry Pi OS 64-bit (Pi 5 / Bookworm) in kiosk mode, showing a photo from a URL.

## Usage

From the repo root:

```bash
# Open a photo URL full-screen (centered, scaled)
node src/RetroTV/cli.js open --photo "https://example.com/photo.jpg"

# Or open any URL (page/image/video/etc.)
node src/RetroTV/cli.js open --url "https://example.com"

# Close Chromium (pkill -f chromium)
node src/RetroTV/cli.js close
```

## Options

```bash
# Fit can be: contain | cover
node src/RetroTV/cli.js open --photo "https://example.com/photo.jpg" --fit cover

# Set background color (CSS color)
node src/RetroTV/cli.js open --photo "https://example.com/photo.jpg" --background "#000"

# Print the command without running it
node src/RetroTV/cli.js open --photo "https://example.com/photo.jpg" --dry-run
```

## Notes for Raspberry Pi

- This runs a GUI browser; it expects an X/Wayland session. If you start it over SSH, ensure `DISPLAY` is set (the code defaults to `:0` on Linux).
- If your Chromium binary name differs, set `RETROTV_BROWSER_BIN`:

```bash
RETROTV_BROWSER_BIN=chromium-browser node src/RetroTV/cli.js open --photo "https://example.com/photo.jpg"
```

