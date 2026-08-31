# 功能说明

## 首页

首页直接以内容为入口，不使用传统 Portfolio Hero。当前展示最新 Research & Engineering 内容，并提供 Essays 入口。

## Research & Engineering

内容来源：`src/content/research/`。

支持：

- Markdown
- 数学公式（KaTeX）
- 代码高亮（Shiki）
- 标签
- 阅读时间
- 自动目录
- 阅读进度条
- 当前目录章节高亮
- 结构化 Article JSON-LD
- 动态视频 Demo
- 公式与代码复制

## Essays

用于生活、阅读、学习等非技术内容。当前主要承接旧站历史文章，并保留原有 URL。

## Projects

用于展示真实项目、源码和技术实现。项目页应展示可验证的产出，而不是技能列表。

## Photos

照片由本地静态资源驱动。构建前会执行照片清理脚本，避免将不需要的元数据带到公开站点。

## Archives

统一聚合 Research、Essays 和旧站页面，按年份归档。

## 搜索

- `Ctrl + K` / `Cmd + K` 打开搜索 Dialog
- 独立 `/search/` 页面
- Pagefind 静态索引
- 无后端

## 主题

Light / Dark Mode。默认跟随系统，用户手动选择后写入 `localStorage`。

## UI 中英文切换

只切换网站导航、按钮、提示等界面文本。文章标题和正文保持原语言。

## 动态 Demo

技术文章支持 `<video class="demo-video" data-autoplay-demo>`。进入主要可视区域时自动播放，离开后暂停；系统启用 Reduced Motion 时不主动播放。

## RSS / Sitemap / SEO

- `/rss.xml`
- `/sitemap.xml`
- canonical
- Open Graph
- Twitter Card
- Research 文章 JSON-LD

## 兼容历史内容

旧 `/post/.../` 页面继续生成，以免外部链接和搜索引擎历史索引失效。部分旧路径通过重定向兼容新的 Research 路径。