import type { CollectionEntry } from 'astro:content';

export function tagSlug(tag: string) {
  return tag
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function tagHref(tag: string) {
  return `/tags/${tagSlug(tag)}/`;
}

export function collectTags(posts: CollectionEntry<'research'>[]) {
  const tags = new Map<string, { name: string; count: number }>();
  for (const post of posts) {
    for (const name of post.data.tags) {
      const slug = tagSlug(name);
      if (!slug) continue;
      const current = tags.get(slug);
      tags.set(slug, { name, count: (current?.count ?? 0) + 1 });
    }
  }
  return [...tags.entries()]
    .map(([slug, tag]) => ({ slug, ...tag }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
