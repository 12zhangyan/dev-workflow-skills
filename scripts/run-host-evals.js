#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const contracts = JSON.parse(fs.readFileSync(path.join(root, 'skills', '_shared', 'host-contracts.json'), 'utf8'));
const hostSpecs = {
  claude: {
    env: 'YAN_CLAUDE_EVAL_COMMAND',
    commands: process.platform === 'win32' ? ['claude.cmd', 'claude.exe', 'claude'] : ['claude'],
    versionArgs: ['--version'],
  },
  cursor: {
    env: 'YAN_CURSOR_EVAL_COMMAND',
    commands: process.platform === 'win32'
      ? ['cursor-agent.exe', 'cursor-agent.cmd', 'cursor-agent']
      : ['cursor-agent'],
    versionArgs: ['--version'],
  },
  codex: {
    env: 'YAN_CODEX_EVAL_COMMAND',
    commands: process.platform === 'win32' ? ['codex.cmd', 'codex.exe', 'codex'] : ['codex'],
    versionArgs: ['--version'],
  },
};

function usage(message) {
  if (message) console.error(`ERROR: ${message}`);
  console.error([
    'Usage:',
    '  node scripts/run-host-evals.js --probe [--json]',
    '  node scripts/run-host-evals.js --self-test',
    '  node scripts/run-host-evals.js --live --host <claude|cursor|codex>',
    '    --case <contract-id> --workspace <clean-git-worktree>',
    '    [--allow-write] [--model <model>] [--output <result.json>] [--timeout-ms <ms>]',
    '',
    'Live mode is opt-in. Writable contracts also require --allow-write and always',
    'run in a runner-created temporary Git clone; the supplied workspace is never written.',
    'Override host commands with YAN_*_EVAL_COMMAND.',
  ].join('\n'));
  process.exit(message ? 2 : 0);
}

function parseArgs(argv) {
  const args = { probe: true, json: false, live: false, allowWrite: false, timeoutMs: 600000 };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') usage();
    else if (arg === '--probe') args.probe = true;
    else if (arg === '--self-test') {
      args.selfTest = true;
      args.probe = false;
    }
    else if (arg === '--json') args.json = true;
    else if (arg === '--live') {
      args.live = true;
      args.probe = false;
    } else if (arg === '--allow-write') {
      args.allowWrite = true;
    } else if (['--host', '--case', '--workspace', '--model', '--output', '--timeout-ms'].includes(arg)) {
      const value = argv[++index];
      if (!value) usage(`${arg} requires a value`);
      const key = arg.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      args[key] = value;
    } else usage(`unknown argument: ${arg}`);
  }
  args.timeoutMs = Number(args.timeoutMs);
  if (!Number.isInteger(args.timeoutMs) || args.timeoutMs < 1000) usage('--timeout-ms must be an integer >= 1000');
  return args;
}

function commandPath(command) {
  if (path.isAbsolute(command)) return fs.existsSync(command) ? command : '';
  const lookup = spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', [command], {
    encoding: 'utf8',
    windowsHide: true,
  });
  if (lookup.status !== 0) return '';
  return (lookup.stdout || '').split(/\r?\n/).map((line) => line.trim()).find(Boolean) || '';
}

function spawnPortable(command, args, options = {}) {
  const isBatch = process.platform === 'win32' && /\.(?:cmd|bat)$/i.test(command);
  return spawnSync(command, args, {
    ...options,
    encoding: 'utf8',
    windowsHide: true,
    shell: isBatch,
  });
}

function unwrapNodeShim(command) {
  if (process.platform !== 'win32' || !/\.cmd$/i.test(command)) {
    return { command, prefixArgs: [] };
  }
  try {
    const shim = fs.readFileSync(command, 'utf8');
    const match = shim.match(/%dp0%\\([^"\r\n]+\.(?:js|exe))/i);
    if (!match) return { command, prefixArgs: [] };
    const target = path.resolve(path.dirname(command), match[1]);
    if (!fs.existsSync(target)) return { command, prefixArgs: [] };
    return path.extname(target).toLowerCase() === '.js'
      ? { command: process.execPath, prefixArgs: [target] }
      : { command: target, prefixArgs: [] };
  } catch {
    return { command, prefixArgs: [] };
  }
}

function probeHost(host) {
  const spec = hostSpecs[host];
  const configured = process.env[spec.env];
  const candidates = configured ? [configured] : spec.commands;
  const command = candidates.map(commandPath).find(Boolean) || '';
  if (!command) {
    return { host, available: false, command: null, reason: `command not found; set ${spec.env}` };
  }
  const result = spawnPortable(command, spec.versionArgs, { timeout: 15000 });
  const version = `${result.stdout || ''}${result.stderr || ''}`.trim().split(/\r?\n/)[0] || '';
  if (result.status !== 0) {
    return {
      host,
      available: false,
      command,
      reason: `version probe failed with exit ${result.status}: ${version || 'no output'}`,
    };
  }
  return { host, available: true, command, version };
}

function installedState(host) {
  const home = process.env.USERPROFILE || process.env.HOME;
  if (!home) return { manifest: false, reason: 'HOME is unavailable' };
  const manifestPath = path.join(home, `.${host}`, 'skills', '.yan-dev-workflow-skills.json');
  if (!fs.existsSync(manifestPath)) return { manifest: false, path: manifestPath };
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    return {
      manifest: true,
      path: manifestPath,
      sourceVersion: manifest.sourceVersion || null,
      managedSkills: manifest.managedSkills || [],
    };
  } catch (error) {
    return { manifest: false, path: manifestPath, reason: `invalid manifest: ${error.message}` };
  }
}

function promptFor(contract) {
  const [skill, idText] = contract.prompt_ref.split(':');
  const evalPath = path.join(root, 'skills', skill, 'evals.json');
  const evalFile = JSON.parse(fs.readFileSync(evalPath, 'utf8').replace(/^\uFEFF/, ''));
  const scenario = evalFile.evals.find((item) => Number(item.id) === Number(idText));
  if (!scenario) throw new Error(`missing scenario ${contract.prompt_ref}`);
  const scopeRule = contract.write_scope === 'none'
    ? 'Keep the workspace read-only; do not create, modify, or delete files.'
    : `You may write only within ${contract.write_scope}, and nowhere else.`;
  const loadingReceipt = contract.route_loading ? [
    '第三行输出：',
    'LOADED_RESOURCES: <本次实际打开的 skills/... Markdown 路径，英文逗号分隔>',
    '只列实际读取的 Skill Markdown 资料，统一写成仓库相对 skills/... 路径；不要把“本应读取”但未打开的资料写入回执。',
  ] : [];
  return [
    `使用已安装的 ${skill} skill 处理下面的真实任务。`,
    '遵循项目规则和下述写入边界。',
    '回答开头先单独输出两行：',
    'ROUTE: <实际选择的 mode>',
    'WRITE_SCOPE: <none|docs|docs-and-board|code-and-tests>',
    ...loadingReceipt,
    '',
    `写入边界：${scopeRule}`,
    scenario.prompt,
  ].join('\n');
}

function git(workspace, args) {
  return spawnSync('git', ['-C', workspace, ...args], { encoding: 'utf8', windowsHide: true });
}

function assertSourceWorkspace(workspace) {
  const absolute = path.resolve(workspace);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isDirectory()) {
    throw new Error(`workspace is not a directory: ${absolute}`);
  }
  const top = git(absolute, ['rev-parse', '--show-toplevel']);
  if (top.status !== 0) throw new Error('live eval workspace must be a Git worktree');
  return absolute;
}

function createIsolation(sourceWorkspace) {
  const tempRoot = fs.mkdtempSync(path.join(require('os').tmpdir(), 'yan-host-eval-'));
  const isolated = path.join(tempRoot, 'workspace');
  const clone = spawnSync('git', ['clone', '--no-local', sourceWorkspace, isolated], {
    encoding: 'utf8', windowsHide: true,
  });
  if (clone.status !== 0) {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    throw new Error(`failed to create isolated Git clone: ${(clone.stderr || clone.stdout || '').trim()}`);
  }
  return { tempRoot, workspace: isolated };
}

function liveArgs(host, command, workspace, prompt, model, writeScope) {
  const writable = writeScope !== 'none';
  if (host === 'codex') {
    const args = ['exec', '--ephemeral', '--sandbox', writable ? 'workspace-write' : 'read-only', '--skip-git-repo-check', '-C', workspace];
    if (model) args.push('--model', model);
    args.push('-');
    const direct = unwrapNodeShim(command);
    return {
      command: direct.command,
      args: [...direct.prefixArgs, ...args],
      cwd: workspace,
      input: Buffer.from(prompt, 'utf8'),
    };
  }
  if (host === 'claude') {
    const args = ['-p', prompt, '--output-format', 'text', '--permission-mode', writable ? 'acceptEdits' : 'plan', '--max-turns', '12'];
    if (model) args.push('--model', model);
    const direct = unwrapNodeShim(command);
    return { command: direct.command, args: [...direct.prefixArgs, ...args], cwd: workspace };
  }
  const args = ['-p', prompt, '--output-format', 'text'];
  if (model) args.push('--model', model);
  const direct = unwrapNodeShim(command);
  return { command: direct.command, args: [...direct.prefixArgs, ...args], cwd: workspace };
}

function listFiles(rootDir) {
  const files = [];
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === '.git') continue;
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) files.push(path.relative(rootDir, full).replace(/\\/g, '/'));
    }
  }
  walk(rootDir);
  return files;
}

function globToRegex(glob) {
  return new RegExp(`^${glob.replace(/[.+^${}()|[\\]\\]/g, '\\$&').replace(/\\*\\*/g, '.*').replace(/\\*/g, '[^/]*')}$`);
}

function assessAssertions(contract, output, workspace, changedPaths) {
  const assertions = contract.assertions || {};
  const files = listFiles(workspace);
  const artifactResults = (assertions.artifacts || []).map((item) => {
    const matches = files.filter((file) => changedPaths.includes(file) && globToRegex(item.glob).test(file));
    return { ...item, matches, passed: matches.length >= item.min_matches };
  });
  const textResults = (assertions.text || []).map((item) => {
    const matches = output.match(new RegExp(item.pattern, 'g')) || [];
    return { ...item, match_count: matches.length, passed: matches.length >= item.min_matches };
  });
  return { passed: [...artifactResults, ...textResults].every((item) => item.passed), artifacts: artifactResults, text: textResults };
}

function normalizeReceiptPath(value) {
  const normalized = value.trim().replace(/^[`'"]+|[`'"]+$/g, '').replace(/\\/g, '/');
  const skillsIndex = normalized.indexOf('skills/');
  return skillsIndex >= 0 ? normalized.slice(skillsIndex) : normalized;
}

function assessRouteLoading(contract, output) {
  if (!contract.route_loading) {
    return { required: false, passed: true, resources: [], count: 0 };
  }
  const receiptMatch = output.match(/^\s*LOADED_RESOURCES:\s*(.+)$/im);
  const resources = receiptMatch
    ? [...new Set(receiptMatch[1].split(',').map(normalizeReceiptPath).filter(Boolean))]
    : [];
  const requiredMissing = contract.route_loading.required.filter((item) => !resources.includes(item));
  const forbiddenMatches = [];
  for (const pattern of contract.route_loading.forbidden_patterns) {
    const matcher = new RegExp(pattern);
    const matches = resources.filter((item) => matcher.test(item));
    if (matches.length) forbiddenMatches.push({ pattern, matches });
  }
  const withinLimit = resources.length <= contract.route_loading.max_resources;
  return {
    required: true,
    passed: Boolean(receiptMatch) && requiredMissing.length === 0 && forbiddenMatches.length === 0 && withinLimit,
    resources,
    count: resources.length,
    maxResources: contract.route_loading.max_resources,
    requiredMissing,
    forbiddenMatches,
    withinLimit,
    receiptPresent: Boolean(receiptMatch),
  };
}

function assess(contract, output, drift, assertions, routeLoading) {
  const routeMatch = output.match(/^\s*ROUTE:\s*([a-z-]+)/im);
  const scopeMatch = output.match(/^\s*WRITE_SCOPE:\s*([a-z-]+)/im);
  const observedRoute = routeMatch ? routeMatch[1].toLowerCase() : null;
  const observedScope = scopeMatch ? scopeMatch[1].toLowerCase() : null;
  return {
    passed: observedRoute === contract.route
      && observedScope === contract.write_scope
      && drift.allowed
      && assertions.passed
      && routeLoading.passed,
    observedRoute,
    observedScope,
    expectedRoute: contract.route,
    expectedScope: contract.write_scope,
    workspaceDrift: drift,
    assertions,
    routeLoading,
  };
}

function runSelfTest() {
  const contract = {
    route_loading: {
      max_resources: 3,
      required: ['skills/yan-sample/SKILL.md', 'skills/yan-sample/modes/check/mode.md'],
      forbidden_patterns: ['^skills/yan-sample/modes/repair/'],
    },
  };
  const valid = assessRouteLoading(
    contract,
    'ROUTE: check\nWRITE_SCOPE: none\nLOADED_RESOURCES: skills/yan-sample/SKILL.md, skills\\yan-sample\\modes\\check\\mode.md',
  );
  if (!valid.passed || valid.count !== 2) throw new Error('valid route-loading receipt was rejected');
  const forbidden = assessRouteLoading(
    contract,
    'LOADED_RESOURCES: skills/yan-sample/SKILL.md, skills/yan-sample/modes/check/mode.md, skills/yan-sample/modes/repair/mode.md',
  );
  if (forbidden.passed || forbidden.forbiddenMatches.length !== 1) {
    throw new Error('forbidden route-loading receipt was not rejected');
  }
  const missing = assessRouteLoading(contract, 'LOADED_RESOURCES: skills/yan-sample/SKILL.md');
  if (missing.passed || missing.requiredMissing.length !== 1) {
    throw new Error('missing route-loading receipt resource was not rejected');
  }
  console.log('ok host eval route-loading self-test passed');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.selfTest) {
    runSelfTest();
    return;
  }
  if (args.probe) {
    const result = {
      mode: 'probe',
      liveModelCalls: false,
      hosts: contracts.hosts.map((host) => ({ ...probeHost(host), installed: installedState(host) })),
    };
    if (args.json) console.log(JSON.stringify(result, null, 2));
    else {
      for (const item of result.hosts) {
        console.log(`${item.host}: ${item.available ? `AVAILABLE ${item.version}` : `UNAVAILABLE ${item.reason}`}`);
      }
    }
    return;
  }

  if (!args.live || !hostSpecs[args.host]) usage('--live requires a supported --host');
  if (!args.case || !args.workspace) usage('--live requires --case and --workspace');
  const contract = contracts.cases.find((item) => item.id === args.case);
  if (!contract) usage(`unknown contract case: ${args.case}`);
  if (contract.write_scope !== 'none' && !args.allowWrite) usage(`${contract.id} writes ${contract.write_scope}; repeat with --allow-write`);
  const sourceWorkspace = assertSourceWorkspace(args.workspace);
  if (args.output) {
    const outputPath = path.resolve(args.output);
    const sourcePrefix = `${sourceWorkspace}${path.sep}`;
    if (outputPath === sourceWorkspace || outputPath.startsWith(sourcePrefix)) {
      throw new Error('--output must not be inside the supplied workspace; write results outside the source tree');
    }
  }
  const probe = probeHost(args.host);
  if (!probe.available) throw new Error(`${args.host} is unavailable: ${probe.reason}`);
  const isolation = createIsolation(sourceWorkspace);
  const before = git(isolation.workspace, ['status', '--porcelain=v1', '--untracked-files=all']).stdout || '';
  const prompt = promptFor(contract);
  const invocation = liveArgs(args.host, probe.command, isolation.workspace, prompt, args.model, contract.write_scope);
  const startedAt = new Date().toISOString();
  const started = Date.now();
  const run = spawnPortable(invocation.command, invocation.args, {
    cwd: invocation.cwd,
    input: invocation.input,
    timeout: args.timeoutMs,
    maxBuffer: 16 * 1024 * 1024,
  });
  const after = git(isolation.workspace, ['status', '--porcelain=v1', '--untracked-files=all']);
  const changedPaths = (after.stdout || '').split(/\r?\n/).filter(Boolean).map((line) => line.slice(3));
  const allowedPrefixes = contract.write_scope === 'none' ? [] : contract.write_scope === 'docs' ? ['docs/'] : contract.write_scope === 'docs-and-board' ? ['docs/', 'project-html/'] : null;
  const drift = { before, after: after.stdout || '', changedPaths, allowed: after.status === 0 && (contract.write_scope === 'code-and-tests' || changedPaths.every((file) => allowedPrefixes.some((prefix) => file.startsWith(prefix)))) };
  const output = `${run.stdout || ''}${run.stderr ? `\n[stderr]\n${run.stderr}` : ''}`.trim();
  const routeLoading = assessRouteLoading(contract, output);
  const durationMs = Date.now() - started;
  const result = {
    schemaVersion: 1,
    host: args.host,
    command: probe.command,
    version: probe.version,
    case: contract.id,
    model: args.model || null,
    startedAt,
    durationMs,
    exitCode: run.status,
    timedOut: Boolean(run.error && run.error.code === 'ETIMEDOUT'),
    isolation: { kind: 'temporary-git-clone', sourceWorkspace, workspaceWasWritten: false },
    metrics: {
      durationMs,
      outputChars: output.length,
      loadedResourceCount: routeLoading.count,
    },
    assessment: assess(
      contract,
      output,
      drift,
      assessAssertions(contract, output, isolation.workspace, changedPaths),
      routeLoading,
    ),
    output,
  };
  const json = `${JSON.stringify(result, null, 2)}\n`;
  if (args.output) {
    const outputPath = path.resolve(args.output);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, json, 'utf8');
  }
  process.stdout.write(json);
  fs.rmSync(isolation.tempRoot, { recursive: true, force: true });
  if (run.status !== 0 || !result.assessment.passed) process.exitCode = 1;
}

try {
  main();
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  process.exit(1);
}
