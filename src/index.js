import 'dotenv/config';
import { turnLightsOff, turnLightsOn } from './lights.js';
import { setColor } from './rgb.js'; // import your RGB function
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
  setColor(255, 255, 255); // ocean blue
  await delay(3000);

  setColor(0, 128, 255); // ocean blue
  await delay(3000);

  // turn off
  setColor(255, 50, 0); // orange
  console.log('✅ Done.');
}

cycleColors();
