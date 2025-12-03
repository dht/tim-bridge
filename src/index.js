import "dotenv/config";
import { listenToCollection } from "./firestore.js";
import { callbacks } from "./installations/installations_map.js";

const MACHINE_ID = "A-001";

async function run() {
  console.log('Listening to Firestore collection "machines"...');
  console.log(`Machine ID: ${MACHINE_ID}`);

  listenToCollection("machines", (change) => {
    const { id, data } = change || {};
    if (id !== MACHINE_ID || !data) return;

    const onChange = callbacks[MACHINE_ID];

    if (!onChange) {
      console.warn(`No onChange callback found for MACHINE_ID: ${MACHINE_ID}`);
      return;
    }

    onChange(data);
  });
}

run();


let lastKnownStatus = null;

// Hook into every machine update to store the latest status
listenToCollection("machines", (change) => {
  const { id, data } = change || {};
  if (id !== MACHINE_ID || !data) return;
  lastKnownStatus = data.status || lastKnownStatus;
});

// Every 5s ensure LED animation matches the saved status
setInterval(() => {
  if (lastKnownStatus) {
    setStatus(lastKnownStatus);   // this will pulse / blink / solid according to led.js
  }
}, 5000);
