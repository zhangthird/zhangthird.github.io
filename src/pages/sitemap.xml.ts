import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';
import { legacyPosts } from '../lib/legacy';

export const GET: APIRoute = async ({ site }) => {
  const base = site ?? new URL('https://zhangthird.github.io');
  const posts = (await getCollection('research')).filter((post) => !post.data.draft);
  const staticPaths = ['/', '/research/', '/projects/', '/about/', '/essays/', '/photos/', '/archives/'];
  const urls: { loc: string; lastmod?: string }[] = [
    ...staticPaths.map((path) => ({ loc: new URL(path, base).href })),
    ...legacyPosts.map(post => ({ loc: new URL(post.url, base).href })),
    ...posts.map((post) => ({ loc: new URL(`/${post.collection}/${post.id}/`, base).href, lastmod: (post.data.updatedDate ?? post.data.pubDate).toISOString() })),
  ];

  const body = urls.map((item) => `<url><loc>${item.loc}</loc>${item.lastmod ? `<lastmod>${item.lastmod}</lastmod>` : ''}</url>`).join('');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
