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

for (const skill of skillNames) {
  const rel = `skills/${skill}/reference.md`;
  const text = read(rel);
  const indexes = [];
  let idx = text.indexOf('【Workflow Brief】');
  while (idx !== -1) {
    indexes.push(idx);
    idx = text.indexOf('【Workflow Brief】', idx + 1);
  }
  if (indexes.length === 0) {
    fail(`${rel} missing Workflow Brief template`);
    continue;
  }
  indexes.forEach((start, i) => {
    const block = text.slice(start, start + 900);
    for (const field of requiredFields) {
      if (!new RegExp(`^${field}:`, 'm').test(block)) {
        fail(`${rel} Workflow Brief #${i + 1} missing field: ${field}`);
      }
    }
    const testsLine = block.match(/^tests:\s*(.*)$/m);
    if (!testsLine || !testsLine[1].includes('environment-blocked')) {
      fail(`${rel} Workflow Brief #${i + 1} tests field must mention environment-blocked`);
    }
  });
}

if (failed) process.exit(1);
console.log(`ok Workflow Brief checks passed (${skillNames.length} skills)`);
