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
  { key: 'review-check', rel: 'code-review/modes/check/evals.json', expectedName: 'review-check' },
  { key: 'review-repair', rel: 'code-review/modes/repair/evals.json', expectedName: 'review-repair' },
  { key: 'review-loop', rel: 'code-review/modes/loop/evals.json', expectedName: 'review-loop' },
  { key: 'review-fix', rel: 'code-review/modes/package/evals.json', expectedName: 'review-fix' },
  { key: 'code-reading', rel: 'project-analysis/modes/understanding/evals.json', expectedName: 'code-reading' },
  { key: 'bug-fix', rel: 'project-analysis/modes/incident/evals.json', expectedName: 'bug-fix' },
  { key: 'biz-flow', rel: 'project-analysis/modes/business/evals.json', expectedName: 'biz-flow' },
];
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
  'compact_mode',
  'compact_upgrade_guard',
  'resolved_conflict',
  'superpowers_bridge',
]);
const devDocSeenTags = new Set();
const reviewLoopRequiredTags = new Set([
  'standard',
  'quick',
  'quick_review_receipt',
  'toolchain_recovery',
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
const seenTagsBySkill = new Map(evalSpecs.map(({ key }) => [key, new Set()]));
const additionalRequiredTags = {
  'biz-flow': ['routing_bug_fix', 'routing_dev_doc', 'routing_review_check', 'non_interactive_blocker', 'workflow_brief'],
  'bug-fix': ['routing_review_check', 'routing_dev_doc', 'routing_biz_flow', 'non_interactive_blocker', 'path_conflict'],
  'code-reading': ['non_interactive_blocker', 'ambiguous_entry', 'exists_unreadable', 'token_budget', 'impact_analysis', 'chat_only', 'routing_dev_doc', 'routing_review_check', 'routing_review_repair', 'routing_biz_flow'],
  'conversation-handoff': ['template_path', 'non_interactive_blocker'],
  'dev-doc': ['api_artifact_index', 'operation_id_consistency', 'vcs_untracked', 'next_command', 'external_test_dependency', 'routing_code_reading'],
  'review-check': ['nested_vcs', 'vcs_gate', 'non_interactive', 'vcs_status_unknown', 'external_test_dependency', 'routing_review_repair', 'routing_review_loop'],
  'review-fix': ['independent_review', 'finding_ids', 'nested_vcs', 'non_interactive', 'external_test_dependency', 'superpowers_review_bridge', 'routing_review_check', 'routing_review_repair', 'routing_review_loop'],
  'review-loop': ['no_findings_unverified', 'repair_cycle_limit', 'recheck_id', 'non_interactive', 'token_budget', 'external_test_dependency', 'windows_test_source_walk', 'legacy_review_form_input', 'host_isolation', 'vcs_add_policy', 'review_fix_path_canonical'],
  'review-repair': ['duplicate_ids', 'non_interactive', 'nested_vcs', 'vcs_gate', 'empty_findings', 'external_test_dependency', 'routing_review_loop'],
};

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
    const joined = `${typeof ev.prompt === 'string' ? ev.prompt : ''}\n${expected}`;
    if (/(证据|材料不足|待确认|blocker|不得|不能|不应|未运行|未检查)/.test(expected)) {
      hasAccuracyBoundary = true;
    }
    if (joined.includes('environment-blocked')) globalCoverage.environmentBlocked = true;
    if (/(测试名|断言对象|目标逻辑|被测方法|没有调用目标逻辑)/.test(joined)) {
      globalCoverage.testAssertionTarget = true;
    }
    if (skill === 'dev-doc') {
      for (const tag of tags) devDocSeenTags.add(tag);
    }
    if (skill === 'review-loop') {
      for (const tag of tags) reviewLoopSeenTags.add(tag);
    }
    for (const tag of tags) seenTagsBySkill.get(skill).add(tag);
    if (/TestEvidenceStatus\s*(?:=|:|标为)\s*Insufficient\b/.test(expected)) {
      fail(`${where} uses invalid TestEvidenceStatus=Insufficient; use Failed/NotProvided plus InsufficientMaterial`);
    }
  });
  if (!hasAccuracyBoundary) {
    fail(`${rel} must include at least one evidence/accuracy boundary eval`);
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
for (const { key: skill, rel } of evalSpecs) {
  const minimum = ['code-review', 'project-analysis'].includes(skill) ? 6 : 9;
  if ((evalCounts.get(skill) || 0) < minimum) fail(`skills/${rel} must contain at least ${minimum} scenarios`);
  for (const tag of additionalRequiredTags[skill] || []) {
    if (!seenTagsBySkill.get(skill).has(tag)) fail(`${skill} evals missing required scenario tag: ${tag}`);
  }
}

const devDocSkillPath = path.join(skillsDir, 'dev-doc', 'SKILL.md');
const devDocReferencePath = path.join(skillsDir, 'dev-doc', 'reference.md');
const devDocExamplesPath = path.join(skillsDir, 'dev-doc', 'examples.md');
for (const [file, needles] of [
  [devDocSkillPath, ['结构化工具', '多个候选提问工具', '同一问题不再重试该工具', 'IncrementalRevision', 'conflicts(status=resolved)', '旧口径、否决证据、最终口径和实现禁令', '不得把它继续算作 blocker', '`Compact`', '最多 2 个生产代码切点', '跳过 Step 5.1、5.5、5.6', '升级为 `Standard`', '前置文档', '不得只保留或只读取日期最近的一篇', '逐接口区分新增 / 契约变更 / 行为变更 / 仅调用', '不全量重写原接口规范', 'OPENAPI_VALIDATION_MODE=light:workspace-inline', 'YAML 校验失败误判成环境受限', '非交互/无人值守', 'EXISTS_UNREADABLE_OR_UNKNOWN', '不写 md、OpenAPI、看板或索引', 'DBA 变更申请草案', '默认建议按证据优先级']],
  [devDocReferencePath, ['精简文档模板', '文档模式：Compact', 'NotApplicable (Compact)', '最多两个生产代码切点', '文档模式：<Standard | IncrementalRevision>', '前置文档（全部必读', '需求冲突（已裁决）', 'conflicts(status=resolved)', '已裁决冲突不进入', '承接：<主题/约束范围>', '工作区内 OpenAPI 静态校验降级', 'OPENAPI_WORKSPACE_FALLBACK_START', 'OPENAPI_VALIDATION_MODE=light:workspace-inline', '接口影响分类（涉及接口时保留）', '行为变更接口不进入 OpenAPI', '数据库变更（DBA 申请草案）', 'Plan Gate 未通过', 'Apifox 实际导入未验证']],
  [devDocExamplesPath, ['DBA 申请草案', '后续执行 AI 不得直接运行']],
]) {
  const text = fs.readFileSync(file, 'utf8');
  for (const needle of needles) {
    if (!text.includes(needle)) fail(`${path.relative(root, file)} missing dev-doc contract text: ${needle}`);
  }
}

const reviewLoopSkillPath = path.join(skillsDir, 'code-review', 'modes', 'loop', 'mode.md');
const reviewLoopReferencePath = path.join(skillsDir, 'code-review', 'modes', 'loop', 'reference.md');
for (const [file, needles] of [
  [reviewLoopSkillPath, ['review-fix → review-check → review-repair', '../package/reference.md', '../check/reference.md', '../repair/reference.md', 'quick（小范围实现默认）', '未纳管不等于不可读取或不可验证', 'ToolchainRecovery', 'FallbackValidation=Passed', 'ReviewReceipt', 'NotRequiredNoCodeChange', 'SingleAgentReview', '最多 2 个修复循环', 'VCS_OWNER', 'VCSOwnerUnknown', '最先遇到的控制标记', 'VCSGateBlocked', 'VcsAddPolicy: host-required', 'VcsAddPolicy: user-authorize-only', 'VcsAddPolicySource', 'PolicyConflict: review-loop-default-no-add -> host-required', '第一次 VCS 操作前', '禁止 `git add .`', 'TestDependencyClass', 'LiveExternal', 'PowerShell', '陈旧报告', 'walk/rglob', 'WindowsTestSourcePathMismatch', 'testCompile', 'javac/Maven 报错路径', 'docs/review-fix/<日期>/<任务>-review-task.md', '不得新建 `docs/review-form` 任务包', 'LegacyReviewTaskInput', 'legacy-review-form-input', 'review-fix-sibling-missing', '不得因为运行在 Cursor/Codex 就按产品名探测其他宿主', '不自动 commit、push', '数据库始终只读']],
  [reviewLoopReferencePath, ['ReviewMode:', 'ReviewAgentMode: SingleAgentReview', 'ReviewTaskTemplateSource:', 'LegacyReviewTaskInput:', 'CompatibilityFlags:', 'legacy-review-form-input', 'RepairCycles:', 'TestDependencyClass:', 'TestSourcePathCheck:', 'WindowsTestSourcePathMismatch', 'EnvironmentBlocked', '自动提交：未执行']],
]) {
  const text = fs.readFileSync(file, 'utf8');
  for (const needle of needles) {
    if (!text.includes(needle)) fail(`${path.relative(root, file)} missing review-loop contract text: ${needle}`);
  }
}

const contractNeedles = [
  ['skills/_shared/interaction-policy.md', ['非交互/无人值守运行中', '推荐项不是授权', 'InsufficientMaterial']],
  ['skills/_shared/workflow-gates.md', ['VCS 证据归属', 'VCS_OWNER', 'VCSStatusUnknown', 'VCSGateBlocked', 'VcsAddPolicy', 'host-required', 'user-authorize-only', 'PolicyConflict', '测试依赖分级与失败归因', 'Hermetic', 'ServiceBacked', 'LiveExternal', 'TestDependencyClass']],
  ['skills/dev-doc/SKILL.md', ['scripts/validate-openapi.js', 'operationId` 非空/唯一', 'Apifox 实际导入未验证', 'TestDependencyClass']],
  ['skills/dev-doc/examples.md', ['operationIds=sendSmsCode,smsLogin']],
  ['skills/project-analysis/modes/understanding/mode.md', ['`CodeMap`（默认）', '`ImpactAnalysis`（只读影响分析）', '严格零写入模式', '不得进入 Step 4/4.5', 'artifacts: 无（聊天只读分析）']],
  ['skills/project-analysis/modes/understanding/reference.md', ['AnalysisMode: ImpactAnalysis', 'WritePolicy: NoWorkspaceWrites', '契约对比', '明确受影响/不受影响/待确认', 'artifacts: 无（ImpactAnalysis 聊天只读分析）']],
  ['skills/conversation-handoff/SKILL.md', ['同一 skill 目录下的完整模板', '[reference.md](reference.md)']],
  ['skills/code-review/modes/package/mode.md', ['TestDependencyClass', 'TestEvidenceStatus=Passed', '`NotProvided`', '`NotRun`', '`EnvironmentBlocked`', '`NotApplicable`']],
  ['skills/code-review/modes/check/mode.md', ['TestDependencyClass', 'CI 契约', '不得写成 `EnvironmentBlocked`']],
  ['skills/code-review/modes/package/reference.md', ['独立完成本次审查', '| RJ-1 |', '| BK-1 |']],
  ['skills/code-review/modes/loop/mode.md', ['首轮最大序号', '控制在 5 个文件内']],
  ['skills/code-review/modes/repair/mode.md', ['TestDependencyClass', '不得用伪造密钥绕过']],
  ['skills/code-review/modes/repair/reference.md', ['归一化前检查 ID 唯一性', 'TestDependencyClass:']],
];
for (const [rel, needles] of contractNeedles) {
  const text = fs.readFileSync(path.join(root, rel), 'utf8');
  for (const needle of needles) {
    if (!text.includes(needle)) fail(`${rel} missing cross-skill contract text: ${needle}`);
  }
}

const conversationHandoffSkill = fs.readFileSync(path.join(root, 'skills/conversation-handoff/SKILL.md'), 'utf8');
if (conversationHandoffSkill.includes('references/template.md')) {
  fail('skills/conversation-handoff/SKILL.md must not reference missing references/template.md');
}

const reviewLoopSkillText = fs.readFileSync(reviewLoopSkillPath, 'utf8');
if (/([~$][^\n]*|[A-Za-z]:\\[^\n]*)\.claude[\\/]skills[\\/]review-form/i.test(reviewLoopSkillText)) {
  fail('skills/code-review/modes/loop/mode.md must not hardcode a Claude review-form skill path');
}

if (process.exitCode) {
  console.error('evals check failed.');
} else {
  console.log(`ok evals checks passed (${requiredSkills.length} public skills, ${evalSpecs.length} eval suites, ${totalEvalCount} scenarios)`);
}
