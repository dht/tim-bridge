import fs from 'fs';

function run() {
  const files = fs.readdirSync('.').filter((f) => f.endsWith('.json'));

  console.log(files);
}

run();
