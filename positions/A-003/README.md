# A-003 arm positions

Create JSON files named `pos1.json` … `pos10.json` in this folder.

Example `pos1.json`:

```json
{
  "base": 0,
  "shoulder": 0,
  "elbow": 100,
  "wristPitch": 135,
  "wristRoll": 180,
  "gripperOpen": 180
}
```

Run from the repo root:

- List: `node src/arm/cli.js list --machine A-003`
- Go: `node src/arm/cli.js go pos1 --machine A-003`

