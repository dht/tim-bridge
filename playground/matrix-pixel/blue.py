import asyncio
from idotmatrix import FullscreenColor
from idotmatrix.connectionManager import ConnectionManager

ADDRESS = "548D5EE8-4BEB-6B78-E532-6E44368D78AD"  # macOS BLE UUID

async def main():
    conn = ConnectionManager()
    await conn.connectByAddress(ADDRESS)

    fs = FullscreenColor()
    fs.conn = conn

    # solid blue
    await fs.setMode(r=0, g=0, b=255)

asyncio.run(main())
