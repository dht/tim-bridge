import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

const LOG_FILE = path.join(PROJECT_ROOT, 'logs', 'haiku-station.jsonl');
const MEMORY_FILE = path.join(PROJECT_ROOT, 'logs', 'haiku-memory.jsonl');

const OPENAI_MODEL = process.env.HAIKU_MODEL ?? 'gpt-5.2';
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1';

const HAIKU_MOODS = ['שקט', 'מתוח', 'עייף', 'זר', 'עמוס', 'ריק'];
const HAIKU_RESPONSE_FORMAT = {
  name: 'haiku_options',
  type: 'json_schema',
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      options: {
        type: 'array',
        minItems: 1,
        maxItems: 8,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            line1: { type: 'string' },
            line2: { type: 'string' },
            line3: { type: 'string' },
          },
          required: ['line1', 'line2', 'line3'],
        },
      },
    },
    required: ['options'],
  },
};

// ---------------- MEMORY ----------------

export async function loadRecentHaikus(limit = 10) {
  try {
    const content = await readFile(LOG_FILE, 'utf8');
    return content
      .trim()
      .split('\n')
      .reverse()
      .map((l) => {
        try {
          const p = JSON.parse(l);
          if (p.line1 && p.line2 && p.line3) {
            return `${p.line1} ${p.line2} ${p.line3}`;
          }
        } catch {}
        return null;
      })
      .filter(Boolean)
      .slice(0, limit);
  } catch {
    return [];
  }
}

// ---------------- FRAGMENTS ----------------

// 🔥 MUCH larger pool (critical)
const FRAGMENTS = [
  'רובוט מלוחות אלקטרוניים',
  'מזוזות על מעקה',
  'קוף מביט בכניסה',
  'מטריות תלויות',
  'יונים עם כובעי צמר',
  'דלת רכב מקרינה נוף',
  'אבק עץ באוויר',
  'סנדלים על קיר',
  'פסל בתוך מזרקה תלויה',
  'כוס קפה שנשכחה',
  'יד נוגעת בזכוכית',
  'צעדים מהדהדים',
  'אור נשבר על רצפה',
  'ריח מתכת קרה',
  'מפתח נופל',
  'צל זז בלי גוף',
];

// 🔥 sample WITHOUT repetition bias
function pickFragments() {
  return [...FRAGMENTS].sort(() => 0.5 - Math.random()).slice(0, 3);
}

// ---------------- PROMPT ----------------

function buildPrompt({ mood, recentHaikus, nowIso }) {
  const fragments = pickFragments();

  return `
הפק 8 הייקואים שונים מאוד.

חוקים:
- כל הייקואים שונים לחלוטין זה מזה
- כל אחד מתאר רגע אחר
- אסור: אני / קיר / בניין / אבן
- אסור להשתמש באותם דימויים בין השירים

השראה (לא חובה להשתמש ישירות):
${fragments.join(', ')}

הימנע מחזרה:
${recentHaikus.join('\n')}

מצב:
${mood}

פורמט JSON:
{
  "options": [
    { "line1": "...", "line2": "...", "line3": "..." }
  ]
}

${nowIso}
`;
}

// ---------------- LLM ----------------

function extractResponseText(responseBody) {
  const outputText = responseBody?.output_text;
  if (typeof outputText === 'string' && outputText.trim()) {
    return outputText.trim();
  }

  const outputItems = Array.isArray(responseBody?.output) ? responseBody.output : [];
  for (const outputItem of outputItems) {
    const contentItems = Array.isArray(outputItem?.content) ? outputItem.content : [];
    for (const contentItem of contentItems) {
      if (typeof contentItem?.text === 'string' && contentItem.text.trim()) {
        return contentItem.text.trim();
      }
    }
  }

  return '';
}

function parseJsonPayload(text) {
  if (!text || typeof text !== 'string') {
    return null;
  }

  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch {}

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) {
    try {
      return JSON.parse(fencedMatch[1]);
    } catch {}
  }

  const objectStart = trimmed.indexOf('{');
  const objectEnd = trimmed.lastIndexOf('}');
  if (objectStart >= 0 && objectEnd > objectStart) {
    try {
      return JSON.parse(trimmed.slice(objectStart, objectEnd + 1));
    } catch {}
  }

  return null;
}

function toNormalizedCandidates(value) {
  let maybeCandidates = [];

  if (Array.isArray(value)) {
    maybeCandidates = value;
  } else if (Array.isArray(value?.options)) {
    maybeCandidates = value.options;
  } else if (value?.line1 || value?.line2 || value?.line3) {
    maybeCandidates = [value];
  }

  return maybeCandidates
    .map((candidate) => ({
      line1: String(candidate?.line1 ?? '').trim(),
      line2: String(candidate?.line2 ?? '').trim(),
      line3: String(candidate?.line3 ?? '').trim(),
    }))
    .filter((candidate) => candidate.line1 && candidate.line2 && candidate.line3);
}

function truncate(value, max = 220) {
  const text = String(value ?? '');
  return text.length <= max ? text : `${text.slice(0, max)}...`;
}

async function requestBatch({ apiKey, prompt }) {
  const res = await fetch(`${OPENAI_BASE_URL}/responses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }] }],
      text: {
        format: HAIKU_RESPONSE_FORMAT,
      },
    }),
  });

  const rawBody = await res.text();

  let json = null;
  try {
    json = rawBody ? JSON.parse(rawBody) : null;
  } catch {}

  if (!res.ok) {
    const message = json?.error?.message || truncate(rawBody) || `OpenAI request failed (${res.status})`;
    throw new Error(`OpenAI request failed (${res.status}): ${message}`);
  }

  const text = extractResponseText(json);
  const parsed = parseJsonPayload(text);
  const candidates = toNormalizedCandidates(parsed);
  if (candidates.length) {
    return candidates;
  }

  const fallbackCandidates = toNormalizedCandidates(json?.output?.[0]?.content?.[0]?.json);
  if (fallbackCandidates.length) {
    return fallbackCandidates;
  }

  throw new Error(`Model returned no valid haiku options. output_text=${truncate(text)}`);
}

// ---------------- SCORING ----------------

const BANNED_PATTERNS = ['יד מחפשת', 'בקבוק ריק', 'טלפון רוטט', 'אור ניאון מרצד'];

function score(h) {
  const text = `${h.line1} ${h.line2} ${h.line3}`;

  let s = 0;

  // 🔥 HARD KILL repetition
  for (const b of BANNED_PATTERNS) {
    if (text.includes(b)) return -100;
  }

  // reward unusual words
  if (text.match(/קוף|מטריות|יונים|מזרקה|סנדלים/)) s += 5;

  // reward diversity
  const unique = new Set(text.split(' '));
  s += unique.size * 0.5;

  return s;
}

// ---------------- SAVE ----------------

async function saveHaiku(h) {
  await mkdir(path.dirname(MEMORY_FILE), { recursive: true });
  await appendFile(MEMORY_FILE, JSON.stringify({ ts: new Date().toISOString(), ...h }) + '\n');
}

// ---------------- MAIN ----------------

export async function requestHaikuFromLlm(date) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('Missing API key');

  const recent = await loadRecentHaikus(10);

  // 🔥 SINGLE request (fast) but MULTI output
  const prompt = buildPrompt({
    mood: HAIKU_MOODS[Math.floor(Math.random() * HAIKU_MOODS.length)],
    recentHaikus: recent,
    nowIso: date.toISOString(),
  });

  const candidates = await requestBatch({ apiKey, prompt });

  if (!candidates.length) {
    throw new Error('No haiku generated');
  }

  const best = candidates.sort((a, b) => score(b) - score(a))[0];

  await saveHaiku(best);

  return best;
}
