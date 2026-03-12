import { listenToButton } from './utils/button.js';

let eventCount = 0;
let pressCount = 0;
let lastEventAtMs = 0;

function toIsoOrNow(value) {
  const num = Number(value);
  if (Number.isFinite(num)) {
    const date = new Date(num);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  return new Date().toISOString();
}

console.log('Button test listener booting...');
console.log('Press the hardware button. Use Ctrl+C to exit.');

const stopListening = listenToButton((event) => {
  const { source, label, pin, value, timestamp } = event;
  const eventId = ++eventCount;
  const nowMs = Date.now();
  const deltaMs = lastEventAtMs > 0 ? nowMs - lastEventAtMs : null;
  lastEventAtMs = nowMs;

  const isPress = source === 'change' && label === 'PRESSED';
  const eventIso = toIsoOrNow(timestamp);

  console.log(
    `[test.button][event:${eventId}] source=${source} label=${label} value=${value} pin=${pin} ts=${eventIso} deltaMs=${deltaMs ?? 'n/a'} isPress=${isPress}`
  );

  if (isPress) {
    pressCount += 1;
    console.log(`[test.button] PRESS DETECTED (#${pressCount})`);
  }
});

process.on('SIGINT', () => {
  console.log('\nStopping button test listener...');
  stopListening();
  process.exit(0);
});
