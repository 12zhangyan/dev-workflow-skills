/* 研发变更档案馆 — 渲染与交互逻辑
 * 数据在 data/changes.js（dev-doc 创建主档案，code-review 按 deliveryId/sourceDocPath 追加生命周期，本文件不存数据）
 * 与 skills/yan-dev-doc/assets/board/js/board.js 保持一致，修改时两处同步 */

// 外壳版本号只提示维护更新；发布按实际兼容性决定是否同步外壳，不动 data/。
// 改动外壳行为时 +1。
const BOARD_VERSION = 35;

const UI_ICONS = {
  "grid": "<rect x=\"3\" y=\"3\" width=\"7\" height=\"7\" rx=\"1.5\"/><rect x=\"14\" y=\"3\" width=\"7\" height=\"7\" rx=\"1.5\"/><rect x=\"3\" y=\"14\" width=\"7\" height=\"7\" rx=\"1.5\"/><rect x=\"14\" y=\"14\" width=\"7\" height=\"7\" rx=\"1.5\"/>",
  "layers": "<path d=\"m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5\"/>",
  "clock": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 7v5l3 2\"/>",
  "archive": "<rect x=\"3\" y=\"3\" width=\"18\" height=\"5\" rx=\"1\"/><path d=\"M5 8v12h14V8M10 12h4\"/>",
  "doc": "<path d=\"M14 3H5v18h14V8l-5-5Zm0 0v5h5M8 12h8M8 16h6\"/>",
  "bug": "<path d=\"M8 8h8v7a4 4 0 0 1-8 0V8Zm1 0V6a3 3 0 0 1 6 0v2M4 9l4 2m8 0 4-2M3 15h5m8 0h5M5 21l4-3m6 0 4 3M12 10v9\"/>",
  "book": "<path d=\"M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1v15\"/>",
  "flow": "<rect x=\"9\" y=\"2\" width=\"6\" height=\"5\" rx=\"1\"/><rect x=\"2\" y=\"17\" width=\"6\" height=\"5\" rx=\"1\"/><rect x=\"16\" y=\"17\" width=\"6\" height=\"5\" rx=\"1\"/><path d=\"M12 7v5M5 17v-5h14v5\"/>",
  "code": "<path d=\"m8 7-5 5 5 5m8-10 5 5-5 5m-3-13-2 20\"/>",
  "search": "<circle cx=\"10.5\" cy=\"10.5\" r=\"6.5\"/><path d=\"m16 16 5 5\"/>",
  "arrow": "<path d=\"M4 12h16m-6-6 6 6-6 6\"/>",
  "back": "<path d=\"M20 12H4m6-6-6 6 6 6\"/>",
  "check": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"m8 12 3 3 5-6\"/>",
  "folder": "<path d=\"M3 7V4h6l2 3h10v13H3V7Z\"/>",
  "menu": "<path d=\"M4 6h16M4 12h16M4 18h16\"/>",
  "history": "<path d=\"M3 11a9 9 0 1 1 3 8M3 4v7h7M12 7v5l4 2\"/>",
  "link": "<path d=\"M14 3h7v7m0-7L10 14M10 5H3v16h16v-7\"/>",
  "filter": "<path d=\"M4 6h16M7 12h10m-7 6h4\"/>"
};
function uiIcon(name) {
  return '<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (UI_ICONS[name] || UI_ICONS.doc) + '</svg>';
}

if (typeof mermaid !== 'undefined') mermaid.initialize({ startOnLoad: false, theme: 'neutral', fontFamily: 'inherit' });

// ─── 状态（可点击切换，保存在浏览器 localStorage）─────────────────────────────
const DOC_CYCLE = ['待确认', '草稿', '进行中', '已完成'];
const BUG_CYCLE = ['未修复', '修复中', '已修复', '已验证'];
const DONE = new Set(['已完成', '已验证']);
const SK = 'dwf-status';
const SC = { '待确认': '#c2410c', '草稿': '#b8ad99', '进行中': '#9a6b1f', '已完成': '#3e6b4f', '未修复': '#a02c2c', '修复中': '#9a6b1f', '已修复': '#3e6b4f', '已验证': '#2b5876' };
let overrides = {};
try { overrides = JSON.parse(localStorage.getItem(SK) || '{}'); } catch (e) {}
function svcOf(d) { return d.service || '通用'; }
function modOf(d) { return d.module || '通用'; }
function keyOf(d) { return `${svcOf(d)}::${modOf(d)}::${d.date}::${d.title}`; }
function effStatus(d) { return overrides[keyOf(d)] ?? d.status; }
function statusColor(s) { return SC[s] || '#c8c9cc'; }
const DELIVERY_GATES = ['plan', 'implementation', 'verification', 'review', 'submit'];
const GATE_LABEL = { plan: '方案', implementation: '实现', verification: '验证', review: '审查', submit: '提交' };
function gateLabel(gate) { return GATE_LABEL[gate] || gate || '方案'; }
function currentGateOf(d) { return DELIVERY_GATES.includes(d.currentGate) ? d.currentGate : 'plan'; }
function activateKey(ev) {
  if (!ev || (ev.key !== 'Enter' && ev.key !== ' ')) return false;
  ev.preventDefault();
  return true;
}
const RECENT_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;
const SCOPE_LABEL = { workspace: '工作台', backlog: '待办库', archive: '档案库', all: '全部记录' };
function recordTime(d) {
  const raw = d.updatedAt || d.date;
  if (!raw) return null;
  const t = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw + 'T00:00:00Z' : raw);
  return Number.isFinite(t) ? t : null;
}
function scopeOf(d) {
  const manual = { active: 'workspace', backlog: 'backlog', archived: 'archive' }[d.lifecycle];
  if (manual) return manual;
  if (d.pinned) return 'workspace';
  const t = recordTime(d);
  if (t === null || Date.now() - t <= RECENT_DAYS * DAY_MS) return 'workspace';
  return DONE.has(effStatus(d)) ? 'archive' : 'backlog';
}
// 类型/严重度 → CSS 类后缀：去掉空格，使「Bug 修复」「API 联调」能匹配 .t-Bug修复 / .t-API联调
function tcls(v) { return String(v == null ? '' : v).replace(/\s+/g, ''); }
// 单页文件名：与 build.js 的 slugOf 保持一致（生成 pages/<slug>.html）
function slugOf(d) {
  return [svcOf(d), modOf(d), d.title || 'untitled'].join('-')
    .replace(/[\/\\:*?"<>|\s]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}
// 去重后的单页文件名映射：与 build.js buildSlugMap 算法逐字一致（同名 slug 追加 -1）。
// pageLink 必须用它而非裸 slugOf，否则同名条目的详情页链接会指向第一个条目的页面。
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
function icoOf(c) { return uiIcon({ bug: 'bug', reading: 'book', biz: 'flow' }[c.kind] || 'doc'); }
// 一句话导语：取主叙述字段的第一句，让人不点开也能扫读这条记录在讲什么。
// 确定性提取（Rule 5），不依赖 skill 额外撰写字段。
function leadOf(c) {
  const plan = c.delivery && c.delivery.plan || {};
  const raw = c.summary || plan.summary || plan.background || (c.kind === 'bug' ? (c.symptom || c.rootCause || c.impact)
    : c.kind === 'reading' ? (c.entry || c.background || c.solution)
    : c.kind === 'biz' ? (c.background || c.solution)
    : (c.background || c.solution || c.coreDesign));
  if (!raw) return '';
  const s = String(raw).trim();
  const m = s.match(/^[^。！？!?\n]+[。！？!?]?/);
  const first = (m ? m[0] : s).trim();
  return first.length > 80 ? first.slice(0, 80) + '…' : first;
}
function shortText(s, n = 96) {
  const one = String(s || '').replace(/\s+/g, ' ').trim();
  return one.length > n ? one.slice(0, n) + '…' : one;
}
function firstItems(arr, n = 2) {
  return Array.isArray(arr) ? arr.filter(Boolean).slice(0, n) : [];
}
function listOf(v) { return Array.isArray(v) ? v.filter(Boolean) : v ? [v] : []; }
// 范围既接受 scopeIn/scopeOut，也接受发布协议里的混合 scope 列表。
function scopeBlock(src) {
  const row = (label, items, cls) => items.length
    ? `<div class="scope-row"><span class="scope-label">${label}</span>${items.map(x => `<span class="${cls}">${esc(x)}</span>`).join('')}</div>` : '';
  const html = row('✅ 包含', listOf(src.scopeIn), 'scope-in') + row('❌ 不含', listOf(src.scopeOut), 'scope-out') +
    row('📐 边界', listOf(src.scope), 'scope-note');
  return html ? `<div class="scope-block">${html}</div>` : '';
}
const RISK_KEYS = ['blockers', 'conflicts', 'assumptions', 'openQuestions'];
function riskSource(d, plan) {
  const out = {};
  RISK_KEYS.forEach(k => { out[k] = [...listOf(d[k]), ...listOf(plan && plan[k])]; });
  return out;
}
function pendingCount(src) { return ['blockers', 'conflicts', 'openQuestions'].reduce((n, k) => n + listOf(src[k]).length, 0); }
function needsConfirmation(d, plan) {
  return /needs|confirm|待确认/i.test(String(plan && plan.status || '')) || effStatus(d) === '待确认';
}
function summaryRows(d) {
  const rows = [];
  if (d.kind === 'bug') {
    if (d.impact) rows.push(['影响范围', shortText(d.impact)]);
    if (d.rootCause) rows.push(['当前判断', shortText(d.rootCause)]);
    if (d.fixPlan) rows.push(['修复方向', shortText(d.fixPlan)]);
    const verify = firstItems(d.verifySteps, 2);
    if (verify.length) rows.push(['验证重点', verify.join('；')]);
    return rows;
  }
  if (d.kind === 'biz') {
    const apis = (d.apis || []).map(a => `${a.method || ''} ${a.url || ''}`.trim()).filter(Boolean).slice(0, 3);
    if (apis.length) rows.push(['接口主线', apis.join(' → ')]);
    const roles = firstItems(d.roles, 2).map(x => x.name || x.role || x.actor).filter(Boolean);
    if (roles.length) rows.push(['参与角色', roles.join('；')]);
    const stages = firstItems(d.dataChanges, 2).map(x => x.stage || x.title).filter(Boolean);
    if (stages.length) rows.push(['数据阶段', stages.join('；')]);
    const rules = firstItems(d.bizRules, 2).map(x => x.title || x.desc).filter(Boolean);
    if (rules.length) rows.push(['关键规则', rules.join('；')]);
    const tests = firstItems(d.testPoints, 2);
    if (tests.length) rows.push(['优先测试', tests.join('；')]);
    return rows;
  }
  if (d.kind === 'reading') {
    if (d.entry) rows.push(['追踪入口', d.entry]);
    const locs = firstItems(d.keyImpl, 2).map(x => x.title || x.desc).filter(Boolean);
    if (locs.length) rows.push(['先看位置', locs.join('；')]);
    return rows;
  }
  if (d.delivery) {
    const plan = d.delivery.plan || {};
    const review = d.delivery.review || {};
    const events = Array.isArray(review.events) ? review.events : [];
    const latest = events[events.length - 1];
    if (plan.summary || plan.background) rows.push(['这次做什么', shortText(plan.summary || plan.background, 180)]);
    if (plan.dataFlowSummary) rows.push(['数据怎么流转', shortText(plan.dataFlowSummary, 180)]);
    if (plan.solution) rows.push(['实现方式', shortText(plan.solution, 180)]);
    if (latest) rows.push(['最近审查', shortText(latest.summary || latest.conclusion || latest.title, 180)]);
    return rows;
  }
  const goals = firstItems(d.goals, 2);
  if (!goals.length && d.summary) rows.push(['这次做什么', d.summary]);
  if (goals.length) rows.push(['这次做什么', goals.join('；')]);
  if (d.dataFlowSummary) rows.push(['数据怎么流转', shortText(d.dataFlowSummary, 180)]);
  if (d.solution) rows.push(['实现方式', shortText(d.solution, 180)]);
  if (d.coreDesign) rows.push(['关键边界与取舍', shortText(d.coreDesign, 180)]);
  const impl = firstItems(d.keyImpl, 2).map(x => x.title || x.desc).filter(Boolean);
  if (!d.coreDesign && impl.length) rows.push(['关键边界与取舍', impl.join('；')]);
  const acceptance = firstItems(d.acceptance, 2);
  if (acceptance.length) rows.push(['怎么验收', acceptance.join('；')]);
  return rows;
}
function nextAction(d) {
  if (d.kind === 'bug') return effStatus(d) === '已验证' ? '已验证：可沉淀复盘或关闭记录' : '建议先确认根因，再按验证步骤回归';
  if (d.kind === 'biz') return '建议测试先按业务流转图设计主流程，再补异常、边界、并发用例';
  if (d.kind === 'reading') return '建议 Review 先沿调用链读主路径，再核对状态流转和关键位置';
  if (d.delivery) {
    const events = d.delivery.review && d.delivery.review.events || [];
    const latest = events[events.length - 1];
    if (latest && latest.next) return latest.next;
    return `当前位于${gateLabel(currentGateOf(d))}阶段，继续补齐该 Gate 的证据与结论`;
  }
  if (DONE.has(effStatus(d))) return '已完成：可从源文档或详情页面复盘方案';
  return '建议评审先核对目标、方案边界、关键取舍和验收方式';
}
function quickBrief(d, title) {
  const rows = summaryRows(d);
  const action = nextAction(d);
  if (!rows.length && !action) return '';
  return `<div class="quick-brief">
    <div class="qb-head"><span>${esc(title || '读者速览')}</span><span class="qb-action">${esc(action)}</span></div>
    ${rows.length ? `<div class="qb-grid">${rows.map(([k, v]) =>
      `<div class="qb-item"><div class="qb-k">${esc(k)}</div><div class="qb-v">${esc(v)}</div></div>`
    ).join('')}</div>` : ''}
  </div>`;
}
function noteText(x) {
  if (typeof x === 'string') return x;
  if (!x || typeof x !== 'object') return '';
  const parts = [];
  if (x.point) parts.push(`冲突点：${x.point}`);
  if (x.user) parts.push(`用户口径：${x.user}`);
  if (x.evidence) parts.push(`证据：${x.evidence}`);
  if (x.risk) parts.push(`风险：${x.risk}`);
  if (x.suggestion) parts.push(`建议：${x.suggestion}`);
  if (x.blocking !== undefined) parts.push(`阻塞：${x.blocking ? '是' : '否'}`);
  if (!parts.length) Object.keys(x).forEach(k => parts.push(`${k}：${x[k]}`));
  return parts.join('；');
}
function riskNotes(d) {
  d = Object.assign({}, d, riskSource(d, d.delivery && d.delivery.plan));
  const groups = [
    ['blockers', '阻塞项', 'risk-blocker'],
    ['conflicts', '冲突/需裁决', 'risk-conflict'],
    ['assumptions', '明确假设', 'risk-assumption'],
    ['openQuestions', '待确认', 'risk-question']
  ].map(([key, title, cls]) => {
    const items = Array.isArray(d[key]) ? d[key].map(noteText).filter(Boolean) : [];
    return { title, cls, items };
  }).filter(g => g.items.length);
  if (!groups.length) return '';
  return `<div class="risk-notes" id="risk-notes">
    <div class="risk-title">判断依据与待确认</div>
    <div class="risk-grid">${groups.map(g => `
      <div class="risk-card ${g.cls}">
        <div class="risk-card-title">${esc(g.title)}</div>
        <ul>${g.items.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      </div>`).join('')}</div>
  </div>`;
}
let q = '', kindF = 'all', scopeF = 'workspace', openOnly = false, homeLimit = 30, sortF = 'newest';
// 搜索语料：覆盖各类条目的叙述字段，避免内容只在 solution/fixPlan/testPoints 时搜不到。
function searchHay(c) {
  const parts = [c.title, c.service, c.module, c.type, c.summary, c.searchText,
    c.deliveryId, c.currentGate, c.gateStatus, c.reviewState,
    c.background, c.solution, c.coreDesign,            // doc
    c.symptom, c.trigger, c.impact, c.rootCause, c.fixPlan,  // bug
    c.entry];                                          // reading
  const push = arr => { if (Array.isArray(arr)) arr.forEach(x => parts.push(typeof x === 'string' ? x : JSON.stringify(x || {}))); };
  push(c.goals); push(c.scopeIn); push(c.scopeOut); push(c.testPoints);
  push(c.bizRules); push(c.keyImpl);
  push(c.roles); push(c.context); push(c.dataChanges); push(c.validations); push(c.dataObjects);
  push(c.assumptions); push(c.conflicts); push(c.blockers); push(c.openQuestions);
  if (c.delivery) parts.push(JSON.stringify(c.delivery));
  parts.push(c.apiSpecPath, c.apiIndexPath);
  (c.apis || []).forEach(a => parts.push(a.url, a.desc, a.operationId, a.specPath));
  return parts.filter(Boolean).join(' ').toLowerCase();
}
function matchF(c) {
  if (scopeF !== 'all' && scopeOf(c) !== scopeF) return false;
  if (kindF !== 'all' && kindOf(c) !== kindF) return false;
  if (openOnly && DONE.has(effStatus(c))) return false;
  if (q) {
    const hay = searchHay(c);
    if (!hay.includes(q)) return false;
  }
  return true;
}
function refreshView() { if (sel === -2) showApis(); else showHome(); }
function resetHomeLimit() { homeLimit = 30; }
function onSearch(v) { q = v.trim().toLowerCase(); resetHomeLimit(); renderSidebar(); refreshView(); }
function setKind(k) { kindF = k; resetHomeLimit(); renderSidebar(); refreshView(); }
function setScope(s) { scopeF = s; resetHomeLimit(); renderSidebar(); refreshView(); }
function toggleOpen() { openOnly = !openOnly; resetHomeLimit(); renderSidebar(); refreshView(); }

function toggleSidebar(force) {
  const open = typeof force === 'boolean' ? force : !document.body.classList.contains('nav-open');
  document.body.classList.toggle('nav-open', open);
  const toggle = document.getElementById('menu-toggle');
  if (toggle) {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? '收起导航' : '展开导航');
  }
}
function closeSidebar() {
  if (!document.body) return;
  const moveFocus = document.body.classList.contains('nav-open') && document.getElementById('sidebar')?.contains(document.activeElement);
  toggleSidebar(false);
  if (moveFocus) document.getElementById('main')?.focus({ preventScroll: true });
}
function resetMainScroll() {
  document.getElementById('main').scrollTop = 0;
  if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') window.scrollTo({ top: 0, behavior: 'auto' });
}
function detailBack() {
  if (typeof STANDALONE !== 'undefined' && STANDALONE) return '';
  if (typeof DETAIL_PAGE !== 'undefined' && DETAIL_PAGE) return '<a class="back-link" href="../index.html">' + uiIcon('back') + '返回工作台</a>';
  return '<button type="button" class="back-link" onclick="showHome()">' + uiIcon('back') + '返回' + SCOPE_LABEL[scopeF] + '</button>';
}

// ─── State ──────────────────────────────────────────────────────────────────
let sel = null; // null=浏览索引（首页）, -1=变更日志, -2=接口索引, 0+=文档下标
const expSvc = new Set(), expMod = new Set();
const treeLimits = new Map();
function mk(s, m) { return s + '::' + m; }
function encArg(s) { return encodeURIComponent(s).replace(/'/g, '%27'); }

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
  const scopeCnt = { workspace: 0, backlog: 0, archive: 0 };
  changes.forEach(c => { scopeCnt[scopeOf(c)]++; });
  const parts = [`${scopeCnt.workspace} 工作台`, `${scopeCnt.backlog} 待办`, `${scopeCnt.archive} 归档`];
  document.getElementById("sub").textContent = parts.join(' · ');
  document.querySelectorAll('.fpill[data-scope]').forEach(el => {
    el.classList.toggle('active', el.dataset.scope === scopeF);
    el.setAttribute('aria-pressed', String(el.dataset.scope === scopeF));
  });
  document.querySelectorAll('[data-count]').forEach(el => { el.textContent = el.dataset.count === 'all' ? changes.length : scopeCnt[el.dataset.count]; });
  const viewLabel = document.getElementById('view-label');
  if (viewLabel) viewLabel.textContent = sel === -2 ? '接口索引' : sel === -1 ? '变更日志' : sel === null ? SCOPE_LABEL[scopeF] : '变更详情';

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
        const limit = treeLimits.get(mk(svc, mod)) || 20;
        const shown = ids.slice(0, limit);
        return `<div>
          <button type="button" class="mod-hd" onclick="togMod(decodeURIComponent('${encArg(svc)}'),decodeURIComponent('${encArg(mod)}'))" aria-expanded="${modOpen}">
            <span class="chev ${modOpen ? 'open' : ''}">▶</span>
            <span class="mod-ico">${uiIcon('folder')}</span>
            <span class="mod-nm">${esc(mod)}</span>
            <span class="mod-badge">${ids.length}</span>
          </button>
          <div style="display:${modOpen ? 'block' : 'none'}">
            ${shown.map(i => {
              const c = changes[i], isBug = c.kind === 'bug';
              return `<button type="button" class="doc-item ${sel === i ? 'active' : ''} ${isBug ? 'bug' : ''}" onclick="pick(${i})" title="${esc(leadOf(c) || c.title)}">
                <span class="doc-ico">${icoOf(c)}</span>
                <span class="doc-lbl">${esc(c.title)}</span>
                <span class="sdot" style="background:${statusColor(effStatus(c))}" title="${esc(effStatus(c))}"></span>
              </button>`;
            }).join('')}
            ${ids.length > shown.length ? `<button class="tree-more" onclick="showMoreMod(event,'${encArg(svc)}','${encArg(mod)}')">再显示 ${Math.min(20, ids.length - shown.length)} 条</button>` : ''}
          </div>
        </div>`;
      }).join('');
      return `<div>
        <button type="button" class="svc-hd" onclick="togSvc(decodeURIComponent('${encArg(svc)}'))" aria-expanded="${svcOpen}">
          <span class="chev ${svcOpen ? 'open' : ''}">▶</span>
          <span class="mod-ico">${uiIcon('layers')}</span>
          <span class="mod-nm">${esc(svc)}</span>
          <span class="mod-badge">${total}</span>
        </button>
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
function showMoreMod(ev, s, m) {
  ev.stopPropagation();
  s = decodeURIComponent(s); m = decodeURIComponent(m);
  const k = mk(s, m);
  treeLimits.set(k, (treeLimits.get(k) || 20) + 20);
  renderSidebar();
}

// ─── 浏览索引（首页）──────────────────────────────────────────────────────────
function mdLink(d, label) {
  if (!d.docPath) return '';
  // 自包含导出脱离仓库，源文件链接必然失效；共享资源详情页则从 pages/ 向上两级回仓库根。
  if (typeof STANDALONE !== 'undefined' && STANDALONE) return '';
  const prefix = typeof DETAIL_PAGE !== 'undefined' && DETAIL_PAGE ? '../../' : '../';
  return `<a class="md-link" href="${prefix}${esc(d.docPath)}" target="_blank" onclick="event.stopPropagation()">${label || '📄 源文档'}</a>`;
}
function apiSpecLink(d, label) {
  if (!d.apiSpecPath) return '';
  if (typeof STANDALONE !== 'undefined' && STANDALONE) return '';
  const prefix = typeof DETAIL_PAGE !== 'undefined' && DETAIL_PAGE ? '../../' : '../';
  return `<a class="md-link" href="${prefix}${esc(d.apiSpecPath)}" target="_blank" onclick="event.stopPropagation()">${label || '📤 Apifox YAML'}</a>`;
}
function apiIndexLink(d, label) {
  if (!d.apiIndexPath) return '';
  if (typeof STANDALONE !== 'undefined' && STANDALONE) return '';
  const prefix = typeof DETAIL_PAGE !== 'undefined' && DETAIL_PAGE ? '../../' : '../';
  return `<a class="md-link" href="${prefix}${esc(d.apiIndexPath)}" target="_blank" onclick="event.stopPropagation()">${label || '📚 API 索引'}</a>`;
}
// 详情页链接（pages/<slug>.html，由 build.js 生成）；详情页/自包含导出内部不重复显示。
function pageLink(d) {
  if ((typeof STANDALONE !== 'undefined' && STANDALONE) || (typeof DETAIL_PAGE !== 'undefined' && DETAIL_PAGE)) return '';
  return `<a class="md-link" href="pages/${esc(pageSlug(d))}.html" target="_blank" onclick="event.stopPropagation()">↗ 详情页面</a>`;
}

function shortDate(d) { return String(d.updatedAt || d.date || '').slice(0, 10); }
function indexRow(i) {
  const c = changes[i], st = effStatus(c), lead = leadOf(c);
  const tag = c.deliveryId ? gateLabel(currentGateOf(c)) + '阶段' : c.kind === 'bug' ? c.severity || '缺陷' : c.type || '';
  return '<article class="record-row' + (DONE.has(st) ? ' record-done' : '') + '">' +
    '<span class="record-icon kind-' + kindOf(c) + '">' + icoOf(c) + '</span>' +
    '<div class="record-main"><button type="button" class="idx-title" onclick="pick(' + i + ')">' + esc(c.title) + '</button>' +
    (lead ? '<p class="idx-lead">' + esc(lead) + '</p>' : '') +
    '<div class="record-meta"><span class="record-path">' + esc(svcOf(c)) + ' <span>/</span> ' + esc(modOf(c)) + '</span>' +
    (tag ? '<span class="record-tag">' + esc(tag) + '</span>' : '') + '<time>' + esc(shortDate(c)) + '</time></div></div>' +
    '<div class="record-side"><span class="idx-status"><span class="sdot" style="background:' + statusColor(st) + '"></span>' + esc(st || '未标记') + '</span>' +
    '<div class="record-links">' + mdLink(c, '源文档') + ' ' + pageLink(c) + '</div></div></article>';
}
function showMoreHome() { homeLimit += 30; showHome(true); }
function setSort(value) { sortF = value; resetHomeLimit(); showHome(); }
function resetFilters() {
  q = ''; kindF = 'all'; openOnly = false; resetHomeLimit();
  const input = document.getElementById('q');
  if (input) input.value = '';
  refreshView();
}
function filterBar() {
  const types = [['all', '全部类型'], ['doc', '研发档案'], ['bug', 'Bug 记录'], ['reading', '代码阅读'], ['biz', '业务流程']];
  return '<div class="filters" aria-label="记录筛选"><div class="kind-filters">' + types.map(([key, label]) =>
    '<button type="button" class="fpill' + (kindF === key ? ' active' : '') + '" data-k="' + key + '" aria-pressed="' + (kindF === key) + '" onclick="setKind(\'' + key + '\')">' + label + '</button>'
  ).join('') + '</div><button type="button" class="fpill toggle' + (openOnly ? ' active' : '') + '" id="openPill" aria-pressed="' + openOnly + '" onclick="toggleOpen()">' + uiIcon('filter') + '仅未完成</button></div>';
}
function emptyRecords() {
  const filtered = q || kindF !== 'all' || openOnly;
  return '<div class="list-empty"><span class="empty-symbol">' + uiIcon(filtered ? 'search' : 'folder') + '</span><h2>' +
    (filtered ? '没有找到匹配记录' : '这里暂时没有记录') + '</h2><p>' +
    (filtered ? '试试其他关键词，或清除筛选条件。' : changes.length ? '切换记录空间，看看其他变更与方案。' : '变更方案、问题记录与业务流程，都将在这里有序归集。') + '</p>' +
    (filtered ? '<button type="button" class="secondary-button" onclick="resetFilters()">清除筛选</button>' : changes.length ? '<button type="button" class="secondary-button" onclick="setScope(\'all\')">查看全部记录</button>' : '') + '</div>';
}
function showHome(preserveScroll = false) {
  sel = null; renderSidebar(); closeSidebar();
  const visible = changes.map((c, i) => i).filter(i => matchF(changes[i]));
  const totalCnt = visible.length;
  const openCnt = visible.filter(i => !DONE.has(effStatus(changes[i]))).length;
  const doneCnt = totalCnt - openCnt;
  const svcCnt = new Set(visible.map(i => svcOf(changes[i]))).size;
  const pct = totalCnt ? Math.round(doneCnt / totalCnt * 100) : 0;
  const sortedVisible = [...visible].sort((a, b) => sortF === 'title'
    ? String(changes[a].title || '').localeCompare(String(changes[b].title || ''), 'zh-CN')
    : ((recordTime(changes[b]) || 0) - (recordTime(changes[a]) || 0)) * (sortF === 'oldest' ? -1 : 1) || a - b);
  const listed = sortedVisible.slice(0, homeLimit);
  const waiting = sortedVisible.filter(i => effStatus(changes[i]) === '待确认');
  const confirmPanel = waiting.length ? '<section class="confirm-panel"><h2>待你确认 <span class="count-badge">' + waiting.length + '</span></h2><p class="panel-caption">这些方案有未裁决的问题，确认后才能按方案实施</p>' +
    waiting.slice(0, 5).map(i => '<button type="button" class="confirm-item" onclick="pick(' + i + ')"><strong>' + esc(changes[i].title) + '</strong><span>' + esc(svcOf(changes[i])) + ' / ' + esc(modOf(changes[i])) + '</span></button>').join('') +
    (waiting.length > 5 ? '<p class="panel-caption">另有 ' + (waiting.length - 5) + ' 项，可用“仅未完成”筛选查看</p>' : '') + '</section>' : '';
  const descriptions = {
    workspace: '从每一次变更，看见项目的进展。', backlog: '收拢尚未完成的工作，让下一步更清晰。',
    archive: '沉淀已完成的变更，留下可追溯的答案。', all: '方案、问题与业务流程，在这里连接起来。'
  };
  const kinds = [['doc', '研发档案', 'doc'], ['bug', 'Bug 记录', 'bug'], ['reading', '代码阅读', 'book'], ['biz', '业务流程', 'flow']];
  const stats = [
    ['layers', '当前记录', totalCnt, '当前范围内的全部记录', 'accent'],
    ['clock', '待完成', openCnt, openCnt ? '持续跟进，逐项推进' : totalCnt ? '当前范围已全部完成' : '等待新的变更记录', 'amber'],
    ['check', '已完成', doneCnt, totalCnt ? '占当前记录的 ' + pct + '%' : '完成后在这里沉淀', 'green'],
    ['grid', '覆盖服务', svcCnt, '按服务与模块有序归集', 'blue']
  ];
  const h = '<div class="doc-view home-view"><div class="home-heading"><div><div class="home-kicker"><span></span> PROJECT JOURNAL</div>' +
    '<h1 class="doc-h1">' + (scopeF === 'workspace' ? '研发工作台' : SCOPE_LABEL[scopeF]) + '</h1><p class="doc-intro">' + descriptions[scopeF] + '</p></div>' +
    '<button type="button" class="secondary-button" onclick="showApis()">' + uiIcon('code') + '接口索引' + uiIcon('arrow') + '</button></div>' +
    '<section class="home-stats" aria-label="当前记录统计">' + stats.map(([icon, label, value, note, color]) =>
      '<div class="stat-card"><div class="stat-top"><span>' + label + '</span><span class="stat-icon tone-' + color + '">' + uiIcon(icon) + '</span></div><div class="stat-num">' + value + '</div><div class="stat-note">' + note + '</div></div>'
    ).join('') + '</section><div class="home-columns"><section class="bounded-list" aria-label="变更记录"><div class="home-list-head"><div><h2>变更记录 <span class="count-badge">' + totalCnt + '</span></h2><p>每一份记录，都有完整的来龙去脉。</p></div>' +
    '<label class="sort-control"><span class="sr-only">记录排序</span><select aria-label="记录排序" onchange="setSort(this.value)">' +
    [['newest', '最近更新'], ['oldest', '最早更新'], ['title', '按标题']].map(([key, label]) => '<option value="' + key + '"' + (sortF === key ? ' selected' : '') + '>' + label + '</option>').join('') + '</select></label></div>' +
    filterBar() + (listed.length ? '<div class="record-list">' + listed.map(indexRow).join('') + '</div>' : emptyRecords()) +
    '<div class="list-footer"><span role="status">' + (q ? '搜索“' + esc(q) + '” · ' : '') + '显示 ' + listed.length + ' / ' + totalCnt + ' 条记录</span>' +
    (listed.length < totalCnt ? '<button type="button" class="load-more" onclick="showMoreHome()">加载更多 ' + uiIcon('arrow') + '</button>' : '<span>已显示全部</span>') + '</div></section>' +
    '<aside class="overview-rail" aria-label="记录概览">' + confirmPanel + '<section class="distribution-panel"><h2>记录分布</h2><p class="panel-caption">当前筛选范围</p>' + kinds.map(([key, label, icon]) => {
      const count = visible.filter(i => kindOf(changes[i]) === key).length;
      return '<div class="distribution-row"><div><span class="kind-' + key + '">' + uiIcon(icon) + '</span><span>' + label + '</span><strong>' + count + '</strong></div><div class="distribution-track"><span class="fill-' + key + '" style="width:' + (totalCnt ? count / totalCnt * 100 : 0) + '%"></span></div></div>';
    }).join('') + '</section><section class="reading-guide"><span class="guide-icon">' + uiIcon('book') + '</span><h2>让变更有迹可循</h2><p>从背景到方案，从验证到交付，把上下文留给下一位同行者。</p><ol><li><span>01</span><div><strong>了解为什么</strong><p>先读背景与影响范围</p></div></li><li><span>02</span><div><strong>看清怎么做</strong><p>再看方案与关键取舍</p></div></li><li><span>03</span><div><strong>确认做到了</strong><p>查阅审查与验证证据</p></div></li></ol></section></aside></div>' +
    '<footer class="home-footer"><span>' + uiIcon('layers') + ' 每项变更，一份清晰档案</span><span>ONE CHANGE · ONE STORY</span></footer></div>';
  const main = document.getElementById('main');
  main.innerHTML = h;
  if (!preserveScroll) resetMainScroll();
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
      <td>${a.operationId ? `<code class="api-url">${esc(a.operationId)}</code><br>` : ''}${esc(a.desc || '')}${detail}</td>
    </tr>`;
  }).join('');
  return `<table class="api-table">
    <thead><tr><th style="width:72px">方法</th><th>路径</th><th>operationId / 说明 / 报文</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function bizRoles(roles) {
  return `<div class="biz-role-grid">${roles.map(r => {
    const title = r.name || r.role || r.actor || '角色';
    const sub = [r.channel, r.scope].filter(Boolean).join(' / ');
    const entry = r.entry || r.api || r.operation || '';
    return `<div class="biz-role-card">
      <div class="biz-role-title">${esc(title)}</div>
      ${sub ? `<div class="biz-role-sub">${esc(sub)}</div>` : ''}
      ${r.desc ? `<div class="biz-role-desc">${esc(r.desc)}</div>` : ''}
      ${entry ? `<code class="biz-role-entry">${esc(entry)}</code>` : ''}
    </div>`;
  }).join('')}</div>`;
}

function simpleTable(columns, rows) {
  return `<table class="api-table">
    <thead><tr>${columns.map(c => `<th>${esc(c.label)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(row => `<tr>${columns.map(c => `<td>${esc(row[c.key] || '')}</td>`).join('')}</tr>`).join('')}</tbody>
  </table>`;
}

function dataChangeBlocks(stages) {
  return `<div class="stage-list">${stages.map(s => {
    const ops = firstItems(s.operations, 20);
    const opTable = ops.length ? `<table class="api-table stage-table">
      <thead><tr><th>对象</th><th>操作</th><th>关键字段/变化</th><th>核对点</th></tr></thead>
      <tbody>${ops.map(op => `<tr>
        <td><code>${esc(op.target || op.table || op.object || '')}</code></td>
        <td>${esc(op.action || '')}</td>
        <td>${esc(op.fields || op.change || '')}</td>
        <td>${esc(op.check || op.note || '')}</td>
      </tr>`).join('')}</tbody>
    </table>` : '';
    return `<div class="stage-card">
      <div class="stage-head">
        <div class="stage-title">${esc(s.stage || s.title || '阶段')}</div>
        ${s.trigger ? `<div class="stage-trigger">${esc(s.trigger)}</div>` : ''}
      </div>
      ${s.summary ? `<p class="stage-summary">${esc(s.summary)}</p>` : ''}
      ${opTable}
    </div>`;
  }).join('')}</div>`;
}

// ─── Mermaid 渲染（流程图 / 时序图等多图共用）─────────────────────────────────
function renderMermaid(wrap, code) {
  if (!wrap) return;
  const div = document.createElement('div');
  div.className = 'mermaid';
  div.textContent = code;
  wrap.appendChild(div);
  if (typeof mermaid !== 'undefined') {
    mermaid.run({ nodes: [div] }).then(() => addDiagramZoom(wrap)).catch(() => {
      wrap.innerHTML = `<pre class="flowchart-fallback">${esc(code)}</pre>`;
    });
  } else {
    wrap.innerHTML = `<pre class="flowchart-fallback">${esc(code)}</pre>`;
  }
}
function addDiagramZoom(wrap) {
  if (!wrap.querySelector('svg') || wrap.querySelector('.diagram-zoom')) return;
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'diagram-zoom'; btn.textContent = '⤢ 放大查看';
  btn.onclick = () => openDiagram(wrap);
  wrap.insertBefore(btn, wrap.firstChild);
}
// 复杂流程图在正文宽度里会被压缩到难以阅读，放大层按原始尺寸展示并支持缩放与滚动。
let diagramScale = 1;
function openDiagram(wrap) {
  closeDiagram();
  const svg = wrap.querySelector('svg');
  if (!svg) return;
  const title = wrap.closest('.sec')?.querySelector('.sec-title')?.textContent || '流程图';
  const layer = document.createElement('div');
  layer.className = 'diagram-overlay'; layer.id = 'diagram-overlay';
  layer.setAttribute('role', 'dialog'); layer.setAttribute('aria-modal', 'true'); layer.setAttribute('aria-label', title);
  layer.innerHTML = `<div class="diagram-panel"><div class="diagram-bar"><strong>${esc(title)}</strong><span>
    <button type="button" onclick="zoomDiagram(-0.25)" aria-label="缩小">－</button>
    <button type="button" onclick="zoomDiagram(0)" aria-label="原始大小">1:1</button>
    <button type="button" onclick="zoomDiagram(0.25)" aria-label="放大">＋</button>
    <button type="button" class="diagram-close" onclick="closeDiagram()" aria-label="关闭">✕ 关闭</button></span></div>
    <div class="diagram-stage"></div></div>`;
  const copy = svg.cloneNode(true);
  const box = svg.viewBox && svg.viewBox.baseVal;
  copy.removeAttribute('style');
  copy.dataset.baseWidth = String(Math.round(box && box.width ? box.width : svg.getBoundingClientRect().width));
  layer.querySelector('.diagram-stage').appendChild(copy);
  layer.addEventListener('click', event => { if (event.target === layer) closeDiagram(); });
  document.body.appendChild(layer);
  diagramScale = 1; zoomDiagram(0);
  layer.querySelector('.diagram-close').focus();
}
function zoomDiagram(step) {
  const copy = document.querySelector('#diagram-overlay .diagram-stage svg');
  if (!copy) return;
  diagramScale = step ? Math.min(3, Math.max(0.5, diagramScale + step)) : 1;
  copy.style.width = Math.round(Number(copy.dataset.baseWidth || 800) * diagramScale) + 'px';
  copy.style.maxWidth = 'none'; copy.style.height = 'auto';
}
function closeDiagram() { document.getElementById('diagram-overlay')?.remove(); }

// 详情页导读：渲染完成后扫描页面里的小标题，生成可点击章节导航（章节≥3 才显示）。
// 对 pick / renderBug / renderBiz 统一生效，轻量详情页与自包含导出同样适用。
function addToc() {
  const view = document.querySelector('#main .doc-view');
  if (!view) return;
  const titles = Array.prototype.slice.call(view.querySelectorAll('.sec-title'));
  if (titles.length < 3) return;
  const chips = titles.map((t, i) => {
    const id = 'sec-' + i;
    if (t.parentElement) t.parentElement.id = id;
    return `<a class="toc-chip" href="#${id}" onclick="event.preventDefault();var e=document.getElementById('${id}');if(e)e.scrollIntoView({block:'start'})">${esc(t.textContent.trim())}</a>`;
  }).join('');
  const nav = document.createElement('nav');
  nav.className = 'doc-toc';
  nav.innerHTML = `<span class="toc-lbl">本页导读</span>${chips}`;
  const meta = view.querySelector('.doc-meta');
  if (meta) meta.after(nav); else view.prepend(nav);
}

// ─── Document view ────────────────────────────────────────────────────────────
const BOARD_DETAILS = globalThis.BOARD_DETAILS || (globalThis.BOARD_DETAILS = {});
const detailLoads = new Map();
function mergedDetail(c) { return Object.assign({}, c, c.detailId && BOARD_DETAILS[c.detailId] || {}); }
function loadDetail(c, done) {
  if (!c.detailPath || !c.detailId || BOARD_DETAILS[c.detailId]) { done(null); return; }
  if (detailLoads.has(c.detailId)) { detailLoads.get(c.detailId).push(done); return; }
  detailLoads.set(c.detailId, [done]);
  const finish = err => {
    const waiters = detailLoads.get(c.detailId) || [];
    detailLoads.delete(c.detailId);
    waiters.forEach(fn => fn(err));
  };
  const script = document.createElement('script');
  script.src = c.detailPath;
  script.async = true;
  script.onload = () => finish(BOARD_DETAILS[c.detailId] ? null : new Error('详情脚本已加载，但没有对应 detailId'));
  script.onerror = () => finish(new Error('无法加载 ' + c.detailPath));
  document.head.appendChild(script);
}
function showDetailLoadError(c, error) {
  document.getElementById('main').innerHTML = `<div class="doc-view"><h1 class="doc-h1">详情加载失败</h1><p class="doc-intro">${esc(error.message || error)}</p><div class="doc-meta">${mdLink(c)} ${pageLink(c)}</div></div>`;
}
function deliveryModel(d) {
  const raw = d.delivery || {};
  const plan = Object.assign({
    status: d.background || d.solution || d.goals?.length ? 'passed' : 'pending',
    summary: d.summary || leadOf(d),
    background: d.background,
    goals: d.goals,
    scopeIn: d.scopeIn,
    scopeOut: d.scopeOut,
    solution: d.solution,
    dataFlowSummary: d.dataFlowSummary,
    coreDesign: d.coreDesign,
    keyImpl: d.keyImpl,
    acceptance: d.acceptance,
    flowchart: d.flowchart
  }, raw.plan || {});
  const review = raw.review || {};
  const events = Array.isArray(review.events) ? review.events : [];
  return {
    plan,
    implementation: raw.implementation || {},
    verification: raw.verification || {},
    review: Object.assign({}, review, { events }),
    submit: raw.submit || {}
  };
}
function gateClass(d, delivery, gate) {
  const stage = delivery[gate] || {};
  const explicit = String(stage.status || '').toLowerCase();
  if (/passed|fixed|complete|completed|done/.test(explicit)) return 'done';
  if (/blocked|failed|insufficient/.test(explicit)) return 'blocked';
  if (/progress|running|active|findings|awaiting/.test(explicit)) return 'current';
  const current = currentGateOf(d);
  const targetIndex = DELIVERY_GATES.indexOf(gate);
  const currentIndex = DELIVERY_GATES.indexOf(current);
  if (targetIndex < currentIndex) return 'done';
  if (targetIndex === currentIndex) return d.gateStatus === 'blocked' ? 'blocked' : 'current';
  return 'pending';
}
function findingView(finding) {
  if (typeof finding === 'string') return `<div class="finding-row"><span class="finding-id">NOTE</span><span>${esc(finding)}</span></div>`;
  const id = finding.id || finding.findingId || finding.severity || 'Finding';
  const state = finding.status || finding.state || 'open';
  const problem = finding.problem || finding.summary || finding.impact || '';
  return `<div class="finding-row finding-${esc(String(state).toLowerCase())}">
    <span class="finding-id">${esc(id)}</span>
    <span>${esc(problem)}</span>
    <span class="finding-state">${esc(state)}</span>
  </div>`;
}
function reviewEventView(event) {
  const findings = Array.isArray(event.findings) ? event.findings : [];
  const verification = event.verification || {};
  return `<article class="review-event">
    <div class="review-event-head">
      <div><span class="review-mode">${esc(event.mode || 'review')}</span><strong>${esc(event.title || event.conclusion || '代码审查')}</strong></div>
      <span class="review-date">${esc(event.date || '')}</span>
    </div>
    ${event.summary ? `<p>${esc(event.summary)}</p>` : ''}
    ${findings.length ? `<div class="finding-list">${findings.map(findingView).join('')}</div>` : '<div class="review-empty">本轮没有记录有证据的 finding</div>'}
    <div class="review-evidence">
      ${event.scopeType ? `<span>范围 · ${esc(event.scopeType)}</span>` : ''}
      ${verification.status ? `<span>验证 · ${esc(verification.status)}</span>` : ''}
      ${event.gateStatus ? `<span>Gate · ${esc(event.gateStatus)}</span>` : ''}
    </div>
  </article>`;
}
// 一页读懂：没参与开发的人先看这里，再决定是否展开完整方案。
function deliveryBrief(plan, latest, next, pending) {
  const rows = [];
  if (plan.summary || plan.background) rows.push(['要解决什么', shortText(plan.summary || plan.background, 180)]);
  if (plan.solution) rows.push(['怎么做', shortText(plan.solution, 180)]);
  if (plan.dataFlowSummary) rows.push(['数据怎么流转', shortText(plan.dataFlowSummary, 180)]);
  const out = listOf(plan.scopeOut), mixed = listOf(plan.scope);
  if (out.length) rows.push(['不做什么', shortText(out.slice(0, 3).join('；'), 180)]);
  else if (mixed.length) rows.push(['范围边界', shortText(mixed.slice(0, 3).join('；'), 180)]);
  const acceptance = firstItems(plan.acceptance, 3);
  if (acceptance.length) rows.push(['怎么验收', shortText(acceptance.join('；'), 180)]);
  if (pending) rows.push(['待你确认', `${pending} 项需要裁决，见下方“判断依据与待确认”`]);
  if (latest && (latest.summary || latest.conclusion)) rows.push(['最近审查', shortText(latest.summary || latest.conclusion, 180)]);
  if (!rows.length) return '';
  return `<div class="quick-brief delivery-brief">
    <div class="qb-head"><span>一页读懂</span><span class="qb-action">下一步：${esc(next)}</span></div>
    <div class="qb-grid">${rows.map(([k, v]) =>
      `<div class="qb-item${k === '待你确认' ? ' qb-alert' : ''}"><div class="qb-k">${esc(k)}</div><div class="qb-v">${esc(v)}</div></div>`
    ).join('')}</div>
  </div>`;
}
function renderDelivery(d) {
  const delivery = deliveryModel(d);
  const plan = delivery.plan;
  const events = delivery.review.events;
  const latest = events[events.length - 1] || {};
  const verification = Object.assign({}, delivery.verification, latest.verification || {});
  const current = currentGateOf(d);
  const st = effStatus(d);
  const summary = plan.summary || plan.background || leadOf(d);
  const next = latest.next || delivery[current]?.next || delivery[current]?.nextAction ||
    (current === 'submit' ? '完成 VCS 与人工确认后进入提交' : `继续补齐${gateLabel(current)}阶段证据`);
  const decisions = listOf(plan.decisions).map(x => typeof x === 'string' ? x : [x.title, x.desc].filter(Boolean).join('：'));
  const risks = riskSource(d, plan);
  const pending = pendingCount(risks);
  const confirm = needsConfirmation(d, plan);
  const verified = verification.status || verification.testEvidenceStatus || verification.summary || verification.result;
  const planFacts = [
    listOf(plan.goals).length ? `${listOf(plan.goals).length} 个目标` : '',
    listOf(plan.acceptance).length ? `${listOf(plan.acceptance).length} 条验收` : '',
    pending ? `${pending} 项待确认` : ''
  ].filter(Boolean).join(' · ');
  let h = `<div class="doc-view delivery-view">${detailBack()}
    <div class="breadcrumb"><span>🗂️ 研发变更档案</span><span class="bc-sep">/</span><span>${esc(svcOf(d))}</span><span class="bc-sep">/</span><span>${esc(modOf(d))}</span></div>
    <div class="delivery-kicker">研发档案 · 当前阶段：${esc(gateLabel(current))}${d.deliveryId ? ` · <span class="delivery-id">${esc(d.deliveryId)}</span>` : ''}</div>
    <h1 class="doc-h1">${esc(d.title)}</h1>
    ${summary ? `<p class="doc-lead">${esc(summary)}</p>` : ''}
    <div class="tags">
      ${d.type ? `<span class="tag t-${esc(tcls(d.type))}">${esc(d.type)}</span>` : ''}
      ${d.complexity ? `<span class="tag t-cplx">${esc(d.complexity)}</span>` : ''}
      <span class="tag delivery-gate-tag">${esc(gateLabel(current))}阶段</span>
      ${d.reviewState ? `<span class="tag review-state-tag">${esc(d.reviewState)}</span>` : ''}
      <button type="button" class="tag t-status-${esc(st)} clickable" title="点击切换状态" onclick="cycleStatus(event)">${esc(st)} ▾</button>
    </div>
    <div class="doc-meta">
      <span>📅 ${esc(d.updatedAt || d.date || '')}</span>
      ${d.branch ? `<span>🌿 ${esc(d.branch)}</span>` : ''}
      ${mdLink(d)} ${apiSpecLink(d)} ${apiIndexLink(d)} ${pageLink(d)}
    </div>
    <div class="delivery-progress">
      ${DELIVERY_GATES.map((gate, index) => `<div class="delivery-step ${gateClass(d, delivery, gate)}">
        <span class="delivery-dot"></span><span class="delivery-step-num">0${index + 1}</span><strong>${esc(gateLabel(gate))}</strong>
      </div>`).join('')}
    </div>
    ${confirm ? `<div class="confirm-banner" role="note"><strong>方案待确认</strong><span>${pending ? `还有 ${pending} 项需要裁决；` : ''}确认前，未决部分不要按方案实施。</span></div>` : ''}
    ${deliveryBrief(plan, latest, next, pending)}
    ${riskNotes(risks)}
    <div class="delivery-overview">
      <section class="delivery-card plan-card">
        <div class="delivery-card-label">01 · 开发方案</div>
        <h2>${confirm ? '方案待确认' : summary ? '方案已形成' : '尚未登记方案'}</h2>
        ${planFacts ? `<p>${esc(planFacts)}</p>` : ''}
        ${plan.coreDesign || decisions.length ? `<div class="delivery-callout"><b>核心取舍</b>${esc(shortText(plan.coreDesign || decisions[0], 160))}</div>` : ''}
      </section>
      <section class="delivery-card review-card${events.length ? '' : ' is-empty'}">
        <div class="delivery-card-label">02 · Review 摘要</div>
        <h2>${events.length ? `${events.length} 次审查记录` : '尚未进入审查'}</h2>
        ${events.length ? reviewEventView(latest) : ''}
      </section>
      <section class="delivery-card verification-card${verified ? '' : ' is-empty'}">
        <div class="delivery-card-label">03 · 验证证据</div>
        <h2>${esc(verification.status || verification.testEvidenceStatus || '尚未验证')}</h2>
        ${verification.summary || verification.result ? `<p>${esc(verification.summary || verification.result)}</p>` : ''}
        ${verification.dependencyClass ? `<code>${esc(verification.dependencyClass)}</code>` : ''}
      </section>
      <section class="delivery-card next-card">
        <div class="delivery-card-label">04 · 下一步</div>
        <h2>${esc(gateLabel(current))} → ${esc(gateLabel(DELIVERY_GATES[Math.min(DELIVERY_GATES.indexOf(current) + 1, 4)]))}</h2>
        <p>${esc(next)}</p>
      </section>
    </div>`;

  const hasPlan = plan.background || listOf(plan.goals).length || listOf(plan.scopeIn).length || listOf(plan.scopeOut).length ||
    listOf(plan.scope).length || plan.solution || plan.dataFlowSummary || plan.coreDesign || decisions.length;
  if (hasPlan) {
    let body = '';
    if (plan.background) body += `<p class="sub-label">背景</p>${para(plan.background)}`;
    if (listOf(plan.goals).length) body += `<p class="sub-label">目标</p><ul class="checklist">${listOf(plan.goals).map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
    const scope = scopeBlock(plan);
    if (scope) body += `<p class="sub-label">范围</p>${scope}`;
    if (plan.solution) body += `<p class="sub-label">实现方式</p>${para(plan.solution)}`;
    if (plan.dataFlowSummary) body += `<p class="sub-label">数据流转</p>${para(plan.dataFlowSummary)}`;
    if (plan.coreDesign || decisions.length) {
      body += `<p class="sub-label">关键边界与取舍</p>${plan.coreDesign ? para(plan.coreDesign) : ''}` +
        (decisions.length ? `<ul class="checklist">${decisions.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '');
    }
    h += sec('完整开发方案', body);
  }
  if (plan.flowchart) h += sec('数据流转与处理链路', '<div class="mermaid-wrap" id="mmd-wrap"></div>');
  if (plan.keyImpl?.length) {
    h += sec('关键实现决策', `<div class="keyimpl-list">${plan.keyImpl.map(k =>
      `<div class="keyimpl-item"><div class="ki-title">${esc(k.title)}</div><div class="ki-desc">${esc(k.desc)}</div></div>`
    ).join('')}</div>`);
  }
  if (d.apis?.length) h += sec('接口文档', apiTable(d.apis));
  if (listOf(plan.acceptance).length) h += sec('验收与回归', `<ul class="checklist">${listOf(plan.acceptance).map(x => `<li>${esc(x)}</li>`).join('')}</ul>`);
  if (events.length > 1) h += sec('Review 生命周期', `<div class="review-timeline">${events.map(reviewEventView).join('')}</div>`);
  h += '</div>';
  document.getElementById('main').innerHTML = h;
  addToc();
  if (plan.flowchart) renderMermaid(document.getElementById('mmd-wrap'), plan.flowchart);
}
function pick(i) {
  sel = i; renderSidebar(); closeSidebar(); resetMainScroll();
  const catalog = changes[i];
  if (catalog.detailPath && catalog.detailId && !BOARD_DETAILS[catalog.detailId]) {
    document.getElementById('main').innerHTML = `<div class="empty-state"><div class="loading-spinner" aria-hidden="true"></div><div>正在打开变更详情…</div></div>`;
    loadDetail(catalog, error => {
      if (sel !== i) return;
      if (error) showDetailLoadError(catalog, error); else pick(i);
    });
    return;
  }
  const d = mergedDetail(catalog);
  if (d.kind === 'bug') { renderBug(d); return; }
  if (d.kind === 'biz') { renderBiz(d); return; }
  const isReading = d.kind === 'reading';
  if (!isReading) { renderDelivery(d); return; }
  const st = effStatus(d);
  const main = document.getElementById("main");

  let h = `<div class="doc-view">${detailBack()}
    <div class="breadcrumb">${isReading ? '<span>📖 代码阅读</span><span class="bc-sep">/</span>' : ''}<span>📦 ${esc(svcOf(d))}</span><span class="bc-sep">/</span><span>📁 ${esc(modOf(d))}</span><span class="bc-sep">/</span><span>${esc(d.title)}</span></div>
    <h1 class="doc-h1">${esc(d.title)}</h1>
    ${leadOf(d) ? `<p class="doc-lead">${esc(leadOf(d))}</p>` : ''}
    <div class="tags">
      ${d.type ? `<span class="tag t-${esc(tcls(d.type))}">${esc(d.type)}</span>` : ''}
      ${d.complexity ? `<span class="tag t-cplx">${esc(d.complexity)}</span>` : ''}
      <button type="button" class="tag t-status-${esc(st)} clickable" title="点击切换状态" onclick="cycleStatus(event)">${esc(st)} ▾</button>
    </div>
    <div class="doc-meta">
      <span>📅 ${esc(d.date)}</span>
      ${d.branch ? `<span>🌿 ${esc(d.branch)}</span>` : ''}
      ${d.entry ? `<span>🧭 ${esc(d.entry)}</span>` : ''}
      ${mdLink(d)}
      ${apiSpecLink(d)}
      ${apiIndexLink(d)}
      ${pageLink(d)}
    </div>`;
  h += quickBrief(d, isReading ? "代码导读" : "方案摘要");
  h += riskNotes(d);

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

  if (d.solution || d.coreDesign || d.dataFlowSummary) {
    let body = '';
    if (d.solution) body += `<p class="sub-label">实现方式</p>${para(d.solution)}`;
    if (d.dataFlowSummary) body += `<p class="sub-label">数据流转</p>${para(d.dataFlowSummary)}`;
    if (d.coreDesign) body += `<p class="sub-label">关键边界与取舍</p>${para(d.coreDesign)}`;
    h += sec("技术方案", body);
  }

  if (d.flowchart) {
    h += sec(isReading ? "调用链" : "数据流转与处理链路", `<div class="mermaid-wrap" id="mmd-wrap"></div>`);
  }

  if (d.keyImpl?.length) {
    h += sec(isReading ? "代码位置索引" : "关键实现", `<div class="keyimpl-list">${d.keyImpl.map(k =>
      `<div class="keyimpl-item"><div class="ki-title">${esc(k.title)}</div><div class="ki-desc">${esc(k.desc)}</div></div>`
    ).join('')}</div>`);
  }

  if (d.acceptance?.length) {
    h += sec("验收与回归", `<ul class="checklist">${d.acceptance.map(t => `<li>${esc(t)}</li>`).join('')}</ul>`);
  }

  h += '</div>';
  main.innerHTML = h;
  addToc();

  if (d.flowchart) renderMermaid(document.getElementById("mmd-wrap"), d.flowchart);
}

// ─── Bug view ─────────────────────────────────────────────────────────────────
function renderBug(d) {
  const sev = d.severity || '缺陷';
  const st = effStatus(d);
  let h = `<div class="doc-view">${detailBack()}
    <div class="breadcrumb"><span>🐛 Bug</span><span class="bc-sep">/</span><span>📦 ${esc(svcOf(d))}</span><span class="bc-sep">/</span><span>📁 ${esc(modOf(d))}</span><span class="bc-sep">/</span><span>${esc(d.title)}</span></div>
    <h1 class="doc-h1">${esc(d.title)}</h1>
    ${leadOf(d) ? `<p class="doc-lead">${esc(leadOf(d))}</p>` : ''}
    <div class="tags">
      <span class="tag t-${esc(tcls(sev))}">${esc(sev)}</span>
      <button type="button" class="tag t-status-${esc(st)} clickable" title="点击切换状态" onclick="cycleStatus(event)">${esc(st)} ▾</button>
    </div>
    <div class="doc-meta">
      <span>📅 ${esc(d.date)}</span>
      ${d.branch ? `<span>🌿 ${esc(d.branch)}</span>` : ''}
      ${mdLink(d)}
      ${apiSpecLink(d)}
      ${apiIndexLink(d)}
      ${pageLink(d)}
    </div>`;
  h += quickBrief(d, "事故摘要");
  h += riskNotes(d);

  const hasSym = d.symptom || d.reproSteps?.length || d.trigger || d.expected || d.actual;
  if (hasSym) {
    let b = '';
    if (d.symptom) b += para(d.symptom);
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

  if (d.rootCause) h += sec("根因分析", para(d.rootCause));

  if (d.fixPlan) h += sec("修复方案", para(d.fixPlan));

  if (d.verifySteps?.length) h += sec("验证步骤", `<ul class="checklist">${d.verifySteps.map(t => `<li>${esc(t)}</li>`).join('')}</ul>`);

  h += '</div>';
  document.getElementById("main").innerHTML = h;
  addToc();
}

// ─── 业务流 view（kind:"biz"，由 /biz-flow 追加，面向测试人员）──────────────────
function renderBiz(d) {
  const st = effStatus(d);
  let h = `<div class="doc-view">${detailBack()}
    <div class="breadcrumb"><span>🔀 业务流</span><span class="bc-sep">/</span><span>📦 ${esc(svcOf(d))}</span><span class="bc-sep">/</span><span>📁 ${esc(modOf(d))}</span><span class="bc-sep">/</span><span>${esc(d.title)}</span></div>
    <h1 class="doc-h1">${esc(d.title)}</h1>
    ${leadOf(d) ? `<p class="doc-lead">${esc(leadOf(d))}</p>` : ''}
    <div class="tags">
      <span class="tag t-业务流">业务流</span>
      <button type="button" class="tag t-status-${esc(st)} clickable" title="点击切换状态" onclick="cycleStatus(event)">${esc(st)} ▾</button>
    </div>
    <div class="doc-meta">
      <span>📅 ${esc(d.date)}</span>
      ${d.branch ? `<span>🌿 ${esc(d.branch)}</span>` : ''}
      ${mdLink(d)}
      ${apiSpecLink(d)}
      ${apiIndexLink(d)}
      ${pageLink(d)}
    </div>`;
  h += quickBrief(d, "业务摘要");
  h += riskNotes(d);

  const mmds = [];
  if (d.background) h += sec("业务概述", para(d.background));
  if (d.roles?.length) h += sec("角色与入口", bizRoles(d.roles));
  if (d.context?.length) h += sec("上下文与前置条件", simpleTable([
    { key: 'field', label: '上下文字段/条件' },
    { key: 'source', label: '来源' },
    { key: 'usage', label: '业务用途' },
    { key: 'note', label: '说明' }
  ], d.context));
  if (d.apis?.length) h += sec("涉及接口", apiTable(d.apis));
  if (d.bizFlow) { h += sec("业务流转图", `<div class="mermaid-wrap" id="mmd-biz"></div>`); mmds.push(['mmd-biz', d.bizFlow]); }
  if (d.dataFlow) { h += sec("数据流图", `<div class="mermaid-wrap" id="mmd-data"></div>`); mmds.push(['mmd-data', d.dataFlow]); }
  if (d.sequence) { h += sec("时序图", `<div class="mermaid-wrap" id="mmd-seq"></div>`); mmds.push(['mmd-seq', d.sequence]); }
  if (d.stateMachine) { h += sec("状态流转", `<div class="mermaid-wrap" id="mmd-state"></div>`); mmds.push(['mmd-state', d.stateMachine]); }
  if (d.dataChanges?.length) h += sec("阶段数据变动", dataChangeBlocks(d.dataChanges));

  if (d.bizRules?.length) {
    h += sec("关键业务规则", `<div class="keyimpl-list">${d.bizRules.map(k =>
      `<div class="keyimpl-item"><div class="ki-title">${esc(k.title)}</div><div class="ki-desc">${esc(k.desc)}</div></div>`
    ).join('')}</div>`);
  }

  if (d.validations?.length) h += sec("校验规则", simpleTable([
    { key: 'stage', label: '阶段' },
    { key: 'rule', label: '校验项' },
    { key: 'failure', label: '失败提示/行为' },
    { key: 'check', label: '测试核对点' }
  ], d.validations));

  if (d.testPoints?.length) {
    h += sec("测试关注点", `<ul class="checklist">${d.testPoints.map(t => `<li>${esc(t)}</li>`).join('')}</ul>`);
  }

  if (d.dataObjects?.length) h += sec("涉及数据对象", simpleTable([
    { key: 'name', label: '对象/表' },
    { key: 'phase', label: '阶段' },
    { key: 'action', label: '操作' },
    { key: 'note', label: '关键字段/说明' }
  ], d.dataObjects));

  h += '</div>';
  document.getElementById("main").innerHTML = h;
  addToc();
  mmds.forEach(([id, code]) => renderMermaid(document.getElementById(id), code));
}

// ─── 接口索引（聚合所有记录的 apis 字段，单独展示）────────────────────────────
function showApis() {
  sel = -2; renderSidebar(); closeSidebar(); resetMainScroll();
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
            <td>${a.operationId ? `<code class="api-url">${esc(a.operationId)}</code><br>` : ''}${esc(a.desc || '')}${detail}</td>
            <td style="width:220px"><button type="button" class="idx-title" onclick="pick(${i})">${esc(c.title)}</button><div>${apiSpecLink({ apiSpecPath: a.specPath || c.apiSpecPath }, 'YAML')} ${apiIndexLink(c, '索引')}</div></td>
            <td style="width:90px" class="idx-date">${esc(c.date || '')}</td>
          </tr>`);
        });
        if ((!c.apis || !c.apis.length) && c.apiSpecPath) {
          total++;
          rows.push(`<tr>
            <td style="width:72px"><span class="method m-GET">YAML</span></td>
            <td><code class="api-url">${esc(c.apiSpecPath)}</code></td>
            <td>OpenAPI 规范文件已生成，但看板 entry 未登记具体接口；请回填 apis[] 以完善接口索引。</td>
            <td style="width:220px"><button type="button" class="idx-title" onclick="pick(${i})">${esc(c.title)}</button><div>${apiSpecLink(c, 'YAML')} ${apiIndexLink(c, '索引')}</div></td>
            <td style="width:90px" class="idx-date">${esc(c.date || '')}</td>
          </tr>`);
        }
      });
      if (!rows.length) return '';
      return `<div class="idx-mod">
        <div class="idx-mod-title">📁 ${esc(mod)}</div>
        <table class="api-table">
          <thead><tr><th>方法</th><th>路径</th><th>operationId / 说明 / 报文</th><th>来源文档</th><th>日期</th></tr></thead>
          <tbody>${rows.join('')}</tbody>
        </table>
      </div>`;
    }).filter(Boolean).join('');
    if (!modsHtml) return '';
    return `<div class="idx-svc"><div class="idx-svc-title">📦 ${esc(svc)}</div>${modsHtml}</div>`;
  }).filter(Boolean).join('');

  if (!total) body = `<div class="sb-empty" style="padding:60px 0">暂无接口记录（仅当任务新增或变更接口时才会登记）</div>`;
  document.getElementById("main").innerHTML = `<div class="doc-view">
    <div class="home-kicker">API DIRECTORY</div><h1 class="doc-h1">接口索引</h1>
    <p class="doc-intro">当前范围：${SCOPE_LABEL[scopeF]}，共 ${total} 个接口变更，点击来源文档查看上下文。仅登记新增或参数有变动的接口。</p>
    ${filterBar()}
    ${body}
  </div>`;
}

// ─── Changelog view ──────────────────────────────────────────────────────────
function showLog() {
  sel = -1; renderSidebar(); closeSidebar(); resetMainScroll();
  const items = [...htmlChangelog].reverse().map(e => `
    <div class="tl-item">
      <div class="tl-left"><div class="tl-dot"></div><div class="tl-line"></div></div>
      <div class="tl-right">
        <div class="tl-date">${esc(e.date)}</div>
        <div class="tl-desc">${esc(e.desc)}</div>
      </div>
    </div>`).join('');
  document.getElementById("main").innerHTML = `<div class="doc-view">
    <div class="home-kicker">CHANGELOG</div><h1 class="doc-h1">看板变更日志</h1>
    <p class="doc-intro">回看这个工作空间的演进。</p>
    <div class="timeline">${items}</div>
  </div>`;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function sec(title, body) {
  return `<section class="sec"><h2 class="sec-title">${title}</h2>${body}</section>`;
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

// 搜索快捷键避开输入控件；移动端导航采用展开布局，不遮挡正文。
if (document.addEventListener) document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && document.getElementById('diagram-overlay')) { closeDiagram(); return; }
  if (event.key === 'Escape' && document.body.classList.contains('nav-open')) {
    closeSidebar();
    document.getElementById('menu-toggle')?.focus();
  }
  const target = event.target;
  if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey &&
      !/INPUT|TEXTAREA|SELECT/.test(target.tagName) && !target.isContentEditable) {
    const input = document.getElementById('q');
    if (input) { event.preventDefault(); input.focus(); }
  }
});
