import fs from 'fs';
import pLimit from 'p-limit';
import path from 'path';
import { downloadBinary } from './axios.js';

export async function downloadAssetFromUrl(url, localFolder) {
  try {
    const fileName = path.basename(new URL(url).pathname);
    const filePath = path.join(localFolder, fileName);
    await downloadBinary(url, filePath);
  } catch (err) {
    console.error('❌ Error downloading asset:', url, err.message);
    // intentionally ignored
  }
}

export async function downloadAssetsFromUrls(urls, localFolder, concurrency = 5) {
  await fs.promises.mkdir(localFolder, { recursive: true });

  const limit = pLimit(concurrency);

  await Promise.all(urls.map(url => limit(() => downloadAssetFromUrl(url, localFolder))));
}
