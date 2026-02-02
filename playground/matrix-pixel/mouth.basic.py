import asyncio
import io
import json
from pathlib import Path

from PIL import Image as PilImage

from idotmatrix import Image
from idotmatrix.connectionManager import ConnectionManager
from idotmatrix_env import load_local_env


MAC_ADDRESS_LEFT = "7C5BD10F-AC94-D475-8C7D-D72B07FD63EB"


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
        for tx in range(target_w):
            sx = int(tx * mouth_w / target_w)
            sy = int(ty * mouth_h / target_h)

            color = mouth_pixels[sy][sx]

            # palette index 0 = transparent
            if color != (0, 0, 0):
                fx = mouth_x + tx
                fy = mouth_y + ty
                if 0 <= fx < 32 and 0 <= fy < 32:
                    face_px[fx, fy] = color


def apply_mouth(face_img: PilImage.Image, mouth_json: Path):
    mouth_pixels, mw, mh = indexed_json_to_pixels(mouth_json)

    # scale ×2 → 60×16
    mouth_pixels = scale_pixels_2x(mouth_pixels)
    mw *= 2
    mh *= 2

    # position + final size on 32×32 board
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


async def connect_and_prepare(mac: str):
    conn = ConnectionManager()
    print(f"Connecting to {mac}")
    await conn.connectByAddress(mac)

    # allow CoreBluetooth to settle
    await asyncio.sleep(1.0)

    image_module = Image()
    image_module.conn = conn
    await image_module.setMode(1)

    # load face
    img = image_from_index_json(Path("faces/face-001.index.json"))

    # apply mouth
    apply_mouth(
        img,
        Path("./mouth-shapes/mouth-aei.index.json"),
    )

    payload = _png_payloads(image_module, img)
    return conn, payload


async def sender_loop(conn: ConnectionManager, payload: bytearray):
    while True:
        await conn.send(payload)
        await asyncio.sleep(5)


# -------------------------------
# Main
# -------------------------------

async def main():
    load_local_env()

    conn, payload = await connect_and_prepare(MAC_ADDRESS_LEFT)
    await sender_loop(conn, payload)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
