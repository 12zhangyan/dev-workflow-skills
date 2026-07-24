#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const skillsDir = path.join(root, 'skills');
const skillNames = fs.readdirSync(skillsDir)
  .filter((name) => fs.existsSync(path.join(skillsDir, name, 'SKILL.md')))
  .sort();
const requiredFields = [
  'stage',
  'task',
  'source',
  'artifacts',
  'changed',
  'vcs',
  'tests',
  'api',
  'openFindings',
  'next',
  'nextCommand',
  'tokenHint'
];

let failed = false;

function fail(message) {
  failed = true;
  console.error('FAIL: ' + message);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8').replace(/^\uFEFF/, '');
}

function validateText(rel, text, requireBrief) {
  const errors = [];
  const report = (message) => errors.push(message);
  const lines = text.split(/\r?\n/);
  const markerLines = [];
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    if (lines[lineIndex].trim() === '【Workflow Brief】') markerLines.push(lineIndex);
  }
  if (markerLines.length === 0) {
    if (requireBrief) report(`${rel} missing Workflow Brief template`);
    return errors;
  }
  markerLines.forEach((startLine, i) => {
    const blockLines = [lines[startLine]];
    for (const line of lines.slice(startLine + 1)) {
      if (!line.trim() || /^(?:`{3,}|~{3,})$/.test(line.trim())) break;
      blockLines.push(line);
    }
    const fieldLines = blockLines.slice(1).map((line) => {
      const match = line.match(/^([A-Za-z][A-Za-z0-9]*):\s*(.*)$/);
      return match ? { name: match[1], value: match[2] } : null;
    });

    if (blockLines.length > 14) {
      report(`${rel} Workflow Brief #${i + 1} exceeds 14 lines`);
    }
    if (fieldLines.some((field) => field === null)) {
      report(`${rel} Workflow Brief #${i + 1} contains a non-field line`);
      return;
    }
    const actualFields = fieldLines.map((field) => field.name);
    if (actualFields.join('|') !== requiredFields.join('|')) {
      report(`${rel} Workflow Brief #${i + 1} field order mismatch: ${actualFields.join(', ')}`);
    }
    const counts = new Map();
    for (const name of actualFields) counts.set(name, (counts.get(name) || 0) + 1);
    for (const name of requiredFields) {
      if (!counts.has(name)) report(`${rel} Workflow Brief #${i + 1} missing field: ${name}`);
      else if (counts.get(name) > 1) report(`${rel} Workflow Brief #${i + 1} duplicate field: ${name}`);
    }
    for (const name of counts.keys()) {
      if (!requiredFields.includes(name)) report(`${rel} Workflow Brief #${i + 1} unknown field: ${name}`);
    }
    for (const field of fieldLines) {
      if (!field.value.trim()) {
        report(`${rel} Workflow Brief #${i + 1} has blank field: ${field.name}`);
      }
    }
    const values = Object.fromEntries(fieldLines.map((field) => [field.name, field.value]));
    if (typeof values.tests === 'string') {
      for (const key of ['class=', 'command/result=']) {
        if (!values.tests.includes(key)) report(`${rel} Workflow Brief #${i + 1} tests field missing ${key}`);
      }
      const isTestTemplate = values.tests.includes('<');
      const isNotApplicable = values.tests.includes('class=NotApplicable');
      if (isTestTemplate && !isNotApplicable && !values.tests.includes('environment-blocked')) {
        report(`${rel} Workflow Brief #${i + 1} test template must preserve environment-blocked output guidance`);
      }
    }
    if (typeof values.vcs === 'string') {
      for (const key of ['owner=', 'tracked=', 'untracked=']) {
        if (!values.vcs.includes(key)) report(`${rel} Workflow Brief #${i + 1} vcs field missing ${key}`);
      }
    }
    if (typeof values.api === 'string') {
      for (const key of ['spec=', 'index=', 'operationIds=']) {
        if (!values.api.includes(key)) report(`${rel} Workflow Brief #${i + 1} api field missing ${key}`);
      }
    }
    if (
      typeof values.openFindings === 'string'
      && /rejected/i.test(values.openFindings)
      && !/(不进入|单独)/.test(values.openFindings)
    ) {
      report(`${rel} Workflow Brief #${i + 1} must not treat rejected findings as open`);
    }
    if (typeof values.next === 'string' && typeof values.nextCommand === 'string') {
      const next = values.next.trim();
      const nextCommand = values.nextCommand.trim();
      if (nextCommand === '无' && next !== '无') {
        report(`${rel} Workflow Brief #${i + 1} nextCommand cannot be empty when next has an action`);
      }
      if (/^<?人工/.test(next) && !/人工[:：]/.test(nextCommand)) {
        report(`${rel} Workflow Brief #${i + 1} manual next action must use an 人工： nextCommand`);
      }
      if (nextCommand.includes('对应的自然语言 skill 调用')) {
        report(`${rel} Workflow Brief #${i + 1} nextCommand must provide the concrete skill invocation`);
      }
      for (const branch of ['Passed', 'Blocked', 'EnvironmentBlocked', 'deferred-next-batch']) {
        const declaresBranch = next.includes(`${branch}：`) || next.includes(`${branch}:`);
        if (declaresBranch && !nextCommand.includes(branch)) {
          report(`${rel} Workflow Brief #${i + 1} nextCommand missing ${branch} branch`);
        }
      }
      for (const match of nextCommand.matchAll(/\b([a-z][a-z0-9-]+) skill\b/g)) {
        if (!skillNames.includes(match[1])) {
          report(`${rel} Workflow Brief #${i + 1} nextCommand references unknown skill: ${match[1]}`);
        }
      }
    }
    if (typeof values.tokenHint === 'string' && !values.tokenHint.includes('首轮最多 5 个文件')) {
      report(`${rel} Workflow Brief #${i + 1} tokenHint must cap first-pass reads at 5 files`);
    }
  });
  return errors;
}

function checkFile(rel, requireBrief) {
  for (const error of validateText(rel, read(rel), requireBrief)) fail(error);
}

function runSelfTest() {
  const fourTicks = '`'.repeat(4);
  const valid = [
    '说明：`【Workflow Brief】` 是交接协议，不是这里的模板起点。',
    '',
    '【Workflow Brief】',
    'stage: PlanGate',
    'task: demo',
    'source: user request',
    'artifacts: docs/demo.md',
    'changed: 无',
    'vcs: owner=none; tracked=NotApplicable; untracked=NotApplicable',
    'tests: class=NotApplicable; command/result=未运行',
    'api: spec=无; index=无; operationIds=无',
    'openFindings: 无',
    'next: 人工确认',
    'nextCommand: 人工：确认 demo 结果',
    'tokenHint: 首轮最多 5 个文件',
    fourTicks,
  ].join('\n');
  const malformed = valid
    .replace(/^vcs:.*\n/m, '')
    .replace(/^api:.*\n/m, '')
    .replace('tests: class=NotApplicable; command/result=未运行', 'tests: command/result=未运行')
    .replace('openFindings: 无', 'openFindings: rejected')
    .replace('tokenHint: 首轮最多 5 个文件', 'tokenHint: 首轮最多 8 个文件');

  const problems = [];
  const validErrors = validateText('valid.md', valid, true);
  if (validErrors.length > 0) problems.push(`valid brief rejected: ${validErrors.join(' | ')}`);
  const malformedErrors = validateText('malformed.md', malformed, true);
  for (const needle of [
    'field order mismatch',
    'missing field: vcs',
    'missing field: api',
    'tests field missing class=',
    'must not treat rejected findings as open',
    'tokenHint must cap first-pass reads at 5 files',
  ]) {
    if (!malformedErrors.some((error) => error.includes(needle))) {
      problems.push(`malformed brief missing diagnostic: ${needle}`);
    }
  }
  const emptyManual = valid.replace('nextCommand: 人工：确认 demo 结果', 'nextCommand: 无');
  const emptyManualErrors = validateText('empty-manual.md', emptyManual, true);
  if (!emptyManualErrors.some((error) => error.includes('nextCommand cannot be empty'))) {
    problems.push('manual next action with empty nextCommand was not rejected');
  }
  const unknownSkill = valid.replace(
    'nextCommand: 人工：确认 demo 结果',
    'nextCommand: 使用 missing-skill skill 继续',
  );
  const unknownSkillErrors = validateText('unknown-skill.md', unknownSkill, true);
  if (!unknownSkillErrors.some((error) => error.includes('unknown skill: missing-skill'))) {
    problems.push('unknown skill nextCommand was not rejected');
  }
  const missingBranch = valid
    .replace('next: 人工确认', 'next: <Blocked：补信息；EnvironmentBlocked：修环境>')
    .replace('nextCommand: 人工：确认 demo 结果', 'nextCommand: <Blocked：补信息>');
  const missingBranchErrors = validateText('missing-branch.md', missingBranch, true);
  if (!missingBranchErrors.some((error) => error.includes('missing EnvironmentBlocked branch'))) {
    problems.push('missing nextCommand status branch was not rejected');
  }
  if (problems.length > 0) {
    for (const problem of problems) console.error('FAIL: ' + problem);
    process.exit(1);
  }
  console.log('ok Workflow Brief validator self-test passed');
  process.exit(0);
}

if (process.argv.includes('--self-test')) runSelfTest();

const sharedBriefRel = 'skills/_shared/workflow-brief.md';
const sharedBrief = read(sharedBriefRel);
checkFile(sharedBriefRel, true);
if (!sharedBrief.includes('deferred/deferred-next-batch')) {
  fail(`${sharedBriefRel} openFindings must distinguish deferred from deferred-next-batch`);
}

for (const [skill, templateRel] of [
  ['yan-dev-doc', 'skills/yan-dev-doc/completion.md'],
  ['yan-conversation-handoff', 'skills/yan-conversation-handoff/reference.md'],
]) {
  checkFile(templateRel, true);
  const examplesRel = `skills/${skill}/examples.md`;
  if (fs.existsSync(path.join(root, examplesRel))) checkFile(examplesRel, false);
}
for (const rel of [
  'skills/yan-project-analysis/modes/incident/reference.md',
  'skills/yan-project-analysis/modes/business/reference.md',
  'skills/yan-project-analysis/modes/understanding/reference.md',
  'skills/yan-code-review/modes/package/completion.md',
  'skills/yan-code-review/modes/check/reference.md',
  'skills/yan-code-review/modes/repair/reference.md',
  'skills/yan-code-review/modes/loop/reference.md',
]) checkFile(rel, true);

if (failed) process.exit(1);
console.log(`ok Workflow Brief checks passed (${skillNames.length} skills)`);
