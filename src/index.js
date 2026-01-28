import 'dotenv/config';
import { MACHINES_DEV } from './data/data.machines.js';
import { runMachine } from './listen.js';
import { initFirestore } from './utils/firestore.js';

const MACHINE_ID = process.env.MACHINE_ID;
const IS_DEV = process.env.IS_DEV;

function run() {
  initFirestore();

  if (IS_DEV) {
    Object.values(MACHINES_DEV).forEach(machine => {
      runMachine(machine.id);
    });
  } else {
    runMachine(MACHINE_ID);
  }
}

run();
