import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync,statSync} from 'node:fs';
import {join,resolve,dirname,basename} from 'node:path';
import {formatMathCopy,copyText,setupContentCopy} from '../src/lib/content-copy.mjs';
import {messages,translate,normalizeLanguage,preferredLanguage,changeLanguage,applyLanguage,setMessage} from '../src/lib/i18n.mjs';
import {preparePhotos} from '../src/lib/photos.mjs';
import {stripJpegMetadata} from '../scripts/import-photo.mjs';
import sharp from 'sharp';
import {mkdtemp,writeFile,readFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {sanitizePhoto,sanitizeDirectory,hasPrivateMetadata} from '../scripts/sanitize-photos.mjs';
const root=resolve('dist');
function walk(dir){return readdirSync(dir).flatMap(name=>{const p=join(dir,name);return statSync(p).isDirectory()?walk(p):[p];});}
const pages=walk(root).filter(p=>p.endsWith('.html'));
const legacySlugs=readdirSync('post').filter(slug=>existsSync(`post/${slug}/index.html`));
const read=p=>readFileSync(join(root,p),'utf8');
const clean=s=>s.replace(/\s+/g,' ').trim();
test('every historical article preserves title, date and complete body',()=>{
  for(const slug of legacySlugs){
    const original=readFileSync(`post/${slug}/index.html`,'utf8');
    const title=original.match(/<title>(.*?)<\/title>/s)[1].replace(/\s*\|\s*张山$/,'').trim();
    const date=original.match(/class="post-date"[^>]*>\s*([^<]+)/)[1].trim();
    const body=original.match(/<div class="post-content"[^>]*>([\s\S]*?)\n\s*<\/div>/)[1].trim().replaceAll('https://zhangthird.github.io','').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
    const output=read(`post/${slug}/index.html`);
    assert.ok(output.includes(title),slug+' title');
    assert.ok(output.includes(date),slug+' date');
    assert.ok(clean(output).includes(clean(body)),slug+' complete body');
  }
});
test('reference technical posts render math and syntax-highlighted code',()=>{
  for(const id of ['react-agent-loop','rethinking-transformers-for-pomdps','pid-lagrangian-rl']){
    const collection='research';
    const html=read(`${collection}/${id}/index.html`);
    assert.match(html,/class="katex/);
    assert.match(html,/data-pagefind-meta="title"/);
    assert.match(html,/property="og:image"/);
    assert.match(html,/name="twitter:image"/);
    assert.match(html,/og:type" content="article"/);
  }
  assert.match(read('research/react-agent-loop/index.html'),/astro-code|shiki/);
});
test('local navigation, stylesheets and images resolve in deployment output',()=>{
  const broken=[];
  for(const file of pages){
    const html=readFileSync(file,'utf8');
    for(const match of html.matchAll(/(?:href|src)="([^"#]+)"/g)){
      const href=match[1];
      if(!href.startsWith('/')||href.startsWith('//'))continue;
      const path=decodeURIComponent(href.split(/[?#]/)[0]);
      let target=join(root,path);
      if(existsSync(target)&&statSync(target).isDirectory())target=join(target,'index.html');
      if(!existsSync(target))broken.push(`${file}: ${href}`);
    }
  }
  assert.deepEqual(broken,[]);
});
test('pages have canonical, language, accessible main and descriptions',()=>{
  for(const file of pages){
    const html=readFileSync(file,'utf8');
    if (/http-equiv="refresh"/i.test(html)) continue;
    assert.match(html,/<html[^>]+lang="en"/);
    assert.match(html,/<main[^>]+id="main-content"/);
    assert.match(html,/<link[^>]+rel="canonical"[^>]+href="https:\/\/zhangthird.github.io\//);
    assert.match(html,/<meta name="description" content="[^"]+"/);
    assert.match(html,/href="#main-content"/);
  }
});
test('no old comment credentials or external runtime frameworks ship',()=>{
  for(const path of walk(root).filter(p=>/\.(html|js)$/.test(p))){
    const content=readFileSync(path,'utf8');
    assert.doesNotMatch(content,/clientSecret\s*:|new Gitalk\(|cdn\.jsdelivr\.net\/npm\/vue/);
  }
});
test('new pages use unified navigation without migration commentary or placeholders',()=>{
  for(const file of ['index.html','about/index.html','projects/index.html','essays/index.html','research/index.html']){
    const html=read(file);
    for(const label of ['Research &amp; Engineering','Projects','Essays','Photos','About'])assert.ok(html.includes(label));
    assert.doesNotMatch(html,/重建|迁移|保留原日期|保留.*链接|今天的简历|yourname|your-email|example\.com/);
  }
});
test('search index, RSS, original Atom feed and sitemap are generated',()=>{
  assert.ok(existsSync(join(root,'pagefind/pagefind.js')));
  assert.match(read('rss.xml'),/<rss version="2.0">/);
  assert.match(read('atom.xml'),/<feed/);
  const sitemap=read('sitemap.xml');
  for(const slug of legacySlugs)assert.ok(sitemap.includes(`/post/${slug}/`));
  assert.ok(sitemap.includes('/research/react-agent-loop/'));
  assert.ok(sitemap.includes('/research/topics/'));
});
test('old section routes still resolve',()=>{
  for(const path of ['tags/index.html','friends/index.html','search/index.html','404.html'])assert.ok(existsSync(join(root,path)),path);
});
test('research articles appear in their collection, search, feed and sitemap',()=>{
  const research=read('research/index.html');
  assert.match(research,/Research &amp; Engineering/);
  assert.doesNotMatch(research,/research-block|研究兴趣/);
  for(const slug of ['react-agent-loop','rethinking-transformers-for-pomdps','pid-lagrangian-rl']){
    const href=`/research/${slug}/`;
    for(const file of ['index.html','research/index.html','search/index.html','sitemap.xml','rss.xml'])assert.ok(read(file).includes(href),`${file}: ${href}`);
    assert.ok(!read('writing/index.html').includes(href));
    assert.match(read(`writing/${slug}/index.html`),/http-equiv="refresh"/i);
    assert.ok(read(`writing/${slug}/index.html`).includes(href));
  }
  assert.ok(research.indexOf('/research/rethinking-transformers-for-pomdps/')<research.indexOf('/research/pid-lagrangian-rl/'));
  assert.ok(!existsSync(join(root,'research/_draft-example/index.html')));
  for(const file of ['index.html','research/index.html','search/index.html','rss.xml','sitemap.xml'])assert.ok(!read(file).includes('研究文章草稿示例'));
});
test('homepage leads with articles and navigation includes Essays before About',()=>{
  const html=read('index.html');
  assert.doesNotMatch(html,/personal-hero|hero-copy|研究兴趣/);
  const nav=html.match(/<nav[^>]*class="main-nav"[\s\S]*?<\/nav>/)[0];
  assert.ok(nav.indexOf('Projects')<nav.indexOf('Essays'));
  assert.ok(nav.indexOf('Essays')<nav.indexOf('About'));
  assert.ok(nav.includes('href="/essays/"'));
});
test('project pages list the confirmed WebCanvas contribution without exposing curation notes',()=>{
  const data=readFileSync('src/data/projects.ts','utf8');
  const projects=readFileSync('src/pages/projects.astro','utf8');
  const home=readFileSync('src/pages/index.astro','utf8');
  assert.doesNotMatch(projects,/Personal Website|personal-site/);
  for(const value of ['WebCanvas','https://github.com/zhangthird/WebCanvas','https://github.com/iMeanAI/WebCanvas'])assert.ok(data.includes(value),value);
  for(const value of ['cc-mini','RL-LLM-Prior'])assert.doesNotMatch(data,new RegExp(value,'i'));
  assert.doesNotMatch(projects,/projects\.(?:attribution|empty)/);
  assert.match(home,/featuredProjects\.length > 0/);
});
test('research topics have stable pages and tags link to their matching notes',()=>{
  const tagHelper=readFileSync('src/lib/tags.ts','utf8');
  const directory=readFileSync('src/pages/research/topics/index.astro','utf8');
  const detail=readFileSync('src/pages/research/topics/[tag].astro','utf8');
  const list=readFileSync('src/components/PostList.astro','utf8');
  assert.match(tagHelper,/export function tagHref/);
  assert.match(tagHelper,/\/research\/topics\//);
  assert.match(directory,/collectTags\(posts\)/);
  assert.match(detail,/getStaticPaths/);
  assert.match(list,/href=\{tagHref\(tag\)\}/);
  const researchPage=readFileSync('src/pages/research.astro','utf8');
  assert.match(researchPage,/href="\/research\/topics\/"/);
  assert.doesNotMatch(researchPage,/href="\/tags\/"/);
  assert.match(readFileSync('src/content/research/react-agent-loop.md','utf8'),/tags: \["Agent"/);
  assert.match(readFileSync('src/content/research/pid-lagrangian-rl.md','utf8'),/"RL"/);
});
test('research notes include adjacent navigation and working technical demo building blocks',()=>{
  const article=readFileSync('src/pages/research/[...id].astro','utf8');
  assert.match(article,/newerPost/);
  assert.match(article,/olderPost/);
  assert.match(article,/article\.newer/);
  assert.match(article,/article\.older/);
  assert.match(article,/ArchitectureDiagram/);
  assert.match(article,/InteractiveDemo/);
  for(const file of ['src/components/VideoDemo.astro','src/components/ArchitectureDiagram.astro','src/components/InteractiveDemo.astro'])assert.ok(existsSync(file),file);
  assert.match(readFileSync('src/components/VideoDemo.astro','utf8'),/data-autoplay-demo/);
  assert.match(readFileSync('src/components/InteractiveDemo.astro','utf8'),/prefers-reduced-motion/);
});
test('SEO ships Person and Breadcrumb schema with complete social image metadata',()=>{
  const layout=readFileSync('src/layouts/BaseLayout.astro','utf8');
  assert.match(layout,/'@type': 'Person'/);
  assert.match(layout,/'@type': 'BreadcrumbList'/);
  for(const name of ['og:site_name','og:image:width','og:image:height','og:image:alt','twitter:image:alt'])assert.ok(layout.includes(name),name);
  assert.match(readFileSync('public/og.svg','utf8'),/Research · Code · Notes/);
});
test('Essays is canonical and Archives aggregates every published article',()=>{
  const essays=read('essays/index.html');
  assert.match(essays,/<link rel="canonical" href="https:\/\/zhangthird.github.io\/essays\/"/);
  assert.match(essays,/aria-current="page"[^>]*>\s*Essays/);
  const archive=read('archives/index.html');
  assert.doesNotMatch(archive,/http-equiv="refresh"/i);
  assert.match(archive,/All articles/);
  assert.match(archive,/<link rel="canonical" href="https:\/\/zhangthird.github.io\/archives\/"/);
  for(const slug of legacySlugs)assert.ok(archive.includes(`/post/${slug}/`));
  for(const href of ['/research/react-agent-loop/','/research/pid-lagrangian-rl/','/research/rethinking-transformers-for-pomdps/'])assert.ok(archive.includes(href));
  assert.ok(!archive.includes('研究文章草稿示例'));
  assert.ok(archive.indexOf('id="year-2026"')<archive.indexOf('id="year-2022"'));
  const articleCount=legacySlugs.filter(slug=>slug!=='about').length+3;
  const archivedPageCount=legacySlugs.filter(slug=>slug==='about').length;
  assert.ok(archive.includes(`${articleCount} articles · ${archivedPageCount} archived page`));
  assert.ok(read('sitemap.xml').includes('/essays/'));
  assert.ok(read('sitemap.xml').includes('/archives/'));
  assert.match(read('index.html'),/href="\/archives\/">[\s\S]*?Archives/);
});
test('template article and redundant essay archive links are removed',()=>{
  assert.ok(!existsSync('post/hello-gridea/index.html'));
  for(const path of ['post/hello-gridea/index.html','tag/J_Kiuxtcw/index.html','post-images/hello-gridea.png'])assert.ok(!existsSync(join(root,path)),path);
  for(const file of walk(root).filter(p=>/\.(html|xml)$/.test(p)))assert.doesNotMatch(readFileSync(file,'utf8'),/Hello Gridea|hello-gridea|J_Kiuxtcw/);
  for(const file of ['about/index.html','research/index.html'])assert.doesNotMatch(read(file),/随笔归档/);
});
test('personal contact links are centralized on About without repeated profile cards',()=>{
  const about=read('about/index.html');
  assert.equal((about.match(/href="https:\/\/github.com\/zhangthird"/g)||[]).length,1);
  assert.equal((about.match(/href="mailto:[^"]+"/g)||[]).length,1);
  assert.doesNotMatch(about,/about-card|>Name<|>Focus<|技术笔记 →|这个网站主要放/);
  const home=read('index.html');
  assert.doesNotMatch(home,/contact-note|联系我|href="https:\/\/github.com\/zhangthird"|href="mailto:/);
  assert.match(home,/href="\/about\/"/);
  for(const file of pages){
    const footer=readFileSync(file,'utf8').match(/<footer\b[\s\S]*?<\/footer>/)?.[0];
    if(!footer)continue;
    assert.doesNotMatch(footer,/github.com|mailto:/);
    assert.match(footer,/href="\/archives\/"/);
    assert.match(footer,/href="\/rss.xml"/);
  }
  assert.doesNotMatch(read('projects/index.html'),/https:\/\/github\.com\/zhangthird\/zhangthird\.github\.io/);
});
test('Writing merges into research with canonical routes and no duplicate listings',()=>{
  assert.match(read('writing/index.html'),/http-equiv="refresh"/i);
  assert.match(read('writing/index.html'),/https:\/\/zhangthird.github.io\/research\//);
  for(const file of ['index.html','research/index.html','archives/index.html','search/index.html','sitemap.xml','rss.xml']){
    const html=read(file);
    assert.doesNotMatch(html,/\/writing\//);
    if(file.endsWith('.html'))assert.equal((html.match(/href="\/research\/react-agent-loop\/"/g)||[]).length,1);
  }
  const nav=read('index.html').match(/<nav[^>]*class="main-nav"[\s\S]*?<\/nav>/)[0];
  assert.equal((nav.match(/<a /g)||[]).length,5);
  assert.doesNotMatch(nav,/Writing/);
  const article=read('research/react-agent-loop/index.html');
  assert.match(article,/<link rel="canonical" href="https:\/\/zhangthird.github.io\/research\/react-agent-loop\/"/);
  assert.match(article,/← <span[^>]+data-site-i18n="nav.research"[^>]*>Research &amp; Engineering/);
  assert.ok(existsSync('src/content/research/react-agent-loop.md'));
  assert.ok(!existsSync('src/content/writing/react-agent-loop.md'));
});

test('formula copying preserves exact LaTeX and Markdown delimiters',()=>{
  const tex=String.raw`\begin{aligned}a &< b \\ c &= \frac{1}{2}\end{aligned}`;
  assert.equal(formatMathCopy(tex,true),tex);
  assert.equal(formatMathCopy(tex,false,true),'$'+tex+'$');
  assert.equal(formatMathCopy(tex,true,true),'$$\n'+tex+'\n$$');
});

test('clipboard errors never claim success',async()=>{
  let value;
  assert.equal(await copyText('x < y', {writeText:async text=>{value=text;}}),true);
  assert.equal(value,'x < y');
  assert.equal(await copyText('x', {writeText:async()=>{throw Error('denied');}}),false);
  assert.equal(await copyText('x',undefined),false);
});

test('articles retain math sources and load inline copy enhancement without a popup',()=>{
  for(const slug of ['react-agent-loop','pid-lagrangian-rl','rethinking-transformers-for-pomdps']){
    const html=read('research/'+slug+'/index.html');
    assert.equal([...html.matchAll(/class="katex"/g)].length,[...html.matchAll(/<annotation encoding="application\/x-tex">/g)].length);
    assert.match(html,/<content-copy>/);
    assert.match(html,/data-copy-status/);
    assert.doesNotMatch(html,/math-copy-panel|data-math-panel|data-math-source/);
  }
  const css=readFileSync('src/styles/global.css','utf8');
  assert.match(css,/\.copy-region:hover > \.copy-control/);
  assert.match(css,/\.copy-region:focus-within > \.copy-control/);
  assert.match(css,/@media \(hover: none\), \(pointer: coarse\)/);
});

// Small DOM/event fixture: verifies transformations without a browser or new dependencies.
function copyFixture(){
  let doc;
  class Element extends EventTarget {
    constructor(tag){super();this.tagName=tag;this.attrs={};this.children=[];this.className='';this.isConnected=true;this._text='';this.ownerDocument=doc;}
    get classList(){return {add:name=>{this.className+=' '+name;},remove:name=>{this.className=this.className.split(' ').filter(v=>v!==name).join(' ');}};}
    get textContent(){return this._text+this.children.map(child=>child.textContent).join('');}
    set textContent(value){this._text=value;this.children=[];}
    setAttribute(key,value){this.attrs[key]=value;}
    getAttribute(key){return this.attrs[key]??null;}
    append(...elements){for(const el of elements){el.remove();this.children.push(el);el.parentElement=this;}}
    remove(){if(this.parentElement){this.parentElement.children=this.parentElement.children.filter(el=>el!==this);this.parentElement=null;}}
    replaceWith(el){const parent=this.parentElement;if(!parent)return;const index=parent.children.indexOf(this);el.remove();parent.children.splice(index,1,el);el.parentElement=parent;this.parentElement=null;}
    closest(selector){for(let el=this;el;el=el.parentElement)if(el.className.split(' ').includes(selector.slice(1)))return el;return null;}
    querySelector(selector){const all=this.children.flatMap(child=>[child,...child.descendants()]);return all.find(el=>selector==='annotation[encoding="application/x-tex"]'?el.tagName==='annotation':selector==='[data-copy-status]'?Object.hasOwn(el.attrs,'data-copy-status'):el.tagName===selector)??null;}
    descendants(){return this.children.flatMap(child=>[child,...child.descendants()]);}
    focus(){doc.activeElement=this;}
    select(){this.selected=true;}
  }
  doc={documentElement:{lang:'en'}};
  const pending=new Map();let serial=0;
  const win={navigator:{clipboard:{writeText:async value=>{win.writes.push(value);}}},writes:[],setTimeout:callback=>{pending.set(++serial,callback);return serial;},clearTimeout:id=>pending.delete(id)};
  doc.defaultView=win;doc.createElement=tag=>new Element(tag);
  const body=new Element('body'),host=new Element('content-copy'),status=new Element('p');
  status.setAttribute('data-copy-status','');host.append(status);
  const block=new Element('span');block.className='katex-display';
  const formula=new Element('span');formula.className='katex';
  const annotation=new Element('annotation');annotation.textContent='a &< \\frac{b}{c}';formula.append(annotation);block.append(formula);
  const inline=new Element('span');inline.className='katex';
  const inlineSource=new Element('annotation');inlineSource.textContent='x_i';inline.append(inlineSource);
  const pre=new Element('pre'),code=new Element('code');
  const line1=new Element('span'),line2=new Element('span');
  line1.textContent='  const x = "<&>";\n';line2.textContent='\treturn x;\n';
  code.append(line1,line2);pre.append(code);body.append(block,inline,pre,host);
  doc.querySelectorAll=selector=>selector==='.prose .katex'?[formula,inline]:selector==='.prose pre'?[pre]:[];
  const cleanup=setupContentCopy(host);
  return {doc,win,host,status,body,block,formula,inline,annotation,pre,code,pending,cleanup};
}
function emit(target,type,props={}){
  const event=new Event(type,{cancelable:true});
  for(const [key,value] of Object.entries(props))Object.defineProperty(event,key,{value});
  target.dispatchEvent(event);return event;
}
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));

test('math and code get attached buttons, copy exact source and keep markup intact',async()=>{
  const f=copyFixture();
  try{
    const codeButton=f.pre.parentElement.querySelector('button');
    const mathButton=f.block.parentElement.querySelector('button');
    const inlineButton=f.inline.parentElement.querySelector('button');
    assert.equal(f.win.writes.length,0);
    assert.equal(codeButton.type,'button');
    assert.equal(mathButton.getAttribute('aria-label'),'Copy LaTeX');
    assert.equal(codeButton.textContent,'Copy');
    emit(codeButton,'click');await tick();
    assert.equal(f.win.writes[0],'  const x = "<&>";\n\treturn x;\n');
    assert.equal(f.code.children.length,2,'syntax highlighting remains intact');
    assert.equal(codeButton.textContent,'Copied ✓');
    emit(mathButton,'click',{shiftKey:false});await tick();
    assert.equal(f.win.writes[1],'a &< \\frac{b}{c}');
    assert.equal(mathButton.textContent,'✓');
    emit(mathButton,'click',{shiftKey:true});await tick();
    assert.equal(f.win.writes[2],'$$\na &< \\frac{b}{c}\n$$');
    emit(inlineButton,'click',{shiftKey:true});await tick();
    assert.equal(f.win.writes[3],'$x_i$');
    for(const [id,callback] of [...f.pending]){f.pending.delete(id);callback();}
    assert.equal(mathButton.textContent,'⧉');
    assert.equal(codeButton.textContent,'Copy');
    assert.equal(f.annotation.textContent,'a &< \\frac{b}{c}');
  }finally{f.cleanup();}
  assert.equal(f.pre.parentElement,f.body);
  assert.equal(f.block.parentElement,f.body);
  assert.equal(f.inline.parentElement,f.body);
  assert.equal(f.pending.size,0);
});

test('copy permission failure offers selected source inline, then recovers',async()=>{
  const f=copyFixture();
  try{
    const region=f.pre.parentElement,button=region.querySelector('button');
    f.win.navigator.clipboard.writeText=async()=>{throw Error('denied');};
    f.doc.documentElement.lang='zh-CN';
    emit(button,'click');await tick();
    const source=region.querySelector('textarea');
    assert.equal(source.value,f.code.textContent);
    assert.equal(source.selected,true);
    assert.equal(source.readOnly,true);
    assert.equal(f.status.textContent,translate('math.failed','zh'));
    assert.equal(button.textContent,'复制');
    f.win.navigator.clipboard.writeText=async value=>f.win.writes.push(value);
    emit(button,'click');await tick();
    assert.equal(region.querySelector('textarea'),null);
    assert.equal(button.textContent,'已复制 ✓');
  }finally{f.cleanup();}
});

test('copy enhancement is idempotent and navigation cleanup cancels stale feedback',async()=>{
  const f=copyFixture();
  const region=f.pre.parentElement,button=region.querySelector('button');
  const secondCleanup=setupContentCopy(f.host);
  assert.equal(f.pre.parentElement,region);
  let resolve;
  f.win.navigator.clipboard.writeText=()=>new Promise(done=>{resolve=done;});
  emit(button,'click');
  f.cleanup();resolve();await tick();
  assert.equal(f.pre.parentElement,f.body);
  assert.equal(f.status.textContent,'');
  assert.equal(f.pending.size,0);
  secondCleanup();
  const thirdCleanup=setupContentCopy(f.host);
  assert.equal(f.pre.parentElement.querySelector('button').textContent,'Copy');
  thirdCleanup();
});

test('every UI translation has both languages and all page keys exist',()=>{
  for(const [key,pair] of Object.entries(messages)){
    assert.equal(pair.length,2,key);
    assert.ok(pair.every(value=>typeof value==='string'&&value.length>0),key);
    assert.deepEqual([...pair[0].matchAll(/\{\w+\}/g)].map(m=>m[0]).sort(),[...pair[1].matchAll(/\{\w+\}/g)].map(m=>m[0]).sort(),key);
    if(key!=='language.toggle')assert.doesNotMatch(pair[0],/[一-龥]/,key);
  }
  for(const file of pages){
    const html=readFileSync(file,'utf8');
    if(/http-equiv="refresh"/i.test(html))continue;
    assert.match(html,/data-language-toggle/);
    for(const key of html.matchAll(/data-site-i18n(?:-(?:aria-label|placeholder|title|content))?="([^"]+)"/g))assert.ok(messages[key[1]],`${file}: ${key[1]}`);
  }
  for(const file of ['index.html','research/index.html','about/index.html','projects/index.html','404.html']){
    const text=read(file).replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'').replace(/<button\b[^>]*data-language-toggle[^>]*>[\s\S]*?<\/button>/g,'').replace(/<[^>]*>/g,'');
    assert.doesNotMatch(text,/[一-龥]/,file+' defaults to English UI');
  }
});

function localeFixture(){
  const doc={documentElement:{lang:'en'},elements:[]};
  const add=(attrs={},textContent='')=>{
    const element={attrs,textContent,ownerDocument:doc,getAttribute(key){return this.attrs[key]??null;},setAttribute(key,value){this.attrs[key]=value;}};
    doc.elements.push(element);return element;
  };
  doc.querySelectorAll=selector=>{
    const attribute=selector.match(/\[([^\]]+)\]/)?.[1];
    return doc.elements.filter(element=>Object.hasOwn(element.attrs,attribute));
  };
  const title=add({'data-site-i18n':'meta.about.title'});
  const count=add({'data-site-i18n':'article.count','data-site-i18n-params':'{"count":3}'});
  const input=add({'data-site-i18n-placeholder':'search.placeholder','data-site-i18n-aria-label':'search.label'});
  const meta=add({'data-site-i18n-content':'meta.about.description'});
  const date=add({'data-site-i18n-date':'',datetime:'2026-08-21T00:00:00.000Z'});
  const article=add({},'原始文章 body must not change');
  const status=add();
  return {doc,title,count,input,meta,date,article,status};
}

test('language switching updates text, attributes, metadata, dates and dynamic status',()=>{
  const f=localeFixture();
  applyLanguage(f.doc,'en');
  assert.equal(f.title.textContent,'About — Cheng Cui');
  assert.equal(f.count.textContent,'3 articles');
  const originalDate=f.date.textContent;
  setMessage(f.status,'search.resultsLimited',{count:20});
  applyLanguage(f.doc,'zh');
  assert.equal(f.doc.documentElement.lang,'zh-CN');
  assert.equal(f.title.textContent,'关于 — Cheng Cui');
  assert.equal(f.count.textContent,'3 篇文章');
  assert.equal(f.input.attrs.placeholder,'搜索标题、正文或关键词');
  assert.equal(f.meta.attrs.content,'Cheng Cui 的研究兴趣与联系方式。');
  assert.notEqual(f.date.textContent,originalDate);
  assert.equal(f.status.textContent,'找到 20 条结果，显示前 8 条');
  setMessage(f.status,'math.copiedTex');
  assert.equal(f.status.textContent,'已复制 LaTeX');
  applyLanguage(f.doc,'en');
  assert.equal(f.status.textContent,'LaTeX copied');
  assert.equal(f.article.textContent,'原始文章 body must not change');
  setMessage(f.status,'');applyLanguage(f.doc,'zh');
  assert.equal(f.status.textContent,'');
});

test('language preference survives a new document and blocked storage stays usable',()=>{
  const stored=new Map();
  const storage={getItem:key=>stored.get(key),setItem:(key,value)=>stored.set(key,value)};
  assert.equal(preferredLanguage(storage),'en');
  const first=localeFixture();
  changeLanguage(first.doc,'zh',storage);
  assert.equal(stored.get('site-language'),'zh');
  const next=localeFixture();
  applyLanguage(next.doc,preferredLanguage(storage));
  assert.equal(next.title.textContent,'关于 — Cheng Cui');
  const blocked={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
  assert.equal(preferredLanguage(blocked),'en');
  assert.equal(changeLanguage(next.doc,'en',blocked),'en');
  assert.equal(next.title.textContent,'About — Cheng Cui');
  assert.equal(normalizeLanguage('fr'),'en');
  assert.equal(translate('article.count','en',{count:1}),'1 article');
});

test('language refresh does not replace unchanged text nodes',()=>{
  const f=localeFixture();
  applyLanguage(f.doc,'en');
  let writes=0;
  for(const element of f.doc.elements){
    let value=element.textContent;
    Object.defineProperty(element,'textContent',{get:()=>value,set:next=>{writes++;value=next;}});
  }
  applyLanguage(f.doc,'en');
  applyLanguage(f.doc,'en');
  assert.equal(writes,0,'opening and re-entering the same language preserves existing DOM text');
  applyLanguage(f.doc,'zh');
  assert.ok(writes>0);
  const previous=writes;
  applyLanguage(f.doc,'zh');
  assert.equal(writes,previous);
});

test('a broken translation entry cannot erase server text or interrupt other labels',()=>{
  const f=localeFixture();
  f.title.attrs['data-site-i18n']='unknown.key';
  f.title.textContent='About — Cheng Cui';
  f.count.attrs['data-site-i18n-params']='{bad json';
  f.input.attrs['data-site-i18n-placeholder']='unknown.placeholder';
  f.input.attrs.placeholder='Search';
  f.date.attrs.datetime='invalid';
  f.date.textContent='Aug 21, 2026';
  assert.doesNotThrow(()=>applyLanguage(f.doc,'zh'));
  assert.equal(f.title.textContent,'About — Cheng Cui');
  assert.equal(f.input.attrs.placeholder,'Search');
  assert.equal(f.date.textContent,'Aug 21, 2026');
  assert.equal(f.meta.attrs.content,'Cheng Cui 的研究兴趣与联系方式。');
});

test('third-party generic translation markers cannot select website UI labels',()=>{
  const f=localeFixture();
  const foreign={attrs:{'data-i18n':'nav.research'},textContent:'Unrelated widget'};
  f.doc.elements.push(foreign);
  assert.deepEqual(f.doc.querySelectorAll('[data-i18n]'),[foreign]);
  applyLanguage(f.doc,'zh');
  assert.equal(foreign.textContent,'Unrelated widget');
  assert.equal(f.title.textContent,'关于 — Cheng Cui');
});

test('navigation, language button and section titles have nonempty server-rendered fallback text',()=>{
  for(const file of pages){
    const html=readFileSync(file,'utf8');
    if(/http-equiv="refresh"/i.test(html))continue;
    assert.doesNotMatch(html,/\bdata-i18n(?:[=\s-])/);
    const nav=html.match(/<nav[^>]*class="main-nav"[\s\S]*?<\/nav>/)[0];
    for(const label of ['Research &amp; Engineering','Projects','Essays','Photos','About'])assert.ok(nav.includes(label),file+': '+label);
    for(const label of nav.matchAll(/<a\b([^>]+)>/g))assert.match(label[1],/translate="no"/);
    assert.match(html,/<span translate="no" data-site-i18n="language.toggle"[^>]*>中<\/span>/);
  }
});

test('Photos is a separate bilingual route between Essays and About',()=>{
  const html=read('photos/index.html');
  const nav=html.match(/<nav[^>]*class="main-nav"[\s\S]*?<\/nav>/)[0];
  assert.ok(nav.indexOf('Essays')<nav.indexOf('Photos'));
  assert.ok(nav.indexOf('Photos')<nav.indexOf('About'));
  assert.match(nav,/href="\/photos\/"[^>]*aria-current="page"/);
  assert.match(html,/<link rel="canonical" href="https:\/\/zhangthird.github.io\/photos\/"/);
  const photos=preparePhotos(JSON.parse(readFileSync('src/data/photos.json','utf8')));
  if(!photos.length){
    assert.match(html,/No photos yet\./);
    assert.doesNotMatch(html,/<img\b/);
  }else{
    assert.doesNotMatch(html,/No photos yet\./);
    assert.equal([...html.matchAll(/<img\b/g)].length,photos.length);
    for(const photo of photos)assert.ok(html.includes(`src="${photo.src}"`));
  }
  assert.ok(read('sitemap.xml').includes('/photos/'));
  assert.equal(translate('nav.photos','zh'),'照片');
});

test('public documentation remains separate from local maintenance material',()=>{
  assert.ok(existsSync('README.md'));
  const publicDocs=readdirSync('docs',{withFileTypes:true})
    .filter(entry=>entry.isFile())
    .map(entry=>entry.name)
    .sort();
  assert.deepEqual(publicDocs,['design-principles.md','index.md','site-guide.md']);
  assert.ok(readFileSync('docs/index.md','utf8').includes('面向访客'));
  assert.ok(readFileSync('docs/site-guide.md','utf8').includes('浏览本站'));
  assert.ok(readFileSync('docs/design-principles.md','utf8').includes('设计理念'));
  assert.equal(existsSync(join(root,'docs')),false);
  const ignored=readFileSync('.gitignore','utf8');
  assert.match(ignored,/^\/docs\/local\/$/m);
  assert.doesNotMatch(ignored,/^\/docs\/$/m);
  assert.doesNotMatch(ignored,/^\/README\.md$/m);
});

test('photo records validate paths, descriptions, dimensions and dates',()=>{
  const make=(id,date)=>({id,src:'/photos/'+id+'.jpg',alt:'A test photograph',width:1200,height:800,...(date?{date}:{})});
  const entries=[make('undated'),make('older','2025-01-02'),make('newer','2026-08-30')];
  assert.deepEqual(preparePhotos(entries).map(p=>p.id),['newer','older','undated']);
  assert.equal(entries[0].id,'undated','source order is not mutated');
  assert.deepEqual(preparePhotos([]),[]);
  assert.throws(()=>preparePhotos([make('same'),make('same')]),/unique/);
  for(const src of ['/photos/../private.jpg','https://example.com/photo.jpg','/photos/file.svg'])assert.throws(()=>preparePhotos([{...make('test'),src}]),/under \/photos/);
  assert.throws(()=>preparePhotos([{...make('test'),alt:''}]),/alt/);
  assert.throws(()=>preparePhotos([{...make('test'),width:0}]),/dimensions/);
  assert.throws(()=>preparePhotos([make('test','2026-02-30')]),/valid/);
  assert.throws(()=>preparePhotos([{...make('test'),caption:123}]),/caption/);
  const component=readFileSync('src/components/PhotoGallery.astro','utf8');
  assert.match(component,/alt=\{photo.alt\}/);
  assert.match(component,/width=\{photo.width\} height=\{photo.height\}/);
  assert.match(component,/loading="lazy"/);
  assert.match(component,/href=\{photo.src\}/);
});

test('JPEG import removes metadata while preserving color profile and compressed image',()=>{
  const segment=(marker,text)=>{const body=Buffer.from(text);const header=Buffer.alloc(4);header[0]=255;header[1]=marker;header.writeUInt16BE(body.length+2,2);return Buffer.concat([header,body]);};
  const start=Buffer.from([255,216]);
  const icc=segment(0xe2,'ICC_PROFILE');
  const scan=Buffer.from([255,218,0,2,12,34,56,255,217]);
  const original=Buffer.concat([start,segment(0xe1,'Exif metadata'),icc,segment(0xed,'IPTC metadata'),segment(0xfe,'Comment'),scan]);
  assert.deepEqual(stripJpegMetadata(original),Buffer.concat([start,icc,scan]));
  assert.throws(()=>stripJpegMetadata(Buffer.from('not a jpeg')),/JPEG/);
  assert.throws(()=>stripJpegMetadata(Buffer.from([255,216,255,225,0,10])),/length/);
});

const privatePhoto=async(format,orientation=1)=>sharp({create:{width:8,height:4,channels:3,background:'#abcdef'}})
  .withMetadata({orientation})
  .withExifMerge({IFD0:{Artist:'PRIVATE CAMERA OWNER'},IFD3:{GPSLatitudeRef:'N',GPSLatitude:'39/1 54/1 0/1',GPSLongitudeRef:'E',GPSLongitude:'116/1 24/1 0/1'}})
  .withXmp('<x:xmpmeta xmlns:x="adobe:ns:meta/"><private>PRIVATE LOCATION</private></x:xmpmeta>')
  .toFormat(format).toBuffer();

test('all supported photo formats lose private metadata, preserve orientation and are idempotent',async()=>{
  for(const format of ['jpeg','png','webp','avif']){
    const original=await privatePhoto(format,6);
    const before=await sharp(original).metadata();
    assert.ok(before.exif,format+' fixture has EXIF');
    assert.ok(before.xmp,format+' fixture has XMP');
    const result=await sanitizePhoto(original,'.'+format);
    const metadata=await sharp(result.data).metadata();
    assert.equal(hasPrivateMetadata(metadata),false,format);
    assert.equal(result.width,4,format+' rotated width');
    assert.equal(result.height,8,format+' rotated height');
    assert.ok(metadata.icc,format+' color profile');
    assert.equal(result.changed,true,format);
    assert.equal(result.data.includes(Buffer.from('PRIVATE')),false,format);
    const again=await sanitizePhoto(result.data,'.'+format);
    assert.equal(again.changed,false,format+' no repeated reencoding');
  }
});

test('ordinary JPEG cleanup preserves decoded pixels and rejects mismatched filenames',async()=>{
  const original=await privatePhoto('jpeg');
  const result=await sanitizePhoto(original,'.jpg');
  assert.deepEqual(await sharp(original).raw().toBuffer(),await sharp(result.data).raw().toBuffer());
  await assert.rejects(sanitizePhoto(original,'.png'),/does not match/);
  await assert.rejects(sanitizePhoto(original,'.svg'),/Unsupported/);
  await assert.rejects(sanitizePhoto(Buffer.from('broken image'),'.jpg'));
});

test('photo directory checks include unlisted nested files and fail before writing any file',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'photo-privacy-test-'));
  try{
    await mkdir(join(directory,'nested'));
    const original=await privatePhoto('jpeg');
    const file=join(directory,'nested','unlisted.jpg');
    await writeFile(file,original);
    await writeFile(join(directory,'.gitkeep'),'');
    const invalid=join(directory,'unsupported.txt');
    await writeFile(invalid,'not an image');
    await assert.rejects(sanitizeDirectory(directory),/Unsupported file/);
    assert.deepEqual(await readFile(file),original);
    await rm(invalid);
    const results=await sanitizeDirectory(directory);
    assert.equal(results.length,1);
    assert.equal(results[0].changed,true);
    assert.equal(hasPrivateMetadata(await sharp(await readFile(file)).metadata()),false);
    assert.equal((await sanitizeDirectory(directory))[0].changed,false);
  }finally{
    assert.equal(dirname(resolve(directory)),resolve(tmpdir()));
    assert.ok(basename(directory).startsWith('photo-privacy-test-'));
    await rm(directory,{recursive:true,force:true});
  }
});

test('npm build and dev clean photos first, and manual cleaning is available',()=>{
  const {scripts}=JSON.parse(readFileSync('package.json','utf8'));
  for(const name of ['prebuild','predev','photos:clean'])assert.equal(scripts[name],'node scripts/sanitize-photos.mjs');
});

test('navigation stays sticky at all breakpoints and does not fade with page transitions',()=>{
  const css=readFileSync('src/styles/global.css','utf8');
  const header=readFileSync('src/components/Header.astro','utf8');
  const headerRules=[...css.matchAll(/\.site-header\s*\{([^}]+)\}/g)].map(match=>match[1]);
  assert.ok(headerRules.some(rule=>/position:\s*sticky/.test(rule)));
  assert.ok(headerRules.every(rule=>!/position:\s*(relative|static|absolute)/.test(rule)));
  assert.match(header,/transition:name="site-header"/);
  assert.match(header,/transition:animate="none"/);
  assert.match(header,/data-mobile-nav-toggle/);
  assert.match(header,/class="mobile-nav-icon"/);
  assert.match(css,/\.mobile-nav-toggle\.is-open/);
  assert.match(css,/\.main-nav\.is-open/);
  assert.match(css,/@media \(max-width: 760px\)/);
  for(const file of ['index.html','research/index.html','research/react-agent-loop/index.html','photos/index.html']){
    const html=read(file);
    assert.equal([...html.matchAll(/class="main-nav"/g)].length,1);
    assert.match(html,/view-transition-name:\s*site-header/);
  }
});

test('obsolete theme files and unused runtime code stay out of the project and deployment',()=>{
  for(const file of ['index.html','404.html','about/index.html','archives/index.html','friends/index.html','search/index.html','tags/index.html','api-content/index.html','api-info/index.html','styles/main.css','media/gridea-search/gridea-search.js','media/gridea-search/result-template.ejs','media/scripts/index.js','media/images/geometry2.png','media/images/sidebar-bg.jpg','media/logo.png','scripts/sanitize-legacy.mjs']){
    assert.equal(existsSync(file),false,file);
  }
  for(const file of ['index.html','404.html','about/index.html','archives/index.html','friends/index.html','search/index.html','tags/index.html']){
    assert.ok(existsSync(join(root,file)),file+' is still generated');
  }
  for(const folder of ['media','styles','api-content','api-info'])assert.equal(existsSync(join(root,folder)),false,folder);
  assert.ok(existsSync('src/components/ProjectCard.astro'));
  const layout=readFileSync('src/layouts/BaseLayout.astro','utf8');
  assert.doesNotMatch(layout,/__sitePointerBound|--pointer-[xy]|pointermove/);
  // Documented video support and all actual copy modes remain available.
  assert.match(layout,/data-autoplay-demo/);
  assert.ok(messages['math.tex']);
  assert.ok(messages['math.copiedMarkdown']);
  for(const key of ['math.title','math.close','math.markdown','math.viewSource','math.source'])assert.equal(Object.hasOwn(messages,key),false,key);
});

