import { setMessage, translate, currentLanguage } from './i18n.mjs';

/** @param {string} tex @param {boolean} display @param {boolean} markdown */
export function formatMathCopy(tex, display, markdown = false) {
  return !markdown ? tex : display ? `$$\n${tex}\n$$` : `$${tex}$`;
}

/** Copy source text only; never read clipboard contents. */
export async function copyText(value, clipboard) {
  try {
    if (!clipboard) return false;
    await clipboard.writeText(value);
    return true;
  } catch { return false; }
}

/** Enhance existing rendered content without changing its text or highlighting. */
export function setupContentCopy(host) {
  const doc = host.ownerDocument;
  const win = doc.defaultView;
  if (!win) return () => {};
  const controller = new AbortController();
  const status = host.querySelector('[data-copy-status]');
  const regions = [];
  const timers = new Set();

  const enhance = (target, source, kind, display = false) => {
    if (target.closest('.copy-region')) return;
    const math = kind === 'math';
    const region = doc.createElement(math ? 'span' : 'div');
    region.className = `copy-region ${math ? (display ? 'copy-math-block' : 'copy-math-inline') : 'copy-code'}`;
    const button = doc.createElement('button');
    button.type = 'button';
    button.className = `copy-control ${math ? 'copy-math-control' : 'copy-code-control'}`;
    button.setAttribute('data-copy-kind', kind);
    button.setAttribute('data-pagefind-ignore', '');
    const label = math ? 'math.tex' : 'code.copy';
    const hint = math ? 'math.hint' : 'code.copy';
    button.setAttribute('data-site-i18n-aria-label', label);
    button.setAttribute('aria-label', translate(label, currentLanguage(doc)));
    button.setAttribute('data-site-i18n-title', hint);
    button.setAttribute('title', translate(hint, currentLanguage(doc)));
    const icon = doc.createElement('span');
    icon.setAttribute('aria-hidden', 'true');
    const reset = () => {
      region.classList.remove('copy-done');
      if (math) icon.textContent = '⧉';
      else setMessage(button, 'code.copy');
    };
    if (math) button.append(icon);
    reset();
    target.replaceWith(region);
    region.append(target, button);
    regions.push({ region, target });
    let fallback;
    let timer;

    button.addEventListener('click', async event => {
      if (button.disabled) return;
      win.clearTimeout(timer);
      timers.delete(timer);
      const value = math ? formatMathCopy(source.textContent, display, event.shiftKey) : source.textContent;
      setMessage(status, '');
      button.disabled = true;
      const copied = await copyText(value, win.navigator.clipboard);
      if (controller.signal.aborted || !region.isConnected) return;
      button.disabled = false;
      if (!copied) {
        // Only permission failures reveal a manual source field, in normal page flow.
        if (!fallback) {
          fallback = doc.createElement('textarea');
          fallback.className = 'copy-source-fallback';
          fallback.readOnly = true;
          fallback.rows = 2;
          fallback.setAttribute('data-pagefind-ignore', '');
          fallback.setAttribute('data-site-i18n-aria-label', 'copy.source');
          fallback.setAttribute('aria-label', translate('copy.source', currentLanguage(doc)));
          region.append(fallback);
        }
        fallback.value = value;
        fallback.focus({ preventScroll: true });
        fallback.select();
        setMessage(status, 'math.failed');
        reset();
        return;
      }
      fallback?.remove();
      fallback = undefined;
      region.classList.add('copy-done');
      if (math) icon.textContent = '✓';
      else setMessage(button, 'copy.copied');
      setMessage(status, math ? (event.shiftKey ? 'math.copiedMarkdown' : 'math.copiedTex') : 'code.copied');
      timer = win.setTimeout(() => { timers.delete(timer); reset(); }, 1600);
      timers.add(timer);
    }, { signal: controller.signal });
  };

  for (const formula of doc.querySelectorAll('.prose .katex')) {
    const source = formula.querySelector('annotation[encoding="application/x-tex"]');
    if (!source?.textContent) continue;
    const block = formula.closest('.katex-display');
    enhance(block || formula, source, 'math', Boolean(block));
  }
  for (const pre of doc.querySelectorAll('.prose pre')) {
    const code = pre.querySelector('code');
    if (code) enhance(pre, code, 'code');
  }

  return () => {
    controller.abort();
    for (const timer of timers) win.clearTimeout(timer);
    for (const { region, target } of regions) region.replaceWith(target);
  };
}
