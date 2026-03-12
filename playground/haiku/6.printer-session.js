// printer-session.js
// Node 20+ (ESM). Run: node 6.printer-session.js
import noble from '@abandonware/noble';
import readline from 'readline';

const TARGET = '48:0f:57:c5:78:9d';
const CONTROL_UUID = 'ae01';
const NOTIFY_UUID = 'ae02';
const DATA_UUID = 'ae03';

const PRINTER_WIDTH = 384;
const PRINTER_WIDTH_BYTES = PRINTER_WIDTH / 8; // 48
const MIN_DATA_BYTES = 90 * PRINTER_WIDTH_BYTES; // 4320
const DEFAULT_INTENSITY = 0x5d;
const DEFAULT_THRESHOLD = 150;
const FALLBACK_TEXT_SCALE = 4;

const Command = {
  GetStatus: 0xa1,
  SetIntensity: 0xa2,
  PrintRequest: 0xa9,
  FlushData: 0xad,
  PrintComplete: 0xaa,
};

let controlChar;
let dataChar;
let notifyChar;
let peripheral;
let printComplete = false;

const pendingResponses = new Map();
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function help() {
  console.log('\nCommands:');
  console.log('  status                 -> request printer status');
  console.log('  text <message>         -> print plain text');
  console.log('  haiku                  -> print sample haiku');
  console.log('  haiku-hebrew           -> print sample Hebrew haiku');
  console.log('  image <file-path>      -> print an image from disk');
  console.log('  rect                   -> print rectangle test pattern');
  console.log('  exit                   -> disconnect and quit\n');
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---- BLE lifecycle ----
noble.on('stateChange', async (state) => {
  if (state === 'poweredOn') {
    console.log('Scanning...');
    await noble.startScanningAsync([], false);
  } else {
    try {
      await noble.stopScanningAsync();
    } catch {}
  }
});

noble.on('discover', async (p) => {
  if ((p.address || '').toLowerCase() !== TARGET.toLowerCase()) return;

  peripheral = p;
  await noble.stopScanningAsync();
  await peripheral.connectAsync();
  console.log('Connected to printer');

  const { characteristics } = await peripheral.discoverAllServicesAndCharacteristicsAsync();
  controlChar = characteristics.find((c) => c.uuid === CONTROL_UUID);
  notifyChar = characteristics.find((c) => c.uuid === NOTIFY_UUID);
  dataChar = characteristics.find((c) => c.uuid === DATA_UUID);

  if (!controlChar || !notifyChar || !dataChar) {
    console.error(
      `Missing required characteristics. control=${!!controlChar} notify=${!!notifyChar} data=${!!dataChar}`
    );
    process.exit(1);
  }

  await notifyChar.subscribeAsync();
  notifyChar.on('data', (data) => {
    const parsed = parseNotification(new Uint8Array(data));
    console.log('\nNotify:', data.toString('hex'));

    if (parsed) {
      if (parsed.cmdId === Command.PrintComplete) {
        printComplete = true;
      }

      const resolver = pendingResponses.get(parsed.cmdId);
      if (resolver) {
        pendingResponses.delete(parsed.cmdId);
        resolver(parsed.payload);
      }
    }

    rl.prompt(true);
  });

  help();
  console.log('Ready.');
  rl.setPrompt('> ');
  rl.prompt();
  promptLoop();
});

process.on('SIGINT', async () => {
  console.log('\nDisconnecting...');
  try {
    if (peripheral) await peripheral.disconnectAsync();
  } catch {}
  process.exit(0);
});

function promptLoop() {
  rl.on('line', async (line) => {
    const trimmed = line.trim();
    const [cmdRaw, ...rest] = trimmed.split(' ');
    const cmd = (cmdRaw || '').toLowerCase();
    const arg = rest.join(' ').trim();

    try {
      if (!cmd) {
        // noop
      } else if (cmd === 'status') {
        await printStatus();
      } else if (cmd === 'text') {
        await printText(arg || 'Hello from MXW01');
      } else if (cmd === 'haiku') {
        await printText('Morning light whispers\nInk blooms on quiet paper\nWinter breath lingers');
      } else if (cmd === 'haiku-hebrew') {
        await printHebrewHaiku();
      } else if (cmd === 'image') {
        if (!arg) throw new Error('Usage: image <file-path>');
        await printImage(arg);
      } else if (cmd === 'rect') {
        await printRectangle();
      } else if (cmd === 'exit') {
        await peripheral.disconnectAsync();
        process.exit(0);
      } else {
        help();
      }
    } catch (e) {
      console.error('Command error:', e?.message || e);
    }

    rl.prompt();
  });
}

// ---- MXW01 protocol helpers ----
function crc8(data) {
  let crc = 0;
  for (const byte of data) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x80 ? (crc << 1) ^ 0x07 : crc << 1;
      crc &= 0xff;
    }
  }
  return crc;
}

function makeCommand(cmd, payload) {
  const len = payload.length;
  const frame = new Uint8Array(6 + len + 2);
  frame[0] = 0x22;
  frame[1] = 0x21;
  frame[2] = cmd;
  frame[3] = 0x00;
  frame[4] = len & 0xff;
  frame[5] = (len >> 8) & 0xff;
  frame.set(payload, 6);
  frame[6 + len] = crc8(payload);
  frame[7 + len] = 0xff;
  return frame;
}

function parseNotification(message) {
  if (message.length < 6) return null;
  if (message[0] !== 0x22 || message[1] !== 0x21) return null;

  const cmdId = message[2];
  const len = message[4] | (message[5] << 8);
  if (message.length < 6 + len) return null;

  return {
    cmdId,
    payload: message.slice(6, 6 + len),
  };
}

function waitForNotification(cmdId, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingResponses.delete(cmdId);
      reject(new Error(`Timeout waiting for notification 0x${cmdId.toString(16)}`));
    }, timeoutMs);

    pendingResponses.set(cmdId, (payload) => {
      clearTimeout(timeout);
      resolve(payload);
    });
  });
}

async function writeControl(data) {
  await controlChar.writeAsync(Buffer.from(data), true);
}

async function writeData(data) {
  await dataChar.writeAsync(Buffer.from(data), true);
}

async function sendControlCommand(cmd, payload = Uint8Array.of()) {
  await writeControl(makeCommand(cmd, payload));
}

async function requestStatus() {
  await sendControlCommand(Command.GetStatus, Uint8Array.of(0x00));
  return waitForNotification(Command.GetStatus, 5000);
}

async function setIntensity(intensity = DEFAULT_INTENSITY) {
  await sendControlCommand(Command.SetIntensity, Uint8Array.of(intensity));
  await delay(50);
}

async function sendPrintRequest(lines, mode = 0) {
  const payload = new Uint8Array(4);
  payload[0] = lines & 0xff;
  payload[1] = (lines >> 8) & 0xff;
  payload[2] = 0x30;
  payload[3] = mode;

  await sendControlCommand(Command.PrintRequest, payload);
  return waitForNotification(Command.PrintRequest, 5000);
}

async function flushData() {
  await sendControlCommand(Command.FlushData, Uint8Array.of(0x00));
  await delay(50);
}

async function waitForPrintComplete(timeoutMs = 20000) {
  printComplete = false;
  const start = Date.now();

  while (!printComplete && Date.now() - start < timeoutMs) {
    await delay(100);
  }

  if (!printComplete) {
    throw new Error('Print timeout: no print-complete notification');
  }
}

// ---- Unified print pipeline ----
function createBlankRows(height) {
  return Array.from({ length: height }, () => new Uint8Array(PRINTER_WIDTH_BYTES));
}

function setRowPixel(rows, x, y) {
  if (x < 0 || y < 0 || y >= rows.length || x >= PRINTER_WIDTH) return;
  rows[y][x >> 3] |= 1 << (x & 7);
}

function getRowPixel(rows, x, y) {
  if (x < 0 || y < 0 || y >= rows.length || x >= PRINTER_WIDTH) return 0;
  return (rows[y][x >> 3] >> (x & 7)) & 1;
}

function rotateRows180(rows) {
  const height = rows.length;
  const rotated = createBlankRows(height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < PRINTER_WIDTH; x++) {
      if (getRowPixel(rows, x, y)) {
        setRowPixel(rotated, PRINTER_WIDTH - 1 - x, height - 1 - y);
      }
    }
  }

  return rotated;
}

function canvasToRows(canvas, threshold = DEFAULT_THRESHOLD) {
  const width = canvas.width;
  const height = canvas.height;
  if (width !== PRINTER_WIDTH) {
    throw new Error(`Canvas width must be ${PRINTER_WIDTH}, got ${width}`);
  }

  const ctx = canvas.getContext('2d');
  const rgba = ctx.getImageData(0, 0, width, height).data;
  const rows = [];

  for (let y = 0; y < height; y++) {
    const row = new Uint8Array(PRINTER_WIDTH_BYTES);
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const alpha = rgba[i + 3] / 255;
      const gray = rgba[i] * 0.299 + rgba[i + 1] * 0.587 + rgba[i + 2] * 0.114;
      const blended = gray * alpha + 255 * (1 - alpha);
      const black = blended < threshold;

      // MXW01 uses LSB-first packing in each byte.
      if (black) row[x >> 3] |= 1 << (x & 7);
    }
    rows.push(row);
  }

  return rows;
}

function rotateCanvas180(source, createCanvas) {
  const canvas = createCanvas(source.width, source.height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.translate(canvas.width, canvas.height);
  ctx.rotate(Math.PI);
  ctx.drawImage(source, 0, 0);
  return canvas;
}

let canvasModulePromise = null;

async function getCanvasModule() {
  if (!canvasModulePromise) {
    canvasModulePromise = import('canvas')
      .then((mod) => ({ createCanvas: mod.createCanvas, loadImage: mod.loadImage }))
      .catch((error) => {
        canvasModulePromise = null;
        const reason = error?.message || String(error);
        throw new Error(
          `Canvas failed to load (${reason}). Text and rect work without canvas; image printing needs a working canvas/cairo install.`
        );
      });
  }
  return canvasModulePromise;
}

function rowsToPaddedBuffer(rows) {
  const dataSize = rows.length * PRINTER_WIDTH_BYTES;
  const out = new Uint8Array(Math.max(dataSize, MIN_DATA_BYTES));

  let offset = 0;
  for (const row of rows) {
    out.set(row, offset);
    offset += PRINTER_WIDTH_BYTES;
  }

  return out;
}

async function printRows(rows) {
  if (!rows.length) throw new Error('Nothing to print');

  const numLines = rows.length;
  const imageBuffer = rowsToPaddedBuffer(rows);

  await setIntensity(DEFAULT_INTENSITY);

  const status = await requestStatus();
  console.log('Status payload:', Buffer.from(status).toString('hex'));

  const ack = await sendPrintRequest(numLines, 0);
  console.log('Print request ACK:', Buffer.from(ack).toString('hex'));
  if (!ack || ack.length === 0 || ack[0] !== 0) {
    throw new Error('Print request rejected');
  }

  for (let i = 0; i < imageBuffer.length; i += PRINTER_WIDTH_BYTES) {
    await writeData(imageBuffer.slice(i, i + PRINTER_WIDTH_BYTES));
    await delay(15);
  }

  await flushData();
  await waitForPrintComplete();
}

async function printCanvas(canvas, createCanvas) {
  const oriented = rotateCanvas180(canvas, createCanvas);
  const rows = canvasToRows(oriented, DEFAULT_THRESHOLD);
  await printRows(rows);
}

// ---- Text / shape renderers (canvas-free) ----
function wrapTextLinesByChars(text, maxChars) {
  const inputLines = text.split('\n');
  const output = [];

  for (const raw of inputLines) {
    const words = raw.trim().split(/\s+/).filter(Boolean);
    if (!words.length) {
      output.push('');
      continue;
    }

    let line = words[0];
    for (let i = 1; i < words.length; i++) {
      const candidate = `${line} ${words[i]}`;
      if (candidate.length <= maxChars) {
        line = candidate;
      } else {
        output.push(line);
        line = words[i];
      }
    }
    output.push(line);
  }

  return output;
}

function sanitizeTextLine(line) {
  return line.toUpperCase().replace(/[^A-Z0-9 .,!?:;'"-]/g, ' ');
}

function drawGlyph(rows, glyph, x, y, scale) {
  for (let gy = 0; gy < 7; gy++) {
    const bits = glyph[gy] || 0;
    for (let gx = 0; gx < 5; gx++) {
      if ((bits & (1 << (4 - gx))) === 0) continue;
      for (let sy = 0; sy < scale; sy++) {
        for (let sx = 0; sx < scale; sx++) {
          setRowPixel(rows, x + gx * scale + sx, y + gy * scale + sy);
        }
      }
    }
  }
}

function textToRows(text) {
  const scale = FALLBACK_TEXT_SCALE;
  const charW = 5 * scale;
  const charH = 7 * scale;
  const gapX = scale;
  const gapY = scale + 2;
  const paddingX = 16;
  const paddingY = 12;
  const maxChars = Math.max(1, Math.floor((PRINTER_WIDTH - paddingX * 2 + gapX) / (charW + gapX)));

  const wrapped = wrapTextLinesByChars(text, maxChars)
    .map(sanitizeTextLine)
    .flatMap((line) => (line.length ? [line] : [' ']));
  const lines = wrapped.length ? wrapped : [' '];

  const lineHeight = charH + gapY;
  const height = Math.max(120, paddingY * 2 + lines.length * lineHeight);
  const rows = createBlankRows(height);

  for (let i = 0; i < lines.length; i++) {
    const y = paddingY + i * lineHeight;
    const line = lines[i];
    for (let j = 0; j < line.length; j++) {
      const x = paddingX + j * (charW + gapX);
      const glyph = FONT_5X7[line[j]] || FONT_5X7[' '];
      drawGlyph(rows, glyph, x, y, scale);
    }
  }

  return rows;
}

function rectangleRows() {
  const height = 180;
  const rows = createBlankRows(height);
  const insetX = 24;
  const insetY = 24;
  const stroke = 3;
  const left = insetX;
  const right = PRINTER_WIDTH - insetX - 1;
  const top = insetY;
  const bottom = height - insetY - 1;

  for (let y = top; y <= bottom; y++) {
    for (let x = left; x <= right; x++) {
      if (x - left < stroke || right - x < stroke || y - top < stroke || bottom - y < stroke) {
        setRowPixel(rows, x, y);
      }
    }
  }

  return rows;
}

async function imageToCanvas(filePath) {
  const { createCanvas, loadImage } = await getCanvasModule();
  const img = await loadImage(filePath);
  const scale = PRINTER_WIDTH / img.width;
  const targetHeight = Math.max(1, Math.round(img.height * scale));

  const canvas = createCanvas(PRINTER_WIDTH, targetHeight);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, PRINTER_WIDTH, targetHeight);

  return { canvas, createCanvas };
}

// ---- User commands ----
async function printStatus() {
  const status = await requestStatus();
  console.log('Status:', Buffer.from(status).toString('hex'));
}

async function printText(text) {
  console.log('Printing text...');
  await printRows(rotateRows180(textToRows(text)));
  console.log('Text print sent');
}

async function printRectangle() {
  console.log('Printing rectangle...');
  await printRows(rotateRows180(rectangleRows()));
  console.log('Rectangle print sent');
}

async function printHebrewHaiku() {
  console.log('Printing Hebrew haiku...');
  await printRows(rotateRows180(hebrewHaikuRows()));
  console.log('Hebrew haiku print sent');
}

async function printImage(filePath) {
  console.log(`Printing image: ${filePath}`);
  const { canvas, createCanvas } = await imageToCanvas(filePath);
  await printCanvas(canvas, createCanvas);
  console.log('Image print sent');
}

const HEBREW_HAIKU_LINES = ['אור בא לאט', 'רוח קלה עולה', 'לב שקט נרגע'];

function sanitizeHebrewLine(line) {
  return [...line].map((char) => (HEBREW_FONT_5X7[char] ? char : ' ')).join('');
}

function hebrewHaikuRows() {
  const scale = FALLBACK_TEXT_SCALE;
  const charW = 5 * scale;
  const charH = 7 * scale;
  const gapX = scale;
  const gapY = scale + 2;
  const paddingX = 16;
  const paddingY = 12;

  const lines = HEBREW_HAIKU_LINES.map(sanitizeHebrewLine);
  const lineHeight = charH + gapY;
  const height = Math.max(120, paddingY * 2 + lines.length * lineHeight);
  const rows = createBlankRows(height);

  for (let i = 0; i < lines.length; i++) {
    const y = paddingY + i * lineHeight;
    const chars = [...lines[i]];
    const rightX = PRINTER_WIDTH - paddingX - charW;

    for (let j = 0; j < chars.length; j++) {
      const x = rightX - j * (charW + gapX);
      if (x < paddingX - charW) break;
      const glyph = HEBREW_FONT_5X7[chars[j]] || HEBREW_FONT_5X7[' '];
      drawGlyph(rows, glyph, x, y, scale);
    }
  }

  return rows;
}

const HEBREW_FONT_5X7 = {
  ' ': [0, 0, 0, 0, 0, 0, 0],
  'א': [0b10001, 0b01010, 0b00100, 0b01010, 0b10001, 0b10001, 0b10001],
  'ב': [0b11110, 0b10000, 0b10000, 0b11110, 0b10001, 0b10001, 0b11110],
  'ג': [0b11111, 0b00001, 0b00001, 0b00001, 0b00001, 0b10001, 0b01110],
  'ה': [0b11111, 0b10001, 0b10001, 0b11111, 0b10000, 0b10000, 0b10000],
  'ו': [0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100],
  'ח': [0b10001, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  'ט': [0b01110, 0b10001, 0b10111, 0b10101, 0b10101, 0b10001, 0b01110],
  'ל': [0b00111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100],
  'נ': [0b10001, 0b11001, 0b10101, 0b10011, 0b10001, 0b10001, 0b10001],
  'ע': [0b10001, 0b10001, 0b10001, 0b01110, 0b00100, 0b01010, 0b10001],
  'ק': [0b01110, 0b10001, 0b10001, 0b10101, 0b10010, 0b10001, 0b00001],
  'ר': [0b11111, 0b00001, 0b00001, 0b00001, 0b00001, 0b00001, 0b00001],
  'ש': [0b10101, 0b10101, 0b10101, 0b10101, 0b10101, 0b10101, 0b01110],
};

// Each glyph is 7 rows of 5 bits (bit 4 is left-most pixel).
const FONT_5X7 = {
  ' ': [0, 0, 0, 0, 0, 0, 0],
  '!': [0b00100, 0b00100, 0b00100, 0b00100, 0, 0, 0b00100],
  "'": [0b00100, 0b00100, 0b01000, 0, 0, 0, 0],
  ',': [0, 0, 0, 0, 0b00100, 0b00100, 0b01000],
  '-': [0, 0, 0, 0b11111, 0, 0, 0],
  '.': [0, 0, 0, 0, 0, 0, 0b00100],
  '0': [0b01110, 0b10001, 0b10011, 0b10101, 0b11001, 0b10001, 0b01110],
  '1': [0b00100, 0b01100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  '2': [0b01110, 0b10001, 0b00001, 0b00010, 0b00100, 0b01000, 0b11111],
  '3': [0b11110, 0b00001, 0b00001, 0b01110, 0b00001, 0b00001, 0b11110],
  '4': [0b00010, 0b00110, 0b01010, 0b10010, 0b11111, 0b00010, 0b00010],
  '5': [0b11111, 0b10000, 0b10000, 0b11110, 0b00001, 0b00001, 0b11110],
  '6': [0b01110, 0b10000, 0b10000, 0b11110, 0b10001, 0b10001, 0b01110],
  '7': [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b01000, 0b01000],
  '8': [0b01110, 0b10001, 0b10001, 0b01110, 0b10001, 0b10001, 0b01110],
  '9': [0b01110, 0b10001, 0b10001, 0b01111, 0b00001, 0b00001, 0b01110],
  ':': [0, 0b00100, 0, 0, 0b00100, 0, 0],
  ';': [0, 0b00100, 0, 0, 0b00100, 0b00100, 0b01000],
  '?': [0b01110, 0b10001, 0b00001, 0b00010, 0b00100, 0, 0b00100],
  'A': [0b01110, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  'B': [0b11110, 0b10001, 0b10001, 0b11110, 0b10001, 0b10001, 0b11110],
  'C': [0b01110, 0b10001, 0b10000, 0b10000, 0b10000, 0b10001, 0b01110],
  'D': [0b11110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b11110],
  'E': [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b11111],
  'F': [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b10000],
  'G': [0b01110, 0b10001, 0b10000, 0b10111, 0b10001, 0b10001, 0b01110],
  'H': [0b10001, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  'I': [0b01110, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  'J': [0b00001, 0b00001, 0b00001, 0b00001, 0b10001, 0b10001, 0b01110],
  'K': [0b10001, 0b10010, 0b10100, 0b11000, 0b10100, 0b10010, 0b10001],
  'L': [0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b11111],
  'M': [0b10001, 0b11011, 0b10101, 0b10101, 0b10001, 0b10001, 0b10001],
  'N': [0b10001, 0b11001, 0b10101, 0b10011, 0b10001, 0b10001, 0b10001],
  'O': [0b01110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  'P': [0b11110, 0b10001, 0b10001, 0b11110, 0b10000, 0b10000, 0b10000],
  'Q': [0b01110, 0b10001, 0b10001, 0b10001, 0b10101, 0b10010, 0b01101],
  'R': [0b11110, 0b10001, 0b10001, 0b11110, 0b10100, 0b10010, 0b10001],
  'S': [0b01111, 0b10000, 0b10000, 0b01110, 0b00001, 0b00001, 0b11110],
  'T': [0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100],
  'U': [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  'V': [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01010, 0b00100],
  'W': [0b10001, 0b10001, 0b10001, 0b10101, 0b10101, 0b10101, 0b01010],
  'X': [0b10001, 0b10001, 0b01010, 0b00100, 0b01010, 0b10001, 0b10001],
  'Y': [0b10001, 0b10001, 0b01010, 0b00100, 0b00100, 0b00100, 0b00100],
  'Z': [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b10000, 0b11111],
};
