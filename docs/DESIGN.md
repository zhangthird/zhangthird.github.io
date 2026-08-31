# 视觉与交互设计规范

## 1. 设计方向

网站采用内容优先的技术作者主页风格。参考 Mario Zechner 一类个人技术站的克制排版，但不是复制具体视觉元素。

核心原则：

- 正文和文章列表优先于装饰
- 少量强调色，不使用大面积渐变
- 不做技能进度条、Logo 墙和模板化 Hero
- 动画只用于反馈和阅读辅助
- 技术内容中的公式、代码、图和 Demo 都是一级内容

## 2. 设计 Token

设计 Token 位于 `src/styles/global.css` 的 `:root` 与 dark theme 区域。

主要角色：

```text
--bg            页面背景
--surface       卡片、输入框等表面
--surface-2     次级表面
--text          主文字
--muted         次级文字
--faint         日期等弱信息
--line          默认分隔线
--line-strong   强边界
--accent        全站强调色
--reading-width 文章正文最大宽度
--page-width    页面最大宽度
```

修改视觉时优先调整 Token，不要在单个页面随意引入新的颜色值和字号。

## 3. 排版

正文使用系统 Sans 字体栈，代码使用系统等宽字体栈。数学公式由 KaTeX 使用自己的数学字体。

技术文章正文宽度控制在约 44rem，避免桌面大屏上一行过长。

标题大小保持适中，不采用营销落地页式超大字号。

## 4. 导航

顶部导航保持固定的一层主要信息架构：

```text
Research & Engineering
Projects
Essays
Photos
About
```

Archives 和 RSS 放在 Footer，避免主导航过度膨胀。

如果未来一级栏目超过 6 个，应先重新审视信息架构，而不是继续向 Header 塞入口。

## 5. 首页

首页职责是让访问者快速进入内容，而不是完整介绍个人经历。

推荐优先级：

1. 最新 Research & Engineering
2. Essays 入口
3. 后续如有足够真实项目，可增加少量 Selected Projects

不建议新增：技能百分比、技术 Logo 网格、统计数字动画、自动播放背景视频。

## 6. 文章阅读

文章页结构：

```text
Back link
Title
Description
Date / reading time / tags
────────────
Article body        Contents
```

桌面端目录 sticky；窄屏隐藏，避免压缩正文。

阅读进度条固定在页面最上方，仅提供轻量位置反馈，不显示百分比文本。

目录当前章节使用文字颜色和字重变化，不使用大色块。

## 7. 代码与数学公式

代码块和公式不应为了视觉效果加重边框、渐变或阴影。

复制按钮保持低存在感：鼠标 hover/focus 时出现，触摸设备上直接可见。

## 8. 动态 Demo

Demo 的目标是解释技术过程，而不是装饰文章。

适合：

- Coding Agent 执行过程
- Browser Agent
- Terminal/TUI
- UAV trajectory
- RL rollout
- 算法交互过程

默认视频样式应贴合正文宽度。短 Demo 可自动播放，但必须静音，并在离开视口后暂停。复杂可交互过程再单独实现 HTML/CSS/JS 组件。

## 9. 动效

允许：

- 链接颜色变化
- 轻量页面 View Transition
- 阅读进度
- 搜索 Dialog
- Demo 自动播放控制

所有动画必须尊重 `prefers-reduced-motion`。

## 10. 响应式

移动端首先保证：

- 导航可读
- 正文不横向溢出
- 代码可以横向滚动
- 图片/视频不超过容器宽度
- 触摸操作目标足够大

不要为了保持桌面布局而压缩正文列和 TOC；当前方案是在小屏隐藏侧边 TOC。

## 11. 可访问性

必须保留：

- Skip link
- `:focus-visible`
- 合理的 `aria-label`
- 当前导航的 `aria-current`
- 语义化 `article` / `nav` / `time`
- Reduced Motion

视觉修改不得通过 `outline: none` 等方式破坏键盘操作。