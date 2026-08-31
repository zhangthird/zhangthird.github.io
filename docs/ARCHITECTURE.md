# 系统架构

## 1. 总体目标

这个网站不是 SPA，也不是带后端的内容管理系统。核心目标是：内容优先、静态输出、加载快、长期可维护，并适合技术文章中的公式、代码和动态演示。

整体流程：

```text
Markdown / legacy content
        ↓
Astro Content Collections / legacy adapters
        ↓
Astro pages + layouts + components
        ↓
Static HTML / CSS / small browser scripts
        ↓
legacy-output.mjs
        ↓
Pagefind index
        ↓
dist/
        ↓
GitHub Pages
```

## 2. 主要目录

```text
src/
├── components/      可复用 UI
├── content/         新内容，Research 文章位于这里
├── data/            结构化数据
├── layouts/         全站布局
├── lib/             i18n、格式化、照片、复制逻辑等
├── pages/           Astro 路由
└── styles/          全局设计 Token 与样式

post/                 历史站点文章源
scripts/              构建、迁移、内容管理、照片处理脚本
tests/                Node 测试
public/               静态资源
.github/workflows/     CI/CD
```

## 3. 内容模型

当前正式的 Astro Content Collection 是 `research`。Schema 定义在 `src/content.config.ts`：

```text
title
 description
 pubDate
 updatedDate?
 tags[]
 featured
 draft
 readingTime?
```

发布文章时 `draft: false`。草稿不会进入 Research 列表和静态文章路由。

历史 Essays 继续通过旧文章数据适配层提供，避免为了统一格式而破坏已有 URL 和历史内容。

## 4. 页面路由

主要路由：

```text
/                 首页
/research/         Research & Engineering
/research/:id/     技术文章
/projects/         Projects
/essays/           Essays
/photos/           Photos
/about/            About
/archives/         全部归档
/search/           独立搜索页
/rss.xml           RSS
/sitemap.xml       Sitemap
```

历史 `/post/.../` URL 继续保留。

## 5. 渲染与浏览器运行时边界

构建阶段负责：

- Markdown → HTML
- KaTeX 数学公式
- Shiki 代码高亮
- RSS / Sitemap
- 静态页面生成
- 历史页面兼容输出
- Pagefind 搜索索引

浏览器端只负责确实需要交互的功能：

- 深浅色主题
- 中英文 UI 切换
- Ctrl/Cmd + K 搜索
- 内容复制
- 动态 Demo 的可视区域播放控制
- 技术文章阅读进度
- 目录当前章节高亮
- Astro ClientRouter 页面切换

原则：可以在构建阶段完成的事情，不放到浏览器运行时。

## 6. 国际化

`src/lib/i18n.mjs` 只翻译网站 UI。技术文章标题和正文保留作者原始语言，不做运行时机器翻译。

语言状态保存在 `localStorage`，页面初始 `lang` 仍由服务端输出为英文，随后根据用户设置切换 UI。

## 7. 搜索

Pagefind 在 `npm run build` 的最后阶段从 `dist/` 建立静态索引。浏览器搜索不依赖后端。

因此：新增、修改、删除文章后，要重新执行完整 build 才能验证搜索结果。

## 8. 部署

GitHub Actions 在 `main` push 时：

```text
npm ci
→ npm run check
→ npm run build
→ npm test
→ upload dist
→ GitHub Pages deploy
```

Pull Request 也执行安装、检查、构建和测试，但不部署。

## 9. 架构边界

除非出现明确需求，不建议引入：

- React/Vue 作为全站运行时
- 数据库
- 服务端渲染
- CMS 后端
- 重型 UI 组件库
- 客户端 Markdown 渲染

如果某项需求可以通过 Astro 静态生成、Web Components 或几十行原生 JavaScript 解决，应优先使用现有架构。