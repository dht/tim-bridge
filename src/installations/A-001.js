// A-001 is houses hillel and shammai
import { setStatus } from '../rgb/rgb.js';
import { startPlaybackFromTimelineUrl, stopPlayback } from '../timeline.js';

export async function onChange(data) {
  const { timelineUrl, status } = data;

  setStatus(status);

  if (status === '1.IDLE' || status === '4.RESETTING') {
    stopPlayback(); // stops audio + cancels timeline loop
    return;
  }

  if (!timelineUrl) return;

  // Fire and forget (internally guarded against overlap)
  startPlaybackFromTimelineUrl(timelineUrl);
}

