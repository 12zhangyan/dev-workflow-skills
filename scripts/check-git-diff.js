#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

function git(cwd, args) {
  return spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
}

function refExists(cwd, ref) {
  return git(cwd, ['rev-parse', '--verify', '--quiet', ref]).status === 0;
}

function nonZeroSha(value) {
  return /^[0-9a-f]{40}$/i.test(value || '') && !/^0+$/.test(value);
}

function rangeFor(cwd, env) {
  if (env.YAN_DIFF_BASE) return `${env.YAN_DIFF_BASE}...HEAD`;
  if (env.GITHUB_BASE_REF) return `origin/${env.GITHUB_BASE_REF}...HEAD`;
  if (nonZeroSha(env.GITHUB_EVENT_BEFORE)) return `${env.GITHUB_EVENT_BEFORE}...HEAD`;

  const branch = git(cwd, ['branch', '--show-current']);
  const current = branch.status === 0 ? branch.stdout.trim() : '';
  if (current && current !== 'main' && refExists(cwd, 'origin/main')) return 'origin/main...HEAD';
  return '';
}

function checksFor(cwd, env) {
  const checks = [
    { label: 'unstaged working tree', args: ['diff', '--check'] },
    { label: 'staged index', args: ['diff', '--cached', '--check'] },
    { label: 'HEAD commit', args: ['show', '--check', '--format=', '--no-renames', 'HEAD'] },
  ];
  const range = rangeFor(cwd, env);
  if (range) checks.push({ label: `committed range ${range}`, args: ['diff', '--check', range] });
  return checks;
}

function runChecks(cwd, env, quiet) {
  const inside = git(cwd, ['rev-parse', '--is-inside-work-tree']);
  if (inside.status !== 0 || inside.stdout.trim() !== 'true') {
    if (!quiet) console.error('FAIL: check-git-diff must run inside a Git worktree');
    return false;
  }

  let passed = true;
  for (const check of checksFor(cwd, env)) {
    const result = git(cwd, check.args);
    if (result.status !== 0) {
      passed = false;
      if (!quiet) {
        console.error(`FAIL: whitespace errors in ${check.label}`);
        if (result.stdout) process.stderr.write(result.stdout);
        if (result.stderr) process.stderr.write(result.stderr);
      }
    } else if (!quiet) {
      console.log(`ok ${check.label}`);
    }
  }
  return passed;
}

function selfTest() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-workflow-git-diff-'));
  try {
    const commands = [
      ['init', '-q'],
      ['config', 'user.name', 'check-git-diff'],
      ['config', 'user.email', 'check-git-diff@example.invalid'],
    ];
    for (const args of commands) {
      const result = git(tempRoot, args);
      if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed`);
    }
    fs.writeFileSync(path.join(tempRoot, 'fixture.txt'), 'clean\n', 'utf8');
    git(tempRoot, ['add', 'fixture.txt']);
    const commit = git(tempRoot, ['commit', '-qm', 'fixture']);
    if (commit.status !== 0) throw new Error('fixture commit failed');
    if (!runChecks(tempRoot, {}, true)) throw new Error('clean fixture was rejected');

    fs.appendFileSync(path.join(tempRoot, 'fixture.txt'), 'trailing whitespace   \n', 'utf8');
    if (runChecks(tempRoot, {}, true)) throw new Error('working-tree whitespace error was not detected');
    git(tempRoot, ['add', 'fixture.txt']);
    if (runChecks(tempRoot, {}, true)) throw new Error('staged whitespace error was not detected');
    const badCommit = git(tempRoot, ['commit', '-qm', 'fixture with whitespace error']);
    if (badCommit.status !== 0) throw new Error('whitespace fixture commit failed');
    if (runChecks(tempRoot, {}, true)) throw new Error('HEAD whitespace error was not detected');
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
  console.log('ok git diff checker self-test passed');
}

if (process.argv.includes('--self-test')) {
  selfTest();
} else if (!runChecks(process.cwd(), process.env, false)) {
  process.exit(1);
}
