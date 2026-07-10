const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const shared = path.join(root, 'skills', '_shared', 'interaction-policy.md');
const requiredSkills = [
  'dev-doc',
  'bug-fix',
  'code-reading',
  'biz-flow',
  'review-fix',
  'review-check',
  'review-repair'
];

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

if (!fs.existsSync(shared)) {
  fail('Missing shared interaction policy: skills/_shared/interaction-policy.md');
} else {
  const text = fs.readFileSync(shared, 'utf8');
  for (const needle of ['证据预填', '风险分级', '需求冲突', '材料不足', 'Skill 维护反馈块']) {
    if (!text.includes(needle)) fail(`Shared interaction policy missing required phrase: ${needle}`);
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

const feedbackReferences = [
  'dev-doc/reference.md',
  'bug-fix/reference.md',
  'code-reading/reference.md',
  'biz-flow/reference.md',
  'review-fix/reference.md',
  'review-check/reference.md',
  'review-repair/reference.md'
];

for (const rel of feedbackReferences) {
  const file = path.join(root, 'skills', rel);
  if (!fs.existsSync(file)) {
    fail(`Missing reference file: skills/${rel}`);
    continue;
  }
  const text = fs.readFileSync(file, 'utf8');
  if (!text.includes('【Skill 维护反馈】')) {
    fail(`Reference output format missing skill feedback block: skills/${rel}`);
  }
}

// 轻量交接协议与串联速查必须存在，且被门禁协议引用（各 skill 经门禁协议间接指向）。
const briefFile = path.join(root, 'skills', '_shared', 'workflow-brief.md');
const chainFile = path.join(root, 'skills', '_shared', 'workflow-chain.md');
const gatesFile = path.join(root, 'skills', '_shared', 'workflow-gates.md');
if (!fs.existsSync(briefFile)) fail('Missing shared handoff policy: skills/_shared/workflow-brief.md');
if (!fs.existsSync(chainFile)) fail('Missing shared chain map: skills/_shared/workflow-chain.md');
if (fs.existsSync(gatesFile)) {
  const gates = fs.readFileSync(gatesFile, 'utf8');
  if (!gates.includes('workflow-brief.md')) fail('workflow-gates.md does not reference workflow-brief.md');
  if (!gates.includes('workflow-chain.md')) fail('workflow-gates.md does not reference workflow-chain.md');
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
