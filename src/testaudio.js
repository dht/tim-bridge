// play.js
import player from 'play-sound';

const play = player();
const file = './H1.mp3'; // your MP3 file in the same folder

play.play(file, (err) => {
  if (err) console.error('❌ Error playing file:', err);
  else console.log('✅ Done playing:', file);
});
