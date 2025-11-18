import { setStatus } from "./led.js";

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function runDemo() {
  console.log("Starting RGB LED status demo...");

  const sequence = [
    "idle",
    "egenerating",
    "listening",
    "speaking",
    "error",
    "error-no-internet",
    "error-reset-fail",
    "error-generation-fail",
  ];

  for (const state of sequence) {
    console.log("State:", state);
    setStatus(state);      // activate the LED pattern
    await sleep(5000);     // hold 5 seconds
  }

  console.log("Demo complete. Returning to idle.");
  setStatus("idle");
}

runDemo();
