// printer-session.js
// Node 20+ (ESM). Run: node printer-session.js
import noble from "@abandonware/noble";
import readline from "readline";

const TARGET = "48:0f:57:c5:78:9d";

// Based on your scan:
const WRITE_UUID = "ae03";   // writeWithoutResponse
const NOTIFY_UUID = "ae02";  // notify

let writeChar;
let notifyChar;
let peripheral;

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function help() {
  console.log("\nCommands:");
  console.log("  rect        -> send rectangle bitmap frame (best-effort)");
  console.log("  haiku       -> send haiku as bitmap-like frame (best-effort)");
  console.log("  ping        -> send tiny probe frame");
  console.log("  exit        -> disconnect and quit\n");
}

// ---- BLE lifecycle ----
noble.on("stateChange", async (state) => {
  if (state === "poweredOn") {
    console.log("Scanning...");
    await noble.startScanningAsync([], false);
  } else {
    try { await noble.stopScanningAsync(); } catch {}
  }
});

noble.on("discover", async (p) => {
  if (p.address !== TARGET) return;

  peripheral = p;
  await noble.stopScanningAsync();

  await peripheral.connectAsync();
  console.log("Connected to printer");

  const { characteristics } = await peripheral.discoverAllServicesAndCharacteristicsAsync();

  writeChar = characteristics.find((c) => c.uuid === WRITE_UUID);
  notifyChar = characteristics.find((c) => c.uuid === NOTIFY_UUID);

  if (!writeChar) {
    console.error(`Write characteristic ${WRITE_UUID} not found`);
    process.exit(1);
  }

  if (notifyChar) {
    await notifyChar.subscribeAsync();
    notifyChar.on("data", (data) => {
      console.log("\nPrinter response:", data.toString("hex"));
      // re-print prompt nicely after async notify
      rl.prompt(true);
    });
  }

  help();
  console.log("Ready.");
  rl.setPrompt("> ");
  rl.prompt();

  promptLoop();
});

// Clean disconnect on Ctrl+C
process.on("SIGINT", async () => {
  console.log("\nDisconnecting...");
  try { if (peripheral) await peripheral.disconnectAsync(); } catch {}
  process.exit(0);
});

// ---- CLI loop ----
function promptLoop() {
  rl.on("line", async (line) => {
    const cmd = line.trim().toLowerCase();

    try {
      if (cmd === "rect") await sendRectangle();
      else if (cmd === "haiku") await sendHaiku();
      else if (cmd === "ping") await sendPing();
      else if (cmd === "exit") {
        await peripheral.disconnectAsync();
        process.exit(0);
      } else {
        help();
      }
    } catch (e) {
      console.error("Command error:", e?.message || e);
    }

    rl.prompt();
  });
}

// ---- Helpers ----

// BLE writeWithoutResponse: keep chunks <= 20 bytes
async function writeChunked(buf) {
  const CHUNK = 20;
  for (let i = 0; i < buf.length; i += CHUNK) {
    const chunk = buf.slice(i, i + CHUNK);
    await writeChar.writeAsync(chunk, false);
  }
}

// A generic “FunPrint-ish” frame wrapper (best-effort).
// NOTE: We do NOT yet know the real protocol, so this may not print.
// Still useful for experimenting and seeing notify responses / device reactions.
function makeFrame(payload) {
  // header: 0x51 0x78
  // length: little-endian (payload length)
  // crc: XOR of payload bytes (common but not guaranteed)
  // tail: 0xFF
  const len = payload.length;
  const frame = Buffer.alloc(2 + 2 + len + 1 + 1);

  frame[0] = 0x51;
  frame[1] = 0x78;
  frame[2] = len & 0xff;
  frame[3] = (len >> 8) & 0xff;

  payload.copy(frame, 4);

  let crc = 0x00;
  for (let i = 0; i < len; i++) crc ^= payload[i];

  frame[4 + len] = crc;
  frame[5 + len] = 0xff;

  return frame;
}

// Create a 1-bit packed bitmap buffer from a callback pixel(x,y)->0/1
function make1bppBitmap(width, height, pixelFn) {
  if (width % 8 !== 0) throw new Error("width must be divisible by 8 for 1bpp packing");
  const bytesPerRow = width / 8;
  const data = Buffer.alloc(bytesPerRow * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const on = pixelFn(x, y) ? 1 : 0;
      if (!on) continue;
      const byteIndex = y * bytesPerRow + (x >> 3);
      data[byteIndex] |= (0x80 >> (x & 7));
    }
  }
  return data;
}

// ---- Commands ----

async function sendPing() {
  console.log("Sending ping/probe frame...");
  const payload = Buffer.from([0x00]); // harmless probe
  const frame = makeFrame(payload);
  await writeChunked(frame);
  console.log("Ping sent");
}

async function sendRectangle() {
  console.log("Sending rectangle bitmap frame (best-effort)...");

  const width = 64;   // try a slightly larger test
  const height = 32;

  const bitmap = make1bppBitmap(width, height, (x, y) => {
    // border rectangle
    return x === 0 || x === width - 1 || y === 0 || y === height - 1;
  });

  // “Image” command guess: 0xA0 then width/height little-endian, then packed bitmap
  const CMD_IMAGE = 0xA0;
  const payload = Buffer.concat([
    Buffer.from([CMD_IMAGE]),
    Buffer.from([width & 0xff, (width >> 8) & 0xff]),
    Buffer.from([height & 0xff, (height >> 8) & 0xff]),
    bitmap
  ]);

  const frame = makeFrame(payload);
  await writeChunked(frame);

  console.log("Rectangle sent");
}

async function sendHaiku() {
  console.log("Sending haiku (as bitmap frame, best-effort)...");

  // We DON'T have the real text->bitmap protocol yet, so we do a simple “bitmap label”
  // using a crude built-in 5x7 font for uppercase letters + space/newline.
  // This at least produces a bitmap that *could* be accepted if CMD_IMAGE is correct.

  const lines = [
    "MORNING LIGHT",
    "WHISPERS SOFT",
    "WINTER LINGERS"
  ];

  const { width, height, bitmap } = renderTextTo1bpp(lines);

  const CMD_IMAGE = 0xA0;
  const payload = Buffer.concat([
    Buffer.from([CMD_IMAGE]),
    Buffer.from([width & 0xff, (width >> 8) & 0xff]),
    Buffer.from([height & 0xff, (height >> 8) & 0xff]),
    bitmap
  ]);

  const frame = makeFrame(payload);
  await writeChunked(frame);

  console.log("Haiku bitmap sent");
}

// ---- Tiny bitmap text renderer (crude, but self-contained) ----
// 5x7 font for A-Z, 0-9, space, dash. Rendered into 1bpp packed rows.
function renderTextTo1bpp(lines) {
  const scale = 1;     // keep small
  const charW = 5 * scale;
  const charH = 7 * scale;
  const gapX = 1 * scale;
  const gapY = 2 * scale;

  const maxLen = Math.max(...lines.map(l => l.length));
  // Make width divisible by 8 for packing
  let width = maxLen * (charW + gapX) + gapX;
  width = Math.ceil(width / 8) * 8;

  const height = lines.length * (charH + gapY) + gapY;

  const bitmap = make1bppBitmap(width, height, (x, y) => {
    // Find which line
    let cy = y - gapY;
    if (cy < 0) return 0;

    const lineIdx = Math.floor(cy / (charH + gapY));
    if (lineIdx < 0 || lineIdx >= lines.length) return 0;

    const lineTop = gapY + lineIdx * (charH + gapY);
    const localY = y - lineTop;
    if (localY < 0 || localY >= charH) return 0;

    let cx = x - gapX;
    if (cx < 0) return 0;

    const col = Math.floor(cx / (charW + gapX));
    if (col < 0 || col >= lines[lineIdx].length) return 0;

    const charLeft = gapX + col * (charW + gapX);
    const localX = x - charLeft;
    if (localX < 0 || localX >= charW) return 0;

    const ch = lines[lineIdx][col].toUpperCase();
    const glyph = FONT_5x7[ch] || FONT_5x7[" "];

    // glyph is 7 rows of 5 bits each
    const gx = Math.floor(localX / scale);
    const gy = Math.floor(localY / scale);

    const rowBits = glyph[gy] || 0;
    // bit 4 is leftmost, bit 0 rightmost
    return (rowBits & (1 << (4 - gx))) ? 1 : 0;
  });

  return { width, height, bitmap };
}

// Each entry: 7 rows, 5-bit each (MSB=left)
const FONT_5x7 = {
  " ": [0,0,0,0,0,0,0],
  "-": [0,0,0,0b11111,0,0,0],
  "0": [0b01110,0b10001,0b10011,0b10101,0b11001,0b10001,0b01110],
  "1": [0b00100,0b01100,0b00100,0b00100,0b00100,0b00100,0b01110],
  "2": [0b01110,0b10001,0b00001,0b00010,0b00100,0b01000,0b11111],
  "3": [0b11110,0b00001,0b00001,0b01110,0b00001,0b00001,0b11110],
  "4": [0b00010,0b00110,0b01010,0b10010,0b11111,0b00010,0b00010],
  "5": [0b11111,0b10000,0b10000,0b11110,0b00001,0b00001,0b11110],
  "6": [0b01110,0b10000,0b10000,0b11110,0b10001,0b10001,0b01110],
  "7": [0b11111,0b00001,0b00010,0b00100,0b01000,0b01000,0b01000],
  "8": [0b01110,0b10001,0b10001,0b01110,0b10001,0b10001,0b01110],
  "9": [0b01110,0b10001,0b10001,0b01111,0b00001,0b00001,0b01110],
  "A": [0b01110,0b10001,0b10001,0b11111,0b10001,0b10001,0b10001],
  "B": [0b11110,0b10001,0b10001,0b11110,0b10001,0b10001,0b11110],
  "C": [0b01110,0b10001,0b10000,0b10000,0b10000,0b10001,0b01110],
  "D": [0b11110,0b10001,0b10001,0b10001,0b10001,0b10001,0b11110],
  "E": [0b11111,0b10000,0b10000,0b11110,0b10000,0b10000,0b11111],
  "F": [0b11111,0b10000,0b10000,0b11110,0b10000,0b10000,0b10000],
  "G": [0b01110,0b10001,0b10000,0b10111,0b10001,0b10001,0b01110],
  "H": [0b10001,0b10001,0b10001,0b11111,0b10001,0b10001,0b10001],
  "I": [0b01110,0b00100,0b00100,0b00100,0b00100,0b00100,0b01110],
  "J": [0b00001,0b00001,0b00001,0b00001,0b10001,0b10001,0b01110],
  "K": [0b10001,0b10010,0b10100,0b11000,0b10100,0b10010,0b10001],
  "L": [0b10000,0b10000,0b10000,0b10000,0b10000,0b10000,0b11111],
  "M": [0b10001,0b11011,0b10101,0b10101,0b10001,0b10001,0b10001],
  "N": [0b10001,0b11001,0b10101,0b10011,0b10001,0b10001,0b10001],
  "O": [0b01110,0b10001,0b10001,0b10001,0b10001,0b10001,0b01110],
  "P": [0b11110,0b10001,0b10001,0b11110,0b10000,0b10000,0b10000],
  "Q": [0b01110,0b10001,0b10001,0b10001,0b10101,0b10010,0b01101],
  "R": [0b11110,0b10001,0b10001,0b11110,0b10100,0b10010,0b10001],
  "S": [0b01111,0b10000,0b10000,0b01110,0b00001,0b00001,0b11110],
  "T": [0b11111,0b00100,0b00100,0b00100,0b00100,0b00100,0b00100],
  "U": [0b10001,0b10001,0b10001,0b10001,0b10001,0b10001,0b01110],
  "V": [0b10001,0b10001,0b10001,0b10001,0b10001,0b01010,0b00100],
  "W": [0b10001,0b10001,0b10001,0b10101,0b10101,0b10101,0b01010],
  "X": [0b10001,0b10001,0b01010,0b00100,0b01010,0b10001,0b10001],
  "Y": [0b10001,0b10001,0b01010,0b00100,0b00100,0b00100,0b00100],
  "Z": [0b11111,0b00001,0b00010,0b00100,0b01000,0b10000,0b11111],
};
