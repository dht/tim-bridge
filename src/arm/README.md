# Robotic Arm Usage

This folder contains the arm pose schema and joint mapping used by the robotic arm runners.

## Files

- `../index.robotic.json`: named poses such as `basePosition`
- `../index.robotic.js`: move the arm to a named pose
- `../index.robotic.test.js`: test all joints or a single joint
- `./pose.js`: joint names and PCA9685 channel mapping
- `../servos.js`: low-level servo driver

## Joint Names

The supported joint ids are:

- `base`
- `shoulder`
- `elbow`
- `wristPitch`
- `wristRoll`
- `gripperOpen`

## Move To A Saved Pose

Move the arm to `basePosition`:

```bash
node src/index.robotic.js basePosition
```

Using the package script:

```bash
pnpm robotic -- basePosition
```

Move to `basePosition` and shut down servo output after the move:

```bash
node src/index.robotic.js basePosition --shutdown
```

Preview the move without touching hardware:

```bash
node src/index.robotic.js basePosition --dry-run
```

List all available saved poses:

```bash
node src/index.robotic.js --list
```

## Test All Joints

Move to the base pose, then test every joint one by one:

```bash
node src/index.robotic.test.js basePosition
```

Test every joint with a custom delta:

```bash
node src/index.robotic.test.js basePosition --delta 6 --hold-ms 600
```

By default, the test shuts servo output down 10 seconds after it finishes. Change that delay:

```bash
node src/index.robotic.test.js basePosition --shutdown-delay-ms 3000
```

Disable the automatic shutdown:

```bash
node src/index.robotic.test.js basePosition --no-shutdown
```

Preview the test without touching hardware:

```bash
node src/index.robotic.test.js basePosition --dry-run
```

## Test One Joint

Move to the base pose, move only the shoulder to `30`, then return to base:

```bash
node src/index.robotic.test.js basePosition --joint shoulder --angle 30
```

Another example:

```bash
node src/index.robotic.test.js basePosition --joint base --angle 100 --hold-ms 1500
```

Disable shutdown for a single-joint test:

```bash
node src/index.robotic.test.js basePosition --joint shoulder --angle 30 --no-shutdown
```

## Notes

- Servo moves are serialized. Only one servo command is sent at a time.
- There is a small delay between servo moves to reduce HAT load.
- The inter-servo delay can be overridden with `ROBOTIC_SERVO_DELAY_MS`.
- The base pose is stored in `src/index.robotic.json`.
