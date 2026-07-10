#!/usr/bin/env node
'use strict';

// 校验每个 skill 的 evals.json 存在且结构正确。
// evals 是 skill 行为的回归锚点：CI 校验语法、结构和关键场景覆盖，
// 不代表已经在真实 Claude Code / Cursor / Codex 宿主中执行了行为测试。
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const skillsDir = path.join(root, 'skills');

const requiredSkills = fs.readdirSync(skillsDir)
  .filter((name) => fs.existsSync(path.join(skillsDir, name, 'SKILL.md')))
  .sort();
const globalCoverage = {
  environmentBlocked: false,
  testAssertionTarget: false,
};
const devDocRequiredTags = new Set([
  'interactive_chat',
  'non_interactive_blocker',
  'structured_question',
  'multiple_question_tools',
  'tool_failure_fallback',
  'evidence_default',
  'exists_unreadable',
  'no_write',
  'dba_approval',
  'no_ddl_execution',
  'biz_flow',
  'review_fix',
  'review_check',
  'cross_host_output',
  'light_validation',
]);
const devDocSeenTags = new Set();

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
  let hasAccuracyBoundary = false;
  data.evals.forEach((ev, idx) => {
    const where = `skills/${skill}/evals.json evals[${idx}]`;
    if (typeof ev.id === 'undefined') fail(`${where} missing id`);
    else if (!Number.isInteger(ev.id) || ev.id <= 0) fail(`${where} id must be a positive integer`);
    else if (seenIds.has(ev.id)) fail(`${where} duplicate id ${ev.id}`);
    else seenIds.add(ev.id);
    if (!ev.prompt || typeof ev.prompt !== 'string' || !ev.prompt.trim()) fail(`${where} missing prompt`);
    if (!ev.expected_output || typeof ev.expected_output !== 'string' || !ev.expected_output.trim()) {
      fail(`${where} missing expected_output`);
    }
    if (typeof ev.tags !== 'undefined' && (
      !Array.isArray(ev.tags)
      || ev.tags.length === 0
      || ev.tags.some((tag) => typeof tag !== 'string' || !tag)
      || new Set(ev.tags).size !== ev.tags.length
    )) {
      fail(`${where} tags must be a non-empty string array when provided`);
    }
    const expected = typeof ev.expected_output === 'string' ? ev.expected_output : '';
    const joined = `${typeof ev.prompt === 'string' ? ev.prompt : ''}\n${expected}`;
    if (/(证据|材料不足|待确认|blocker|不得|不能|不应|未运行|未检查)/.test(expected)) {
      hasAccuracyBoundary = true;
    }
    if (joined.includes('environment-blocked')) globalCoverage.environmentBlocked = true;
    if (/(测试名|断言对象|目标逻辑|被测方法|没有调用目标逻辑)/.test(joined)) {
      globalCoverage.testAssertionTarget = true;
    }
    if (skill === 'dev-doc') {
      for (const tag of ev.tags || []) devDocSeenTags.add(tag);
    }
  });
  if (!hasAccuracyBoundary) {
    fail(`skills/${skill}/evals.json must include at least one evidence/accuracy boundary eval`);
  }
}

if (!globalCoverage.environmentBlocked) {
  fail('evals must include an environment-blocked verification scenario');
}
if (!globalCoverage.testAssertionTarget) {
  fail('evals must include a test assertion target/effectiveness scenario');
}
for (const tag of devDocRequiredTags) {
  if (!devDocSeenTags.has(tag)) fail(`dev-doc evals missing required scenario tag: ${tag}`);
}

const devDocSkillPath = path.join(skillsDir, 'dev-doc', 'SKILL.md');
const devDocReferencePath = path.join(skillsDir, 'dev-doc', 'reference.md');
const devDocExamplesPath = path.join(skillsDir, 'dev-doc', 'examples.md');
for (const [file, needles] of [
  [devDocSkillPath, ['结构化工具', '多个候选提问工具', '同一问题不再重试该工具', '非交互/无人值守', 'EXISTS_UNREADABLE_OR_UNKNOWN', '不写 md、OpenAPI、看板或索引', 'DBA 变更申请草案', '默认建议按证据优先级']],
  [devDocReferencePath, ['数据库变更（DBA 申请草案）', 'Plan Gate 未通过', '轻量结构校验通过，Apifox 实际导入未验证']],
  [devDocExamplesPath, ['DBA 申请草案', '后续执行 AI 不得直接运行']],
]) {
  const text = fs.readFileSync(file, 'utf8');
  for (const needle of needles) {
    if (!text.includes(needle)) fail(`${path.relative(root, file)} missing dev-doc contract text: ${needle}`);
  }
}

if (process.exitCode) {
  console.error('evals check failed.');
} else {
  console.log(`ok evals checks passed (${requiredSkills.length} skills)`);
}
