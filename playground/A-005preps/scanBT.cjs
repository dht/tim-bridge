const noble = require('@abandonware/noble');

noble.on('stateChange', async (state) => {
  if (state === 'poweredOn') {
    console.log('Scanning...');
    noble.startScanning([], true);
  } else {
    noble.stopScanning();
  }
});

noble.on('discover', (peripheral) => {
  const name = peripheral.advertisement.localName;
  if (name) {
    console.log('---');
    console.log('Name:', name);
    console.log('ID:', peripheral.id);
    console.log('Address:', peripheral.address);
    console.log('RSSI:', peripheral.rssi);
  }
});
