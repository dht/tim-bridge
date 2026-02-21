# Launcher Orders

This folder provides Firestore-based remote operations for cases where SSH to the Raspberry Pi is unavailable.

## Order Types (all-caps)

- `RESTART_PM2`
- `STOP_PM2`
- `START_PM2`
- `SET_VOLUME`
- `CHANGE_ENV`
- `DUMP_LOGS`
- `SYNC_GIT`

## Add Orders

Examples:

```bash
node launcher/add-order-restart-pm2.js --machineId A-001-dev
node launcher/add-order-stop-pm2.js --machineId A-001-dev
node launcher/add-order-start-pm2.js --machineId A-001-dev
node launcher/add-order-set-volume.js --machineId A-001-dev --value 55
node launcher/add-order-change-env.js --machineId A-001-dev --values '{"MODE":"FULL"}'
node launcher/add-order-dump-logs.js --machineId A-001-dev --lines 30
node launcher/add-order-sync-git.js --machineId A-001-dev
```

`CHANGE_ENV` can also use key-value pairs:

```bash
node launcher/add-order-change-env.js --machineId A-001-dev MODE=FULL MACHINE_IDS=A-001-dev
```

## Aux Listener

Run this as a separate PM2 process so `START_PM2` still works after `STOP_PM2`:

```bash
npm run launcher:start-only
```

The script `launcher/start-only-listener.js` only handles `START_PM2`.
