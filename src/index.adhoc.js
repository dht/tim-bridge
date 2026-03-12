import './utils/load-env.js';
import { listenToButton } from './utils/button.js';
import { disconnectThermalPrinter, printText } from './utils/thermal-printer.js';
import { buildHaikuPrompt, HAIKU_OUTPUT_SCHEMA } from './utils/prompt.haiku.js';

const OPENAI_MODEL = process.env.HAIKU_MODEL ?? 'gpt-5.2';
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1';
const TIME_ZONE = process.env.HAIKU_TIMEZONE ?? 'Asia/Jerusalem';
const INSTALLATION_NAME = process.env.HAIKU_INSTALLATION_NAME ?? 'המפעל';
const INSTALLATION_CITY = process.env.HAIKU_INSTALLATION_CITY ?? 'ירושלים';
const DAILY_CONTEXT = process.env.HAIKU_DAILY_CONTEXT ?? '';
const PRESS_SNOOZE_MS = 10_000;

let isRunning = false;
let snoozeUntilMs = 0;

function getResponseOutputText(responseJson = {}) {
  const directText = responseJson?.output_text;
  if (typeof directText === 'string' && directText.trim()) {
    return directText;
  }

  const outputBlocks = Array.isArray(responseJson?.output) ? responseJson.output : [];
  for (const block of outputBlocks) {
    const contentItems = Array.isArray(block?.content) ? block.content : [];
    for (const item of contentItems) {
      if (typeof item?.text === 'string' && item.text.trim()) {
        return item.text;
      }
    }
  }

  return '';
}

function sanitizePrintableText(value) {
  return String(value ?? '')
    .normalize('NFC')
    .replace(/[\u0591-\u05C7]/g, '')
    .replace(/[^\u05D0-\u05EA\u05DA\u05DD\u05DF\u05E3\u05E5\x20-\x7E\n]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function formatPrintTimestamp(date) {
  const stamp = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);

  return `${stamp} ${TIME_ZONE}`;
}

function formatHaikuTicket(haiku, date) {
  const { line1, line2, line3 } = haiku;

  return sanitizePrintableText(
    [
      'תחנת הייקו יומי',
      `${INSTALLATION_NAME} / ${INSTALLATION_CITY}`,
      '',
      line1,
      line2,
      line3,
      '',
      'תאריך:',
      formatPrintTimestamp(date),
    ].join('\n')
  );
}

async function requestHaikuFromLlm(date) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is missing.');
  }

  const prompt = buildHaikuPrompt({
    nowIso: date.toISOString(),
    installationName: INSTALLATION_NAME,
    city: INSTALLATION_CITY,
    timeZone: TIME_ZONE,
    extraContext: DAILY_CONTEXT,
  });

  const response = await fetch(`${OPENAI_BASE_URL}/responses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
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

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`OpenAI request failed (${response.status}): ${errorBody}`);
  }

  const responseJson = await response.json();
  const outputText = getResponseOutputText(responseJson);

  if (!outputText) {
    throw new Error('OpenAI response did not include output text.');
  }

  let parsed;
  try {
    parsed = JSON.parse(outputText);
  } catch (_error) {
    throw new Error('OpenAI output was not valid JSON.');
  }

  const line1 = sanitizePrintableText(parsed?.line1);
  const line2 = sanitizePrintableText(parsed?.line2);
  const line3 = sanitizePrintableText(parsed?.line3);

  if (!line1 || !line2 || !line3) {
    throw new Error('OpenAI output is missing one or more haiku lines.');
  }

  return { line1, line2, line3 };
}

async function runHaikuFlow() {
  if (isRunning) {
    console.log('Haiku generation is already running, skipping this press.');
    return;
  }

  const nowMs = Date.now();
  if (nowMs < snoozeUntilMs) {
    const remainingMs = snoozeUntilMs - nowMs;
    const remainingSeconds = Math.ceil(remainingMs / 1000);
    console.log(`Button snoozed for ${remainingSeconds}s, skipping this press.`);
    return;
  }

  isRunning = true;
  const now = new Date();

  try {
    console.log('Generating haiku...');
    const haiku = await requestHaikuFromLlm(now);
    const ticket = formatHaikuTicket(haiku, now);

    console.log('Printing haiku...');
    await printText(ticket, { variant: 'compact', lineGap: 8 });
    console.log('Printed:\n', ticket);
  } catch (error) {
    console.error('Haiku flow failed:', error?.message || error);
  } finally {
    isRunning = false;
    snoozeUntilMs = Date.now() + PRESS_SNOOZE_MS;
  }
}

async function main() {
  const stopListening = listenToButton((event) => {
    const { source, label } = event;
    const isPress = source === 'change' && label === 'PRESSED';

    if (isPress) {
      runHaikuFlow();
    }
  });

  process.on('SIGINT', async () => {
    stopListening();
    await disconnectThermalPrinter().catch(() => {});
    process.exit(0);
  });
}

main();
