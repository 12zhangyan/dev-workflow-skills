#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const runner = path.join(root, 'scripts', 'run-host-evals.js');
const runnerText = fs.readFileSync(runner, 'utf8');
const contracts = JSON.parse(fs.readFileSync(path.join(root, 'skills', '_shared', 'host-contracts.json'), 'utf8'));
const result = spawnSync(process.execPath, [runner, '--probe', '--json'], {
  cwd: root,
  encoding: 'utf8',
  windowsHide: true,
  timeout: 30000,
});

if (result.status !== 0) {
  console.error(`FAIL: host eval probe exited ${result.status}: ${result.stderr || result.stdout}`);
  process.exit(1);
}

let report;
try {
  report = JSON.parse(result.stdout);
} catch (error) {
  console.error(`FAIL: host eval probe returned invalid JSON: ${error.message}`);
  process.exit(1);
}

if (report.mode !== 'probe' || report.liveModelCalls !== false) {
  console.error('FAIL: default host eval probe must never call a live model');
  process.exit(1);
}
const hosts = (report.hosts || []).map((item) => item.host);
if (JSON.stringify(hosts) !== JSON.stringify(['claude', 'cursor', 'codex'])) {
  console.error(`FAIL: host eval probe coverage mismatch: ${hosts.join(', ')}`);
  process.exit(1);
}

if (!runnerText.includes("git', ['clone', '--no-local', sourceWorkspace, isolated]")) {
  console.error('FAIL: writable live evaluation must use a runner-created isolated Git clone');
  process.exit(1);
}
if (!runnerText.includes("repeat with --allow-write") || !runnerText.includes("--output must not be inside the supplied workspace")) {
  console.error('FAIL: runner must reject implicit writes and result paths inside the supplied workspace');
  process.exit(1);
}
const writable = contracts.cases.filter((item) => item.write_scope !== 'none');
if (!writable.length || !contracts.cases.some((item) => item.prompt_ref.startsWith('yan-dev-doc:'))) {
  console.error('FAIL: contracts must include writable and yan-dev-doc representative cases');
  process.exit(1);
}
for (const contract of contracts.cases.filter((item) => item.prompt_ref.startsWith('yan-dev-doc:'))) {
  if (!contract.assertions || !Array.isArray(contract.assertions.artifacts) || !contract.assertions.artifacts.length) {
    console.error(`FAIL: writable contract ${contract.id} needs deterministic artifact assertions`);
    process.exit(1);
  }
}

const refused = spawnSync(process.execPath, [runner, '--live', '--host', 'codex', '--case', 'dev-doc-standard-artifacts', '--workspace', root], {
  cwd: root,
  encoding: 'utf8',
  windowsHide: true,
  timeout: 30000,
});
if (refused.status !== 2 || !(`${refused.stderr}${refused.stdout}`).includes('--allow-write')) {
  console.error('FAIL: writable live evaluation must be refused before a host invocation unless --allow-write is explicit');
  process.exit(1);
}
const unsafeOutput = spawnSync(process.execPath, [runner, '--live', '--host', 'codex', '--case', 'review-check-read-only', '--workspace', root, '--output', path.join(root, 'host-eval-result.json')], {
  cwd: root,
  encoding: 'utf8',
  windowsHide: true,
  timeout: 30000,
});
if (unsafeOutput.status === 0 || !(`${unsafeOutput.stderr}${unsafeOutput.stdout}`).includes('--output must not be inside')) {
  console.error('FAIL: result output inside the supplied workspace must be rejected before live execution');
  process.exit(1);
}

console.log('ok host eval runner probes safely and guards isolated writable contracts');
