// playground/led.demo.js
import { setState } from './led.js';

// Immediately-invoked async wrapper
(async () => {
  console.log('Setting LED state: IDLE (cyan-green breathing)…');
  await setState('IDLE');
})();
