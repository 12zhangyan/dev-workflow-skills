#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
function listJs(dir) {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...listJs(full));
    else if (entry.name.endsWith('.js')) result.push(path.relative(root, full).replace(/\\/g, '/'));
  }
  return result;
}

const files = [
  ...listJs(path.join(root, 'scripts')),
  ...listJs(path.join(root, 'skills')).filter((rel) => rel.includes('/scripts/')),
].sort();

let failed = false;

function fail(message) {
  failed = true;
  console.error('FAIL: ' + message);
}

for (const file of files) {
  const rel = file;
  const full = path.join(root, rel);
  const text = fs.readFileSync(full, 'utf8');
  if (!text.startsWith('#!/usr/bin/env node\n')) fail(`${rel} must start with a node shebang`);
  if (!text.includes("'use strict';")) fail(`${rel} must enable strict mode`);

  const result = spawnSync('node', ['--check', rel], { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) {
    fail(`${rel} has a syntax error`);
    if (result.stdout) process.stderr.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
  }
}

const validator = 'skills/dev-doc/scripts/validate-openapi.js';
const selfTest = spawnSync('node', [validator, '--self-test'], { cwd: root, encoding: 'utf8' });
if (selfTest.status !== 0) {
  fail(`${validator} self-test failed`);
  if (selfTest.stdout) process.stderr.write(selfTest.stdout);
  if (selfTest.stderr) process.stderr.write(selfTest.stderr);
}

if (failed) process.exit(1);
console.log(`ok script checks passed (${files.length} scripts)`);
