/**
 * Example: Using react-mxw01-printer in Node.js with Bun
 *
 * Installation:
 *   npm install react-mxw01-printer @stoprocent/noble canvas
 *   or
 *   bun add react-mxw01-printer @stoprocent/noble canvas
 *
 * Run:
 *   node --loader ts-node/esm examples/nodejs-canvas-example.ts
 *   or
 *   bun run examples/nodejs-canvas-example.ts
 */

import {
  ThermalPrinterClient,
  NodeBluetoothAdapter,
} from "react-mxw01-printer";
import { createCanvas } from "canvas";

async function main() {
  console.log("🖨️  MXW01 Thermal Printer - Node.js Example\n");

  // Create adapter and printer client
  const adapter = new NodeBluetoothAdapter();
  const printer = new ThermalPrinterClient(adapter);

  // Subscribe to events
  printer.on("connected", (event) => {
    console.log("✅ Connected to:", event.device.name);
  });

  printer.on("disconnected", () => {
    console.log("❌ Disconnected from printer");
  });

  printer.on("stateChange", (event) => {
    console.log("📊 Printer state updated:", event.state);
  });

  printer.on("error", (event) => {
    console.error("❌ Printer error:", event.error.message);
  });

  try {
    // Connect to printer
    console.log("🔍 Scanning for MXW01 printer...");
    await printer.connect();
    console.log(`📶 Status: ${printer.statusMessage}\n`);

    // Create image to print
    console.log("🎨 Creating image...");
    const canvas = createCanvas(384, 400);
    const ctx = canvas.getContext("2d");

    // White background
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, 384, 400);

    // Draw content
    ctx.fillStyle = "black";

    // Title
    ctx.font = "bold 32px Arial";
    ctx.fillText("MXW01 Printer", 50, 60);

    // Subtitle
    ctx.font = "20px Arial";
    ctx.fillText("Node.js Example", 50, 100);

    // Line
    ctx.fillRect(40, 120, 304, 2);

    // Info text
    ctx.font = "16px Arial";
    ctx.fillText("✓ Platform-agnostic", 50, 160);
    ctx.fillText("✓ Works with Node.js", 50, 190);
    ctx.fillText("✓ Works with Bun", 50, 220);
    ctx.fillText("✓ Works with OpenTUI", 50, 250);

    // Footer
    ctx.font = "14px Arial";
    ctx.fillText("Printed: " + new Date().toLocaleString(), 50, 320);

    // QR code placeholder (you could use a QR code library)
    ctx.strokeStyle = "black";
    ctx.lineWidth = 2;
    ctx.strokeRect(50, 340, 50, 50);
    ctx.font = "10px Arial";
    ctx.fillText("QR", 65, 370);

    // Get image data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Print
    console.log("🖨️  Printing...");
    await printer.print(imageData, {
      dither: "steinberg",
      brightness: 128,
      intensity: 93,
    });

    console.log("✅ Print completed!");
    console.log(`📊 Final status: ${printer.statusMessage}\n`);

    // Disconnect
    await printer.disconnect();
    console.log("👋 Disconnected. Goodbye!");
  } catch (error) {
    console.error("❌ Error:", (error as Error).message);
    await printer.disconnect();
    process.exit(1);
  }
}

// Run example
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
