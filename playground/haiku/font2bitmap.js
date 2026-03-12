#!/usr/bin/env node

/**
 * Generate bitmap font object from a TTF file.
 *
 * Output format:
 * {
 *   'A': [0b01110, 0b10001, ...],
 *   'א': [0b00100, 0b01010, ...],
 * }
 *
 * Usage:
 *   npm install canvas
 *   node font2bitmap.js ./Alef-Regular.ttf 5 7 > font.js
 */

import { createCanvas, registerFont } from 'canvas';
import fs from 'fs';
import path from 'path';

// ---------- Config ----------
const DEFAULT_WIDTH = 5;
const DEFAULT_HEIGHT = 7;

// Character set based on your original object
const CHARS = [
  ' ',
  '!',
  "'",
  ',',
  '-',
  '.',
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  ':',
  ';',
  '?',
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'J',
  'K',
  'L',
  'M',
  'N',
  'O',
  'P',
  'Q',
  'R',
  'S',
  'T',
  'U',
  'V',
  'W',
  'X',
  'Y',
  'Z',
  'א',
  'ב',
  'ג',
  'ד',
  'ה',
  'ו',
  'ז',
  'ח',
  'ט',
  'י',
  'כ',
  'ך',
  'ל',
  'מ',
  'ם',
  'נ',
  'ן',
  'ס',
  'ע',
  'פ',
  'ף',
  'צ',
  'ץ',
  'ק',
  'ר',
  'ש',
  'ת',
];

// ---------- CLI ----------
const [, , fontPathArg, widthArg, heightArg] = process.argv;

if (!fontPathArg) {
  console.error('Usage: node font2bitmap.js ./Alef-Regular.ttf [width] [height]');
  process.exit(1);
}

const fontPath = path.resolve(fontPathArg);
const matrixWidth = Number(widthArg || DEFAULT_WIDTH);
const matrixHeight = Number(heightArg || DEFAULT_HEIGHT);

if (!fs.existsSync(fontPath)) {
  console.error(`Font file not found: ${fontPath}`);
  process.exit(1);
}

if (
  !Number.isInteger(matrixWidth) ||
  matrixWidth <= 0 ||
  !Number.isInteger(matrixHeight) ||
  matrixHeight <= 0
) {
  console.error('Width and height must be positive integers.');
  process.exit(1);
}

// ---------- Font registration ----------
const FAMILY = 'GeneratedBitmapFont';
registerFont(fontPath, { family: FAMILY });

// ---------- Helpers ----------

function escapeJsChar(ch) {
  if (ch === '\\') return '\\\\';
  if (ch === "'") return "\\'";
  return ch;
}

function make2D(width, height, fill = 0) {
  return Array.from({ length: height }, () => Array(width).fill(fill));
}

function getAlphaAt(imgData, x, y) {
  const idx = (y * imgData.width + x) * 4 + 3;
  return imgData.data[idx];
}

function renderGlyphToHighRes(char, fontFamily) {
  // Oversample heavily for better downscaling
  const CANVAS_W = 256;
  const CANVAS_H = 256;
  const MARGIN = 16;

  const canvas = createCanvas(CANVAS_W, CANVAS_H);
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.fillStyle = 'black';
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  // Start large, then fit if needed
  let fontSize = 180;
  ctx.font = `${fontSize}px "${fontFamily}"`;

  const metrics = ctx.measureText(char);
  const ascent = metrics.actualBoundingBoxAscent || fontSize * 0.8;
  const descent = metrics.actualBoundingBoxDescent || fontSize * 0.2;
  const glyphW = Math.max(
    1,
    Math.ceil(metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight)
  );
  const glyphH = Math.max(1, Math.ceil(ascent + descent));

  // Fit into canvas if needed
  const scaleX = (CANVAS_W - MARGIN * 2) / glyphW;
  const scaleY = (CANVAS_H - MARGIN * 2) / glyphH;
  const fitScale = Math.min(scaleX, scaleY, 1);
  fontSize = Math.max(8, Math.floor(fontSize * fitScale));

  ctx.font = `${fontSize}px "${fontFamily}"`;
  const m2 = ctx.measureText(char);
  const ascent2 = m2.actualBoundingBoxAscent || fontSize * 0.8;
  const descent2 = m2.actualBoundingBoxDescent || fontSize * 0.2;
  const left = m2.actualBoundingBoxLeft || 0;

  // Draw centered
  const x = Math.round(
    (CANVAS_W - (m2.actualBoundingBoxLeft + m2.actualBoundingBoxRight)) / 2 - left
  );
  const y = Math.round((CANVAS_H + ascent2 - descent2) / 2);

  ctx.fillText(char, x, y);

  return ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
}

function findBoundingBox(imgData, alphaThreshold = 8) {
  const { width, height } = imgData;
  let minX = width,
    minY = height,
    maxX = -1,
    maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (getAlphaAt(imgData, x, y) > alphaThreshold) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX === -1) {
    return null;
  }

  return { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

function cropAlpha(imgData, box) {
  const out = make2D(box.width, box.height, 0);

  for (let y = 0; y < box.height; y++) {
    for (let x = 0; x < box.width; x++) {
      out[y][x] = getAlphaAt(imgData, box.minX + x, box.minY + y) / 255;
    }
  }

  return out;
}

function downsampleToMatrix(alpha2D, targetW, targetH) {
  const srcH = alpha2D.length;
  const srcW = alpha2D[0].length;
  const out = make2D(targetW, targetH, 0);

  for (let ty = 0; ty < targetH; ty++) {
    for (let tx = 0; tx < targetW; tx++) {
      const x0 = (tx * srcW) / targetW;
      const x1 = ((tx + 1) * srcW) / targetW;
      const y0 = (ty * srcH) / targetH;
      const y1 = ((ty + 1) * srcH) / targetH;

      let sum = 0;
      let count = 0;

      const sx0 = Math.floor(x0);
      const sx1 = Math.ceil(x1);
      const sy0 = Math.floor(y0);
      const sy1 = Math.ceil(y1);

      for (let sy = sy0; sy < sy1; sy++) {
        if (sy < 0 || sy >= srcH) continue;
        for (let sx = sx0; sx < sx1; sx++) {
          if (sx < 0 || sx >= srcW) continue;
          sum += alpha2D[sy][sx];
          count++;
        }
      }

      out[ty][tx] = count > 0 ? sum / count : 0;
    }
  }

  return out;
}

function thresholdMatrix(matrix, threshold = 0.22) {
  const h = matrix.length;
  const w = matrix[0].length;
  const out = make2D(w, h, 0);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      out[y][x] = matrix[y][x] >= threshold ? 1 : 0;
    }
  }

  return out;
}

function rowBitsFromBinaryMatrix(binary) {
  return binary.map((row) => {
    let bits = 0;
    for (let x = 0; x < row.length; x++) {
      bits = (bits << 1) | (row[x] ? 1 : 0);
    }
    return bits;
  });
}

function bitsToBinaryLiteral(bits, width) {
  return '0b' + bits.toString(2).padStart(width, '0');
}

function emptyGlyph(width, height) {
  return Array.from({ length: height }, () => 0);
}

function charToBitmap(char, width, height) {
  if (char === ' ') {
    return emptyGlyph(width, height);
  }

  const img = renderGlyphToHighRes(char, FAMILY);
  const box = findBoundingBox(img);

  if (!box) {
    return emptyGlyph(width, height);
  }

  const cropped = cropAlpha(img, box);
  const scaled = downsampleToMatrix(cropped, width, height);
  const binary = thresholdMatrix(scaled);
  return rowBitsFromBinaryMatrix(binary);
}

function generateFontObject(chars, width, height) {
  const out = {};

  for (const ch of chars) {
    out[ch] = charToBitmap(ch, width, height);
  }

  return out;
}

function formatFontObject(name, obj, width) {
  const lines = [];
  lines.push(`const ${name} = {`);

  for (const ch of Object.keys(obj)) {
    const rows = obj[ch].map((n) => bitsToBinaryLiteral(n, width)).join(', ');
    lines.push(`  '${escapeJsChar(ch)}': [${rows}],`);
  }

  lines.push('};');
  lines.push('');
  lines.push(`module.exports = ${name};`);
  return lines.join('\n');
}

// ---------- Run ----------
const fontName = `FONT_${matrixWidth}X${matrixHeight}`;
const fontObj = generateFontObject(CHARS, matrixWidth, matrixHeight);
const output = formatFontObject(fontName, fontObj, matrixWidth);

process.stdout.write(output);
