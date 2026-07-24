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
  '非交互/无人值守运行',
  '不写 md、OpenAPI、看板或索引',
  '数据库操作始终只读',
  '不得执行 DDL、数据修复',
  '禁止用宿主文件能力整体重写',
  'node project-html/board-add.js',
  '../_shared/board-shell-bootstrap.md',
]);

requireText('skills/yan-project-analysis/modes/incident/mode.md', [
  '非交互/无人值守运行中不等待提问',
  '不写 Bug 文档、看板或执行型修复 Todo',
  '根因无明确结论',
  'node project-html/board-add.js',
  '不要手改文件',
  '../../../_shared/board-shell-bootstrap.md',
  '完成输出必须包含 reference.md 里的 `【Workflow Brief】`',
]);

requireText('skills/yan-project-analysis/modes/business/mode.md', [
  '非交互/无人值守运行中不等待提问',
  '不写业务流文档、看板或确定性测试口径',
  '缺失入口会影响状态/数据闭环时停止生成正式方案',
  '写 `data/changes.js` 一律走下方 ② 的 `board-add.js` 脚本',
  '跳过条件',
  '../../../_shared/board-shell-bootstrap.md',
  '完成输出必须包含 reference.md 里的 `【Workflow Brief】`',
]);

requireText('skills/yan-project-analysis/modes/understanding/mode.md', [
  '非交互/无人值守运行中不等待提问',
  'ImpactAnalysis` 是严格零写入模式',
  '禁止任何文件修改、创建目录或临时文件',
  '不得进入 Step 4/4.5',
  '不判断缺陷或关闭 findings',
  '最多列 5 个',
]);

requireText('skills/yan-project-analysis/modes/understanding/reference.md', [
  '首轮最多 5 个文件',
]);

requireText('skills/yan-conversation-handoff/SKILL.md', [
  '非交互/无人值守运行中不等待提问',
  '不要猜测范围，不覆盖文件',
  '不得在文档、复制提示或 `Workflow Brief` 中转录 API key',
  '不要登记 HTML 看板',
  '首轮不超过 5 个文件',
  '最终输出包含 `【Workflow Brief】`',
]);

const boardShellBootstrap = 'skills/_shared/board-shell-bootstrap.md';
requireText(boardShellBootstrap, [
  '不依赖 Bash、PowerShell',
  'board-bootstrap.js',
  '不得覆盖既有 `data/` 或 `data/details/`',
  'BOARD_SHELL_UPGRADE_REQUIRED',
  'BOARD_SHELL_CURRENT',
]);

smokeBoardShellBootstrap();

if (failed) process.exit(1);
console.log('ok document skill boundary checks passed; cross-platform board adapter smoke executed');
