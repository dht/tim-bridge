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
const HAIKU_MOODS = ['שקט', 'מתוח', 'עייף', 'מתבונן', 'זר', 'עמוס', 'ריק'];

const STOP_WORDS = new Set([
  'את',
  'עם',
  'על',
  'של',
  'אל',
  'בלי',
  'עוד',
  'כבר',
  'אחר',
  'אחרי',
  'לפני',
  'בתוך',
  'מחוץ',
  'כמו',
  'הוא',
  'היא',
  'הם',
  'הן',
  'אני',
  'אתה',
  'אתם',
  'אנחנו',
  'היום',
  'מחר',
  'אתמול',
  'רגע',
]);

export async function loadRecentHaikus(limit = 10) {
  const collectors = [
    { file: MEMORY_FILE, parse: parseRecentFromMemoryFile },
    { file: LOG_FILE, parse: parseRecentFromStationLog },
  ];
  const haikus = [];
  const seen = new Set();

  for (const collector of collectors) {
    if (haikus.length >= limit) {
      break;
    }

    try {
      const content = await readFile(collector.file, 'utf8');
      const parsed = collector.parse(content, limit - haikus.length);

      for (const text of parsed) {
        if (!text || seen.has(text)) {
          continue;
        }

        seen.add(text);
        haikus.push(text);
        if (haikus.length >= limit) {
          break;
        }
      }
    } catch {}
  }

  return haikus;
}

const FRAGMENT_POOLS = {
  human: [
    'יד מחפשת מפתח בכיס',
    'שתי אחיות לוחשות ליד החלון',
    'שומר מפהק מול מסך קפוא',
    'צחוק קצר נחתך באמצע',
    'מישהו סופר מטבעות בכף היד',
    'כתף נוגעת בדלת זכוכית',
    'ילדה גוררת שרוול רטוב',
    'צעדים נעצרים לפני המעלית',
  ],
  object: [
    'כרטיס נסיעה מקופל',
    'כפפה אחת על ספסל',
    'עט בלי מכסה',
    'שקית נייר לחה',
    'מטרייה הפוכה ליד הדלת',
    'אוזנייה בודדת בין כיסאות',
    'ספל קפה עם שפה סדוקה',
    'מטען מסובב סביב רגל שולחן',
  ],
  space: [
    'אור ניאון מרצד בתקרה',
    'חלון עם אדים דקים',
    'רצפה עם סימני מים',
    'פינה קרה במסדרון',
    'אוויר יבש של מזגן',
    'הדהוד מתחת לתקרה נמוכה',
    'כתם אור נע על הקיר',
    'וילון נושם מרוח דקה',
  ],
  signal: [
    'צפצוף דלת נסגרת',
    'טלפון רוטט בתיק סגור',
    'נקישת מתכת קצרה',
    'קריאה עמומה מהרמקול',
    'גלגלים חורקים מרחוק',
    'זמזום קבוע של מנוע',
    'שעון דיגיטלי מהבהב',
    'מעלית נעצרת בין קומות',
  ],
};

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildFragments(bannedTerms) {
  return [
    pickFragment(FRAGMENT_POOLS.human, bannedTerms),
    pickFragment(FRAGMENT_POOLS.object, bannedTerms),
    pickFragment(FRAGMENT_POOLS.space, bannedTerms),
    pickFragment(FRAGMENT_POOLS.signal, bannedTerms),
  ];
}

function buildPrompt({ fragments, mood, recentHaikus, bannedTerms, nowIso }) {
  const recentSection = recentHaikus.length
    ? recentHaikus.map((haiku, index) => `${index + 1}. ${haiku}`).join('\n')
    : 'אין שירים קודמים.';
  const bannedTermsSection = bannedTerms.length ? bannedTerms.join(', ') : 'אין';

  return `
# משימה

כתוב הייקו עברי אחד בלבד.

## חוקים קשיחים

- בדיוק 3 שורות
- רגע קונקרטי אחד בלבד
- בלי שימוש במילים: אני / קיר / בניין / אבן
- בלי הסבר או מוסר השכל
- בלי רשימת אפשרויות, רק שיר אחד

## רשמי חושים

${fragments.join(', ')}

## מצב רוח

${mood}

## מילים אסורות

אל תשתמש במילים הבאות בשום שורה:
${bannedTermsSection}

## שירים אחרונים להימנעות מחזרה

${recentSection}

## איכות

- פרט מוזר עדיף על יופי צפוי
- התחל מתופעה קטנה ולא מזהות המספר
- הקפד שהדימוי המרכזי יהיה חדש ביחס לשירים הקודמים

## פורמט פלט

JSON בלבד:
{ "line1": "...", "line2": "...", "line3": "..." }

חותמת זמן: ${nowIso}
`;
}

async function requestSingleHaiku({ apiKey, prompt }) {
  const response = await fetch(`${OPENAI_BASE_URL}/responses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 1.0,
      top_p: 0.9,
      presence_penalty: 1.1,
      frequency_penalty: 1.0,
      input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }] }],
      text: {
        format: {
          type: 'json_schema',
          name: 'daily_haiku_single',
          schema: HAIKU_OUTPUT_SCHEMA,
        },
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Haiku request failed (${response.status}): ${body.slice(0, 200)}`);
  }

  const json = await response.json();
  const parsed = parseHaikuFromResponse(json);

  if (!parsed) {
    throw new Error('No valid haiku in response');
  }

  return parsed;
}

export const HAIKU_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['line1', 'line2', 'line3'],
  properties: {
    line1: { type: 'string', minLength: 2, maxLength: 120 },
    line2: { type: 'string', minLength: 2, maxLength: 120 },
    line3: { type: 'string', minLength: 2, maxLength: 120 },
  },
};

function parseHaikuFromResponse(responseJson) {
  const outputParsedCandidate = coerceHaiku(responseJson?.output_parsed);
  if (outputParsedCandidate) {
    return outputParsedCandidate;
  }

  const outputBlocks = Array.isArray(responseJson?.output) ? responseJson.output : [];
  for (const block of outputBlocks) {
    const contentItems = Array.isArray(block?.content) ? block.content : [];
    for (const item of contentItems) {
      const parsedCandidate = coerceHaiku(item?.parsed);
      if (parsedCandidate) {
        return parsedCandidate;
      }

      if (typeof item?.text !== 'string' || !item.text.trim()) {
        continue;
      }

      const fromText = parseHaikuText(item.text);
      if (fromText) {
        return fromText;
      }
    }
  }

  if (typeof responseJson?.output_text === 'string' && responseJson.output_text.trim()) {
    return parseHaikuText(responseJson.output_text);
  }

  return null;
}

function parseHaikuText(text) {
  try {
    return coerceHaiku(JSON.parse(text));
  } catch {
    return null;
  }
}

function coerceHaiku(candidate) {
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  const line1 = String(candidate.line1 ?? '').trim();
  const line2 = String(candidate.line2 ?? '').trim();
  const line3 = String(candidate.line3 ?? '').trim();

  if (!line1 || !line2 || !line3) {
    return null;
  }

  return { line1, line2, line3 };
}

function pickFragment(pool, bannedTerms) {
  const filtered = pool.filter((fragment) => !containsBannedTerms(fragment, bannedTerms));
  return pickRandom(filtered.length ? filtered : pool);
}

function containsBannedTerms(text, bannedTerms) {
  return bannedTerms.some((term) => text.includes(term));
}

function normalizeHaikuText(line1, line2, line3) {
  return [line1, line2, line3].join(' ').replace(/\s+/g, ' ').trim();
}

function parseRecentFromStationLog(content, limit) {
  const lines = content.split('\n');
  const out = [];

  for (let i = lines.length - 1; i >= 0 && out.length < limit; i--) {
    const raw = lines[i].trim();
    if (!raw) {
      continue;
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }

    const event = parsed?.event;
    if (event === 'llm_output_parsed') {
      const haiku = coerceHaiku(parsed);
      if (haiku) {
        out.push(normalizeHaikuText(haiku.line1, haiku.line2, haiku.line3));
      }
      continue;
    }

    if (event !== 'print_ticket' || typeof parsed?.ticket !== 'string') {
      continue;
    }

    const ticketLines = parsed.ticket
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    const ticketHaiku = coerceHaiku({
      line1: ticketLines[0],
      line2: ticketLines[1],
      line3: ticketLines[2],
    });
    if (ticketHaiku) {
      out.push(normalizeHaikuText(ticketHaiku.line1, ticketHaiku.line2, ticketHaiku.line3));
    }
  }

  return out;
}

function parseRecentFromMemoryFile(content, limit) {
  const lines = content.split('\n');
  const out = [];

  for (let i = lines.length - 1; i >= 0 && out.length < limit; i--) {
    const raw = lines[i].trim();
    if (!raw) {
      continue;
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }

    const haiku = coerceHaiku(parsed);
    if (haiku) {
      out.push(normalizeHaikuText(haiku.line1, haiku.line2, haiku.line3));
    }
  }

  return out;
}

function tokenizeContentWords(text) {
  return String(text ?? '')
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token) && !/^\d+$/.test(token));
}

function buildBannedTerms(recentHaikus, maxTerms = 10) {
  if (!recentHaikus.length) {
    return [];
  }

  const counts = new Map();
  for (const haiku of recentHaikus) {
    const tokens = tokenizeContentWords(haiku);
    for (const token of tokens) {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }

  const repeatedTerms = [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([token]) => token);

  const latestTerms = tokenizeContentWords(recentHaikus[0]);
  const merged = [...repeatedTerms, ...latestTerms];

  return [...new Set(merged)].slice(0, maxTerms);
}

async function appendParsedHaikuToMemory(haiku, meta = {}) {
  const memoryPayload = {
    ts: new Date().toISOString(),
    event: 'haiku_memory',
    line1: haiku.line1,
    line2: haiku.line2,
    line3: haiku.line3,
    ...meta,
  };

  const stationPayload = { ...memoryPayload, event: 'llm_output_parsed' };
  await Promise.allSettled([
    appendJsonLine(MEMORY_FILE, memoryPayload),
    appendJsonLine(LOG_FILE, stationPayload),
  ]);
}

async function appendJsonLine(file, payload) {
  try {
    await mkdir(path.dirname(file), { recursive: true });
    await appendFile(file, `${JSON.stringify(payload)}\n`, 'utf8');
  } catch {}
}

export async function requestHaikuFromLlm(date) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing API key');
  }

  const recent = await loadRecentHaikus(12);
  const bannedTerms = buildBannedTerms(recent);
  const fragments = buildFragments(bannedTerms);

  const prompt = buildPrompt({
    fragments,
    mood: pickRandom(HAIKU_MOODS),
    recentHaikus: recent,
    bannedTerms,
    nowIso: date.toISOString(),
  });

  const haiku = await requestSingleHaiku({ apiKey, prompt });
  await appendParsedHaikuToMemory(haiku, {
    model: OPENAI_MODEL,
    banned_terms: bannedTerms,
  });

  return haiku;
}
