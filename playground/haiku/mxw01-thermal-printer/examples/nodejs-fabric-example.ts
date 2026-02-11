/**
 * Example: Node.js/Bun with Fabric.js for advanced canvas manipulation
 * 
 * This example demonstrates how to use Fabric.js with the thermal printer
 * in a Node.js or Bun environment for creating complex graphics.
 * 
 * Installation:
 * ```bash
 * npm install mxw01-thermal-printer @stoprocent/noble fabric canvas
 * # or
 * bun add mxw01-thermal-printer @stoprocent/noble fabric canvas
 * ```
 * 
 * Run:
 * ```bash
 * npx tsx examples/nodejs-fabric-example.ts
 * # or
 * bun examples/nodejs-fabric-example.ts
 * ```
 */

import {
  ThermalPrinterClient,
  NodeBluetoothAdapter,
} from "mxw01-thermal-printer";
import { createCanvas } from "canvas";
import { Canvas as FabricCanvas, Rect, Circle, Text } from "fabric";

async function printWithFabric() {
  console.log("🎨 Fabric.js Thermal Printer Example");
  console.log("=====================================\n");

  // Create adapter and printer client
  const adapter = new NodeBluetoothAdapter();
  const printer = new ThermalPrinterClient(adapter);

  // Subscribe to events
  printer.on("connected", (event) => {
    console.log("✅ Connected to:", event.device.name);
  });

  printer.on("stateChange", (event) => {
    console.log("📊 Printer state:", event.state);
  });

  printer.on("error", (event) => {
    console.error("❌ Printer error:", event.error);
  });

  try {
    // Connect to printer
    console.log("🔍 Scanning for printer...");
    await printer.connect();

    // Create a Node.js canvas
    const nodeCanvas = createCanvas(384, 400);
    
    // Initialize Fabric canvas with the Node.js canvas
    const fabricCanvas = new FabricCanvas(nodeCanvas as any, {
      width: 384,
      height: 400,
      backgroundColor: "white",
    });

    console.log("🎨 Creating design with Fabric.js...");

    // Add title text
    const title = new Text("Fabric.js + Thermal Printer", {
      left: 192,
      top: 30,
      fontSize: 20,
      fill: "black",
      fontFamily: "Arial",
      originX: "center",
    });
    fabricCanvas.add(title);

    // Add a rectangle border
    const border = new Rect({
      left: 20,
      top: 60,
      width: 344,
      height: 320,
      fill: "transparent",
      stroke: "black",
      strokeWidth: 2,
    });
    fabricCanvas.add(border);

    // Add decorative circles
    const circle1 = new Circle({
      left: 50,
      top: 100,
      radius: 30,
      fill: "transparent",
      stroke: "black",
      strokeWidth: 2,
    });
    fabricCanvas.add(circle1);

    const circle2 = new Circle({
      left: 150,
      top: 100,
      radius: 30,
      fill: "black",
    });
    fabricCanvas.add(circle2);

    const circle3 = new Circle({
      left: 250,
      top: 100,
      radius: 30,
      fill: "transparent",
      stroke: "black",
      strokeWidth: 2,
    });
    fabricCanvas.add(circle3);

    // Add info text
    const infoText = new Text("Created with Fabric.js", {
      left: 192,
      top: 180,
      fontSize: 16,
      fill: "black",
      fontFamily: "Arial",
      originX: "center",
    });
    fabricCanvas.add(infoText);

    // Add multiple rectangles as decorative elements
    for (let i = 0; i < 5; i++) {
      const rect = new Rect({
        left: 40 + i * 60,
        top: 220,
        width: 50,
        height: 50,
        fill: i % 2 === 0 ? "black" : "transparent",
        stroke: "black",
        strokeWidth: 2,
      });
      fabricCanvas.add(rect);
    }

    // Add bottom text
    const bottomText = new Text("Node.js/Bun Compatible", {
      left: 192,
      top: 300,
      fontSize: 14,
      fill: "black",
      fontFamily: "Arial",
      originX: "center",
    });
    fabricCanvas.add(bottomText);

    // Render all objects
    fabricCanvas.renderAll();

    // Get the image data from the canvas
    const ctx = nodeCanvas.getContext("2d");
    const imageData = ctx.getImageData(0, 0, nodeCanvas.width, nodeCanvas.height);

    // Print with dithering
    console.log("🖨️  Printing...");
    await printer.print(imageData, {
      dither: "steinberg",
      brightness: 128,
      intensity: 93,
    });

    console.log("✅ Print completed successfully!");

    // Get final status
    const status = await printer.getStatus();
    console.log("📊 Final printer status:", status);
  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  } finally {
    // Disconnect
    console.log("🔌 Disconnecting...");
    await printer.disconnect();
    console.log("👋 Done!");
  }
}

// Run the example
printWithFabric().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
