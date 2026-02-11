import noble from '@abandonware/noble';

console.log('version 1.0.2');
const TARGET = '48:0f:57:c5:78:9d';
let writeChar = null;

noble.on('stateChange', async (state) => {
  if (state === 'poweredOn') {
    console.log('Scanning...');
    await noble.startScanningAsync([], false);
  }
});

noble.on('discover', async (peripheral) => {
  if (peripheral.address === TARGET) {
    await noble.stopScanningAsync();
    await peripheral.connectAsync();
    console.log('Connected');

    const { characteristics } = await peripheral.discoverAllServicesAndCharacteristicsAsync();

    writeChar = characteristics.find((c) => c.uuid === 'ae03');
    const notifyChar = characteristics.find((c) => c.uuid === 'ae02');

    if (!writeChar) {
      console.log('Write characteristic not found');
      return;
    }

    if (notifyChar) {
      await notifyChar.subscribeAsync();
      notifyChar.on('data', (data) => {
        console.log('Printer response:', data.toString('hex'));
      });
    }

    console.log('Ready to send test frame');

    sendHaiku();
  }
});

async function sendHaiku() {
  const text = 'Morning light whispers\nInk blooms on quiet paper\nWinter breath lingers\n';

  const textBuffer = Buffer.from(text, 'ascii');

  const CMD_PRINT_TEXT = 0xa2; // common for Fun Print style printers

  const payload = Buffer.concat([Buffer.from([CMD_PRINT_TEXT]), textBuffer]);

  const length = payload.length;

  const frame = Buffer.alloc(2 + 2 + payload.length + 1 + 1);

  frame[0] = 0x51;
  frame[1] = 0x78;

  frame[2] = length & 0xff;
  frame[3] = (length >> 8) & 0xff;

  payload.copy(frame, 4);

  // XOR checksum
  let crc = 0x00;
  for (let i = 4; i < 4 + payload.length; i++) {
    crc ^= frame[i];
  }

  frame[4 + payload.length] = crc;
  frame[5 + payload.length] = 0xff;

  await writeChar.writeAsync(frame, false);

  console.log('Haiku sent');
}
