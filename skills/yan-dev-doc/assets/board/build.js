#!/usr/bin/env node
/* 看板构建脚本 — 各 skill 在更新 data/changes.js 后调用：node project-html/build.js
 *   1) 为每条记录生成轻量详情页 pages/<slug>.html（共享 css / board.js / mermaid，内容未变不重写）
 *   2) 由 data/changes.js 重新生成 docs/INDEX.md 文档总索引（每次运行覆盖刷新）
 *   3) 首次运行（docs/archive 不存在）扫描项目根，复制散落的旧 md / 旧看板 / 接口文档
 *      到 docs/archive/（只复制不删除原件，便于后续统一归档）
 *   4) 需要单文件外发时显式执行：node project-html/build.js --standalone <docPath|slug>
 * 纯 Node，无第三方依赖。与 skills/yan-dev-doc/assets/board/build.js 保持一致，修改时两处同步。 */
'use strict';
const fs = require('fs');
const path = require('path');

const BOARD_DIR = __dirname;                 // .../project-html
const ROOT = path.dirname(BOARD_DIR);        // 项目根
const DOCS = path.join(ROOT, 'docs');

function read(p) { return fs.readFileSync(p, 'utf8'); }
function exists(p) { try { fs.accessSync(p); return true; } catch (e) { return false; } }
function escHtml(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
// <script> 文本内联进 <script> 标签时，转义闭合序列，避免提前结束标签
function safeScript(s) { return s.replace(/<\/script/gi, '<\\/script'); }
function writeIfChanged(file, content) {
  if (exists(file) && read(file) === content) return false;
  fs.writeFileSync(file, content);
  return true;
}

// ── 解析 data/changes.js 中的 changes / htmlChangelog 数组 ──
function loadData() {
  const src = read(path.join(BOARD_DIR, 'data', 'changes.js'));
  const fn = new Function(src + '\n;return { changes: typeof changes !== "undefined" ? changes : [], htmlChangelog: typeof htmlChangelog !== "undefined" ? htmlChangelog : [] };');
  return fn();
}

function loadHumanDetail(catalog) {
  if (!catalog.detailId && !catalog.detailPath) return null; // legacy rich entry
  if (!catalog.detailId || !catalog.detailPath) throw new Error(`目录记录缺少详情定位字段：${catalog.docPath || catalog.title || 'unknown'}`);
  const detailsDir = path.resolve(BOARD_DIR, 'data', 'details');
  const detailFile = path.resolve(BOARD_DIR, catalog.detailPath);
  if (detailFile !== detailsDir && !detailFile.startsWith(detailsDir + path.sep)) {
    throw new Error(`详情路径越界：${catalog.detailPath}`);
  }
  if (!exists(detailFile)) throw new Error(`找不到看板详情：${catalog.detailPath}`);
  const holder = {};
  const fn = new Function('window', read(detailFile) + '\n;return window.BOARD_DETAILS || {};');
  const details = fn(holder);
  if (!details[catalog.detailId]) throw new Error(`详情文件未声明 ${catalog.detailId}：${catalog.detailPath}`);
  return details[catalog.detailId];
}

function hydratedEntry(catalog) {
  const detail = loadHumanDetail(catalog);
  if (!detail) return catalog;
  const merged = Object.assign({}, catalog, detail);
  delete merged.detailId;
  delete merged.detailPath;
  delete merged.searchText;
  return merged;
}

function svcOf(d) { return d.service || '通用'; }
function modOf(d) { return d.module || '通用'; }
// 与 board.js 的 slugOf 保持一致
function slugOf(d) {
  return [svcOf(d), modOf(d), d.title || 'untitled'].join('-')
    .replace(/[\/\\:*?"<>|\s]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}
// 去重后的 slug 映射：同名 slug 追加 -1（与 board.js 的 _slugMap 算法逐字一致）。
// buildPages 与 buildIndex 都用它，保证单页文件名与索引/链接指向一致。
function buildSlugMap(changes) {
  const used = new Set(), map = new Map();
  for (const d of changes) {
    let slug = slugOf(d);
    while (used.has(slug)) slug += '-1';
    used.add(slug); map.set(d, slug);
  }
  return map;
}
function kindOf(d) { return d.kind === 'bug' ? 'bug' : d.kind === 'reading' ? 'reading' : d.kind === 'biz' ? 'biz' : 'doc'; }
function icoOf(d) { return d.kind === 'bug' ? '🐛' : d.kind === 'reading' ? '📖' : d.kind === 'biz' ? '🔀' : '📄'; }

// ════════════════════════════════════════════════════════════════════════════
// 1) 轻量详情页 pages/<slug>.html（共享资源，保持原链接稳定）
// ════════════════════════════════════════════════════════════════════════════
function buildPages(data) {
  const pagesDir = path.join(BOARD_DIR, 'pages');
  fs.mkdirSync(pagesDir, { recursive: true });
  const oldPages = fs.readdirSync(pagesDir).filter(f => f.endsWith('.html'));
  // 哨兵：已有单页数远多于 data/changes.js 当前记录数，疑似 changes.js 被误覆盖（而非有意删条目），
  // 先中止而不是清空 pages/——清空后唯一的恢复线索（旧单页）就没了。BOARD_FORCE_BUILD=1 可强制跳过。
  if (oldPages.length > 0 && data.changes.length < oldPages.length * 0.7 && !process.env.BOARD_FORCE_BUILD) {
    console.error(`✗ build.js 中止：现有单页 ${oldPages.length} 个，但 data/changes.js 只有 ${data.changes.length} 条记录，疑似数据被误覆盖。`);
    console.error('  确认是有意删除条目的话，设置 BOARD_FORCE_BUILD=1 后重新运行可强制继续。');
    process.exit(1);
  }
  const slugMap = buildSlugMap(data.changes);
  const expected = new Set([...slugMap.values()].map(slug => slug + '.html'));
  let written = 0, removed = 0;
  // 只清理已无对应记录的孤儿页面；保留有效页面后再按内容增量更新。
  for (const f of oldPages) {
    if (!expected.has(f)) { fs.unlinkSync(path.join(pagesDir, f)); removed++; }
  }
  for (const catalog of data.changes) {
    const d = hydratedEntry(catalog);
    const slug = slugMap.get(catalog);
    const entryJs = 'const changes = [' + JSON.stringify(d) + '];\nconst htmlChangelog = [];';
    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escHtml(d.title || '')}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;700;900&family=Noto+Sans+SC:wght@400;500;700&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
<script src="../js/vendor/mermaid.min.js"></script>
<script>if (typeof mermaid === 'undefined') document.write('<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"><\\/script>');</script>
<link rel="stylesheet" href="../css/board.css">
<style>.sidebar{display:none!important}.main{margin:0}.doc-view{max-width:900px}</style>
</head>
<body>
<aside class="sidebar"><div class="sidebar-header"><div class="sidebar-sub" id="sub"></div><span class="fpill toggle" id="openPill"></span></div><div id="sb"></div><div class="sidebar-footer"><div id="home-btn"></div><div id="api-btn"></div><div id="log-btn"></div></div></aside>
<main class="main" id="main"></main>
<script>window.DETAIL_PAGE = true;</script>
<script>${entryJs}</script>
<script src="../js/board.js"></script>
<script>try { pick(0); } catch (e) { document.getElementById('main').textContent = '渲染失败: ' + e.message; }</script>
</body>
</html>`;
    if (writeIfChanged(path.join(pagesDir, slug + '.html'), html)) written++;
  }
  return { total: data.changes.length, written, removed };
}

// 显式按需导出真正自包含的单文件；不参与日常全量构建，避免重复内嵌 3MB+ Mermaid。
function exportStandalone(data, selector) {
  if (!selector) throw new Error('缺少导出选择器；用法：node project-html/build.js --standalone <docPath|slug>');
  const slugMap = buildSlugMap(data.changes);
  const matches = data.changes.filter(d => d.docPath === selector || slugMap.get(d) === selector);
  if (matches.length !== 1) throw new Error(matches.length ? `导出选择器不唯一：${selector}` : `找不到导出记录：${selector}`);
  const catalog = matches[0], d = hydratedEntry(catalog), slug = slugMap.get(catalog);
  const css = read(path.join(BOARD_DIR, 'css', 'board.css'));
  const boardJs = read(path.join(BOARD_DIR, 'js', 'board.js'));
  const vendor = path.join(BOARD_DIR, 'js', 'vendor', 'mermaid.min.js');
  const mermaidTag = exists(vendor)
    ? `<script>${safeScript(read(vendor))}</script>`
    : `<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>`;
  const entryJs = 'const changes = [' + JSON.stringify(d) + '];\nconst htmlChangelog = [];';
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escHtml(d.title || '')}</title>
${mermaidTag}
<style>${css}</style>
<style>.sidebar{display:none!important}.main{margin:0}.doc-view{max-width:900px}</style>
</head>
<body>
<aside class="sidebar"><div class="sidebar-header"><div class="sidebar-sub" id="sub"></div><span class="fpill toggle" id="openPill"></span></div><div id="sb"></div><div class="sidebar-footer"><div id="home-btn"></div><div id="api-btn"></div><div id="log-btn"></div></div></aside>
<main class="main" id="main"></main>
<script>window.STANDALONE = true;</script>
<script>${entryJs}</script>
<script>${safeScript(boardJs)}</script>
<script>try { pick(0); } catch (e) { document.getElementById('main').textContent = '渲染失败: ' + e.message; }</script>
</body>
</html>`;
  const outDir = path.join(BOARD_DIR, 'exports');
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, slug + '.html');
  writeIfChanged(out, html);
  return out;
}

// ════════════════════════════════════════════════════════════════════════════
// 2) docs/INDEX.md 文档总索引
// ════════════════════════════════════════════════════════════════════════════
function buildIndex(data, archiveSummary) {
  fs.mkdirSync(DOCS, { recursive: true });
  const today = new Date().toISOString().slice(0, 10);
  const kindLabel = { doc: '开发文档', bug: 'Bug', reading: '代码阅读', biz: '业务流' };
  const slugMap = buildSlugMap(data.changes);

  // service -> module -> [entry]
  const g = {};
  data.changes.forEach(d => {
    const s = svcOf(d), m = modOf(d);
    ((g[s] || (g[s] = {}))[m] || (g[s][m] = [])).push(d);
  });
  Object.values(g).forEach(mods => Object.values(mods).forEach(arr =>
    arr.sort((a, b) => (b.date || '').localeCompare(a.date || ''))));

  const cnt = { doc: 0, bug: 0, reading: 0, biz: 0 };
  data.changes.forEach(d => { cnt[kindOf(d)]++; });

  const L = [];
  L.push('# 📚 文档总索引', '');
  L.push(`> 本文件由 \`node project-html/build.js\` 自动生成，请勿手工编辑（每次运行覆盖刷新）。`);
  L.push(`> 共 ${data.changes.length} 篇 · 📄 开发文档 ${cnt.doc} · 🐛 Bug ${cnt.bug} · 📖 代码阅读 ${cnt.reading} · 🔀 业务流 ${cnt.biz} · 最后更新 ${today}`, '');
  L.push('> 完整可视化看板：[project-html/index.html](../project-html/index.html)（浏览器打开）', '');

  Object.keys(g).sort().forEach(svc => {
    L.push(`## 📦 ${svc}`, '');
    Object.keys(g[svc]).sort().forEach(mod => {
      L.push(`### 📁 ${mod}`, '');
      L.push('| | 标题 | 类型 | 状态 | 日期 | 源文档 | 单页 | OpenAPI |');
      L.push('|---|---|---|---|---|---|---|---|');
      g[svc][mod].forEach(d => {
        const ico = icoOf(d);
        const type = d.kind === 'bug' ? (d.severity || 'P2') : (d.type || kindLabel[kindOf(d)]);
        const docCell = d.docPath ? `[md](../${d.docPath})` : '-';
        const pageCell = `[页](../project-html/pages/${slugMap.get(d)}.html)`;
        const apiCell = d.apiSpecPath ? `[yaml](../${d.apiSpecPath})` : '-';
        L.push(`| ${ico} | ${mdEsc(d.title)} | ${mdEsc(type)} | ${mdEsc(d.status || '')} | ${d.date || ''} | ${docCell} | ${pageCell} | ${apiCell} |`);
      });
      L.push('');
    });
  });

  if (archiveSummary && archiveSummary.total) {
    L.push('## 🗄️ 历史归档', '');
    L.push(`> 首次运行时从项目根目录扫描并**复制**（原文件保留）到 \`docs/archive/\` 的历史资料，共 ${archiveSummary.total} 个，供后续统一整理。`, '');
    archiveSummary.items.forEach(rel => L.push(`- [${mdEsc(path.basename(rel))}](${rel})`));
    L.push('');
  }

  fs.writeFileSync(path.join(DOCS, 'INDEX.md'), L.join('\n'));
}
function mdEsc(s) { return String(s == null ? '' : s).replace(/\|/g, '\\|').replace(/\n/g, ' '); }

// ════════════════════════════════════════════════════════════════════════════
// 3) 首次运行：扫描项目根，复制散落历史资料到 docs/archive/
// ════════════════════════════════════════════════════════════════════════════
const SKIP_DIRS = new Set(['node_modules', '.git', '.svn', '.idea', '.vscode', 'target', 'dist', 'build', 'out', 'docs', 'project-html']);
const MD_DENY = new Set(['readme.md', 'claude.md', 'contributing.md', 'license.md', 'changelog.md', 'index.md']);
const DOC_DIR_HINT = /(^|[\/\\])(docs?|文档|design|设计|需求|requirement|spec)([\/\\]|$)/i;
const DATE_HINT = /\d{4}[-_.]\d{2}[-_.]\d{2}/;
const DOC_NAME_HINT = /(接口|设计|方案|需求|流程|api|spec|design)/i;
const API_NAME_HINT = /(openapi|swagger|apifox|接口|api[-_.]?doc)/i;

function walk(dir, depth, out) {
  if (depth > 6) return;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name) || e.name.startsWith('.')) continue;
      walk(full, depth + 1, out);
    } else if (e.isFile()) {
      out.push(full);
    }
  }
}

function classify(file) {
  const rel = path.relative(ROOT, file);
  const base = path.basename(file).toLowerCase();
  const ext = path.extname(file).toLowerCase();
  if (ext === '.md') {
    if (MD_DENY.has(base)) return null;
    if (DOC_DIR_HINT.test(rel) || DATE_HINT.test(rel) || DOC_NAME_HINT.test(base)) return 'docs';
    return null;
  }
  if (ext === '.html' || ext === '.htm') {
    let txt = '';
    try { txt = read(file); } catch (e) { return null; }
    if (/const\s+changes\b/.test(txt) || /BOARD_VERSION/.test(txt) || /变更记录/.test(txt)) return 'boards';
    return null;
  }
  if (ext === '.yaml' || ext === '.yml' || ext === '.json') {
    if (API_NAME_HINT.test(base)) return 'api';
    let txt = '';
    try { txt = read(file).slice(0, 4000); } catch (e) { return null; }
    if (/openapi|swagger/i.test(txt)) return 'api';
    return null;
  }
  return null;
}

function archiveLegacy() {
  const archiveDir = path.join(DOCS, 'archive');
  if (exists(archiveDir)) return null;   // 仅首次

  const all = [];
  walk(ROOT, 0, all);
  const picked = [];
  for (const f of all) {
    const cat = classify(f);
    if (cat) picked.push({ file: f, cat });
  }
  // 始终建目录以标记“已扫描”，避免后续每次重扫
  fs.mkdirSync(archiveDir, { recursive: true });

  const items = [];
  for (const { file, cat } of picked) {
    const destDir = path.join(archiveDir, cat);
    fs.mkdirSync(destDir, { recursive: true });
    let name = path.basename(file);
    let dest = path.join(destDir, name);
    let i = 1;
    while (exists(dest)) { name = path.basename(file, path.extname(file)) + '-' + i + path.extname(file); dest = path.join(destDir, name); i++; }
    try {
      fs.copyFileSync(file, dest);
      items.push('archive/' + cat + '/' + name);
    } catch (e) { /* 跳过无法复制的文件 */ }
  }
  if (!items.length) {
    try { fs.writeFileSync(path.join(archiveDir, '.gitkeep'), ''); } catch (e) {}
  }
  return { total: items.length, items };
}

// ════════════════════════════════════════════════════════════════════════════
function main() {
  let data;
  try { data = loadData(); } catch (e) {
    console.error('✗ 无法解析 project-html/data/changes.js：' + e.message);
    process.exit(1);
  }
  if (process.argv[2] === '--standalone') {
    try {
      const out = exportStandalone(data, process.argv[3]);
      console.log(`✓ 已导出自包含页面：${path.relative(ROOT, out).replace(/\\/g, '/')}`);
    } catch (e) {
      console.error('✗ ' + e.message);
      process.exit(1);
    }
    return;
  }
  const archiveSummary = archiveLegacy();
  const pages = buildPages(data);
  buildIndex(data, archiveSummary);
  let msg = `✓ build.js 完成：详情页 ${pages.total} 个（写入 ${pages.written}，清理孤儿 ${pages.removed}）+ docs/INDEX.md`;
  if (archiveSummary && archiveSummary.total) msg += `；首次归档 ${archiveSummary.total} 个历史文件到 docs/archive/`;
  console.log(msg);
}
main();
