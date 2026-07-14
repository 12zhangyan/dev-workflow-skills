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
  'api_change_classification',
  'behavior_change',
  'contract_change',
  'mixed_api_scope',
  'incremental_revision',
  'existing_doc',
  'multiple_predecessor_docs',
  'skip_api_sections',
  'workspace_external_validator',
]);
const devDocSeenTags = new Set();
const reviewLoopRequiredTags = new Set([
  'standard',
  'quick',
  'recheck',
  'no_implementation',
  'business_blocker',
  'environment_blocked',
  'no_findings',
  'review_check',
  'review_repair',
  'review_fix',
  'codex_trigger',
  'claude_trigger',
  'cursor_trigger',
  'vcs_gate',
  'nested_vcs',
  'monorepo',
]);
const reviewLoopSeenTags = new Set();
const evalCounts = new Map();
const seenTagsBySkill = new Map(requiredSkills.map((skill) => [skill, new Set()]));
const additionalRequiredTags = {
  'biz-flow': ['routing_dev_doc', 'routing_review_check', 'non_interactive_blocker', 'workflow_brief'],
  'bug-fix': ['routing_review_check', 'routing_dev_doc', 'non_interactive_blocker', 'path_conflict'],
  'code-reading': ['non_interactive_blocker', 'ambiguous_entry', 'exists_unreadable', 'token_budget'],
  'dev-doc': ['api_artifact_index', 'operation_id_consistency', 'vcs_untracked', 'next_command', 'external_test_dependency'],
  'review-check': ['nested_vcs', 'vcs_gate', 'non_interactive', 'vcs_status_unknown', 'external_test_dependency'],
  'review-fix': ['independent_review', 'finding_ids', 'nested_vcs', 'non_interactive', 'external_test_dependency'],
  'review-loop': ['no_findings_unverified', 'repair_cycle_limit', 'recheck_id', 'non_interactive', 'token_budget', 'external_test_dependency', 'windows_test_source_walk'],
  'review-repair': ['duplicate_ids', 'non_interactive', 'nested_vcs', 'vcs_gate', 'empty_findings', 'external_test_dependency'],
};

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
  evalCounts.set(skill, data.evals.length);
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
    if (skill === 'review-loop') {
      for (const tag of ev.tags || []) reviewLoopSeenTags.add(tag);
    }
    for (const tag of ev.tags || []) seenTagsBySkill.get(skill).add(tag);
    if (/TestEvidenceStatus\s*(?:=|:|标为)\s*Insufficient\b/.test(expected)) {
      fail(`${where} uses invalid TestEvidenceStatus=Insufficient; use Failed/NotProvided plus InsufficientMaterial`);
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
for (const tag of reviewLoopRequiredTags) {
  if (!reviewLoopSeenTags.has(tag)) fail(`review-loop evals missing required scenario tag: ${tag}`);
}
const totalEvalCount = [...evalCounts.values()].reduce((sum, count) => sum + count, 0);
if (totalEvalCount < 100) fail(`eval suite must contain at least 100 scenarios; got ${totalEvalCount}`);
for (const skill of requiredSkills) {
  if ((evalCounts.get(skill) || 0) < 9) fail(`skills/${skill}/evals.json must contain at least 9 scenarios`);
  for (const tag of additionalRequiredTags[skill] || []) {
    if (!seenTagsBySkill.get(skill).has(tag)) fail(`${skill} evals missing required scenario tag: ${tag}`);
  }
}

const devDocSkillPath = path.join(skillsDir, 'dev-doc', 'SKILL.md');
const devDocReferencePath = path.join(skillsDir, 'dev-doc', 'reference.md');
const devDocExamplesPath = path.join(skillsDir, 'dev-doc', 'examples.md');
for (const [file, needles] of [
  [devDocSkillPath, ['结构化工具', '多个候选提问工具', '同一问题不再重试该工具', 'IncrementalRevision', '前置文档', '不得只保留或只读取日期最近的一篇', '逐接口区分新增 / 契约变更 / 行为变更 / 仅调用', '不全量重写原接口规范', 'OPENAPI_VALIDATION_MODE=light:workspace-inline', 'YAML 校验失败误判成环境受限', '非交互/无人值守', 'EXISTS_UNREADABLE_OR_UNKNOWN', '不写 md、OpenAPI、看板或索引', 'DBA 变更申请草案', '默认建议按证据优先级']],
  [devDocReferencePath, ['文档模式：<Standard | IncrementalRevision>', '前置文档（全部必读', '承接：<主题/约束范围>', '工作区内 OpenAPI 静态校验降级', 'OPENAPI_WORKSPACE_FALLBACK_START', 'OPENAPI_VALIDATION_MODE=light:workspace-inline', '接口影响分类（涉及接口时保留）', '行为变更接口不进入 OpenAPI', '数据库变更（DBA 申请草案）', 'Plan Gate 未通过', 'Apifox 实际导入未验证']],
  [devDocExamplesPath, ['DBA 申请草案', '后续执行 AI 不得直接运行']],
]) {
  const text = fs.readFileSync(file, 'utf8');
  for (const needle of needles) {
    if (!text.includes(needle)) fail(`${path.relative(root, file)} missing dev-doc contract text: ${needle}`);
  }
}

const reviewLoopSkillPath = path.join(skillsDir, 'review-loop', 'SKILL.md');
const reviewLoopReferencePath = path.join(skillsDir, 'review-loop', 'reference.md');
for (const [file, needles] of [
  [reviewLoopSkillPath, ['review-fix → review-check → review-repair', '../review-fix/reference.md', '../review-check/reference.md', '../review-repair/reference.md', 'standard（默认）', 'quick', 'SingleAgentReview', '最多 2 个修复循环', 'VCS_OWNER', 'VCSOwnerUnknown', '最先遇到的控制标记', 'VCSGateBlocked', '明确要求 AI 执行', '禁止 `git add .`', 'TestDependencyClass', 'LiveExternal', 'PowerShell', '陈旧报告', 'walk/rglob', 'WindowsTestSourcePathMismatch', 'testCompile', 'javac/Maven 报错路径', '不自动 commit、push', '数据库始终只读']],
  [reviewLoopReferencePath, ['ReviewMode:', 'ReviewAgentMode: SingleAgentReview', 'RepairCycles:', 'TestDependencyClass:', 'TestSourcePathCheck:', 'WindowsTestSourcePathMismatch', 'EnvironmentBlocked', '自动提交：未执行']],
]) {
  const text = fs.readFileSync(file, 'utf8');
  for (const needle of needles) {
    if (!text.includes(needle)) fail(`${path.relative(root, file)} missing review-loop contract text: ${needle}`);
  }
}

const contractNeedles = [
  ['skills/_shared/interaction-policy.md', ['非交互/无人值守运行中', '推荐项不是授权', 'InsufficientMaterial']],
  ['skills/_shared/workflow-gates.md', ['VCS 证据归属', 'VCS_OWNER', 'VCSStatusUnknown', 'VCSGateBlocked', '测试依赖分级与失败归因', 'Hermetic', 'ServiceBacked', 'LiveExternal', 'TestDependencyClass']],
  ['skills/dev-doc/SKILL.md', ['scripts/validate-openapi.js', 'operationId` 非空/唯一', 'Apifox 实际导入未验证', 'TestDependencyClass']],
  ['skills/dev-doc/examples.md', ['operationIds=sendSmsCode,smsLogin']],
  ['skills/review-fix/SKILL.md', ['TestDependencyClass', 'TestEvidenceStatus=Passed', '`NotProvided`', '`NotRun`', '`EnvironmentBlocked`', '`NotApplicable`']],
  ['skills/review-check/SKILL.md', ['TestDependencyClass', 'CI 契约', '不得写成 `EnvironmentBlocked`']],
  ['skills/review-fix/reference.md', ['独立完成本次审查', '| RJ-1 |', '| BK-1 |']],
  ['skills/review-loop/SKILL.md', ['首轮最大序号', '控制在 5 个文件内']],
  ['skills/review-repair/SKILL.md', ['TestDependencyClass', '不得用伪造密钥绕过']],
  ['skills/review-repair/reference.md', ['归一化前检查 ID 唯一性', 'TestDependencyClass:']],
  ['skills/review-repair/examples.md', ['TestEvidenceStatus: Passed']],
];
for (const [rel, needles] of contractNeedles) {
  const text = fs.readFileSync(path.join(root, rel), 'utf8');
  for (const needle of needles) {
    if (!text.includes(needle)) fail(`${rel} missing cross-skill contract text: ${needle}`);
  }
}

if (process.exitCode) {
  console.error('evals check failed.');
} else {
  console.log(`ok evals checks passed (${requiredSkills.length} skills, ${totalEvalCount} scenarios)`);
}
