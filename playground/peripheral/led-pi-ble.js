import noble from "@abandonware/noble";

const MATRIX_NAME = "LED-MATRIX";
const CHAR_UUID = "ffe1"; // example

noble.on("stateChange", async state => {
  if (state === "poweredOn") {
    await noble.startScanningAsync([], false);
  }
});

noble.on("discover", async peripheral => {
  if (peripheral.advertisement.localName === MATRIX_NAME) {
    await noble.stopScanningAsync();
    await peripheral.connectAsync();

    const { characteristics } =
      await peripheral.discoverSomeServicesAndCharacteristicsAsync([], [CHAR_UUID]);

    const char = characteristics[0];

    await char.writeAsync(Buffer.from([255, 0, 0]), false);
    console.log("Sent BLE frame");
  }
});
