#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const shared = path.join(root, 'skills', '_shared', 'interaction-policy.md');
const skillsDir = path.join(root, 'skills');
const requiredSkills = fs.readdirSync(skillsDir)
  .filter((name) => fs.existsSync(path.join(skillsDir, name, 'SKILL.md')))
  .sort();

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

if (!fs.existsSync(shared)) {
  fail('Missing shared interaction policy: skills/_shared/interaction-policy.md');
} else {
  const text = fs.readFileSync(shared, 'utf8');
  for (const needle of ['先读用户输入', '低风险未知', '高风险未知', '需求冲突', '材料不足', '非交互运行', '推荐项不是授权', 'InsufficientMaterial', 'NeedsConfirmation', '未知部分不得生成确定性业务/API/数据口径', '不回显值']) {
    if (!text.includes(needle)) fail(`Shared interaction policy missing required phrase: ${needle}`);
  }
  for (const forbidden of ['## 四步流程', '每次只问一个']) {
    if (text.includes(forbidden)) fail(`Shared interaction policy contains a fixed interaction flow: ${forbidden}`);
  }
}

for (const skill of requiredSkills) {
  const file = path.join(root, 'skills', skill, 'SKILL.md');
  if (!fs.existsSync(file)) {
    fail(`Missing skill entrypoint: skills/${skill}/SKILL.md`);
    continue;
  }
  const text = fs.readFileSync(file, 'utf8');
  if (!text.includes('../_shared/interaction-policy.md')) {
    fail(`Skill does not reference shared interaction policy: skills/${skill}/SKILL.md`);
  }
}

const reviewCheckReference = path.join(root, 'skills', 'yan-code-review', 'modes', 'check', 'reference.md');
if (fs.existsSync(reviewCheckReference)) {
  const text = fs.readFileSync(reviewCheckReference, 'utf8');
  for (const needle of ['ReviewScopeType', 'TestDependencyClass', 'TestEvidenceStatus']) {
    if (!text.includes(needle)) fail(`review-check reference missing output field: ${needle}`);
  }
} else {
  fail('Missing review-check reference file: skills/review-check/reference.md');
}

const reviewRepairReference = path.join(root, 'skills', 'yan-code-review', 'modes', 'repair', 'reference.md');
for (const [file, label] of [[reviewRepairReference, 'review-repair reference']]) {
  if (!fs.existsSync(file)) {
    fail(`Missing ${label} file`);
    continue;
  }
  const text = fs.readFileSync(file, 'utf8');
  for (const needle of ['TestEvidenceStatus', 'EnvironmentBlocked', 'NotRun']) {
    if (!text.includes(needle)) fail(`${label} missing repair verification text: ${needle}`);
  }
}

// 轻量交接协议与串联速查必须存在，且被门禁协议引用（各 skill 经门禁协议间接指向）。
const briefFile = path.join(root, 'skills', '_shared', 'workflow-brief.md');
const chainFile = path.join(root, 'skills', '_shared', 'workflow-chain.md');
const gatesFile = path.join(root, 'skills', '_shared', 'workflow-gates.md');
if (!fs.existsSync(briefFile)) fail('Missing shared handoff policy: skills/_shared/workflow-brief.md');
if (!fs.existsSync(chainFile)) fail('Missing shared chain map: skills/_shared/workflow-chain.md');
if (fs.existsSync(chainFile)) {
  const chain = fs.readFileSync(chainFile, 'utf8');
  for (const needle of ['ReviewScopeType', 'TestEvidenceStatus', 'PlanReview', 'ImplementationReview', 'FixHandoffReview', 'EnvironmentBlocked']) {
    if (!chain.includes(needle)) fail(`workflow-chain.md missing review state text: ${needle}`);
  }
}
if (fs.existsSync(gatesFile)) {
  const gates = fs.readFileSync(gatesFile, 'utf8');
  if (!gates.includes('workflow-brief.md')) fail('workflow-gates.md does not reference workflow-brief.md');
  if (!gates.includes('workflow-chain.md')) fail('workflow-gates.md does not reference workflow-chain.md');
  for (const needle of ['结论所需证据', '方案、实际改动、验证结果和线上运行', '没有断言目标逻辑', 'EnvironmentBlocked', 'VCS 归属与纳管', 'VCS_OWNER', 'VCSStatusUnknown', 'VCSGateBlocked']) {
    if (!gates.includes(needle)) fail(`workflow-gates.md missing accuracy invariant text: ${needle}`);
  }
} else {
  fail('Missing shared gate policy: skills/_shared/workflow-gates.md');
}

// 每个产生下一步动作的 skill 都应在 SKILL.md 引用 Workflow Brief（产出或消费）。
for (const skill of requiredSkills) {
  const file = path.join(root, 'skills', skill, 'SKILL.md');
  if (!fs.existsSync(file)) continue;
  const text = fs.readFileSync(file, 'utf8');
  if (!text.includes('Workflow Brief') && !text.includes('workflow-brief.md')) {
    fail(`Skill does not mention Workflow Brief: skills/${skill}/SKILL.md`);
  }
}

if (!process.exitCode) console.log('Interaction policy references are in sync.');
