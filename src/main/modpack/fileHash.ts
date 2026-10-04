import fs from 'fs';
import crypto from 'crypto';

export async function calculateSha1Async(filePath: string): Promise<string> {
  return new Promise((resolve) => {
    if (!fs.existsSync(filePath)) return resolve('');
    const hash = crypto.createHash('sha1');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', () => resolve(''));
  });
}
