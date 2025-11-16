// firebase.ts
import { getApp, getApps, initializeApp } from "@firebase/app";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  onSnapshot,
  setDoc,
} from "@firebase/firestore";

let app = null;
let db = null;

export const init = (firebaseConfig) => {
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  db = getFirestore(app);
};

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

init(firebaseConfig);

export function listenToCollection(name, callback) {
  const collectionRef = collection(db, name);
  let isInitialLoad = true;

  const unsubscribe = onSnapshot(collectionRef, (snapshot) => {
    if (isInitialLoad) {
      // skip initial batch of 'added' events
      isInitialLoad = false;
      return;
    }

    snapshot.docChanges().forEach((change) => {
      const id = change.doc.id;
      const data = change.doc.data();

      if (change.type === "added") {
        callback({ type: "create", id, data });
      } else if (change.type === "modified") {
        callback({ type: "update", id, data });
      } else if (change.type === "removed") {
        callback({ type: "delete", id });
      }
    });
  });

  return unsubscribe;
}

export function crud(collectionName) {
  return {
    add: async (values) => {
      const valuesWithTs = {
        ...values,
        clientTs: Date.now(),
      };

      const ref = doc(collection(db, collectionName), values.id);
      await setDoc(ref, valuesWithTs, { merge: false });
    },
    update: async (id, change) => {
      const ref = doc(db, collectionName, id);

      const newChange = {
        clientTs: Date.now(),
        ...change,
      };

      await setDoc(ref, newChange, { merge: true });
    },
    delete: async (id) => {
      const ref = doc(db, collectionName, id);
      await deleteDoc(ref);
    },
    listen: (callback) => {
      return listenToCollection(collectionName, callback);
    },
  };
}

export async function clearCollection(name) {
  const collectionRef = collection(db, name);
  // Note: Firestore does not support direct collection deletion.
  // You would need to delete documents individually or use a batch operation.
  console.log(`Clearing collection: ${name}`);
  // Implement as needed.
  const snapshot = await getDocs(collectionRef);
  snapshot.forEach(async (doc) => {
    await deleteDoc(doc.ref);
  });
}

/*
const INSTALLATION_ID = 'TS-001';
const FRESH_WINDOW_MS = 30_000; // 30s



process.on('SIGINT', () => {
  stopAudio();
  process.exit(0);
});
process.on('SIGTERM', () => {
  stopAudio();
  process.exit(0);
});

function run() {
  console.log('Listening to Firestore collection "installations"...');
  console.log(`Installation ID: ${INSTALLATION_ID}`);

  listenToCollection('machines', (change) => {
    const { id, data } = change || {};
    if (id !== INSTALLATION_ID || !data) return;

    const { mp3Url, mp3UrlChangeTs } = data;
    const delta = Date.now() - mp3UrlChangeTs;
    console.log('mp3Url:', mp3Url, 'delta(ms):', delta);

    if (mp3Url && delta < FRESH_WINDOW_MS) {
      // simply play the latest url (replaces any current playback)
      playMp3(mp3Url);
    }
  });
}

*/
