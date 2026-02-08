"use strict";

import noble from "@abandonware/noble"
import  { setTimeout as delay } from "node:timers/promises";

function hexPreview(buf, maxBytes = 24) {
  if (!buf || !buf.length) return undefined;
  const b = Buffer.from(buf);
  const slice = b.subarray(0, maxBytes);
  const suffix = b.length > maxBytes ? `…(+${b.length - maxBytes}b)` : "";
  return `${slice.toString("hex")}${suffix}`;
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

async function main() {
  const timeoutMs = Number(process.env.BLE_SCAN_TIMEOUT_MS) || 8_000;
  const allowDuplicates = process.env.BLE_SCAN_DUPLICATES === "1";

  await waitForPoweredOn();

  /** @type {Map<string, any>} */
  const found = new Map();

  const onDiscover = (peripheral) => {
    const adv = peripheral?.advertisement || {};
    const localName = adv.localName;

    found.set(peripheral.id, {
      id: peripheral.id,
      address: peripheral.address && peripheral.address !== "unknown" ? peripheral.address : undefined,
      localName,
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
    });
  };

  noble.on("discover", onDiscover);
  try {
    // Scan for all services; do not filter by local name.
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

  const devices = [...found.values()].sort((a, b) => (b.rssi ?? -999) - (a.rssi ?? -999));

  if (!devices.length) {
    console.log("No BLE devices found.");
    return;
  }

  console.log(`Found ${devices.length} BLE device(s):\n`);
  for (const d of devices) {
    console.log(`${d.localName ?? "(no name)"}`);
    console.log(`  id:        ${d.id}`);
    console.log(`  address:   ${d.address ?? "(n/a)"}`);
    console.log(`  rssi:      ${d.rssi ?? "(n/a)"}`);
    if (d.txPowerLevel != null) console.log(`  txPower:   ${d.txPowerLevel}`);
    if (d.serviceUuids?.length) console.log(`  services:  ${d.serviceUuids.join(", ")}`);
    if (d.solicitedServiceUuids?.length) console.log(`  solicit:   ${d.solicitedServiceUuids.join(", ")}`);
    if (d.manufacturerDataHex) console.log(`  mfg:       ${d.manufacturerDataHex}`);
    if (d.serviceData?.length) {
      for (const sd of d.serviceData) {
        console.log(`  svcData:   ${sd.uuid} ${sd.dataHex ?? ""}`.trimEnd());
      }
    }
    console.log(`  lastSeen:  ${d.lastSeenAt}\n`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

