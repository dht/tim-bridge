// firebase.ts
import { initializeApp } from '@firebase/app';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  onSnapshot,
  setDoc,
} from '@firebase/firestore';
import 'dotenv/config';

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY ?? process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN ?? process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID ?? process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET ?? process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId:
    process.env.FIREBASE_MESSAGING_SENDER_ID ?? process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID ?? process.env.VITE_FIREBASE_APP_ID,
};

// console.log('Firebase config:', firebaseConfig);

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export function listenToCollection(name, callback) {
  if (!name) {
    throw new Error('listenToCollection requires a collection name');
  }
  if (typeof callback !== 'function') {
    throw new Error('listenToCollection requires a callback function');
  }

  const collectionRef = collection(db, name);
  let isInitialLoad = true;

  const unsubscribe = onSnapshot(collectionRef, snapshot => {
    if (isInitialLoad) {
      // skip initial batch of 'added' events
      isInitialLoad = false;
      return;
    }

    snapshot.docChanges().forEach(change => {
      const id = change.doc.id;
      const data = change.doc.data();

      if (change.type === 'added') {
        callback({ type: 'create', id, data });
      } else if (change.type === 'modified') {
        callback({ type: 'update', id, data });
      } else if (change.type === 'removed') {
        callback({ type: 'delete', id });
      }
    });
  });

  return unsubscribe;
}

export function crud(collectionName) {
  return {
    add: async values => {
      if (!values) {
        throw new Error('crud.add requires a values object');
      }

      const { id, ...rest } = values;
      const collectionRef = collection(ensureInitialized(), collectionName);
      const ref = id ? doc(collectionRef, id) : doc(collectionRef);

      const valuesWithTs = {
        ...rest,
        id: id ?? ref.id,
        clientTs: Date.now(),
      };

      await setDoc(ref, valuesWithTs, { merge: false });
      return ref.id;
    },
    update: async (id, change) => {
      if (!id) {
        throw new Error('crud.update requires a document id');
      }
      const ref = doc(ensureInitialized(), collectionName, id);

      const newChange = {
        clientTs: Date.now(),
        ...change,
      };

      await setDoc(ref, newChange, { merge: true });
    },
    delete: async id => {
      if (!id) {
        throw new Error('crud.delete requires a document id');
      }
      const ref = doc(ensureInitialized(), collectionName, id);
      await deleteDoc(ref);
    },
    listen: callback => {
      return listenToCollection(collectionName, callback);
    },
  };
}

export async function clearCollection(name) {
  const collectionRef = collection(ensureInitialized(), name);
  // Note: Firestore does not support direct collection deletion.
  // You would need to delete documents individually or use a batch operation.
  console.log(`Clearing collection: ${name}`);
  const snapshot = await getDocs(collectionRef);
  await Promise.all(snapshot.docs.map(doc => deleteDoc(doc.ref)));
}

export function listenToCollectionLongPull(collectionName, onChange, options = {}) {
  const db = getFirestore();

  // User-configurable polling interval, default 3000ms
  const interval = options.interval || 3000;

  // Cache of last seen data so we only fire callbacks on actual changes
  let lastState = new Map();
  let isRunning = true;

  async function poll() {
    if (!isRunning) return;

    try {
      const ref = collection(db, collectionName);
      const snapshot = await getDocs(ref);

      snapshot.forEach(doc => {
        const id = doc.id;
        const data = doc.data();

        const cached = lastState.get(id);
        const serialized = JSON.stringify(data);

        // Only send event if the document changed
        if (!cached || cached !== serialized) {
          lastState.set(id, serialized);

          onChange({
            id,
            data,
            source: 'long-poll',
          });
        }
      });
    } catch (err) {
      console.error('❌ Long-poll Firestore error:', err);
    }

    setTimeout(poll, interval);
  }

  poll();

  return {
    stop() {
      isRunning = false;
    },
  };
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
