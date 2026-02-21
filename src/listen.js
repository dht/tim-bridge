import { onBridgeOpen } from './lifecycle/index.js';
import { handleLauncherOrder } from './launcher/handlers.js';
import { isLauncherOrderType, normalizeOrderType } from './launcher/order-types.js';
import { playTimelineGenerating } from './utils/timeline.elevator.js';
import { listenToCollection, listenToDoc } from './utils/firestore.js';
import { getIp } from './utils/ip.js';
import { playOrder, stopOrder } from './utils/orders.js';

export async function startMachine(id) {
  const ip = await getIp();

  onBridgeOpen(id, { ip });

  // main flow - PLAY and STOP orders
  listenToCollection('orders', (ev) => {
    const { data: order } = ev;
    const { machineId } = order ?? {};

    if (machineId !== id) {
      return;
    }

    const orderType = normalizeOrderType(order?.orderType);

    switch (orderType) {
      case 'PLAY':
        playOrder(order);
        break;
      case 'STOP':
        stopOrder(order);
        break;
      default:
        if (isLauncherOrderType(orderType)) {
          void handleLauncherOrder(order, { worker: 'bridge-main' }).catch((err) => {
            console.error('Failed to handle launcher order:', err);
          });
        }
        break;
    }
  });

  // elevator generating timeline handling
  listenToDoc('machines', id, (ev) => {
    const { data: machineState } = ev;
    const { serverState } = machineState ?? {};

    switch (serverState) {
      case 'GENERATING':
        playTimelineGenerating(id);
        break;
    }
  });
}
