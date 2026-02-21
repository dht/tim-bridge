import { LAUNCHER_ORDER_TYPES } from '../src/launcher/order-types.js';
import { addOrder, parseArgs } from './add-order.utils.js';

const args = parseArgs();

await addOrder(
  LAUNCHER_ORDER_TYPES.START_PM2,
  {
    pm2AppName: args.pm2AppName || args.app || undefined,
  },
  {
    machineId: args.machineId || args.machine,
    sessionId: args.sessionId || '_launcher',
  }
);
