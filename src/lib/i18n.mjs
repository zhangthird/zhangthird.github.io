// UI translations only. Article titles and bodies retain their original language.
export const messages = {
  'nav.research': ['Research & Engineering', '研究与工程'],
  'nav.projects': ['Projects', '项目'],
  'nav.essays': ['Essays', '随笔'],
  'nav.photos': ['Photos', '照片'],
  'photos.empty': ['No photos yet.', '暂时还没有照片。'],
  'photos.open': ['View full-size photo', '查看大图'],
  'nav.about': ['About', '关于'],
  'nav.archives': ['Archives', '归档'],
  'nav.primary': ['Primary navigation', '主导航'],
  'nav.home': ['Cheng Cui home', 'Cheng Cui 首页'],
  'language.toggle': ['中', 'EN'],
  'language.label': ['Switch to Chinese', '切换为英文'],
  'skip': ['Skip to content', '跳到正文'],
  'theme.light': ['Switch to light mode', '切换浅色模式'],
  'theme.dark': ['Switch to dark mode', '切换深色模式'],
  'home.title': ['Articles by Cheng Cui', 'Cheng Cui 的文章'],
  'allNotes': ['All notes', '全部笔记'],
  'allEssays': ['All essays · {count}', '全部随笔 · {count} 篇'],
  'essayIntro': ['Notes on reading, learning, and everyday life.', '读书、学习和日常生活的记录。'],
  'researchIntro': ['Paper reading, method notes, and code implementations.', '论文阅读、方法推导与代码实现。'],
  'empty': ['No articles yet.', '暂无文章。'],
  'about.bio': ["I'm Cheng Cui. My interests include reinforcement learning, multi-agent learning, and AI agents, as well as scheduling and energy constraints in UAV communications.", '我是 Cheng Cui，关注强化学习、多智能体学习和 AI Agents，也对无人机通信中的调度与能量约束问题感兴趣。'],
  'email': ['Email', '邮箱'],
  'project.name': ['Personal Website', '个人网站'],
  'project.type': ['Web / Open Source', '网站 / 开源'],
  'project.intro': ['Built with Astro, with articles written in Markdown. Supports math, syntax highlighting, and full-text search.', '本站使用 Astro 构建，文章用 Markdown 编写。支持数学公式、代码高亮和全文搜索。'],
  'project.rendering': ['Rendering', '内容渲染'],
  'project.renderingBody': ['KaTeX renders formulas; Shiki highlights code.', 'KaTeX 渲染公式，Shiki 处理代码高亮。'],
  'project.searchBody': ['Pagefind builds the search index ahead of time. Searches run in the browser without a backend.', 'Pagefind 在构建时生成搜索索引，浏览器直接查询，不需要后端服务。'],
  'project.source': ['View source on GitHub', '查看 GitHub 源码'],
  'archive.title': ['All articles', '全部归档'],
  'archive.count': ['{articles} articles · {pages} archived page', '{articles} 篇文章，{pages} 个旧站页面。'],
  'archive.page': ['Archived page', '旧站页面'],
  'article.count': ['{count} articles', '{count} 篇文章'],
  'article.readingTime': ['{count} min read', '约 {count} 分钟阅读'],
  'article.legacy': ['Zhang Shan · Archived article', '张山 · 历史文章'],
  'article.written': ['Written on {date}.', '写于 {date}。'],
  'contents': ['Contents', '目录'],
  'search.title': ['Search', '搜索'],
  'search.label': ['Search articles (Ctrl or Cmd + K)', '搜索文章（Ctrl 或 Cmd 加 K）'],
  'search.close': ['Close search', '关闭搜索'],
  'search.keywords': ['Keywords', '关键词'],
  'search.placeholder': ['Search titles, articles, or keywords', '搜索标题、正文或关键词'],
  'search.start': ['Enter a keyword to start searching.', '输入关键词开始搜索。'],
  'search.loading': ['Searching…', '正在搜索…'],
  'search.none': ['No results. Try another keyword.', '没有匹配的内容，试试其他关键词。'],
  'search.results': ['{count} results', '找到 {count} 条结果'],
  'search.resultsLimited': ['{count} results · showing the first 8', '找到 {count} 条结果，显示前 8 条'],
  'search.error': ['Full-text search is unavailable. Use the search page below.', '全文索引暂不可用，请使用下方独立搜索页。'],
  'search.page': ['Open search page', '打开独立搜索页'],
  'search.note': ['Note', '文章'],
  'math.tex': ['Copy LaTeX', '复制 LaTeX'],
  'math.hint': ['Copy LaTeX (Shift-click for Markdown)', '复制 LaTeX（按住 Shift 点击可复制 Markdown）'],
  'code.copy': ['Copy', '复制'],
  'code.copied': ['Code copied', '已复制代码'],
  'copy.copied': ['Copied ✓', '已复制 ✓'],
  'copy.source': ['Source text for manual copying', '可手动复制的源码'],
  'math.copiedTex': ['LaTeX copied', '已复制 LaTeX'],
  'math.copiedMarkdown': ['Markdown copied', '已复制 Markdown'],
  'math.failed': ['Could not copy automatically. Select the source and press Ctrl/Cmd+C.', '无法自动复制，请选中源码后按 Ctrl/Cmd+C。'],
  'notFound.title': ['Nothing here.', '没有找到这个页面。'],
  'notFound.body': ['The page may have moved, or the URL is incorrect.', '页面可能已移动，或链接有误。'],
  'notFound.home': ['Back home', '返回首页'],
  'meta.home.title': ['Cheng Cui — Research, Code & Notes', 'Cheng Cui — 研究、代码与随笔'],
  'meta.home.description': ['Notes on reinforcement learning, AI agents, and UAV communications, alongside personal essays.', '强化学习、AI Agents 和无人机通信相关笔记，以及生活随笔。'],
  'meta.research.title': ['Research & Engineering — Cheng Cui', '研究与工程 — Cheng Cui'],
  'meta.research.description': ['Paper reading, method notes, and code implementations.', '论文阅读、方法推导与代码实现笔记。'],
  'meta.about.title': ['About — Cheng Cui', '关于 — Cheng Cui'],
  'meta.about.description': ['Cheng Cui’s research interests and contact details.', 'Cheng Cui 的研究兴趣与联系方式。'],
  'meta.projects.title': ['Projects — Cheng Cui', '项目 — Cheng Cui'],
  'meta.projects.description': ['Personal projects and source code by Cheng Cui.', 'Cheng Cui 的个人项目与源码链接。'],
  'meta.essays.title': ['Essays — Cheng Cui', '随笔 — Cheng Cui'],
  'meta.essays.description': ['Personal essays, reading notes, and study notes by Cheng Cui.', 'Cheng Cui 的随笔、读书摘记与学习笔记。'],
  'meta.photos.title': ['Photos — Cheng Cui', '照片 — Cheng Cui'],
  'meta.photos.description': ['Cheng Cui’s photo collection.', 'Cheng Cui 的照片。'],
  'meta.archives.title': ['Archives — Cheng Cui', '归档 — Cheng Cui'],
  'meta.archives.description': ['All research, engineering, and personal articles, organized by year.', '全部文章归档，按年份查看研究与工程笔记和随笔。'],
  'meta.search.title': ['Search — Cheng Cui', '搜索 — Cheng Cui'],
  'meta.search.description': ['Search technical notes and archived articles.', '搜索技术笔记与历史文章。'],
};

export function normalizeLanguage(value) { return value === 'zh' || value === 'zh-CN' ? 'zh' : 'en'; }
export function translate(key, language = 'en', params = {}) {
  const pair = messages[key];
  if (!pair) throw new Error(`Unknown translation: ${key}`);
  const locale = normalizeLanguage(language);
  let text = pair[locale === 'zh' ? 1 : 0];
  if (locale === 'en' && key === 'archive.count' && Number(params.pages) !== 1) text += 's';
  if (locale === 'en' && key === 'article.count' && Number(params.count) === 1) text = '{count} article';
  return text.replace(/\{(\w+)\}/g, (token, name) => String(params[name] ?? token));
}
export function currentLanguage(doc = document) { return normalizeLanguage(doc.documentElement.lang); }
export function preferredLanguage(storage, fallback = 'en') {
  try { return normalizeLanguage(storage?.getItem('site-language') || fallback); } catch { return normalizeLanguage(fallback); }
}
export function setMessage(element, key, params = {}) {
  if (!element) return;
  element.setAttribute('data-site-i18n', key);
  element.setAttribute('data-site-i18n-params', JSON.stringify(params));
  element.textContent = key ? translate(key, currentLanguage(element.ownerDocument), params) : '';
}
export function applyLanguage(doc, language) {
  const locale = normalizeLanguage(language);
  doc.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
  for (const element of doc.querySelectorAll('[data-site-i18n]')) {
    const key = element.getAttribute('data-site-i18n');
    // Preserve server-rendered text for unknown keys and unchanged text nodes.
    if (!Object.hasOwn(messages, key)) continue;
    let params = {};
    try {
      const parsed = JSON.parse(element.getAttribute('data-site-i18n-params') || '{}');
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) params = parsed;
    } catch { /* One malformed parameter must not break the whole UI. */ }
    const text = translate(key, locale, params);
    if (text && element.textContent !== text) element.textContent = text;
  }
  for (const attr of ['aria-label', 'placeholder', 'title', 'content']) {
    for (const element of doc.querySelectorAll(`[data-site-i18n-${attr}]`)) {
      const key = element.getAttribute(`data-site-i18n-${attr}`);
      if (!Object.hasOwn(messages, key)) continue;
      const text = translate(key, locale);
      if (element.getAttribute(attr) !== text) element.setAttribute(attr, text);
    }
  }
  for (const element of doc.querySelectorAll('time[data-site-i18n-date]')) {
    const date = new Date(element.getAttribute('datetime'));
    if (Number.isNaN(date.getTime())) continue;
    const text = new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en', {year:'numeric',month:'short',day:'2-digit',timeZone:'UTC'}).format(date);
    if (element.textContent !== text) element.textContent = text;
  }
}
export function changeLanguage(doc, language, storage) {
  const locale = normalizeLanguage(language);
  try { storage?.setItem('site-language', locale); } catch { /* Session-only switching remains available. */ }
  applyLanguage(doc, locale);
  return locale;
}
