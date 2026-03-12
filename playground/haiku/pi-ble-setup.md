Yes. On Raspberry Pi OS, the main things your BLE script needs are:

1. **Bluetooth service running**
2. **The adapter not blocked**
3. **Your Node binary allowed to use raw/admin Bluetooth sockets**
4. **A noble version that actually supports your setup**

For Linux BLE scanning, BlueZ uses management and raw HCI sockets, which require `CAP_NET_ADMIN` and `CAP_NET_RAW` unless you run as root. That is why noble often fails unless you grant those capabilities to the `node` executable. ([DeepWiki][1])

Use these checks on the Pi.

## 1. Make sure Bluetooth is enabled and running

```bash
sudo systemctl enable bluetooth
sudo systemctl start bluetooth
sudo systemctl status bluetooth
```

On Raspberry Pi OS, Bluetooth is managed as a system service and can be enabled or disabled through the OS configuration. ([Raspberry Pi][2])

Also check that the radio is not soft-blocked:

```bash
rfkill list
```

If Bluetooth shows blocked:

```bash
sudo rfkill unblock bluetooth
```

## 2. Confirm the adapter is present

```bash
bluetoothctl show
```

You want to see an adapter and `Powered: yes`. If needed:

```bash
bluetoothctl
power on
scan on
```

If `bluetoothctl` can scan, the Pi’s Bluetooth stack is basically working. Raspberry Pi OS documents Bluetooth as a configurable interface, and `bluetoothctl` is the standard BlueZ tool for managing adapters. ([Raspberry Pi][2])

## 3. Grant Node the permissions noble needs

This is the usual fix for `@abandonware/noble` on Linux:

```bash
sudo setcap cap_net_raw,cap_net_admin+eip "$(readlink -f "$(which node)")"
```

Then verify:

```bash
getcap "$(readlink -f "$(which node)")"
```

You should see something like:

```bash
/usr/bin/node cap_net_admin,cap_net_raw=eip
```

Those capabilities are the important ones for BlueZ management/raw socket access. ([DeepWiki][1])

## 4. Re-check after changing Node versions

Because you are using Node via `nvm`, every Node version lives at a different path. If you switch Node versions, the capability is usually lost on the new binary and you must run `setcap` again on that exact `node` path. That follows from how Linux capabilities are attached to the executable file itself, not to your shell user. ([man7.org][3])

Check the exact binary:

```bash
which node
readlink -f "$(which node)"
getcap "$(readlink -f "$(which node)")"
```

## 5. Install the Bluetooth userspace tools

```bash
sudo apt update
sudo apt install -y bluez libbluetooth-dev
```

That gives you the normal Linux Bluetooth stack tooling BlueZ is built around. BlueZ is the official Linux Bluetooth stack. ([bluez.org][4])

## 6. Run a quick end-to-end test

Before testing your script:

```bash
bluetoothctl
power on
scan on
```

If your printer’s MAC appears, the adapter is working.

Then run your script normally as your user:

```bash
node 6.printer-session.js
```

## 7. A safer script start

Your script is fine, but add error handlers so permission problems are obvious:

```js
import noble from '@abandonware/noble';

noble.on('stateChange', async (state) => {
  console.log('stateChange:', state);

  try {
    if (state === 'poweredOn') {
      console.log('Scanning...');
      await noble.startScanningAsync([], false);
    } else {
      await noble.stopScanningAsync();
    }
  } catch (err) {
    console.error('Scan error:', err);
  }
});

noble.on('discover', async (peripheral) => {
  try {
    console.log('Found:', peripheral.address, peripheral.advertisement?.localName);

    if (peripheral.address.toLowerCase() === '48:0f:57:c5:78:9d') {
      console.log('Found printer');
      await noble.stopScanningAsync();
      await peripheral.connectAsync();

      const { services, characteristics } =
        await peripheral.discoverAllServicesAndCharacteristicsAsync();

      console.log('Services:');
      services.forEach((s) => console.log(s.uuid));

      console.log('Characteristics:');
      characteristics.forEach((c) => {
        console.log(c.uuid, c.properties);
      });
    }
  } catch (err) {
    console.error('Discover/connect error:', err);
  }
});

noble.on('warning', (msg) => {
  console.warn('noble warning:', msg);
});

noble.on('scanStart', () => console.log('scanStart'));
noble.on('scanStop', () => console.log('scanStop'));
```

## 8. If it still fails, test as root once

Only as a diagnostic:

```bash
sudo -E node 6.printer-session.js
```

If it works with `sudo` but not without it, the problem is almost certainly missing `CAP_NET_ADMIN` / `CAP_NET_RAW` on the Node executable. BlueZ requires those permissions for the relevant socket operations. ([DeepWiki][1])

## 9. Exact checklist

Run these in order:

```bash
sudo apt update
sudo apt install -y bluez libbluetooth-dev
sudo systemctl enable bluetooth
sudo systemctl restart bluetooth
rfkill list
bluetoothctl show
sudo setcap cap_net_raw,cap_net_admin+eip "$(readlink -f "$(which node)")"
getcap "$(readlink -f "$(which node)")"
node -e 'console.log(process.execPath)'
node 6.printer-session.js
```

## What “permissions open” should mean here

You do **not** want to “open everything.” The right setup is:

- Bluetooth service enabled
- adapter powered on
- Node granted only `cap_net_raw` and `cap_net_admin`

That is the minimal permission model noble typically needs on Linux. ([npm][5])

Paste the output of these three commands and I’ll tell you the exact next fix:

```bash
bluetoothctl show
getcap "$(readlink -f "$(which node)")"
rfkill list
```

## Important step

```bash
which node
readlink -f "$(which node)"
sudo setcap cap_net_raw,cap_net_admin+eip "$(readlink -f "$(which node)")"
getcap "$(readlink -f "$(which node)")"
```
