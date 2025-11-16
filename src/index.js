import "dotenv/config";
import { turnLightsOff, turnLightsOn } from "./lights.js";
import { delay } from "./utils.js";
import { playFile } from "./voice.js";

async function main() {
  await delay(1000);
  turnLightsOn();
  await delay(2000);
  turnLightsOff();
  await playFile("H1.mp3");

  await delay(5000);
  playFile("S1.mp3");
  // turnLightsOn();
  // await delay(2000);
  // spinMotor();
  // await delay(2000);
  // stopMotor();
}

main().catch(console.error);

// src/index.js
import player from "play-sound";

// speaker sequence
const LED1 = 11; // H-speaker
const LED2 = 13; // S-speaker

// paths to audio files
const sequence = [
  { led: LED1, file: "io/H1.mp3" },
  { led: LED2, file: "io/S1.mp3" },
  { led: LED1, file: "io/H2.mp3" },
  { led: LED2, file: "io/S2.mp3" },
  { led: LED1, file: "io/H3.mp3" },
  { led: LED2, file: "io/S3.mp3" },
];

const play = player({ player: "mpg123" }); // force mpg123 backend

async function playFile(path) {
  return new Promise((resolve, reject) => {
    const audio = play.play(path, (err) => (err ? reject(err) : resolve()));
    audio.on("exit", resolve);
  });
}

// run();
main();
