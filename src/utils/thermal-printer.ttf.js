import { randomUUID } from 'node:crypto';
import { access, unlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createThermalPrinter } from './thermal-printer.js';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_FONT_PATH = path.join(MODULE_DIR, 'arimo.ttf');
const DEFAULT_FONT_FAMILY = 'ArimoThermal';
const DEFAULT_LINE_HEIGHT_MULTIPLIER = 1.28;

const FONT_VARIANTS = {
  normal: {
    fontSizePx: 38,
    paddingX: 14,
    paddingY: 8,
    minHeight: 72,
    lineGap: 10,
  },
  compact: {
    fontSizePx: 32,
    paddingX: 12,
    paddingY: 6,
    minHeight: 56,
    lineGap: 8,
  },
};

const PRINT_IMAGE_OPTION_KEYS = [
  'threshold',
  'intensity',
  'minDataLines',
  'mode',
  'dataWriteDelayMs',
  'printTimeoutMs',
  'feedLinesBeforePrint',
  'feedLinesAfterPrint',
];

let canvasModulePromise = null;
const registeredFontKeys = new Set();

const defaultPrinter = createThermalPrinter();

async function getCanvasModule() {
  if (!canvasModulePromise) {
    canvasModulePromise = import('canvas')
      .then((mod) => ({
        createCanvas: mod.createCanvas,
        registerFont: mod.registerFont,
      }))
      .catch((error) => {
        canvasModulePromise = null;
        const reason = error?.message || String(error);
        throw new Error(
          `Canvas failed to load (${reason}). Install canvas to print using TTF text rendering.`
        );
      });
  }

  return canvasModulePromise;
}

function isHebrewText(text) {
  return /[\u0590-\u05ff]/.test(text);
}

function toPositiveNumber(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    return fallback;
  }

  return number;
}

function toNonNegativeNumber(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    return fallback;
  }

  return number;
}

function pickVariant(variantName) {
  return FONT_VARIANTS[variantName] || FONT_VARIANTS.normal;
}

function pickDirection(text, direction) {
  if (direction === 'rtl' || direction === 'ltr') {
    return direction;
  }

  return isHebrewText(text) ? 'rtl' : 'ltr';
}

function applyTextContext(ctx, options = {}) {
  const { fontFamily, fontSizePx, direction } = options;
  ctx.fillStyle = 'black';
  ctx.textBaseline = 'top';
  ctx.font = `${fontSizePx}px "${fontFamily}"`;
  ctx.textAlign = direction === 'rtl' ? 'right' : 'left';
  if ('direction' in ctx) {
    ctx.direction = direction;
  }
}

function splitWordByWidth(word, maxWidth, ctx) {
  const chars = [...word];
  if (!chars.length) {
    return [''];
  }

  const pieces = [];
  let current = chars[0];

  for (let i = 1; i < chars.length; i++) {
    const candidate = `${current}${chars[i]}`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      pieces.push(current);
      current = chars[i];
    }
  }

  pieces.push(current);
  return pieces;
}

function pushWrappedSegment(segment, output, maxWidth, ctx) {
  if (!segment.length) {
    output.push('');
    return;
  }

  if (ctx.measureText(segment).width <= maxWidth) {
    output.push(segment);
    return;
  }

  const pieces = splitWordByWidth(segment, maxWidth, ctx);
  output.push(...pieces);
}

function wrapTextLinesByWidth(text, maxWidth, ctx) {
  const inputLines = String(text ?? '')
    .replace(/\r\n/g, '\n')
    .split('\n');
  const wrapped = [];

  for (const rawLine of inputLines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      wrapped.push('');
      continue;
    }

    const words = trimmed.split(/\s+/).filter(Boolean);
    if (!words.length) {
      wrapped.push('');
      continue;
    }

    let line = words[0];
    for (let i = 1; i < words.length; i++) {
      const candidate = `${line} ${words[i]}`;
      if (ctx.measureText(candidate).width <= maxWidth) {
        line = candidate;
      } else {
        pushWrappedSegment(line, wrapped, maxWidth, ctx);
        line = words[i];
      }
    }

    pushWrappedSegment(line, wrapped, maxWidth, ctx);
  }

  return wrapped;
}

async function ensureFontRegistered(fontPath, fontFamily) {
  const { registerFont } = await getCanvasModule();
  const resolvedFontPath = path.resolve(fontPath || DEFAULT_FONT_PATH);
  const resolvedFontFamily = String(fontFamily || DEFAULT_FONT_FAMILY).trim() || DEFAULT_FONT_FAMILY;

  try {
    await access(resolvedFontPath);
  } catch {
    throw new Error(
      `TTF font file not found: ${resolvedFontPath}. Copy arimo.ttf to src/utils or pass options.fontPath.`
    );
  }

  const fontKey = `${resolvedFontPath}::${resolvedFontFamily}`;
  if (!registeredFontKeys.has(fontKey)) {
    registerFont(resolvedFontPath, { family: resolvedFontFamily });
    registeredFontKeys.add(fontKey);
  }

  return {
    fontPath: resolvedFontPath,
    fontFamily: resolvedFontFamily,
  };
}

function pickPrintImageOptions(options = {}) {
  const output = {};

  for (const key of PRINT_IMAGE_OPTION_KEYS) {
    if (Object.hasOwn(options, key)) {
      output[key] = options[key];
    }
  }

  return output;
}

async function renderTextToCanvas(text, options = {}) {
  const safeText = String(text ?? '').trim();
  if (!safeText) {
    throw new Error('printText requires a non-empty text value');
  }

  const variant = pickVariant(options.variant ?? 'normal');
  const printerWidth = Math.max(
    1,
    Math.round(toPositiveNumber(options.printerWidth, defaultPrinter.options.printerWidth))
  );
  const fontSizePx = Math.max(8, Math.round(toPositiveNumber(options.fontSizePx, variant.fontSizePx)));
  const lineGap = Math.max(0, Math.round(toNonNegativeNumber(options.lineGap, variant.lineGap)));
  const paddingX = Math.max(0, Math.round(toNonNegativeNumber(options.paddingX, variant.paddingX)));
  const paddingY = Math.max(0, Math.round(toNonNegativeNumber(options.paddingY, variant.paddingY)));
  const minHeight = Math.max(1, Math.round(toPositiveNumber(options.minHeight, variant.minHeight)));
  const lineHeightMultiplier = toPositiveNumber(
    options.lineHeightMultiplier,
    DEFAULT_LINE_HEIGHT_MULTIPLIER
  );

  const direction = pickDirection(safeText, options.direction);
  const fontMeta = await ensureFontRegistered(options.fontPath, options.fontFamily);
  const { createCanvas } = await getCanvasModule();

  const measureCanvas = createCanvas(printerWidth, 1);
  const measureCtx = measureCanvas.getContext('2d');
  applyTextContext(measureCtx, {
    fontFamily: fontMeta.fontFamily,
    fontSizePx,
    direction,
  });

  const maxTextWidth = Math.max(1, printerWidth - paddingX * 2);
  const wrappedLines = wrapTextLinesByWidth(safeText, maxTextWidth, measureCtx);
  const lines = wrappedLines.length ? wrappedLines : [' '];
  const lineHeight = Math.max(1, Math.round(fontSizePx * lineHeightMultiplier));
  const printHeight = Math.max(
    minHeight,
    paddingY * 2 + lines.length * lineHeight + (lines.length - 1) * lineGap
  );

  const canvas = createCanvas(printerWidth, printHeight);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  applyTextContext(ctx, {
    fontFamily: fontMeta.fontFamily,
    fontSizePx,
    direction,
  });

  const drawX = direction === 'rtl' ? printerWidth - paddingX : paddingX;
  for (let i = 0; i < lines.length; i++) {
    const textLine = lines[i] || ' ';
    const y = paddingY + i * (lineHeight + lineGap);
    ctx.fillText(textLine, drawX, y);
  }

  return canvas;
}

export async function connectThermalPrinter(options = undefined) {
  if (options) {
    throw new Error(
      'connectThermalPrinter does not accept options. Use createThermalPrinter(options) from thermal-printer.js.'
    );
  }

  await defaultPrinter.connect();
  return defaultPrinter;
}

export async function disconnectThermalPrinter() {
  await defaultPrinter.disconnect();
}

export async function printText(text, options = {}) {
  const canvas = await renderTextToCanvas(text, options);
  const tempFilePath = path.join(os.tmpdir(), `tim-bridge-thermal-${randomUUID()}.png`);
  const imageBuffer = canvas.toBuffer('image/png');

  await writeFile(tempFilePath, imageBuffer);

  try {
    await defaultPrinter.printImage(tempFilePath, pickPrintImageOptions(options));
  } finally {
    await unlink(tempFilePath).catch(() => {});
  }
}

export async function printEnglish(text, options = {}) {
  return printText(text, { ...options, direction: 'ltr' });
}

export async function printHebrew(text, options = {}) {
  return printText(text, { ...options, direction: 'rtl' });
}

export async function printImage(filePath, options = {}) {
  return defaultPrinter.printImage(filePath, options);
}
