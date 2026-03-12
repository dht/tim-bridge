const DEFAULT_TARGET_ADDRESS = process.env.THERMAL_PRINTER_ADDRESS ?? '48:0f:57:c5:78:9d';

const DEFAULTS = {
  targetAddress: DEFAULT_TARGET_ADDRESS,
  controlUuid: 'ae01',
  notifyUuid: 'ae02',
  dataUuid: 'ae03',
  printerWidth: 384,
  minDataLines: 90,
  intensity: 0x5d,
  threshold: 150,
  dataWriteDelayMs: 15,
  connectTimeoutMs: 15000,
  responseTimeoutMs: 5000,
  printTimeoutMs: 20000,
  fallbackTextScale: 4,
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
        throw new Error(
          `Canvas failed to load (${reason}). Install canvas to print Hebrew/non-ASCII text.`
        );
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

function splitLongWordByWidth(ctx, word, maxWidth) {
  const out = [];
  let current = '';

  for (const char of [...word]) {
    const candidate = `${current}${char}`;
    if (!current || ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      out.push(current);
      current = char;
    }
  }

  if (current) {
    out.push(current);
  }

  return out;
}

function wrapTextByWidth(ctx, text, maxWidth) {
  const paragraphs = String(text ?? '').replace(/\r\n/g, '\n').split('\n');
  const lines = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);

    if (!words.length) {
      lines.push('');
      continue;
    }

    let line = '';

    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;

      if (!line && ctx.measureText(word).width > maxWidth) {
        const chunks = splitLongWordByWidth(ctx, word, maxWidth);
        if (chunks.length > 0) {
          line = chunks.shift() ?? '';
          for (const chunk of chunks) {
            lines.push(line);
            line = chunk;
          }
        }
        continue;
      }

      if (!line || ctx.measureText(candidate).width <= maxWidth) {
        line = candidate;
      } else {
        lines.push(line);
        line = word;
      }
    }

    lines.push(line || '');
  }

  return lines.length ? lines : [''];
}

function wrapTextLinesByChars(text, maxChars) {
  const inputLines = String(text ?? '').replace(/\r\n/g, '\n').split('\n');
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

function sanitizeAsciiTextLine(line) {
  return String(line ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9 .,!?:;'"-]/g, ' ');
}

function drawGlyph(rows, glyph, x, y, scale, printerWidth) {
  for (let gy = 0; gy < 7; gy++) {
    const bits = glyph[gy] || 0;
    for (let gx = 0; gx < 5; gx++) {
      if ((bits & (1 << (4 - gx))) === 0) continue;
      for (let sy = 0; sy < scale; sy++) {
        for (let sx = 0; sx < scale; sx++) {
          setRowPixel(rows, x + gx * scale + sx, y + gy * scale + sy, printerWidth);
        }
      }
    }
  }
}

function textToAsciiRows(text, printerWidth, textScale) {
  const rowWidthBytes = printerWidth / 8;
  const scale = textScale;
  const charW = 5 * scale;
  const charH = 7 * scale;
  const gapX = scale;
  const gapY = scale + 2;
  const paddingX = 16;
  const paddingY = 12;

  const maxChars = Math.max(1, Math.floor((printerWidth - paddingX * 2 + gapX) / (charW + gapX)));
  const wrapped = wrapTextLinesByChars(text, maxChars)
    .map(sanitizeAsciiTextLine)
    .flatMap((line) => (line.length ? [line] : [' ']));

  const lines = wrapped.length ? wrapped : [' '];
  const lineHeight = charH + gapY;
  const height = Math.max(120, paddingY * 2 + lines.length * lineHeight);
  const rows = createBlankRows(height, rowWidthBytes);

  for (let i = 0; i < lines.length; i++) {
    const y = paddingY + i * lineHeight;
    const line = lines[i];

    for (let j = 0; j < line.length; j++) {
      const x = paddingX + j * (charW + gapX);
      const glyph = FONT_5X7[line[j]] || FONT_5X7[' '];
      drawGlyph(rows, glyph, x, y, scale, printerWidth);
    }
  }

  return rows;
}

async function textToCanvasRows(text, options) {
  const {
    printerWidth,
    threshold,
    fontSize = 42,
    fontFamily = 'Arial, "Noto Sans Hebrew", sans-serif',
    direction = 'auto',
    lineHeightMultiplier = 1.35,
    paddingX = 20,
    paddingY = 16,
    minHeight = 120,
  } = options;

  const { createCanvas } = await getCanvasModule();
  const maxTextWidth = printerWidth - paddingX * 2;

  const probeCanvas = createCanvas(printerWidth, 64);
  const probeCtx = probeCanvas.getContext('2d');
  probeCtx.font = `${fontSize}px ${fontFamily}`;

  const rawText = String(text ?? '');
  const rtl = direction === 'rtl' || (direction === 'auto' && isHebrewText(rawText));
  const lines = wrapTextByWidth(probeCtx, rawText, maxTextWidth);

  const lineHeight = Math.max(1, Math.ceil(fontSize * lineHeightMultiplier));
  const height = Math.max(minHeight, paddingY * 2 + lines.length * lineHeight);

  const canvas = createCanvas(printerWidth, height);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = 'black';
  ctx.font = `${fontSize}px ${fontFamily}`;
  ctx.textBaseline = 'top';
  ctx.textAlign = rtl ? 'right' : 'left';

  // node-canvas may ignore this in some versions, but set it when available.
  try {
    ctx.direction = rtl ? 'rtl' : 'ltr';
  } catch {
    // no-op
  }

  const x = rtl ? printerWidth - paddingX : paddingX;
  for (let i = 0; i < lines.length; i++) {
    const y = paddingY + i * lineHeight;
    ctx.fillText(lines[i], x, y, maxTextWidth);
  }

  return canvasToRows(canvas, printerWidth, threshold);
}

export class ThermalPrinter {
  constructor(options = {}) {
    this.options = {
      ...DEFAULTS,
      ...options,
    };

    this.targetAddress = normalizeAddress(this.options.targetAddress);
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
        textToAsciiRows(
          safeText,
          this.options.printerWidth,
          options.textScale ?? this.options.fallbackTextScale
        ),
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
      const rows = await textToCanvasRows(safeText, {
        printerWidth: this.options.printerWidth,
        threshold: options.threshold ?? this.options.threshold,
        direction: 'rtl',
        fontSize: options.fontSize,
        fontFamily: options.fontFamily,
        lineHeightMultiplier: options.lineHeightMultiplier,
        paddingX: options.paddingX,
        paddingY: options.paddingY,
        minHeight: options.minHeight,
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
      const preferCanvas = options.preferCanvas ?? hasHebrew;

      let rows;
      if (preferCanvas) {
        try {
          rows = await textToCanvasRows(safeText, {
            printerWidth: this.options.printerWidth,
            threshold: options.threshold ?? this.options.threshold,
            direction: options.direction ?? (hasHebrew ? 'rtl' : 'auto'),
            fontSize: options.fontSize,
            fontFamily: options.fontFamily,
            lineHeightMultiplier: options.lineHeightMultiplier,
            paddingX: options.paddingX,
            paddingY: options.paddingY,
            minHeight: options.minHeight,
          });
        } catch (error) {
          if (hasHebrew) {
            throw error;
          }

          rows = textToAsciiRows(
            safeText,
            this.options.printerWidth,
            options.textScale ?? this.options.fallbackTextScale
          );
        }
      } else {
        rows = textToAsciiRows(
          safeText,
          this.options.printerWidth,
          options.textScale ?? this.options.fallbackTextScale
        );
      }

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

  async _connectImpl() {
    this.noble = await getNoble();
    await this._waitForPoweredOn(this.options.connectTimeoutMs);

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
        finish(null, new Error(`Printer not found within ${timeoutMs}ms: ${targetAddress}`));
      }, timeoutMs);

      const onDiscover = (peripheral) => {
        const address = normalizeAddress(peripheral.address);
        if (!address || address !== targetAddress) {
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
    const numLines = rows.length;
    const imageBuffer = rowsToPaddedBuffer(rows, printerWidth, this.options.minDataLines);

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
    throw new Error('connectThermalPrinter does not accept options. Use createThermalPrinter(options).');
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
  A: [0b01110, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  B: [0b11110, 0b10001, 0b10001, 0b11110, 0b10001, 0b10001, 0b11110],
  C: [0b01110, 0b10001, 0b10000, 0b10000, 0b10000, 0b10001, 0b01110],
  D: [0b11110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b11110],
  E: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b11111],
  F: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b10000],
  G: [0b01110, 0b10001, 0b10000, 0b10111, 0b10001, 0b10001, 0b01110],
  H: [0b10001, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  I: [0b01110, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  J: [0b00001, 0b00001, 0b00001, 0b00001, 0b10001, 0b10001, 0b01110],
  K: [0b10001, 0b10010, 0b10100, 0b11000, 0b10100, 0b10010, 0b10001],
  L: [0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b11111],
  M: [0b10001, 0b11011, 0b10101, 0b10101, 0b10001, 0b10001, 0b10001],
  N: [0b10001, 0b11001, 0b10101, 0b10011, 0b10001, 0b10001, 0b10001],
  O: [0b01110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  P: [0b11110, 0b10001, 0b10001, 0b11110, 0b10000, 0b10000, 0b10000],
  Q: [0b01110, 0b10001, 0b10001, 0b10001, 0b10101, 0b10010, 0b01101],
  R: [0b11110, 0b10001, 0b10001, 0b11110, 0b10100, 0b10010, 0b10001],
  S: [0b01111, 0b10000, 0b10000, 0b01110, 0b00001, 0b00001, 0b11110],
  T: [0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100],
  U: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  V: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01010, 0b00100],
  W: [0b10001, 0b10001, 0b10001, 0b10101, 0b10101, 0b10101, 0b01010],
  X: [0b10001, 0b10001, 0b01010, 0b00100, 0b01010, 0b10001, 0b10001],
  Y: [0b10001, 0b10001, 0b01010, 0b00100, 0b00100, 0b00100, 0b00100],
  Z: [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b10000, 0b11111],
};
