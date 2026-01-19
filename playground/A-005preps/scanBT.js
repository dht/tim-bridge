const noble = require('@abandonware/noble');

noble.on('stateChange', (state) => {
  console.log('BLE state:', state);
  if (state === 'poweredOn') {
    noble.startScanning([], true);
  }
});

noble.on('discover', (peripheral) => {
  const name = peripheral.advertisement.localName;
  if (!name) return;

  console.log('---');
  console.log('Name:', name);
  console.log('ID:', peripheral.id);
  console.log('Address:', peripheral.address);
  console.log('RSSI:', peripheral.rssi);
});
