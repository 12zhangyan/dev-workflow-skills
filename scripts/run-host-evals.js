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
    const match = shim.match(/%dp0%\\([^"\r\n]+\.js)/i)
      || shim.match(/%dp0%\\([^"\r\n]+\.exe)/i);
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

function promptFor(contract, skillSnapshotRoot) {
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
    `使用 ${skill} skill 处理下面的真实任务。`,
    `本次评估的 Skill 快照位于 ${skillSnapshotRoot}；从这里读取当前 checkout 的指令和相对资源，不要访问用户主目录中的 Skill。`,
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

function parsePorcelainZ(value) {
  const entries = value.split('\0').filter(Boolean);
  const paths = [];
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    if (entry.length < 4 || entry[2] !== ' ') continue;
    const status = entry.slice(0, 2);
    paths.push(entry.slice(3).replace(/\\/g, '/'));
    if (/[RC]/.test(status) && entries[index + 1]) {
      paths.push(entries[++index].replace(/\\/g, '/'));
    }
  }
  return [...new Set(paths)];
}

function gitStatus(workspace) {
  const result = git(workspace, ['-c', 'core.quotePath=false', 'status', '--porcelain=v1', '-z', '--untracked-files=all']);
  return {
    status: result.status,
    raw: result.stdout || '',
    paths: parsePorcelainZ(result.stdout || ''),
  };
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

function stageSkillSnapshot(workspace) {
  const skillSnapshotRoot = '.yan-host-eval-runtime/skills';
  const runtimeRoot = path.join(workspace, '.yan-host-eval-runtime');
  if (fs.existsSync(runtimeRoot)) {
    throw new Error('isolated workspace already contains reserved .yan-host-eval-runtime path');
  }
  const excludePath = path.join(workspace, '.git', 'info', 'exclude');
  fs.appendFileSync(excludePath, '\n/.yan-host-eval-runtime/\n', 'utf8');
  fs.mkdirSync(runtimeRoot, { recursive: true });
  fs.cpSync(path.join(root, 'skills'), path.join(runtimeRoot, 'skills'), { recursive: true });
  return { skillSnapshotRoot };
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
  try {
    const { skillSnapshotRoot } = stageSkillSnapshot(isolated);
    return { tempRoot, workspace: isolated, skillSnapshotRoot };
  } catch (error) {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    throw error;
  }
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
  let pattern = '^';
  for (let index = 0; index < glob.length; index += 1) {
    const char = glob[index];
    if (char === '*' && glob[index + 1] === '*') {
      if (glob[index + 2] === '/') {
        pattern += '(?:.*/)?';
        index += 2;
      } else {
        pattern += '.*';
        index += 1;
      }
    } else if (char === '*') {
      pattern += '[^/]*';
    } else if ('\\.^$+?()[]{}|'.includes(char)) {
      pattern += `\\${char}`;
    } else {
      pattern += char;
    }
  }
  return new RegExp(`${pattern}$`);
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
  const contentResults = (assertions.content || []).map((item) => {
    const matchingFiles = changedPaths.filter((file) => globToRegex(item.glob).test(file));
    let matchCount = 0;
    const matchesByFile = [];
    for (const file of matchingFiles) {
      const full = path.join(workspace, file);
      let content;
      try {
        content = fs.readFileSync(full, 'utf8');
      } catch {
        continue;
      }
      const count = (content.match(new RegExp(item.pattern, 'g')) || []).length;
      if (count) matchesByFile.push({ file, count });
      matchCount += count;
    }
    return { ...item, matching_files: matchingFiles, matches_by_file: matchesByFile, match_count: matchCount, passed: matchCount >= item.min_matches };
  });
  const results = [...artifactResults, ...textResults, ...contentResults];
  return {
    passed: results.every((item) => item.passed),
    artifacts: artifactResults,
    text: textResults,
    content: contentResults,
  };
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
  const routeMatch = output.match(/^\s*ROUTE:\s*([a-z0-9+_ -]+?)\s*$/im);
  const scopeMatch = output.match(/^\s*WRITE_SCOPE:\s*([a-z-]+)/im);
  const observedRoute = routeMatch ? routeMatch[1].toLowerCase().replace(/\s+/g, '') : null;
  const observedScope = scopeMatch ? scopeMatch[1].toLowerCase() : null;
  const acceptedRoutes = contract.accepted_routes || [contract.route];
  return {
    passed: acceptedRoutes.includes(observedRoute)
      && observedScope === contract.write_scope
      && drift.allowed
      && assertions.passed
      && routeLoading.passed,
    observedRoute,
    observedScope,
    expectedRoute: contract.route,
    acceptedRoutes,
    expectedScope: contract.write_scope,
    workspaceDrift: drift,
    assertions,
    routeLoading,
  };
}

function compactDiagnostics(value, limit = 8000) {
  if (value.length <= limit) return { text: value, truncated: false };
  const headLength = Math.floor(limit / 4);
  const tailLength = limit - headLength;
  return {
    text: `${value.slice(0, headLength)}\n\n[... ${value.length - limit} diagnostic characters omitted ...]\n\n${value.slice(-tailLength)}`,
    truncated: true,
  };
}

function runSelfTest() {
  if (!globToRegex('docs/**/*.md').test('docs/plan.md')
      || !globToRegex('docs/**/*.md').test('docs/2026-09-03/plan.md')
      || globToRegex('docs/**/*.md').test('src/plan.md')) {
    throw new Error('glob matching does not cover zero or nested directories safely');
  }
  const unicodePaths = parsePorcelainZ('?? docs/2026-09-03/订单方案.md\0 M src/Order.java\0');
  if (unicodePaths.length !== 2 || unicodePaths[0] !== 'docs/2026-09-03/订单方案.md') {
    throw new Error('NUL-delimited Git status did not preserve Unicode paths');
  }
  const compacted = compactDiagnostics('a'.repeat(12000));
  if (!compacted.truncated || compacted.text.length >= 12000 || !compacted.text.includes('omitted')) {
    throw new Error('diagnostic compaction did not preserve a bounded failure summary');
  }
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
  const alternateRoute = assess(
    { route: 'composite', accepted_routes: ['composite', 'incident+business'], write_scope: 'none' },
    'ROUTE: incident + business\nWRITE_SCOPE: none',
    { allowed: true },
    { passed: true },
    { passed: true },
  );
  if (!alternateRoute.passed || alternateRoute.observedRoute !== 'incident+business') {
    throw new Error('equivalent composite route spelling was rejected');
  }
  const assertionTemp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'yan-host-eval-assertion-'));
  try {
    const behaviorFixtures = [
      ['review-loop-closed-loop', null, ''],
      ['analysis-incident-artifacts', 'docs/bugs/fixture.md', '现象：重复扣款。证据：日志显示两次回调，根因待验证。'],
      ['analysis-business-artifacts', 'docs/biz-flow/fixture.md', '入口：退款申请。状态：提交后待审批，驳回不归档。'],
      ['handoff-persistent-doc', 'docs/handoffs/fixture.md', '目标：排查订单。证据：测试未运行。下一步：核验入口。']
    ];
    for (const [id, artifact, content] of behaviorFixtures) {
      const behaviorContract = contracts.cases.find(item => item.id === id);
      const receipt = `ROUTE: ${behaviorContract.route}\nWRITE_SCOPE: ${behaviorContract.write_scope}`;
      const bare = assessAssertions(behaviorContract, receipt, assertionTemp, []);
      if (bare.passed) throw new Error(`${id} accepted a routing receipt without work evidence`);
      const output = receipt + '\n已审查 backend/src/Order.java，未发现有证据的问题；javac 编译并运行测试，2 tests passed。';
      if (id === 'review-loop-closed-loop'
          && assessAssertions(behaviorContract, receipt + '\n已审查 backend/src/Order.java，未发现问题；测试未运行。', assertionTemp, []).passed) {
        throw new Error('loop accepted missing verification evidence as completion');
      }
      if (artifact) {
        fs.mkdirSync(path.dirname(path.join(assertionTemp, artifact)), { recursive: true });
        fs.writeFileSync(path.join(assertionTemp, artifact), content, 'utf8');
        if (assessAssertions(behaviorContract, receipt, assertionTemp, []).passed) {
          throw new Error(`${id} accepted an unchanged historical artifact`);
        }
      }
      if (!assessAssertions(behaviorContract, output, assertionTemp, artifact ? [artifact] : []).passed) {
        throw new Error(`${id} rejected the scoped behavioral evidence fixture`);
      }
    }
    fs.mkdirSync(path.join(assertionTemp, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(assertionTemp, 'docs', 'plan.md'), '# Plan\nWP-1 contract\nWP-2 frontend\n', 'utf8');
    const assertionResult = assessAssertions(
      { assertions: { content: [{ glob: 'docs/**/*.md', pattern: 'WP-[12]', min_matches: 2 }] } },
      '',
      assertionTemp,
      ['docs/plan.md'],
    );
    if (!assertionResult.passed || assertionResult.content[0].match_count !== 2) {
      throw new Error('changed-artifact content assertion was not evaluated');
    }
  } finally {
    fs.rmSync(assertionTemp, { recursive: true, force: true });
  }
  const snapshotTemp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'yan-host-eval-self-test-'));
  try {
    const fixture = path.join(snapshotTemp, 'fixture');
    const gitInfo = path.join(fixture, '.git', 'info');
    fs.mkdirSync(gitInfo, { recursive: true });
    fs.writeFileSync(path.join(gitInfo, 'exclude'), '', 'utf8');
    const snapshot = stageSkillSnapshot(fixture);
    if (!fs.existsSync(path.join(fixture, snapshot.skillSnapshotRoot, 'yan-dev-doc', 'SKILL.md'))) {
      throw new Error('skill snapshot did not include yan-dev-doc/SKILL.md');
    }
    const exclude = fs.readFileSync(path.join(gitInfo, 'exclude'), 'utf8');
    if (!exclude.includes('/.yan-host-eval-runtime/')) {
      throw new Error('skill snapshot path was not excluded from Git status');
    }
  } finally {
    fs.rmSync(snapshotTemp, { recursive: true, force: true });
  }
  console.log('ok host eval route-loading, artifact-content, and current-skill snapshot self-tests passed');
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
  const before = gitStatus(isolation.workspace);
  const prompt = promptFor(contract, isolation.skillSnapshotRoot);
  const invocation = liveArgs(args.host, probe.command, isolation.workspace, prompt, args.model, contract.write_scope);
  const startedAt = new Date().toISOString();
  const started = Date.now();
  const run = spawnPortable(invocation.command, invocation.args, {
    cwd: invocation.cwd,
    input: invocation.input,
    timeout: args.timeoutMs,
    maxBuffer: 16 * 1024 * 1024,
  });
  const after = gitStatus(isolation.workspace);
  const changedPaths = after.paths;
  const allowedPrefixes = contract.write_scope === 'none' ? [] : contract.write_scope === 'docs' ? ['docs/'] : contract.write_scope === 'docs-and-board' ? ['docs/', 'project-html/'] : null;
  const allowedPathMatchers = (contract.allowed_path_patterns || []).map((pattern) => new RegExp(pattern));
  const codeAndTestsAllowed = contract.write_scope !== 'code-and-tests'
    || (allowedPathMatchers.length > 0
      && changedPaths.every((file) => allowedPathMatchers.some((matcher) => matcher.test(file))));
  const drift = {
    before: before.paths,
    after: after.paths,
    changedPaths,
    allowed: before.status === 0
      && before.paths.length === 0
      && after.status === 0
      && codeAndTestsAllowed
      && (contract.write_scope === 'code-and-tests' || changedPaths.every((file) => allowedPrefixes.some((prefix) => file.startsWith(prefix)))),
    allowedPathPatterns: contract.allowed_path_patterns || [],
  };
  const modelOutput = (run.stdout || '').trim();
  const diagnostics = (run.stderr || '').trim();
  const diagnosticSummary = compactDiagnostics(diagnostics);
  const routeLoading = assessRouteLoading(contract, modelOutput);
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
    isolation: {
      kind: 'temporary-git-clone',
      sourceWorkspace,
      workspaceWasWritten: false,
      skillSnapshot: { kind: 'current-checkout-copy', root: isolation.skillSnapshotRoot },
    },
    metrics: {
      durationMs,
      outputChars: modelOutput.length,
      diagnosticChars: diagnostics.length,
      loadedResourceCount: routeLoading.count,
    },
    assessment: assess(
      contract,
      modelOutput,
      drift,
      assessAssertions(contract, modelOutput, isolation.workspace, changedPaths),
      routeLoading,
    ),
    output: modelOutput,
    diagnostics: diagnosticSummary.text,
    diagnosticsTruncated: diagnosticSummary.truncated,
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
