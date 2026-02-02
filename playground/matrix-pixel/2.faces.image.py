import asyncio
import io
import json
from pathlib import Path

from PIL import Image as PilImage

from idotmatrix import Image
from idotmatrix.connectionManager import ConnectionManager

from idotmatrix_env import load_local_env


MAC_ADDRESS_LEFT = "7C5BD10F-AC94-D475-8C7D-D72B07FD63EB"
MAC_ADDRESS_RIGHT = "548D5EE8-4BEB-6B78-E532-6E44368D78AD"


def _png_payloads(image_module: Image, img: PilImage.Image) -> bytearray:
    png_buffer = io.BytesIO()
    img.save(png_buffer, format="PNG")
    png_buffer.seek(0)
    return image_module._createPayloads(bytearray(png_buffer.getvalue()))


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


async def connect_and_prepare(mac: str, face_json: Path):
    conn = ConnectionManager()
    print(f"Connecting to {mac}")
    await conn.connectByAddress(mac)

    # 🔴 CRITICAL: allow CoreBluetooth to settle
    await asyncio.sleep(1.0)

    image_module = Image()
    image_module.conn = conn
    await image_module.setMode(1)

    img = image_from_index_json(face_json)
    payload = _png_payloads(image_module, img)

    return conn, payload


async def sender_loop(conn: ConnectionManager, payload: bytearray):
    while True:
        await conn.send(payload)
        await asyncio.sleep(5)


async def main():
    load_local_env()

    # --- connect sequentially ---
    left_conn, left_payload = await connect_and_prepare(
        MAC_ADDRESS_LEFT,
        Path("faces/face-001.index.json"),
    )

    # --- send concurrently ---
    await asyncio.gather(
        sender_loop(left_conn, left_payload),
    )


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
