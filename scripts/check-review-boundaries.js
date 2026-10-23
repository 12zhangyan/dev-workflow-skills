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

requireText('skills/yan-code-review/modes/check/mode.md', [
  '只读代码审查',
  '不得修改代码',
  '同会话刚完成的实现默认审其实际 changed 文件和 diff',
  '不能把空结果当 clean',
  '已审、按规则排除、失败、待审',
  '保留已完成单元的证据和 findings',
  '全部未完成时明确审查失败',
  '零 findings 只表示没有已证实问题，不证明审查完成',
  '行号不可验证时用符号/片段定位，不猜行号',
  '证据不足不冒充 finding',
  '修法或验证设计未定不撤销 finding',
  '关键材料不足时列出缺口和受影响结论，不写成通过',
  '没有 finding 时不输出空分组',
  '由协调者决定是否按根入口规则发布',
]);

requireText('skills/yan-code-review/modes/repair/mode.md', [
  '输入必须包含可定位的问题',
  '只有方案、review task 或未形成 finding 的 diff 时不修复',
  '不提交、不写数据库',
  '已有 canonical ID 原样保留',
  '问题已证实与已具备修复条件分开判断',
  '不按 finding 数、文件数或固定轮次执行',
  '只有实现与验证均能关闭问题时才标已修复',
]);

requireText('skills/yan-code-review/modes/package/mode.md', [
  '宿主允许且任务已授权独立审查时直接委派',
  '只读 reviewer',
  '委派不可用',
  'reviewer 首轮独立取证',
  '委派不扩大用户原有权限',
  '不把发送成功、沉默或空回复算作完成',
  '重试前检查原句柄',
  '不能按成功人数推导整体通过',
  '至少两个独立 reviewer 成功返回时才称为多 reviewer 结果',
  '`BK` 未裁决时不能下发对应修复',
  '关闭证据应来自未参与该修复的 reviewer',
  '须标为自验证关闭，不称独立复核通过',
]);

requireText('skills/yan-code-review/modes/check/mode.md', [
  '不再委派子 Agent',
  '实现方已运行的测试不整套重跑',
]);

requireText('skills/yan-code-review/modes/package/mode.md', [
  '这类对 finding 的预判时删除',
]);

requireText('skills/yan-code-review/modes/loop/mode.md', [
  '也不写“不要报”“最多算 Minor”这类对 finding 的预判',
]);

requireText('skills/yan-code-review/modes/loop/mode.md', [
  'SingleAgentReview',
  '读取并执行 [check mode](../check/mode.md)',
  '没有 accepted finding 就停止修复',
  '若仍有审查失败或待审范围',
  '不得为结束循环删除必要检查、放宽断言或把失败改成不适用',
  '不执行数据库写入、DDL、add/commit/push',
  '没有新证据或连续动作没有实质进展',
  '不设为了流程完整而必须跑满的轮次',
  '在最终验证之后追加一次独立复核',
  '不提供修复者的推理或结论',
  '以验证证据关闭并标为自验证关闭，不称独立复核通过',
  '只有 Minor 修复或没有代码变化时不派发',
  '宿主规则要求用户明确授权才能派发子智能体而本次未获授权',
]);

requireText('skills/yan-code-review/modes/check/mode.md', [
  '`ADDRESSED` 或 `NOT ADDRESSED`',
  '尝试过修复不改变结论',
  '修复 diff 之外的观察，单列且不阻塞本轮',
]);

requireText('skills/yan-code-review/modes/loop/mode.md', [
  '修复 diff 之外的观察记入剩余风险，不作为继续循环的理由',
]);

requireText('skills/yan-code-review/modes/repair/mode.md', [
  '先澄清该条，再修改与它关联的条目',
]);

// SVN 工作副本按用户规则只运行本地只读命令；owner 仍只靠目录存在性判断，命令不可用时降级为“SVN 未检查”。
requireText('skills/_shared/workflow-gates.md', [
  'SVN owner 只运行本地只读命令',
  '均加 `--non-interactive`',
  '禁止联网命令（`log`、`blame`、`update`、`status -u`',
  '写入命令（`add`、`commit`、`revert`',
  '基线写 `svnversion` 原样结果',
  '命令不存在、报错（如工作副本格式与客户端版本不匹配）或要求认证时保留错误',
  '纳管与基线报告为“SVN 未检查”，不写 clean，不宣称可提交',
]);
const SVN_POINT_OF_USE = '只运行本地只读的 `svn status`、`svn diff` 与 `svnversion`';
// Outside a working copy `svn status` exits 0 with empty stdout and only a stderr warning, and `svnversion`
// exits 0 printing "Unversioned directory": the rule must say where to run and treat those as failures.
requireText('skills/_shared/workflow-gates.md', [
  '命令在 `detect-vcs` 返回的 SVN 工作副本根目录运行，或直接传入该工作副本内的改动文件路径',
  '退出码为 0 也不等于成功',
  '`W155007`',
  '`Unversioned directory`',
]);
const SVN_WHERE = '在 `detect-vcs` 返回的 SVN 根目录';
const SVN_ZERO_EXIT = '退出码为 0 但出现 `svn: warning`、`Unversioned directory`';
requireText('skills/yan-code-review/modes/check/mode.md', [SVN_POINT_OF_USE, SVN_WHERE, SVN_ZERO_EXIT, '不运行联网或写入命令', '`detect-vcs <目录>`', '仓库根有 `.git` 不代表内层目录归 Git', '“SVN 未检查”']);
requireText('skills/yan-code-review/modes/repair/mode.md', [SVN_POINT_OF_USE, SVN_WHERE, SVN_ZERO_EXIT, '包括 `svn add`', '`detect-vcs <目录>`', '仓库根有 `.git` 不代表内层目录归 Git']);
requireText('skills/yan-code-review/modes/loop/mode.md', [SVN_POINT_OF_USE, SVN_WHERE, SVN_ZERO_EXIT, '不运行联网或写入命令']);
requireText('skills/_shared/host-capabilities.md', ['返回 `svn` 时只允许在返回的 `root` 下运行本地只读的', '不联网、不写入', '退出码为 0 但有 `svn: warning` 也按失败处理']);
requireText('skills/_shared/board-shell-bootstrap.md', ['`svn status --non-interactive project-html`', '出现 `svn: warning`', '时按状态未知照常升级']);

// When a real svn client is installed, confirm the failure signals named above match its actual output,
// and that the allowed commands work inside a working copy without the server.
{
  const run = (command, args, cwd) => spawnSync(command, args, { cwd, encoding: 'utf8', windowsHide: true, timeout: 30000 });
  const svnAvailable = run('svn', ['--version', '--quiet']).status === 0 && run('svnversion', ['--version', '--quiet']).status === 0;
  if (!svnAvailable) {
    console.log('note: svn client not installed; skipped the live svn signal probe');
  } else {
    const probeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'svn-signal-probe-'));
    try {
      const outside = path.join(probeRoot, 'not-a-working-copy');
      fs.mkdirSync(path.join(outside, 'project-html'), { recursive: true });
      for (const args of [['status', '--non-interactive'], ['status', '--non-interactive', 'project-html']]) {
        const result = run('svn', args, outside);
        if (result.status !== 0 || result.stdout.trim() || !/svn: warning: W155007/.test(result.stderr)) {
          fail(`svn ${args.join(' ')} outside a working copy no longer looks like "exit 0, empty stdout, W155007 warning" (exit ${result.status}); update the SVN failure signals in workflow-gates.md`);
        }
      }
      const unversioned = run('svnversion', [], outside);
      if (unversioned.status !== 0 || /^\d+(?::\d+)?[MSP]*$/.test(unversioned.stdout.trim())) {
        fail(`svnversion outside a working copy should exit 0 with a non-revision result; got exit ${unversioned.status}: ${unversioned.stdout.trim()}`);
      } else if (unversioned.stdout.trim() !== 'Unversioned directory') {
        console.log(`note: svnversion printed "${unversioned.stdout.trim()}" (localized?); the rule also covers other non-revision results`);
      }

      if (run('svnadmin', ['--version', '--quiet']).status === 0) {
        const repo = path.join(probeRoot, 'repo');
        const wc = path.join(probeRoot, 'wc');
        const url = 'file:///' + repo.replace(/\\/g, '/').replace(/^\//, '');
        const steps = [
          ['svnadmin', ['create', repo], probeRoot],
          ['svn', ['checkout', '--quiet', '--non-interactive', url, wc], probeRoot],
        ];
        for (const [command, args, cwd] of steps) {
          const result = run(command, args, cwd);
          if (result.status !== 0) throw new Error(`${command} ${args[0]} failed: ${result.stderr}`);
        }
        fs.writeFileSync(path.join(wc, 'A.java'), 'a\n');
        for (const args of [['add', '--quiet', 'A.java'], ['commit', '--quiet', '--non-interactive', '-m', 'probe']]) {
          const result = run('svn', args, wc);
          if (result.status !== 0) throw new Error(`fixture svn ${args[0]} failed: ${result.stderr}`);
        }
        fs.writeFileSync(path.join(wc, 'A.java'), 'a\nb\n');
        fs.writeFileSync(path.join(wc, 'NewTest.java'), 'new\n');
        fs.renameSync(repo, repo + '-unreachable');
        const atRoot = run('svn', ['status', '--non-interactive'], wc);
        const byPath = run('svn', ['status', '--non-interactive', path.join(wc, 'A.java'), path.join(wc, 'NewTest.java')], outside);
        for (const [label, result] of [['at the working-copy root', atRoot], ['with file paths from outside', byPath]]) {
          if (result.status !== 0 || !/^M\s+.*A\.java$/m.test(result.stdout) || !/^\?\s+.*NewTest\.java$/m.test(result.stdout) || /svn: warning/.test(result.stderr)) {
            fail(`svn status ${label} should list M A.java and ? NewTest.java without the server: ${result.stdout}${result.stderr}`);
          }
        }
        const version = run('svnversion', [], wc);
        if (version.status !== 0 || !/^\d+(?::\d+)?M$/.test(version.stdout.trim())) {
          fail(`svnversion inside the working copy should report a modified revision without the server: ${version.stdout}${version.stderr}`);
        }
        const networked = run('svn', ['log', '--non-interactive', '-l', '1'], wc);
        if (networked.status === 0) fail('svn log unexpectedly worked without the repository; recheck the networked-command list');
        console.log('ok live svn probe: failure signals outside a working copy and offline status/svnversion inside one match the rule');
      } else {
        console.log('ok live svn probe: failure signals outside a working copy match the rule (svnadmin not installed; offline working-copy probe skipped)');
      }
    } catch (error) {
      fail('svn signal probe could not run: ' + error.message);
    } finally {
      fs.rmSync(probeRoot, { recursive: true, force: true });
    }
  }
}

// Networked or writing svn commands may only appear inside a prohibition, in skill text and eval expectations alike.
{
  const forbiddenSvn = /svn (?:log|update|commit|add|revert|blame|cleanup|upgrade|resolve|delete|move|propset|lock)\b|status -u|`(?:log|update|commit|add|revert|blame|cleanup|upgrade)`/;
  const negation = /不|禁止|禁用|勿/;
  const svnContext = /svn|SVN/;
  const offending = [];
  const scan = (where, text) => {
    for (const sentence of text.split(/[。；;\n]/)) {
      if (svnContext.test(sentence) && forbiddenSvn.test(sentence) && !negation.test(sentence)) offending.push(`${where}: ${sentence.trim().slice(0, 120)}`);
    }
  };
  const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
  for (const file of walk(path.join(root, 'skills'))) {
    const rel = path.relative(root, file).replace(/\\/g, '/');
    if (rel.includes('/assets/')) continue;
    if (rel.endsWith('.md')) scan(rel, fs.readFileSync(file, 'utf8'));
    if (rel.endsWith('evals.json')) {
      const suite = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
      for (const ev of suite.evals || []) scan(`${rel}#${ev.id}`, ev.expected_output || '');
    }
  }
  if (offending.length) fail('networked or writing svn commands must only appear as prohibitions:\n  ' + offending.join('\n  '));

  // Removed concepts must not come back through eval expectations, where no prose check would see them.
  const retired = [
    [/BoardPublishOwner/, 'BoardPublishOwner is not a skill concept; the coordinator is the only board publisher'],
    [/审查清单/, 'check mode has no fixed review checklist'],
    [/写入 ReviewScopeType/, 'the board review event field is scopeType'],
  ];
  const stale = [];
  for (const file of walk(path.join(root, 'skills'))) {
    const rel = path.relative(root, file).replace(/\\/g, '/');
    if (rel.includes('/assets/') || !(rel.endsWith('.md') || rel.endsWith('evals.json'))) continue;
    const text = fs.readFileSync(file, 'utf8');
    for (const [pattern, why] of retired) if (pattern.test(text)) stale.push(`${rel}: ${why}`);
  }
  if (stale.length) fail('retired review concepts reappeared:\n  ' + stale.join('\n  '));
}

requireText('skills/_shared/workflow-gates.md', [
  '## 声明与证据',
  '| 子 Agent 已完成 | 核对 VCS diff 与其验证输出 | 子 Agent 自报成功 |',
  '| finding 已关闭 | 最新实现与以上对应证据都支持 | 尝试过修复 |',
]);

requireText('skills/_shared/workflow-chain.md', [
  '同一问题从发现到关闭复用稳定 ID',
  '`CR-n / IM-n / MI-n`',
  '没有原始 finding 不凭空修复',
  '不规定执行顺序、角色数、修复轮次或输出模板',
  '需要失败归因或交接时可使用 `TestEvidenceStatus`',
  '修改代码后必须基于最新实现重新判断',
  '是否修复成功与是否达到 VCS/Submit 就绪分别判断',
]);

requireText('skills/yan-code-review/modes/package/aggregation.md', [
  'Accepted 只表示问题已证实',
  '不因建议缺失归入 `RJ`',
  '下发执行型修复前',
  '只有 HEAD 相同不能证明未提交内容相同',
  '不同版本的结果不能拼成一次完整通过',
  '覆盖不完整与缺陷是否存在分别判断',
]);

const allTestEvidenceStatuses = 'Passed / Failed / NotProvided / NotRun / EnvironmentBlocked / NotApplicable';
requireText('skills/yan-code-review/modes/check/reference.md', [allTestEvidenceStatuses]);
requireText('skills/yan-code-review/modes/loop/reference.md', [
  'TestEvidenceStatus: <Passed|Failed|NotProvided|NotRun|EnvironmentBlocked|NotApplicable>',
]);

function listMarkdown(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listMarkdown(full);
    return entry.name.endsWith('.md') ? [full] : [];
  });
}

const obsoleteReceiptPatterns = [
  [/BoardPublishStatus[^\n]*NotRequested/, 'board status placeholder when nothing was published'],
  [/RepairCycles\s*:\s*<\s*0\s*\|\s*1\s*\|\s*2\s*>/, 'fixed repair-cycle cap'],
];
for (const file of listMarkdown(path.join(root, 'skills'))) {
  const rel = path.relative(root, file).replace(/\\/g, '/');
  const text = fs.readFileSync(file, 'utf8');
  for (const [pattern, label] of obsoleteReceiptPatterns) {
    if (pattern.test(text)) fail(`${rel} reintroduces ${label}`);
  }
}

if (failed) process.exit(1);
console.log('ok review boundary checks passed');
