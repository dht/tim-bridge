import fs from 'fs-extra';
import { crud, initFirestore } from '../src/utils/firestore.js';
import { guid4 } from '../src/utils/guid.js';

const REMOVE_CACHE = true;

initFirestore();

function run() {
  // remove cache
  if (REMOVE_CACHE) {
    fs.rmSync('./cache', { recursive: true, force: true });
  }

  crud('orders').add({
    id: guid4(),
    ts: Date.now(),
    machineId: 'A-002-dev',
    sessionId: '_test',
    orderType: 'PLAY',
  });
}

run();
