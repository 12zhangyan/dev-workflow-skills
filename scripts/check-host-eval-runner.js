#!/usr/bin/env node
'use strict';

const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const runner = path.join(root, 'scripts', 'run-host-evals.js');
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

console.log('ok host eval runner probes claude/cursor/codex without live model calls');
