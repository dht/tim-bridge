// playground/led.demo.js
import { setState, resetLED } from './led.js';

// All modes to cycle through
const MODES = [
  'IDLE',
  'GENERATING',
  'LISTENING',
  'SPEAKING',         // optional if you add an effect
  'ERROR-NOINTERNET',
];

// Sleep helper
function sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
}

// Cleanup on Ctrl-C (or kill)
process.on('SIGINT', () => {
  console.log("\n🔌 Cleaning up GPIOs (turning LED OFF)...");
  resetLED();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log("\n🔌 Cleaning up GPIOs (turning LED OFF)...");
  resetLED();
  process.exit(0);
});

// Main loop
(async () => {
  console.log("🌈 Cycling LED modes every 10 seconds...\n");

  while (true) {
    for (const mode of MODES) {
      console.log(`→ Switching to: ${mode}`);

      // start animation (runs in background)
      setState(mode);

      // keep this mode for 10 seconds
      await sleep(10_000);
    }
  }
})();
