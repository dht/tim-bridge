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
// FIRESTORE POLLING EVERY 10 SECONDS
// ---------------------------------------------------------
setInterval(async () => {
  try {
    const ref = doc(db, "machines", MACHINE_ID);
    const snapshot = await getDoc(ref);

    if (!snapshot.exists()) return;

    const data = snapshot.data();
    const status = data.status;

    console.log("🔄 Polling: Firestore status =", status);

    if (status) {
      lastKnownStatus = status;
      setStatus(status);
    }

  } catch (err) {
    console.error("❌ Polling Firestore error:", err);
  }
}, 10_000);
