import argparse
import asyncio
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Optional


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Play mp3 files locally, and optionally flash an iDotMatrix pixel board over Bluetooth."
    )
    parser.add_argument(
        "files",
        nargs="*",
        help="Audio files to play. If omitted, plays all *.mp3 next to this script (sorted).",
    )
    parser.add_argument(
        "--ble",
        action="store_true",
        help="Also flash the pixel board over Bluetooth at the start of each track.",
    )
    parser.add_argument(
        "--address",
        default=os.environ.get("IDOTMATRIX_ADDRESS"),
        help="BLE address/UUID of the device (or set IDOTMATRIX_ADDRESS).",
    )
    parser.add_argument(
        "--times",
        type=int,
        default=1,
        help="How many flashes to perform.",
    )
    parser.add_argument("--on-ms", type=int, default=90, help="Flash on duration (ms).")
    parser.add_argument("--off-ms", type=int, default=90, help="Flash off duration (ms).")
    parser.add_argument(
        "--color",
        default="255,255,255",
        help="Flash color as r,g,b (default: 255,255,255).",
    )
    parser.add_argument(
        "--background",
        default="0,0,0",
        help="Background color between flashes as r,g,b (default: 0,0,0).",
    )
    return parser.parse_args()


def _parse_rgb(value: str) -> tuple[int, int, int]:
    parts = [p.strip() for p in value.split(",")]
    if len(parts) != 3:
        raise ValueError("Expected r,g,b")
    r, g, b = (int(parts[0]), int(parts[1]), int(parts[2]))
    for c in (r, g, b):
        if c < 0 or c > 255:
            raise ValueError("RGB values must be 0..255")
    return r, g, b


def _player_command(audio_path: str) -> Optional[list[str]]:
    if sys.platform == "darwin" and shutil.which("afplay"):
        return ["afplay", audio_path]

    candidates: list[tuple[str, list[str]]] = [
        ("ffplay", ["ffplay", "-nodisp", "-autoexit", "-loglevel", "quiet", audio_path]),
        ("mpv", ["mpv", "--no-terminal", "--really-quiet", audio_path]),
        ("mpg123", ["mpg123", "-q", audio_path]),
        ("play", ["play", "-q", audio_path]),
        ("cvlc", ["cvlc", "--play-and-exit", "--quiet", audio_path]),
        ("vlc", ["vlc", "--play-and-exit", "--quiet", audio_path]),
    ]
    for exe, cmd in candidates:
        if shutil.which(exe):
            return cmd
    return None


async def _connect(conn, address: Optional[str]) -> None:
    if address:
        await conn.connectByAddress(address)
    else:
        await conn.connectBySearch()


async def main_async() -> int:
    args = _parse_args()

    script_dir = Path(__file__).resolve().parent
    if args.files:
        audio_files = [Path(p).expanduser() for p in args.files]
    else:
        audio_files = sorted(script_dir.glob("*.mp3"), key=lambda p: p.name.lower())

    if audio_files:
        for audio_file in audio_files:
            if not audio_file.is_file():
                print(f"Audio file not found: {audio_file}", file=sys.stderr)
                return 2
    elif not args.ble:
        print("No audio files specified and no *.mp3 found next to play-sound.py.", file=sys.stderr)
        return 2

    conn = None
    fs = None
    if args.ble:
        try:
            from idotmatrix import FullscreenColor
            from idotmatrix.connectionManager import ConnectionManager
        except ModuleNotFoundError as e:
            missing = getattr(e, "name", None) or "a dependency"
            print(f"Missing dependency: {missing}", file=sys.stderr)
            print("Activate your venv and install requirements, e.g.:", file=sys.stderr)
            print("  python3 -m pip install -e python3-idotmatrix-library", file=sys.stderr)
            return 4

        conn = ConnectionManager()
        await _connect(conn, args.address)
        if not conn.client or not conn.client.is_connected:
            print("Failed to connect to the pixel board.", file=sys.stderr)
            return 1

        fs = FullscreenColor()
        fs.conn = conn

    try:
        flash_r, flash_g, flash_b = _parse_rgb(args.color)
        bg_r, bg_g, bg_b = _parse_rgb(args.background)
    except ValueError as e:
        print(f"Invalid color: {e}")
        return 2

    if args.times < 1:
        print("--times must be >= 1")
        return 2

    on_s = max(0, args.on_ms) / 1000.0
    off_s = max(0, args.off_ms) / 1000.0

    try:
        for audio_file in (audio_files or [None]):
            if fs:
                for i in range(args.times):
                    await fs.setMode(r=flash_r, g=flash_g, b=flash_b)
                    if on_s:
                        await asyncio.sleep(on_s)
                    await fs.setMode(r=bg_r, g=bg_g, b=bg_b)
                    if off_s and i != args.times - 1:
                        await asyncio.sleep(off_s)

            if audio_file is None:
                continue

            cmd = _player_command(os.fspath(audio_file))
            if not cmd:
                print(
                    "No supported audio player found. Install one of: ffplay, mpv, mpg123, sox (`play`), or vlc.",
                    file=sys.stderr,
                )
                return 3
            subprocess.run(cmd, check=True)
    finally:
        if conn:
            await conn.disconnect()

    return 0


def main() -> int:
    return asyncio.run(main_async())


if __name__ == "__main__":
    raise SystemExit(main())
