/* AI 变更记录看板 — 渲染与交互逻辑
 * 数据在 data/changes.js（由 /dev-doc、/bug-fix、/code-reading、/biz-flow 自动追加；/review-fix 仅在修复交接阶段追加，本文件不存数据）
 * 与 skills/dev-doc/assets/board/js/board.js 保持一致，修改时两处同步 */

// 外壳版本号：skill 检测到模板版本更高时自动覆盖外壳文件（index.html / css / js / build.js，不动 data/）。
// 改动外壳行为时 +1。
const BOARD_VERSION = 17;

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
// 一句话导语：取主叙述字段的第一句，让人不点开也能扫读这条记录在讲什么。
// 确定性提取（Rule 5），不依赖 skill 额外撰写字段。
function leadOf(c) {
  const raw = c.kind === 'bug' ? (c.symptom || c.rootCause || c.impact)
    : c.kind === 'reading' ? (c.entry || c.background || c.solution)
    : c.kind === 'biz' ? (c.background || c.solution)
    : (c.background || c.solution || c.coreDesign);
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
  const goals = firstItems(d.goals, 2);
  if (goals.length) rows.push(['目标', goals.join('；')]);
  if (d.solution) rows.push(['方案', shortText(d.solution)]);
  const impl = firstItems(d.keyImpl, 2).map(x => x.title || x.desc).filter(Boolean);
  if (impl.length) rows.push(['关键实现', impl.join('；')]);
  const todos = firstItems(d.todos, 2);
  if (todos.length) rows.push(['下一步', todos.join('；')]);
  return rows;
}
function nextAction(d) {
  if (d.kind === 'bug') return effStatus(d) === '已验证' ? '已验证：可沉淀复盘或关闭记录' : '建议先确认根因，再按验证步骤回归';
  if (d.kind === 'biz') return '建议测试先按业务流转图设计主流程，再补异常、边界、并发用例';
  if (d.kind === 'reading') return '建议 Review 先沿调用链读主路径，再核对状态流转和关键位置';
  if (DONE.has(effStatus(d))) return '已完成：可从源文档或独立页面复盘方案';
  return '建议 AI 执行前先核对目标、范围、代码变更清单和验收方式';
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
function executionBrief(d) {
  const lanes = [];
  const listText = items => items.filter(Boolean).slice(0, 3).map(x => `<li>${esc(x)}</li>`).join('');
  if (d.kind === 'bug') {
    const loc = d.codeLocation ? [shortText(d.codeLocation, 120)] : [];
    const work = firstItems(d.todos, 3);
    const verify = firstItems(d.verifySteps, 3);
    if (loc.length) lanes.push(['先定位', loc]);
    if (work.length) lanes.push(['再修复', work]);
    if (verify.length) lanes.push(['最后验证', verify]);
  } else if (d.kind === 'biz') {
    const api = (d.apis || []).map(a => `${a.method || ''} ${a.url || ''}：${a.desc || ''}`.trim()).slice(0, 3);
    const stages = firstItems(d.dataChanges, 3).map(x => `${x.stage || x.title || '阶段'}：${x.summary || firstItems(x.operations, 1).map(op => `${op.action || ''} ${op.target || ''}`.trim())[0] || ''}`).filter(Boolean);
    const rules = firstItems(d.bizRules, 3).map(x => x.title ? `${x.title}：${x.desc || ''}` : x.desc).filter(Boolean);
    const tests = firstItems(d.testPoints, 3);
    if (api.length) lanes.push(['接口顺序', api]);
    if (stages.length) lanes.push(['数据变动', stages]);
    else if (rules.length) lanes.push(['业务规则', rules]);
    if (tests.length) lanes.push(['测试落点', tests]);
  } else if (d.kind !== 'reading') {
    const files = firstItems(d.changeList, 3).map(x => `${x.action || '修改'} ${x.file || ''}：${x.desc || ''}`.trim()).filter(Boolean);
    const todos = firstItems(d.todos, 3);
    const goals = firstItems(d.goals, 3);
    if (files.length) lanes.push(['改动位置', files]);
    if (todos.length) lanes.push(['执行任务', todos]);
    if (goals.length) lanes.push(['验收目标', goals]);
  }
  if (!lanes.length) return '';
  return `<div class="exec-brief">
    <div class="exec-title">执行口径</div>
    <div class="exec-grid">${lanes.map(([title, items]) => `
      <div class="exec-lane">
        <div class="exec-lane-title">${esc(title)}</div>
        <ul>${listText(items)}</ul>
      </div>`).join('')}</div>
  </div>`;
}
function roleHint(d, role) {
  if (role === 'biz') {
    if (d.kind === 'bug') return shortText(d.impact || d.symptom || d.rootCause || leadOf(d), 118);
    if (d.kind === 'biz') return shortText(d.background || firstItems(d.testPoints, 1)[0] || leadOf(d), 118);
    if (d.kind === 'reading') return shortText(d.background || d.entry || leadOf(d), 118);
    return shortText(d.background || firstItems(d.goals, 1)[0] || d.solution || leadOf(d), 118);
  }
  if (d.kind === 'bug') return shortText(d.codeLocation || d.fixPlan || firstItems(d.verifySteps, 1)[0] || leadOf(d), 118);
  if (d.kind === 'biz') return shortText(firstItems(d.testPoints, 1)[0] || firstItems(d.bizRules, 1).map(x => x.desc || x.title)[0] || leadOf(d), 118);
  if (d.kind === 'reading') return shortText(firstItems(d.keyImpl, 1).map(x => `${x.title || ''} ${x.desc || ''}`.trim())[0] || d.entry || leadOf(d), 118);
  return shortText(firstItems(d.todos, 1)[0] || firstItems(d.changeList, 1).map(x => `${x.file || ''} ${x.desc || ''}`.trim())[0] || d.solution || leadOf(d), 118);
}
function roleBoard(title, subtitle, ids, role, emptyText) {
  const rows = ids.slice(0, 4).map(i => {
    const c = changes[i], st = effStatus(c);
    return `<div class="role-row" onclick="pick(${i})">
      <div class="role-main">
        <div class="role-title"><span>${icoOf(c)}</span>${esc(c.title)}</div>
        <div class="role-desc">${esc(roleHint(c, role) || '暂无摘要')}</div>
      </div>
      <div class="role-side">
        <span class="role-path">${esc(svcOf(c))}/${esc(modOf(c))}</span>
        <span class="idx-status"><span class="sdot" style="background:${statusColor(st)}"></span>${esc(st)}</span>
      </div>
    </div>`;
  }).join('');
  return `<section class="role-card ${role === 'biz' ? 'role-biz' : 'role-dev'}">
    <div class="role-head">
      <div><div class="role-kicker">${role === 'biz' ? 'BUSINESS VIEW' : 'ENGINEERING VIEW'}</div><div class="role-h">${esc(title)}</div></div>
      <div class="role-sub">${esc(subtitle)}</div>
    </div>
    ${rows || `<div class="role-empty">${esc(emptyText)}</div>`}
  </section>`;
}
function fieldList(items) {
  return items.filter(x => x && x.value).map(x => `
    <div class="aud-item">
      <div class="aud-k">${esc(x.key)}</div>
      <div class="aud-v">${esc(x.value)}</div>
    </div>`).join('');
}
function audienceBrief(d) {
  const business = [];
  const developer = [];
  if (d.kind === 'bug') {
    business.push({ key: '业务影响', value: shortText(d.impact || d.symptom || '待补充', 140) });
    business.push({ key: '期望结果', value: shortText(d.expected || '恢复预期业务行为', 120) });
    business.push({ key: '验收方式', value: shortText(firstItems(d.verifySteps, 1)[0] || '按验证步骤回归', 120) });
    developer.push({ key: '定位线索', value: shortText(d.codeLocation || d.rootCause || '待分析', 140) });
    developer.push({ key: '修复方向', value: shortText(d.fixPlan || '待补充', 140) });
    developer.push({ key: '执行任务', value: shortText(firstItems(d.todos, 2).join('；') || '按修复方案补齐 Todo', 140) });
  } else if (d.kind === 'biz') {
    business.push({ key: '业务主线', value: shortText(d.background || '待补充', 150) });
    business.push({ key: '参与角色', value: shortText(firstItems(d.roles, 2).map(x => x.name || x.role || x.actor).filter(Boolean).join('；') || '待补充', 140) });
    business.push({ key: '业务规则', value: shortText(firstItems(d.bizRules, 2).map(x => x.title || x.desc).join('；') || '待补充', 140) });
    developer.push({ key: '接口链路', value: shortText((d.apis || []).slice(0, 3).map(a => `${a.method || ''} ${a.url || ''}`.trim()).join(' → ') || '待补充', 140) });
    developer.push({ key: '数据/状态', value: d.dataChanges?.length ? `查看 ${d.dataChanges.length} 个阶段的数据变动` : d.dataFlow ? '查看数据流图' : d.stateMachine ? '查看状态流转图' : '待补充' });
    developer.push({ key: '联调关注', value: shortText(firstItems(d.testPoints, 1)[0] || '按测试关注点联调验证', 130) });
  } else if (d.kind === 'reading') {
    business.push({ key: '整体说明', value: shortText(d.background || d.entry || '待补充', 150) });
    business.push({ key: '当前状态', value: '用于 Review 前理解，不直接代表变更完成' });
    developer.push({ key: '追踪入口', value: shortText(d.entry || '待补充', 140) });
    developer.push({ key: '先看位置', value: shortText(firstItems(d.keyImpl, 2).map(x => x.title || x.desc).join('；') || '待补充', 140) });
    developer.push({ key: '阅读方式', value: '沿调用链读主路径，再核对状态和关键变量' });
  } else {
    business.push({ key: '为什么做', value: shortText(d.background || firstItems(d.goals, 1)[0] || '待补充', 150) });
    business.push({ key: '业务目标', value: shortText(firstItems(d.goals, 2).join('；') || '待补充', 140) });
    business.push({ key: '不包含', value: shortText(firstItems(d.scopeOut, 2).join('；') || '未特别排除', 120) });
    developer.push({ key: '实现方案', value: shortText(d.solution || d.coreDesign || '待补充', 150) });
    developer.push({ key: '改动位置', value: shortText(firstItems(d.changeList, 2).map(x => `${x.file || ''} ${x.desc || ''}`.trim()).join('；') || '待补充', 150) });
    developer.push({ key: '下一步', value: shortText(firstItems(d.todos, 2).join('；') || '待补充', 140) });
  }
  return `<div class="audience-grid">
    <section class="aud-card aud-biz">
      <div class="aud-head"><span>业务人员看这里</span><em>影响 / 目标 / 验收</em></div>
      ${fieldList(business)}
    </section>
    <section class="aud-card aud-dev">
      <div class="aud-head"><span>开发人员看这里</span><em>方案 / 文件 / 执行</em></div>
      ${fieldList(developer)}
    </section>
  </div>`;
}
let q = '', kindF = 'all', openOnly = false;
// 搜索语料：覆盖各类条目的叙述字段，避免内容只在 solution/fixPlan/testPoints 时搜不到。
function searchHay(c) {
  const parts = [c.title, c.service, c.module, c.type,
    c.background, c.solution, c.coreDesign,            // doc
    c.symptom, c.trigger, c.impact, c.rootCause, c.fixPlan, c.codeLocation,  // bug
    c.entry];                                          // reading
  const push = arr => { if (Array.isArray(arr)) arr.forEach(x => parts.push(typeof x === 'string' ? x : JSON.stringify(x || {}))); };
  push(c.goals); push(c.scopeIn); push(c.scopeOut); push(c.testPoints);
  push(c.bizRules); push(c.keyImpl); push(c.todos);
  push(c.roles); push(c.context); push(c.dataChanges); push(c.validations); push(c.dataObjects);
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
              return `<div class="doc-item ${sel === i ? 'active' : ''} ${isBug ? 'bug' : ''}" onclick="pick(${i})" title="${esc(leadOf(c) || c.title)}">
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
  const totalCnt = visible.length;
  const doneCnt = totalCnt - openCnt;
  const pct = totalCnt ? Math.round(doneCnt / totalCnt * 100) : 0;
  const sortedVisible = [...visible].sort((a, b) => (changes[b].date || '').localeCompare(changes[a].date || ''));
  const businessIds = sortedVisible.filter(i => {
    const c = changes[i];
    return c.kind === 'biz' || c.kind === 'bug' || c.background || c.goals?.length;
  });
  const devIds = sortedVisible.filter(i => {
    const c = changes[i];
    return !DONE.has(effStatus(c)) || c.todos?.length || c.changeList?.length || c.keyImpl?.length || c.kind === 'reading';
  });

  let h = `<div class="doc-view">
    <div class="home-hero">
      <div>
        <div class="home-kicker">AI WORK RECORDS</div>
        <h1 class="doc-h1">业务和研发共读的变更看板</h1>
        <p class="doc-intro">业务人员先看影响、状态和测试重点；开发人员再看实现范围、代码位置和下一步动作。每条记录都能回到源文档，也能生成独立页面单独分享。</p>
      </div>
      <div class="home-health">
        <div class="health-num">${pct}%</div>
        <div class="health-label">整体完成度</div>
        <div class="health-sub">${doneCnt} / ${totalCnt} 已完成</div>
      </div>
    </div>
    <div class="home-stats">
      <div class="stat-card sc-accent"><div class="stat-num">${docCnt}</div><div class="stat-lbl">📄 开发文档</div></div>
      <div class="stat-card sc-red"><div class="stat-num">${bugCnt}</div><div class="stat-lbl">🐛 Bug 记录</div></div>
      ${readCnt ? `<div class="stat-card sc-purple"><div class="stat-num">${readCnt}</div><div class="stat-lbl">📖 代码阅读</div></div>` : ''}
      ${bizCnt ? `<div class="stat-card sc-teal"><div class="stat-num">${bizCnt}</div><div class="stat-lbl">🔀 业务流</div></div>` : ''}
      <div class="stat-card sc-amber"><div class="stat-num">${openCnt}</div><div class="stat-lbl">⏳ 未完成</div></div>
      <div class="stat-card sc-blue"><div class="stat-num">${svcCnt}</div><div class="stat-lbl">📦 微服务</div></div>
    </div>
    <div class="progress-wrap">
      <div class="progress-hd"><span>整体完成度</span><span class="progress-pct">${doneCnt} / ${totalCnt} 已完成 · ${pct}%</span></div>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
    </div>
    <div class="role-grid">
      ${roleBoard('业务人员先看', '影响范围、业务规则、测试重点、当前状态', businessIds, 'biz', '暂无业务视角记录')}
      ${roleBoard('开发人员再看', '实现范围、代码位置、待办、验证命令', devIds, 'dev', '暂无开发视角记录')}
    </div>
    <div class="reader-guide">
      <div class="guide-card"><div class="guide-title">业务读法</div><div class="guide-text">先看标题、读者速览和业务视角，确认为什么改、影响谁、怎么验收。</div></div>
      <div class="guide-card"><div class="guide-title">研发读法</div><div class="guide-text">再看开发视角、执行口径、代码变更和 Todo，确认改哪里、怎么改、如何验证。</div></div>
      <div class="guide-card"><div class="guide-title">交接读法</div><div class="guide-text">需要同步给同事或测试时，打开独立页面；需要落地时，打开源文档。</div></div>
    </div>`;

  const recent = sortedVisible.slice(0, 8);
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
          const lead = leadOf(c);
          return `<tr class="${DONE.has(st) ? '' : 'idx-open'}">
            <td style="width:20px">${icoOf(c)}</td>
            <td><span class="idx-title" onclick="pick(${i})">${esc(c.title)}</span>${lead ? `<div class="idx-lead">${esc(lead)}</div>` : ''}</td>
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
    mermaid.run({ nodes: [div] }).catch(() => {
      wrap.innerHTML = `<pre class="flowchart-fallback">${esc(code)}</pre>`;
    });
  } else {
    wrap.innerHTML = `<pre class="flowchart-fallback">${esc(code)}</pre>`;
  }
}

// 详情页导读：渲染完成后扫描页面里的小标题，生成可点击章节导航（章节≥3 才显示）。
// 对 pick / renderBug / renderBiz 统一生效，自包含单页同样适用。
function addToc() {
  const view = document.querySelector('#main .doc-view');
  if (!view) return;
  const titles = Array.prototype.slice.call(view.querySelectorAll('.sec-title'));
  if (titles.length < 3) return;
  const chips = titles.map((t, i) => {
    const id = 'sec-' + i;
    if (t.parentElement) t.parentElement.id = id;
    return `<a class="toc-chip" href="#${id}" onclick="event.preventDefault();var e=document.getElementById('${id}');if(e)e.scrollIntoView({behavior:'smooth',block:'start'})">${esc(t.textContent.trim())}</a>`;
  }).join('');
  const nav = document.createElement('nav');
  nav.className = 'doc-toc';
  nav.innerHTML = `<span class="toc-lbl">本页导读</span>${chips}`;
  const meta = view.querySelector('.doc-meta');
  if (meta) meta.after(nav); else view.prepend(nav);
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
    ${leadOf(d) ? `<p class="doc-lead">${esc(leadOf(d))}</p>` : ''}
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
  h += quickBrief(d, isReading ? "代码阅读速览" : "读者速览");
  h += audienceBrief(d);
  h += executionBrief(d);

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
  addToc();

  if (d.flowchart) renderMermaid(document.getElementById("mmd-wrap"), d.flowchart);
}

// ─── Bug view ─────────────────────────────────────────────────────────────────
function renderBug(d) {
  const sev = d.severity || 'P2';
  const st = effStatus(d);
  let h = `<div class="doc-view">
    <div class="breadcrumb"><span>🐛 Bug</span><span class="bc-sep">/</span><span>📦 ${esc(svcOf(d))}</span><span class="bc-sep">/</span><span>📁 ${esc(modOf(d))}</span><span class="bc-sep">/</span><span>${esc(d.title)}</span></div>
    <h1 class="doc-h1">${esc(d.title)}</h1>
    ${leadOf(d) ? `<p class="doc-lead">${esc(leadOf(d))}</p>` : ''}
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
  h += quickBrief(d, "Bug 速览");
  h += audienceBrief(d);
  h += executionBrief(d);

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
  addToc();
}

// ─── 业务流 view（kind:"biz"，由 /biz-flow 追加，面向测试人员）──────────────────
function renderBiz(d) {
  const st = effStatus(d);
  let h = `<div class="doc-view">
    <div class="breadcrumb"><span>🔀 业务流</span><span class="bc-sep">/</span><span>📦 ${esc(svcOf(d))}</span><span class="bc-sep">/</span><span>📁 ${esc(modOf(d))}</span><span class="bc-sep">/</span><span>${esc(d.title)}</span></div>
    <h1 class="doc-h1">${esc(d.title)}</h1>
    ${leadOf(d) ? `<p class="doc-lead">${esc(leadOf(d))}</p>` : ''}
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
  h += quickBrief(d, "测试速览");
  h += audienceBrief(d);
  h += executionBrief(d);

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
