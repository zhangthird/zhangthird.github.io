# Cheng Cui — Research, Code & Notes

个人网站源码，对应 <https://zhangthird.github.io/>。

本站以内容阅读为核心，用于长期发布 Research & Engineering 技术文章、Projects、Essays、Photos 和历史归档。技术栈保持轻量：Astro 静态生成、Markdown 内容集合、KaTeX 数学公式、Shiki 代码高亮、Pagefind 全文搜索，以及少量原生浏览器脚本。

## 本地开发

需要 Node.js 22+。

```bash
npm ci
npm run dev
```

完整检查：

```bash
npm run check
npm run build
npm test
npm run preview
```

## 常用内容命令

```bash
npm run new:research
npm run delete:research
```

Research 文章位于：

```text
src/content/research/
```

## 文档

- [公开文档索引](docs/index.md)
- [浏览本站](docs/site-guide.md)
- [设计理念](docs/design-principles.md)

维护、部署和内容编辑资料仅保留在本地的 `docs/local/` 中，不随公共仓库分发。
