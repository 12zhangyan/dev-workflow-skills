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
  'review-check'
];

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

if (!fs.existsSync(shared)) {
  fail('Missing shared interaction policy: skills/_shared/interaction-policy.md');
} else {
  const text = fs.readFileSync(shared, 'utf8');
  for (const needle of ['证据预填', '风险分级', '需求冲突', '材料不足', 'Skill 反馈块']) {
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
  'review-check/reference.md'
];

for (const rel of feedbackReferences) {
  const file = path.join(root, 'skills', rel);
  if (!fs.existsSync(file)) {
    fail(`Missing reference file: skills/${rel}`);
    continue;
  }
  const text = fs.readFileSync(file, 'utf8');
  if (!text.includes('【Skill 反馈给 Codex】')) {
    fail(`Reference output format missing skill feedback block: skills/${rel}`);
  }
}

if (!process.exitCode) console.log('Interaction policy references are in sync.');
