import { readdir, unlink, stat } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const requestedCollection = process.argv[2] || 'research';
if (!['writing', 'research'].includes(requestedCollection)) throw new Error('Collection must be research.');
const collection = 'research';
const postsDirUrl = new URL(`../src/content/${collection}/`, import.meta.url);
const postsDir = fileURLToPath(postsDirUrl);

const entries = (await readdir(postsDir))
  .filter((name) => name.endsWith('.md'))
  .sort();

if (entries.length === 0) {
  console.log('当前没有可删除的文章。');
  process.exit(0);
}

console.log('\n当前文章：');
entries.forEach((name, index) => {
  console.log(`${String(index + 1).padStart(2, ' ')}. ${name}`);
});

const rl = createInterface({ input, output });
const answer = (await rl.question('\n请输入要删除的文章编号或文件名（直接回车取消）：')).trim();

if (!answer) {
  rl.close();
  console.log('已取消。');
  process.exit(0);
}

let filename;
const index = Number(answer);
if (Number.isInteger(index) && index >= 1 && index <= entries.length) {
  filename = entries[index - 1];
} else {
  filename = answer.endsWith('.md') ? answer : `${answer}.md`;
}

if (!entries.includes(filename)) {
  rl.close();
  console.error(`未找到文章：${filename}`);
  process.exit(1);
}

const target = path.join(postsDir, filename);
const targetStat = await stat(target);
if (!targetStat.isFile()) {
  rl.close();
  console.error('目标不是普通文件，已拒绝删除。');
  process.exit(1);
}

console.log(`\n将删除：src/content/${collection}/${filename}`);
console.log(`对应页面通常是：/${collection}/${filename.replace(/\.md$/, '')}/`);
const confirm = (await rl.question('请输入 DELETE 确认删除，其他输入均取消：')).trim();
rl.close();

if (confirm !== 'DELETE') {
  console.log('已取消，没有删除任何文件。');
  process.exit(0);
}

await unlink(target);
console.log(`已删除：src/content/${collection}/${filename}`);
console.log('建议运行 npm run build，确认文章页面和 Pagefind 搜索索引都已更新。');
