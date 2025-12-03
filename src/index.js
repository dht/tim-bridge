import "dotenv/config";
import { listenToCollection } from "./firestore.js";
import { callbacks } from "./installations/installations_map.js";
import { setStatus } from "./rgb.js";   // <-- your renamed file

const MACHINE_ID = "A-001";

let lastKnownStatus = null;

async function run() {
  console.log('Listening to Firestore collection "machines"...');
  console.log(`Machine ID: ${MACHINE_ID}`);

  listenToCollection("machines", (change) => {
    const { id, data } = change || {};
    if (id !== MACHINE_ID || !data) return;

    // Save current Firestore LED status
    lastKnownStatus = data.status || lastKnownStatus;

    // Find and run device-specific handler
    const onChange = callbacks[MACHINE_ID];
    if (!onChange) {
      console.warn(`No onChange callback found for MACHINE_ID: ${MACHINE_ID}`);
      return;
    }

    onChange(data);
  });
}

run();

// ---------------------------------------------------------
// HEARTBEAT: refresh RGB every 5 seconds
// ---------------------------------------------------------
console.log("💓 Heartbeat started.");

setInterval(() => {
  console.log("💓 Tick");

  if (lastKnownStatus) {
    console.log("[RGB heartbeat] refreshing status:", lastKnownStatus);
    setStatus(lastKnownStatus);
  }
}, 5000);
