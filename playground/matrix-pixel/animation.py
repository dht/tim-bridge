import argparse
import asyncio
import tempfile

from PIL import Image, ImageDraw, ImageFont

from idotmatrix import Gif
from idotmatrix.connectionManager import ConnectionManager


from idotmatrix_env import load_local_env, resolve_address


def _draw_character(draw: ImageDraw.ImageDraw, mouth: str, y_offset: int = 0) -> None:
    head_fill = (0, 120, 255)
    outline = (10, 25, 60)
    white = (245, 245, 245)
    black = (10, 10, 10)
    pink = (255, 110, 150)

    cx, cy = 16, 19 + y_offset
    r = 11
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=head_fill, outline=outline)

    # eyes
    draw.ellipse((10, cy - 5, 14, cy - 1), fill=white)
    draw.ellipse((18, cy - 5, 22, cy - 1), fill=white)
    draw.ellipse((12, cy - 4, 13, cy - 3), fill=black)
    draw.ellipse((20, cy - 4, 21, cy - 3), fill=black)

    # mouth (basic phoneme-ish shapes)
    my = cy + 5
    if mouth == "closed":
        draw.rounded_rectangle((12, my, 20, my + 2), radius=1, fill=black)
    elif mouth == "smile":
        draw.arc((11, my - 1, 21, my + 7), start=20, end=160, fill=black, width=2)
    elif mouth == "open":
        draw.ellipse((12, my - 1, 20, my + 6), fill=black)
        draw.ellipse((13, my + 1, 19, my + 5), fill=pink)
    elif mouth == "wide":
        draw.rounded_rectangle((11, my - 1, 21, my + 6), radius=2, fill=black)
        draw.rounded_rectangle((12, my + 1, 20, my + 4), radius=1, fill=pink)
    elif mouth == "o":
        draw.ellipse((13, my - 1, 19, my + 5), fill=black)
        draw.ellipse((14, my, 18, my + 4), fill=pink)
    else:
        draw.rounded_rectangle((12, my, 20, my + 2), radius=1, fill=black)


def _make_frame(mouth: str, y_offset: int = 0) -> Image.Image:
    img = Image.new("RGB", (32, 32), (0, 0, 35))
    draw = ImageDraw.Draw(img)

    font = ImageFont.load_default()
    text = "lets go!"
    text_w = draw.textlength(text, font=font)
    draw.rounded_rectangle((2, 1, 30, 11), radius=3, fill=(245, 245, 245))
    draw.text(((32 - text_w) / 2, 2), text, fill=(0, 0, 0), font=font)

    _draw_character(draw, mouth=mouth, y_offset=y_offset)
    return img


def _build_lets_go_gif(path: str) -> None:
    # Rough timing for: "lets go!"
    sequence = [
        ("smile", 0),
        ("closed", 0),
        ("open", 0),
        ("closed", 0),
        ("closed", 1),
        ("wide", 1),
        ("o", 1),
        ("smile", 1),
    ]

    frames = []
    for mouth, bob in sequence:
        frames.append(_make_frame(mouth=mouth, y_offset=-bob))

    frames[0].save(
        path,
        format="GIF",
        save_all=True,
        append_images=frames[1:],
        duration=140,
        loop=0,
        disposal=2,
    )


async def main() -> None:
    load_local_env()
    parser = argparse.ArgumentParser(description='Animate a character saying "lets go!"')
    parser.add_argument("--address", help="BLE address/UUID (or set IDOTMATRIX_ADDRESS...).")
    args = parser.parse_args()

    with tempfile.NamedTemporaryFile(suffix=".gif", delete=False) as tmp:
        gif_path = tmp.name

    _build_lets_go_gif(gif_path)

    conn = ConnectionManager()
    address = resolve_address(args.address)
    if address:
        await conn.connectByAddress(address)
    else:
        await conn.connectBySearch()

    gif = Gif()
    gif.conn = conn
    await gif.uploadUnprocessed(gif_path)


if __name__ == "__main__":
    asyncio.run(main())
