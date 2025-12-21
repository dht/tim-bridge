// 2084
import { setStatus } from "../rgb/rgb.js";
import { startPlaybackFromTimelineUrl, stopPlayback } from "../timeline.js";

export async function onChange(data) {
  const { timelineUrl, status } = data;

  if (status) setStatus(status);

  if (status === "1.IDLE") {
    stopPlayback(); // stops audio + cancels timeline loop
    return;
  }

  if (!timelineUrl) return;

  // Fire and forget (internally guarded against overlap)
  startPlaybackFromTimelineUrl(timelineUrl);
}
