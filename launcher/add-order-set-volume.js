import { LAUNCHER_ORDER_TYPES } from '../src/launcher/order-types.js';
import { addOrder, parseArgs } from './add-order.utils.js';

const args = parseArgs();
const rawValue = args.value || args.volume || args._[0];

if (rawValue === undefined) {
  throw new Error('Usage: node launcher/add-order-set-volume.js --machineId <id> --value <0-100>');
}

const value = Number(rawValue);

if (!Number.isFinite(value)) {
  throw new Error(`Invalid volume value: ${rawValue}`);
}

await addOrder(
  LAUNCHER_ORDER_TYPES.SET_VOLUME,
  {
    value,
  },
  {
    machineId: args.machineId || args.machine,
    sessionId: args.sessionId || '_launcher',
  }
);
