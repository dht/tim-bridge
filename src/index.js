import 'dotenv/config';
import { turnLightsOff, turnLightsOn } from './lights.js';
import { delay } from './utils.js';

async function main() {
  await delay(1000);
  turnLightsOn();
  await delay(2000);
  turnLightsOff();
  // await delay(2000);
  // spinMotor();
  // await delay(2000);
  // stopMotor();
}

// run();
main();
