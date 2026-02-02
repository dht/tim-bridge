import asyncio
import os
from bleak import BleakScanner

from idotmatrix_env import load_local_env

async def main():
    load_local_env()
    name_substr = os.environ.get("IDOTMATRIX_NAME_SUBSTR", "IDM")
    devices = await BleakScanner.discover(timeout=5)
    for d in devices:
        if d.name and name_substr in d.name:
            print(d.address, d.name)

asyncio.run(main())
