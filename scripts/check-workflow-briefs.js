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

function checkFile(rel, requireBrief) {
  const text = read(rel);
  const indexes = [];
  let idx = text.indexOf('【Workflow Brief】');
  while (idx !== -1) {
    indexes.push(idx);
    idx = text.indexOf('【Workflow Brief】', idx + 1);
  }
  if (indexes.length === 0) {
    if (requireBrief) fail(`${rel} missing Workflow Brief template`);
    return;
  }
  indexes.forEach((start, i) => {
    const lines = text.slice(start).split(/\r?\n/);
    const blockLines = [lines[0]];
    for (const line of lines.slice(1)) {
      if (!line.trim() || line.trim() === '```') break;
      blockLines.push(line);
    }
    const fieldLines = blockLines.slice(1).map((line) => {
      const match = line.match(/^([A-Za-z][A-Za-z0-9]*):\s*(.*)$/);
      return match ? { name: match[1], value: match[2] } : null;
    });

    if (blockLines.length > 14) {
      fail(`${rel} Workflow Brief #${i + 1} exceeds 14 lines`);
    }
    if (fieldLines.some((field) => field === null)) {
      fail(`${rel} Workflow Brief #${i + 1} contains a non-field line`);
      return;
    }
    const actualFields = fieldLines.map((field) => field.name);
    if (actualFields.join('|') !== requiredFields.join('|')) {
      fail(`${rel} Workflow Brief #${i + 1} field order mismatch: ${actualFields.join(', ')}`);
    }
    for (const field of fieldLines) {
      if (!field.value.trim()) {
        fail(`${rel} Workflow Brief #${i + 1} has blank field: ${field.name}`);
      }
    }
    const values = Object.fromEntries(fieldLines.map((field) => [field.name, field.value]));
    if (!values.tests.includes('environment-blocked')) {
      fail(`${rel} Workflow Brief #${i + 1} tests field must mention environment-blocked`);
    }
    for (const key of ['owner=', 'tracked=', 'untracked=']) {
      if (!values.vcs.includes(key)) fail(`${rel} Workflow Brief #${i + 1} vcs field missing ${key}`);
    }
    for (const key of ['spec=', 'index=', 'operationIds=']) {
      if (!values.api.includes(key)) fail(`${rel} Workflow Brief #${i + 1} api field missing ${key}`);
    }
    if (!values.tokenHint.includes('首轮最多 5 个文件')) {
      fail(`${rel} Workflow Brief #${i + 1} tokenHint must cap first-pass reads at 5 files`);
    }
  });
}

for (const skill of skillNames) {
  checkFile(`skills/${skill}/reference.md`, true);
  const examplesRel = `skills/${skill}/examples.md`;
  if (fs.existsSync(path.join(root, examplesRel))) checkFile(examplesRel, false);
}

if (failed) process.exit(1);
console.log(`ok Workflow Brief checks passed (${skillNames.length} skills)`);
