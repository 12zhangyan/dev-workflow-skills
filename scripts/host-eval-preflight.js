#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function within(parent, child) {
  const relative = path.relative(parent, child);
  return !relative || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
}

// Resolve existing ancestors too: a not-yet-created result below a link must not
// bypass the source-workspace write boundary.
function physicalPath(value) {
  const absolute = path.resolve(value);
  if (fs.existsSync(absolute)) return fs.realpathSync(absolute);
  const parent = path.dirname(absolute);
  if (parent === absolute) return absolute;
  return path.join(physicalPath(parent), path.basename(absolute));
}

function fixturePath(value) {
  if (typeof value !== 'string' || !value || value.includes('\\') || value.includes('\0')
      || path.posix.isAbsolute(value) || path.win32.isAbsolute(value)
      || value.split('/').some(part => !part || part === '.' || part === '..')
      || value.startsWith('.git/')) throw new Error('required_fixture_paths must contain relative file paths without traversal');
  return value;
}

function inspect(args, tools) {
  const { root, contracts, hosts, git, skillSourceDirectory, promptFor, globToRegex } = tools;
  const checks = [];
  let contract;
  let source;
  let workspace;
  let fixtureHead;
  let filterOverrides;
  function check(id, action) {
    try {
      const detail = action();
      checks.push({ id, status: 'verified', detail: detail || 'static check passed' });
      return true;
    } catch (error) {
      checks.push({ id, status: 'invalid', detail: error.message });
      return false;
    }
  }
  function readGit(argsForGit) {
    if (!filterOverrides) {
      const config = git(workspace, ['config', '--name-only', '--get-regexp', /^filter\..*\.(clean|smudge|process|required)$/.source]);
      if (![0, 1].includes(config.status)) throw new Error('cannot inspect Git filter configuration');
      filterOverrides = (config.stdout || '').trim().split(/\r?\n/).filter(Boolean)
        .flatMap(key => ['-c', key + (key.endsWith('.required') ? '=false' : '=')]);
    }
    const result = git(workspace, [...filterOverrides, ...argsForGit]);
    if (result.status !== 0) throw new Error('Git inspection failed: ' + argsForGit[0]);
    return result.stdout;
  }
  check('request', () => {
    if (!hosts.includes(args.host)) throw new Error('evaluation requires a supported --host');
    if (!args.case || !args.workspace) throw new Error('evaluation requires --case and --workspace');
    const matches = contracts.cases.filter(item => item.id === args.case);
    if (matches.length !== 1) throw new Error('unknown or duplicate contract case: ' + args.case);
    contract = matches[0];
    if (args.invocation !== 'explicit' && !contract.selection) throw new Error('natural invocation requires a selection contract');
    if (args.invocation === 'explicit' && contract.selection) throw new Error('selection contracts require --invocation catalog or native');
    if (args.invocation === 'native' && args.host !== 'codex') throw new Error('native discovery evidence currently requires Codex');
    if (args.effort && args.host !== 'codex') throw new Error('--effort currently supports codex only');
    if (!['none', 'docs', 'docs-and-board', 'code-and-tests'].includes(contract.write_scope)) throw new Error('unsupported write scope');
    if (contract.write_scope !== 'none' && !args.allowWrite) throw new Error(contract.id + ' writes ' + contract.write_scope + '; repeat with --allow-write');
    return 'selected case, host adapter and write authorization are compatible';
  });
  check('skill-source', () => {
    source = skillSourceDirectory(args.skillSource);
    function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isSymbolicLink()) throw new Error('skill snapshot cannot contain symlinks');
        if (entry.isDirectory()) walk(full);
        else if (!entry.isFile()) throw new Error('skill snapshot must contain regular files');
      }
    }
    walk(source);
    return 'four public skills and shared resources exist; source tree has no links';
  });
  if (contract && source) check('prompt', () => {
    if (!/^yan-[a-z-]+:\d+$/.test(contract.prompt_ref || '')) throw new Error('invalid prompt_ref');
    promptFor(contract, args.invocation === 'native' ? '.agents/skills' : '.yan-host-eval-runtime/skills', args.invocation, source);
    return 'current task resolves against the selected skill source';
  });
  if (contract && source && contract.route_loading) check('route-resources', () => {
    if (!Number.isInteger(contract.route_loading.max_resources) || contract.route_loading.max_resources < 1) throw new Error('invalid route resource limit');
    for (const resource of contract.route_loading.required || []) {
      if (!resource.startsWith('skills/')) throw new Error('route resource must start with skills/');
      const file = path.join(source, fixturePath(resource.slice(7)));
      if (!fs.statSync(file).isFile()) throw new Error('required skill resource missing: ' + resource);
    }
    for (const pattern of contract.route_loading.forbidden_patterns || []) new RegExp(pattern);
    return 'declared route resources exist in the selected skill version';
  });
  if (contract) check('grader-config', () => {
    if (contract.write_scope === 'code-and-tests' && !contract.allowed_path_patterns?.length) throw new Error('code-and-tests requires allowed_path_patterns');
    if (contract.allowed_path_patterns !== undefined && !Array.isArray(contract.allowed_path_patterns)) throw new Error('allowed_path_patterns must be an array');
    for (const pattern of contract.allowed_path_patterns || []) {
      if (typeof pattern !== 'string' || !pattern) throw new Error('invalid allowed path pattern');
      new RegExp(pattern);
    }
    const assertions = contract.assertions || {};
    for (const key of ['text', 'content', 'forbidden_text', 'artifacts']) {
      if (assertions[key] !== undefined && !Array.isArray(assertions[key])) throw new Error('assertions.' + key + ' must be an array');
    }
    for (const rule of [...(assertions.text || []), ...(assertions.content || [])]) {
      if (typeof rule.pattern !== 'string' || !rule.pattern || !Number.isInteger(rule.min_matches) || rule.min_matches < 1) throw new Error('invalid assertion pattern/count');
      new RegExp(rule.pattern, 'g');
    }
    for (const pattern of assertions.forbidden_text || []) new RegExp(pattern, 'i');
    for (const rule of [...(assertions.artifacts || []), ...(assertions.content || [])]) {
      if (typeof rule.glob !== 'string' || !rule.glob || !Number.isInteger(rule.min_matches) || rule.min_matches < 1) throw new Error('invalid artifact assertion');
      globToRegex(rule.glob);
    }
    if (contract.outcome_verifier) {
      if (contract.outcome_verifier !== 'query-contract') throw new Error('unknown outcome verifier');
      if (!fs.statSync(path.join(root, 'scripts/eval-verifiers/query-contract.js')).isFile()) throw new Error('outcome verifier missing');
    }
    if (contract.required_fixture_paths !== undefined) {
      if (!Array.isArray(contract.required_fixture_paths)) throw new Error('required_fixture_paths must be an array');
      contract.required_fixture_paths.forEach(fixturePath);
    }
    return 'configured patterns and trusted verifier references are valid; no verifier executed';
  });
  if (args.workspace) check('workspace', () => {
    workspace = path.resolve(args.workspace);
    if (!fs.statSync(workspace).isDirectory()) throw new Error('workspace is not a directory');
    const top = readGit(['rev-parse', '--show-toplevel']).trim();
    if (fs.realpathSync(workspace) !== fs.realpathSync(top)) throw new Error('--workspace must name the Git worktree root');
    fixtureHead = readGit(['rev-parse', '--verify', 'HEAD']).trim();
    if (/^160000 /m.test(readGit(['ls-files', '--stage']))) throw new Error('fixture contains submodules; this runner does not restore submodule worktrees');
    const reserved = args.invocation === 'native' ? '.agents' : '.yan-host-eval-runtime';
    if (readGit(['ls-tree', 'HEAD', '--', reserved]).trim()) throw new Error('committed fixture contains reserved runtime path: ' + reserved);
    return 'Git worktree and clone baseline verified: ' + fixtureHead;
  });
  if (workspace && fixtureHead) {
    check('clean-fixture', () => {
      if (readGit(['status', '--porcelain=v1', '-z', '--untracked-files=all', '--ignore-submodules=all']).length) {
        throw new Error('workspace has uncommitted or untracked files; clone uses committed HEAD only. Prepare a separate fixture with the intended contents; do not auto-commit or discard the source work.');
      }
      return 'committed HEAD matches non-ignored working files';
    });
    if (!contract?.required_fixture_paths?.length) checks.push({ id: 'fixture-resources', status: 'unresolved', detail: 'No required fixture files declared; task input completeness is not established.' });
    else check('fixture-resources', () => {
      for (const value of contract?.required_fixture_paths || []) {
        const relative = fixturePath(value);
        const full = path.join(workspace, relative);
        if (!within(fs.realpathSync(workspace), physicalPath(full)) || fs.lstatSync(full).isSymbolicLink() || !fs.statSync(full).isFile()) throw new Error('fixture input is not a contained regular file: ' + relative);
        readGit(['ls-files', '--error-unmatch', '--', relative]);
      }
      return 'declared fixture files are present and tracked; undeclared or ignored dependencies are not guaranteed';
    });
    if (args.output) check('result-path', () => {
      if (within(fs.realpathSync(workspace), physicalPath(args.output))) throw new Error('--output must not be inside the supplied workspace; write results outside the source tree');
      return 'result destination stays outside the supplied workspace; no file written';
    });
  }
  checks.push({ id: 'runtime', status: 'unresolved', detail: 'Host executable, credentials, model/service access, ignored dependencies and actual behavior are not executed or verified. Use --probe for CLI availability and --live for a real sample.' });
  return {
    schemaVersion: 1, kind: 'host-eval-preflight', liveModelCalls: false,
    valid: !checks.some(item => item.status === 'invalid'),
    case: args.case || null, host: args.host || null, fixtureHead: fixtureHead || null,
    checks,
    limitation: 'Read-only filesystem and Git inspection only; no host, verifier, clone, dependency installation or network access. This report is not an evaluation result.',
  };
}

module.exports = { inspect, fixturePath };
