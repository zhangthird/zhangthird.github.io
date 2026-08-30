import sharp from 'sharp';
import { readFile, writeFile, readdir, lstat } from 'node:fs/promises';
import { resolve, join, extname, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { stripJpegMetadata } from './jpeg-metadata.mjs';

const formats = { '.jpg': 'jpeg', '.jpeg': 'jpeg', '.png': 'png', '.webp': 'webp', '.avif': 'heif' };
export function hasPrivateMetadata(metadata) {
  return Boolean(metadata.exif || metadata.xmp || metadata.iptc || metadata.tifftagPhotoshop || metadata.comments?.length || metadata.orientation > 1);
}

export async function sanitizePhoto(input, extension) {
  const expected = formats[extension.toLowerCase()];
  if (!expected) throw new Error(`Unsupported photo format: ${extension}`);
  const before = await sharp(input).metadata();
  if (before.format !== expected || (expected === 'heif' && before.compression !== 'av1')) throw new Error('Photo format does not match its filename.');
  let data = before.format === 'jpeg' && (!before.orientation || before.orientation === 1) ? stripJpegMetadata(input) : input;
  let after = await sharp(data).metadata();
  if (hasPrivateMetadata(after)) {
    if (before.pages > 1) throw new Error('Animated photos with metadata need a manually cleaned export.');
    let pipeline = sharp(input).autoOrient().keepIccProfile();
    if (expected === 'jpeg') pipeline = pipeline.jpeg({ quality: 100, chromaSubsampling: '4:4:4' });
    else if (expected === 'png') pipeline = pipeline.png();
    else if (expected === 'webp') pipeline = pipeline.webp({ lossless: true });
    else pipeline = pipeline.avif({ lossless: true });
    data = await pipeline.toBuffer();
    after = await sharp(data).metadata();
  }
  if (hasPrivateMetadata(after)) throw new Error('Photo metadata cleanup could not be verified.');
  return { data, width: after.width, height: after.height, changed: !data.equals(input) };
}

// Validate the entire directory before changing files. Never follow symlinks.
export async function sanitizeDirectory(directory) {
  const root = resolve(directory);
  if ((await lstat(root)).isSymbolicLink()) throw new Error('The photo directory cannot be a symlink.');
  const plans = [];
  async function visit(folder) {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      const path = join(folder, entry.name);
      if (!path.startsWith(root + sep)) throw new Error('Photo path escapes the photo directory.');
      if (entry.isSymbolicLink()) throw new Error(`Refusing photo symlink: ${entry.name}`);
      if (entry.isDirectory()) { await visit(path); continue; }
      if (entry.name === '.gitkeep') continue;
      if (!entry.isFile() || !formats[extname(entry.name).toLowerCase()]) throw new Error(`Unsupported file in photos: ${entry.name}`);
      try {
        plans.push({ path, ...(await sanitizePhoto(await readFile(path), extname(path))) });
      } catch (error) { throw new Error(`Cannot sanitize ${entry.name}: ${error.message}`); }
    }
  }
  await visit(root);
  for (const plan of plans) if (plan.changed) await writeFile(plan.path, plan.data);
  return plans.map(({ path, width, height, changed }) => ({ path, width, height, changed }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root = resolve('public/photos');
  const results = await sanitizeDirectory(root);
  const manifestPath = resolve('src/data/photos.json');
  const original = await readFile(manifestPath, 'utf8');
  const entries = JSON.parse(original);
  let updated = false;
  for (const result of results) {
    const src = '/photos/' + relative(root, result.path).split(sep).join('/');
    for (const entry of entries.filter(photo => photo.src === src)) {
      if (entry.width !== result.width || entry.height !== result.height) {
        entry.width = result.width; entry.height = result.height; updated = true;
      }
    }
  }
  if (updated) await writeFile(manifestPath, JSON.stringify(entries, null, 2) + '\n');
  console.log(`Photo privacy check: ${results.length} checked, ${results.filter(photo => photo.changed).length} cleaned.`);
}
