import asyncio
from bleak import BleakClient

ADDRESS = "48:0F:57:C5:78:9D"

async def main():
    client = BleakClient(ADDRESS, timeout=20.0)
    await client.connect()
    print("Connected:", client.is_connected)

    services = await client.get_services()
    for service in services:
        print(f"\nService: {service.uuid}")
        for char in service.characteristics:
            print(
                f"  Characteristic: {char.uuid} | "
                f"Properties: {char.properties}"
            )

    await client.disconnect()

asyncio.run(main())
