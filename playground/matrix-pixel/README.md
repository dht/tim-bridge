# matrix-pixel (macOS + Raspberry Pi)

These scripts talk to an iDotMatrix-compatible pixel board over BLE.

## Setup

- Raspberry Pi: run `./setup.sh`
- macOS: create a venv and install the library (either `pip install -e ./python3-idotmatrix-library` or `pip install idotmatrix`)

## Configure address (recommended)

Copy the template and set your device identifier:

```bash
cp .env.example .env
```

- macOS usually reports a UUID: `IDOTMATRIX_ADDRESS_DARWIN=<UUID>`
- Pi/Linux usually reports a MAC: `IDOTMATRIX_ADDRESS_LINUX=AA:BB:CC:DD:EE:FF`

You can also override per-run with `--address ...` or `IDOTMATRIX_ADDRESS=...`.

## Discover your device

```bash
python3 discover.py
```

## Run demos

```bash
python3 blue.py
python3 animation-simple.py
python3 animation.py
python3 play-sound.py --ble
```

