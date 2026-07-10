#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const scriptsDir = path.join(root, 'scripts');
const files = fs.readdirSync(scriptsDir)
  .filter((name) => name.endsWith('.js'))
  .sort();

let failed = false;

function fail(message) {
  failed = true;
  console.error('FAIL: ' + message);
}

for (const file of files) {
  const rel = `scripts/${file}`;
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

if (failed) process.exit(1);
console.log(`ok script checks passed (${files.length} scripts)`);
