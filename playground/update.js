import 'dotenv/config';
import { crud } from '../src/firestore.js';

const URL = 'https://tim-os.web.app/voice3.mp3?t=' + Date.now();

function run() {
  crud('installations').update('TS-001', {
    mp3Url: URL,
    mp3UrlChangeTs: Date.now(),
  });
}

run();
