import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';
import { SITE } from '../lib/site';

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export const GET: APIRoute = async ({ site }) => {
  const base = site ?? new URL('https://zhangthird.github.io');
  const posts = (await getCollection('research'))
    .filter((post) => !post.data.draft)
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());

  const items = posts.map((post) => {
    const url = new URL(`/${post.collection}/${post.id}/`, base).href;
    return `<item><title>${escapeXml(post.data.title)}</title><link>${url}</link><guid>${url}</guid><pubDate>${post.data.pubDate.toUTCString()}</pubDate><description>${escapeXml(post.data.description)}</description></item>`;
  }).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8" ?><rss version="2.0"><channel><title>${escapeXml(SITE.name)}</title><link>${base.href}</link><description>${escapeXml(SITE.description)}</description>${items}</channel></rss>`;

  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
};
