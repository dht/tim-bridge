import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageJsonPath = path.resolve(__dirname, '..', 'package.json');

const raw = fs.readFileSync(packageJsonPath, 'utf8');
const pkg = JSON.parse(raw);

const parts = pkg.version.split('.').map(Number);

if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
  throw new Error(`Invalid semver in package.json: ${pkg.version}`);
}

parts[2] += 1;
pkg.version = parts.join('.');

fs.writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`);

console.log(`Bumped package.json version to ${pkg.version}`);
