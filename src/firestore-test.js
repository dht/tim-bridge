const admin = require("firebase-admin");
require("dotenv").config();
const fs = require("fs-extra");

var serviceAccount = require("./service_account.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://tim-os-default-rtdb.firebaseio.com",
});

// fetch all the firestore data
const { getFirestore } = require("firebase-admin/firestore");
const db = getFirestore();

async function changeMachine(machineId, change) {
  const ref = db.collection("machines").doc(machineId);
  await ref.set(change, { merge: true });
  console.log(`Updated machine "${machineId}" with:`, change);
}

async function main() {
  const itemId = "A-001";

  const change = {
    lightStatus: "TWO", // ONE, TWO, NONE or BOTH
    mp3Url: "https://tim-os.web.app/voice3.mp3",
    mp3UrlTs: Date.now(),
  };

  await changeMachine(itemId, change);

  console.log("✅ Done");
}

main().catch(console.error);
