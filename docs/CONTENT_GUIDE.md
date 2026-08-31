# 内容维护指南

## 1. 新建 Research 文章

推荐使用：

```bash
npm run new:research
```

文章位于：

```text
src/content/research/
```

典型 frontmatter：

```yaml
---
title: "Article title"
description: "Short summary."
pubDate: 2026-08-31
updatedDate: 2026-08-31
tags: ["RL", "POMDP"]
featured: false
draft: false
readingTime: "8 min read"
---
```

`draft: true` 时不会进入正式 Research 页面。

## 2. 修改文章

直接编辑对应 Markdown 文件。

如果只是修改标题、正文、标签或描述，文件名不变，则文章 URL 不变。

如果修改文件名，例如：

```text
react-agent-loop.md
→ minimal-react-agent-loop.md
```

对应 URL 也会变化：

```text
/research/react-agent-loop/
→ /research/minimal-react-agent-loop/
```

已经公开的文章不建议随意改文件名。如果必须更换 URL，应同时增加兼容重定向。

## 3. 删除文章

推荐：

```bash
npm run delete:research
```

也可以手动删除 `src/content/research/` 下的 Markdown 文件。

删除公开文章前先确认：

- 是否已有外部链接
- 是否被 RSS、搜索引擎或其他文章引用
- 是否应该改为重定向而不是直接 404
- 关联图片、视频是否仍被其他文章使用

删除后执行完整构建，以更新 Pagefind、RSS 和 Sitemap。

## 4. 数学公式

Markdown 中使用：

```markdown
$$
J(\pi) = \mathbb{E}_{\tau \sim \pi}\left[\sum_{t=0}^{T}\gamma^t r_t\right]
$$
```

较短行内公式使用 `$...$`。

## 5. 代码块

```markdown
```python
print("hello")
```
```

构建时由 Shiki 高亮。

## 6. 普通图片

把静态资源放在 `public/` 下，例如：

```text
public/images/research/pomdp-overview.webp
```

文章中：

```markdown
![POMDP overview](/images/research/pomdp-overview.webp)
```

优先使用 WebP/AVIF/JPEG 等合理格式，并提前压缩。

## 7. 动态技术 Demo

建议目录：

```text
public/demos/<article-slug>/
```

示例：

```html
<figure class="demo-figure">
  <video
    class="demo-video"
    controls
    autoplay
    muted
    loop
    playsinline
    preload="metadata"
    data-autoplay-demo
    poster="/demos/agent-loop/demo-poster.webp"
  >
    <source src="/demos/agent-loop/demo.webm" type="video/webm" />
    <source src="/demos/agent-loop/demo.mp4" type="video/mp4" />
  </video>
  <figcaption>Tool calls streaming into the terminal UI.</figcaption>
</figure>
```

`data-autoplay-demo` 会启用站点已有的视口播放控制：进入主要可视区域播放，离开后暂停；Reduced Motion 用户不自动播放。

## 8. 发布前检查

每次发布重要内容前至少运行：

```bash
npm run check
npm run build
npm test
```

再用：

```bash
npm run preview
```

检查：

- 公式
- 代码
- 图片与 Demo
- 目录
- 搜索
- Light/Dark Mode
- 中英文 UI
- 移动端布局
- 新文章是否进入 RSS / Sitemap / Archives
