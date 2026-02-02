import asyncio
import io
import json
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from PIL import Image as PilImage

from idotmatrix import Image
from idotmatrix.connectionManager import ConnectionManager
from idotmatrix_env import load_local_env


# ===============================
# CONFIG
# ===============================

LINE_JSON = "./gossip/lines-2B.json"  # <- fixed as requested
MAC_ADDRESS_LEFT = "7C5BD10F-AC94-D475-8C7D-D72B07FD63EB"

MOUTH_FILES = [
    "mouth-aei.index.json",
    "mouth-bmp.index.json",
    "mouth-cdnstxyz.index.json",
    "mouth-chjsh.index.json",
    "mouth-ee.index.json",
    "mouth-fv.index.json",
    "mouth-gk.index.json",
    "mouth-l.index.json",
    "mouth-neutral.index.json",
    "mouth-o.index.json",
    "mouth-qw.index.json",
    "mouth-th.index.json",
    "mouth-u.index.json",
]

MOUTH_DIR = Path("mouth-shapes")
FACE_JSON = Path("faces/face-001.index.json")

# Where the mouth is drawn on the 32x32 board
MOUTH_X = 7
MOUTH_Y = 20
TARGET_W = 16
TARGET_H = 8


# ===============================
# Indexed JSON helpers
# ===============================

def indexed_json_to_pixels(json_path: Path):
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    width = data["size"]["width"]
    height = data["size"]["height"]
    indices = data["indices"]
    palette = data["palette"]["colors"]

    pixels = []
    i = 0
    for y in range(height):
        row = []
        for x in range(width):
            row.append(tuple(palette[indices[i]]))
            i += 1
        pixels.append(row)

    return pixels, width, height


def scale_pixels_2x(pixels):
    scaled = []
    for row in pixels:
        scaled_row = []
        for px in row:
            scaled_row.extend([px, px])
        scaled.append(scaled_row)
        scaled.append(scaled_row.copy())
    return scaled


# ===============================
# Face + mouth compositing
# ===============================

def overlay_mouth(
    face_img: PilImage.Image,
    mouth_pixels,
    mouth_w,
    mouth_h,
    mouth_x,
    mouth_y,
    target_w,
    target_h,
):
    face_px = face_img.load()

    for ty in range(target_h):
        sy = int(ty * mouth_h / target_h)
        for tx in range(target_w):
            sx = int(tx * mouth_w / target_w)
            color = mouth_pixels[sy][sx]

            # palette index 0 is black background in your assets -> treat as transparent
            if color != (0, 0, 0):
                fx = mouth_x + tx
                fy = mouth_y + ty
                if 0 <= fx < 32 and 0 <= fy < 32:
                    face_px[fx, fy] = color


def apply_mouth(face_img: PilImage.Image, mouth_json: Path):
    mouth_pixels, mw, mh = indexed_json_to_pixels(mouth_json)

    # scale ×2 (asset meant for 64x64 world, we later downsample into TARGET_W/H)
    mouth_pixels = scale_pixels_2x(mouth_pixels)
    mw *= 2
    mh *= 2

    overlay_mouth(
        face_img,
        mouth_pixels,
        mw,
        mh,
        MOUTH_X,
        MOUTH_Y,
        TARGET_W,
        TARGET_H,
    )


# ===============================
# Face loader
# ===============================

def image_from_index_json(json_path: Path) -> PilImage.Image:
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    width = data["size"]["width"]
    height = data["size"]["height"]

    img = PilImage.new("RGB", (width, height))
    pixels = img.load()

    indices = data["indices"]
    palette = data["palette"]["colors"]

    i = 0
    for y in range(height):
        for x in range(width):
            pixels[x, y] = tuple(palette[indices[i]])
            i += 1

    return img.resize((32, 32), PilImage.NEAREST)


# ===============================
# iDotMatrix helpers
# ===============================

def _png_payloads(image_module: Image, img: PilImage.Image) -> bytearray:
    png_buffer = io.BytesIO()
    img.save(png_buffer, format="PNG")
    png_buffer.seek(0)
    return image_module._createPayloads(bytearray(png_buffer.getvalue()))


# ===============================
# Precompute all mouth payloads (efficient)
# ===============================

def build_mouth_payloads(image_module: Image) -> Dict[str, bytearray]:
    """
    Returns dict keyed by mouth file stem (e.g. "mouth-aei") -> payload
    """
    base_face = image_from_index_json(FACE_JSON)

    out: Dict[str, bytearray] = {}
    for mouth_file in MOUTH_FILES:
        img = base_face.copy()
        apply_mouth(img, MOUTH_DIR / mouth_file)
        key = Path(mouth_file).stem.replace(".index", "")  # "mouth-aei"
        out[key] = _png_payloads(image_module, img)

    # Ensure we always have a safe fallback
    if "mouth-neutral" not in out:
        # if missing, just use first available
        out["mouth-neutral"] = next(iter(out.values()))
    return out


# ===============================
# IPA -> viseme mapping
# ===============================

# A practical viseme mapping into your available mouth sets.
# Anything unknown falls back to neutral (closed mouth).
IPA_TO_MOUTH: Dict[str, str] = {
    # --- consonants ---
    "p": "mouth-bmp", "b": "mouth-bmp", "m": "mouth-bmp",
    "f": "mouth-fv", "v": "mouth-fv",
    "θ": "mouth-th", "ð": "mouth-th",
    "t": "mouth-cdnstxyz", "d": "mouth-cdnstxyz", "n": "mouth-cdnstxyz",
    "s": "mouth-cdnstxyz", "z": "mouth-cdnstxyz",
    "ʃ": "mouth-chjsh", "ʒ": "mouth-chjsh", "tʃ": "mouth-chjsh", "dʒ": "mouth-chjsh",
    "k": "mouth-gk", "g": "mouth-gk", "ŋ": "mouth-gk",
    "l": "mouth-l",
    "ɹ": "mouth-qw", "r": "mouth-qw", "w": "mouth-qw",
    "j": "mouth-ee",  # y-sound tends to look like ee-ish
    "h": "mouth-neutral",
    # --- vowels / diphthongs ---
    "i": "mouth-ee", "iː": "mouth-ee", "ɪ": "mouth-ee",
    "e": "mouth-aei", "eɪ": "mouth-aei", "ɛ": "mouth-aei", "æ": "mouth-aei",
    "ɑ": "mouth-aei", "ɒ": "mouth-o",
    "ɔ": "mouth-o", "ɔː": "mouth-o",
    "o": "mouth-o", "oʊ": "mouth-o", "əʊ": "mouth-o",
    "u": "mouth-u", "uː": "mouth-u", "ʊ": "mouth-u",
    "ə": "mouth-neutral", "ʌ": "mouth-aei", "ɜ": "mouth-neutral", "ɜː": "mouth-neutral",
    "aɪ": "mouth-aei",
    "aʊ": "mouth-o",
    "ɔɪ": "mouth-o",
    # rhotic/colored vowels sometimes appear in dictionaries:
    "ɚ": "mouth-neutral", "ɝ": "mouth-neutral", "ɝː": "mouth-neutral",
}

# Characters we ignore in IPA strings
IPA_STRIP_CHARS = set([
    "/", "[", "]", "(", ")", " ", "\t", "\n", "\r",
    "ˈ", "ˌ", ",", ".", "!", "?", ":", ";", "…", "—", "-", "–", "’", "'",
])

# Multi-char IPA tokens to match first (longest wins)
IPA_MULTI_TOKENS = sorted([
    "tʃ", "dʒ",
    "iː", "ɔː", "uː", "ɜː", "ɝː",
    "eɪ", "aɪ", "aʊ", "ɔɪ",
    "oʊ", "əʊ",
], key=len, reverse=True)


def tokenize_ipa(ipa: str) -> List[str]:
    """
    Very simple tokenizer:
    - strips separators/stress
    - matches known multi-char tokens first
    - otherwise takes single chars
    """
    s = ipa.strip()
    out: List[str] = []

    i = 0
    while i < len(s):
        ch = s[i]

        if ch in IPA_STRIP_CHARS:
            i += 1
            continue

        # Try multi tokens
        matched = None
        for tok in IPA_MULTI_TOKENS:
            if s.startswith(tok, i):
                matched = tok
                break
        if matched:
            out.append(matched)
            i += len(matched)
            continue

        # Otherwise single char token
        out.append(ch)
        i += 1

    return out


def ipa_tokens_to_mouth_keys(tokens: List[str], fallback: str = "mouth-neutral") -> List[str]:
    keys: List[str] = []
    for t in tokens:
        keys.append(IPA_TO_MOUTH.get(t, fallback))
    return keys


# ===============================
# Audio duration + playback
# ===============================

def get_mp3_duration_seconds(mp3_path: Path) -> float:
    """
    Uses mutagen (recommended) if available. Otherwise tries ffprobe.
    """
    # 1) mutagen
    try:
        from mutagen.mp3 import MP3  # type: ignore
        audio = MP3(str(mp3_path))
        if audio.info and audio.info.length:
            return float(audio.info.length)
    except Exception:
        pass

    # 2) ffprobe (if installed)
    try:
        proc = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", str(mp3_path)],
            capture_output=True,
            text=True,
            check=True,
        )
        return float(proc.stdout.strip())
    except Exception:
        raise RuntimeError(
            "Could not determine MP3 duration. Install one of:\n"
            "  pip install mutagen\n"
            "or install ffmpeg (ffprobe)."
        )


def play_mp3_nonblocking(mp3_path: Path) -> subprocess.Popen:
    """
    Cross-platform-ish:
    - macOS: afplay
    - Linux: mpg123 or ffplay
    - Windows: powershell SoundPlayer (may be flaky for mp3 depending on codecs)
    """
    if sys.platform == "darwin":
        return subprocess.Popen(["afplay", str(mp3_path)])
    elif sys.platform.startswith("linux"):
        # Try mpg123 first, then ffplay
        for cmd in (["mpg123", "-q", str(mp3_path)], ["ffplay", "-nodisp", "-autoexit", "-loglevel", "quiet", str(mp3_path)]):
            try:
                return subprocess.Popen(cmd)
            except FileNotFoundError:
                continue
        raise RuntimeError("No audio player found. Install mpg123 or ffmpeg (ffplay).")
    else:
        # Windows fallback: powershell SoundPlayer (often doesn't support mp3 well)
        # If this fails, use ffplay approach on Windows too.
        try:
            return subprocess.Popen([
                "powershell",
                "-NoProfile",
                "-Command",
                f"(New-Object Media.SoundPlayer '{mp3_path}').PlaySync();"
            ])
        except FileNotFoundError:
            try:
                return subprocess.Popen(["ffplay", "-nodisp", "-autoexit", "-loglevel", "quiet", str(mp3_path)])
            except FileNotFoundError:
                raise RuntimeError("No audio player found. Install ffmpeg (ffplay).")


# ===============================
# Connection + mouth talking loop
# ===============================

async def connect_and_prepare(mac: str):
    conn = ConnectionManager()
    print(f"Connecting to {mac}")
    await conn.connectByAddress(mac)
    await asyncio.sleep(1.0)  # allow CoreBluetooth to settle

    image_module = Image()
    image_module.conn = conn
    await image_module.setMode(1)

    payload_by_mouth = build_mouth_payloads(image_module)
    return conn, payload_by_mouth


@dataclass
class LineData:
    transcription: str
    phonetics_ipa: str


def load_line_data(line_json: Path) -> LineData:
    with open(line_json, "r", encoding="utf-8") as f:
        data = json.load(f)
    return LineData(
        transcription=data.get("transcription", ""),
        phonetics_ipa=data.get("phonetics_ipa", ""),
    )

async def mouth_talk_loop(
    conn: ConnectionManager,
    payload_by_mouth: Dict[str, bytearray],
    ipa: str,
    duration_s: float,
    start_time_s: Optional[float] = None,
):
    """
    Time-correct mouth animation that:
    - weights vowels longer than consonants
    - schedules frames on absolute audio time
    - guarantees mouth remains animated until audio ends
    """

    # ---------------------------
    # 1. Tokenize + map IPA
    # ---------------------------
    tokens = tokenize_ipa(ipa)
    mouth_keys = ipa_tokens_to_mouth_keys(tokens, fallback="mouth-neutral")

    if not mouth_keys:
        mouth_keys = ["mouth-neutral"]

    neutral_payload = payload_by_mouth.get(
        "mouth-neutral",
        next(iter(payload_by_mouth.values()))
    )

    # ---------------------------
    # 2. Define vowel vs consonant
    # ---------------------------
    VOWEL_MOUTHS = {
        "mouth-aei", "mouth-ee", "mouth-o", "mouth-u"
    }

    VOWEL_WEIGHT = 3.0
    CONSONANT_WEIGHT = 1.0

    weights: List[float] = []
    for key in mouth_keys:
        if key in VOWEL_MOUTHS:
            weights.append(VOWEL_WEIGHT)
        else:
            weights.append(CONSONANT_WEIGHT)

    total_weight = sum(weights)
    if total_weight <= 0:
        await conn.send(neutral_payload)
        return

    # ---------------------------
    # 3. Compute per-frame timing
    # ---------------------------
    frame_durations = [
        duration_s * (w / total_weight)
        for w in weights
    ]

    # Convert to absolute timestamps
    loop = asyncio.get_running_loop()
    start_time = start_time_s if start_time_s is not None else loop.time()

    schedule: List[float] = []
    t = start_time
    for d in frame_durations:
        schedule.append(t)
        t += d

    # ---------------------------
    # 4. Send frames at scheduled times
    # ---------------------------
    for idx, key in enumerate(mouth_keys):
        target_t = schedule[idx]
        now = loop.time()
        delay = target_t - now

        if delay > 0:
            await asyncio.sleep(delay)

        payload = payload_by_mouth.get(key, neutral_payload)
        await conn.send(payload)

    # ---------------------------
    # 5. Hold neutral until audio ends
    # ---------------------------
    end_time = start_time + duration_s
    remaining = end_time - loop.time()

    if remaining > 0:
        await asyncio.sleep(remaining)

    await conn.send(neutral_payload)


async def run_line(conn: ConnectionManager, payload_by_mouth: Dict[str, bytearray], line_json: Path):
    mp3_path = line_json.with_suffix(".mp3")

    if not mp3_path.exists():
        raise FileNotFoundError(f"Missing MP3: {mp3_path}")

    line = load_line_data(line_json)
    if not line.phonetics_ipa:
        raise RuntimeError("JSON missing phonetics_ipa")

    duration = get_mp3_duration_seconds(mp3_path)
    print(f"Text: {line.transcription}")
    print(f"IPA:  {line.phonetics_ipa}")
    print(f"MP3 duration: {duration:.2f}s")

    neutral_payload = payload_by_mouth.get(
        "mouth-neutral",
        next(iter(payload_by_mouth.values()))
    )

    # Start audio playback (non-blocking), and animate mouth in parallel
    audio_proc = play_mp3_nonblocking(mp3_path)
    try:
        loop = asyncio.get_running_loop()
        start_time_s = loop.time()

        audio_done = asyncio.create_task(asyncio.to_thread(audio_proc.wait))
        mouth_task = asyncio.create_task(
            mouth_talk_loop(conn, payload_by_mouth, line.phonetics_ipa, duration, start_time_s=start_time_s)
        )

        done, pending = await asyncio.wait(
            {audio_done, mouth_task},
            return_when=asyncio.FIRST_COMPLETED,
        )

        if audio_done in done and not mouth_task.done():
            mouth_task.cancel()
            try:
                await mouth_task
            except asyncio.CancelledError:
                pass
        else:
            # Mouth finished first (or both finished); surface any mouth errors.
            await mouth_task

        # Always wait for audio completion so we close mouth exactly at end.
        if not audio_done.done():
            await audio_done
    finally:
        # Close mouth right at audio end
        try:
            await conn.send(neutral_payload)
        except Exception:
            pass

        # Ensure audio process is not left running (usually it exits on its own)
        try:
            audio_proc.poll()
        except Exception:
            pass


# ===============================
# Main
# ===============================

async def main():
    load_local_env()
    conn, payload_by_mouth = await connect_and_prepare(MAC_ADDRESS_LEFT)
    await run_line(conn, payload_by_mouth, Path(LINE_JSON))


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
