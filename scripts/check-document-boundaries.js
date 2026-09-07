#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');

let failed = false;

function fail(message) {
  failed = true;
  console.error('FAIL: ' + message);
}

function read(rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) {
    fail(`missing file: ${rel}`);
    return '';
  }
  return fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
}

function requireText(rel, needles) {
  const text = read(rel);
  for (const needle of needles) {
    if (!text.includes(needle)) {
      fail(`${rel} missing behavior guardrail text: ${needle} (keep an equivalent rule, or update this check when wording changes)`);
    }
  }
}

function extractBashBlocks(markdown) {
  const blocks = [];
  const fence = /(?:^|\r?\n)```bash[ \t]*\r?\n([\s\S]*?)\r?\n```(?=\r?\n|$)/g;
  let match;
  while ((match = fence.exec(markdown)) !== null) blocks.push(match[1]);
  return blocks;
}

function runBashBlock(script, cwd, env, label) {
  const result = spawnSync('bash', ['-s'], {
    cwd,
    env,
    input: script.replace(/\r\n/g, '\n'),
    encoding: 'utf8',
    timeout: 30000,
    windowsHide: true,
  });
  if (result.error) {
    fail(`${label} could not start: ${result.error.message}`);
    return null;
  }
  if (result.status !== 0) {
    fail(`${label} exited with ${result.status}`);
    if (result.stdout) process.stderr.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    return null;
  }
  return result;
}

function requireSmokePath(projectRoot, rel, kind) {
  const file = path.join(projectRoot, ...rel.split('/'));
  if (!fs.existsSync(file)) {
    fail(`board-shell bootstrap smoke missing ${kind}: ${rel}`);
    return false;
  }
  const stat = fs.statSync(file);
  const matches = kind === 'directory' ? stat.isDirectory() : stat.isFile();
  if (!matches) {
    fail(`board-shell bootstrap smoke expected ${kind}: ${rel}`);
    return false;
  }
  return true;
}

function requireMarker(result, marker, label) {
  if (!result) return;
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  if (!output.includes(marker)) fail(`${label} missing marker: ${marker}`);
}

function removeTempRoot(tempRoot) {
  const tempBase = path.resolve(os.tmpdir());
  const target = path.resolve(tempRoot);
  const relative = path.relative(tempBase, target);
  const outside = !relative
    || relative === '..'
    || relative.startsWith(`..${path.sep}`)
    || path.isAbsolute(relative);
  if (outside) {
    fail(`refusing to remove board-shell smoke path outside os.tmpdir(): ${target}`);
    return;
  }
  try {
    fs.rmSync(target, { recursive: true, force: true });
  } catch (error) {
    fail(`could not remove board-shell smoke directory: ${error.message}`);
  }
}

function runBoardAdapter(command, project, label) {
  const adapter = path.join(root, 'skills', '_shared', 'scripts', 'board-bootstrap.js');
  const result = spawnSync(process.execPath, [adapter, command, project], {
    cwd: project,
    encoding: 'utf8',
    timeout: 30000,
    windowsHide: true,
  });
  if (result.error) {
    fail(`${label} could not start: ${result.error.message}`);
    return null;
  }
  if (result.status !== 0) {
    fail(`${label} exited with ${result.status}`);
    if (result.stdout) process.stderr.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    return null;
  }
  return result;
}

function smokeBoardShellBootstrap() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-workflow-skills-board-shell-'));
  try {
    const home = path.join(tempRoot, 'home');
    const project = path.join(tempRoot, 'project');
    const installedTemplate = path.join(home, '.codex', 'skills', 'yan-dev-doc', 'assets', 'board');
    fs.mkdirSync(path.dirname(installedTemplate), { recursive: true });
    fs.cpSync(path.join(root, 'skills', 'yan-dev-doc', 'assets', 'board'), installedTemplate, { recursive: true });
    fs.mkdirSync(project, { recursive: true });

    const firstCopy = runBoardAdapter('sync', project, 'board-shell initial copy smoke');
    const requiredFiles = [
      'project-html/index.html',
      'project-html/css/board.css',
      'project-html/js/board.js',
      'project-html/js/vendor/mermaid.min.js',
      'project-html/build.js',
      'project-html/board-add.js',
      'project-html/data/changes.js',
    ];
    let copyReady = Boolean(firstCopy);
    for (const rel of requiredFiles) {
      copyReady = requireSmokePath(project, rel, 'file') && copyReady;
    }
    copyReady = requireSmokePath(project, 'project-html/data/details', 'directory') && copyReady;
    if (!copyReady) return;

    const changesPath = path.join(project, 'project-html', 'data', 'changes.js');
    const detailPath = path.join(project, 'project-html', 'data', 'details', 'sentinel.js');
    const changesSentinel = `${fs.readFileSync(changesPath, 'utf8')}\n// BOARD_BOOTSTRAP_CHANGES_SENTINEL\n`;
    const detailSentinel = '// BOARD_BOOTSTRAP_DETAIL_SENTINEL\n';
    fs.writeFileSync(changesPath, changesSentinel, 'utf8');
    fs.writeFileSync(detailPath, detailSentinel, 'utf8');

    const secondCopy = runBoardAdapter('sync', project, 'board-shell repeat copy smoke');
    if (secondCopy && fs.readFileSync(changesPath, 'utf8') !== changesSentinel) {
      fail('board-shell repeat copy overwrote existing data/changes.js');
    }
    if (secondCopy && fs.readFileSync(detailPath, 'utf8') !== detailSentinel) {
      fail('board-shell repeat copy overwrote an existing data/details sidecar');
    }

    const current = runBoardAdapter('status', project, 'board-shell current-version smoke');
    requireMarker(current, 'BOARD_SHELL_CURRENT', 'board-shell current-version smoke');

    const boardJsPath = path.join(project, 'project-html', 'js', 'board.js');
    const boardJs = fs.readFileSync(boardJsPath, 'utf8');
    const versionPattern = /(BOARD_VERSION[ \t]*=[ \t]*)\d+/;
    if (!versionPattern.test(boardJs)) {
      fail('board-shell smoke could not locate BOARD_VERSION in copied board.js');
      return;
    }
    fs.writeFileSync(boardJsPath, boardJs.replace(versionPattern, (_match, prefix) => `${prefix}0`), 'utf8');
    const upgrade = runBoardAdapter('status', project, 'board-shell upgrade-version smoke');
    requireMarker(upgrade, 'BOARD_SHELL_UPGRADE_REQUIRED', 'board-shell upgrade-version smoke');
  } finally {
    removeTempRoot(tempRoot);
  }
}

requireText('skills/yan-dev-doc/SKILL.md', [
  '任务仍可识别时生成 `NeedsConfirmation` 草稿',
  '任务或安全写入目标本身无法识别时不落盘',
  '数据库保持只读',
  '数据更新必须有主键或唯一约束证据',
  '用户指定精确路径、要求覆盖、文件不可读或状态未知时不得擅自覆盖',
  '不 add、commit、push',
  '按实际文件定位 Git/SVN owner',
  '真实 reactor/POM 关系',
  '不依赖任何外部 Skill 或方法论',
  '用户明确要求看板',
  '执行 Agent 可合并、细分、重排或委派非约束性切片',
]);

requireText('skills/yan-dev-doc/publishing-board.md', [
  'node project-html/board-add.js',
  '../_shared/board-publish-flow.md',
  '面向未参与任务的同事',
  'detail.delivery.plan',
  '`docPath`、标题、日期和当前 plan 状态',
  '精确文件清单、类/方法级步骤、执行命令、Todo、堆栈和 `codeLocation` 留在 md',
  '省略空字段',
  '视觉复核只有真实打开页面后才能声称通过',
]);


requireText('skills/yan-project-analysis/modes/incident/mode.md', [
  '非交互/无人值守运行中不等待提问',
  '不写 Bug 文档、看板或执行型修复 Todo',
  '根因未证实时只给能区分假设的诊断动作',
  '区分源码、构建产物、部署包和实际运行证据',
  '不能用本地源码覆盖事故现场',
  '../../../_shared/board-publish-flow.md',
  'kind:"bug"',
  'Agent 专属字段禁止写入看板 entry',
  '主文档只保留一份索引，聊天不重复',
]);

requireText('skills/yan-project-analysis/modes/business/mode.md', [
  '非交互/无人值守运行中不等待提问',
  '不写业务流文档、看板或确定性测试口径',
  '缺失入口会影响状态/数据闭环时停止生成正式方案',
  '../../../_shared/board-publish-flow.md',
  'kind:"biz"',
  'Mermaid 字段也是普通 JSON 字符串，不使用反引号',
  '聊天不重复整块 Brief',
]);

requireText('skills/yan-project-analysis/modes/understanding/mode.md', [
  '非交互/无人值守运行中不等待提问',
  '`ImpactAnalysis` 是严格仓库零写入模式',
  '禁止修改工作区、文档、看板、VCS 或业务系统',
  '不判断 Bug、不关闭 findings、不输出修复方案',
  '已存在、不可读或状态未知时不得静默覆盖',
  '看板不是隐含副作用',
]);

requireText('skills/yan-project-analysis/modes/understanding/impact-output.md', [
  '自然语言明确本次是零写入影响分析',
  '明确受影响 / 证据显示不受影响 / 待确认',
]);

requireText('skills/yan-conversation-handoff/SKILL.md', [
  '非交互/无人值守运行中不等待提问',
  '只有任务范围本身无法识别时才阻止生成交接内容',
  '不得在文档或复制提示中转录 API key',
  '不要登记 HTML 看板',
  '不设固定文件数量',
  '普通 handoff 不重复这套字段',
  '默认生成路径撞名且用户未锁定文件名时',
  '互不覆盖的动作可以并行',
  '有在途 Agent 或任务时',
]);

const boardShellBootstrap = 'skills/_shared/board-shell-bootstrap.md';
requireText(boardShellBootstrap, [
  '不依赖 Bash、PowerShell',
  'board-bootstrap.js',
  '不得覆盖既有 `data/` 或 `data/details/`',
  'BOARD_SHELL_UPGRADE_REQUIRED',
  'BOARD_SHELL_CURRENT',
]);

for (const rel of [
  'skills/yan-project-analysis/modes/incident/reference.md',
  'skills/yan-project-analysis/modes/business/reference.md',
]) {
  requireText(rel, [
    '../../../_shared/board-publish-flow.md',
    'project-html/data/_entry.json',
    '禁止手工插入标记行或整体重写 `data/changes.js`',
  ]);
}

requireText('skills/_shared/board-publish-flow.md', [
  '业务数据只通过 `project-html/board-add.js` 写入',
  '禁止整体重写或手工插入 `data/changes.js`',
  'board-shell-bootstrap.md',
  'Mermaid 也是普通字符串',
  'BoardPublishSkipped',
  'BoardPublishBlocked',
  'BoardBuildBlocked',
  '失败时不得绕过',
  '当前协调者拥有发布职责三者同时成立',
  '协调者至多汇总写入一次',
  '不建议目录级兜底',
  '不自动删除',
]);

smokeBoardShellBootstrap();

if (failed) process.exit(1);
console.log('ok document skill boundary checks passed; cross-platform board adapter smoke executed');
