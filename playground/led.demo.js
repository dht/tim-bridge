import { setStatus } from "../src/led.js";

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function runDemo() {
  console.log("Starting RGB LED status demo…");

  const sequence = [
    "idle",
    "generating",
    "listening",
    "speaking",
    "error",
    "error-no-internet",
    "error-reset-fail",
    "error-generation-fail",
  ];

  for (const state of sequence) {
    console.log("State:", state);
    setStatus(state);
    await sleep(5000);
  }

  console.log("Done. Returning to idle.");
  setStatus("idle");
}

runDemo();
