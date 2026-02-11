import noble from '@abandonware/noble';

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

    writeChar = characteristics.find((c) => c.uuid === 'ae01');
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

    sendTestRectangle();
  }
});

async function sendTestRectangle() {
  // Minimal "start session" frame common in these printers
  const startFrame = Buffer.from([
    0x51,
    0x78, // header
    0x00,
    0x00,
    0x00,
    0x00,
    0xff, // end
  ]);

  await writeChar.writeAsync(startFrame, false);
  console.log('Sent start frame');
}
