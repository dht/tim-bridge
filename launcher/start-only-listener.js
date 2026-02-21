import { handleLauncherOrder } from '../src/launcher/handlers.js';
import { LAUNCHER_ORDER_TYPES, normalizeOrderType } from '../src/launcher/order-types.js';
import { initFirestore, listenToCollection } from '../src/utils/firestore.js';
import '../src/utils/load-env.js';

const MACHINE_IDS = (process.env.MACHINE_IDS || '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);

const machineIdSet = new Set(MACHINE_IDS);

if (machineIdSet.size === 0) {
  console.error('launcher/start-only-listener: MACHINE_IDS is empty');
  process.exit(1);
}

initFirestore();

console.log(
  `launcher/start-only-listener running for machines: ${Array.from(machineIdSet).join(', ')}`
);

listenToCollection('orders', (ev = {}) => {
  const { data: order } = ev;

  if (!order) {
    return;
  }

  const { machineId } = order;

  if (!machineIdSet.has(machineId)) {
    return;
  }

  const normalizedType = normalizeOrderType(order.orderType);

  if (normalizedType !== LAUNCHER_ORDER_TYPES.START_PM2) {
    return;
  }

  void handleLauncherOrder(order, {
    worker: 'launcher-start-only',
    allowTypes: [LAUNCHER_ORDER_TYPES.START_PM2],
  }).catch((err) => {
    console.error('launcher/start-only-listener failed to handle START_PM2:', err);
  });
});
