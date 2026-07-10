#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');

const checks = [
  ['node', ['scripts/check-scripts.js']],
  ['node', ['scripts/check-board-sync.js']],
  ['node', ['scripts/check-agent-doc-sync.js']],
  ['node', ['scripts/check-docs.js']],
  ['node', ['scripts/check-skill-metadata.js']],
  ['node', ['scripts/check-workflow-briefs.js']],
  ['node', ['scripts/check-installers.js']],
  ['node', ['scripts/check-interaction-policy-sync.js']],
  ['node', ['scripts/check-evals.js']],
  ['node', ['project-html/build.js']],
  ['git', ['diff', '--check']]
];

let failed = false;

for (const [cmd, args] of checks) {
  const label = [cmd, ...args].join(' ');
  console.log(`\n> ${label}`);
  const result = spawnSync(cmd, args, { stdio: 'inherit', shell: false });
  if (result.error) {
    failed = true;
    console.error(`FAIL: ${label}: ${result.error.message}`);
  } else if (result.status !== 0) {
    failed = true;
    console.error(`FAIL: ${label} exited with ${result.status}`);
  }
}

if (failed) process.exit(1);
console.log('\nok all checks passed');
