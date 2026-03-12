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
const MIN_DATA_LINES = 24;
const MIN_DATA_BYTES = MIN_DATA_LINES * PRINTER_WIDTH_BYTES;
const DEFAULT_INTENSITY = 0x5d;
const DEFAULT_THRESHOLD = 150;
const DEFAULT_LINE_GAP = 10;
const FEED_LINES_BEFORE_PRINT = 2;
const FEED_LINES_AFTER_PRINT = 3;
const COMPACT_FONT_SCALE_MULTIPLIER = 0.8;
const ACTIVE_FONT_BASE_SCALE = 1.8;
const FONT_VARIANTS = {
  normal: {
    scaleMultiplier: 1,
    paddingX: 14,
    paddingY: 8,
    minHeight: 72,
  },
  compact: {
    scaleMultiplier: COMPACT_FONT_SCALE_MULTIPLIER,
    paddingX: 12,
    paddingY: 6,
    minHeight: 56,
  },
};

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
  console.log('  text <message>         -> print plain text (normal font)');
  console.log('  text-gap <gap> <msg>   -> print text with custom line gap');
  console.log('  text-small <message>   -> print plain text (compact font)');
  console.log('  haiku                  -> print sample haiku');
  console.log('  haiku-small            -> print sample haiku (compact font)');
  console.log('  haiku-hebrew           -> print sample Hebrew haiku');
  console.log('  haiku-hebrew-small     -> print sample Hebrew haiku (compact font)');
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
        await printText(arg || 'Hello from MXW01', { variant: 'normal' });
      } else if (cmd === 'text-gap') {
        const [gapToken, ...messageParts] = arg.split(' ');
        const lineGap = Number(gapToken);
        if (!Number.isFinite(lineGap)) {
          throw new Error('Usage: text-gap <gap> <message>');
        }
        await printText(messageParts.join(' ').trim() || 'Hello from MXW01', {
          variant: 'normal',
          lineGap,
        });
      } else if (cmd === 'text-small') {
        await printText(arg || 'Hello from MXW01', { variant: 'compact' });
      } else if (cmd === 'haiku') {
        await printText(
          'Morning light whispers\nInk blooms on quiet paper\nWinter breath lingers',
          {
            variant: 'normal',
          }
        );
      } else if (cmd === 'haiku-small') {
        await printText(
          'Morning light whispers\nInk blooms on quiet paper\nWinter breath lingers',
          {
            variant: 'compact',
          }
        );
      } else if (cmd === 'haiku-hebrew') {
        await printHebrewHaiku({ variant: 'normal' });
      } else if (cmd === 'haiku-hebrew-small') {
        await printHebrewHaiku({ variant: 'compact' });
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

function withFeedRows(
  rows,
  beforeLines = FEED_LINES_BEFORE_PRINT,
  afterLines = FEED_LINES_AFTER_PRINT
) {
  const safeBefore = Math.max(0, Math.floor(beforeLines));
  const safeAfter = Math.max(0, Math.floor(afterLines));
  const out = [];

  for (let i = 0; i < safeBefore; i++) {
    out.push(new Uint8Array(PRINTER_WIDTH_BYTES));
  }

  out.push(...rows);

  for (let i = 0; i < safeAfter; i++) {
    out.push(new Uint8Array(PRINTER_WIDTH_BYTES));
  }

  return out;
}

async function printRows(rows) {
  if (!rows.length) throw new Error('Nothing to print');

  const fedRows = withFeedRows(rows);
  const numLines = fedRows.length;
  const imageBuffer = rowsToPaddedBuffer(fedRows);

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

function isHebrewText(text) {
  return /[\u0590-\u05ff]/.test(String(text ?? ''));
}

function sanitizeTextLine(line) {
  return [...String(line ?? '').toUpperCase()]
    .map((char) => (ACTIVE_FONT[char] ? char : ' '))
    .join('');
}

function isGlyphPixelOn(glyph, glyphWidth, x, y) {
  if (x < 0 || y < 0 || y >= glyph.length) return false;
  const bits = glyph[y] || 0;
  return (bits & (1 << (glyphWidth - 1 - x))) !== 0;
}

function drawGlyph(rows, glyph, x, y, glyphWidth, glyphHeight, scale) {
  const drawW = Math.max(1, Math.round(glyphWidth * scale));
  const drawH = Math.max(1, Math.round(glyphHeight * scale));

  for (let dy = 0; dy < drawH; dy++) {
    const sy = Math.min(glyphHeight - 1, Math.floor(dy / scale));
    for (let dx = 0; dx < drawW; dx++) {
      const sx = Math.min(glyphWidth - 1, Math.floor(dx / scale));
      if (!isGlyphPixelOn(glyph, glyphWidth, sx, sy)) continue;
      setRowPixel(rows, x + dx, y + dy);
    }
  }
}

function textToRows(text, options = {}) {
  const safeText = String(text ?? '');
  const { variant = 'normal', direction = 'auto', lineGap = DEFAULT_LINE_GAP } = options;
  const fontVariant = FONT_VARIANTS[variant] || FONT_VARIANTS.normal;
  const scale = Math.max(0.1, ACTIVE_FONT_BASE_SCALE * fontVariant.scaleMultiplier);
  const charW = Math.max(1, Math.round(ACTIVE_FONT_WIDTH * scale));
  const charH = Math.max(1, Math.round(ACTIVE_FONT_HEIGHT * scale));
  const gapX = Math.max(1, Math.round(scale * 0.75));
  const resolvedLineGap = Math.max(0, Math.round(lineGap));
  const paddingX = fontVariant.paddingX;
  const paddingY = fontVariant.paddingY;
  const maxChars = Math.max(1, Math.floor((PRINTER_WIDTH - paddingX * 2 + gapX) / (charW + gapX)));
  const rtl = direction === 'rtl' || (direction === 'auto' && isHebrewText(safeText));

  const wrapped = wrapTextLinesByChars(safeText, maxChars)
    .map(sanitizeTextLine)
    .flatMap((line) => (line.length ? [line] : [' ']));
  const lines = wrapped.length ? wrapped : [' '];

  const lineHeight = charH + resolvedLineGap;
  const height = Math.max(fontVariant.minHeight, paddingY * 2 + lines.length * lineHeight);
  const rows = createBlankRows(height);

  for (let i = 0; i < lines.length; i++) {
    const y = paddingY + i * lineHeight;
    const line = lines[i];

    if (rtl) {
      const chars = [...line];
      const rightX = PRINTER_WIDTH - paddingX - charW;

      for (let j = 0; j < chars.length; j++) {
        const x = rightX - j * (charW + gapX);
        if (x < paddingX - charW) break;
        const glyph = ACTIVE_FONT[chars[j]] || ACTIVE_FONT[' '];
        drawGlyph(rows, glyph, x, y, ACTIVE_FONT_WIDTH, ACTIVE_FONT_HEIGHT, scale);
      }
      continue;
    }

    for (let j = 0; j < line.length; j++) {
      const x = paddingX + j * (charW + gapX);
      const glyph = ACTIVE_FONT[line[j]] || ACTIVE_FONT[' '];
      drawGlyph(rows, glyph, x, y, ACTIVE_FONT_WIDTH, ACTIVE_FONT_HEIGHT, scale);
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

async function printText(text, options = {}) {
  console.log('Printing text...');
  const safeText = String(text ?? '');
  const { variant = 'normal', direction = 'auto', lineGap = DEFAULT_LINE_GAP } = options;
  const rows = textToRows(safeText, { variant, direction, lineGap });
  await printRows(rotateRows180(rows));
  console.log('Text print sent');
}

async function printRectangle() {
  console.log('Printing rectangle...');
  await printRows(rotateRows180(rectangleRows()));
  console.log('Rectangle print sent');
}

async function printHebrewHaiku(options = {}) {
  console.log('Printing Hebrew haiku...');
  const { variant = 'normal', lineGap = DEFAULT_LINE_GAP } = options;
  const rows = textToRows(HEBREW_HAIKU_LINES.join('\n'), { direction: 'rtl', variant, lineGap });
  await printRows(rotateRows180(rows));
  console.log('Hebrew haiku print sent');
}

async function printImage(filePath) {
  console.log(`Printing image: ${filePath}`);
  const { canvas, createCanvas } = await imageToCanvas(filePath);
  await printCanvas(canvas, createCanvas);
  console.log('Image print sent');
}

const HEBREW_HAIKU_LINES = ['צופר אדום', 'האבן מחזיקה נשימה', 'השמים רחוקים.'];

/*
// FONT_5X7 kept for later fallback experiments.
// Each glyph is 7 rows of 5 bits (bit 4 is left-most pixel).
const FONT_5X7 = {
  0: [0b01110, 0b11011, 0b10001, 0b10001, 0b10001, 0b11011, 0b01110],
  1: [0b01111, 0b11111, 0b00011, 0b00011, 0b00011, 0b00011, 0b00011],
  2: [0b11111, 0b10011, 0b00011, 0b01111, 0b11100, 0b11000, 0b11111],
  3: [0b11110, 0b00110, 0b01110, 0b00011, 0b00001, 0b00111, 0b11110],
  4: [0b00100, 0b01100, 0b01000, 0b11010, 0b11111, 0b11111, 0b00010],
  5: [0b11111, 0b11000, 0b11110, 0b01011, 0b00001, 0b00111, 0b11110],
  6: [0b01111, 0b11000, 0b11110, 0b11011, 0b10001, 0b11011, 0b01110],
  7: [0b11111, 0b00011, 0b00110, 0b00100, 0b01100, 0b01100, 0b01100],
  8: [0b01110, 0b11011, 0b11111, 0b11111, 0b10001, 0b10001, 0b01111],
  9: [0b01110, 0b11011, 0b10001, 0b11011, 0b01111, 0b00011, 0b11110],
  ' ': [0b00000, 0b00000, 0b00000, 0b00000, 0b00000, 0b00000, 0b00000],
  '!': [0b11111, 0b01111, 0b01111, 0b01111, 0b00110, 0b00000, 0b01111],
  "'": [0b01111, 0b11111, 0b01111, 0b01111, 0b01110, 0b11100, 0b11100],
  ',': [0b11111, 0b11111, 0b01111, 0b01111, 0b01110, 0b11110, 0b11100],
  '-': [0b11111, 0b11111, 0b11111, 0b11111, 0b11111, 0b11111, 0b11111],
  '.': [0b01110, 0b11111, 0b11111, 0b11111, 0b11111, 0b11111, 0b01110],
  ':': [0b11111, 0b11111, 0b00000, 0b00000, 0b00000, 0b11111, 0b11111],
  ';': [0b11111, 0b01111, 0b00000, 0b00000, 0b01111, 0b01111, 0b11100],
  '?': [0b11111, 0b00011, 0b00011, 0b01110, 0b01100, 0b00000, 0b01100],
  A: [0b00100, 0b01110, 0b01010, 0b01010, 0b01111, 0b10001, 0b10001],
  B: [0b11110, 0b10011, 0b10011, 0b11111, 0b10001, 0b10001, 0b11111],
  C: [0b01111, 0b11000, 0b10000, 0b10000, 0b10000, 0b11000, 0b01111],
  D: [0b11110, 0b10011, 0b10001, 0b10001, 0b10001, 0b10011, 0b11110],
  E: [0b11111, 0b10000, 0b11110, 0b11110, 0b10000, 0b10000, 0b11111],
  F: [0b11111, 0b10000, 0b11110, 0b11110, 0b10000, 0b10000, 0b10000],
  G: [0b01111, 0b11000, 0b10000, 0b10011, 0b10001, 0b11001, 0b01111],
  H: [0b10001, 0b10001, 0b11111, 0b11111, 0b10001, 0b10001, 0b10001],
  I: [0b11111, 0b11111, 0b11111, 0b11111, 0b11111, 0b11111, 0b11111],
  J: [0b00111, 0b00111, 0b00111, 0b00111, 0b00111, 0b00111, 0b11110],
  K: [0b10011, 0b10010, 0b10100, 0b11100, 0b11100, 0b10110, 0b10011],
  L: [0b11000, 0b11000, 0b11000, 0b11000, 0b11000, 0b11000, 0b11111],
  M: [0b11011, 0b11011, 0b11011, 0b11011, 0b11111, 0b10101, 0b10101],
  N: [0b11001, 0b11001, 0b11101, 0b10101, 0b10111, 0b10011, 0b10011],
  O: [0b01110, 0b11011, 0b10001, 0b10001, 0b10001, 0b11011, 0b01110],
  P: [0b11111, 0b10001, 0b10001, 0b11111, 0b10000, 0b10000, 0b10000],
  Q: [0b01110, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110, 0b00011],
  R: [0b11110, 0b10011, 0b10011, 0b11110, 0b10110, 0b10010, 0b10011],
  S: [0b11111, 0b10000, 0b11000, 0b01111, 0b00001, 0b00011, 0b11111],
  T: [0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100],
  U: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  V: [0b10001, 0b11011, 0b11011, 0b01010, 0b01110, 0b01110, 0b00100],
  W: [0b10101, 0b10101, 0b11111, 0b11011, 0b11011, 0b11011, 0b11011],
  X: [0b10001, 0b11010, 0b01110, 0b00100, 0b01110, 0b01011, 0b10001],
  Y: [0b10001, 0b01010, 0b01110, 0b00100, 0b00100, 0b00100, 0b00100],
  Z: [0b11111, 0b00011, 0b00110, 0b00100, 0b01100, 0b11000, 0b11111],
  א: [0b10011, 0b11001, 0b11011, 0b11111, 0b10110, 0b10011, 0b10001],
  ב: [0b11110, 0b01110, 0b00010, 0b00010, 0b00010, 0b00010, 0b11111],
  ג: [0b01110, 0b00110, 0b00110, 0b00110, 0b00111, 0b01111, 0b11011],
  ד: [0b11111, 0b01111, 0b00010, 0b00010, 0b00010, 0b00010, 0b00010],
  ה: [0b11110, 0b01111, 0b00001, 0b10001, 0b10001, 0b10001, 0b10001],
  ו: [0b11111, 0b00111, 0b00111, 0b00111, 0b00111, 0b00111, 0b00111],
  ז: [0b11111, 0b01111, 0b00110, 0b00110, 0b00110, 0b00110, 0b00110],
  ח: [0b11111, 0b11111, 0b11001, 0b11001, 0b11001, 0b11001, 0b11001],
  ט: [0b10111, 0b10111, 0b10101, 0b10001, 0b10011, 0b11110, 0b11110],
  י: [0b11111, 0b11111, 0b00011, 0b00011, 0b00111, 0b00111, 0b00111],
  כ: [0b11110, 0b01111, 0b00001, 0b00001, 0b00001, 0b00001, 0b11111],
  ך: [0b11111, 0b00001, 0b00001, 0b00001, 0b00001, 0b00001, 0b00001],
  ל: [0b10000, 0b11111, 0b11111, 0b00001, 0b00011, 0b00110, 0b01100],
  מ: [0b11111, 0b11111, 0b11001, 0b11001, 0b11001, 0b10001, 0b10111],
  ם: [0b11111, 0b11111, 0b11001, 0b11001, 0b11001, 0b11001, 0b11111],
  נ: [0b01111, 0b00011, 0b00011, 0b00011, 0b00011, 0b00011, 0b11111],
  ן: [0b11111, 0b00111, 0b00111, 0b00111, 0b00111, 0b00111, 0b00111],
  ס: [0b11110, 0b11111, 0b11001, 0b11001, 0b11001, 0b11011, 0b01110],
  ע: [0b10011, 0b11001, 0b01001, 0b01111, 0b01110, 0b01110, 0b11000],
  פ: [0b01110, 0b01111, 0b11001, 0b11101, 0b00001, 0b00001, 0b11111],
  ף: [0b01110, 0b11011, 0b11001, 0b00001, 0b00001, 0b00001, 0b00001],
  צ: [0b10011, 0b11001, 0b01011, 0b01110, 0b00110, 0b00011, 0b11111],
  ץ: [0b10011, 0b11001, 0b01011, 0b01110, 0b00100, 0b00110, 0b00010],
  ק: [0b11111, 0b00001, 0b10001, 0b10011, 0b10110, 0b10000, 0b10000],
  ר: [0b11110, 0b01111, 0b00001, 0b00001, 0b00001, 0b00001, 0b00001],
  ש: [0b10101, 0b10101, 0b10101, 0b11101, 0b10011, 0b10110, 0b11100],
  ת: [0b11111, 0b01111, 0b01001, 0b01001, 0b01001, 0b01001, 0b11001],
};
*/

const FONT_10X16 = {
  0: [
    0b0001111000, 0b0011111100, 0b0111001110, 0b0110000110, 0b1100000011, 0b1100000011,
    0b1100000011, 0b1100000011, 0b1100000011, 0b1100000011, 0b1100000011, 0b1100000011,
    0b0110000110, 0b0111001110, 0b0011111100, 0b0001111000,
  ],
  1: [
    0b0000001111, 0b0001111111, 0b0111111111, 0b1111101111, 0b0110001111, 0b0000001111,
    0b0000001111, 0b0000001111, 0b0000001111, 0b0000001111, 0b0000001111, 0b0000001111,
    0b0000001111, 0b0000001111, 0b0000001111, 0b0000001111,
  ],
  2: [
    0b0011111100, 0b0111111110, 0b1110001111, 0b1100000111, 0b0000000111, 0b0000000111,
    0b0000000111, 0b0000001110, 0b0000011100, 0b0000111000, 0b0001110000, 0b0011110000,
    0b0111100000, 0b1111000000, 0b1111111111, 0b1111111111,
  ],
  3: [
    0b0011111100, 0b0111111110, 0b1110001111, 0b0110000111, 0b0000000111, 0b0000000111,
    0b0000111110, 0b0001111100, 0b0000111110, 0b0000000111, 0b0000000011, 0b0100000011,
    0b1110000011, 0b1111000111, 0b0111111110, 0b0011111100,
  ],
  4: [
    0b0000001110, 0b0000011110, 0b0000011110, 0b0000111110, 0b0000111110, 0b0001101110,
    0b0011101110, 0b0011001110, 0b0111001110, 0b0110001110, 0b1111111111, 0b1111111111,
    0b1111111111, 0b0000001110, 0b0000001110, 0b0000001110,
  ],
  5: [
    0b0111111110, 0b0111111110, 0b0110000000, 0b0110000000, 0b0110000000, 0b1110010000,
    0b1111111100, 0b1111111110, 0b0110000111, 0b0000000011, 0b0000000011, 0b1100000011,
    0b1100000111, 0b1110001111, 0b0111111110, 0b0011111100,
  ],
  6: [
    0b0000011000, 0b0000011000, 0b0000111000, 0b0001110000, 0b0001100000, 0b0011100000,
    0b0111111100, 0b0111111110, 0b1110000111, 0b1110000111, 0b1100000011, 0b1100000011,
    0b1110000111, 0b0110000111, 0b0111111110, 0b0011111100,
  ],
  7: [
    0b1111111111, 0b1111111111, 0b0000000111, 0b0000000111, 0b0000001110, 0b0000001100,
    0b0000011100, 0b0000011000, 0b0000111000, 0b0000110000, 0b0001110000, 0b0001100000,
    0b0011100000, 0b0111000000, 0b0111000000, 0b0110000000,
  ],
  8: [
    0b0011111100, 0b0111111110, 0b0111001110, 0b1110000111, 0b1110000111, 0b0110000110,
    0b0111111110, 0b0011111100, 0b0111111110, 0b1110000111, 0b1100000011, 0b1100000011,
    0b1100000011, 0b1110000111, 0b0111111110, 0b0011111100,
  ],
  9: [
    0b0011111100, 0b0111111110, 0b1110000110, 0b1110000111, 0b1100000011, 0b1100000011,
    0b1100000111, 0b1110000111, 0b0111111110, 0b0011111110, 0b0000011100, 0b0000011000,
    0b0000111000, 0b0001110000, 0b0001100000, 0b0001100000,
  ],
  ' ': [
    0b0000000000, 0b0000000000, 0b0000000000, 0b0000000000, 0b0000000000, 0b0000000000,
    0b0000000000, 0b0000000000, 0b0000000000, 0b0000000000, 0b0000000000, 0b0000000000,
    0b0000000000, 0b0000000000, 0b0000000000, 0b0000000000,
  ],
  '!': [
    0b0011111110, 0b0011111110, 0b0011111110, 0b0011111110, 0b0011111110, 0b0011111110,
    0b0011111100, 0b0011111100, 0b0011111100, 0b0011111100, 0b0011111100, 0b0000000000,
    0b0000000000, 0b0111111110, 0b1111111111, 0b0111111110,
  ],
  "'": [
    0b1111111111, 0b1111111111, 0b1111111111, 0b1111111111, 0b1111111111, 0b1111111111,
    0b1111111111, 0b1111111111, 0b1111111111, 0b1111111111, 0b1111111111, 0b1111111111,
    0b1111111111, 0b1111111111, 0b1111111111, 0b1111111111,
  ],
  ',': [
    0b0011111100, 0b0111111110, 0b0111111111, 0b1111111111, 0b1111111111, 0b1111111111,
    0b0111111111, 0b0011111110, 0b0001111100, 0b0001111100, 0b0011111000, 0b0011110000,
    0b0111110000, 0b1111100000, 0b1111000000, 0b0011000000,
  ],
  '-': [
    0b0000000000, 0b1111111111, 0b1111111111, 0b1111111111, 0b1111111111, 0b1111111111,
    0b1111111111, 0b1111111111, 0b1111111111, 0b1111111111, 0b1111111111, 0b1111111111,
    0b1111111111, 0b1111111111, 0b1111111111, 0b1111111111,
  ],
  ':': [
    0b0111111110, 0b1111111111, 0b1111111111, 0b0111111110, 0b0000000000, 0b0000000000,
    0b0000000000, 0b0000000000, 0b0000000000, 0b0000000000, 0b0000000000, 0b0000000000,
    0b0111111110, 0b1111111111, 0b1111111111, 0b0011111110,
  ],
  ';': [
    0b0111111110, 0b1111111111, 0b0111111111, 0b0000110000, 0b0000000000, 0b0000000000,
    0b0000000000, 0b0000000000, 0b0000000000, 0b0000000000, 0b0111111110, 0b1111111111,
    0b0111111111, 0b0011111100, 0b0111110000, 0b1111000000,
  ],
  '?': [
    0b0011111100, 0b0111111110, 0b1110000111, 0b1100000111, 0b0000000111, 0b0000000111,
    0b0000001110, 0b0000011100, 0b0000111000, 0b0000110000, 0b0000110000, 0b0000100000,
    0b0000000000, 0b0000110000, 0b0001111000, 0b0001110000,
  ],
  A: [
    0b0000110000, 0b0000110000, 0b0001111000, 0b0001111000, 0b0001111000, 0b0001001100,
    0b0011001100, 0b0011001100, 0b0011001100, 0b0111001110, 0b0111111110, 0b0111111110,
    0b0110000110, 0b1100000011, 0b1100000011, 0b1100000011,
  ],
  B: [
    0b1111111100, 0b1111111110, 0b1100000110, 0b1100000111, 0b1100000111, 0b1100000111,
    0b1100001110, 0b1111111100, 0b1111111110, 0b1100000111, 0b1100000011, 0b1100000011,
    0b1100000011, 0b1100000111, 0b1111111110, 0b1111111100,
  ],
  C: [
    0b0001111100, 0b0011111110, 0b0111000111, 0b0110000010, 0b1100000000, 0b1100000000,
    0b1100000000, 0b1100000000, 0b1100000000, 0b1100000000, 0b1100000000, 0b1100000000,
    0b0110000011, 0b0111000111, 0b0011111110, 0b0001111100,
  ],
  D: [
    0b1111111000, 0b1111111100, 0b1100001110, 0b1100000110, 0b1100000011, 0b1100000011,
    0b1100000011, 0b1100000011, 0b1100000011, 0b1100000011, 0b1100000011, 0b1100000011,
    0b1100000110, 0b1100001110, 0b1111111100, 0b1111111000,
  ],
  E: [
    0b1111111111, 0b1111111111, 0b1100000000, 0b1100000000, 0b1100000000, 0b1100000000,
    0b1100000000, 0b1111111110, 0b1111111110, 0b1100000000, 0b1100000000, 0b1100000000,
    0b1100000000, 0b1100000000, 0b1111111111, 0b1111111111,
  ],
  F: [
    0b1111111111, 0b1111111111, 0b1100000000, 0b1100000000, 0b1100000000, 0b1100000000,
    0b1100000000, 0b1111111110, 0b1111111111, 0b1100000000, 0b1100000000, 0b1100000000,
    0b1100000000, 0b1100000000, 0b1100000000, 0b1100000000,
  ],
  G: [
    0b0001111100, 0b0011111110, 0b0111000110, 0b0110000000, 0b1100000000, 0b1100000000,
    0b1100000000, 0b1100011111, 0b1100011111, 0b1100001111, 0b1100000011, 0b1100000011,
    0b0110000011, 0b0111000110, 0b0011111110, 0b0001111100,
  ],
  H: [
    0b1100000011, 0b1100000011, 0b1100000011, 0b1100000011, 0b1100000011, 0b1100000011,
    0b1100000011, 0b1111111111, 0b1111111111, 0b1100000011, 0b1100000011, 0b1100000011,
    0b1100000011, 0b1100000011, 0b1100000011, 0b1100000011,
  ],
  I: [
    0b1111111111, 0b1111111111, 0b1111111111, 0b1111111111, 0b1111111111, 0b1111111111,
    0b1111111111, 0b1111111111, 0b1111111111, 0b1111111111, 0b1111111111, 0b1111111111,
    0b1111111111, 0b1111111111, 0b1111111111, 0b1111111111,
  ],
  J: [
    0b0000000011, 0b0000000011, 0b0000000011, 0b0000000011, 0b0000000011, 0b0000000011,
    0b0000000011, 0b0000000011, 0b0000000011, 0b0000000011, 0b0000000011, 0b0000000011,
    0b1110000111, 0b1111000111, 0b0111111110, 0b0011111100,
  ],
  K: [
    0b1100000111, 0b1100001110, 0b1100011100, 0b1100011000, 0b1100111000, 0b1101110000,
    0b1101100000, 0b1111100000, 0b1111110000, 0b1110111000, 0b1110011000, 0b1100011100,
    0b1100001100, 0b1100001110, 0b1100000110, 0b1100000111,
  ],
  L: [
    0b1100000000, 0b1100000000, 0b1100000000, 0b1100000000, 0b1100000000, 0b1100000000,
    0b1100000000, 0b1100000000, 0b1100000000, 0b1100000000, 0b1100000000, 0b1100000000,
    0b1100000000, 0b1100000000, 0b1111111111, 0b1111111111,
  ],
  M: [
    0b1100000011, 0b1100000011, 0b1110000111, 0b1110000111, 0b1110000111, 0b1110000111,
    0b1111001111, 0b1111001111, 0b1111001111, 0b1101001011, 0b1101111011, 0b1101111011,
    0b1101111011, 0b1100110011, 0b1100110011, 0b1100110011,
  ],
  N: [
    0b1110000011, 0b1110000011, 0b1111000011, 0b1111000011, 0b1111100011, 0b1101100011,
    0b1101110011, 0b1100110011, 0b1100111011, 0b1100011011, 0b1100011111, 0b1100001111,
    0b1100001111, 0b1100000111, 0b1100000111, 0b1100000011,
  ],
  O: [
    0b0001111000, 0b0011111100, 0b0111001110, 0b0110000110, 0b1100000011, 0b1100000011,
    0b1100000011, 0b1100000011, 0b1100000011, 0b1100000011, 0b1100000011, 0b1100000011,
    0b0110000110, 0b0111001110, 0b0011111100, 0b0001111000,
  ],
  P: [
    0b1111111100, 0b1111111110, 0b1100000111, 0b1100000111, 0b1100000011, 0b1100000011,
    0b1100000111, 0b1111111110, 0b1111111110, 0b1111111000, 0b1100000000, 0b1100000000,
    0b1100000000, 0b1100000000, 0b1100000000, 0b1100000000,
  ],
  Q: [
    0b0001111000, 0b0011111100, 0b0110000110, 0b0110000110, 0b1100000011, 0b1100000011,
    0b1100000011, 0b1100000011, 0b1100000011, 0b1100000011, 0b1100011011, 0b1100001111,
    0b0110001110, 0b0111111110, 0b0011111110, 0b0000110110,
  ],
  R: [
    0b1111111100, 0b1111111110, 0b1100001110, 0b1100000111, 0b1100000111, 0b1100000111,
    0b1100000110, 0b1111111110, 0b1111111100, 0b1111111000, 0b1100111000, 0b1100011100,
    0b1100011100, 0b1100001110, 0b1100000110, 0b1100000111,
  ],
  S: [
    0b0011111100, 0b0111111110, 0b0111000111, 0b1110000110, 0b1110000000, 0b0110000000,
    0b0111110000, 0b0011111100, 0b0000111110, 0b0000001111, 0b0000000011, 0b1100000011,
    0b1110000011, 0b1111000111, 0b0111111110, 0b0011111100,
  ],
  T: [
    0b1111111111, 0b1111111111, 0b0000110000, 0b0000110000, 0b0000110000, 0b0000110000,
    0b0000110000, 0b0000110000, 0b0000110000, 0b0000110000, 0b0000110000, 0b0000110000,
    0b0000110000, 0b0000110000, 0b0000110000, 0b0000110000,
  ],
  U: [
    0b1100000011, 0b1100000011, 0b1100000011, 0b1100000011, 0b1100000011, 0b1100000011,
    0b1100000011, 0b1100000011, 0b1100000011, 0b1100000011, 0b1100000011, 0b1100000011,
    0b1110000111, 0b0110000110, 0b0111111110, 0b0011111100,
  ],
  V: [
    0b1100000011, 0b1100000011, 0b1110000111, 0b0110000110, 0b0110000110, 0b0110000110,
    0b0111001100, 0b0011001100, 0b0011001100, 0b0011001100, 0b0001011000, 0b0001111000,
    0b0001111000, 0b0001111000, 0b0000110000, 0b0000110000,
  ],
  W: [
    0b1000110001, 0b1100110011, 0b1100110011, 0b1100110011, 0b1100110011, 0b1101111011,
    0b0101111010, 0b0101111010, 0b0101101010, 0b0101001010, 0b0111001110, 0b0111001110,
    0b0111001110, 0b0011001100, 0b0011001100, 0b0010000100,
  ],
  X: [
    0b1110000111, 0b0110000110, 0b0110000110, 0b0011001100, 0b0011001100, 0b0001111000,
    0b0001111000, 0b0000110000, 0b0001111000, 0b0001111000, 0b0011111100, 0b0011001100,
    0b0111001100, 0b0110000110, 0b1110000110, 0b1100000011,
  ],
  Y: [
    0b1100000011, 0b1110000111, 0b0110000110, 0b0111001110, 0b0011001100, 0b0011111100,
    0b0001111000, 0b0001111000, 0b0000110000, 0b0000110000, 0b0000110000, 0b0000110000,
    0b0000110000, 0b0000110000, 0b0000110000, 0b0000110000,
  ],
  Z: [
    0b1111111111, 0b1111111111, 0b0000000111, 0b0000001110, 0b0000001100, 0b0000011100,
    0b0000011000, 0b0000111000, 0b0001110000, 0b0001100000, 0b0011100000, 0b0111000000,
    0b0110000000, 0b1110000000, 0b1111111111, 0b1111111111,
  ],
  א: [
    0b1100000111, 0b1110000111, 0b0110000111, 0b0111000111, 0b0011000111, 0b0011100110,
    0b0011100110, 0b0111111110, 0b0110111100, 0b1110011000, 0b1100011100, 0b1100001100,
    0b1100001110, 0b1100000110, 0b1100000111, 0b1100000111,
  ],
  ב: [
    0b1111110000, 0b1111111000, 0b1111111100, 0b0000001100, 0b0000001110, 0b0000001110,
    0b0000001110, 0b0000001110, 0b0000001110, 0b0000001110, 0b0000001110, 0b0000001110,
    0b0000001110, 0b1111111111, 0b1111111111, 0b1111111111,
  ],
  ג: [
    0b1111110000, 0b1111111000, 0b0111111100, 0b0000011100, 0b0000011110, 0b0000001110,
    0b0000001110, 0b0000001110, 0b0000001110, 0b0000001110, 0b0000011110, 0b0001111110,
    0b0111111110, 0b1111101110, 0b1110000111, 0b1100000111,
  ],
  ד: [
    0b1111111111, 0b1111111111, 0b1111111111, 0b0000001110, 0b0000001110, 0b0000001110,
    0b0000001110, 0b0000001110, 0b0000001110, 0b0000001110, 0b0000001110, 0b0000001110,
    0b0000001110, 0b0000001110, 0b0000001110, 0b0000001110,
  ],
  ה: [
    0b1111111100, 0b1111111110, 0b1111111110, 0b0000000111, 0b0000000011, 0b0000000011,
    0b0000000011, 0b1100000011, 0b1100000011, 0b1100000011, 0b1100000011, 0b1100000011,
    0b1100000011, 0b1100000011, 0b1100000011, 0b1100000011,
  ],
  ז: [
    0b1111111111, 0b1111111111, 0b1111111111, 0b0001110000, 0b0011100000, 0b0011100000,
    0b0011100000, 0b0011100000, 0b0011100000, 0b0011110000, 0b0001110000, 0b0001110000,
    0b0001111000, 0b0001111000, 0b0000111000, 0b0000111100,
  ],
  ח: [
    0b1111111100, 0b1111111110, 0b1111111111, 0b1100000111, 0b1100000011, 0b1100000011,
    0b1100000011, 0b1100000011, 0b1100000011, 0b1100000011, 0b1100000011, 0b1100000011,
    0b1100000011, 0b1100000011, 0b1100000011, 0b1100000011,
  ],
  ט: [
    0b1100111100, 0b1101111110, 0b1101101110, 0b1100000111, 0b1100000011, 0b1100000011,
    0b1100000011, 0b1100000011, 0b1100000011, 0b1100000011, 0b1100000011, 0b1100000111,
    0b0110000110, 0b0111011110, 0b0011111100, 0b0001111000,
  ],

  כ: [
    0b1111110000, 0b1111111100, 0b1111111110, 0b0000001110, 0b0000000111, 0b0000000111,
    0b0000000011, 0b0000000011, 0b0000000011, 0b0000000011, 0b0000000111, 0b0000000111,
    0b0000001110, 0b1111111110, 0b1111111100, 0b1111110000,
  ],
  ך: [
    0b1111111000, 0b1111111110, 0b0000001111, 0b0000000111, 0b0000000111, 0b0000000111,
    0b0000000111, 0b0000000111, 0b0000000111, 0b0000000111, 0b0000000111, 0b0000000111,
    0b0000000111, 0b0000000111, 0b0000000111, 0b0000000111,
  ],
  ל: [
    0b1100000000, 0b1100000000, 0b1100000000, 0b1111111111, 0b1111111111, 0b1111111111,
    0b0000000111, 0b0000000110, 0b0000001110, 0b0000001110, 0b0000001100, 0b0000011100,
    0b0000011100, 0b0000011000, 0b0000111000, 0b0000110000,
  ],
  מ: [
    0b1100111100, 0b1101111110, 0b1101101110, 0b1111000111, 0b0111000011, 0b0110000011,
    0b0110000011, 0b0110000011, 0b0110000011, 0b0110000011, 0b1110000011, 0b1100000011,
    0b1100000111, 0b1100101110, 0b1100111110, 0b1100111100,
  ],
  ם: [
    0b1111111100, 0b1111111110, 0b1111111110, 0b1100000111, 0b1100000011, 0b1100000011,
    0b1100000011, 0b1100000011, 0b1100000011, 0b1100000011, 0b1100000011, 0b1100000011,
    0b1100000011, 0b1111111111, 0b1111111111, 0b1111111111,
  ],
  נ: [
    0b1111110000, 0b1111111100, 0b1111111110, 0b0000011111, 0b0000001111, 0b0000001111,
    0b0000001111, 0b0000001111, 0b0000001111, 0b0000001111, 0b0000001111, 0b0000001111,
    0b0000001111, 0b1111111111, 0b1111111111, 0b1111111111,
  ],

  ס: [
    0b0001111000, 0b0011111100, 0b0111111110, 0b0110000110, 0b1100000011, 0b1100000011,
    0b1100000011, 0b1100000011, 0b1100000011, 0b1100000011, 0b1100000011, 0b1100000011,
    0b0110000110, 0b0111011110, 0b0011111100, 0b0001111000,
  ],
  ע: [
    0b1100000011, 0b1110000011, 0b1110000011, 0b0110000011, 0b0110000011, 0b0111000011,
    0b0111000011, 0b0011000011, 0b0011000011, 0b0011100011, 0b0001100111, 0b0001100111,
    0b0001101110, 0b0111111110, 0b1111111100, 0b1111110000,
  ],
  פ: [
    0b0011111000, 0b0111111100, 0b1111111110, 0b1110000110, 0b1100000111, 0b1100000011,
    0b1100000011, 0b1110000011, 0b0111100011, 0b0111100011, 0b0000000011, 0b0000000111,
    0b0000000110, 0b0000011110, 0b0111111100, 0b0111111000,
  ],
  ף: [
    0b0011111100, 0b0111111110, 0b1110000111, 0b1100000011, 0b1100000011, 0b1100000011,
    0b1111100011, 0b0111100011, 0b0000000011, 0b0000000011, 0b0000000011, 0b0000000011,
    0b0000000011, 0b0000000011, 0b0000000011, 0b0000000011,
  ],
  צ: [
    0b1110000011, 0b1110000011, 0b0111000011, 0b0011000011, 0b0011100011, 0b0001100111,
    0b0001111111, 0b0000111110, 0b0000111100, 0b0000011100, 0b0000001100, 0b0000001110,
    0b0000000110, 0b0111111111, 0b1111111111, 0b1111111111,
  ],
  ץ: [
    0b1100000011, 0b1110000011, 0b0110000011, 0b0111000011, 0b0111000111, 0b0011000111,
    0b0011111110, 0b0001111100, 0b0001110000, 0b0001110000, 0b0000110000, 0b0000111000,
    0b0000011000, 0b0000011100, 0b0000011100, 0b0000001100,
  ],
  ק: [
    0b1111111111, 0b1111111111, 0b0000000011, 0b0000000111, 0b0000000110, 0b1100000110,
    0b1100001110, 0b1100001100, 0b1100001100, 0b1100011100, 0b1100011000, 0b1100011000,
    0b1100000000, 0b1100000000, 0b1100000000, 0b1100000000,
  ],
  ר: [
    0b1111111000, 0b1111111100, 0b1111111110, 0b0000000111, 0b0000000111, 0b0000000111,
    0b0000000011, 0b0000000011, 0b0000000011, 0b0000000011, 0b0000000011, 0b0000000011,
    0b0000000011, 0b0000000011, 0b0000000011, 0b0000000011,
  ],
  ש: [
    0b1100110011, 0b1100110011, 0b1100110011, 0b1100110011, 0b1100110011, 0b1100110011,
    0b1101110011, 0b1111100011, 0b1111000011, 0b1100000011, 0b1100000011, 0b1100000011,
    0b0110000110, 0b0111011110, 0b0011111100, 0b0001111000,
  ],
  ת: [
    0b1111111100, 0b1111111110, 0b0111111111, 0b0011000011, 0b0011000011, 0b0011000011,
    0b0011000011, 0b0011000011, 0b0011000011, 0b0011000011, 0b0011000011, 0b0011000011,
    0b0011000011, 0b0011000011, 0b1111000011, 0b1110000011,
  ],
  '.': [
    0b0000000000, 0b0000000000, 0b0000000000, 0b0000000000, 0b0000000000, 0b0000000000,
    0b0000000000, 0b0000000000, 0b0000000000, 0b0000000000, 0b0000000000, 0b0000000000,
    0b0000011000, 0b0000111100, 0b0000111100, 0b0000011000,
  ],

  ו: [
    0b0001111100, 0b0001111100, 0b0000011000, 0b0000011000, 0b0000011000, 0b0000011000,
    0b0000011000, 0b0000011000, 0b0000011000, 0b0000011000, 0b0000011000, 0b0000011000,
    0b0000011000, 0b0000011000, 0b0000111100, 0b0000011000,
  ],

  י: [
    0b0001111000, 0b0011111100, 0b0011111100, 0b0000110000, 0b0000110000, 0b0000110000,
    0b0000110000, 0b0000110000, 0b0000110000, 0b0000000000, 0b0000000000, 0b0000000000,
    0b0000000000, 0b0000000000, 0b0000000000, 0b0000000000,
  ],

  ן: [
    0b0011111100, 0b0011111100, 0b0000011000, 0b0000011000, 0b0000011000, 0b0000011000,
    0b0000011000, 0b0000011000, 0b0000011000, 0b0000011000, 0b0000011000, 0b0000011000,
    0b0000011000, 0b0000011000, 0b0000011000, 0b0000011000,
  ],
};

const ACTIVE_FONT = FONT_10X16;
const ACTIVE_FONT_WIDTH = 10;
const ACTIVE_FONT_HEIGHT = 16;
