import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { listenToButton } from './utils/button.js';
import './utils/load-env.js';
import { buildHaikuPrompt, HAIKU_OUTPUT_SCHEMA } from './utils/prompt.haiku.js';
import {
  connectThermalPrinter,
  disconnectThermalPrinter,
  printText,
} from './utils/thermal-printer.js';

const OPENAI_MODEL = process.env.HAIKU_MODEL ?? 'gpt-5.2';
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1';
const TIME_ZONE = process.env.HAIKU_TIMEZONE ?? 'Asia/Jerusalem';
const INSTALLATION_NAME = process.env.HAIKU_INSTALLATION_NAME ?? 'המפעל';
const INSTALLATION_CITY = process.env.HAIKU_INSTALLATION_CITY ?? 'ירושלים';
const PRESS_SNOOZE_MS = 10_000;
const LOG_DIR = path.resolve(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'haiku-station.jsonl');

let isRunning = false;
let snoozeUntilMs = 0;
let buttonEventCount = 0;
let buttonPressCount = 0;
let flowRunCount = 0;
let lastButtonEventAtMs = 0;

async function appendHaikuLog(event, payload = {}) {
  try {
    await mkdir(LOG_DIR, { recursive: true });
    await appendFile(
      LOG_FILE,
      `${JSON.stringify({ ts: new Date().toISOString(), event, ...payload })}\n`,
      'utf8'
    );
  } catch (error) {
    console.error('Failed writing haiku log:', error?.message || error);
  }
}

function toIsoOrNull(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return null;
  }

  const date = new Date(num);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

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
  });
  await appendHaikuLog('llm_prompt', {
    model: OPENAI_MODEL,
    prompt,
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
  await appendHaikuLog('llm_output_raw', {
    outputText,
    usage: responseJson?.usage ?? null,
  });

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

  await appendHaikuLog('llm_output_parsed', { line1, line2, line3 });

  return { line1, line2, line3 };
}

async function runHaikuFlow(trigger = {}) {
  const { eventId = 'manual', pressId = 'manual' } = trigger;
  const flowId = ++flowRunCount;
  const nowMs = Date.now();
  const snoozeRemainingMs = Math.max(0, snoozeUntilMs - nowMs);

  console.log(
    `[flow:${flowId}] Triggered by event=${eventId} press=${pressId}. isRunning=${isRunning} snoozeRemainingMs=${snoozeRemainingMs}`
  );
  await appendHaikuLog('flow_triggered', {
    flowId,
    eventId,
    pressId,
    isRunning,
    snoozeRemainingMs,
  });

  if (isRunning) {
    console.log(`[flow:${flowId}] Haiku generation is already running, skipping this press.`);
    await appendHaikuLog('flow_skipped_running', { flowId, eventId, pressId });
    return;
  }

  if (snoozeRemainingMs > 0) {
    const remainingSeconds = Math.ceil(snoozeRemainingMs / 1000);
    console.log(`[flow:${flowId}] Button snoozed for ${remainingSeconds}s, skipping this press.`);
    await appendHaikuLog('flow_skipped_snooze', {
      flowId,
      eventId,
      pressId,
      snoozeRemainingMs,
      snoozeUntilIso: toIsoOrNull(snoozeUntilMs),
    });
    return;
  }

  isRunning = true;
  const now = new Date();

  try {
    console.log(`[flow:${flowId}] Generating haiku...`);
    const haiku = await requestHaikuFromLlm(now);
    const ticket = formatHaikuTicket(haiku, now);
    await appendHaikuLog('print_ticket', { flowId, ticket });

    console.log(`[flow:${flowId}] Printing haiku...`);
    await printText(ticket, { variant: 'compact', lineGap: 8 });
    console.log(`[flow:${flowId}] Printed:\n`, ticket);
  } catch (error) {
    await appendHaikuLog('flow_error', {
      flowId,
      eventId,
      pressId,
      message: error?.message || String(error),
    });
    console.error(`[flow:${flowId}] Haiku flow failed:`, error?.message || error);
  } finally {
    isRunning = false;
    snoozeUntilMs = Date.now() + PRESS_SNOOZE_MS;

    console.log(
      `[flow:${flowId}] Finished. Next accepted press after ${toIsoOrNull(snoozeUntilMs)} (${PRESS_SNOOZE_MS}ms snooze).`
    );
    await appendHaikuLog('flow_finished', {
      flowId,
      eventId,
      pressId,
      snoozeUntilIso: toIsoOrNull(snoozeUntilMs),
      pressSnoozeMs: PRESS_SNOOZE_MS,
    });
  }
}

async function preconnectPrinter() {
  try {
    console.log('Pre-connecting to thermal printer...');
    await connectThermalPrinter();
    console.log('Thermal printer is connected and ready.');
  } catch (error) {
    console.error('Thermal printer pre-connect failed:', error?.message || error);
  }
}

async function main() {
  console.log('Daily Haiku Station booting...');

  const stopListening = listenToButton((event) => {
    const { source, label, pin, value, timestamp } = event;
    const eventId = ++buttonEventCount;
    const nowMs = Date.now();
    const deltaMs = lastButtonEventAtMs > 0 ? nowMs - lastButtonEventAtMs : null;
    lastButtonEventAtMs = nowMs;

    const isPress = source === 'change' && label === 'PRESSED';
    const eventIso = toIsoOrNull(timestamp) ?? toIsoOrNull(nowMs);

    console.log(
      `[button:${eventId}] source=${source} label=${label} value=${value} pin=${pin} ts=${eventIso} deltaMs=${deltaMs ?? 'n/a'} isPress=${isPress}`
    );

    appendHaikuLog('button_event', {
      eventId,
      source,
      label,
      pin,
      value,
      eventIso,
      deltaMs,
      isPress,
    });

    if (!isPress) {
      if (source === 'change') {
        console.log(`[button:${eventId}] Ignored change event because label=${label}.`);
      }
      return;
    }

    const pressId = ++buttonPressCount;
    const snoozeRemainingMs = Math.max(0, snoozeUntilMs - nowMs);

    console.log(
      `[button:${eventId}] Accepted press #${pressId}. flowRunning=${isRunning} snoozeRemainingMs=${snoozeRemainingMs}`
    );
    appendHaikuLog('button_press_detected', {
      eventId,
      pressId,
      flowRunning: isRunning,
      snoozeRemainingMs,
    });

    runHaikuFlow({ eventId, pressId }).catch((error) => {
      console.error('runHaikuFlow failed unexpectedly:', error?.message || error);
    });
  });

  console.log('Listening for button presses...');
  await preconnectPrinter();

  process.on('SIGINT', async () => {
    stopListening();
    await disconnectThermalPrinter().catch(() => {});
    process.exit(0);
  });
}

main();
