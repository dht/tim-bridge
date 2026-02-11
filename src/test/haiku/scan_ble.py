import asyncio
from bleak import BleakScanner

async def main():
    print("Scanning for BLE devices (10 seconds)...")
    devices = await BleakScanner.discover(timeout=10.0)
    for d in devices:
        print(f"{d.address}  |  {d.name}")

asyncio.run(main())

