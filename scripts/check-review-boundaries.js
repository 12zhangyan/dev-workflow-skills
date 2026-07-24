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
  '只读 code review',
  '不得修改代码',
  '不执行数据库写操作',
  'InsufficientMaterial',
  '可将以上 findings 原样交给 `yan-code-review mode=package`',
  '如果希望直接修复，可将 findings 交给 `yan-code-review mode=repair`',
]);

requireText('skills/yan-code-review/modes/repair/mode.md', [
  '已有 findings',
  '用户要“审查/Review/找问题” → 使用 `review-check`',
  '用户要“一个 AI 审查并修复/一键 review 并修复”且还没有 findings → 使用 `review-loop`',
  '如果输入只有 review task、yan-dev-doc、patch 或 diff，且没有明确 finding，不进入修复',
  '不会提交代码',
  '不得要求执行数据库写操作、DDL、数据修复 SQL',
  '单轮默认最多处理 5 条 accepted findings',
]);

requireText('skills/yan-code-review/modes/package/mode.md', [
  '默认只生成 review 任务包',
  '如果用户没有贴回 review 结果，到这里停止',
  '`yan-code-review mode=check`',
  '`yan-code-review mode=repair`',
  '阻塞项不下发修复',
]);

requireText('skills/yan-code-review/modes/loop/mode.md', [
  'SingleAgentReview',
  '最多 2 个修复循环',
  '读取并执行 [check mode](../check/mode.md)',
  '没有 Critical/Important：跳过 repair',
  '不会自动 commit/push，不会执行数据库写入',
]);

requireText('skills/_shared/workflow-chain.md', [
  'review-check / review-fix / review-repair 共用同一套 ID 前缀',
  '没有明确 findings / fix-handoff / 问题清单 → `review-repair` 不凭空修复',
  '`review-loop` 最多自动修复 2 轮',
  '需要 DDL / 数据修复 → 停止直接执行',
  '`Passed` / `Failed` / `NotProvided` / `NotRun` / `EnvironmentBlocked` / `NotApplicable`',
  '一旦修改代码，必须重新判定为 `Passed / Failed / NotRun / EnvironmentBlocked` 之一',
]);

const allTestEvidenceStatuses = 'Passed / Failed / NotProvided / NotRun / EnvironmentBlocked / NotApplicable';
requireText('skills/yan-code-review/modes/package/reference.md', [allTestEvidenceStatuses]);
requireText('skills/yan-code-review/modes/check/reference.md', [allTestEvidenceStatuses]);
requireText('skills/yan-code-review/modes/loop/reference.md', [allTestEvidenceStatuses]);

requireText('skills/yan-code-review/modes/repair/mode.md', [
  '`Passed` / `Failed` / `NotRun` / `EnvironmentBlocked`',
]);

if (failed) process.exit(1);
console.log('ok review boundary checks passed');
