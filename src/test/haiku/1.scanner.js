import noble from "@abandonware/noble";

noble.on("stateChange", async state => {
  if (state === "poweredOn") {
    console.log("Scanning...");
    await noble.startScanningAsync([], false);
  }
});

noble.on("discover", async peripheral => {
  if (peripheral.address === "48:0f:57:c5:78:9d") {
    console.log("Found printer");

    await noble.stopScanningAsync();
    await peripheral.connectAsync();

    const { services, characteristics } =
      await peripheral.discoverAllServicesAndCharacteristicsAsync();

    console.log("Services:");
    services.forEach(s => console.log(s.uuid));

    console.log("Characteristics:");
    characteristics.forEach(c =>
      console.log(c.uuid, c.properties)
    );
  }
});
