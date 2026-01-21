import asyncio
from bleak import BleakScanner

async def main():
    devices = await BleakScanner.discover(timeout=5)
    for d in devices:
        if d.name and "IDM" in d.name:
            print(d.address, d.name)

asyncio.run(main())
