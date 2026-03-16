#!/usr/bin/env node

/**
 * Generate bitmap font object from a TTF file.
 *
 * 16x24 version tuned for Hebrew stability:
 * - fixed high-res cell for every glyph
 * - fixed shared baseline
 * - true area-weighted downsampling
 * - no crop-based fitting
 * - no post-binarization vertical remapping
 *
 * Output format:
 * {
 *   'A': [0b000..., ...],
 *   'א': [0b000..., ...],
 * }
 */

import { createCanvas, registerFont } from 'canvas';
import fs from 'fs';
import path from 'path';

// ---------- Config ----------
const FONT_PATH = path.resolve('./arimo.ttf');

const MATRIX_WIDTH = 16;
const MATRIX_HEIGHT = 24;

const OUTPUT_TO_STDOUT = false;
const OUTPUT_DIR = path.dirname(FONT_PATH);
const FONT_BASENAME = path.parse(FONT_PATH).name.toLowerCase();
const OUTPUT_FILE = path.join(OUTPUT_DIR, `${FONT_BASENAME}.js`);
const OUTPUT_TXT_FILE = path.join(OUTPUT_DIR, `${FONT_BASENAME}.txt`);
const WRITE_TXT_PREVIEW = true;

const TXT_ON_PIXEL = '#';
const TXT_OFF_PIXEL = '.';

// High-res shared cell
const HIGH_RES_SCALE = 16;
const HIGH_RES_CANVAS_W = MATRIX_WIDTH * HIGH_RES_SCALE;
const HIGH_RES_CANVAS_H = MATRIX_HEIGHT * HIGH_RES_SCALE;

// Shared baseline for all glyphs
const BASELINE_RATIO = 0.81;

// Script-level sizing
const LATIN_FONT_SIZE_RATIO = 0.9;
const HEBREW_FONT_SIZE_RATIO = 0.92;

// Thresholds
const LATIN_PIXEL_THRESHOLD = 0.2;
const HEBREW_PIXEL_THRESHOLD = 0.18;

// Small per-glyph vertical nudges for Hebrew
const GLYPH_Y_OFFSETS = {
  ל: -1,
  ק: 1,
  ף: 1,
  ץ: 1,
  ן: 1,
};

// Optional tiny horizontal nudges if you want them later
const GLYPH_X_OFFSETS = {
  // Example:
  // 'י': 1,
};

// Character set
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

if (!fs.existsSync(FONT_PATH)) {
  console.error(`Font file not found: ${FONT_PATH}`);
  process.exit(1);
}

if (
  !Number.isInteger(MATRIX_WIDTH) ||
  MATRIX_WIDTH <= 0 ||
  !Number.isInteger(MATRIX_HEIGHT) ||
  MATRIX_HEIGHT <= 0
) {
  console.error('MATRIX_WIDTH and MATRIX_HEIGHT must be positive integers.');
  process.exit(1);
}

// ---------- Font registration ----------
const FAMILY = 'GeneratedBitmapFont16x24';
registerFont(FONT_PATH, { family: FAMILY });

// ---------- Helpers ----------

function escapeJsChar(ch) {
  if (ch === '\\') return '\\\\';
  if (ch === "'") return "\\'";
  return ch;
}

function make2D(width, height, fill = 0) {
  return Array.from({ length: height }, () => Array(width).fill(fill));
}

function emptyGlyph(width, height) {
  return Array.from({ length: height }, () => 0);
}

function getAlphaAt(imgData, x, y) {
  const idx = (y * imgData.width + x) * 4 + 3;
  return imgData.data[idx];
}

function hasHebrewCodePoint(ch) {
  if (!ch) return false;
  const cp = ch.codePointAt(0);
  return cp !== undefined && cp >= 0x0590 && cp <= 0x05ff;
}

function getGlyphThreshold(char) {
  return hasHebrewCodePoint(char) ? HEBREW_PIXEL_THRESHOLD : LATIN_PIXEL_THRESHOLD;
}

function getGlyphFontSize(char) {
  const ratio = hasHebrewCodePoint(char) ? HEBREW_FONT_SIZE_RATIO : LATIN_FONT_SIZE_RATIO;
  return Math.max(8, Math.round(HIGH_RES_CANVAS_H * ratio));
}

function getGlyphYOffset(char) {
  return GLYPH_Y_OFFSETS[char] ?? 0;
}

function getGlyphXOffset(char) {
  return GLYPH_X_OFFSETS[char] ?? 0;
}

function renderGlyphInFixedCell(
  char,
  fontFamily,
  cellW,
  cellH,
  fontSize,
  baselineY,
  offsetX = 0,
  offsetY = 0
) {
  const canvas = createCanvas(cellW, cellH);
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, cellW, cellH);
  ctx.fillStyle = 'black';
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.font = `${fontSize}px "${fontFamily}"`;

  const metrics = ctx.measureText(char);
  const inkLeft = metrics.actualBoundingBoxLeft || 0;
  const inkRight = metrics.actualBoundingBoxRight || 0;
  const inkWidth = Math.max(1, Math.ceil(inkLeft + inkRight));

  const x = Math.round((cellW - inkWidth) / 2 - inkLeft) + offsetX;
  const y = baselineY + offsetY;

  ctx.fillText(char, x, y);

  return {
    imageData: ctx.getImageData(0, 0, cellW, cellH),
    metrics,
    x,
    y,
    fontSize,
  };
}

function imageDataToAlpha2D(imgData) {
  const out = make2D(imgData.width, imgData.height, 0);

  for (let y = 0; y < imgData.height; y++) {
    for (let x = 0; x < imgData.width; x++) {
      out[y][x] = getAlphaAt(imgData, x, y) / 255;
    }
  }

  return out;
}

function downsampleToMatrixArea(alpha2D, targetW, targetH) {
  const srcH = alpha2D.length;
  const srcW = alpha2D[0].length;
  const out = make2D(targetW, targetH, 0);

  for (let ty = 0; ty < targetH; ty++) {
    const y0 = (ty * srcH) / targetH;
    const y1 = ((ty + 1) * srcH) / targetH;

    for (let tx = 0; tx < targetW; tx++) {
      const x0 = (tx * srcW) / targetW;
      const x1 = ((tx + 1) * srcW) / targetW;

      let sum = 0;
      let areaSum = 0;

      const syStart = Math.floor(y0);
      const syEnd = Math.ceil(y1);
      const sxStart = Math.floor(x0);
      const sxEnd = Math.ceil(x1);

      for (let sy = syStart; sy < syEnd; sy++) {
        if (sy < 0 || sy >= srcH) continue;
        const overlapY = Math.max(0, Math.min(y1, sy + 1) - Math.max(y0, sy));
        if (overlapY <= 0) continue;

        for (let sx = sxStart; sx < sxEnd; sx++) {
          if (sx < 0 || sx >= srcW) continue;
          const overlapX = Math.max(0, Math.min(x1, sx + 1) - Math.max(x0, sx));
          if (overlapX <= 0) continue;

          const area = overlapX * overlapY;
          sum += alpha2D[sy][sx] * area;
          areaSum += area;
        }
      }

      out[ty][tx] = areaSum > 0 ? sum / areaSum : 0;
    }
  }

  return out;
}

function thresholdMatrix(matrix, threshold) {
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

function trimEmptyTopBottom(binary) {
  let top = 0;
  let bottom = binary.length - 1;

  while (top <= bottom && binary[top].every((v) => v === 0)) top++;
  while (bottom >= top && binary[bottom].every((v) => v === 0)) bottom--;

  if (top > bottom) return make2D(binary[0].length, binary.length, 0);

  const trimmed = binary.slice(top, bottom + 1);
  const out = make2D(binary[0].length, binary.length, 0);

  const startY = Math.floor((binary.length - trimmed.length) / 2);
  for (let y = 0; y < trimmed.length; y++) {
    out[startY + y] = [...trimmed[y]];
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

function charToBitmap(char, width, height) {
  if (char === ' ') {
    return emptyGlyph(width, height);
  }

  const baselineY = Math.round(HIGH_RES_CANVAS_H * BASELINE_RATIO);
  const fontSize = getGlyphFontSize(char);
  const offsetX = getGlyphXOffset(char) * HIGH_RES_SCALE;
  const offsetY = getGlyphYOffset(char) * HIGH_RES_SCALE;

  const { imageData } = renderGlyphInFixedCell(
    char,
    FAMILY,
    HIGH_RES_CANVAS_W,
    HIGH_RES_CANVAS_H,
    fontSize,
    baselineY,
    offsetX,
    offsetY
  );

  const alpha = imageDataToAlpha2D(imageData);
  const small = downsampleToMatrixArea(alpha, width, height);
  const binary = thresholdMatrix(small, getGlyphThreshold(char));

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
  lines.push(`export const ${name} = {`);

  for (const ch of CHARS) {
    const rows = obj[ch].map((n) => bitsToBinaryLiteral(n, width)).join(', ');
    lines.push(`  '${escapeJsChar(ch)}': [${rows}],`);
  }

  lines.push('};');
  return lines.join('\n');
}

function formatCharLabel(ch) {
  if (ch === ' ') return 'SPACE';
  return ch;
}

function formatCodePoint(ch) {
  const cp = ch.codePointAt(0);
  if (cp === undefined) return 'U+0000';
  return `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`;
}

function formatGlyphRowsForPreview(glyphRows, width) {
  const lines = [];

  for (let row = 0; row < glyphRows.length; row++) {
    const bits = glyphRows[row] ?? 0;
    const binary = bits.toString(2).padStart(width, '0');
    const pixels = [...binary].map((bit) => (bit === '1' ? TXT_ON_PIXEL : TXT_OFF_PIXEL)).join('');
    lines.push(`${String(row).padStart(2, '0')} ${pixels}`);
  }

  return lines;
}

function formatTxtPreview(name, obj, width, height) {
  const lines = [];
  const baselineRow = Math.round(height * BASELINE_RATIO);

  lines.push(`${name} preview (${width}x${height})`);
  lines.push(`Legend: ${TXT_ON_PIXEL}=on ${TXT_OFF_PIXEL}=off`);
  lines.push(`Baseline row index (approx): ${baselineRow}`);
  lines.push('');

  for (const ch of CHARS) {
    const label = formatCharLabel(ch);
    const codePoint = formatCodePoint(ch);
    const glyphRows = obj[ch] ?? emptyGlyph(width, height);
    lines.push(`[${label}] ${codePoint}`);
    lines.push(...formatGlyphRowsForPreview(glyphRows, width));
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}

// ---------- Run ----------
const fontName = `FONT_${MATRIX_WIDTH}X${MATRIX_HEIGHT}`;
const fontObj = generateFontObject(CHARS, MATRIX_WIDTH, MATRIX_HEIGHT);
const output = formatFontObject(fontName, fontObj, MATRIX_WIDTH);
const txtPreview = formatTxtPreview(fontName, fontObj, MATRIX_WIDTH, MATRIX_HEIGHT);

if (OUTPUT_TO_STDOUT) {
  process.stdout.write(output);
} else {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_FILE, `${output}\n`, 'utf8');

  if (WRITE_TXT_PREVIEW) {
    fs.writeFileSync(OUTPUT_TXT_FILE, `${txtPreview}\n`, 'utf8');
  }

  console.log(`Saved bitmap font to ${OUTPUT_FILE}`);
  if (WRITE_TXT_PREVIEW) {
    console.log(`Saved glyph preview to ${OUTPUT_TXT_FILE}`);
  }
}
