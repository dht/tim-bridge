import asyncio
import io
import json
from pathlib import Path
from typing import Dict, List

from PIL import Image as PilImage

from idotmatrix import Image
from idotmatrix.connectionManager import ConnectionManager
from idotmatrix_env import load_local_env


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


# -------------------------------
# Indexed PNG helpers
# -------------------------------

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


# -------------------------------
# Face + mouth compositing
# -------------------------------

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

            if color != (0, 0, 0):
                fx = mouth_x + tx
                fy = mouth_y + ty
                if 0 <= fx < 32 and 0 <= fy < 32:
                    face_px[fx, fy] = color


def apply_mouth(face_img: PilImage.Image, mouth_json: Path):
    mouth_pixels, mw, mh = indexed_json_to_pixels(mouth_json)
    mouth_pixels = scale_pixels_2x(mouth_pixels)
    mw *= 2
    mh *= 2

    MOUTH_X = 7
    MOUTH_Y = 20
    TARGET_W = 16
    TARGET_H = 8

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


# -------------------------------
# Face loader
# -------------------------------

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


# -------------------------------
# iDotMatrix helpers
# -------------------------------

def _png_payloads(image_module: Image, img: PilImage.Image) -> bytearray:
    png_buffer = io.BytesIO()
    img.save(png_buffer, format="PNG")
    png_buffer.seek(0)
    return image_module._createPayloads(bytearray(png_buffer.getvalue()))


# -------------------------------
# Precompute all mouth payloads
# -------------------------------

def build_mouth_payloads(image_module: Image) -> List[bytearray]:
    base_face = image_from_index_json(Path("faces/face-001.index.json"))
    payloads = []

    for mouth_file in MOUTH_FILES:
        img = base_face.copy()
        apply_mouth(img, Path("mouth-shapes") / mouth_file)
        payloads.append(_png_payloads(image_module, img))

    return payloads


# -------------------------------
# Connection + animation loop
# -------------------------------

async def connect_and_prepare(mac: str):
    conn = ConnectionManager()
    print(f"Connecting to {mac}")
    await conn.connectByAddress(mac)
    await asyncio.sleep(1.0)

    image_module = Image()
    image_module.conn = conn
    await image_module.setMode(1)

    mouth_payloads = build_mouth_payloads(image_module)
    return conn, mouth_payloads


async def mouth_animation_loop(conn: ConnectionManager, payloads: List[bytearray]):
    idx = 0
    count = len(payloads)

    while True:
        await conn.send(payloads[idx])
        idx = (idx + 1) % count
        await asyncio.sleep(0.6)


# -------------------------------
# Main
# -------------------------------

async def main():
    load_local_env()
    conn, payloads = await connect_and_prepare(MAC_ADDRESS_LEFT)
    await mouth_animation_loop(conn, payloads)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
