import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(process.cwd(), 'post');
const cleanText = (value: string) => value.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
export const legacyPosts = readdirSync(root).filter(slug => existsSync(`${root}/${slug}/index.html`)).map(slug => {
  const html = readFileSync(`${root}/${slug}/index.html`, 'utf8');
  const title = html.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.replace(/\s*\|\s*张山$/, '').trim();
  const date = html.match(/class="post-date"[^>]*>\s*([^<]+)/)?.[1]?.trim().slice(0,10);
  const original = html.match(/<div class="post-content"[^>]*>([\s\S]*?)\n\s*<\/div>/)?.[1]?.trim();
  if(!title || !original || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`无法迁移旧文章: ${slug}`);
  const body = original.replaceAll('https://zhangthird.github.io', '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
  const text = cleanText(body);
  const headings = [...body.matchAll(/<h([23])\b[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/g)].map(m=>({depth:Number(m[1]),id:m[2],text:cleanText(m[3])}));
  return {slug,title,date,body,text,headings,description:text.slice(0,130),url:`/post/${slug}/`,minutes:Math.max(1,Math.ceil(text.length/450))};
}).sort((a,b)=>b.date.localeCompare(a.date));
