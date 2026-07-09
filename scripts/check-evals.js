// 校验每个 skill 的 evals.json 存在且结构正确。
// evals 是 skill 行为的回归锚点：语法或结构坏掉时应在 CI 拦下。
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const skillsDir = path.join(root, 'skills');

const requiredSkills = [
  'dev-doc',
  'bug-fix',
  'biz-flow',
  'code-reading',
  'review-fix',
  'review-check',
  'review-repair',
];

function fail(message) {
  console.error('FAIL: ' + message);
  process.exitCode = 1;
}

for (const skill of requiredSkills) {
  const file = path.join(skillsDir, skill, 'evals.json');
  if (!fs.existsSync(file)) {
    fail(`Missing evals: skills/${skill}/evals.json`);
    continue;
  }
  const raw = fs.readFileSync(file, 'utf8');
  // JSON 不应带 BOM（与 SKILL.md 相反）。
  if (raw.charCodeAt(0) === 0xfeff) {
    fail(`evals.json must not start with a BOM: skills/${skill}/evals.json`);
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    fail(`Invalid JSON in skills/${skill}/evals.json: ${e.message}`);
    continue;
  }
  if (data.skill_name !== skill) {
    fail(`skill_name mismatch in skills/${skill}/evals.json: got "${data.skill_name}", want "${skill}"`);
  }
  if (!Array.isArray(data.evals) || data.evals.length === 0) {
    fail(`evals must be a non-empty array: skills/${skill}/evals.json`);
    continue;
  }
  const seenIds = new Set();
  data.evals.forEach((ev, idx) => {
    const where = `skills/${skill}/evals.json evals[${idx}]`;
    if (typeof ev.id === 'undefined') fail(`${where} missing id`);
    else if (seenIds.has(ev.id)) fail(`${where} duplicate id ${ev.id}`);
    else seenIds.add(ev.id);
    if (!ev.prompt || typeof ev.prompt !== 'string') fail(`${where} missing prompt`);
    if (!ev.expected_output || typeof ev.expected_output !== 'string') {
      fail(`${where} missing expected_output`);
    }
  });
}

if (process.exitCode) {
  console.error('evals check failed.');
} else {
  console.log(`ok evals checks passed (${requiredSkills.length} skills)`);
}
