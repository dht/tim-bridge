import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { FONT_16X24 } from './thermal-printer-font.js';

const DEFAULT_TARGET_ADDRESS = process.env.THERMAL_PRINTER_ADDRESS ?? '48:0f:57:c5:78:9d';
const DEFAULT_TARGET_ADDRESS_PATH =
  process.env.THERMAL_PRINTER_ADDRESS_PATH ??
  path.resolve(process.cwd(), 'cache', 'thermal-printer-address.json');
const DEFAULT_LINE_GAP = 10;
const COMPACT_FONT_SCALE_MULTIPLIER = 0.8;
const MINI_FONT_SCALE_MULTIPLIER = 0.65;
// Keep physical print size close to previous 12x18@2 behavior.
const ACTIVE_FONT_BASE_SCALE = 1.5;
const ACTIVE_FONT_WIDTH = 16;
const ACTIVE_FONT_HEIGHT = 24;
const ACTIVE_FONT = FONT_16X24;
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
  mini: {
    scaleMultiplier: MINI_FONT_SCALE_MULTIPLIER,
    paddingX: 10,
    paddingY: 4,
    minHeight: 42,
  },
};

const DEFAULTS = {
  targetAddress: DEFAULT_TARGET_ADDRESS,
  targetAddressPath: DEFAULT_TARGET_ADDRESS_PATH,
  controlUuid: 'ae01',
  notifyUuid: 'ae02',
  dataUuid: 'ae03',
  printerWidth: 384,
  minDataLines: 24,
  intensity: 0x5d,
  threshold: 150,
  dataWriteDelayMs: 15,
  connectTimeoutMs: 30000,
  responseTimeoutMs: 5000,
  printTimeoutMs: 20000,
  fallbackTextScale: 4,
  textVariant: 'normal',
  lineGap: DEFAULT_LINE_GAP,
  feedLinesBeforePrint: 2,
  feedLinesAfterPrint: 3,
};

const Command = {
  getStatus: 0xa1,
  setIntensity: 0xa2,
  printRequest: 0xa9,
  flushData: 0xad,
  printComplete: 0xaa,
};

let noblePromise = null;
let canvasModulePromise = null;

async function getNoble() {
  if (!noblePromise) {
    noblePromise = import('@abandonware/noble')
      .then((mod) => mod.default ?? mod)
      .catch((error) => {
        noblePromise = null;
        const reason = error?.message || String(error);
        throw new Error(
          `Failed loading @abandonware/noble (${reason}). Install it before using thermal printer utils.`
        );
      });
  }

  return noblePromise;
}

async function getCanvasModule() {
  if (!canvasModulePromise) {
    canvasModulePromise = import('canvas')
      .then((mod) => ({ createCanvas: mod.createCanvas, loadImage: mod.loadImage }))
      .catch((error) => {
        canvasModulePromise = null;
        const reason = error?.message || String(error);
        throw new Error(`Canvas failed to load (${reason}). Install canvas to print images.`);
      });
  }

  return canvasModulePromise;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeAddress(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

function getPeripheralIdentifier(peripheral) {
  const address = normalizeAddress(peripheral?.address);
  if (address && address !== 'unknown') {
    return address;
  }

  return normalizeAddress(peripheral?.id);
}

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
  if (!message || message.length < 6) return null;
  if (message[0] !== 0x22 || message[1] !== 0x21) return null;

  const cmdId = message[2];
  const len = message[4] | (message[5] << 8);
  if (message.length < 6 + len) return null;

  return {
    cmdId,
    payload: message.slice(6, 6 + len),
  };
}

function isHebrewText(text) {
  return /[\u0590-\u05ff]/.test(text);
}

function createBlankRows(height, rowWidthBytes) {
  return Array.from({ length: height }, () => new Uint8Array(rowWidthBytes));
}

function setRowPixel(rows, x, y, printerWidth) {
  const rowWidthBytes = printerWidth / 8;
  if (x < 0 || y < 0 || y >= rows.length || x >= printerWidth) return;
  if (rows[y].length !== rowWidthBytes) return;
  rows[y][x >> 3] |= 1 << (x & 7);
}

function getRowPixel(rows, x, y, printerWidth) {
  if (x < 0 || y < 0 || y >= rows.length || x >= printerWidth) return 0;
  return (rows[y][x >> 3] >> (x & 7)) & 1;
}

function rotateRows180(rows, printerWidth) {
  const rowWidthBytes = printerWidth / 8;
  const height = rows.length;
  const rotated = createBlankRows(height, rowWidthBytes);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < printerWidth; x++) {
      if (getRowPixel(rows, x, y, printerWidth)) {
        setRowPixel(rotated, printerWidth - 1 - x, height - 1 - y, printerWidth);
      }
    }
  }

  return rotated;
}

function rowsToPaddedBuffer(rows, printerWidth, minDataLines) {
  const rowWidthBytes = printerWidth / 8;
  const minBytes = minDataLines * rowWidthBytes;
  const dataSize = rows.length * rowWidthBytes;
  const out = new Uint8Array(Math.max(dataSize, minBytes));

  let offset = 0;
  for (const row of rows) {
    out.set(row, offset);
    offset += rowWidthBytes;
  }

  return out;
}

function withFeedRows(rows, printerWidth, beforeLines = 0, afterLines = 0) {
  const rowWidthBytes = printerWidth / 8;
  const safeBefore = Math.max(0, Math.floor(beforeLines));
  const safeAfter = Math.max(0, Math.floor(afterLines));
  const out = [];

  for (let i = 0; i < safeBefore; i++) {
    out.push(new Uint8Array(rowWidthBytes));
  }

  out.push(...rows);

  for (let i = 0; i < safeAfter; i++) {
    out.push(new Uint8Array(rowWidthBytes));
  }

  return out;
}

function canvasToRows(canvas, printerWidth, threshold) {
  const width = canvas.width;
  const height = canvas.height;
  const rowWidthBytes = printerWidth / 8;

  if (width !== printerWidth) {
    throw new Error(`Canvas width must be ${printerWidth}, got ${width}`);
  }

  const ctx = canvas.getContext('2d');
  const rgba = ctx.getImageData(0, 0, width, height).data;
  const rows = [];

  for (let y = 0; y < height; y++) {
    const row = new Uint8Array(rowWidthBytes);

    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const alpha = rgba[i + 3] / 255;
      const gray = rgba[i] * 0.299 + rgba[i + 1] * 0.587 + rgba[i + 2] * 0.114;
      const blended = gray * alpha + 255 * (1 - alpha);
      const black = blended < threshold;

      if (black) {
        row[x >> 3] |= 1 << (x & 7);
      }
    }

    rows.push(row);
  }

  return rows;
}

function wrapTextLinesByChars(text, maxChars) {
  const inputLines = String(text ?? '')
    .replace(/\r\n/g, '\n')
    .split('\n');
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
  return [...String(line ?? '').toUpperCase()]
    .map((char) => (ACTIVE_FONT[char] ? char : ' '))
    .join('');
}

function isGlyphPixelOn(glyph, glyphWidth, x, y) {
  if (x < 0 || y < 0 || y >= glyph.length) return false;
  const bits = glyph[y] || 0;
  return (bits & (1 << (glyphWidth - 1 - x))) !== 0;
}

function drawGlyph(rows, glyph, x, y, glyphWidth, glyphHeight, scale, printerWidth) {
  const drawW = Math.max(1, Math.round(glyphWidth * scale));
  const drawH = Math.max(1, Math.round(glyphHeight * scale));

  for (let dy = 0; dy < drawH; dy++) {
    const sy = Math.min(glyphHeight - 1, Math.floor(dy / scale));
    for (let dx = 0; dx < drawW; dx++) {
      const sx = Math.min(glyphWidth - 1, Math.floor(dx / scale));
      if (!isGlyphPixelOn(glyph, glyphWidth, sx, sy)) continue;
      setRowPixel(rows, x + dx, y + dy, printerWidth);
    }
  }
}

function textToBitmapRows(text, options = {}) {
  const {
    printerWidth,
    variant = 'normal',
    direction = 'auto',
    lineGap = DEFAULT_LINE_GAP,
  } = options;

  const rowWidthBytes = printerWidth / 8;
  const fontVariant = FONT_VARIANTS[variant] || FONT_VARIANTS.normal;
  const scale = Math.max(0.1, ACTIVE_FONT_BASE_SCALE * fontVariant.scaleMultiplier);
  const charW = Math.max(1, Math.round(ACTIVE_FONT_WIDTH * scale));
  const charH = Math.max(1, Math.round(ACTIVE_FONT_HEIGHT * scale));
  const gapX = Math.max(1, Math.round(scale * 0.75));
  const resolvedLineGap = Math.max(0, Math.round(lineGap));
  const paddingX = fontVariant.paddingX;
  const paddingY = fontVariant.paddingY;
  const safeText = String(text ?? '');
  const rtl = direction === 'rtl' || (direction === 'auto' && isHebrewText(safeText));

  const maxChars = Math.max(1, Math.floor((printerWidth - paddingX * 2 + gapX) / (charW + gapX)));
  const wrapped = wrapTextLinesByChars(safeText, maxChars)
    .map(sanitizeTextLine)
    .flatMap((line) => (line.length ? [line] : [' ']));

  const lines = wrapped.length ? wrapped : [' '];
  const lineHeight = charH + resolvedLineGap;
  const height = Math.max(fontVariant.minHeight, paddingY * 2 + lines.length * lineHeight);
  const rows = createBlankRows(height, rowWidthBytes);

  for (let i = 0; i < lines.length; i++) {
    const y = paddingY + i * lineHeight;
    const line = lines[i];

    if (rtl) {
      const chars = [...line];
      const rightX = printerWidth - paddingX - charW;

      for (let j = 0; j < chars.length; j++) {
        const x = rightX - j * (charW + gapX);
        if (x < paddingX - charW) break;
        const glyph = ACTIVE_FONT[chars[j]] || ACTIVE_FONT[' '];
        drawGlyph(rows, glyph, x, y, ACTIVE_FONT_WIDTH, ACTIVE_FONT_HEIGHT, scale, printerWidth);
      }
      continue;
    }

    for (let j = 0; j < line.length; j++) {
      const x = paddingX + j * (charW + gapX);
      const glyph = ACTIVE_FONT[line[j]] || ACTIVE_FONT[' '];
      drawGlyph(rows, glyph, x, y, ACTIVE_FONT_WIDTH, ACTIVE_FONT_HEIGHT, scale, printerWidth);
    }
  }

  return rows;
}

export class ThermalPrinter {
  constructor(options = {}) {
    this.options = {
      ...DEFAULTS,
      ...options,
    };

    this.targetAddress = normalizeAddress(this.options.targetAddress);
    this.targetAddressPath = path.resolve(String(this.options.targetAddressPath));
    this.autoDiscoveryEnabled = !this.targetAddress;
    this.addressCacheLoaded = false;
    this.peripheral = null;
    this.controlChar = null;
    this.notifyChar = null;
    this.dataChar = null;
    this.noble = null;

    this.printComplete = false;
    this.pendingResponses = new Map();

    this.connectPromise = null;
    this.taskQueue = Promise.resolve();

    this._onNotifyData = this._onNotifyData.bind(this);
    this._onDisconnect = this._onDisconnect.bind(this);
  }

  isConnected() {
    return Boolean(
      this.peripheral &&
      this.peripheral.state === 'connected' &&
      this.controlChar &&
      this.notifyChar &&
      this.dataChar
    );
  }

  async connect() {
    if (this.isConnected()) {
      return;
    }

    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.connectPromise = this._connectImpl();

    try {
      await this.connectPromise;
    } finally {
      this.connectPromise = null;
    }
  }

  async disconnect() {
    if (!this.peripheral) {
      this._resetConnectionState();
      return;
    }

    try {
      if (this.notifyChar) {
        this.notifyChar.removeListener('data', this._onNotifyData);
      }

      this.peripheral.removeListener('disconnect', this._onDisconnect);
      await this.peripheral.disconnectAsync();
    } finally {
      this._rejectPendingResponses(new Error('Printer disconnected'));
      this._resetConnectionState();
    }
  }

  async requestStatus() {
    return this._enqueueTask(async () => {
      await this.connect();
      await this._sendControlCommand(Command.getStatus, Uint8Array.of(0x00));
      return this._waitForNotification(Command.getStatus, this.options.responseTimeoutMs);
    });
  }

  async printEnglish(text, options = {}) {
    const safeText = String(text ?? '');
    if (!safeText.trim()) {
      throw new Error('printEnglish requires a non-empty text value');
    }

    return this._enqueueTask(async () => {
      const rows = rotateRows180(
        textToBitmapRows(safeText, {
          printerWidth: this.options.printerWidth,
          direction: 'ltr',
          variant: options.variant ?? this.options.textVariant,
          lineGap: options.lineGap ?? this.options.lineGap,
        }),
        this.options.printerWidth
      );

      await this._printRows(rows, options);
    });
  }

  async printHebrew(text, options = {}) {
    const safeText = String(text ?? '');
    if (!safeText.trim()) {
      throw new Error('printHebrew requires a non-empty text value');
    }

    return this._enqueueTask(async () => {
      const rows = textToBitmapRows(safeText, {
        printerWidth: this.options.printerWidth,
        direction: 'rtl',
        variant: options.variant ?? this.options.textVariant,
        lineGap: options.lineGap ?? this.options.lineGap,
      });

      await this._printRows(rotateRows180(rows, this.options.printerWidth), options);
    });
  }

  async printText(text, options = {}) {
    const safeText = String(text ?? '');
    if (!safeText.trim()) {
      throw new Error('printText requires a non-empty text value');
    }

    return this._enqueueTask(async () => {
      const hasHebrew = isHebrewText(safeText);
      const rows = textToBitmapRows(safeText, {
        printerWidth: this.options.printerWidth,
        direction: options.direction ?? (hasHebrew ? 'rtl' : 'auto'),
        variant: options.variant ?? this.options.textVariant,
        lineGap: options.lineGap ?? this.options.lineGap,
      });

      await this._printRows(rotateRows180(rows, this.options.printerWidth), options);
    });
  }

  async printImage(filePath, options = {}) {
    const path = String(filePath ?? '').trim();
    if (!path) {
      throw new Error('printImage requires a file path');
    }

    return this._enqueueTask(async () => {
      const { createCanvas, loadImage } = await getCanvasModule();
      const img = await loadImage(path);
      const scale = this.options.printerWidth / img.width;
      const targetHeight = Math.max(1, Math.round(img.height * scale));

      const canvas = createCanvas(this.options.printerWidth, targetHeight);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, this.options.printerWidth, targetHeight);

      const rows = canvasToRows(
        canvas,
        this.options.printerWidth,
        options.threshold ?? this.options.threshold
      );

      await this._printRows(rotateRows180(rows, this.options.printerWidth), options);
    });
  }

  _enqueueTask(fn) {
    const run = this.taskQueue.then(fn);
    this.taskQueue = run.catch(() => {});
    return run;
  }

  async _loadCachedTargetAddress() {
    if (this.addressCacheLoaded || !this.autoDiscoveryEnabled) {
      return;
    }

    this.addressCacheLoaded = true;

    try {
      const raw = await readFile(this.targetAddressPath, 'utf8');
      const parsed = JSON.parse(raw);
      const cachedAddress = normalizeAddress(parsed?.targetAddress);

      if (cachedAddress) {
        this.targetAddress = cachedAddress;
        this.autoDiscoveryEnabled = false;
      }
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        console.warn('Failed reading thermal printer address cache:', error?.message || error);
      }
    }
  }

  async _saveCachedTargetAddress(targetAddress) {
    const normalized = normalizeAddress(targetAddress);
    if (!normalized) {
      return;
    }

    const dirPath = path.dirname(this.targetAddressPath);
    await mkdir(dirPath, { recursive: true });
    await writeFile(
      this.targetAddressPath,
      `${JSON.stringify({ targetAddress: normalized, updatedAt: new Date().toISOString() }, null, 2)}\n`,
      'utf8'
    );
  }

  async _connectImpl() {
    this.noble = await getNoble();
    await this._waitForPoweredOn(this.options.connectTimeoutMs);
    await this._loadCachedTargetAddress();
    const peripheral = await this._scanForPeripheral(this.options.connectTimeoutMs);

    await peripheral.connectAsync();
    const { characteristics } = await peripheral.discoverAllServicesAndCharacteristicsAsync();

    const controlUuid = this.options.controlUuid;
    const notifyUuid = this.options.notifyUuid;
    const dataUuid = this.options.dataUuid;

    const controlChar = characteristics.find((char) => char.uuid === controlUuid);
    const notifyChar = characteristics.find((char) => char.uuid === notifyUuid);
    const dataChar = characteristics.find((char) => char.uuid === dataUuid);

    if (!controlChar || !notifyChar || !dataChar) {
      try {
        await peripheral.disconnectAsync();
      } catch {
        // no-op
      }

      throw new Error(
        `Missing printer characteristics. control=${Boolean(controlChar)} notify=${Boolean(notifyChar)} data=${Boolean(dataChar)}`
      );
    }

    this.peripheral = peripheral;
    this.controlChar = controlChar;
    this.notifyChar = notifyChar;
    this.dataChar = dataChar;

    const discoveredTarget = getPeripheralIdentifier(peripheral);
    if (this.autoDiscoveryEnabled && discoveredTarget) {
      this.targetAddress = discoveredTarget;
      this.autoDiscoveryEnabled = false;
      await this._saveCachedTargetAddress(discoveredTarget).catch((error) => {
        console.warn('Failed writing thermal printer address cache:', error?.message || error);
      });
      console.log(`Thermal printer discovered and cached: ${discoveredTarget}`);
    }

    await this.notifyChar.subscribeAsync();
    this.notifyChar.on('data', this._onNotifyData);
    this.peripheral.on('disconnect', this._onDisconnect);
  }

  async _waitForPoweredOn(timeoutMs) {
    if (this.noble.state === 'poweredOn') {
      return;
    }

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error(`Bluetooth adapter is not powered on (state=${this.noble.state})`));
      }, timeoutMs);

      const onStateChange = (state) => {
        if (state === 'poweredOn') {
          cleanup();
          resolve();
        }
      };

      const cleanup = () => {
        clearTimeout(timeout);
        this.noble.removeListener('stateChange', onStateChange);
      };

      this.noble.on('stateChange', onStateChange);
    });
  }

  async _scanForPeripheral(timeoutMs) {
    const targetAddress = this.targetAddress;

    return new Promise((resolve, reject) => {
      let resolved = false;

      const finish = (result, error) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeout);
        this.noble.removeListener('discover', onDiscover);

        this.noble
          .stopScanningAsync()
          .catch(() => {})
          .finally(() => {
            if (error) {
              reject(error);
            } else {
              resolve(result);
            }
          });
      };

      const timeout = setTimeout(() => {
        finish(
          null,
          new Error(
            `Printer not found within ${timeoutMs}ms: ${targetAddress || 'auto-discovery mode'}`
          )
        );
      }, timeoutMs);

      const onDiscover = (peripheral) => {
        const identifier = getPeripheralIdentifier(peripheral);
        if (!identifier) {
          return;
        }

        if (targetAddress && identifier !== targetAddress) {
          return;
        }

        finish(peripheral, null);
      };

      this.noble.on('discover', onDiscover);

      this.noble.startScanningAsync([], false).catch((error) => {
        finish(null, error instanceof Error ? error : new Error(String(error)));
      });
    });
  }

  _onDisconnect() {
    this._rejectPendingResponses(new Error('Printer disconnected'));
    this._resetConnectionState();
  }

  _resetConnectionState() {
    this.peripheral = null;
    this.controlChar = null;
    this.notifyChar = null;
    this.dataChar = null;
    this.printComplete = false;
  }

  _onNotifyData(bufferData) {
    const parsed = parseNotification(new Uint8Array(bufferData));
    if (!parsed) {
      return;
    }

    if (parsed.cmdId === Command.printComplete) {
      this.printComplete = true;
    }

    const resolver = this.pendingResponses.get(parsed.cmdId);
    if (resolver) {
      this.pendingResponses.delete(parsed.cmdId);
      resolver.resolve(parsed.payload);
    }
  }

  _rejectPendingResponses(error) {
    for (const [, resolver] of this.pendingResponses) {
      resolver.reject(error);
    }
    this.pendingResponses.clear();
  }

  _waitForNotification(cmdId, timeoutMs) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingResponses.delete(cmdId);
        reject(new Error(`Timeout waiting for printer response 0x${cmdId.toString(16)}`));
      }, timeoutMs);

      this.pendingResponses.set(cmdId, {
        resolve: (payload) => {
          clearTimeout(timeout);
          resolve(payload);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });
    });
  }

  async _writeControl(data) {
    await this.controlChar.writeAsync(Buffer.from(data), true);
  }

  async _writeData(data) {
    await this.dataChar.writeAsync(Buffer.from(data), true);
  }

  async _sendControlCommand(cmd, payload = Uint8Array.of()) {
    await this._writeControl(makeCommand(cmd, payload));
  }

  async _setIntensity(intensity) {
    await this._sendControlCommand(Command.setIntensity, Uint8Array.of(intensity));
    await delay(50);
  }

  async _sendPrintRequest(lines, mode = 0) {
    const payload = new Uint8Array(4);
    payload[0] = lines & 0xff;
    payload[1] = (lines >> 8) & 0xff;
    payload[2] = 0x30;
    payload[3] = mode;

    await this._sendControlCommand(Command.printRequest, payload);
    return this._waitForNotification(Command.printRequest, this.options.responseTimeoutMs);
  }

  async _flushData() {
    await this._sendControlCommand(Command.flushData, Uint8Array.of(0x00));
    await delay(50);
  }

  async _waitForPrintComplete(timeoutMs) {
    const startedAt = Date.now();
    while (!this.printComplete && Date.now() - startedAt < timeoutMs) {
      await delay(100);
    }

    if (!this.printComplete) {
      throw new Error('Print timeout: no print-complete notification');
    }
  }

  async _printRows(rows, options = {}) {
    if (!rows || rows.length === 0) {
      throw new Error('Nothing to print');
    }

    await this.connect();

    const printerWidth = this.options.printerWidth;
    const rowWidthBytes = printerWidth / 8;
    const fedRows = withFeedRows(
      rows,
      printerWidth,
      options.feedLinesBeforePrint ?? this.options.feedLinesBeforePrint,
      options.feedLinesAfterPrint ?? this.options.feedLinesAfterPrint
    );
    const numLines = fedRows.length;
    const imageBuffer = rowsToPaddedBuffer(
      fedRows,
      printerWidth,
      options.minDataLines ?? this.options.minDataLines
    );

    this.printComplete = false;

    await this._setIntensity(options.intensity ?? this.options.intensity);

    await this._sendControlCommand(Command.getStatus, Uint8Array.of(0x00));
    await this._waitForNotification(Command.getStatus, this.options.responseTimeoutMs);

    const ack = await this._sendPrintRequest(numLines, options.mode ?? 0);
    if (!ack || ack.length === 0 || ack[0] !== 0) {
      throw new Error(`Print request rejected (ack=${Buffer.from(ack || []).toString('hex')})`);
    }

    for (let i = 0; i < imageBuffer.length; i += rowWidthBytes) {
      await this._writeData(imageBuffer.slice(i, i + rowWidthBytes));
      await delay(options.dataWriteDelayMs ?? this.options.dataWriteDelayMs);
    }

    await this._flushData();
    await this._waitForPrintComplete(options.printTimeoutMs ?? this.options.printTimeoutMs);
  }
}

export function createThermalPrinter(options = {}) {
  return new ThermalPrinter(options);
}

const defaultPrinter = createThermalPrinter();

export async function connectThermalPrinter(options = undefined) {
  if (options) {
    throw new Error(
      'connectThermalPrinter does not accept options. Use createThermalPrinter(options).'
    );
  }

  await defaultPrinter.connect();
  return defaultPrinter;
}

export async function disconnectThermalPrinter() {
  await defaultPrinter.disconnect();
}

export async function printText(text, options = {}) {
  return defaultPrinter.printText(text, options);
}

export async function printEnglish(text, options = {}) {
  return defaultPrinter.printEnglish(text, options);
}

export async function printHebrew(text, options = {}) {
  return defaultPrinter.printHebrew(text, options);
}

export async function printImage(filePath, options = {}) {
  return defaultPrinter.printImage(filePath, options);
}

// Legacy 5x7 map removed from runtime path.
// The active map is FONT_16X24 from thermal-printer-font.js.
