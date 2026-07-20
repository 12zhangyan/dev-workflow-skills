#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(ROOT, 'project-html/js/board.js'), 'utf8');
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

// board-add 更新同一 docPath 时必须保留人工治理字段和原 status。
const temp = fs.mkdtempSync(path.join(ROOT, '.tmp-board-behavior-'));
try {
  fs.mkdirSync(path.join(temp, 'data'));
  fs.copyFileSync(path.join(ROOT, 'project-html/board-add.js'), path.join(temp, 'board-add.js'));
  fs.copyFileSync(path.join(ROOT, 'skills/dev-doc/assets/board/data/changes.js'), path.join(temp, 'data/changes.js'));
  const input = path.join(temp, 'entry.json');
  const runAdd = entry => {
    fs.writeFileSync(input, JSON.stringify({ entry }));
    const result = spawnSync(process.execPath, [path.join(temp, 'board-add.js'), input], { encoding: 'utf8' });
    assert(result.status === 0, `board-add fixture should succeed: ${result.stderr || result.stdout}`);
  };
  runAdd({ title: 'stateful', date: '2020-01-01', docPath: 'docs/stateful.md', status: '草稿', lifecycle: 'archived', pinned: true,
    background: 'human background', solution: 'human solution', changeList: [{ file: 'AgentOnly.java' }], todos: ['agent only'] });
  runAdd({ title: 'stateful updated', date: today, docPath: 'docs/stateful.md', status: '进行中',
    background: 'updated human background', solution: 'updated human solution', stackTrace: 'agent only', codeLocation: 'AgentOnly.java:1' });
  const dataSource = fs.readFileSync(path.join(temp, 'data/changes.js'), 'utf8');
  const entry = new Function(dataSource + ';return changes[0]')();
  assert(entry.status === '草稿', 'board-add should preserve original status on update');
  assert(entry.lifecycle === 'archived' && entry.pinned === true, 'board-add should preserve omitted lifecycle governance fields');
  assert(entry.updatedAt === today, 'board-add should refresh updatedAt on update');
  assert(entry.detailId && entry.detailPath && entry.summary && entry.searchText, 'catalog should contain detail pointers and a compact search summary');
  for (const key of ['background', 'solution', 'changeList', 'todos', 'stackTrace', 'codeLocation']) {
    assert(!Object.prototype.hasOwnProperty.call(entry, key), `catalog should not contain ${key}`);
  }
  const detailSource = fs.readFileSync(path.join(temp, entry.detailPath), 'utf8');
  const holder = {};
  new Function('window', detailSource)(holder);
  const detail = holder.BOARD_DETAILS[entry.detailId];
  assert(detail.background === 'updated human background' && detail.solution === 'updated human solution', 'detail sidecar should contain independent human narrative');
  for (const key of ['changeList', 'todos', 'stackTrace', 'codeLocation']) {
    assert(!Object.prototype.hasOwnProperty.call(detail, key), `human detail should not contain Agent-only field ${key}`);
  }
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

console.log('ok board lifecycle, bounded rendering, catalog/detail split, and build-mode checks passed');
