// Import a privacy-cleaned photo without overwriting the original or destination.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sanitizePhoto } from './sanitize-photos.mjs';
export { stripJpegMetadata } from './jpeg-metadata.mjs';

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [source, destination] = process.argv.slice(2);
  if (!source || !destination) throw new Error('Usage: node scripts/import-photo.mjs SOURCE DESTINATION');
  if (resolve(source) === resolve(destination)) throw new Error('Keep the original file: choose a different destination.');
  const clean = await sanitizePhoto(await readFile(source), extname(destination));
  await writeFile(destination, clean.data, { flag: 'wx' });
  console.log(`Imported: ${destination} (${clean.width} × ${clean.height})`);
}
