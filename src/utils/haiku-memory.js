import { readFile } from 'node:fs/promises';
import path from 'node:path';

const LOG_FILE = path.resolve(process.cwd(), 'logs', 'haiku-station.jsonl');

export async function loadRecentHaikus(limit = 10) {
  try {
    const content = await readFile(LOG_FILE, 'utf8');
    const lines = content.trim().split('\n');

    const haikus = [];

    for (let i = lines.length - 1; i >= 0 && haikus.length < limit; i--) {
      const parsed = JSON.parse(lines[i]);
      if (parsed.event === 'llm_output_parsed') {
        haikus.push(`${parsed.line1} | ${parsed.line2} | ${parsed.line3}`);
      }
    }

    return haikus;
  } catch {
    return [];
  }
}
