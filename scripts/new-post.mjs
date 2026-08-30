import { mkdir, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const requestedCollection = process.argv[2] || 'research';
if (!['writing', 'research'].includes(requestedCollection)) throw new Error('Collection must be research.');
const collection = 'research';
const rl = createInterface({ input, output });
const title = (await rl.question('Title: ')).trim();
const tags = (await rl.question('Tags (comma separated): ')).split(',').map((item) => item.trim()).filter(Boolean);
const description = (await rl.question('Description: ')).trim();
rl.close();

if (!title) throw new Error('Title is required.');

const slug = title
  .toLowerCase()
  .replace(/[^a-z0-9\s-]/g, '')
  .trim()
  .replace(/\s+/g, '-')
  .replace(/-+/g, '-');

const today = new Date().toISOString().slice(0, 10);
const target = new URL(`../src/content/${collection}/${slug || `post-${today}`}.md`, import.meta.url);
await mkdir(new URL(`../src/content/${collection}/`, import.meta.url), { recursive: true });

const frontmatter = `---\ntitle: ${JSON.stringify(title)}\ndescription: ${JSON.stringify(description)}\npubDate: ${today}\ntags: ${JSON.stringify(tags)}\nfeatured: false\ndraft: true\n---\n\n`;

await writeFile(target, frontmatter, { encoding: 'utf8', flag: 'wx' });
console.log(`Created: ${target.pathname}`);
