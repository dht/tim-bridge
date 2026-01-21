import { LedMatrix } from "node-rgb-matrix";

const matrix = new LedMatrix({
  rows: 64,
  cols: 64,
  chainLength: 1,
  parallel: 1,
  hardwareMapping: "regular",
  brightness: 80
});

matrix.clear();
matrix.drawText("HAIKU", 2, 20, { r: 255, g: 255, b: 255 });

setTimeout(() => {
  matrix.clear();
  matrix.drawText("READY", 2, 40, { r: 0, g: 255, b: 0 });
}, 2000);
