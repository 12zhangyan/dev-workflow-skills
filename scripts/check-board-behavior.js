#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const vm = require('vm');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(ROOT, 'project-html/js/board.js'), 'utf8');
assert(!source.includes('function audienceBrief') && !source.includes('function solutionBrief'), 'obsolete duplicate-summary renderers should be removed from the board shell');
assert(source.includes('function activateKey') && source.includes('aria-expanded="${modOpen}"'), 'board navigation should expose keyboard activation and expanded state');
assert(source.includes('<button type="button" class="doc-item'), 'document navigation entries should use semantic buttons');
const elements = new Map();

function element(id) {
  if (!elements.has(id)) {
    elements.set(id, {
      id,
      innerHTML: '',
      textContent: '',
      className: '',
      classList: { toggle() {} }
    });
  }
  return elements.get(id);
}

const localDate = (date = new Date()) => [date.getFullYear(), date.getMonth() + 1, date.getDate()].map((n, i) => String(n).padStart(i ? 2 : 4, '0')).join('-');
const today = localDate();
const recent = Array.from({ length: 40 }, (_, i) => ({
  service: 'svc', module: 'mod', title: `recent-${i}`, date: today,
  type: '新功能', status: '进行中', background: `recent item ${i}`
}));
const oldOpen = { service: 'svc', module: 'old', title: 'old-open', date: '2000-01-01', status: '进行中' };
const oldDone = { service: 'svc', module: 'old', title: 'old-done', date: '2000-01-01', status: '已完成' };
const forced = { service: 'svc', module: 'old', title: 'forced', date: '2000-01-01', status: '已完成', lifecycle: 'active' };
const pinned = { service: 'svc', module: 'old', title: 'pinned', date: '2000-01-01', status: '已完成', pinned: true };
const invalidDate = { service: 'svc', module: 'old', title: 'invalid', date: 'not-a-date', status: '已完成' };

const context = {
  changes: [...recent, oldOpen, oldDone, forced, pinned, invalidDate],
  htmlChangelog: [],
  console,
  localStorage: { getItem() { return null; }, setItem() {} },
  document: {
    getElementById: element,
    querySelectorAll() { return []; }
  }
};
vm.createContext(context);
vm.runInContext(source, context, { filename: 'board.js' });

let prevented = 0;
assert(context.activateKey({ key: 'Enter', preventDefault() { prevented++; } }) === true, 'Enter should activate custom keyboard targets');
assert(context.activateKey({ key: ' ', preventDefault() { prevented++; } }) === true, 'Space should activate custom keyboard targets');
assert(context.activateKey({ key: 'Escape', preventDefault() { prevented++; } }) === false, 'unrelated keys should not activate custom keyboard targets');
assert(prevented === 2, 'keyboard activation should prevent default only for Enter and Space');

function assert(ok, message) {
  if (!ok) {
    console.error('x ' + message);
    process.exit(1);
  }
}

assert(context.methodClass('GET" onclick="alert(1)') === 'm-GETONCLICKALERT', 'API method class must keep only letters');
assert(!context.apiTable([{ method: 'POST" onmouseover="x', url: '/orders' }]).includes('onmouseover="'), 'API method must not inject attributes into the table markup');
assert(context.apiTable([{ method: 'post', url: '/orders' }]).includes('class="method m-POST"'), 'ordinary API methods must keep their style class');
assert(context.scopeOf(oldOpen) === 'backlog', 'old unfinished entry should enter backlog');
assert(context.scopeOf(oldDone) === 'archive', 'old completed entry should enter archive');
assert(context.scopeOf(forced) === 'workspace', 'lifecycle=active should override automatic archive');
assert(context.scopeOf(pinned) === 'workspace', 'pinned entry should stay in workspace');
assert(context.scopeOf(invalidDate) === 'workspace', 'invalid date should fail safe into workspace');

const main = element('main');
const sidebar = element('sb');
assert((main.innerHTML.match(/class="idx-title"/g) || []).length === 30, 'home should render at most 30 index rows initially');
assert((sidebar.innerHTML.match(/class="doc-item/g) || []).length === 23, 'sidebar should cap each module at 20 rows while retaining smaller modules');
assert(sidebar.innerHTML.includes('tree-more'), 'sidebar should expose a load-more control for capped modules');

context.showMoreHome();
assert((main.innerHTML.match(/class="idx-title"/g) || []).length === 43, 'home load-more should reveal the remaining workspace rows');


// The workspace keeps search/scope state while recovering from empty results and sorting updates.
const uiElements = new Map();
const uiElement = id => {
  if (!uiElements.has(id)) uiElements.set(id, { innerHTML: '', textContent: '', value: '', classList: { toggle() {} } });
  return uiElements.get(id);
};
const uiContext = {
  changes: [
    { title: 'Alpha', date: '2026-01-01', updatedAt: '2026-09-30', status: '进行中', lifecycle: 'active' },
    { title: 'Beta', date: '2026-08-01', updatedAt: '2026-08-02', status: '已完成', lifecycle: 'active' },
    { title: 'Backlog', date: '2020-01-01', status: '草稿', lifecycle: 'backlog' }
  ],
  htmlChangelog: [], console,
  localStorage: { getItem() { return null; }, setItem() {} },
  document: { getElementById: uiElement, querySelectorAll() { return []; } }
};
vm.createContext(uiContext);
vm.runInContext(source, uiContext, { filename: 'board-workspace.js' });
const rowTitles = () => Array.from(uiElement('main').innerHTML.matchAll(/class="idx-title"[^>]*>([^<]+)</g), match => match[1]);
assert(rowTitles().join(',') === 'Alpha,Beta', 'default sorting should honor updatedAt over creation date');
uiContext.setSort('oldest');
assert(rowTitles().join(',') === 'Beta,Alpha', 'oldest sorting should reverse update order');
uiContext.toggleOpen();
assert(rowTitles().join(',') === 'Alpha', 'unfinished filter should exclude completed entries');
uiContext.setScope('backlog');
uiContext.onSearch('missing-workspace-record');
assert(uiElement('main').innerHTML.includes('清除筛选'), 'empty search should expose a recovery action');
uiContext.resetFilters();
assert(rowTitles().join(',') === 'Backlog', 'clearing search should retain the selected scope');
assert(uiElement('q').value === '', 'clearing filters should also clear the visible search input');
uiContext.setScope('all');
uiContext.setSort('title');
assert(rowTitles().join(',') === 'Alpha,Backlog,Beta', 'title sorting should order all scoped results');
assert(!uiElement('main').innerHTML.includes('role-grid'), 'home should present one primary record list without duplicate overview lists');

const indexHtml = fs.readFileSync(path.join(ROOT, 'project-html/index.html'), 'utf8');
for (const scope of ['workspace', 'backlog', 'archive', 'all']) {
  assert(indexHtml.includes(`data-scope="${scope}"`), `index should expose ${scope} scope filter`);
}
assert(indexHtml.includes('<button type="button" class="fpill"'), 'scope and kind filters should use semantic buttons');
assert(indexHtml.includes('<button type="button" class="log-btn"'), 'footer navigation should use semantic buttons');

const boardCss = fs.readFileSync(path.join(ROOT, 'project-html/css/board.css'), 'utf8');
for (const marker of ['@media (max-width: 840px)', 'body { display: block; min-height: 100vh; overflow: auto; }', '.sidebar-footer { display: grid;', '[role="button"]:focus-visible', '.nav-open .sidebar', '@media (prefers-reduced-motion: reduce)', '.delivery-overview {', '.review-timeline {']) {
  assert(boardCss.includes(marker), `board CSS should include responsive/accessibility marker: ${marker}`);
}
assert(indexHtml.includes('研发变更档案馆') && indexHtml.includes('ONE CHANGE · ONE STORY'), 'formal board shell should retain the dossier identity');

assert(indexHtml.includes('aria-label="搜索当前范围的记录"'), 'search should have an explicit accessible name');
assert(indexHtml.includes('aria-controls="sidebar"') && indexHtml.includes('id="menu-toggle"'), 'mobile navigation should expose its controlled region');
assert(!indexHtml.includes('fonts.googleapis.com'), 'board typography should work without an external font request');

const buildJs = fs.readFileSync(path.join(ROOT, 'project-html/build.js'), 'utf8');
assert(buildJs.includes('window.DETAIL_PAGE = true'), 'regular detail pages should use shared-resource mode');
assert(buildJs.includes("process.argv[2] === '--standalone'"), 'build should support explicit standalone export');
assert(buildJs.includes('hydratedEntry(catalog)'), 'build should merge catalog and human detail before generating a page');
assert(!/for \(const f of oldPages\) \{\s*fs\.unlinkSync/.test(buildJs), 'build should not unconditionally delete all detail pages');
const boardVersion = source.match(/const BOARD_VERSION = (\d+)/)[1];
for (const shell of [indexHtml, buildJs]) {
  assert(shell.includes('board.css?v=' + boardVersion) && shell.includes('board.js?v=' + boardVersion), 'index and generated pages should invalidate stale shell resources together');
}
assert(source.includes('detailLoads') && source.includes('loadDetail'), 'board should lazily load human detail after selection');

// 首页只用 catalog；pick 后才执行对应 detail sidecar。
const liveDataSource = fs.readFileSync(path.join(ROOT, 'project-html/data/changes.js'), 'utf8');
const liveChanges = new Function(liveDataSource + ';return changes')();
const lazyElements = new Map();
const lazyElement = id => {
  if (!lazyElements.has(id)) lazyElements.set(id, { id, innerHTML: '', textContent: '', className: '', classList: { toggle() {} }, appendChild() {} });
  return lazyElements.get(id);
};
let detailScriptsLoaded = 0;
const lazyContext = {
  changes: liveChanges,
  htmlChangelog: [],
  console,
  localStorage: { getItem() { return null; }, setItem() {} },
  document: {
    getElementById: lazyElement,
    querySelectorAll() { return []; },
    querySelector() { return null; },
    createElement() { return { className: '', textContent: '', innerHTML: '' }; },
    head: { appendChild(script) {
      detailScriptsLoaded++;
      const detailSource = fs.readFileSync(path.join(ROOT, 'project-html', script.src), 'utf8');
      vm.runInContext(detailSource, lazyContext, { filename: script.src });
      script.onload();
    } }
  }
};
lazyContext.window = lazyContext;
vm.createContext(lazyContext);
vm.runInContext(source, lazyContext, { filename: 'board-lazy.js' });
assert(detailScriptsLoaded === 0, 'home should not load any human detail sidecar');
lazyContext.pick(0);
assert(detailScriptsLoaded === 1, 'selecting one entry should load exactly one detail sidecar');
assert(!lazyElement('main').innerHTML.includes('详情加载中'), 'selected detail should replace the loading state');
for (const marker of ['研发变更档案', 'delivery-progress', '01 · 开发方案', '02 · Review 摘要', '03 · 验证证据', '04 · 下一步']) {
  assert(lazyElement('main').innerHTML.includes(marker), `human detail should expose lifecycle marker: ${marker}`);
}
assert(!lazyElement('main').innerHTML.includes('audience-grid'), 'human detail should not duplicate the plan in role-based summary cards');
assert(!lazyElement('main').innerHTML.includes('exec-brief'), 'human detail should not duplicate the plan in execution summary cards');

const devElements = new Map();
const devElement = id => {
  if (!devElements.has(id)) devElements.set(id, { id, innerHTML: '', textContent: '', className: '', classList: { toggle() {} } });
  return devElements.get(id);
};
const devContext = {
  changes: [{
    service: 'order', module: 'callback', title: 'callback repair', date: today, status: '草稿',
    goals: ['阻止关闭订单被过期回调覆盖'],
    dataFlowSummary: '回调入口 → 签名校验 → 订单状态判断 → 条件更新 → 返回处理结果',
    solution: '在状态转换前增加关闭态保护，并保留合法重试的幂等处理。',
    coreDesign: '只收紧关闭态更新边界，不改变回调契约。',
    acceptance: ['关闭订单保持关闭', '合法重试仍可幂等成功']
  }],
  htmlChangelog: [], console,
  localStorage: { getItem() { return null; }, setItem() {} },
  document: {
    getElementById: devElement,
    querySelector() { return null; },
    querySelectorAll() { return []; }
  }
};
vm.createContext(devContext);
vm.runInContext(source, devContext, { filename: 'board-developer-brief.js' });
devContext.pick(0);
const devHtml = devElement('main').innerHTML;
for (const label of ['开发方案', '完整开发方案', '实现方式', '数据流转', '关键边界与取舍', '验收与回归']) {
  assert(devHtml.includes(label), `developer detail should expose ${label}`);
}
for (const label of ['class="sub-label">实现方式', 'class="sub-label">数据流转', 'class="sub-label">关键边界与取舍']) {
  assert(devHtml.includes(label), `technical solution should separate ${label}`);
}

devContext.renderDelivery({
  deliveryId: 'DLV-REVIEW',
  service: 'order',
  module: 'callback',
  title: 'callback review lifecycle',
  date: today,
  status: '进行中',
  currentGate: 'review',
  gateStatus: 'blocked',
  reviewState: 'findings',
  delivery: {
    plan: { status: 'passed', summary: 'protect callback state', background: 'callback state needs a boundary' },
    implementation: { status: 'passed' },
    verification: { status: 'passed', summary: 'targeted tests passed' },
    review: {
      status: 'findings',
      events: [{
        eventId: 'check:callback:1',
        mode: 'check',
        date: today,
        title: 'read-only review',
        summary: 'one important issue remains',
        gateStatus: 'blocked',
        findings: [{ id: 'IM-1', status: 'open', problem: 'cleanup is missing' }]
      }]
    }
  }
});
const lifecycleHtml = devElement('main').innerHTML;
assert((lifecycleHtml.match(/class="delivery-step /g) || []).length === 5, 'delivery detail should render all five lifecycle gates');
for (const marker of ['DLV-REVIEW', '1 次审查记录', 'IM-1', 'cleanup is missing', 'targeted tests passed']) {
  assert(lifecycleHtml.includes(marker), `review lifecycle should expose ${marker}`);
}
assert(!lifecycleHtml.includes('confirm-banner'), 'a passed plan should not show the pending-confirmation banner');

devContext.renderDelivery({
  deliveryId: 'DLV-CONFIRM', service: 'order', module: 'query', title: 'status filter', date: today, status: '待确认', currentGate: 'plan',
  delivery: { plan: {
    status: 'NeedsConfirmation', summary: 'filter orders by status', solution: 'add optional statuses',
    scope: ['only the query endpoint'], acceptance: ['unknown status returns 400'],
    openQuestions: ['which status dictionary is authoritative'],
    decisions: ['exact casing is required'], nextAction: 'review the casing rule'
  } }
});
const confirmHtml = devElement('main').innerHTML;
for (const marker of ['confirm-banner', '一页读懂', 'only the query endpoint', 'which status dictionary is authoritative', '1 项需要裁决', 'scope-note', 'exact casing is required', '下一步：review the casing rule']) {
  assert(confirmHtml.includes(marker), `pending plan should expose ${marker}`);
}
assert(!confirmHtml.includes('LEGACY DELIVERY') && !confirmHtml.includes(' GATE'), 'delivery kicker should use reader-facing wording');
assert(buildJs.includes("process.argv.includes('--archive-legacy') ? archiveLegacy() : null"), 'legacy archiving must be explicit');
assert(buildJs.includes('!read(indexFile).includes(INDEX_MARKER)) return false'), 'build must not overwrite a user-owned docs/INDEX.md');

// board-add 更新同一 docPath 时保留省略的治理字段，显式 status 更新生效。
const temp = fs.mkdtempSync(path.join(ROOT, '.tmp-board-behavior-'));
try {
  fs.copyFileSync(path.join(ROOT, 'project-html/board-add.js'), path.join(temp, 'board-add.js'));
  // CLI diagnostics must work before a data directory exists, without a write lock or filesystem mutation.
  const cli = args => spawnSync(process.execPath, [path.join(temp, 'board-add.js'), ...args], { encoding: 'utf8', windowsHide: true });
  for (const arg of ['--help', '-h', 'help']) {
    const result = cli([arg]);
    assert(result.status === 0 && result.stdout.includes('--check-migration') && !result.stderr, 'help aliases must print usage successfully without loading board data');
  }
  for (const args of [[], [''], ['--unknown'], ['-x'], ['--help', 'extra'], ['--migrate', 'extra'], ['--check-migration', 'extra'], ['entry.json', 'extra']]) {
    const result = cli(args);
    assert(result.status !== 0 && result.stderr.includes('BOARD_USAGE_ERROR'), 'invalid arguments must produce a usage error before any file read/write: ' + args.join(' '));
    if (args.length === 1 && args[0]) assert(result.stderr.includes('未知参数'), 'unknown option must be identified as such, not treated as a JSON path');
  }
  assert(fs.readdirSync(temp).join(',') === 'board-add.js', 'help and invalid arguments must not create a data directory, lock or backup');
  fs.mkdirSync(path.join(temp, 'data'));
  fs.copyFileSync(path.join(ROOT, 'skills/yan-dev-doc/assets/board/data/changes.js'), path.join(temp, 'data/changes.js'));
  const input = path.join(temp, 'entry.json');
  const runAdd = (entry, detail) => {
    fs.writeFileSync(input, JSON.stringify(detail ? { entry, detail } : { entry }));
    const result = spawnSync(process.execPath, [path.join(temp, 'board-add.js'), input], { encoding: 'utf8' });
    assert(result.status === 0, `board-add fixture should succeed: ${result.stderr || result.stdout}`);
  };
  runAdd({ title: 'stateful', date: '2020-01-01', docPath: 'docs/stateful.md', status: '草稿', lifecycle: 'archived', pinned: true,
    background: 'human background', solution: 'human solution',
    delivery: { plan: { status: 'passed', summary: 'plan summary', coreDesign: 'bounded plan design' } },
    changeList: [{ file: 'AgentOnly.java' }], todos: ['agent only'] });
  runAdd({ title: 'stateful updated', date: today, docPath: 'docs/stateful.md', status: '进行中',
    background: 'updated human background', solution: 'updated human solution',
    dataFlowSummary: 'request to service to storage to response',
    coreDesign: 'unique state boundary', keyImpl: [{ title: 'idempotent guard', desc: 'protect closed state' }],
    acceptance: ['observable result'],
    stackTrace: 'agent only', codeLocation: 'AgentOnly.java:1' });
  runAdd({
    title: 'stateful updated',
    date: today,
    sourceDocPath: 'docs/stateful.md',
    currentGate: 'review',
    gateStatus: 'blocked',
    reviewState: 'findings',
    reviewCounts: { critical: 0, important: 1, minor: 0, open: 1 }
  }, {
    delivery: {
      review: {
        events: [{
          eventId: 'check:stateful:1',
          mode: 'check',
          conclusion: 'Findings',
          summary: 'one important finding',
          findings: [{ id: 'IM-1', severity: 'Important', status: 'open', problem: 'cleanup is missing' }]
        }]
      }
    }
  });
  runAdd({
    title: 'stateful updated',
    date: today,
    sourceDocPath: 'docs/stateful.md',
    currentGate: 'review',
    gateStatus: 'passed',
    reviewState: 'fixed',
    reviewCounts: { critical: 0, important: 1, minor: 0, open: 0 }
  }, {
    delivery: {
      review: {
        events: [{
          eventId: 'check:stateful:1',
          conclusion: 'NoEvidenceIssue',
          summary: 'important finding closed after recheck',
          findings: [{ id: 'IM-1', severity: 'Important', status: 'fixed', problem: 'cleanup is now guaranteed' }]
        }]
      }
    }
  });
  const dataSource = fs.readFileSync(path.join(temp, 'data/changes.js'), 'utf8');
  const entry = new Function(dataSource + ';return changes[0]')();
  for (const identity of [
    { deliveryId: entry.deliveryId },
    { sourceDocPath: entry.docPath },
    { docPath: entry.docPath }
  ]) {
    runAdd(identity, { delivery: { review: { status: 'verified' } } });
    const updated = new Function(fs.readFileSync(path.join(temp, 'data/changes.js'), 'utf8') + ';return changes[0]')();
    assert(updated.currentGate === 'review', 'identity-only updates must preserve the current gate');
  }
  runAdd({ deliveryId: entry.deliveryId, currentGate: 'verification' });
  const moved = new Function(fs.readFileSync(path.join(temp, 'data/changes.js'), 'utf8') + ';return changes[0]')();
  assert(moved.currentGate === 'verification', 'an explicit gate change must still take effect');
  assert(entry.status === '进行中', 'board-add should apply explicit status and preserve it when later updates omit status');
  assert(entry.lifecycle === 'archived' && entry.pinned === true, 'board-add should preserve omitted lifecycle governance fields');
  assert(entry.updatedAt === today, 'board-add should refresh updatedAt on update');
  assert(entry.deliveryId && entry.currentGate === 'review' && entry.gateStatus === 'passed', 'catalog should expose stable delivery and current gate state');
  assert(entry.reviewCounts.open === 0 && entry.reviewState === 'fixed', 'catalog should expose compact review health');
  assert(entry.detailId && entry.detailPath && entry.summary && entry.searchText, 'catalog should contain detail pointers and a compact search summary');
  assert(entry.summary === 'plan summary', 'updates without an explicit summary must keep the plan summary, not the newest partial narrative: ' + entry.summary);
  assert(entry.searchText.includes('unique state boundary') && entry.searchText.includes('idempotent guard'), 'catalog search text should include developer design decisions');
  for (const key of ['background', 'solution', 'changeList', 'todos', 'stackTrace', 'codeLocation']) {
    assert(!Object.prototype.hasOwnProperty.call(entry, key), `catalog should not contain ${key}`);
  }
  const detailSource = fs.readFileSync(path.join(temp, entry.detailPath), 'utf8');
  const holder = {};
  new Function('window', detailSource)(holder);
  const detail = holder.BOARD_DETAILS[entry.detailId];
  assert(detail.background === 'updated human background' && detail.solution === 'updated human solution', 'detail sidecar should contain independent human narrative');
  assert(detail.dataFlowSummary.includes('service') && detail.acceptance[0] === 'observable result', 'detail sidecar should preserve developer data-flow and acceptance fields');
  assert(detail.delivery.plan.summary === 'plan summary', 'review updates should preserve the original plan lifecycle section');
  assert(detail.delivery.review.events.length === 1, 'same lifecycle eventId should update idempotently instead of appending duplicates');
  assert(detail.delivery.review.events[0].findings[0].status === 'fixed', 'later lifecycle event payload should replace finding state');
  for (const key of ['changeList', 'todos', 'stackTrace', 'codeLocation']) {
    assert(!Object.prototype.hasOwnProperty.call(detail, key), `human detail should not contain Agent-only field ${key}`);
  }

  const legacy = path.join(temp, 'legacy');
  fs.mkdirSync(path.join(legacy, 'data'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'project-html/board-add.js'), path.join(legacy, 'board-add.js'));
  const legacyData = path.join(legacy, 'data/changes.js');
  const legacyEntries = [
    { title: 'legacy', docPath: 'docs/legacy.md', background: 'preserved background', pinned: true, lifecycle: 'archived' },
    { title: 'other', docPath: 'docs/other.md', solution: 'preserved solution' }
  ];
  fs.writeFileSync(legacyData, 'const htmlChangelog=[];\nconst changes=' + JSON.stringify(legacyEntries) + ';\n');
  const legacyCommand = arg => {
    const result = spawnSync(process.execPath, [path.join(legacy, 'board-add.js'), arg], { encoding: 'utf8' });
    assert(result.status === 0, `legacy migration command failed: ${result.stderr}`);
    return result.stdout;
  };
  const beforeMigration = fs.readFileSync(legacyData, 'utf8');
  assert(legacyCommand('--check-migration').includes('BOARD_DATA_MIGRATION_REQUIRED'), 'rich legacy entries must require migration');
  assert(fs.readFileSync(legacyData, 'utf8') === beforeMigration, 'migration detection must be read-only');
  legacyCommand('--migrate');
  assert(legacyCommand('--check-migration').includes('BOARD_DATA_CURRENT'), 'migrated catalogs must not require migration again');
  assert(fs.readFileSync(legacyData + '.bak', 'utf8') === beforeMigration, 'migration must retain the original catalog backup');
  const migrated = new Function(fs.readFileSync(legacyData, 'utf8') + ';return changes')();
  assert(migrated.length === 2 && migrated[0].pinned && migrated[0].lifecycle === 'archived', 'migration must preserve records and governance');
  const legacyHolder = {};
  new Function('window', fs.readFileSync(path.join(legacy, migrated[0].detailPath), 'utf8'))(legacyHolder);
  assert(legacyHolder.BOARD_DETAILS[migrated[0].detailId].background === 'preserved background', 'migration must retain human detail');
  fs.writeFileSync(input, JSON.stringify({ entry: { title: 'new', docPath: 'docs/new.md' }, detail: { solution: 'new solution' } }));
  legacyCommand(input);
  assert(new Function(fs.readFileSync(legacyData, 'utf8') + ';return changes.length')() === 3, 'publishing after migration must retain old entries and append the new one');

  // Auto-initialized boards must not scan legacy files or replace a user-owned docs index.
  const buildProject = path.join(temp, 'build-project');
  fs.mkdirSync(path.join(buildProject, 'project-html/data'), { recursive: true });
  fs.mkdirSync(path.join(buildProject, 'docs'), { recursive: true });
  fs.mkdirSync(path.join(buildProject, 'design'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'project-html/build.js'), path.join(buildProject, 'project-html/build.js'));
  fs.copyFileSync(path.join(ROOT, 'skills/yan-dev-doc/assets/board/data/changes.js'), path.join(buildProject, 'project-html/data/changes.js'));
  fs.writeFileSync(path.join(buildProject, 'docs/INDEX.md'), '# team index\n');
  fs.writeFileSync(path.join(buildProject, 'design/old-plan.md'), '# legacy plan\n');
  const runBuild = (...args) => spawnSync(process.execPath, [path.join(buildProject, 'project-html/build.js'), ...args], { encoding: 'utf8', windowsHide: true, timeout: 15000 });
  const plainBuild = runBuild();
  assert(plainBuild.status === 0, plainBuild.stderr);
  assert(fs.readFileSync(path.join(buildProject, 'docs/INDEX.md'), 'utf8') === '# team index\n', 'build must preserve a user-owned docs/INDEX.md');
  assert(!fs.existsSync(path.join(buildProject, 'docs/archive')), 'default build must not scan or copy legacy files');
  assert(runBuild('--archive-legacy').status === 0 && fs.existsSync(path.join(buildProject, 'docs/archive/docs/old-plan.md')), 'explicit archive flag must copy legacy docs');
  fs.unlinkSync(path.join(buildProject, 'docs/INDEX.md'));
  assert(runBuild().status === 0 && fs.readFileSync(path.join(buildProject, 'docs/INDEX.md'), 'utf8').includes('自动生成'), 'build should create its own docs/INDEX.md when absent');
  assert(runBuild().status === 0 && fs.readFileSync(path.join(buildProject, 'docs/INDEX.md'), 'utf8').includes('自动生成'), 'build should refresh its own generated index');

  // Validate filesystem boundaries before any persistent write.
  const createBoard = name => {
    const directory = path.join(temp, name);
    fs.mkdirSync(path.join(directory, 'data'), { recursive: true });
    fs.copyFileSync(path.join(ROOT, 'project-html/board-add.js'), path.join(directory, 'board-add.js'));
    fs.writeFileSync(path.join(directory, 'data/changes.js'), 'const htmlChangelog=[];\nconst changes=[];\n');
    return directory;
  };
  const invokeBoard = (directory, arg, extra = []) => spawnSync(process.execPath,
    [...extra, path.join(directory, 'board-add.js'), arg], { encoding: 'utf8', windowsHide: true, timeout: 15000 });
  // Publishing accepts entry narratives alongside an explicit (possibly empty) detail.
  const publishBoard = createBoard('publish-contract');
  const publishInput = path.join(publishBoard, 'entry.json');
  const publishPayload = payload => {
    fs.writeFileSync(publishInput, JSON.stringify(payload));
    const result = invokeBoard(publishBoard, publishInput);
    assert(result.status === 0, 'publish-contract fixture should succeed: ' + result.stderr);
    const catalog = new Function(fs.readFileSync(path.join(publishBoard, 'data/changes.js'), 'utf8') + ';return changes[0]')();
    const window = {};
    new Function('window', fs.readFileSync(path.join(publishBoard, catalog.detailPath), 'utf8'))(window);
    return { catalog, detail: window.BOARD_DETAILS[catalog.detailId] };
  };
  let published = publishPayload({ entry: {
    title: 'awaiting decision', date: today, docPath: 'docs/confirmation.md', status: '待确认',
    lifecycle: 'backlog', pinned: true, background: 'entry background', solution: 'entry solution',
    changeList: ['must not publish'],
    delivery: { plan: { status: 'NeedsConfirmation', summary: 'human plan', openQuestions: ['decide scope'] } }
  }, detail: {} });
  assert(published.detail.background === 'entry background' && published.detail.solution === 'entry solution', 'empty detail must not discard entry narratives');
  assert(published.detail.delivery.plan.summary === 'human plan', 'empty detail must retain nested entry narratives');
  published = publishPayload({ entry: {
    docPath: 'docs/confirmation.md', solution: 'entry fallback',
    delivery: { plan: { goals: ['keep a complete path'] } }
  }, detail: {
    solution: 'explicit human solution', todos: ['must not publish'],
    delivery: { plan: { acceptance: ['observable outcome'] }, review: { events: [
      { eventId: 'check:confirmation:1', summary: 'reviewed draft', findings: ['previous concern'] }
    ] } }
  } });
  assert(published.catalog.status === '待确认', 'omitting status must retain the current state');
  assert(published.detail.solution === 'explicit human solution' && published.detail.background === 'entry background', 'explicit detail should override matching narrative fields and preserve the rest');
  assert(published.detail.delivery.plan.goals[0] === 'keep a complete path' && published.detail.delivery.plan.acceptance[0] === 'observable outcome', 'entry and detail should merge complementary nested plan fields');
  assert(!('changeList' in published.detail) && !('todos' in published.detail), 'both narrative sources must filter Agent-only fields');
  const confirmationIdentity = published.catalog.detailId;
  published = publishPayload({ entry: { docPath: 'docs/confirmation.md', status: '进行中' }, detail: {
    delivery: { plan: { status: 'Passed', openQuestions: [], goals: [] }, review: { events: [
      { eventId: 'check:confirmation:1', summary: 'reviewed resolved plan', findings: [] }
    ] } }
  } });
  assert(published.catalog.status === '进行中' && published.detail.delivery.plan.status === 'Passed', 'explicit resolution must advance both catalog and plan status');
  assert(published.detail.delivery.plan.openQuestions.length === 0 && published.detail.delivery.plan.goals.length === 0, 'empty ordinary arrays must clear prior values');
  assert(published.detail.delivery.review.events.length === 1 && published.detail.delivery.review.events[0].findings.length === 0, 'an idempotent event update must clear resolved findings without duplicating the event');
  published = publishPayload({ entry: { docPath: 'docs/confirmation.md' }, detail: { delivery: { review: { events: [] } } } });
  assert(published.catalog.status === '进行中' && published.catalog.detailId === confirmationIdentity, 'later metadata-only updates must retain explicit state and identity');
  assert(published.catalog.lifecycle === 'backlog' && published.catalog.pinned, 'resolution must preserve omitted human governance');
  assert(published.detail.delivery.review.events.length === 1, 'an empty audit event patch must preserve review history');
  devContext.renderDelivery(Object.assign({}, published.catalog, published.detail));
  assert(!devElement('main').innerHTML.includes('confirm-banner') && !devElement('main').innerHTML.includes('decide scope'), 'resolved persisted data must remove the confirmation banner and stale question');

  const bounded = createBoard('bounded');
  const boundedData = path.join(bounded, 'data/changes.js');
  const untouched = fs.readFileSync(boundedData, 'utf8');
  const sentinel = path.join(temp, 'outside.js');
  fs.writeFileSync(sentinel, 'user-owned content');
  for (const id of ['../../../outside', '..\\..\\..\\outside', 'C:\\outside', 'record:stream', 'CON', { nested: 'id' }]) {
    fs.writeFileSync(input, JSON.stringify({ entry: { title: 'invalid', docPath: 'docs/invalid.md', detailId: id } }));
    const rejected = invokeBoard(bounded, input);
    assert(rejected.status !== 0 && rejected.stderr.includes('BOARD_PATH_INVALID'), 'invalid detail identity must fail explicitly');
    assert(fs.readFileSync(sentinel, 'utf8') === 'user-owned content', 'invalid identity must preserve unrelated files');
    assert(fs.readFileSync(boundedData, 'utf8') === untouched && !fs.existsSync(boundedData + '.bak'), 'invalid identity must not change catalog or backup');
    assert(!fs.existsSync(boundedData + '.lock'), 'failure must release its own board lock');
  }
  fs.writeFileSync(boundedData, 'const htmlChangelog=[];\nconst changes=' + JSON.stringify([
    { title: 'invalid stored path', docPath: 'docs/invalid.md', detailId: 'valid-id', detailPath: '../outside.js' }
  ]) + ';\n');
  const invalidStoredData = fs.readFileSync(boundedData, 'utf8');
  for (const command of ['--migrate', '--check-migration', input]) {
    const rejected = invokeBoard(bounded, command);
    assert(rejected.status !== 0 && rejected.stderr.includes('BOARD_PATH_INVALID'), 'stored detail paths must be validated before loading scripts');
    assert(fs.readFileSync(boundedData, 'utf8') === invalidStoredData, 'invalid stored path must not mutate catalog');
  }
  fs.writeFileSync(boundedData, untouched);
  const externalDetails = path.join(temp, 'external-details');
  fs.mkdirSync(externalDetails);
  fs.writeFileSync(path.join(externalDetails, 'safe-id.js'), 'user-owned detail');
  fs.symlinkSync(externalDetails, path.join(bounded, 'data/details'), process.platform === 'win32' ? 'junction' : 'dir');
  fs.writeFileSync(input, JSON.stringify({ entry: { title: 'linked detail', docPath: 'docs/link.md', detailId: 'safe-id' } }));
  const linked = invokeBoard(bounded, input);
  assert(linked.status !== 0 && linked.stderr.includes('BOARD_PATH_INVALID'), 'directory links must not redirect a detail write outside the board');
  assert(fs.readFileSync(path.join(externalDetails, 'safe-id.js'), 'utf8') === 'user-owned detail', 'linked external detail must remain unchanged');
  fs.unlinkSync(path.join(bounded, 'data/details'));
  assert(invokeBoard(bounded, input).status === 0, 'safe custom detail identifiers must remain supported');
  const collisionBefore = fs.readFileSync(boundedData, 'utf8');
  const detailBefore = fs.readFileSync(path.join(bounded, 'data/details/safe-id.js'), 'utf8');
  fs.writeFileSync(input, JSON.stringify({ entry: { title: 'different record', docPath: 'docs/other.md', detailId: 'safe-id', solution: 'replace another detail' } }));
  const collision = invokeBoard(bounded, input);
  assert(collision.status !== 0 && collision.stderr.includes('BOARD_DETAIL_CONFLICT'), 'different records must not share a detail file');
  assert(fs.readFileSync(boundedData, 'utf8') === collisionBefore && fs.readFileSync(path.join(bounded, 'data/details/safe-id.js'), 'utf8') === detailBefore, 'detail conflicts must preserve existing content');

  // Two publishers finish preparing input before either writes the catalog.
  // Each operation-owned input survives a failed attempt for retry and is removed only after its own success.
  const inputsBoard = createBoard('independent-inputs');
  const inputPaths = ['a', 'b'].map(id => {
    const allocated = spawnSync(process.execPath, [path.join(ROOT, 'skills/_shared/scripts/workflow-fs.js'), 'prepare-board-entry', path.join(inputsBoard, 'data')], {
      encoding: 'utf8', windowsHide: true,
    });
    assert(allocated.status === 0, 'input allocation failed: ' + allocated.stderr);
    const file = allocated.stdout.trim();
    assert(path.isAbsolute(file) && path.relative(path.join(inputsBoard, 'data'), file).split(path.sep)[0] !== '..', 'input must stay within the board write scope');
    assert(fs.readFileSync(file, 'utf8').trim() === '{}', 'allocation must create its own JSON file');
    fs.writeFileSync(file, JSON.stringify({ entry: { title: id, docPath: 'docs/' + id + '.md' }, detail: { solution: id } }));
    return file;
  });
  assert(new Set(inputPaths).size === 2, 'publishers must never share a payload path');
  const inputsLock = path.join(inputsBoard, 'data/changes.js.lock');
  fs.writeFileSync(inputsLock, 'another writer');
  assert(invokeBoard(inputsBoard, inputPaths[0]).stderr.includes('BOARD_WRITE_LOCKED'), 'held lock must block publication');
  assert(fs.existsSync(inputPaths[0]), 'a blocked publication must preserve its input for retry');
  fs.unlinkSync(inputsLock);
  for (const file of inputPaths) assert(invokeBoard(inputsBoard, file).status === 0, 'independent input should publish');
  const preparedRecords = new Function(fs.readFileSync(path.join(inputsBoard, 'data/changes.js'), 'utf8') + ';return changes')();
  assert(preparedRecords.map(item => item.docPath).sort().join(',') === 'docs/a.md,docs/b.md', 'preparing B must not replace A');
  assert(inputPaths.every(file => !fs.existsSync(path.dirname(file))), 'successful publication must remove only its own allocated input directory');
  const outsideInput = path.join(inputsBoard, 'manual-entry.json');
  fs.writeFileSync(outsideInput, JSON.stringify({ entry: { title: 'manual', docPath: 'docs/manual.md' } }));
  assert(invokeBoard(inputsBoard, outsideInput).status === 0 && fs.existsSync(outsideInput), 'inputs outside allocated entry directories must never be deleted');

  // Hold writer A immediately after reading its catalog. B must fail visibly,
  // then succeed on retry; two successful stale reads must never lose a record.
  const concurrent = createBoard('concurrent');
  const harness = path.join(temp, 'concurrent-test.cjs');
  fs.writeFileSync(harness, [
    "const fs = require('fs'), path = require('path'), assert = require('assert/strict');",
    "const {spawn,spawnSync} = require('child_process'); const dir = process.argv[2];",
    "const script = path.join(dir,'board-add.js'), data = path.join(dir,'data/changes.js');",
    "const ready = path.join(dir,'ready'), release = path.join(dir,'release'), hook = path.join(dir,'pause.cjs');",
    "const payloads = ['a','b'].map(id => { const file=path.join(dir,id+'.json'); fs.writeFileSync(file,JSON.stringify({entry:{title:id,docPath:'docs/'+id+'.md'},detail:{solution:id}})); return file; });",
    "fs.writeFileSync(hook, \"const fs=require('fs'),path=require('path');const read=fs.readFileSync;fs.readFileSync=function(file,...args){const value=read.call(fs,file,...args);if(path.resolve(String(file))===\"+JSON.stringify(data)+\"){fs.writeFileSync(\"+JSON.stringify(ready)+\",'ready');const deadline=Date.now()+10000;while(!fs.existsSync(\"+JSON.stringify(release)+\")){if(Date.now()>deadline)throw new Error('test barrier timeout');Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,20);}}return value;};\");",
    "(async()=>{const first=spawn(process.execPath,['--require',hook,script,payloads[0]],{windowsHide:true,stdio:['ignore','pipe','pipe']});let stderr='';first.stderr.on('data',c=>stderr+=c);const done=new Promise((resolve,reject)=>{first.on('error',reject);first.on('exit',resolve);});",
    "try{const deadline=Date.now()+10000;while(!fs.existsSync(ready)){if(Date.now()>deadline)throw new Error('first writer did not read catalog: '+stderr);await new Promise(r=>setTimeout(r,20));}",
    "const second=spawnSync(process.execPath,[script,payloads[1]],{encoding:'utf8',windowsHide:true,timeout:5000});fs.writeFileSync(release,'go');assert.equal(await done,0,stderr);assert.equal(second.status,1,second.stderr);assert.match(second.stderr,/BOARD_WRITE_LOCKED/);",
    "const retry=spawnSync(process.execPath,[script,payloads[1]],{encoding:'utf8',windowsHide:true,timeout:5000});assert.equal(retry.status,0,retry.stderr);const records=new Function(fs.readFileSync(data,'utf8')+';return changes')();assert.deepEqual(records.map(e=>e.docPath).sort(),['docs/a.md','docs/b.md']);for(const entry of records)assert.ok(fs.existsSync(path.join(dir,entry.detailPath)));assert.ok(!fs.existsSync(data+'.lock'));",
    "}finally{fs.writeFileSync(release,'go');await done;}})().catch(e=>{console.error(e);process.exitCode=1;});"
  ].join('\n'));
  const race = spawnSync(process.execPath, [harness, concurrent], { encoding: 'utf8', windowsHide: true, timeout: 25000 });
  assert(race.status === 0, 'concurrent board writers must be isolated: ' + (race.stderr || race.stdout));
  fs.writeFileSync(path.join(concurrent, 'data/changes.js.lock'), 'another writer');
  const concurrentBefore = fs.readFileSync(path.join(concurrent, 'data/changes.js'), 'utf8');
  assert(invokeBoard(concurrent, '--migrate').stderr.includes('BOARD_WRITE_LOCKED'), 'migration must share the publishing lock');
  assert(invokeBoard(concurrent, '--check-migration').status === 0, 'migration detection must remain read-only');
  assert(fs.readFileSync(path.join(concurrent, 'data/changes.js'), 'utf8') === concurrentBefore, 'blocked migration must not mutate data');
  assert(fs.readFileSync(path.join(concurrent, 'data/changes.js.lock'), 'utf8') === 'another writer', 'failed contender must not release another writer lock');
  assert(invokeBoard(concurrent, '--unlock-stale').stderr.includes('BOARD_WRITE_LOCKED'), 'unlock-stale must refuse a fresh lock without a verifiable dead holder');
  assert(fs.readFileSync(path.join(concurrent, 'data/changes.js.lock'), 'utf8') === 'another writer', 'refused unlock must keep the lock');

  // A crashed writer leaves a lock behind: report it as stale, and remove it only through --unlock-stale.
  const staleBoard = createBoard('stale-lock');
  const staleLock = path.join(staleBoard, 'data/changes.js.lock');
  const staleInput = path.join(staleBoard, 'entry.json');
  fs.writeFileSync(staleInput, JSON.stringify({ entry: { title: 'after crash', docPath: 'docs/crash.md' } }));
  const exited = spawnSync(process.execPath, ['-e', ''], { windowsHide: true });
  const lockCases = [
    { holder: { pid: exited.pid, host: os.hostname(), createdAt: new Date().toISOString() }, stale: true, why: 'exited holder process on this host' },
    { holder: { pid: exited.pid, host: 'another-host-sharing-the-board', createdAt: new Date().toISOString() }, stale: false, why: 'fresh lock from another host (its pid is not checkable here)' },
    { holder: { pid: exited.pid, createdAt: new Date().toISOString() }, stale: false, why: 'fresh lock without a recorded host' },
    { holder: { pid: process.pid, host: 'another-host-sharing-the-board', createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString() }, stale: true, why: 'lock older than the stale window' },
    { holder: { pid: process.pid, host: os.hostname(), createdAt: new Date().toISOString() }, stale: false, why: 'live holder with a fresh lock' }
  ];
  for (const { holder, stale, why } of lockCases) {
    fs.writeFileSync(staleLock, JSON.stringify(holder));
    const blocked = invokeBoard(staleBoard, staleInput);
    assert(blocked.status !== 0 && blocked.stderr.includes(stale ? 'BOARD_WRITE_LOCK_STALE' : 'BOARD_WRITE_LOCKED'), `publish must report ${stale ? 'a stale' : 'an active'} lock for ${why}: ${blocked.stderr}`);
    assert(fs.existsSync(staleLock) && fs.existsSync(staleInput), `a blocked publish must keep the lock and its input (${why})`);
    const unlock = invokeBoard(staleBoard, '--unlock-stale');
    assert(stale ? unlock.status === 0 && !fs.existsSync(staleLock) : unlock.status !== 0 && fs.existsSync(staleLock), `--unlock-stale must ${stale ? 'remove' : 'keep'} the lock for ${why}: ${unlock.stderr}`);
  }
  fs.unlinkSync(staleLock);
  assert(invokeBoard(staleBoard, staleInput).status === 0, 'publishing must succeed after a stale lock is removed');

  // Review writes update an existing delivery dossier or fail; they never append an orphan or touch other entry kinds.
  const reviewBoard = createBoard('require-existing');
  const reviewData = path.join(reviewBoard, 'data/changes.js');
  const reviewInput = path.join(reviewBoard, 'entry.json');
  const reviewPublish = payload => {
    fs.writeFileSync(reviewInput, JSON.stringify(payload));
    return invokeBoard(reviewBoard, reviewInput);
  };
  const reviewRecords = () => new Function(fs.readFileSync(reviewData, 'utf8') + ';return changes')();
  assert(reviewPublish({ entry: { title: 'plan only', date: today, docPath: 'docs/plan.md', status: '草稿' },
    detail: { delivery: { plan: { summary: 'exports stay tenant scoped.' } } } }).status === 0, 'plan fixture should publish');
  assert(reviewPublish({ entry: { title: 'incident', date: today, docPath: 'docs/bugs/incident.md', kind: 'bug', status: '未修复' },
    detail: { symptom: 'incident symptom' } }).status === 0, 'bug fixture should publish');
  const beforeOrphan = fs.readFileSync(reviewData, 'utf8');
  const bugDetailPath = path.join(reviewBoard, reviewRecords()[1].detailPath);
  const bugDetailBefore = fs.readFileSync(bugDetailPath, 'utf8');
  const reviewEvent = { delivery: { review: { events: [{ eventId: 'loop:1', findings: [{ id: 'IM-1' }] }] } } };
  for (const [target, why] of [
    [{ title: 'typo', sourceDocPath: 'docs/plna.md', currentGate: 'review' }, 'unmatched source plan'],
    [{ title: 'bug target', sourceDocPath: 'docs/bugs/incident.md', currentGate: 'review' }, 'bug entry is not a delivery dossier'],
    [{ title: 'bug kind', docPath: 'docs/bugs/incident.md', kind: 'bug' }, 'explicit non-delivery kind']
  ]) {
    const rejected = reviewPublish({ requireExisting: true, entry: target, detail: reviewEvent });
    assert(rejected.status !== 0 && rejected.stderr.includes('BOARD_TARGET_NOT_FOUND'), `requireExisting must reject ${why}: ${rejected.stderr}`);
    assert(fs.readFileSync(reviewData, 'utf8') === beforeOrphan && fs.readFileSync(bugDetailPath, 'utf8') === bugDetailBefore, `rejected review write must not change the board (${why})`);
    assert(!fs.existsSync(reviewData + '.lock'), 'rejected review write must release its lock');
  }
  const badFlag = reviewPublish({ requireExisting: 'yes', entry: { sourceDocPath: 'docs/plan.md' }, detail: reviewEvent });
  assert(badFlag.status !== 0 && badFlag.stderr.includes('BOARD_USAGE_ERROR'), 'requireExisting must be a boolean');
  assert(reviewPublish({ requireExisting: true, entry: { title: 'plan only', sourceDocPath: 'docs/plan.md', currentGate: 'review' }, detail: reviewEvent }).status === 0,
    'requireExisting must update a matching delivery dossier');
  let records = reviewRecords();
  assert(records.length === 2 && records[0].currentGate === 'review', 'matched review write must update in place');
  assert(records[0].summary === 'exports stay tenant scoped.', 'a review event without summary must not replace the plan summary with the title: ' + records[0].summary);
  assert(reviewPublish({ requireExisting: true, entry: { sourceDocPath: 'docs/plan.md', summary: 'review closed the export finding.' } }).status === 0, 'explicit summary update should publish');
  records = reviewRecords();
  assert(records[0].summary === 'review closed the export finding.', 'an explicit summary must still take effect');

  // Outside an installed skill tree, the maintained shared root must win over stale legacy host copies.
  const bootstrapHome = path.join(temp, 'bootstrap-home');
  for (const [root, version] of [['.claude', 1], ['.cursor', 2], ['.codex', 3], ['.agents', 99]]) {
    const js = path.join(bootstrapHome, root, 'skills/yan-dev-doc/assets/board/js');
    fs.mkdirSync(js, { recursive: true });
    fs.writeFileSync(path.join(js, 'board.js'), `const BOARD_VERSION = ${version};\n`);
  }
  const looseBootstrap = path.join(temp, 'loose/scripts/board-bootstrap.js');
  fs.mkdirSync(path.dirname(looseBootstrap), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'skills/_shared/scripts/board-bootstrap.js'), looseBootstrap);
  const bootstrapEnv = Object.assign({}, process.env, { HOME: bootstrapHome, USERPROFILE: bootstrapHome });
  delete bootstrapEnv.DEV_WORKFLOW_SKILLS_BOARD_TEMPLATE;
  const lookup = spawnSync(process.execPath, [looseBootstrap, 'status', path.join(temp, 'bootstrap-project')], { encoding: 'utf8', windowsHide: true, env: bootstrapEnv });
  assert(lookup.status === 0 && lookup.stdout.includes('TEMPLATE_BOARD_VERSION=99'), 'board template lookup must prefer ~/.agents over legacy host roots: ' + (lookup.stdout + lookup.stderr));

  // Narrative text is data: "</script>" and line/paragraph separators must not end or break inlined page scripts.
  const escapeProject = path.join(temp, 'escape-project');
  for (const dir of ['data', 'css', 'js']) fs.mkdirSync(path.join(escapeProject, 'project-html', dir), { recursive: true });
  for (const file of ['build.js', 'board-add.js', 'css/board.css', 'js/board.js']) fs.copyFileSync(path.join(ROOT, 'project-html', file), path.join(escapeProject, 'project-html', file));
  fs.copyFileSync(path.join(ROOT, 'skills/yan-dev-doc/assets/board/data/changes.js'), path.join(escapeProject, 'project-html/data/changes.js'));
  const hostileSymptom = '评论输入 </script><script>window.PWNED=1</script><!-- 后页面执行脚本' + String.fromCharCode(0x2028) + '第二行' + String.fromCharCode(0x2029);
  const escapeInput = path.join(escapeProject, 'entry.json');
  fs.writeFileSync(escapeInput, JSON.stringify({ entry: { title: 'XSS 事故', date: today, docPath: 'docs/bugs/xss.md', kind: 'bug', status: '未修复' }, detail: { symptom: hostileSymptom } }));
  const escapeRun = (...args) => spawnSync(process.execPath, [path.join(escapeProject, 'project-html', args[0]), ...args.slice(1)], { encoding: 'utf8', windowsHide: true, timeout: 15000 });
  assert(escapeRun('board-add.js', escapeInput).status === 0, 'hostile narrative fixture should publish');
  assert(escapeRun('build.js').status === 0 && escapeRun('build.js', '--standalone', 'docs/bugs/xss.md').status === 0, 'build and standalone export should succeed');
  const unsafeInline = new RegExp('[' + String.fromCharCode(0x2028, 0x2029) + ']');
  for (const dir of ['pages', 'exports']) {
    const generated = fs.readdirSync(path.join(escapeProject, 'project-html', dir)).filter(name => name.endsWith('.html'));
    assert(generated.length === 1, `expected one generated ${dir} page`);
    const html = fs.readFileSync(path.join(escapeProject, 'project-html', dir, generated[0]), 'utf8');
    assert(!html.includes('window.PWNED=1</script>'), `${dir} page must not let narrative text close the data script`);
    const dataScript = html.match(/<script>(const changes = \[[\s\S]*?)<\/script>/);
    assert(dataScript && !unsafeInline.test(dataScript[1]) && !dataScript[1].includes('<'), `${dir} inline data must escape < and line separators`);
    const roundTrip = new Function(dataScript[1] + ';return changes')();
    assert(roundTrip[0].symptom === hostileSymptom, `${dir} inline data must preserve the original narrative`);
  }

  // The JSON examples agents copy from the publishing docs must actually render and must not roll a dossier's gate back.
  const docExample = (rel, anchor) => {
    const text = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const block = text.slice(text.indexOf(anchor)).match(/```json\r?\n([\s\S]*?)```/);
    assert(text.includes(anchor) && block, `${rel} must keep a JSON example after "${anchor}"`);
    return JSON.parse(block[1]);
  };
  const planExample = docExample('skills/yan-dev-doc/publishing-board.md', '示意结构');
  const reviewExample = docExample('skills/_shared/board-publish-flow.md', '看板只显示下列 Review 字段');
  Object.assign(planExample.entry, { date: today, docPath: 'docs/contract.md' });
  reviewExample.entry.sourceDocPath = 'docs/contract.md';
  const contractBoard = createBoard('doc-contract');
  const contractInput = path.join(contractBoard, 'entry.json');
  const publishExample = payload => {
    fs.writeFileSync(contractInput, JSON.stringify(payload));
    const result = invokeBoard(contractBoard, contractInput);
    assert(result.status === 0, 'documented example should publish: ' + result.stderr);
    const catalog = new Function(fs.readFileSync(path.join(contractBoard, 'data/changes.js'), 'utf8') + ';return changes[0]')();
    const window = {};
    new Function('window', fs.readFileSync(path.join(contractBoard, catalog.detailPath), 'utf8'))(window);
    return { catalog, detail: window.BOARD_DETAILS[catalog.detailId] };
  };
  let documented = publishExample(planExample);
  assert(documented.catalog.currentGate === 'plan', 'a new dossier from the plan example should start at the plan gate');
  documented = publishExample(reviewExample);
  assert(documented.catalog.currentGate === 'review' && documented.catalog.reviewState === reviewExample.entry.reviewState, 'the review example should advance the documented gate and state');
  devContext.renderDelivery(Object.assign({}, documented.catalog, documented.detail));
  const documentedHtml = devElement('main').innerHTML;
  const exampleEvent = reviewExample.detail.delivery.review.events[0];
  for (const [label, value] of [['event summary', exampleEvent.summary], ['finding id', exampleEvent.findings[0].id], ['finding problem', exampleEvent.findings[0].problem], ['next step', exampleEvent.next], ['review state', reviewExample.entry.reviewState]]) {
    assert(documentedHtml.includes(devContext.esc(value)), `the documented review ${label} must be rendered by the board`);
  }
  documented = publishExample(planExample);
  assert(documented.catalog.currentGate === 'review', 'revising the plan with the documented example must keep the dossier at its real gate');

  // Record dates follow the local calendar day used for docs/<date>/, not the UTC day.
  for (const [zone, offsetHours] of [['Etc/GMT-14', 14], ['Etc/GMT+12', -12]]) {
    const zoneBoard = createBoard('zone-' + offsetHours);
    const zoneInput = path.join(zoneBoard, 'entry.json');
    fs.writeFileSync(zoneInput, JSON.stringify({ changelog: 'zone check', entry: { title: 'zone', docPath: 'docs/zone.md' } }));
    const expected = new Date(Date.now() + offsetHours * 3600 * 1000).toISOString().slice(0, 10);
    const zoned = spawnSync(process.execPath, [path.join(zoneBoard, 'board-add.js'), zoneInput],
      { encoding: 'utf8', windowsHide: true, timeout: 15000, env: Object.assign({}, process.env, { TZ: zone }) });
    assert(zoned.status === 0, 'zone fixture should publish: ' + zoned.stderr);
    const zoneData = new Function(fs.readFileSync(path.join(zoneBoard, 'data/changes.js'), 'utf8') + ';return { changes, htmlChangelog }')();
    assert(zoneData.changes[0].updatedAt === expected && zoneData.htmlChangelog[0].date === expected,
      `board dates must use the local day in ${zone}: expected ${expected}, got ${zoneData.changes[0].updatedAt}/${zoneData.htmlChangelog[0].date}`);
  }
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

console.log('ok board lifecycle, bounded rendering, catalog/detail split, and build-mode checks passed');
