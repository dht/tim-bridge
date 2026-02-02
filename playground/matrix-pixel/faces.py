import sys
import asyncio
import json
import os
from idotmatrix import FullscreenImage
from idotmatrix.connectionManager import ConnectionManager

# Connection settings
MAC_ADDRESS_2 = "548D5EE8-4BEB-6B78-E532-6E44368D78AD"
PI_ADDRESS = "F2:1A:C7:C5:53:24"

def get_address():
    if sys.platform == "darwin":
        return MAC_ADDRESS_2
    return PI_ADDRESS

async def main():
    # Construct path relative to the script location
    json_path = os.path.join("faces", "face-001.index.json")

    try:
        with open(json_path, "r") as f:
            data = json.load(f)
    except FileNotFoundError:
        print(f"Error: {json_path} not found. Check your directory structure.")
        return

    palette = data["palette"]["colors"]
    indices = data["indices"]
    width = data["size"]["width"]
    height = data["size"]["height"]

    # Validation: 64x64 matrix requires 4096 pixels
    expected_length = width * height
    if len(indices) < expected_length:
        print(f"Warning: Expected {expected_length} indices, but found {len(indices)}.")

    # Convert indexed colors to a flat RGB list [r1, g1, b1, r2, g2, b2...]
    # Using a list comprehension for better Pythonic performance
    pixel_data = []
    for idx in indices:
        pixel_data.extend(palette[idx])

    # BLE Connection
    address = get_address()
    print(f"Connecting to {address}...")

    conn = ConnectionManager()
    await conn.connectByAddress(address)

    # Push to hardware
    fi = FullscreenImage()
    fi.conn = conn

    print(f"Uploading {width}x{height} image to iDotMatrix...")
    await fi.setPixels(pixel_data)

    print("Success: Image displayed.")

if __name__ == "__main__":
    asyncio.run(main())
