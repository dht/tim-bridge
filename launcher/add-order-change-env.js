import { LAUNCHER_ORDER_TYPES } from '../src/launcher/order-types.js';
import { addOrder, parseArgs, parseJsonArg } from './add-order.utils.js';

function parseAssignments(items = []) {
  const output = {};

  items.forEach((token) => {
    const index = token.indexOf('=');

    if (index <= 0) {
      return;
    }

    const key = token.slice(0, index).trim();
    const value = token.slice(index + 1);

    if (!key) {
      return;
    }

    output[key] = value;
  });

  return output;
}

const args = parseArgs();
let values = {};

if (args.values) {
  values = {
    ...values,
    ...parseJsonArg(args.values, '--values'),
  };
}

values = {
  ...values,
  ...parseAssignments(args._),
};

if (Object.keys(values).length === 0) {
  throw new Error(
    'Usage: node launcher/add-order-change-env.js --machineId <id> --values "{\"MODE\":\"FULL\"}" or KEY=VALUE'
  );
}

await addOrder(
  LAUNCHER_ORDER_TYPES.CHANGE_ENV,
  {
    values,
  },
  {
    machineId: args.machineId || args.machine,
    sessionId: args.sessionId || '_launcher',
  }
);
