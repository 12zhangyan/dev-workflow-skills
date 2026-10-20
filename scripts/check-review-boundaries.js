#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

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
