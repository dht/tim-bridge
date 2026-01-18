const RECENT_DELTA_MS = 2 * 60 * 1000; // 2 minutes

// Prevent loops by only firing once per new status/timeline timestamp per machine.
const lastSeenTsByKey = new Map();

function isNewTs(key, ts) {
  if (typeof ts !== "number") return false;
  const last = lastSeenTsByKey.get(key);
  if (last === ts) return false;
  lastSeenTsByKey.set(key, ts);
  return true;
}

export const predicateSession = (change) => {
  const { id, data } = change || {};

  if (!data) return;

  const { timelineUrl, timelineUrlTs } = data;

  const delta = Date.now() - (timelineUrlTs || 0);

  const isRecent = delta < RECENT_DELTA_MS;
  const isFresh = isNewTs(`timelineUrlTs:${id ?? "unknown"}`, timelineUrlTs);

  if (timelineUrl && isRecent && isFresh) {
    console.log(`🔗 Timeline URL: ${timelineUrl}`);
    return true;
  }

  return false;
};

export const predicateRealtime = (change) => {
  return true;
};

export const predicate11Agent = (change) => {
  const { id, data } = change || {};
  if (!data) return;

  const { statusTs } = data;

  // installations with timelines (like claygon)
  const delta = Date.now() - (statusTs || 0);
  const isRecent = delta < RECENT_DELTA_MS;
  const isFresh = isNewTs(`statusTs:${id ?? "unknown"}`, statusTs);

  if (isRecent && isFresh) {
    return true;
  }

  return false;
};

export const predicateIO = (change) => {
  const { id, data } = change || {};
  if (!data) return;

  const { statusTs } = data;

  // installations with timelines (like claygon)
  const delta = Date.now() - (statusTs || 0);
  const isRecent = delta < RECENT_DELTA_MS;
  const isFresh = isNewTs(`statusTs:${id ?? "unknown"}`, statusTs);

  if (isRecent && isFresh) {
    return true;
  }

  return false;
};

export const predicates = {
  session: predicateSession,
  realtime: predicateRealtime,
  "11agent": predicate11Agent,
  io: predicateIO,
};
