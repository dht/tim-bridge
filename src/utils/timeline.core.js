// type TimelineStatus = 'NONE' | 'IDLE' | 'GENERATING' | 'PLAYBACK';

/*
  Concerns:
  - managing firestore state
  - controlling hardware

  Requirements:
  - be able to play a timeline (array of keyframes)
  - be able to stop a running playback
*/

export function playTimeline(timelineJson) {
  console.log('Playing timeline with', timelineJson.length, 'items');
}
