import fs from "fs";

const PRINTER_PATH = "/dev/usb/lp0"; // may vary

const ESC_INIT = Buffer.from([0x1b, 0x40]);
const TEXT = Buffer.from("Hello from macOS via USB\n\n");

try {
  const fd = fs.openSync(PRINTER_PATH, "w");
  fs.writeSync(fd, ESC_INIT);
  fs.writeSync(fd, TEXT);
  fs.closeSync(fd);
  console.log("Printed via USB");
} catch (err) {
  console.error("USB print failed:", err.message);
}
