#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
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

const today = new Date().toISOString().slice(0, 10);
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

const indexHtml = fs.readFileSync(path.join(ROOT, 'project-html/index.html'), 'utf8');
for (const scope of ['workspace', 'backlog', 'archive', 'all']) {
  assert(indexHtml.includes(`data-scope="${scope}"`), `index should expose ${scope} scope filter`);
}
assert(indexHtml.includes('<button type="button" class="fpill"'), 'scope and kind filters should use semantic buttons');
assert(indexHtml.includes('<button type="button" class="log-btn"'), 'footer navigation should use semantic buttons');

const boardCss = fs.readFileSync(path.join(ROOT, 'project-html/css/board.css'), 'utf8');
for (const marker of ['@media (max-width: 840px)', 'body { display: block; min-height: 100vh; overflow: auto; }', '.sidebar-footer { display: grid;', '[role="button"]:focus-visible', 'A 方案：一事一档生命周期', '.delivery-overview {', '.review-timeline {']) {
  assert(boardCss.includes(marker), `board CSS should include responsive/accessibility marker: ${marker}`);
}
assert(indexHtml.includes('研发变更档案馆') && indexHtml.includes('ONE CHANGE · ONE STORY'), 'formal board shell should use the selected A dossier identity');

const buildJs = fs.readFileSync(path.join(ROOT, 'project-html/build.js'), 'utf8');
assert(buildJs.includes('window.DETAIL_PAGE = true'), 'regular detail pages should use shared-resource mode');
assert(buildJs.includes("process.argv[2] === '--standalone'"), 'build should support explicit standalone export');
assert(buildJs.includes('hydratedEntry(catalog)'), 'build should merge catalog and human detail before generating a page');
assert(!/for \(const f of oldPages\) \{\s*fs\.unlinkSync/.test(buildJs), 'build should not unconditionally delete all detail pages');
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

// board-add 更新同一 docPath 时必须保留人工治理字段和原 status。
const temp = fs.mkdtempSync(path.join(ROOT, '.tmp-board-behavior-'));
try {
  fs.mkdirSync(path.join(temp, 'data'));
  fs.copyFileSync(path.join(ROOT, 'project-html/board-add.js'), path.join(temp, 'board-add.js'));
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
  assert(entry.status === '草稿', 'board-add should preserve original status on update');
  assert(entry.lifecycle === 'archived' && entry.pinned === true, 'board-add should preserve omitted lifecycle governance fields');
  assert(entry.updatedAt === today, 'board-add should refresh updatedAt on update');
  assert(entry.deliveryId && entry.currentGate === 'review' && entry.gateStatus === 'passed', 'catalog should expose stable delivery and current gate state');
  assert(entry.reviewCounts.open === 0 && entry.reviewState === 'fixed', 'catalog should expose compact review health');
  assert(entry.detailId && entry.detailPath && entry.summary && entry.searchText, 'catalog should contain detail pointers and a compact search summary');
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
  // Their operation-owned JSON files must survive independently, including retries.
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
  for (const file of inputPaths) assert(invokeBoard(inputsBoard, file).status === 0, 'independent input should publish');
  const preparedRecords = new Function(fs.readFileSync(path.join(inputsBoard, 'data/changes.js'), 'utf8') + ';return changes')();
  assert(preparedRecords.map(item => item.docPath).sort().join(',') === 'docs/a.md,docs/b.md', 'preparing B must not replace A');
  assert(inputPaths.every(file => fs.existsSync(file)), 'publication must preserve inputs for evidence or retry');

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
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

console.log('ok board lifecycle, bounded rendering, catalog/detail split, and build-mode checks passed');
