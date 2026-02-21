import { crud, initFirestore } from '../src/utils/firestore.js';
import { guid4 } from '../src/utils/guid.js';
import '../src/utils/load-env.js';

export function parseArgs(argv = process.argv.slice(2)) {
  const args = { _: [] };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];

    if (!token.startsWith('--')) {
      args._.push(token);
      continue;
    }

    const body = token.slice(2);
    const eqIndex = body.indexOf('=');

    if (eqIndex >= 0) {
      const key = body.slice(0, eqIndex);
      const value = body.slice(eqIndex + 1);
      args[key] = value;
      continue;
    }

    const key = body;
    const nextToken = argv[i + 1];

    if (!nextToken || nextToken.startsWith('--')) {
      args[key] = true;
      continue;
    }

    args[key] = nextToken;
    i += 1;
  }

  return args;
}

function parseJson(input) {
  try {
    return JSON.parse(input);
  } catch (err) {
    throw new Error(`Invalid JSON: ${input}`);
  }
}

export function parseJsonArg(input, label = 'value') {
  if (typeof input !== 'string') {
    throw new Error(`${label} must be a JSON string`);
  }

  return parseJson(input);
}

function defaultMachineId() {
  const ids = (process.env.MACHINE_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  if (ids.length > 0) {
    return ids[0];
  }

  return process.env.MACHINE_ID || '';
}

export async function addOrder(orderType, orderPayload = {}, options = {}) {
  const { machineId = defaultMachineId(), sessionId = '_launcher' } = options;

  if (!machineId) {
    throw new Error('machineId is required (pass --machineId)');
  }

  initFirestore();

  const order = Object.fromEntries(
    Object.entries({
      id: guid4(),
      ts: Date.now(),
      machineId,
      sessionId,
      orderType,
      ...orderPayload,
    }).filter(([, value]) => value !== undefined)
  );

  await crud('orders').add(order);

  console.log('Launcher order added:', JSON.stringify(order, null, 2));

  return order;
}

export async function addOrderFromArgs(orderType, orderPayload = {}) {
  const args = parseArgs();

  return addOrder(orderType, orderPayload, {
    machineId: args.machineId || args.machine || undefined,
    sessionId: args.sessionId || '_launcher',
  });
}
