import './utils/load-env.js';
import {
  connectThermalPrinter,
  disconnectThermalPrinter,
  printText,
} from './utils/thermal-printer.js';

const TEST_TEXT = ['צופר אדום', 'האבן מחזיקה נשימה', 'השמים רחוקים.'].join('\n');

async function main() {
  console.log('Printer test booting...');

  try {
    console.log('Connecting to thermal printer...');
    await connectThermalPrinter();
    console.log('Connected. Printing test text...');

    await printText(TEST_TEXT, { variant: 'compact', lineGap: 8 });

    console.log('Print complete:\n', TEST_TEXT);
  } catch (error) {
    console.error('Printer test failed:', error?.message || error);
    process.exitCode = 1;
  } finally {
    await disconnectThermalPrinter().catch(() => {});
    console.log('Disconnected from thermal printer.');
  }
}

main();
