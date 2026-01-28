import { crud } from '../src/utils/firestore';
import { guid4 } from '../src/utils/guid';

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
    sessionId: '372e',
    orderType: 'PLAY',
  });
}

run();
