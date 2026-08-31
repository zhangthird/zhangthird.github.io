# 部署与质量检查

## 1. 本地环境

要求 Node.js 22+。

```bash
npm ci
npm run dev
```

## 2. 生产构建

```bash
npm run check
npm run build
npm test
```

`npm run build` 的实际流程包含：

```text
prebuild: sanitize photos
astro build
legacy-output.mjs
pagefind --site dist
```

所以不要只执行 `astro build` 来判断最终部署结果是否完整。

## 3. 本地预览

```bash
npm run preview
```

应至少检查：

- 首页和各一级页面
- Research 文章
- 公式、代码、目录和复制按钮
- 阅读进度和目录高亮
- Search Dialog 与 `/search/`
- 中英文 UI
- Light/Dark Mode
- Photos
- RSS / Sitemap
- 历史 `/post/.../` URL

## 4. GitHub Actions

工作流位于：

```text
.github/workflows/deploy.yml
```

### Pull Request

PR 只执行：

```text
npm ci
npm run check
npm run build
npm test
```

不会部署 GitHub Pages。

### main push

`main` 更新后，在上述检查通过后上传 `dist/` 并部署到 GitHub Pages。

## 5. 发布内容后的检查

新增文章：确认它出现在 Research、Archives、RSS、Sitemap 和 Pagefind 搜索中。

修改文章：确认 canonical URL 没有意外变化。

删除或重命名已公开文章：检查是否需要重定向，避免已有外部链接直接失效。

## 6. 回滚

站点为纯静态部署，因此出现问题时优先通过 Git 回滚对应 commit，再让 GitHub Actions 重新部署，不需要处理数据库迁移。

## 7. 依赖更新

不要为了追最新版而无条件更新全部依赖。更新 Astro、KaTeX、Pagefind、Sharp 等核心依赖后，必须完整运行：

```bash
npm run check
npm run build
npm test
```

特别检查：内容集合 API、Markdown 渲染、历史输出、搜索索引和图片处理。