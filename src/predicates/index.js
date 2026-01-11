const RECENT_DELTA_MS = 2 * 60 * 1000; // 2 minutes

export const predicateSession = (change) => {
  const { data } = change || {};

  if (!data) return;

  const { timelineUrl, timelineUrlTs } = data;

  const delta = Date.now() - (timelineUrlTs || 0);

  const isRecent = delta < RECENT_DELTA_MS;

  if (timelineUrl && isRecent) {
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

  if (isRecent) {
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

  if (isRecent) {
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
