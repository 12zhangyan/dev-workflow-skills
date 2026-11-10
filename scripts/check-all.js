#!/usr/bin/env node
'use strict';

// Runs the full local/CI suite. Independent checks run concurrently with buffered output printed per check;
// the board build and the diff hygiene check touch the working tree, so they run last and alone.
//   node scripts/check-all.js                    all checks
//   node scripts/check-all.js --only installers  only checks whose script name contains "installers"
//   node scripts/check-all.js --serial           one check at a time (easier to read while debugging)
const { spawn } = require('child_process');
const os = require('os');

const parallelChecks = [
  ['node', ['scripts/check-scripts.js']],
  ['node', ['scripts/check-board-sync.js']],
  ['node', ['scripts/check-board-behavior.js']],
  ['node', ['scripts/check-agent-doc-sync.js']],
  ['node', ['scripts/check-docs.js']],
  ['node', ['scripts/check-skill-inventory.js']],
  ['node', ['scripts/check-skill-metadata.js']],
  ['node', ['scripts/check-portable-contracts.js']],
  ['node', ['scripts/check-route-loading.js']],
  ['node', ['scripts/check-host-eval-runner.js']],
  ['node', ['scripts/check-workflow-briefs.js']],
  ['node', ['scripts/check-review-boundaries.js']],
  ['node', ['scripts/check-document-boundaries.js']],
  ['node', ['scripts/check-invariants.js']],
  ['node', ['scripts/check-installers.js']],
  ['node', ['scripts/check-evals.js']],
];
const tailChecks = [
  ['node', ['project-html/build.js']],
  ['node', ['scripts/check-git-diff.js']],
];

const argv = process.argv.slice(2);
const serial = argv.includes('--serial');
const onlyIndex = argv.indexOf('--only');
const only = onlyIndex >= 0 ? argv[onlyIndex + 1] : null;
const unknown = argv.filter((arg, index) => arg !== '--serial' && arg !== '--only' && !(onlyIndex >= 0 && index === onlyIndex + 1));
if (unknown.length || (onlyIndex >= 0 && !only)) {
  console.error('usage: node scripts/check-all.js [--serial] [--only <substring of a check script>]');
  process.exit(1);
}
const selected = (list) => list.filter(([, args]) => !only || args.join(' ').includes(only));

function run([cmd, args]) {
  const label = [cmd, ...args].join(' ');
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], shell: false });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.on('error', (error) => resolve({ label, ok: false, output: output + `FAIL: ${label}: ${error.message}\n` }));
    child.on('close', (status) => resolve({
      label,
      ok: status === 0,
      output: output + (status === 0 ? '' : `FAIL: ${label} exited with ${status}\n`),
    }));
  });
}

function report(result) {
  process.stdout.write(`\n> ${result.label}\n${result.output}`);
}

async function runPool(checks, limit) {
  const results = [];
  let next = 0;
  async function worker() {
    while (next < checks.length) {
      const check = checks[next++];
      const result = await run(check);
      report(result);
      results.push(result);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, checks.length) }, worker));
  return results;
}

(async () => {
  const limit = serial ? 1 : Math.max(2, Math.min(4, os.cpus().length));
  const results = await runPool(selected(parallelChecks), limit);
  for (const check of selected(tailChecks)) {
    const result = await run(check);
    report(result);
    results.push(result);
  }
  if (!results.length) {
    console.error(`no check matches --only ${only}`);
    process.exit(1);
  }
  if (results.some((result) => !result.ok)) process.exit(1);
  console.log('\nok all checks passed');
})();
