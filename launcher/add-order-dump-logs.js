import { LAUNCHER_ORDER_TYPES } from '../src/launcher/order-types.js';
import { addOrder, parseArgs } from './add-order.utils.js';

const args = parseArgs();
const rawLines = args.lines || args._[0] || 30;
const lines = Number(rawLines);

if (!Number.isFinite(lines)) {
  throw new Error(`Invalid lines value: ${rawLines}`);
}

await addOrder(
  LAUNCHER_ORDER_TYPES.DUMP_LOGS,
  {
    lines,
    pm2AppName: args.pm2AppName || args.app || undefined,
  },
  {
    machineId: args.machineId || args.machine,
    sessionId: args.sessionId || '_launcher',
  }
);
