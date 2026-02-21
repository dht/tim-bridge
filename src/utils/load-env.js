import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');

const envSuffix = process.platform === 'darwin' ? 'dev' : 'pi';

const basePath = path.join(PROJECT_ROOT, '.env');
const overridePath = path.join(PROJECT_ROOT, `.env.${envSuffix}`);

dotenv.config({ path: basePath });
dotenv.config({ path: overridePath, override: true });
