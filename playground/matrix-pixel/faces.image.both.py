import argparse
import asyncio
import io
import json
import struct
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from PIL import Image as PilImage

from bleak import BleakClient

from idotmatrix.const import UUID_WRITE_DATA

from idotmatrix_env import load_local_env


DEFAULT_MAC_ADDRESS_LEFT = "7C5BD10F-AC94-D475-8C7D-D72B07FD63EB"
DEFAULT_MAC_ADDRESS_RIGHT = "548D5EE8-4BEB-6B78-E532-6E44368D78AD"


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


def png_payloads_from_image(img: PilImage.Image) -> bytearray:
    png_buffer = io.BytesIO()
    img.save(png_buffer, format="PNG")
    png_buffer.seek(0)
    return create_payloads(bytearray(png_buffer.getvalue()))


def split_into_chunks(data: bytearray, chunk_size: int) -> list[bytearray]:
    return [data[i : i + chunk_size] for i in range(0, len(data), chunk_size)]


def create_payloads(png_data: bytearray) -> bytearray:
    """Match `idotmatrix.modules.image.Image._createPayloads`.

    Important: we replicate this here to avoid `ConnectionManager` singleton behavior
    when controlling multiple boards.
    """

    png_chunks = split_into_chunks(png_data, 4096)
    idk = len(png_data) + len(png_chunks)
    idk_bytes = struct.pack("h", idk)
    png_len_bytes = struct.pack("i", len(png_data))

    payloads = bytearray()
    for i, chunk in enumerate(png_chunks):
        payload = (
            idk_bytes + bytearray([0, 0, 2 if i > 0 else 0]) + png_len_bytes + chunk
        )
        payloads.extend(payload)

    return payloads


@dataclass
class MatrixConnection:
    address: str
    client: Optional[BleakClient] = None

    async def connect(self) -> None:
        if not self.client:
            self.client = BleakClient(self.address)

        if not self.client.is_connected:
            await self.client.connect()

            # 🔴 CRITICAL: allow CoreBluetooth to settle (macOS)
            await asyncio.sleep(1.0)

    async def disconnect(self) -> None:
        if self.client and self.client.is_connected:
            await self.client.disconnect()

    async def set_diy_mode(self, enabled: bool = True) -> None:
        # Same payload as `idotmatrix.modules.image.Image.setMode(1)`
        mode = 1 if enabled else 0
        await self.send(bytearray([5, 0, 4, 1, mode % 256]), response=False)

    async def send(self, data: bytearray, response: bool = False) -> None:
        await self.connect()
        assert self.client is not None

        services = self.client.services
        if services is None:
            services = await self.client.get_services()

        characteristic = services.get_characteristic(UUID_WRITE_DATA)
        chunk_size = characteristic.max_write_without_response_size

        for i in range(0, len(data), chunk_size):
            await self.client.write_gatt_char(
                UUID_WRITE_DATA,
                data[i : i + chunk_size],
                response=response,
            )

        # give the device a moment between frames
        await asyncio.sleep(0.01)


async def connect_and_prepare(address: str, face_json: Path) -> tuple[MatrixConnection, bytearray]:
    conn = MatrixConnection(address)
    print(f"Connecting to {address}")
    await conn.connect()
    await conn.set_diy_mode(True)

    img = image_from_index_json(face_json)
    payload = png_payloads_from_image(img)

    return conn, payload


async def sender_loop(name: str, conn: MatrixConnection, payload: bytearray, interval_s: float) -> None:
    while True:
        await conn.send(payload)
        print(f"Sent {name} frame to {conn.address}")
        await asyncio.sleep(interval_s)


async def main() -> None:
    load_local_env()

    parser = argparse.ArgumentParser(
        description=(
            "Send two different faces to two different iDotMatrix boards (macOS/CoreBluetooth). "
            "This avoids the upstream ConnectionManager singleton, which otherwise routes both sends "
            "to the last-connected device."
        )
    )
    parser.add_argument("--left", default=DEFAULT_MAC_ADDRESS_LEFT, help="Left board BLE address")
    parser.add_argument("--right", default=DEFAULT_MAC_ADDRESS_RIGHT, help="Right board BLE address")
    parser.add_argument(
        "--left-face",
        default="faces/face-001.index.json",
        help="Path to left face *.index.json",
    )
    parser.add_argument(
        "--right-face",
        default="faces/face-002.index.json",
        help="Path to right face *.index.json",
    )
    parser.add_argument("--interval", type=float, default=5.0, help="Seconds between resends")
    args = parser.parse_args()

    left_conn, left_payload = await connect_and_prepare(args.left, Path(args.left_face))
    right_conn, right_payload = await connect_and_prepare(args.right, Path(args.right_face))

    try:
        await asyncio.gather(
            sender_loop("left", left_conn, left_payload, args.interval),
            sender_loop("right", right_conn, right_payload, args.interval),
        )
    finally:
        await asyncio.gather(left_conn.disconnect(), right_conn.disconnect())


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
