import { crud, initFirestore } from '../src/utils/firestore.js';
import { guid4 } from '../src/utils/guid.js';

initFirestore();
/*
    type IBridgeOrder = {
        id: string;
        ts: number;
        machineId: string;
        sessionId?: string; // preset: _milki | new: R8F2
        orderType: BridgeOrderType;
    };
*/

function run() {
  crud('orders').add({
    id: guid4(),
    ts: Date.now(),
    machineId: 'A-001-dev',
    sessionId: '_milki',
    orderType: 'PLAY',
  });
}

run();
