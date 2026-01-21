import asyncio
import io
import os

from PIL import Image as PilImage
from PIL import ImageDraw

from idotmatrix import Image
from idotmatrix.connectionManager import ConnectionManager

ADDRESS = os.getenv("IDOTMATRIX_ADDRESS", "548D5EE8-4BEB-6B78-E532-6E44368D78AD")
PIXEL_SIZE = int(os.getenv("IDOTMATRIX_SIZE", "32"))


def _png_payloads(image_module: Image, img: PilImage.Image) -> bytearray:
    png_buffer = io.BytesIO()
    img.save(png_buffer, format="PNG")
    png_buffer.seek(0)
    return image_module._createPayloads(bytearray(png_buffer.getvalue()))


def _frame(pixel_size: int, corner_xy: tuple[int, int]) -> PilImage.Image:
    img = PilImage.new("RGB", (pixel_size, pixel_size), (0, 0, 255))
    draw = ImageDraw.Draw(img)

    dot_radius = 2 if pixel_size >= 32 else 1
    x, y = corner_xy
    x0 = max(0, x - dot_radius)
    y0 = max(0, y - dot_radius)
    x1 = min(pixel_size - 1, x + dot_radius)
    y1 = min(pixel_size - 1, y + dot_radius)
    draw.ellipse([x0, y0, x1, y1], fill=(255, 255, 0))

    return img


async def main() -> None:
    if PIXEL_SIZE not in (16, 32):
        raise ValueError("IDOTMATRIX_SIZE must be 16 or 32")

    conn = ConnectionManager()
    if ADDRESS:
        await conn.connectByAddress(ADDRESS)
    else:
        await conn.connectBySearch()

    image_module = Image()
    image_module.conn = conn
    await image_module.setMode(1)

    corners = [
        (0, 0),
        (PIXEL_SIZE - 1, 0),
        (PIXEL_SIZE - 1, PIXEL_SIZE - 1),
        (0, PIXEL_SIZE - 1),
    ]
    payloads = [_png_payloads(image_module, _frame(PIXEL_SIZE, xy)) for xy in corners]

    try:
        while True:
            for payload in payloads:
                await conn.send(payload)
                await asyncio.sleep(1)
    finally:
        await conn.disconnect()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass

