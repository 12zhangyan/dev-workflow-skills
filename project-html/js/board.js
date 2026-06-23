/* AI 变更记录看板 — 渲染与交互逻辑
 * 数据在 data/changes.js（由 /dev-doc、/bug-fix、/code-reading、/biz-flow 自动追加，本文件不存数据）
 * 与 skills/dev-doc/assets/board/js/board.js 保持一致，修改时两处同步 */

// 外壳版本号：skill 检测到模板版本更高时自动覆盖外壳文件（index.html / css / js / build.js，不动 data/）。
// 改动外壳行为时 +1。
const BOARD_VERSION = 10;

if (typeof mermaid !== 'undefined') mermaid.initialize({ startOnLoad: false, theme: 'neutral', fontFamily: 'inherit' });

// ─── 状态（可点击切换，保存在浏览器 localStorage）─────────────────────────────
const DOC_CYCLE = ['草稿', '进行中', '已完成'];
const BUG_CYCLE = ['未修复', '修复中', '已修复', '已验证'];
const DONE = new Set(['已完成', '已验证']);
const SK = 'dwf-status';
const SC = { '草稿': '#b8ad99', '进行中': '#9a6b1f', '已完成': '#3e6b4f', '未修复': '#a02c2c', '修复中': '#9a6b1f', '已修复': '#3e6b4f', '已验证': '#2b5876' };
let overrides = {};
try { overrides = JSON.parse(localStorage.getItem(SK) || '{}'); } catch (e) {}
function svcOf(d) { return d.service || '通用'; }
function modOf(d) { return d.module || '通用'; }
function keyOf(d) { return `${svcOf(d)}::${modOf(d)}::${d.date}::${d.title}`; }
function effStatus(d) { return overrides[keyOf(d)] ?? d.status; }
function statusColor(s) { return SC[s] || '#c8c9cc'; }
// 类型/严重度 → CSS 类后缀：去掉空格，使「Bug 修复」「API 联调」能匹配 .t-Bug修复 / .t-API联调
function tcls(v) { return String(v == null ? '' : v).replace(/\s+/g, ''); }
// 单页文件名：与 build.js 的 slugOf 保持一致（生成 pages/<slug>.html）
function slugOf(d) {
  return [svcOf(d), modOf(d), d.title || 'untitled'].join('-')
    .replace(/[\/\\:*?"<>|\s]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}
// 去重后的单页文件名映射：与 build.js buildSlugMap 算法逐字一致（同名 slug 追加 -1）。
// pageLink 必须用它而非裸 slugOf，否则同名条目的「独立页面」链接会指向第一个条目的页面。
const _slugMap = (() => {
  const used = new Set(), map = new Map();
  (typeof changes !== 'undefined' ? changes : []).forEach(d => {
    let slug = slugOf(d);
    while (used.has(slug)) slug += '-1';
    used.add(slug); map.set(d, slug);
  });
  return map;
})();
function pageSlug(d) { return _slugMap.get(d) || slugOf(d); }
function cycleStatus(ev) {
  if (ev) ev.stopPropagation();
  if (typeof sel !== 'number' || sel < 0) return;
  const d = changes[sel];
  const cyc = d.kind === 'bug' ? BUG_CYCLE : DOC_CYCLE;
  let idx = cyc.indexOf(effStatus(d));
  overrides[keyOf(d)] = cyc[(idx + 1) % cyc.length];
  try { localStorage.setItem(SK, JSON.stringify(overrides)); } catch (e) {}
  pick(sel);
}

// ─── 过滤 ────────────────────────────────────────────────────────────────────
function kindOf(c) { return c.kind === 'bug' ? 'bug' : c.kind === 'reading' ? 'reading' : c.kind === 'biz' ? 'biz' : 'doc'; }
function icoOf(c) { return c.kind === 'bug' ? '🐛' : c.kind === 'reading' ? '📖' : c.kind === 'biz' ? '🔀' : '📄'; }
let q = '', kindF = 'all', openOnly = false;
// 搜索语料：覆盖各类条目的叙述字段，避免内容只在 solution/fixPlan/testPoints 时搜不到。
function searchHay(c) {
  const parts = [c.title, c.service, c.module, c.type,
    c.background, c.solution, c.coreDesign,            // doc
    c.symptom, c.trigger, c.impact, c.rootCause, c.fixPlan, c.codeLocation,  // bug
    c.entry];                                          // reading
  const push = arr => { if (Array.isArray(arr)) arr.forEach(x => parts.push(typeof x === 'string' ? x : (x && (x.title + ' ' + x.desc)))); };
  push(c.goals); push(c.scopeIn); push(c.scopeOut); push(c.testPoints);
  push(c.bizRules); push(c.keyImpl); push(c.todos);
  (c.apis || []).forEach(a => parts.push(a.url, a.desc));
  return parts.filter(Boolean).join(' ').toLowerCase();
}
function matchF(c) {
  if (kindF !== 'all' && kindOf(c) !== kindF) return false;
  if (openOnly && DONE.has(effStatus(c))) return false;
  if (q) {
    const hay = searchHay(c);
    if (!hay.includes(q)) return false;
  }
  return true;
}
function refreshView() { if (sel === null) showHome(); else if (sel === -2) showApis(); }
function onSearch(v) { q = v.trim().toLowerCase(); renderSidebar(); refreshView(); }
function setKind(k) { kindF = k; renderSidebar(); refreshView(); }
function toggleOpen() { openOnly = !openOnly; renderSidebar(); refreshView(); }

// ─── State ──────────────────────────────────────────────────────────────────
let sel = null; // null=浏览索引（首页）, -1=变更日志, -2=接口索引, 0+=文档下标
const expSvc = new Set(), expMod = new Set();
function mk(s, m) { return s + '::' + m; }

// ─── 分组：service → module → [idx]（组内按日期倒序）──────────────────────────
function grp() {
  const g = {};
  changes.forEach((c, i) => {
    if (!matchF(c)) return;
    const s = svcOf(c), m = modOf(c);
    ((g[s] ||= {})[m] ||= []).push(i);
  });
  Object.values(g).forEach(mods => Object.values(mods).forEach(ids =>
    ids.sort((a, b) => (changes[b].date || '').localeCompare(changes[a].date || ''))));
  return g;
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────
function renderSidebar() {
  const g = grp();
  const docCnt = changes.filter(c => kindOf(c) === 'doc').length;
  const bugCnt = changes.filter(c => kindOf(c) === 'bug').length;
  const readCnt = changes.filter(c => kindOf(c) === 'reading').length;
  const bizCnt = changes.filter(c => kindOf(c) === 'biz').length;
  const parts = [`${docCnt} 篇文档`];
  if (bugCnt) parts.push(`${bugCnt} 个 Bug`);
  if (readCnt) parts.push(`${readCnt} 篇阅读`);
  if (bizCnt) parts.push(`${bizCnt} 个业务流`);
  document.getElementById("sub").textContent = parts.join(' · ');
  document.querySelectorAll('.fpill[data-k]').forEach(el => el.classList.toggle('active', el.dataset.k === kindF));
  document.getElementById('openPill').classList.toggle('active', openOnly);

  const forceOpen = !!q || kindF !== 'all' || openOnly;
  const entries = Object.entries(g);
  if (!entries.length) {
    document.getElementById("sb").innerHTML = `<div class="sb-empty">没有匹配的记录</div>`;
  } else {
    document.getElementById("sb").innerHTML = entries.map(([svc, mods]) => {
      const svcOpen = forceOpen || expSvc.has(svc);
      const total = Object.values(mods).reduce((n, ids) => n + ids.length, 0);
      const modsHtml = Object.entries(mods).map(([mod, ids]) => {
        const modOpen = forceOpen || expMod.has(mk(svc, mod));
        return `<div>
          <div class="mod-hd" onclick="togMod('${esc(svc)}','${esc(mod)}')">
            <span class="chev ${modOpen ? 'open' : ''}">▶</span>
            <span class="mod-ico">📁</span>
            <span class="mod-nm">${esc(mod)}</span>
            <span class="mod-badge">${ids.length}</span>
          </div>
          <div style="display:${modOpen ? 'block' : 'none'}">
            ${ids.map(i => {
              const c = changes[i], isBug = c.kind === 'bug';
              return `<div class="doc-item ${sel === i ? 'active' : ''} ${isBug ? 'bug' : ''}" onclick="pick(${i})">
                <span class="doc-ico">${icoOf(c)}</span>
                <span class="doc-lbl">${esc(c.title)}</span>
                <span class="sdot" style="background:${statusColor(effStatus(c))}" title="${esc(effStatus(c))}"></span>
              </div>`;
            }).join('')}
          </div>
        </div>`;
      }).join('');
      return `<div>
        <div class="svc-hd" onclick="togSvc('${esc(svc)}')">
          <span class="chev ${svcOpen ? 'open' : ''}">▶</span>
          <span class="mod-ico">📦</span>
          <span class="mod-nm">${esc(svc)}</span>
          <span class="mod-badge">${total}</span>
        </div>
        <div style="display:${svcOpen ? 'block' : 'none'}">${modsHtml}</div>
      </div>`;
    }).join('');
  }
  document.getElementById("home-btn").className = "log-btn" + (sel === null ? " active" : "");
  document.getElementById("api-btn").className = "log-btn" + (sel === -2 ? " active" : "");
  document.getElementById("log-btn").className = "log-btn" + (sel === -1 ? " active" : "");
}

function togSvc(s) { expSvc.has(s) ? expSvc.delete(s) : expSvc.add(s); renderSidebar(); }
function togMod(s, m) { const k = mk(s, m); expMod.has(k) ? expMod.delete(k) : expMod.add(k); renderSidebar(); }

// ─── 浏览索引（首页）──────────────────────────────────────────────────────────
function mdLink(d, label) {
  if (!d.docPath) return '';
  // 自包含单页会被单独发给没有仓库的人，../docPath 必然 404 → 隐藏（与 pageLink 一致）
  if (typeof STANDALONE !== 'undefined' && STANDALONE) return '';
  return `<a class="md-link" href="../${esc(d.docPath)}" target="_blank" onclick="event.stopPropagation()">${label || '📄 源文档'}</a>`;
}
// 独立单页链接（pages/<slug>.html，由 build.js 生成）；自包含页面内部不显示此链接
function pageLink(d) {
  if (typeof STANDALONE !== 'undefined' && STANDALONE) return '';
  return `<a class="md-link" href="pages/${esc(pageSlug(d))}.html" target="_blank" onclick="event.stopPropagation()">📤 独立页面</a>`;
}

function showHome() {
  sel = null; renderSidebar();
  const g = grp();
  const visible = changes.map((c, i) => i).filter(i => matchF(changes[i]));
  const docCnt = visible.filter(i => kindOf(changes[i]) === 'doc').length;
  const bugCnt = visible.filter(i => kindOf(changes[i]) === 'bug').length;
  const readCnt = visible.filter(i => kindOf(changes[i]) === 'reading').length;
  const bizCnt = visible.filter(i => kindOf(changes[i]) === 'biz').length;
  const openCnt = visible.filter(i => !DONE.has(effStatus(changes[i]))).length;
  const svcCnt = Object.keys(g).length;

  let h = `<div class="doc-view">
    <h1 class="doc-h1">📊 浏览索引</h1>
    <p class="doc-intro">按微服务 → 模块归类的全部 AI 变更记录，点击标题查看详情，点击「源文档」打开 md 原文，「📤 独立页面」可单独分享</p>
    <div class="home-stats">
      <div class="stat-card sc-accent"><div class="stat-num">${docCnt}</div><div class="stat-lbl">📄 开发文档</div></div>
      <div class="stat-card sc-red"><div class="stat-num">${bugCnt}</div><div class="stat-lbl">🐛 Bug 记录</div></div>
      ${readCnt ? `<div class="stat-card sc-purple"><div class="stat-num">${readCnt}</div><div class="stat-lbl">📖 代码阅读</div></div>` : ''}
      ${bizCnt ? `<div class="stat-card sc-teal"><div class="stat-num">${bizCnt}</div><div class="stat-lbl">🔀 业务流</div></div>` : ''}
      <div class="stat-card sc-amber"><div class="stat-num">${openCnt}</div><div class="stat-lbl">⏳ 未完成</div></div>
      <div class="stat-card sc-blue"><div class="stat-num">${svcCnt}</div><div class="stat-lbl">📦 微服务</div></div>
    </div>`;

  const recent = [...visible].sort((a, b) => (changes[b].date || '').localeCompare(changes[a].date || '')).slice(0, 8);
  if (recent.length) {
    h += `<div class="recent"><div class="sec-title">最近更新</div>${recent.map(i => {
      const c = changes[i];
      return `<div class="recent-item">
        <span class="doc-ico">${icoOf(c)}</span>
        <span class="recent-title" onclick="pick(${i})">${esc(c.title)}</span>
        <span class="recent-path">${esc(svcOf(c))} / ${esc(modOf(c))}</span>
        <span class="idx-date">${esc(c.date || '')}</span>
      </div>`;
    }).join('')}</div>`;
  }

  h += Object.entries(g).map(([svc, mods]) => {
    const total = Object.values(mods).reduce((n, ids) => n + ids.length, 0);
    const modsHtml = Object.entries(mods).map(([mod, ids]) => `
      <div class="idx-mod">
        <div class="idx-mod-title">📁 ${esc(mod)}<span class="idx-svc-badge">（${ids.length}）</span></div>
        <table class="idx-table"><tbody>${ids.map(i => {
          const c = changes[i], isBug = c.kind === 'bug';
          const tag = isBug
            ? `<span class="tag t-${esc(tcls(c.severity || 'P2'))}">${esc(c.severity || 'P2')}</span>`
            : `<span class="tag t-${esc(tcls(c.type))}">${esc(c.type || '')}</span>`;
          const st = effStatus(c);
          return `<tr>
            <td style="width:20px">${icoOf(c)}</td>
            <td><span class="idx-title" onclick="pick(${i})">${esc(c.title)}</span></td>
            <td style="width:90px">${tag}</td>
            <td style="width:90px"><span class="idx-status"><span class="sdot" style="background:${statusColor(st)}"></span>${esc(st)}</span></td>
            <td style="width:90px" class="idx-date">${esc(c.date || '')}</td>
            <td style="width:130px">${mdLink(c)} ${pageLink(c)}</td>
          </tr>`;
        }).join('')}</tbody></table>
      </div>`).join('');
    return `<div class="idx-svc">
      <div class="idx-svc-title">📦 ${esc(svc)}<span class="idx-svc-badge">${total} 条记录</span></div>
      ${modsHtml}
    </div>`;
  }).join('');

  h += '</div>';
  document.getElementById("main").innerHTML = h;
}

// ─── 接口表格（pick / renderBiz 共用）─────────────────────────────────────────
function apiTable(apis) {
  const rows = apis.map(a => {
    const mClass = `m-${(a.method || 'GET').toUpperCase()}`;
    let detail = '';
    if (a.request) detail += `<details><summary>Request</summary><pre class="json-block">${esc(a.request)}</pre></details>`;
    if (a.response) detail += `<details><summary>Response</summary><pre class="json-block">${esc(a.response)}</pre></details>`;
    return `<tr>
      <td><span class="method ${mClass}">${esc(a.method)}</span></td>
      <td><code class="api-url">${esc(a.url)}</code></td>
      <td>${esc(a.desc || '')}${detail}</td>
    </tr>`;
  }).join('');
  return `<table class="api-table">
    <thead><tr><th style="width:72px">方法</th><th>路径</th><th>说明 / 报文</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

// ─── Mermaid 渲染（流程图 / 时序图等多图共用）─────────────────────────────────
function renderMermaid(wrap, code) {
  if (!wrap) return;
  const div = document.createElement('div');
  div.className = 'mermaid';
  div.textContent = code;
  wrap.appendChild(div);
  if (typeof mermaid !== 'undefined') {
    mermaid.run({ nodes: [div] }).catch(() => {
      wrap.innerHTML = `<pre class="flowchart-fallback">${esc(code)}</pre>`;
    });
  } else {
    wrap.innerHTML = `<pre class="flowchart-fallback">${esc(code)}</pre>`;
  }
}

// ─── Document view ────────────────────────────────────────────────────────────
function pick(i) {
  sel = i; renderSidebar();
  const d = changes[i];
  if (d.kind === 'bug') { renderBug(d); return; }
  if (d.kind === 'biz') { renderBiz(d); return; }
  const isReading = d.kind === 'reading';
  const st = effStatus(d);
  const main = document.getElementById("main");

  let h = `<div class="doc-view">
    <div class="breadcrumb">${isReading ? '<span>📖 代码阅读</span><span class="bc-sep">/</span>' : ''}<span>📦 ${esc(svcOf(d))}</span><span class="bc-sep">/</span><span>📁 ${esc(modOf(d))}</span><span class="bc-sep">/</span><span>${esc(d.title)}</span></div>
    <h1 class="doc-h1">${esc(d.title)}</h1>
    <div class="tags">
      ${d.type ? `<span class="tag t-${esc(tcls(d.type))}">${esc(d.type)}</span>` : ''}
      ${d.complexity ? `<span class="tag t-cplx">${esc(d.complexity)}</span>` : ''}
      <span class="tag t-status-${esc(st)} clickable" title="点击切换状态" onclick="cycleStatus(event)">${esc(st)} ▾</span>
    </div>
    <div class="doc-meta">
      <span>📅 ${esc(d.date)}</span>
      ${d.branch ? `<span>🌿 ${esc(d.branch)}</span>` : ''}
      ${d.entry ? `<span>🧭 ${esc(d.entry)}</span>` : ''}
      ${mdLink(d)}
      ${pageLink(d)}
    </div>`;

  const hasReq = d.background || d.goals?.length || d.scopeIn?.length || d.scopeOut?.length;
  if (hasReq) {
    let body = '';
    if (d.background) body += para(d.background);
    if (d.goals?.length) body += `<ul class="checklist" style="margin-bottom:12px">${d.goals.map(g => `<li>${esc(g)}</li>`).join('')}</ul>`;
    if (d.scopeIn?.length || d.scopeOut?.length) {
      body += `<div>`;
      if (d.scopeIn?.length)  body += `<div class="scope-row"><span class="scope-label">✅ 包含</span>${d.scopeIn.map(s => `<span class="scope-in">${esc(s)}</span>`).join('')}</div>`;
      if (d.scopeOut?.length) body += `<div class="scope-row" style="margin-top:6px"><span class="scope-label">❌ 不含</span>${d.scopeOut.map(s => `<span class="scope-out">${esc(s)}</span>`).join('')}</div>`;
      body += `</div>`;
    }
    h += sec(isReading ? "文档概览" : "需求", body);
  }

  if (d.apis?.length) h += sec("接口文档", apiTable(d.apis));

  if (d.solution || d.coreDesign) {
    let body = '';
    if (d.solution)   body += para(d.solution);
    if (d.coreDesign) body += para(d.coreDesign);
    h += sec("技术方案", body);
  }

  if (d.flowchart) {
    h += sec(isReading ? "调用链" : "流程图", `<div class="mermaid-wrap" id="mmd-wrap"></div>`);
  }

  if (d.keyImpl?.length) {
    h += sec(isReading ? "代码位置索引" : "关键实现", `<div class="keyimpl-list">${d.keyImpl.map(k =>
      `<div class="keyimpl-item"><div class="ki-title">${esc(k.title)}</div><div class="ki-desc">${esc(k.desc)}</div></div>`
    ).join('')}</div>`);
  }

  if (d.changeList?.length) {
    h += sec("代码变更", `<table class="ctable">
      <thead><tr><th>文件路径</th><th style="width:72px">操作</th><th>说明</th></tr></thead>
      <tbody>${d.changeList.map(c =>
        `<tr><td><code>${esc(c.file)}</code></td>
         <td><span class="abadge a-${esc(c.action)}">${esc(c.action)}</span></td>
         <td>${esc(c.desc)}</td></tr>`
      ).join('')}</tbody>
    </table>`);
  }

  if (d.todos?.length) {
    h += sec("实现 Todo", `<ul class="checklist">${d.todos.map(t => `<li>${esc(t)}</li>`).join('')}</ul>`);
  }

  h += '</div>';
  main.innerHTML = h;

  if (d.flowchart) renderMermaid(document.getElementById("mmd-wrap"), d.flowchart);
}

// ─── Bug view ─────────────────────────────────────────────────────────────────
function renderBug(d) {
  const sev = d.severity || 'P2';
  const st = effStatus(d);
  let h = `<div class="doc-view">
    <div class="breadcrumb"><span>🐛 Bug</span><span class="bc-sep">/</span><span>📦 ${esc(svcOf(d))}</span><span class="bc-sep">/</span><span>📁 ${esc(modOf(d))}</span><span class="bc-sep">/</span><span>${esc(d.title)}</span></div>
    <h1 class="doc-h1">${esc(d.title)}</h1>
    <div class="tags">
      <span class="tag t-${esc(tcls(sev))}">${esc(sev)}</span>
      <span class="tag t-status-${esc(st)} clickable" title="点击切换状态" onclick="cycleStatus(event)">${esc(st)} ▾</span>
    </div>
    <div class="doc-meta">
      <span>📅 ${esc(d.date)}</span>
      ${d.branch ? `<span>🌿 ${esc(d.branch)}</span>` : ''}
      ${mdLink(d)}
      ${pageLink(d)}
    </div>`;

  const hasSym = d.symptom || d.stackTrace || d.reproSteps?.length || d.trigger || d.expected || d.actual;
  if (hasSym) {
    let b = '';
    if (d.symptom) b += para(d.symptom);
    if (d.stackTrace) b += `<details open><summary>堆栈信息</summary><pre class="json-block">${esc(d.stackTrace)}</pre></details>`;
    if (d.reproSteps?.length) {
      b += `<p class="sub-label">复现步骤</p>`;
      b += `<ol class="repro-ol">${d.reproSteps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>`;
    }
    if (d.trigger) b += `<p class="sub-label">触发条件</p>${para(d.trigger)}`;
    if (d.expected || d.actual) {
      b += `<table class="api-table" style="margin-top:12px"><thead><tr><th></th><th>预期</th><th>实际</th></tr></thead>
        <tbody><tr><td class="sub-label" style="margin:0">行为</td>
        <td class="val-exp">${esc(d.expected || '')}</td>
        <td class="val-act">${esc(d.actual || '')}</td></tr></tbody></table>`;
    }
    h += sec("现象", b);
  }

  if (d.impact) h += sec("影响范围", para(d.impact));

  if (d.codeLocation || d.rootCause) {
    let b = '';
    if (d.codeLocation) b += `<div class="keyimpl-list" style="margin-bottom:12px"><div class="keyimpl-item"><div class="ki-title">代码定位</div><div class="ki-desc">${esc(d.codeLocation)}</div></div></div>`;
    if (d.rootCause) b += para(d.rootCause);
    h += sec("根因分析", b);
  }

  if (d.fixPlan) h += sec("修复方案", para(d.fixPlan));

  if (d.changeList?.length) {
    h += sec("代码变更", `<table class="ctable">
      <thead><tr><th>文件路径</th><th style="width:72px">操作</th><th>说明</th></tr></thead>
      <tbody>${d.changeList.map(c =>
        `<tr><td><code>${esc(c.file)}</code></td>
         <td><span class="abadge a-${esc(c.action)}">${esc(c.action)}</span></td>
         <td>${esc(c.desc)}</td></tr>`
      ).join('')}</tbody>
    </table>`);
  }

  if (d.verifySteps?.length) h += sec("验证步骤", `<ul class="checklist">${d.verifySteps.map(t => `<li>${esc(t)}</li>`).join('')}</ul>`);
  if (d.todos?.length) h += sec("实现 Todo", `<ul class="checklist">${d.todos.map(t => `<li>${esc(t)}</li>`).join('')}</ul>`);

  h += '</div>';
  document.getElementById("main").innerHTML = h;
}

// ─── 业务流 view（kind:"biz"，由 /biz-flow 追加，面向测试人员）──────────────────
function renderBiz(d) {
  const st = effStatus(d);
  let h = `<div class="doc-view">
    <div class="breadcrumb"><span>🔀 业务流</span><span class="bc-sep">/</span><span>📦 ${esc(svcOf(d))}</span><span class="bc-sep">/</span><span>📁 ${esc(modOf(d))}</span><span class="bc-sep">/</span><span>${esc(d.title)}</span></div>
    <h1 class="doc-h1">${esc(d.title)}</h1>
    <div class="tags">
      <span class="tag t-业务流">业务流</span>
      <span class="tag t-status-${esc(st)} clickable" title="点击切换状态" onclick="cycleStatus(event)">${esc(st)} ▾</span>
    </div>
    <div class="doc-meta">
      <span>📅 ${esc(d.date)}</span>
      ${d.branch ? `<span>🌿 ${esc(d.branch)}</span>` : ''}
      ${mdLink(d)}
      ${pageLink(d)}
    </div>`;

  const mmds = [];
  if (d.background) h += sec("业务概述", para(d.background));
  if (d.apis?.length) h += sec("涉及接口", apiTable(d.apis));
  if (d.bizFlow) { h += sec("业务流转图", `<div class="mermaid-wrap" id="mmd-biz"></div>`); mmds.push(['mmd-biz', d.bizFlow]); }
  if (d.dataFlow) { h += sec("数据流图", `<div class="mermaid-wrap" id="mmd-data"></div>`); mmds.push(['mmd-data', d.dataFlow]); }
  if (d.sequence) { h += sec("时序图", `<div class="mermaid-wrap" id="mmd-seq"></div>`); mmds.push(['mmd-seq', d.sequence]); }
  if (d.stateMachine) { h += sec("状态流转", `<div class="mermaid-wrap" id="mmd-state"></div>`); mmds.push(['mmd-state', d.stateMachine]); }

  if (d.bizRules?.length) {
    h += sec("关键业务规则", `<div class="keyimpl-list">${d.bizRules.map(k =>
      `<div class="keyimpl-item"><div class="ki-title">${esc(k.title)}</div><div class="ki-desc">${esc(k.desc)}</div></div>`
    ).join('')}</div>`);
  }

  if (d.testPoints?.length) {
    h += sec("测试关注点", `<ul class="checklist">${d.testPoints.map(t => `<li>${esc(t)}</li>`).join('')}</ul>`);
  }

  h += '</div>';
  document.getElementById("main").innerHTML = h;
  mmds.forEach(([id, code]) => renderMermaid(document.getElementById(id), code));
}

// ─── 接口索引（聚合所有记录的 apis 字段，单独展示）────────────────────────────
function showApis() {
  sel = -2; renderSidebar();
  const g = grp();
  let total = 0;
  let body = Object.entries(g).map(([svc, mods]) => {
    const modsHtml = Object.entries(mods).map(([mod, ids]) => {
      const rows = [];
      ids.forEach(i => {
        const c = changes[i];
        (c.apis || []).forEach(a => {
          total++;
          const mClass = `m-${(a.method || 'GET').toUpperCase()}`;
          let detail = '';
          if (a.request) detail += `<details><summary>Request</summary><pre class="json-block">${esc(a.request)}</pre></details>`;
          if (a.response) detail += `<details><summary>Response</summary><pre class="json-block">${esc(a.response)}</pre></details>`;
          rows.push(`<tr>
            <td style="width:72px"><span class="method ${mClass}">${esc(a.method)}</span></td>
            <td><code class="api-url">${esc(a.url)}</code></td>
            <td>${esc(a.desc || '')}${detail}</td>
            <td style="width:160px"><span class="idx-title" onclick="pick(${i})">${esc(c.title)}</span></td>
            <td style="width:90px" class="idx-date">${esc(c.date || '')}</td>
          </tr>`);
        });
      });
      if (!rows.length) return '';
      return `<div class="idx-mod">
        <div class="idx-mod-title">📁 ${esc(mod)}</div>
        <table class="api-table">
          <thead><tr><th>方法</th><th>路径</th><th>说明 / 报文</th><th>来源文档</th><th>日期</th></tr></thead>
          <tbody>${rows.join('')}</tbody>
        </table>
      </div>`;
    }).filter(Boolean).join('');
    if (!modsHtml) return '';
    return `<div class="idx-svc"><div class="idx-svc-title">📦 ${esc(svc)}</div>${modsHtml}</div>`;
  }).filter(Boolean).join('');

  if (!total) body = `<div class="sb-empty" style="padding:60px 0">暂无接口记录（仅当任务新增或变更接口时才会登记）</div>`;
  document.getElementById("main").innerHTML = `<div class="doc-view">
    <h1 class="doc-h1">🔌 接口索引</h1>
    <p class="doc-intro">汇总所有记录的接口变更（共 ${total} 个），点击来源文档查看上下文。仅登记新增或参数有变动的接口。</p>
    ${body}
  </div>`;
}

// ─── Changelog view ──────────────────────────────────────────────────────────
function showLog() {
  sel = -1; renderSidebar();
  const items = [...htmlChangelog].reverse().map(e => `
    <div class="tl-item">
      <div class="tl-left"><div class="tl-dot"></div><div class="tl-line"></div></div>
      <div class="tl-right">
        <div class="tl-date">${esc(e.date)}</div>
        <div class="tl-desc">${esc(e.desc)}</div>
      </div>
    </div>`).join('');
  document.getElementById("main").innerHTML = `<div class="doc-view">
    <h1 class="doc-h1">📋 HTML 变更日志</h1>
    <p class="doc-intro">每次修改看板时自动追加</p>
    <div class="timeline">${items}</div>
  </div>`;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function sec(title, body) {
  return `<div class="sec"><div class="sec-title">${title}</div>${body}</div>`;
}
// 叙述字段按段落渲染：\n 分段（看板内容面向人类撰写，允许多段）
function para(s) {
  const ps = String(s ?? '').split(/\n+/).map(t => t.trim()).filter(Boolean);
  return `<div class="para">${ps.map(t => `<p>${esc(t)}</p>`).join('')}</div>`;
}
function esc(s) {
  return String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// ─── Init ────────────────────────────────────────────────────────────────────
const g0 = grp();
Object.keys(g0).forEach(s => { expSvc.add(s); Object.keys(g0[s]).forEach(m => expMod.add(mk(s, m))); });
showHome();
