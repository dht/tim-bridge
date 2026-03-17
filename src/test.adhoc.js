import { appendFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import './utils/load-env.js';
import { requestHaikuFromLlm } from './utils/prompt.haiku.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_FILE = path.join(__dirname, 'test.adhoc.output.txt');

function formatHaiku(haiku) {
  const { line1, line2, line3 } = haiku;
  return [line1, line2, line3].join('\n').trim();
}

async function main() {
  const generatedAt = new Date();
  console.time('Haiku generation time');
  const haiku = await requestHaikuFromLlm(generatedAt);
  console.timeEnd('Haiku generation time');
  const output = `${generatedAt.toISOString()}\n${formatHaiku(haiku)}\n\n`;

  await appendFile(OUTPUT_FILE, output, 'utf8');
  console.log(`Appended haiku to ${OUTPUT_FILE}`);
}

main().catch((error) => {
  console.error('Failed to generate haiku:', error?.message || error);
  process.exitCode = 1;
});
