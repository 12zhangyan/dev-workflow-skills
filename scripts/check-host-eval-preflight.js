#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert/strict');
const { spawnSync } = require('child_process');
const { inspect, fixturePath } = require('./host-eval-preflight');
const root = path.resolve(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'yan-preflight-check-'));
const fixture = path.join(temp, 'fixture');
const runner = path.join(root, 'scripts/run-host-evals.js');
function git(workspace, args) {
  return spawnSync('git', ['--no-optional-locks', '--no-lazy-fetch', '-c', 'core.fsmonitor=false', '-C', workspace, ...args], { encoding: 'utf8', windowsHide: true });
}
function mustGit(args) {
  const result = git(fixture, args);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}
function run(args, preload = true) {
  return spawnSync(process.execPath, [...(preload ? ['--require', path.join(temp, 'no-effects.cjs')] : []), runner, ...args], {
    cwd: root, encoding: 'utf8', windowsHide: true, timeout: 30000,
    env: { ...process.env, YAN_CODEX_EVAL_COMMAND: path.join(temp, 'unavailable-host') },
  });
}
function report(args, expected) {
  const result = run(['--preflight', '--host', 'codex', '--case', 'review-check-read-only', '--workspace', fixture, ...args]);
  assert.equal(result.status, expected, result.stderr || result.stdout);
  const value = JSON.parse(result.stdout);
  assert.equal(value.kind, 'host-eval-preflight');
  assert.equal(value.liveModelCalls, false);
  assert(value.checks.some(check => check.status === 'unresolved' && check.id === 'runtime'));
  return value;
}
try {
  fs.mkdirSync(fixture);
  mustGit(['init', '-q']);
  mustGit(['config', 'user.name', 'Fixture']);
  mustGit(['config', 'user.email', 'fixture@example.invalid']);
  fs.writeFileSync(path.join(fixture, 'input.txt'), 'original\n');
  fs.writeFileSync(path.join(fixture, '.gitignore'), 'ignored/\n');
  fs.writeFileSync(path.join(fixture, '.gitattributes'), 'input.txt filter=preflight-test\n');
  mustGit(['add', '.']);
  mustGit(['commit', '-qm', 'fixture']);
  const marker = path.join(temp, 'unexpected-hook');
  const hook = path.join(temp, 'mark-hook.cjs');
  fs.writeFileSync(hook, "require('fs').writeFileSync(" + JSON.stringify(marker) + ", 'executed');");
  const hookCommand = '"' + process.execPath.replace(/\\/g, '/') + '" "' + hook.replace(/\\/g, '/') + '"';
  mustGit(['config', 'core.fsmonitor', hookCommand]);
  mustGit(['config', 'filter.preflight-test.clean', hookCommand]);
  mustGit(['config', 'filter.preflight-test.process', hookCommand]);
  mustGit(['config', 'filter.preflight-test.required', 'true']);
  const head = mustGit(['rev-parse', 'HEAD']);
  const index = fs.readFileSync(path.join(fixture, '.git/index'));
  const entries = mustGit(['ls-files', '--stage', '-z']);
  fs.writeFileSync(path.join(temp, 'no-effects.cjs'), [
    "const fs = require('fs'), cp = require('child_process');",
    "const original = cp.spawnSync;",
    "cp.spawnSync = (command, args, opts) => {",
    " let tail = args.slice(args.indexOf('-C') + 2); while (tail[0] === '-c') tail = tail.slice(2);",
    " if (command !== 'git' || !args.includes('--no-lazy-fetch') || !args.includes('core.fsmonitor=false') || !['rev-parse','status','ls-tree','ls-files','config'].includes(tail[0])) throw Error('unexpected subprocess: ' + command);",
    " if (tail[0] === 'config' && (tail[1] !== '--name-only' || tail[2] !== '--get-regexp')) throw Error('unexpected Git config mutation');",
    " return original(command, args, opts); };",
    "for (const key of ['exec','execSync','execFile','execFileSync','spawn','fork']) cp[key] = () => { throw Error('unexpected child process'); };",
    "for (const key of ['writeFileSync','appendFileSync','mkdirSync','cpSync','rmSync','renameSync']) fs[key] = () => { throw Error('unexpected filesystem mutation'); };",
    "global.fetch = () => { throw Error('unexpected network'); };",
    "for (const name of ['http','https']) { const api = require(name); api.request = api.get = () => { throw Error('unexpected network'); }; }",
  ].join('\n'));
  assert.equal(report([], 0).valid, true);
  if (process.platform === 'win32') {
    const alternateDrive = fixture.replace(/^[A-Z]:/, drive => drive.toLowerCase());
    assert.equal(report(['--workspace', alternateDrive], 0).valid, true, 'drive casing must not change workspace identity');
  }
  assert.equal(report(['--workspace', path.join(fixture, '.git')], 1).valid, false, 'Git metadata is not a worktree root');
  for (const modes of [['--preflight', '--probe'], ['--probe', '--preflight'], ['--preflight', '--live']]) {
    const conflict = run(modes);
    assert.equal(conflict.status, 2);
    assert.match(conflict.stderr, /cannot be combined/);
    assert(!conflict.stderr.includes('unexpected subprocess'));
  }
  assert.equal(report(['--output', path.join(temp, 'not-created', 'report.json')], 0).valid, true);
  assert.equal(fs.existsSync(path.join(temp, 'not-created')), false);
  assert.equal(report(['--output', path.join(fixture, 'result.json')], 1).valid, false);
  report(['--case', 'missing-case'], 1);
  const noWrite = report(['--case', 'dev-doc-artifacts'], 1);
  assert(noWrite.checks.some(check => check.detail.includes('repeat with --allow-write')));
  assert.equal(report(['--case', 'dev-doc-artifacts', '--allow-write'], 0).valid, true);
  report(['--case', 'repair-query-contract', '--allow-write'], 1); // declared fixture inputs missing
  assert(fs.readFileSync(path.join(fixture, '.git/index')).equals(index));
  assert.equal(fs.existsSync(marker), false, 'offline inspection must not invoke configured Git hooks/filters');
  for (const key of ['filter.preflight-test.clean', 'filter.preflight-test.process', 'filter.preflight-test.required']) mustGit(['config', '--unset', key]);
  fs.writeFileSync(path.join(fixture, 'input.txt'), 'dirty\n');
  assert(report([], 1).checks.some(check => check.id === 'clean-fixture' && check.status === 'invalid'));
  mustGit(['add', 'input.txt']);
  report([], 1); // staged changes also vanish from a normal clone
  fs.writeFileSync(path.join(fixture, 'input.txt'), 'original\n');
  mustGit(['add', 'input.txt']);
  fs.writeFileSync(path.join(fixture, 'new.txt'), 'untracked');
  report([], 1);
  const refused = run(['--live', '--host', 'codex', '--case', 'review-check-read-only', '--workspace', fixture]);
  assert.equal(refused.status, 2);
  assert.match(refused.stderr, /uncommitted or untracked/);
  assert(!refused.stderr.includes('unexpected subprocess')); // no host/version probe before refusal
  fs.unlinkSync(path.join(fixture, 'new.txt'));
  fs.mkdirSync(path.join(fixture, 'ignored'));
  fs.writeFileSync(path.join(fixture, 'ignored/cache'), 'ignored dependency');
  assert.equal(report([], 0).valid, true); // ignored runtime state is explicitly unresolved
  const contract = { id: 'fixture', prompt_ref: 'yan-code-review:1', route: 'check', write_scope: 'none', required_fixture_paths: ['input.txt'] };
  const tools = { root, contracts: { cases: [contract] }, hosts: ['codex'], git,
    skillSourceDirectory: () => path.join(root, 'skills'), promptFor: () => 'resolved', globToRegex: glob => new RegExp(glob) };
  const args = { host: 'codex', case: 'fixture', workspace: fixture, invocation: 'explicit' };
  assert.equal(inspect(args, tools).valid, true);
  for (const value of ['../escape', '/absolute', 'C:/absolute', 'a/../b', './input.txt', '.git/config', '']) assert.throws(() => fixturePath(value));
  contract.required_fixture_paths = ['ignored/cache'];
  assert.equal(inspect(args, tools).valid, false);
  contract.required_fixture_paths = ['input.txt'];
  contract.assertions = { text: [{ pattern: '[', min_matches: 1 }] };
  assert.equal(inspect(args, tools).valid, false);
  delete contract.assertions;
  contract.route_loading = { max_resources: 2, required: ['skills/yan-code-review/modes/check/mode.md'], forbidden_patterns: [] };
  assert.equal(inspect(args, tools).valid, true);
  contract.route_loading.required = ['skills/yan-code-review/modes/missing/mode.md'];
  assert.equal(inspect(args, tools).valid, false);
  delete contract.route_loading;
  const link = path.join(temp, 'source-alias');
  fs.symlinkSync(fixture, link, process.platform === 'win32' ? 'junction' : 'dir');
  assert.equal(report(['--workspace', link], 0).valid, true, 'a resolved alias of the worktree root is valid');
  assert.equal(inspect({ ...args, output: path.join(link, 'new', 'result.json') }, tools).valid, false);
  fs.unlinkSync(link);
  assert.equal(mustGit(['rev-parse', 'HEAD']), head);
  assert.equal(mustGit(['ls-files', '--stage', '-z']), entries);
  assert.equal(mustGit(['status', '--porcelain']), '');
  console.log('ok offline preflight rejects dirty/incomplete fixtures and unsafe output without host, verifier, clone, writes or network');
} finally {
  const resolved = path.resolve(temp);
  if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith('yan-preflight-check-')) throw new Error('unsafe cleanup');
  fs.rmSync(resolved, { recursive: true, force: true });
}
