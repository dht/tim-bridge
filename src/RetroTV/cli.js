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
  --app              default: false (uses --app=<url>)
  --user-data-dir    override Chromium profile dir
  --disk-cache-dir   override Chromium cache dir
  --dry-run          print command only (no launch)
  --print            print command (and launch)
  --debug            attach Chromium output (not detached)
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
    app: { type: "boolean", default: false },
    "user-data-dir": { type: "string" },
    "disk-cache-dir": { type: "string" },
    "dry-run": { type: "boolean", default: false },
    print: { type: "boolean", default: false },
    debug: { type: "boolean", default: false },
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
  const shouldPrint = dryRun || values.print;
  const debug = values.debug;
  const stdio = debug ? "inherit" : "ignore";
  const detached = debug ? false : true;
  const userDataDir = values["user-data-dir"];
  const diskCacheDir = values["disk-cache-dir"];

  if (values.photo) {
    const result = openRetroTvPhoto(values.photo, {
      fit: values.fit,
      background: values.background,
      kiosk,
      app,
      userDataDir,
      diskCacheDir,
      dryRun,
      stdio,
      detached,
    });
    if (shouldPrint) console.log(`${result.cmd} ${result.args.join(" ")}`);
    process.exit(0);
  }

  if (values.url) {
    const result = openRetroTvUrl(values.url, {
      kiosk,
      app,
      userDataDir,
      diskCacheDir,
      dryRun,
      stdio,
      detached,
    });
    if (shouldPrint) console.log(`${result.cmd} ${result.args.join(" ")}`);
    process.exit(0);
  }

  console.error("Missing --photo or --url");
  usage(1);
}

if (command === "close") {
  const result = closeRetroTv({ dryRun: values["dry-run"] });
  if (values["dry-run"] || values.print) console.log(`${result.cmd} ${result.args.join(" ")}`);
  process.exit(0);
}

console.error(`Unknown command: ${command}`);
usage(1);
