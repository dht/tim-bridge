import { onBridgeOpen } from './lifecycle/index.js';
import { listenToCollection } from './utils/firestore.js';
import { getIp } from './utils/ip.js';
import { playOrder, stopOrder } from './utils/orders.js';

export async function startMachine(id) {
  console.log('Starting', id);

  const ip = await getIp();

  onBridgeOpen(id, { ip });

  // main flow - PLAY and STOP orders
  listenToCollection('orders', (ev) => {
    const { data: order } = ev;
    const { machineId } = order ?? {};

    if (machineId !== id) {
      console.log('Ignoring order for machine:', machineId);
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
  listenToCollection('machines', (ev) => {
    const { data: machineState } = ev;
    const { serverState } = machineState ?? {};

    if (ev.id !== id) {
      console.log('Ignoring machine change for machine:', ev.id);
      return;
    }

    switch (serverState) {
      case 'GENERATING':
        playTimelineGenerating(id);
        break;
    }
  });
}
