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
const evalSpecs = [
  ...requiredSkills.map((skill) => ({ key: skill, rel: `${skill}/evals.json`, expectedName: skill })),
  { key: 'review-check', rel: 'yan-code-review/modes/check/evals.json', expectedName: 'review-check' },
  { key: 'review-repair', rel: 'yan-code-review/modes/repair/evals.json', expectedName: 'review-repair' },
  { key: 'review-loop', rel: 'yan-code-review/modes/loop/evals.json', expectedName: 'review-loop' },
  { key: 'review-fix', rel: 'yan-code-review/modes/package/evals.json', expectedName: 'review-fix' },
  { key: 'code-reading', rel: 'yan-project-analysis/modes/understanding/evals.json', expectedName: 'code-reading' },
  { key: 'bug-fix', rel: 'yan-project-analysis/modes/incident/evals.json', expectedName: 'bug-fix' },
  { key: 'biz-flow', rel: 'yan-project-analysis/modes/business/evals.json', expectedName: 'biz-flow' },
];
const evalCounts = new Map();

function fail(message) {
  console.error('FAIL: ' + message);
  process.exitCode = 1;
}

function isJsonObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateDocumentShape(data, where) {
  return isJsonObject(data) ? [] : [`${where} root must be an object`];
}

function usableTags(ev) {
  if (!isJsonObject(ev) || !Array.isArray(ev.tags)) return [];
  return ev.tags.filter((tag) => typeof tag === 'string' && tag.trim());
}

function normalizeEvalPrompt(value) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

const legacyBriefFieldPattern = /\b(?:stage|source|artifacts|changed|tests|openFindings|nextCommand|tokenHint)\b/i;
const briefProducerPattern = /(?:输出|生成|写入|产出|新生成)[^。；\n]{0,100}Workflow Brief|Workflow Brief[^。；\n]{0,100}(?:输出|生成|写入|产出|新生成)/i;

function legacyBriefProducerFields(value) {
  if (typeof value !== 'string' || !briefProducerPattern.test(value)) return [];
  const positiveClauses = value
    .split(/[。；\n]/)
    .filter((clause) => !/(?:不要求|不使用|不得使用|不再使用|兼容)[^。；\n]*(?:旧字段|nextCommand|tokenHint|stage|source|artifacts|changed|tests|openFindings)/i.test(clause));
  const matches = positiveClauses.join('\n').match(new RegExp(legacyBriefFieldPattern.source, 'gi')) || [];
  return [...new Set(matches.map((field) => field.toLowerCase()))];
}

function obsoleteReviewExpectation(value) {
  return /BoardPublishStatus\s*[:=]\s*NotRequested/.test(value)
    || /(?:最多|上限(?:为)?|固定)\s*(?:两|二|2)\s*(?:个)?\s*(?:修复循环|轮)/.test(value);
}

function validateEvalShape(ev, where, seenIds, seenPrompts) {
  const errors = [];
  if (!isJsonObject(ev)) {
    errors.push(`${where} must be an object`);
    return errors;
  }
  if (typeof ev.id === 'undefined') errors.push(`${where} missing id`);
  else if (!Number.isInteger(ev.id) || ev.id <= 0) errors.push(`${where} id must be a positive integer`);
  else if (seenIds.has(ev.id)) errors.push(`${where} duplicate id ${ev.id}`);
  else seenIds.add(ev.id);
  const normalizedPrompt = normalizeEvalPrompt(ev.prompt);
  if (!normalizedPrompt) {
    errors.push(`${where} missing prompt`);
  } else if (seenPrompts.has(normalizedPrompt)) {
    errors.push(`${where} duplicates prompt from ${seenPrompts.get(normalizedPrompt)}`);
  } else {
    seenPrompts.set(normalizedPrompt, where);
  }
  if (!ev.expected_output || typeof ev.expected_output !== 'string' || !ev.expected_output.trim()) {
    errors.push(`${where} missing expected_output`);
  }
  if (typeof ev.tags !== 'undefined' && (
    !Array.isArray(ev.tags)
    || ev.tags.length === 0
    || ev.tags.some((tag) => typeof tag !== 'string' || !tag.trim())
    || new Set(ev.tags).size !== ev.tags.length
  )) {
    errors.push(`${where} tags must be a non-empty string array when provided`);
  }
  return errors;
}

function runSelfTest() {
  const failures = [];
  if (!validateDocumentShape(null, 'fixture document').includes('fixture document root must be an object')) {
    failures.push('null document fixture did not produce a root object diagnostic');
  }
  for (const [value, label] of [[null, 'null'], ['bad', 'string'], [[], 'array']]) {
    const errors = validateEvalShape(value, `fixture ${label}`, new Set(), new Map());
    if (!errors.includes(`fixture ${label} must be an object`)) {
      failures.push(`${label} fixture did not produce an object-shape diagnostic`);
    }
  }

  const valid = { id: 1, prompt: 'review this change', expected_output: 'return findings', tags: ['routing'] };
  const seenIds = new Set();
  const seenPrompts = new Map();
  if (validateEvalShape(valid, 'fixture valid', seenIds, seenPrompts).length !== 0) {
    failures.push('valid fixture was rejected');
  }
  const duplicateErrors = validateEvalShape(
    { ...valid, prompt: 'different review prompt' },
    'fixture duplicate',
    seenIds,
    seenPrompts,
  );
  if (!duplicateErrors.includes('fixture duplicate duplicate id 1')) {
    failures.push('duplicate id fixture was not rejected');
  }
  const duplicatePromptErrors = validateEvalShape(
    { ...valid, id: 2, prompt: '  review   this change  ' },
    'fixture duplicate-prompt',
    seenIds,
    seenPrompts,
  );
  if (!duplicatePromptErrors.includes('fixture duplicate-prompt duplicates prompt from fixture valid')) {
    failures.push('whitespace-normalized duplicate prompt fixture was not rejected');
  }
  const blankTagErrors = validateEvalShape(
    { id: 2, prompt: 'review this change', expected_output: 'return findings', tags: ['   '] },
    'fixture blank-tag',
    new Set(),
    new Map(),
  );
  if (!blankTagErrors.includes('fixture blank-tag tags must be a non-empty string array when provided')) {
    failures.push('blank tag fixture was not rejected');
  }
  const scalarTagFixture = { id: 3, prompt: 'review this change', expected_output: 'return findings', tags: 42 };
  const scalarTagErrors = validateEvalShape(scalarTagFixture, 'fixture scalar-tag', new Set(), new Map());
  if (!scalarTagErrors.includes('fixture scalar-tag tags must be a non-empty string array when provided')) {
    failures.push('scalar tag fixture was not rejected');
  }
  if (usableTags(scalarTagFixture).length !== 0) {
    failures.push('scalar tag fixture was not normalized to an empty safe tag list');
  }
  const legacyProducer = legacyBriefProducerFields('应输出 Workflow Brief，nextCommand 指向 repair，source 作为索引。');
  if (!legacyProducer.includes('nextcommand') || !legacyProducer.includes('source')) {
    failures.push('legacy Workflow Brief producer fixture was not rejected');
  }
  if (legacyBriefProducerFields('输入 Brief 的 source/changed 仅用于兼容读取，不生成新 Brief。').length !== 0) {
    failures.push('legacy Workflow Brief input compatibility fixture was treated as a producer');
  }
  if (legacyBriefProducerFields('应输出 v2 Workflow Brief，只使用 task/state/scope/evidence/verification/open/next。').length !== 0) {
    failures.push('v2 Workflow Brief producer fixture was rejected');
  }
  for (const value of ['BoardPublishStatus: NotRequested', '最多两个修复循环', '固定2轮']) {
    if (!obsoleteReviewExpectation(value)) failures.push('obsolete review expectation was not rejected');
  }
  if (obsoleteReviewExpectation('按进展停止，不设固定修复轮次；未发布不输出看板状态。')) {
    failures.push('adaptive review expectation was rejected');
  }

  if (failures.length > 0) {
    for (const message of failures) console.error('FAIL: ' + message);
    return false;
  }
  console.log('ok eval structure self-test passed');
  return true;
}

if (process.argv.includes('--self-test')) {
  process.exit(runSelfTest() ? 0 : 1);
}

for (const spec of evalSpecs) {
  const skill = spec.key;
  const file = path.join(skillsDir, spec.rel);
  const rel = `skills/${spec.rel}`;
  if (!fs.existsSync(file)) {
    fail(`Missing evals: ${rel}`);
    continue;
  }
  const raw = fs.readFileSync(file, 'utf8');
  // JSON 不应带 BOM（与 SKILL.md 相反）。
  if (raw.charCodeAt(0) === 0xfeff) {
    fail(`evals.json must not start with a BOM: ${rel}`);
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    fail(`Invalid JSON in ${rel}: ${e.message}`);
    continue;
  }
  for (const error of validateDocumentShape(data, rel)) fail(error);
  if (!isJsonObject(data)) continue;
  if (data.skill_name !== spec.expectedName) {
    fail(`skill_name mismatch in ${rel}: got "${data.skill_name}", want "${spec.expectedName}"`);
  }
  if (!Array.isArray(data.evals) || data.evals.length === 0) {
    fail(`evals must be a non-empty array: ${rel}`);
    continue;
  }
  evalCounts.set(skill, data.evals.length);
  const seenIds = new Set();
  const seenPrompts = new Map();
  let hasAccuracyBoundary = false;
  data.evals.forEach((ev, idx) => {
    const where = `${rel} evals[${idx}]`;
    for (const error of validateEvalShape(ev, where, seenIds, seenPrompts)) fail(error);
    if (!isJsonObject(ev)) return;
    const tags = usableTags(ev);
    const expected = typeof ev.expected_output === 'string' ? ev.expected_output : '';
    if (spec.rel.startsWith('yan-code-review/') && obsoleteReviewExpectation(expected)) {
      fail(`${where} restores retired review requirements (unrequested board status or a fixed repair cap)`);
    }
    if (/(证据|材料不足|待确认|blocker|不得|不能|不应|未运行|未检查)/.test(expected)) {
      hasAccuracyBoundary = true;
    }
    if (/TestEvidenceStatus\s*(?:=|:|标为)\s*Insufficient\b/.test(expected)) {
      fail(`${where} uses invalid TestEvidenceStatus=Insufficient; use Failed/NotProvided plus InsufficientMaterial`);
    }
    const legacyProducerFields = legacyBriefProducerFields(expected);
    if (legacyProducerFields.length > 0) {
      fail(`${where} requires a new Workflow Brief producer to use legacy fields: ${legacyProducerFields.join(', ')}; new producers must use task/state/scope/evidence/verification/open/next`);
    }
  });
  if (!hasAccuracyBoundary) {
    fail(`${rel} must include at least one evidence/accuracy boundary eval`);
  }
}

const totalEvalCount = [...evalCounts.values()].reduce((sum, count) => sum + count, 0);

if (process.exitCode) {
  console.error('evals check failed.');
} else {
  console.log(`ok evals checks passed (${requiredSkills.length} public skills, ${evalSpecs.length} eval suites, ${totalEvalCount} scenarios)`);
}
