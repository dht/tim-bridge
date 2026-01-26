import { parseArgs } from "node:util";
import { closeRetroTv, openRetroTvPhoto, openRetroTvUrl } from "./index.js";

function usage(exitCode = 0) {
  const text = `
RetroTV (Chromium kiosk photo)

Usage:
  node src/RetroTV/cli.js open --photo <imageUrl> [--fit contain|cover] [--background <cssColor>]
  node src/RetroTV/cli.js open --url <url>
  node src/RetroTV/cli.js close

Options:
  --kiosk            default: true
  --app              default: true (uses --app=<url>)
  --dry-run          print command only
  --browser-bin      override Chromium binary (or set RETROTV_BROWSER_BIN)
`;
  console.log(text.trim());
  process.exit(exitCode);
}

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    url: { type: "string" },
    photo: { type: "string" },
    fit: { type: "string" },
    background: { type: "string" },
    kiosk: { type: "boolean", default: true },
    app: { type: "boolean", default: true },
    "dry-run": { type: "boolean", default: false },
    "browser-bin": { type: "string" },
    help: { type: "boolean", default: false },
  },
});

if (values.help) usage(0);

const command = positionals[0];
if (!command) usage(1);

if (values["browser-bin"]) process.env.RETROTV_BROWSER_BIN = values["browser-bin"];

if (command === "open") {
  const dryRun = values["dry-run"];
  const kiosk = values.kiosk;
  const app = values.app;

  if (values.photo) {
    const result = openRetroTvPhoto(values.photo, {
      fit: values.fit,
      background: values.background,
      kiosk,
      app,
      dryRun,
    });
    console.log(`${result.cmd} ${result.args.join(" ")}`);
    process.exit(0);
  }

  if (values.url) {
    const result = openRetroTvUrl(values.url, { kiosk, app, dryRun });
    console.log(`${result.cmd} ${result.args.join(" ")}`);
    process.exit(0);
  }

  console.error("Missing --photo or --url");
  usage(1);
}

if (command === "close") {
  const result = closeRetroTv({ dryRun: values["dry-run"] });
  console.log(`${result.cmd} ${result.args.join(" ")}`);
  process.exit(0);
}

console.error(`Unknown command: ${command}`);
usage(1);

