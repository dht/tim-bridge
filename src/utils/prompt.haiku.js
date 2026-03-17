import { readFileSync } from 'node:fs';
import { loadRecentHaikus } from './haiku-memory.js';
import {
  CONTEXT_FRAGMENTS_POOL,
  HAIKU_MODES,
  HAIKU_MOODS,
  pickRandom,
  pickRandomSubset,
} from './haiku-variation.js';

const OPENAI_MODEL = process.env.HAIKU_MODEL ?? 'gpt-5.3';
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1';
const TIME_ZONE = process.env.HAIKU_TIMEZONE ?? 'Asia/Jerusalem';
const INSTALLATION_NAME = process.env.HAIKU_INSTALLATION_NAME ?? 'המפעל';
const INSTALLATION_CITY = process.env.HAIKU_INSTALLATION_CITY ?? 'ירושלים';

export const HAIKU_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['line1', 'line2', 'line3'],
  properties: {
    line1: { type: 'string', minLength: 2, maxLength: 80 },
    line2: { type: 'string', minLength: 2, maxLength: 80 },
    line3: { type: 'string', minLength: 2, maxLength: 80 },
  },
};

const TEMPLATE = readFileSync(new URL('./prompt.haiku.md', import.meta.url), 'utf8');

function render(template, values) {
  return template.replace(/\{\{([A-Z_]+)\}\}/g, (_, key) => values[key] ?? '');
}

export function buildHaikuPrompt({
  mode,
  mood,
  fragments,
  recentHaikus,
  nowIso,
  installationName,
  city,
  timeZone,
}) {
  return render(TEMPLATE, {
    MODE: mode,
    MOOD: mood,
    FRAGMENTS: fragments.join(', '),
    RECENT_HAIKUS: recentHaikus.join('\n'),
    NOW_ISO: nowIso,
    INSTALLATION_NAME: installationName,
    CITY: city,
    TIME_ZONE: timeZone,
  });
}

export async function requestHaikuFromLlm(date) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is missing.');

  const mode = pickRandom(HAIKU_MODES);
  const mood = pickRandom(HAIKU_MOODS);
  const fragments = pickRandomSubset(CONTEXT_FRAGMENTS_POOL, 3);
  const recentHaikus = await loadRecentHaikus();

  const prompt = buildHaikuPrompt({
    mode,
    mood,
    fragments,
    recentHaikus,
    nowIso: date.toISOString(),
    installationName: INSTALLATION_NAME,
    city: INSTALLATION_CITY,
    timeZone: TIME_ZONE,
  });

  const temperature = getHaikuTemperature();

  const response = await fetch(`${OPENAI_BASE_URL}/responses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature,
      top_p: 0.9,
      presence_penalty: 0.6,
      frequency_penalty: 0.4,

      // 🔥 MULTI SAMPLE
      n: 3,

      input: [
        {
          role: 'user',
          content: [{ type: 'input_text', text: prompt }],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'daily_haiku',
          schema: HAIKU_OUTPUT_SCHEMA,
        },
      },
    }),
  });

  const json = await response.json();

  const candidates = [];

  for (const item of json.output || []) {
    const text = item?.content?.[0]?.text;
    if (!text) continue;

    try {
      const parsed = JSON.parse(text);
      if (parsed.line1 && parsed.line2 && parsed.line3) {
        candidates.push(parsed);
      }
    } catch {}
  }

  if (!candidates.length) throw new Error('No valid haiku candidates');

  // 🔥 SIMPLE SELECTION HEURISTIC
  const best = candidates.sort((a, b) => {
    return scoreHaiku(b) - scoreHaiku(a);
  })[0];

  return best;
}

function scoreHaiku(h) {
  const text = `${h.line1} ${h.line2} ${h.line3}`;

  let score = 0;

  // reward uniqueness (rough)
  const words = text.split(' ');
  const unique = new Set(words);
  score += unique.size;

  // penalize repetition
  if (words.length - unique.size > 2) score -= 5;

  // reward shorter / sharper
  score -= text.length * 0.01;

  return score;
}
