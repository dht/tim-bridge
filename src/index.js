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


async function rgb() {
  console.log('💡 Starting RGB sequence...');
  await delay(1000);

  // turn purple (red + blue)
  setColor(true, false, true);
  await delay(2000);

  // turn off
  setColor(false, false, false);
  console.log('✅ Done.');
}

// run();
rgb();
