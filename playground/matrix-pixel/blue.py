import sys
import asyncio
from idotmatrix import FullscreenColor
from idotmatrix.connectionManager import ConnectionManager

MAC_ADDRESS = "548D5EE8-4BEB-6B78-E532-6E44368D78AD"  # macOS BLE UUID
PI_ADDRESS  = "F2:1A:C7:C5:53:24"                   # Linux BLE MAC

def get_address():
    if sys.platform == "darwin":
        return MAC_ADDRESS
    elif sys.platform.startswith("linux"):
        return PI_ADDRESS
    else:
        raise RuntimeError(f"Unsupported platform: {sys.platform}")

async def main():
    address = get_address()
    print(f"Connecting to {address}")

    conn = ConnectionManager()
    await conn.connectByAddress(address)

    fs = FullscreenColor()
    fs.conn = conn

    # solid blue
    await fs.setMode(r=0, g=0, b=255)

asyncio.run(main())
