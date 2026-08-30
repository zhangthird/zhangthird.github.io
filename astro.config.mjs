import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

export default defineConfig({
  site: 'https://zhangthird.github.io',
  trailingSlash: 'always',
  redirects: {
    '/writing/': '/research/',
    '/writing/react-agent-loop/': '/research/react-agent-loop/',
    '/writing/rethinking-transformers-for-pomdps/': '/research/rethinking-transformers-for-pomdps/',
    '/writing/pid-lagrangian-rl/': '/research/pid-lagrangian-rl/',
  },
  markdown: {
    processor: unified({
      remarkPlugins: [remarkMath],
      rehypePlugins: [[rehypeKatex, { strict: false, throwOnError: false, output: 'htmlAndMathml' }]],
    }),
    shikiConfig: {
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
      wrap: true,
    },
  },
});
