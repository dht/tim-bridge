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
import { identifyDevice } from './device.js';

const IS_DEV = process.env.IS_DEV === 'true';
const OFFLINE_MODE = process.env.OFFLINE_MODE === 'true';

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
};

let app = null;
let db = null;

export function initFirestore() {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
}

export function listenToCollectionSockets(name, callback) {
  if (!app) return;
  if (!name) {
    throw new Error('listenToCollection requires a collection name');
  }
  if (typeof callback !== 'function') {
    throw new Error('listenToCollection requires a callback function');
  }

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

export function listenToDocSockets(collectionName, id, callback, options = {}) {
  if (!app) return;
  const { ignoreInitialLoad = true } = options;

  const docRef = doc(db, collectionName, id);
  let isInitialLoad = true;
  let hadDoc = false;

  const unsubscribe = onSnapshot(docRef, (snap) => {
    if (isInitialLoad && ignoreInitialLoad) {
      isInitialLoad = false;
      hadDoc = snap.exists();
      return;
    }

    if (!snap.exists()) {
      // If it previously existed and now doesn't, treat as delete.
      if (hadDoc) callback({ type: 'delete', id });
      hadDoc = false;
      return;
    }

    const data = snap.data();

    // Firestore doc snapshot doesn't tell "added vs modified" directly,
    // so we infer: first time we see it => create, later => update.
    callback({ type: hadDoc ? 'update' : 'create', id, data });
    hadDoc = true;
  });

  return unsubscribe;
}

export function listenToDocShortPull(collectionName, id, callback, options = {}) {
  if (!app) return;
  const db = getFirestore();

  const interval = options.interval ?? 3000;
  const ignoreInitialLoad = options.ignoreInitialLoad ?? true;

  let isRunning = true;
  let isFirst = true;

  let lastSerialized = null; // string | null
  let hadDoc = false;

  async function poll() {
    if (!isRunning) return;

    try {
      const ref = doc(db, collectionName, id);
      const snap = await getDoc(ref);

      // ignore initial load if requested
      if (isFirst && ignoreInitialLoad) {
        isFirst = false;
        hadDoc = snap.exists();
        lastSerialized = snap.exists() ? JSON.stringify(snap.data()) : null;
        setTimeout(poll, interval);
        return;
      }
      isFirst = false;

      if (!snap.exists()) {
        // document doesn't exist now
        if (hadDoc) {
          callback({ type: 'delete', id, source: 'short-poll' });
        }
        hadDoc = false;
        lastSerialized = null;

        setTimeout(poll, interval);
        return;
      }

      const data = snap.data();
      const serialized = JSON.stringify(data);

      // Only fire if changed
      if (lastSerialized !== serialized) {
        callback({
          type: hadDoc ? 'update' : 'create',
          id,
          data,
          source: 'short-poll',
        });
        lastSerialized = serialized;
      }

      hadDoc = true;
    } catch (err) {
      console.error('❌ Short-poll Firestore doc error:', err);
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

export function crud(collectionName) {
  return {
    add: async (values) => {
      if (!app) return;
      if (!values) {
        throw new Error('crud.add requires a values object');
      }

      const { id, ...rest } = values;
      const collectionRef = collection(db, collectionName);
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
      if (!app) return;
      if (!id) {
        throw new Error('crud.update requires a document id');
      }
      const ref = doc(db, collectionName, id);

      const newChange = {
        clientTs: Date.now(),
        ...change,
      };

      await setDoc(ref, newChange, { merge: true });
    },
    delete: async (id) => {
      if (!app) return;
      if (!id) {
        throw new Error('crud.delete requires a document id');
      }
      const ref = doc(db, collectionName, id);
      await deleteDoc(ref);
    },
    listen: (callback) => {
      if (!app) return;
      return listenToCollection(collectionName, callback);
    },
    getAll: async () => {
      if (!app) return;
      const collectionRef = collection(db, collectionName);
      const snapshot = await getDocs(collectionRef);
      const results = [];
      snapshot.forEach((doc) => {
        results.push({ id: doc.id, ...doc.data() });
      });
      return results;
    },
    deleteByPredicate: async (predicate) => {
      if (!app) return;
      const collectionRef = collection(db, collectionName);
      const snapshot = await getDocs(collectionRef);
      const deletePromises = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (predicate(data)) {
          deletePromises.push(deleteDoc(doc.ref));
        }
      });
      await Promise.all(deletePromises);
    },
  };
}

export async function clearCollection(name) {
  if (!app) return;
  const collectionRef = collection(db, name);
  // Note: Firestore does not support direct collection deletion.
  // You would need to delete documents individually or use a batch operation.
  const snapshot = await getDocs(collectionRef);
  await Promise.all(snapshot.docs.map((doc) => deleteDoc(doc.ref)));
}

export function listenToCollectionShortPull(collectionName, onChange, options = {}) {
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

      snapshot.forEach((doc) => {
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

export function listenToCollection(collectionName, callback) {
  if (!app) return;
  // Detect CPU architecture
  const info = identifyDevice();
  const device = info.device;

  const isPiZero1 = device === 'pi-zero-1';

  const useShortPoll = isPiZero1;

  if (!IS_DEV) {
    console.log(
      `Listening to Firestore collection "${collectionName}" using device type: ${device} → ${
        useShortPoll ? 'short-poll' : 'realtime onSnapshot'
      }`
    );
  }

  const method = useShortPoll ? listenToCollectionShortPull : listenToCollectionSockets;

  return method(collectionName, callback);
}

export function listenToDoc(collectionName, id, callback, options = {}) {
  if (!app) return;
  const info = identifyDevice();
  const device = info.device;
  const isPiZero1 = device === 'pi-zero-1';

  const useShortPoll = isPiZero1;

  if (!IS_DEV) {
    console.log(
      `Listening to Firestore doc "${collectionName}/${id}" using device type: ${device} → ${
        useShortPoll ? 'short-poll' : 'realtime onSnapshot'
      }`
    );
  }

  return useShortPoll
    ? listenToDocShortPull(collectionName, id, callback, options)
    : listenToDocSockets(collectionName, id, callback, options);
}

export const updateMachineCreator = (machineId) => (change) => {
  return crud('machines').update(machineId, change);
};

export const updateRunCreator = (runId) => (change) => {
  return crud('runs').update(runId, change);
};

export const updateKeyframe = (keyframeId, change) => {
  return crud('keyframes').update(keyframeId, change);
};

export const clearKeyframesForMachine = async (machineId) => {
  const response = await crud('keyframes').deleteByPredicate(
    (item) => item.machineId === machineId
  );
};
