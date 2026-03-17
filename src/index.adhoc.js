import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { listenToButton } from './utils/button.js';
import './utils/load-env.js';
import { requestHaikuFromLlm } from './utils/prompt.haiku.js';
import {
  connectThermalPrinter,
  disconnectThermalPrinter,
  printText,
} from './utils/thermal-printer.js';

const PRESS_SNOOZE_MS = 10_000;
const PRINTER_HEALTHCHECK_MS = 15_000;
const PRINTER_RETRY_BACKOFF_MS = 60_000;
const PRINTER_RETRY_BACKOFF_AFTER_ATTEMPTS = 10;
const LOG_DIR = path.resolve(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'haiku-station.jsonl');
const FLOW_START_PRINT_MESSAGES = [
  'מחבר שיר חדש זה לוקח בערך 01 שניות',
  'רגע קטן של קסם בדרך להדפסה',
  'מקשיב לרגע ומרכיב שיר טרי',
  'עוד נשימה והשיר אצלך',
  'מחפש מילים שמתאימות לרגע הזה',
  'השיר מתחמם על אש קטנה',
  'בונה הייקו חדש מהאוויר',
  'עוד כמה שניות ויש שיר טרי',
  'מכין לך השראה ממש עכשיו',
  'המדפסת מתכוננת לשיר הבא',
];

let isRunning = false;
let snoozeUntilMs = 0;
let buttonEventCount = 0;
let buttonPressCount = 0;
let flowRunCount = 0;
let lastButtonEventAtMs = 0;
let keepPrinterConnectionAlive = true;
let printerConnectionLoopPromise = null;

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

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getPrinterRetryDelayMs(consecutiveFailures) {
  if (consecutiveFailures > PRINTER_RETRY_BACKOFF_AFTER_ATTEMPTS) {
    return PRINTER_RETRY_BACKOFF_MS;
  }

  return 0;
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

function formatHaikuTicket(haiku) {
  const { line1, line2, line3 } = haiku;

  return sanitizePrintableText([line1, line2, line3].join('\n'));
}

function pickRandomStartMessage() {
  const index = Math.floor(Math.random() * FLOW_START_PRINT_MESSAGES.length);
  return FLOW_START_PRINT_MESSAGES[index];
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
    const statusTicket = sanitizePrintableText(pickRandomStartMessage());

    try {
      console.log(`[flow:${flowId}] Printing status ticket...`);
      await printText(statusTicket, { variant: 'mini', lineGap: 4 });
      await appendHaikuLog('print_status_ticket', { flowId, statusTicket });
    } catch (statusError) {
      await appendHaikuLog('print_status_ticket_failed', {
        flowId,
        message: statusError?.message || String(statusError),
      });
      console.error(
        `[flow:${flowId}] Failed to print status ticket:`,
        statusError?.message || statusError
      );
    }

    console.log(`[flow:${flowId}] Generating haiku...`);
    const haiku = await requestHaikuFromLlm(now);
    const ticket = formatHaikuTicket(haiku);
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

async function runPrinterConnectionLoop() {
  let consecutiveFailures = 0;
  let hasConnected = false;

  console.log('Starting thermal printer connection loop...');

  while (keepPrinterConnectionAlive) {
    try {
      await connectThermalPrinter();

      if (!hasConnected || consecutiveFailures > 0) {
        console.log('Thermal printer is connected and ready.');
        await appendHaikuLog('printer_connected', {
          consecutiveFailures,
        });
      }

      hasConnected = true;
      consecutiveFailures = 0;
      await delay(PRINTER_HEALTHCHECK_MS);
    } catch (error) {
      consecutiveFailures += 1;
      hasConnected = false;

      const retryDelayMs = getPrinterRetryDelayMs(consecutiveFailures);
      const retryInSeconds = Math.ceil(retryDelayMs / 1000);

      console.error(
        `Thermal printer connection attempt ${consecutiveFailures} failed:`,
        error?.message || error
      );
      await appendHaikuLog('printer_connect_failed', {
        consecutiveFailures,
        retryDelayMs,
        message: error?.message || String(error),
      });

      if (!keepPrinterConnectionAlive) {
        break;
      }

      if (retryDelayMs > 0) {
        console.log(`Retrying thermal printer connection in ${retryInSeconds}s...`);
        await delay(retryDelayMs);
      }
    }
  }
}

function startPrinterConnectionLoop() {
  if (printerConnectionLoopPromise) {
    return printerConnectionLoopPromise;
  }

  printerConnectionLoopPromise = runPrinterConnectionLoop().finally(() => {
    printerConnectionLoopPromise = null;
  });

  return printerConnectionLoopPromise;
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
  startPrinterConnectionLoop().catch((error) => {
    console.error('Thermal printer connection loop stopped unexpectedly:', error?.message || error);
  });

  process.on('SIGINT', async () => {
    keepPrinterConnectionAlive = false;
    stopListening();
    await disconnectThermalPrinter().catch(() => {});
    process.exit(0);
  });
}

main();
