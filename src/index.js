import 'dotenv/config';
import { initFirestore, listenToCollection } from './utils/firestore.js';
import { playOrder, stopOrder } from './utils/orders.js';
import { playTimelineGenerating } from './utils/timeline.elevator.js';

const MACHINE_ID = process.env.MACHINE_ID;

function runMachine(id) {
  console.log('Starting', id);

  // main flow - PLAY and STOP orders
  listenToCollection('orders', ev => {
    const { data: order } = ev;
    const { machineId } = order ?? {};

    if (machineId !== id) {
      console.log('Ignoring order for machine:', id);
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
  listenToCollection('machines', ev => {
    const { data: machineState } = ev;
    const { serverState } = machineState ?? {};

    if (machineId !== id) {
      console.log('Ignoring machine change for machine:', machineId);
      return;
    }

    switch (serverState) {
      case 'GENERATING':
        playTimelineGenerating(id);
        break;
    }
  });
}

function run() {
  initFirestore();

  runMachine(MACHINE_ID);
}

run();
