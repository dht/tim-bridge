import axios from 'axios';
import fs from 'fs-extra';

export function getJson(url) {
  return axios.get(url).then(res => res.data);
}

export async function downloadBinary(url, filePath) {
  const response = await axios({
    method: 'GET',
    url,
    responseType: 'stream',
  });

  return new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}
