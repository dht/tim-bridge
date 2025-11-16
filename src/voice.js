const { exec } = require("child_process");

export function playFile(filename) {
  return new Promise((resolve, reject) => {
    console.log("Playing:", filename);

    exec(`omxplayer -o local "${filename}"`, (error) => {
      if (error) console.error(`Error playing ${filename}:`, error);
      resolve();
    });
  });
}
