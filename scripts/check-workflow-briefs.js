#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const skillsDir = path.join(root, 'skills');
const skillNames = fs.readdirSync(skillsDir)
  .filter((name) => fs.existsSync(path.join(skillsDir, name, 'SKILL.md')))
  .sort();
const requiredFields = ['task', 'scope', 'evidence', 'next'];
const optionalFields = ['state', 'verification', 'open', 'inFlight', 'vcs', 'api'];
const allowedFields = new Set([...requiredFields, ...optionalFields]);
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
  const lines = text.split(/\r?\n/);
  const markerLines = lines.flatMap((line, index) => line.trim() === '【Workflow Brief】' ? [index] : []);
  if (markerLines.length === 0) {
    if (requireBrief) errors.push(`${rel} missing Workflow Brief template`);
    return errors;
  }

  markerLines.forEach((startLine, index) => {
    const blockLines = [lines[startLine]];
    for (const line of lines.slice(startLine + 1)) {
      if (!line.trim() || /^(?:`{3,}|~{3,})$/.test(line.trim())) break;
      blockLines.push(line);
    }
    const fields = blockLines.slice(1).map((line) => {
      const match = line.match(/^([A-Za-z][A-Za-z0-9]*):\s*(.*)$/);
      return match ? { name: match[1], value: match[2].trim() } : null;
    });
    if (fields.some((field) => field === null)) {
      errors.push(`${rel} Workflow Brief #${index + 1} contains a non-field line`);
      return;
    }
    const counts = new Map();
    for (const field of fields) counts.set(field.name, (counts.get(field.name) || 0) + 1);
    for (const name of requiredFields) {
      if (!counts.has(name)) errors.push(`${rel} Workflow Brief #${index + 1} missing field: ${name}`);
    }
    for (const [name, count] of counts) {
      if (!allowedFields.has(name)) errors.push(`${rel} Workflow Brief #${index + 1} unknown producer field: ${name}`);
      if (count > 1) errors.push(`${rel} Workflow Brief #${index + 1} duplicate field: ${name}`);
    }
    for (const field of fields) {
      if (!field.value) errors.push(`${rel} Workflow Brief #${index + 1} has blank field: ${field.name}`);
    }
    const values = Object.fromEntries(fields.map((field) => [field.name, field.value]));
    if (typeof values.open === 'string' && /rejected|resolved/i.test(values.open)) {
      errors.push(`${rel} Workflow Brief #${index + 1} must not treat rejected/resolved findings as open`);
    }
    if (typeof values.next === 'string') {
      if (/^(?:无|none|n\/?a|notapplicable)$/i.test(values.next)) {
        errors.push(`${rel} Workflow Brief #${index + 1} next must contain an executable or manual action`);
      }
      for (const match of values.next.matchAll(/\b([a-z][a-z0-9-]+) skill\b/g)) {
        if (!skillNames.includes(match[1])) errors.push(`${rel} Workflow Brief #${index + 1} next references unknown skill: ${match[1]}`);
      }
    }
    if (typeof values.evidence === 'string' && /(读取全部|加载全部|所有文件|完整仓库)/.test(values.evidence)) {
      errors.push(`${rel} Workflow Brief #${index + 1} evidence must be a minimal index, not exhaustive context`);
    }
  });
  return errors;
}

function checkFile(rel, requireBrief) {
  for (const error of validateText(rel, read(rel), requireBrief)) fail(error);
}

function runSelfTest() {
  const valid = [
    '【Workflow Brief】',
    'task: demo',
    'scope: 只生成方案，不修改业务代码',
    'evidence: docs/demo.md',
    'next: 人工：确认方案后实施第一个可验收切片',
    'state: PlanGate Passed',
    'vcs: owner=demo; untracked=docs/demo.md',
    '```',
  ].join('\n');
  const problems = [];
  const validErrors = validateText('valid.md', valid, true);
  if (validErrors.length) problems.push(`valid brief rejected: ${validErrors.join(' | ')}`);
  const malformed = valid
    .replace(/^evidence:.*\n/m, '')
    .replace('scope: 只生成方案，不修改业务代码', 'scope: 读取全部源码和完整仓库');
  const malformedErrors = validateText('malformed.md', malformed, true);
  const invalidOpen = valid.replace('state: PlanGate Passed', 'open: CR-1(rejected)');
  malformedErrors.push(...validateText('invalid-open.md', invalidOpen, true));
  const exhaustiveEvidence = valid.replace('evidence: docs/demo.md', 'evidence: 读取全部源码和完整仓库');
  malformedErrors.push(...validateText('exhaustive.md', exhaustiveEvidence, true));
  for (const needle of ['missing field: evidence', 'must not treat rejected/resolved', 'evidence must be a minimal index']) {
    if (!malformedErrors.some((error) => error.includes(needle))) problems.push(`missing diagnostic: ${needle}`);
  }
  const unknownSkill = valid.replace('人工：确认方案后实施第一个可验收切片', '使用 missing-skill skill 继续');
  if (!validateText('unknown.md', unknownSkill, true).some((error) => error.includes('unknown skill: missing-skill'))) problems.push('unknown skill action was not rejected');
  const emptyNext = valid.replace('人工：确认方案后实施第一个可验收切片', 'none');
  if (!validateText('empty-next.md', emptyNext, true).some((error) => error.includes('next must contain'))) problems.push('empty next action was not rejected');
  if (problems.length) {
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
for (const needle of ['最小核心', '旧产物', '只有提供信息增益时才出现', 'inFlight']) {
  if (!sharedBrief.includes(needle)) fail(`${sharedBriefRel} missing contract: ${needle}`);
}
for (const rel of [
  'skills/yan-conversation-handoff/reference.md',
  'skills/yan-code-review/modes/package/completion.md',
  'skills/yan-project-analysis/modes/incident/reference.md',
  'skills/yan-project-analysis/modes/business/reference.md',
  'skills/yan-code-review/modes/loop/reference.md',
  'skills/yan-code-review/modes/check/reference.md',
  'skills/yan-code-review/modes/repair/reference.md',
]) checkFile(rel, false);

if (failed) process.exit(1);
console.log(`ok Workflow Brief checks passed (${skillNames.length} skills)`);
