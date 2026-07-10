#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const skillsDir = path.join(root, 'skills');
const skillNames = fs.readdirSync(skillsDir)
  .filter((name) => fs.existsSync(path.join(skillsDir, name, 'SKILL.md')))
  .sort();

const requiredDocs = [
  'README.md',
  'docs/workflow-guide.md',
  'docs/why-dev-doc.md',
  'docs/why-code-reading.md',
  'skills/_shared/workflow-brief.md',
  'skills/_shared/workflow-chain.md',
  'skills/_shared/workflow-gates.md',
  'skills/_shared/interaction-policy.md'
];

let failed = false;

function fail(message) {
  failed = true;
  console.error('FAIL: ' + message);
}

function read(rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) {
    fail(`missing document: ${rel}`);
    return '';
  }
  return fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
}

const readme = read('README.md');
for (const needle of [
  'install.ps1',
  'install.sh',
  'install-local.cmd',
  'node scripts/check-all.js',
  'Workflow Brief',
  'Codex 不要输入 `/dev-doc` 或 `$dev-doc`'
]) {
  if (!readme.includes(needle)) fail(`README.md missing required text: ${needle}`);
}
for (const skill of skillNames) {
  if (!readme.includes(`\`${skill}\``)) fail(`README.md does not mention skill: ${skill}`);
}

const workflowGuide = read('docs/workflow-guide.md');
for (const skill of skillNames) {
  if (!workflowGuide.includes(skill)) fail(`docs/workflow-guide.md does not mention skill: ${skill}`);
}
for (const needle of ['Workflow Brief', 'Plan Gate', 'Review Gate', 'Submit Gate', '准确性硬规则', 'environment-blocked', '测试必须证明目标逻辑']) {
  if (!workflowGuide.includes(needle)) fail(`docs/workflow-guide.md missing required text: ${needle}`);
}

if (failed) process.exit(1);
console.log('ok documentation checks passed');
