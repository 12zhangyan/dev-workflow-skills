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

    const missing = runBoardAdapter('status', project, 'board-shell absent smoke');
    requireMarker(missing, 'BOARD_SHELL_INIT_REQUIRED', 'board-shell absent smoke');
    if (fs.existsSync(path.join(project, 'project-html'))) fail('status must not initialize a missing shell');
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
    const ignorePath = path.join(project, 'project-html', '.gitignore');
    const ignoreText = fs.existsSync(ignorePath) ? fs.readFileSync(ignorePath, 'utf8') : '';
    if (!['pages/', 'data/.entry-*/', 'data/changes.js.bak'].every((line) => ignoreText.split('\n').includes(line))
        || /^data\/(changes\.js|details\/?)$/m.test(ignoreText)) {
      fail('board-shell initial copy must ignore generated/temporary board files but keep catalog and details tracked');
    }
    const ignoreSentinel = '# user-owned ignore\n';
    fs.writeFileSync(ignorePath, ignoreSentinel, 'utf8');

    const secondCopy = runBoardAdapter('sync', project, 'board-shell repeat copy smoke');
    if (secondCopy && fs.readFileSync(changesPath, 'utf8') !== changesSentinel) {
      fail('board-shell repeat copy overwrote existing data/changes.js');
    }
    if (secondCopy && fs.readFileSync(detailPath, 'utf8') !== detailSentinel) {
      fail('board-shell repeat copy overwrote an existing data/details sidecar');
    }
    if (secondCopy && fs.readFileSync(ignorePath, 'utf8') !== ignoreSentinel) {
      fail('board-shell repeat copy overwrote an existing project-html/.gitignore');
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
    const trackedFiles = [...requiredFiles, 'project-html/data/details/sentinel.js', 'project-html/.gitignore'];
    const beforeStatus = trackedFiles.map(rel => fs.readFileSync(path.join(project, rel)));
    const upgrade = runBoardAdapter('status', project, 'board-shell optional-update smoke');
    requireMarker(upgrade, 'BOARD_SHELL_UPGRADE_AVAILABLE', 'board-shell optional-update smoke');
    for (let i = 0; i < trackedFiles.length; i++) {
      if (!fs.readFileSync(path.join(project, trackedFiles[i])).equals(beforeStatus[i])) fail('status changed ' + trackedFiles[i]);
    }

    // A lower version alone must not require a shell copy for a real publish/build.
    const input = path.join(project, 'entry.json');
    fs.writeFileSync(input, JSON.stringify({ entry: { title: 'compatible shell', docPath: 'docs/compatible.md', status: '草稿' }, detail: { solution: 'human solution' } }));
    for (const [script, args] of [['board-add.js', [input]], ['build.js', []]]) {
      const result = spawnSync(process.execPath, [path.join(project, 'project-html', script), ...args], { cwd: project, encoding: 'utf8', timeout: 30000, windowsHide: true });
      if (result.error || result.status !== 0) fail('compatible older shell publication failed: ' + (result.error || result.stderr));
    }
    for (let i = 0; i < 6; i++) {
      if (!fs.readFileSync(path.join(project, requiredFiles[i])).equals(beforeStatus[i])) fail('compatible publication replaced shell: ' + requiredFiles[i]);
    }
    const records = new Function(fs.readFileSync(changesPath, 'utf8') + '; return changes;')();
    if (records.length !== 1 || records[0].docPath !== 'docs/compatible.md') fail('compatible publication must create exactly the requested record');
    if (!fs.existsSync(path.join(project, 'docs', 'INDEX.md'))) fail('compatible publication must build its index');
    if (fs.readFileSync(detailPath, 'utf8') !== detailSentinel) fail('compatible publication changed an unrelated sidecar');

    // Unknown and newer versions must remain read-only diagnostics, not a forced downgrade.
    fs.writeFileSync(boardJsPath, boardJs.replace(versionPattern, (_match, prefix) => prefix + '99999'), 'utf8');
    requireMarker(runBoardAdapter('status', project, 'newer shell smoke'), 'BOARD_SHELL_CURRENT', 'newer shell smoke');
    const newerBytes = fs.readFileSync(boardJsPath);
    const downgrade = spawnSync(process.execPath, [path.join(root, 'skills/_shared/scripts/board-bootstrap.js'), 'sync', project], { encoding: 'utf8', windowsHide: true });
    if (downgrade.status === 0 || !downgrade.stderr.includes('BOARD_SHELL_DOWNGRADE_REFUSED') || !fs.readFileSync(boardJsPath).equals(newerBytes)) fail('sync must reject a downgrade before copying');
    fs.writeFileSync(boardJsPath, boardJs.replace(versionPattern, 'constUnknownVersion = 0'), 'utf8');
    requireMarker(runBoardAdapter('status', project, 'unknown shell smoke'), 'BOARD_SHELL_VERSION_UNKNOWN', 'unknown shell smoke');
    fs.unlinkSync(path.join(project, 'project-html', 'board-add.js'));
    const incomplete = runBoardAdapter('status', project, 'incomplete shell smoke');
    requireMarker(incomplete, 'BOARD_SHELL_INCOMPLETE', 'incomplete shell smoke');
    requireMarker(incomplete, 'BOARD_SHELL_MISSING_FILES=board-add.js', 'incomplete shell smoke');
  } finally {
    removeTempRoot(tempRoot);
  }
}

requireText('skills/yan-dev-doc/SKILL.md', [
  '任务仍可识别时生成 `NeedsConfirmation` 草稿',
  '任务或安全写入目标本身无法识别时不落盘',
  '数据库保持只读',
  '数据更新必须有主键或唯一约束证据',
  '目标不可读、状态未知，或精确路径冲突且未获修改授权时停止受影响写入',
  '不 add、commit、push',
  '按实际文件定位 Git/SVN owner',
  '真实 reactor/POM 关系',
  '不依赖任何外部 Skill 或方法论',
  '本轮主方案收敛并实际落盘后才读取 [看板发布协议](publishing-board.md)',
  '用户明确不要看板或只要聊天输出，或主方案未安全写入时，不初始化或修改 `project-html`',
  '首稿、待用户评审稿和 `NeedsConfirmation` 草稿都按本轮最终内容发布',
  '不得以“等用户确认后再发布”为由跳过',
  '`BoardPublishBlocked`/`BoardPublishSkipped` 及具体原因，不静默省略',
  '执行 Agent 可合并、细分、重排或委派非约束性切片',
]);

for (const mode of ['incident', 'business', 'understanding']) {
  requireText(`skills/yan-project-analysis/modes/${mode}/mode.md`, [
    '`BoardPublishSkipped` 或 `BoardPublishBlocked` 及具体原因，不静默省略',
  ]);
}

requireText('skills/_shared/board-publish-flow.md', [
  '默认发布路径未发布时，由调用方报告 `BoardPublishSkipped`/`BoardPublishBlocked` 及原因',
]);

requireText('skills/yan-dev-doc/plan-template.md', [
  '每个事实只写一次',
  '编号稳定：证据 `E-n`、切片 `S-n`、验收 `A-n`、待裁决 `Q-n`',
  '只有会阻塞切片或需要用户裁决的才进入待裁决',
  '## Compact 骨架',
  '验证方式（计划，未运行）',
]);

requireText('skills/yan-code-review/modes/package/fix-handoff-template.md', [
  'findings 只写在一张表里',
  '结果（repair 回填）',
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
  '即使缺少关键现场证据，也保存 `NeedsConfirmation` 草稿',
  '只有任务本身或安全写入目标无法识别时才保持零写入',
  '用户明确要求只读时始终不落盘',
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
  '即使缺少部分入口或终态证据，也保存 `NeedsConfirmation` 草稿',
  '只有任务本身或安全写入目标无法识别时才保持零写入',
  '用户明确要求只读时始终不落盘',
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
  '目标不可读、状态未知，或精确路径冲突且未获修改授权时停止受影响写入',
  'ImpactAnalysis 永不发布看板',
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
  '不设固定层数或文件数量',
  '普通 handoff 不重复这套字段',
  '默认生成路径撞名且用户未锁定文件名时',
  '互不覆盖的动作可以并行',
  '有在途 Agent 或任务时',
  '送达或已读不代表已完成',
  '摘要定位，再核验',
]);

requireText('skills/_shared/diagram-evidence.md', [
  '未知连接显式标待确认或未展开',
  '方案中的拟议关系与当前实现分开',
  '只能遍历已确认的图边',
  '没有渲染工具时明确仅检查源码',
  '先认出语义模式，再选图型',
  '超出时拆成概览图加关键路径详图',
  '通过不等于渲染成功',
]);

for (const rel of [
  'skills/yan-dev-doc/SKILL.md',
  'skills/yan-project-analysis/SKILL.md',
  'skills/yan-conversation-handoff/SKILL.md',
]) {
  requireText(rel, ['../_shared/scripts/doc-check.js', '`LINE_OUT_OF_RANGE`']);
}

const boardShellBootstrap = 'skills/_shared/board-shell-bootstrap.md';
requireText(boardShellBootstrap, [
  '不依赖 Bash、PowerShell',
  'board-bootstrap.js',
  '不得覆盖既有 `data/` 或 `data/details/`',
  'BOARD_SHELL_UPGRADE_AVAILABLE',
  '仅版本不同不自动升级',
  '确认现有脚本支持后，才运行',
  'BOARD_SHELL_CURRENT',
  '跳过下方逐项核对，直接进入数据格式检查',
]);

for (const rel of [
  'skills/yan-project-analysis/modes/incident/mode.md',
  'skills/yan-project-analysis/modes/business/mode.md',
  'skills/yan-project-analysis/modes/understanding/mode.md',
]) {
  requireText(rel, [
    '实际落盘后才读取',
    '../../../_shared/board-publish-flow.md',
    '通过 `board-add.js` 写入',
  ]);
}

requireText('skills/_shared/board-publish-flow.md', [
  '业务数据只通过 `project-html/board-add.js` 写入',
  '禁止整体重写或手工插入 `data/changes.js`',
  'board-shell-bootstrap.md',
  'Mermaid 也是普通字符串',
  'workflow-fs.js prepare-board-entry',
  '每次发布单独分配输入',
  'BOARD_WRITE_LOCKED',
  'BoardPublishSkipped',
  'BoardPublishBlocked',
  'BoardBuildBlocked',
  '失败时不得绕过',
  '匹配到已有档案、且当前协调者拥有发布职责时更新同一档案',
  '身份缺失或档案不存在时不得创建孤立 Review 条目',
  '协调者至多汇总写入一次',
  '不建议目录级兜底',
  '脚本失败时保留临时 JSON 和错误证据',
  '其他位置的输入文件不动，调用方也不另行删除',
]);

smokeBoardShellBootstrap();

if (failed) process.exit(1);
console.log('ok document skill boundary checks passed; cross-platform board adapter smoke executed');
