import "dotenv/config";
import { listenToCollection } from "./firestore.js";
import { callbacks } from "./installations/installations_map.js";
import { setStatus } from "./led.js";   // <-- REQUIRED

const MACHINE_ID = "A-001";

let lastKnownStatus = null;

async function run() {
  console.log('Listening to Firestore collection "machines"...');
  console.log(`Machine ID: ${MACHINE_ID}`);

  listenToCollection("machines", (change) => {
    const { id, data } = change || {};
    if (id !== MACHINE_ID || !data) return;

    // 1️⃣ update last status
    lastKnownStatus = data.status || lastKnownStatus;

    // 2️⃣ call the machine-specific onChange handler
    const onChange = callbacks[MACHINE_ID];
    if (!onChange) {
      console.warn(`No onChange callback found for MACHINE_ID: ${MACHINE_ID}`);
      return;
    }

    onChange(data);
  });
}

run();

// 3️⃣ Heartbeat: refresh LED every 5 seconds
setInterval(() => {
  if (lastKnownStatus) {
    console.log("[RGB heartbeat] refreshing status:", lastKnownStatus);
    setStatus(lastKnownStatus);
  }
}, 5000);
