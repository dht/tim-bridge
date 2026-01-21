import asyncio
import os
from idotmatrix import FullscreenColor
from idotmatrix.connectionManager import ConnectionManager

MAC_ADDRESS ="548D5EE8-4BEB-6B78-E532-6E44368D78AD"
PI_5_ADDRESS = "F2:1A:C7:C5:53:24 IDM-C55324"
ADDRESS = os.getenv("IDOTMATRIX_ADDRESS", PI_5_ADDRESS) )
# macOS: usually a BLE UUID; Linux/Raspberry Pi: usually a MAC like "AA:BB:CC:DD:EE:FF"

async def main():
    conn = ConnectionManager()
    await conn.connectByAddress(ADDRESS)

    fs = FullscreenColor()
    fs.conn = conn

    # solid blue
    await fs.setMode(r=0, g=0, b=255)

asyncio.run(main())
