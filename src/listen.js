import { onBridgeOpen } from './lifecycle/index.js';
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

    switch (order.orderType) {
      case 'PLAY':
        playOrder(order);
        break;
      case 'STOP':
        stopOrder(order);
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
