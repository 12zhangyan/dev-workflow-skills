#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const contractsPath = path.join(root, 'skills', '_shared', 'host-contracts.json');
const publicSkills = [
  'yan-code-review',
  'yan-conversation-handoff',
  'yan-dev-doc',
  'yan-project-analysis',
];
const runtimeFiles = [
  ...publicSkills.map((name) => `skills/${name}/SKILL.md`),
  'skills/yan-code-review/modes/check/mode.md',
  'skills/yan-code-review/modes/loop/mode.md',
  'skills/yan-code-review/modes/package/mode.md',
  'skills/yan-code-review/modes/repair/mode.md',
  'skills/yan-project-analysis/modes/business/mode.md',
  'skills/yan-project-analysis/modes/incident/mode.md',
  'skills/yan-project-analysis/modes/understanding/mode.md',
];
const forbiddenRuntimeText = [
  'AskUserQuestion',
  'requesting-yan-code-review',
  'date +%F',
  'shell: bash',
  'model: sonnet',
  'allowed-tools:',
  'vcs_root="$PWD"',
  "cat > project-html/data/_entry.json",
  'test -f project-html/data/changes.js',
  'test -e "$target"',
  'test -r "$target"',
];

let failed = false;

function fail(message) {
  failed = true;
  console.error(`FAIL: ${message}`);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8').replace(/^\uFEFF/, '');
}

function frontmatterKeys(text, rel) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) {
    fail(`${rel} has no YAML frontmatter`);
    return [];
  }
  return match[1]
    .split(/\r?\n/)
    .filter((line) => /^[A-Za-z0-9_-]+:/.test(line))
    .map((line) => line.slice(0, line.indexOf(':')));
}

function frontmatterName(text, rel) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return '';
  const nameLine = match[1].split(/\r?\n/).find((line) => line.startsWith('name:'));
  const name = nameLine ? nameLine.slice(nameLine.indexOf(':') + 1).trim() : '';
  if (!name) fail(`${rel} has no frontmatter name`);
  return name;
}

let contracts;
try {
  contracts = JSON.parse(fs.readFileSync(contractsPath, 'utf8'));
} catch (error) {
  fail(`host-contracts.json is not valid JSON: ${error.message}`);
  contracts = { hosts: [], cases: [] };
}

if (JSON.stringify(contracts.hosts) !== JSON.stringify(['claude', 'cursor', 'codex'])) {
  fail('host-contracts.json must cover exactly claude, cursor, codex');
}
if (!Number.isInteger(contracts.schema_version) || contracts.schema_version < 1) {
  fail('host-contracts.json needs a positive schema_version');
}
if (!Array.isArray(contracts.cases) || contracts.cases.length < 10) {
  fail('host-contracts.json needs at least 10 representative cases');
}

const caseIds = new Set();
for (const contract of contracts.cases || []) {
  if (!contract.id || caseIds.has(contract.id)) fail(`invalid or duplicate contract id: ${contract.id}`);
  caseIds.add(contract.id);
  if (!['none', 'docs', 'docs-and-board', 'code-and-tests'].includes(contract.write_scope)) {
    fail(`${contract.id} has unsupported write_scope: ${contract.write_scope}`);
  }
  if (contract.assertions !== undefined) {
    if (!contract.assertions || typeof contract.assertions !== 'object') {
      fail(`${contract.id} assertions must be an object`);
    } else {
      for (const artifact of contract.assertions.artifacts || []) {
        if (typeof artifact.glob !== 'string' || !artifact.glob || !Number.isInteger(artifact.min_matches) || artifact.min_matches < 1) {
          fail(`${contract.id} has an invalid artifact assertion`);
        }
      }
      for (const textAssertion of contract.assertions.text || []) {
        if (typeof textAssertion.pattern !== 'string' || !textAssertion.pattern || !Number.isInteger(textAssertion.min_matches) || textAssertion.min_matches < 1) {
          fail(`${contract.id} has an invalid text assertion`);
        }
      }
    }
  }
  const ref = /^([^:]+):(\d+)$/.exec(contract.prompt_ref || '');
  if (!ref) {
    fail(`${contract.id} has invalid prompt_ref`);
    continue;
  }
  const evalPath = path.join(root, 'skills', ref[1], 'evals.json');
  if (!fs.existsSync(evalPath)) {
    fail(`${contract.id} references missing eval file: ${ref[1]}`);
    continue;
  }
  const evalFile = JSON.parse(fs.readFileSync(evalPath, 'utf8').replace(/^\uFEFF/, ''));
  if (!evalFile.evals.some((item) => Number(item.id) === Number(ref[2]))) {
    fail(`${contract.id} references missing eval id: ${contract.prompt_ref}`);
  }
}

for (const rel of runtimeFiles) {
  const text = read(rel);
  const keys = frontmatterKeys(text, rel);
  const name = frontmatterName(text, rel);
  const extra = keys.filter((key) => !['name', 'description'].includes(key));
  if (extra.length) fail(`${rel} has host-specific frontmatter keys: ${extra.join(', ')}`);
  if (name && !name.startsWith('yan-')) fail(`${rel} frontmatter name must use yan- prefix: ${name}`);
  for (const forbidden of forbiddenRuntimeText) {
    if (text.includes(forbidden)) fail(`${rel} contains host-bound text: ${forbidden}`);
  }
}

for (const skill of publicSkills) {
  const rel = `skills/${skill}/SKILL.md`;
  if (!read(rel).includes('../_shared/host-capabilities.md')) {
    fail(`${rel} must link to the shared host capability adapter`);
  }
}

const helper = path.join(root, 'skills', '_shared', 'scripts', 'workflow-fs.js');
if (!fs.existsSync(helper)) {
  fail('missing cross-platform workflow-fs.js helper');
} else {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow-fs-contract-'));
  try {
    const result = spawnSync(process.execPath, [helper, 'prepare-date-dir', 'docs'], {
      cwd: tempRoot,
      encoding: 'utf8',
      windowsHide: true,
    });
    if (result.status !== 0) fail(`workflow-fs.js smoke failed: ${result.stderr || result.stdout}`);
    const output = (result.stdout || '').trim().replace(/\\/g, '/');
    if (!/^docs\/\d{4}-\d{2}-\d{2}$/.test(output)) fail(`workflow-fs.js returned unexpected path: ${output}`);
    if (output && !fs.existsSync(path.join(tempRoot, ...output.split('/')))) {
      fail('workflow-fs.js did not create its reported directory');
    }
    const stateResult = spawnSync(process.execPath, [helper, 'file-state', path.join(tempRoot, 'missing.md')], {
      encoding: 'utf8',
      windowsHide: true,
    });
    if (stateResult.status !== 0 || stateResult.stdout.trim() !== 'MISSING') {
      fail('workflow-fs.js file-state did not report a missing file deterministically');
    }
    const vcsResult = spawnSync(process.execPath, [helper, 'detect-vcs', root], {
      encoding: 'utf8',
      windowsHide: true,
    });
    const vcs = JSON.parse(vcsResult.stdout || '{}');
    if (vcsResult.status !== 0 || vcs.type !== 'git' || !vcs.root) {
      fail('workflow-fs.js detect-vcs did not identify the repository');
    }
    const resolveResult = spawnSync(
      process.execPath,
      [helper, 'resolve-skill-file', 'yan-dev-doc', 'scripts/validate-openapi.js'],
      { encoding: 'utf8', windowsHide: true },
    );
    if (resolveResult.status !== 0 || !fs.existsSync((resolveResult.stdout || '').trim())) {
      fail('workflow-fs.js resolve-skill-file could not locate a sibling skill asset');
    }
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

const boardAdapter = path.join(root, 'skills', '_shared', 'scripts', 'board-bootstrap.js');
if (!fs.existsSync(boardAdapter)) fail('missing cross-platform board-bootstrap.js adapter');

if (failed) process.exit(1);
console.log(`ok portable static contracts passed for ${contracts.cases.length} cases across claude/cursor/codex`);
