"use strict";

import noble from "@abandonware/noble";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const REQUIRED_CHAR_UUIDS = ["ae01", "ae02", "ae03"];
const PRINTER_NAME = "mxw01";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_PATH = path.join(__dirname, "discover-all-ble.txt");

function hexPreview(buf, maxBytes = 24) {
  if (!buf || !buf.length) return undefined;
  const b = Buffer.from(buf);
  const slice = b.subarray(0, maxBytes);
  const suffix = b.length > maxBytes ? `…(+${b.length - maxBytes}b)` : "";
  return `${slice.toString("hex")}${suffix}`;
}

function normalizeId(value) {
  return String(value ?? "").trim().toLowerCase();
}

function getPeripheralAddress(peripheral) {
  const address = normalizeId(peripheral?.address);
  if (address && address !== "unknown") {
    return address;
  }

  return normalizeId(peripheral?.id);
}

function withTimeout(promise, timeoutMs, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    }),
  ]);
}

function looksLikePrinterAdvertisement(device) {
  const localName = String(device?.localName ?? "")
    .trim()
    .toLowerCase();
  if (!localName) {
    return false;
  }

  return localName.includes(PRINTER_NAME);
}

async function waitForPoweredOn(timeoutMs = 10_000) {
  if (noble.state === "poweredOn") return;
  const start = Date.now();
  while (noble.state !== "poweredOn") {
    if (Date.now() - start > timeoutMs) {
      throw new Error(`Bluetooth adapter not powered on (state=${noble.state})`);
    }
    await delay(100);
  }
}

async function discoverDevices({ timeoutMs, allowDuplicates }) {
  /** @type {Map<string, { peripheral: any, device: any }>} */
  const found = new Map();

  const onDiscover = (peripheral) => {
    const adv = peripheral?.advertisement || {};
    const key = normalizeId(peripheral.id);

    found.set(key, {
      peripheral,
      device: {
        id: peripheral.id,
        address: peripheral.address && peripheral.address !== "unknown" ? peripheral.address : undefined,
        localName: adv.localName,
        rssi: peripheral.rssi,
        txPowerLevel: adv.txPowerLevel,
        serviceUuids: adv.serviceUuids || [],
        solicitedServiceUuids: adv.solicitedServiceUuids || [],
        manufacturerDataHex: hexPreview(adv.manufacturerData),
        serviceData: (adv.serviceData || []).map((sd) => ({
          uuid: sd.uuid,
          dataHex: hexPreview(sd.data),
        })),
        lastSeenAt: new Date().toISOString(),
      },
    });
  };

  noble.on("discover", onDiscover);
  try {
    await noble.startScanningAsync([], allowDuplicates);
    await delay(timeoutMs);
  } finally {
    try {
      await noble.stopScanningAsync();
    } catch {
      // ignore
    }
    noble.removeListener("discover", onDiscover);
  }

  return [...found.values()].sort((a, b) => (b.device.rssi ?? -999) - (a.device.rssi ?? -999));
}

async function validatePrinter(peripheral, connectTimeoutMs) {
  let connected = false;

  try {
    await withTimeout(peripheral.connectAsync(), connectTimeoutMs, `Connect ${peripheral.id}`);
    connected = true;

    const { characteristics } = await withTimeout(
      peripheral.discoverAllServicesAndCharacteristicsAsync(),
      connectTimeoutMs,
      `Discover GATT ${peripheral.id}`
    );

    const charSet = new Set(characteristics.map((c) => normalizeId(c.uuid)));
    const hasAll = REQUIRED_CHAR_UUIDS.every((uuid) => charSet.has(uuid));

    return {
      isPrinter: hasAll,
      characteristicUuids: [...charSet].sort(),
      missing: REQUIRED_CHAR_UUIDS.filter((uuid) => !charSet.has(uuid)),
    };
  } catch (error) {
    return {
      isPrinter: false,
      characteristicUuids: [],
      missing: REQUIRED_CHAR_UUIDS,
      error: error?.message || String(error),
    };
  } finally {
    if (connected) {
      try {
        await peripheral.disconnectAsync();
      } catch {
        // ignore
      }
    }
  }
}

function buildOutput({ scannedCount, printers, selectedAddress, startedAtIso }) {
  const lines = [];
  lines.push(`started_at: ${startedAtIso}`);
  lines.push(`scanned_devices: ${scannedCount}`);
  lines.push(`confirmed_printers: ${printers.length}`);
  lines.push(`selected_address: ${selectedAddress || ""}`);
  lines.push("");

  if (!printers.length) {
    lines.push("No confirmed printer devices found.");
    return `${lines.join("\n")}\n`;
  }

  lines.push("Confirmed printer devices:");
  lines.push("");

  for (const printer of printers) {
    lines.push(`${printer.localName || "(no name)"}`);
    lines.push(`  id:        ${printer.id}`);
    lines.push(`  address:   ${printer.address || "(n/a)"}`);
    lines.push(`  rssi:      ${printer.rssi ?? "(n/a)"}`);
    lines.push(`  selected:  ${printer.selected ? "yes" : "no"}`);
    lines.push(`  chars:     ${printer.characteristicUuids.join(", ") || "(none)"}`);
    lines.push("");
  }

  lines.push("Use in .env.pi:");
  lines.push(`THERMAL_PRINTER_ADDRESS=${selectedAddress || ""}`);
  lines.push("");

  return `${lines.join("\n")}\n`;
}

async function main() {
  const startedAtIso = new Date().toISOString();
  const timeoutMs = Number(process.env.BLE_SCAN_TIMEOUT_MS) || 8_000;
  const allowDuplicates = process.env.BLE_SCAN_DUPLICATES === "1";
  const connectTimeoutMs = Number(process.env.BLE_CONNECT_TIMEOUT_MS) || 6_000;
  const maxValidate = Number(process.env.BLE_VALIDATE_MAX_DEVICES) || 12;

  await waitForPoweredOn();

  const discovered = await discoverDevices({ timeoutMs, allowDuplicates });
  if (!discovered.length) {
    const output = buildOutput({
      scannedCount: 0,
      printers: [],
      selectedAddress: "",
      startedAtIso,
    });
    await writeFile(OUTPUT_PATH, output, "utf8");
    console.log("No BLE devices found.");
    console.log(`Saved: ${OUTPUT_PATH}`);
    return;
  }

  const namedCandidates = discovered
    .filter((entry) => looksLikePrinterAdvertisement(entry.device))
    .sort((a, b) => (b.device.rssi ?? -999) - (a.device.rssi ?? -999));

  const printers = [];
  for (const entry of namedCandidates.slice(0, Math.max(1, maxValidate))) {
    const { peripheral, device } = entry;
    const validation = await validatePrinter(peripheral, connectTimeoutMs);

    if (!validation.isPrinter) {
      continue;
    }

    printers.push({
      ...device,
      address: getPeripheralAddress(peripheral) || device.address,
      characteristicUuids: validation.characteristicUuids,
      selected: false,
    });
  }

  const selected = printers
    .filter((p) => p.address)
    .sort((a, b) => (b.rssi ?? -999) - (a.rssi ?? -999))[0];

  const selectedAddress = selected?.address || "";
  if (selected) {
    selected.selected = true;
  }

  const output = buildOutput({
    scannedCount: discovered.length,
    printers,
    selectedAddress,
    startedAtIso,
  });

  await writeFile(OUTPUT_PATH, output, "utf8");

  if (!printers.length) {
    console.log("No confirmed printers found.");
  } else {
    console.log(`Confirmed ${printers.length} printer device(s).`);
    console.log(`Selected address: ${selectedAddress || "(none)"}`);
  }
  console.log(`Saved: ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
