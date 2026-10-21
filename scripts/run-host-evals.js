#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { inspect: inspectPreflight, OUTCOME_VERIFIERS } = require('./host-eval-preflight');

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
    '  node scripts/run-host-evals.js --preflight --host <host> --case <id> --workspace <worktree> [--allow-write]',
    '    Offline read-only Git/file inspection; no agent, clone, verifier or network.',
    '  node scripts/run-host-evals.js --live --host <claude|cursor|codex>',
    '    --case <contract-id> --workspace <clean-git-worktree>',
    '    [--allow-write] [--model <model>] [--output <result.json>] [--timeout-ms <ms>]',
    '    [--skill-source <skills-directory>]  Compare a saved version using the same case/grader.',
    '    [--invocation explicit|catalog|native] [--effort low|medium|high|xhigh|ultra]',
    '    Native discovery currently requires Codex JSON command evidence; catalog works across hosts.',
    '    [--reps <1-20>]  Repeat sequentially, each in a fresh isolated clone; N>1 writes one series result.',
    '',
    'Live mode is opt-in. Writable contracts also require --allow-write and always',
    'run in a runner-created temporary Git clone; the supplied workspace is never written.',
    'Override host commands with YAN_*_EVAL_COMMAND.',
  ].join('\n'));
  process.exit(message ? 2 : 0);
}

const MAX_REPS = 20;

function parseArgs(argv) {
  const args = { probe: true, json: false, live: false, allowWrite: false, timeoutMs: 600000, invocation: 'explicit' };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') usage();
    else if (arg === '--probe') { args.probe = true; args.explicitProbe = true; }
    else if (arg === '--self-test') {
      args.selfTest = true;
      args.probe = false;
    }
    else if (arg === '--json') args.json = true;
    else if (arg === '--preflight') {
      args.preflight = true;
      args.probe = false;
    }
    else if (arg === '--live') {
      args.live = true;
      args.probe = false;
    } else if (arg === '--allow-write') {
      args.allowWrite = true;
    } else if (['--host', '--case', '--workspace', '--model', '--output', '--timeout-ms', '--skill-source', '--invocation', '--effort', '--reps'].includes(arg)) {
      const value = argv[++index];
      if (!value) usage(`${arg} requires a value`);
      const key = arg.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      args[key] = value;
    } else usage(`unknown argument: ${arg}`);
  }
  if (args.preflight && (args.live || args.selfTest || args.explicitProbe)) usage('--preflight cannot be combined with --live, --probe or --self-test');
  args.timeoutMs = Number(args.timeoutMs);
  if (!Number.isInteger(args.timeoutMs) || args.timeoutMs < 1000) usage('--timeout-ms must be an integer >= 1000');
  const explicitReps = args.reps !== undefined;
  args.reps = explicitReps ? Number(args.reps) : 1;
  if (!Number.isInteger(args.reps) || args.reps < 1 || args.reps > MAX_REPS) usage(`--reps must be an integer from 1 to ${MAX_REPS}`);
  if (explicitReps && !args.live) usage('--reps requires --live');
  if (!['explicit', 'catalog', 'native'].includes(args.invocation)) usage('unknown --invocation');
  if (args.effort && !['low', 'medium', 'high', 'xhigh', 'ultra'].includes(args.effort)) usage('unknown --effort');
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
  const direct = unwrapNodeShim(command);
  const result = spawnPortable(direct.command, [...direct.prefixArgs, ...spec.versionArgs], { timeout: 15000 });
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
  const manifestPath = path.join(home, '.agents', 'skills', '.yan-dev-workflow-skills.json');
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

function skillCatalog(source, snapshotRoot) {
  return fs.readdirSync(source).filter(name => fs.existsSync(path.join(source, name, 'SKILL.md'))).sort().map(name => {
    const text = fs.readFileSync(path.join(source, name, 'SKILL.md'), 'utf8').replace(/^\uFEFF/, '');
    const header = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    const description = header?.[1].match(/^description:\s*(.+)$/m)?.[1];
    if (!description) throw new Error('missing discovery description: ' + name);
    return JSON.stringify({ name, description, path: snapshotRoot + '/' + name + '/SKILL.md' });
  });
}

function decodeHostOutput(host, stdout) {
  if (host !== 'codex') return { text: stdout.trim(), commands: [], traceAvailable: false };
  const events = [];
  for (const line of stdout.split(/\r?\n/).filter(Boolean)) {
    try { events.push(JSON.parse(line)); } catch { /* CLI diagnostics cannot count as a model answer. */ }
  }
  const messages = events.filter(event => event.type === 'item.completed' && event.item?.type === 'agent_message');
  return {
    text: messages.length ? messages[messages.length - 1].item.text.trim() : '',
    commands: events.filter(event => event.type === 'item.completed' && event.item?.type === 'command_execution')
      .map(event => ({ command: event.item.command || '', exitCode: event.item.exit_code })),
    traceAvailable: events.some(event => event.type === 'turn.completed'),
  };
}

function assessSelection(contract, output, invocation, trace, snapshotRoot, workspace = '') {
  if (invocation === 'explicit') return { required: false, passed: true };
  const expected = contract.selection.expected_skill;
  const selected = output.match(/^\s*SKILL:\s*([^\r\n]+)$/im)?.[1].trim();
  const files = output.match(/^\s*SKILL_FILES:\s*([^\r\n]+)$/im)?.[1].trim().replace(/\\/g, '/');
  const target = expected === 'none' ? null : snapshotRoot + '/' + expected + '/SKILL.md';
  const entries = (files || '').split(/[,;，；]/).map(file => file.trim().replace(/^[\x60'"]+|[\x60'"]+$/g, ''));
  const candidates = target ? [target, ...(workspace ? [workspace.replace(/\\/g, '/') + '/' + target] : [])] : [];
  const receiptMatches = expected === 'none' ? files === 'none' : entries.some(file => candidates.includes(file));
  const reads = trace.commands.filter(item => item.exitCode === 0 && /get-content|\bcat\b|\btype\b|\bsed\b|\brg\b|readfile/i.test(item.command)
    && /SKILL\.md/i.test(item.command));
  const matchingReads = reads.filter(item => candidates.some(candidate => {
    const escaped = candidate.replace(/[.*+?^\u0024{}()|[\]\\]/g, '\\$&');
    return new RegExp('(^|[\\s"\u0027\u0060])' + escaped + '(?=[\\s"\u0027\u0060;)]|$)').test(item.command.replace(/\\+/g, '/'));
  }));
  const nativeVerified = trace.traceAvailable && (expected === 'none' ? reads.length === 0 : matchingReads.length > 0);
  return {
    required: true,
    passed: selected === expected && receiptMatches && (invocation !== 'native' || nativeVerified),
    expected, selected: selected || null, receiptMatches,
    evidenceKind: invocation === 'native' ? 'codex-completed-command-and-receipt' : 'self-reported-selection-and-loading',
    nativeDiscoveryVerified: invocation === 'native' ? nativeVerified : null,
    entryReadCommands: matchingReads.map(item => item.command),
  };
}

function promptFor(contract, skillSnapshotRoot, invocation = 'explicit', skillSource = path.join(root, 'skills')) {
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
  const introductions = invocation === 'explicit' ? [
    `使用 ${skill} skill 处理下面的真实任务。`,
    `本次评估的 Skill 快照位于 ${skillSnapshotRoot}；从这里读取本次指定版本的指令和相对资源，不要访问用户主目录中的 Skill。`,
  ] : invocation === 'catalog' ? [
    '按任务判断是否使用以下可用技能；无需技能时直接处理。这里只提供发现元数据，不指定选项。',
    ...skillCatalog(skillSource, skillSnapshotRoot),
  ] : [];
  return [
    ...introductions,
    '遵循项目规则和下述写入边界。',
    '最终答复开头先单独输出两行（必须在最终回复中保留，不只写在进度消息中）：',
    'ROUTE: <实际选择的 mode>',
    'WRITE_SCOPE: <none|docs|docs-and-board|code-and-tests>',
    ...loadingReceipt,
    ...(invocation !== 'explicit' ? [
      '另输出 SKILL: <实际选用的技能名，无需技能填 none>；SKILL_FILES: <实际打开的技能入口路径，未打开填 none>。',
      '回执只记录实际操作，不需要技能时 ROUTE 填 none，不为填写回执额外读取技能。',
    ] : []),
    '',
    `写入边界：${scopeRule}`,
    scenario.prompt,
  ].join('\n');
}

function git(workspace, args) {
  return spawnSync('git', ['--no-optional-locks', '--no-lazy-fetch', '-c', 'core.fsmonitor=false', '-C', workspace, ...args], {
    encoding: 'utf8', windowsHide: true, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  });
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

// Snapshot ignored files and links too: a clean Git status is not a no-write receipt.
function snapshotTree(directory, skip = new Set()) {
  const entries = Object.create(null);
  function walk(current, prefix = '') {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const rel = prefix + entry.name;
      if (skip.has(rel)) continue;
      const full = path.join(current, entry.name);
      const stat = fs.lstatSync(full);
      if (stat.isSymbolicLink()) entries[rel] = 'link:' + fs.readlinkSync(full);
      else if (stat.isDirectory()) {
        entries[rel + '/'] = 'dir:' + (stat.mode & 0o777);
        walk(full, rel + '/');
      } else if (stat.isFile()) {
        entries[rel] = (stat.mode & 0o777) + ':' + crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex');
      } else throw new Error('cannot snapshot special file: ' + rel);
    }
  }
  walk(directory);
  return entries;
}

function changedEntries(before, after) {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((name) => before[name] !== after[name]).sort();
}

function workspaceSnapshot(workspace) {
  const status = gitStatus(workspace);
  const head = git(workspace, ['rev-parse', '--verify', 'HEAD']);
  const index = git(workspace, ['ls-files', '--stage', '-z']);
  return {
    status,
    head: head.stdout.trim(),
    index: index.stdout,
    valid: status.status === 0 && head.status === 0 && index.status === 0,
    files: snapshotTree(workspace, new Set(['.git'])),
    // Index contents are compared semantically above; stat-cache refreshes are harmless.
    // Refs, reflogs, config, hooks and exclude rules remain protected.
    metadata: snapshotTree(path.join(workspace, '.git'), new Set(['objects', 'index'])),
  };
}

function assessWorkspaceDrift(contract, before, after) {
  const changedPaths = changedEntries(before.files, after.files);
  const metadataChanges = changedEntries(before.metadata, after.metadata);
  const headChanged = before.head !== after.head;
  const indexChanged = before.index !== after.index;
  const allowedPathPatterns = contract.allowed_path_patterns || [];
  const matchers = allowedPathPatterns.map((pattern) => new RegExp(pattern));
  const allowedPrefixes = contract.write_scope === 'docs' ? ['docs/']
    : contract.write_scope === 'docs-and-board' ? ['docs/', 'project-html/'] : [];
  function allowedPath(file) {
    if (file === '.yan-host-eval-runtime/' || file.startsWith('.yan-host-eval-runtime/')) return false;
    if (contract.write_scope === 'code-and-tests') return matchers.some((matcher) => matcher.test(file));
    return allowedPrefixes.some((prefix) => file.startsWith(prefix));
  }
  // Directory creation is covered by its descendants. Empty directories still count as writes.
  const scopePaths = changedPaths.filter((file) => !file.endsWith('/')
    || !changedPaths.some((other) => other !== file && other.startsWith(file)));
  return {
    before: before.status.paths,
    after: after.status.paths,
    changedPaths,
    headBefore: before.head,
    headAfter: after.head,
    headChanged,
    indexChanged,
    metadataChanges,
    allowedPathPatterns,
    allowed: before.valid && after.valid && before.status.paths.length === 0
      && !headChanged && !indexChanged && metadataChanges.length === 0
      && scopePaths.every(allowedPath) && after.status.paths.every(allowedPath),
  };
}

// The model may already have made authorized edits before the verifier starts.
// Compare the verifier's own delta instead of requiring a clean worktree.
function assessVerifierDrift(before, after) {
  const changedPaths = changedEntries(before.files, after.files);
  const metadataChanges = changedEntries(before.metadata, after.metadata);
  const headChanged = before.head !== after.head;
  const indexChanged = before.index !== after.index;
  return {
    changedPaths,
    metadataChanges,
    headChanged,
    indexChanged,
    unchanged: before.valid && after.valid && changedPaths.length === 0
      && metadataChanges.length === 0 && !headChanged && !indexChanged,
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

function skillSourceDirectory(input) {
  const source = path.resolve(input || path.join(root, 'skills'));
  for (const name of ['yan-dev-doc', 'yan-code-review', 'yan-project-analysis', 'yan-conversation-handoff']) {
    if (!fs.existsSync(path.join(source, name, 'SKILL.md'))) {
      throw new Error('skill source must contain all four public skill directories: ' + source);
    }
  }
  if (!fs.existsSync(path.join(source, '_shared', 'host-capabilities.md'))) {
    throw new Error('skill source is missing shared runtime resources');
  }
  return source;
}

function treeFingerprint(directory) {
  const tree = snapshotTree(directory);
  return crypto.createHash('sha256').update(JSON.stringify(Object.keys(tree).sort().map(key => [key, tree[key]]))).digest('hex');
}

function stageSkillSnapshot(workspace, source = path.join(root, 'skills'), invocation = 'explicit') {
  const relativeRoot = invocation === 'native' ? '.agents' : '.yan-host-eval-runtime';
  const skillSnapshotRoot = relativeRoot + '/skills';
  const runtimeRoot = path.join(workspace, relativeRoot);
  if (fs.existsSync(runtimeRoot)) {
    throw new Error('isolated workspace already contains reserved ' + relativeRoot + ' path');
  }
  const excludePath = path.join(workspace, '.git', 'info', 'exclude');
  fs.appendFileSync(excludePath, '\n/' + relativeRoot + '/\n', 'utf8');
  fs.mkdirSync(runtimeRoot, { recursive: true });
  fs.cpSync(source, path.join(runtimeRoot, 'skills'), {
    recursive: true,
    filter(file) {
      if (fs.lstatSync(file).isSymbolicLink()) throw new Error('skill snapshot cannot contain symlinks');
      // Evaluation prompts, expected answers and graders are not agent runtime resources.
      return !['evals.json', 'host-contracts.json', 'route-loading-contracts.json'].includes(path.basename(file));
    },
  });
  if (invocation === 'native') {
    for (const file of listFiles(path.join(runtimeRoot, 'skills')).filter(file => path.basename(file) === 'SKILL.md')) {
      const full = path.join(runtimeRoot, 'skills', file);
      fs.writeFileSync(full, fs.readFileSync(full, 'utf8').replace(/^\uFEFF/, ''), 'utf8');
    }
  }
  return { skillSnapshotRoot, skillHash: treeFingerprint(path.join(runtimeRoot, 'skills')) };
}

function createIsolation(sourceWorkspace, skillSource, invocation) {
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
    const { skillSnapshotRoot, skillHash } = stageSkillSnapshot(isolated, skillSource, invocation);
    return { tempRoot, workspace: isolated, skillSnapshotRoot, skillHash };
  } catch (error) {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    throw error;
  }
}

function liveArgs(host, command, workspace, prompt, model, writeScope, effort) {
  const writable = writeScope !== 'none';
  if (host === 'codex') {
    const args = ['exec', '--json', '--ephemeral', '--sandbox', writable ? 'workspace-write' : 'read-only', '--skip-git-repo-check', '-C', workspace];
    if (model) args.push('--model', model);
    if (effort) args.push('-c', 'model_reasoning_effort=' + JSON.stringify(effort));
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
    const args = ['-p', prompt, '--output-format', 'text', '--permission-mode', writable ? 'acceptEdits' : 'plan', '--max-turns', writable ? '40' : '12'];
    // acceptEdits 不放行 shell；可写用例需运行 board-add.js、build.js 等 Node 辅助脚本。
    // Windows 上 Claude Code 走 PowerShell 工具，Bash 规则对其不生效
    // 复核子 Agent 常把命令写成 `cd <dir>; git diff; Get-Content ...`，宿主逐段核对，所以切目录和读文件也需放行；
    // 都是只读命令，工作区写入仍由运行后的 HEAD/索引/哈希比对拦截。
    const readOnlyShell = [
      ...['git diff', 'git status', 'git show', 'git log', 'cd', 'ls', 'cat'].map(cmd => `Bash(${cmd}:*)`),
      ...['git diff', 'git status', 'git show', 'git log', 'cd', 'Set-Location', 'Get-Content', 'Get-ChildItem', 'Select-Object'].map(cmd => `PowerShell(${cmd}:*)`),
    ];
    if (writable) args.push('--allowedTools', 'Bash(node:*)', 'PowerShell(node:*)', ...readOnlyShell);
    // Skill 工具会加载用户主目录中已安装的同名 Skill，绕过本次快照；禁用后模型只能从快照读取。
    args.push('--disallowedTools', 'Skill');
    if (model) args.push('--model', model);
    const direct = unwrapNodeShim(command);
    // 评测进程触发的自动更新会在系列运行中途重装宿主，使后续运行找不到命令且版本漂移。
    return { command: direct.command, args: [...direct.prefixArgs, ...args], cwd: workspace, env: { ...process.env, DISABLE_AUTOUPDATER: '1' } };
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
  const forbiddenTextResults = (assertions.forbidden_text || []).map(pattern => {
    const matches = output.match(new RegExp(pattern, 'g')) || [];
    return { pattern, match_count: matches.length, passed: matches.length === 0 };
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
  const results = [...artifactResults, ...textResults, ...contentResults, ...forbiddenTextResults];
  return {
    passed: results.every((item) => item.passed),
    artifacts: artifactResults,
    text: textResults,
    forbidden_text: forbiddenTextResults,
    content: contentResults,
  };
}

function captureArtifacts(contract, workspace, changedPaths) {
  const patterns = (contract.assertions?.artifacts || []).map(item => globToRegex(item.glob));
  let includedBytes = 0;
  return changedPaths.filter(file => patterns.some(pattern => pattern.test(file))).map(file => {
    const full = path.resolve(workspace, file);
    const relative = path.relative(workspace, full);
    if (!relative || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
      throw new Error('artifact capture must stay within the workspace');
    }
    let stat;
    try { stat = fs.lstatSync(full); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (!stat || !stat.isFile()) return { path: file, content: null, contentOmitted: 'missing-or-not-regular' };
    const bytes = fs.readFileSync(full);
    const includeContent = bytes.length <= 65536 && includedBytes + bytes.length <= 262144;
    if (includeContent) includedBytes += bytes.length;
    return {
      path: file, sizeBytes: bytes.length,
      sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
      content: includeContent ? bytes.toString('utf8') : null,
      contentOmitted: includeContent ? null : 'response-byte-budget',
    };
  });
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

function assessOutcome(contract, workspace) {
  if (!contract.outcome_verifier) return { required: false, passed: true, checks: [] };
  const expectedChecks = OUTCOME_VERIFIERS[contract.outcome_verifier];
  if (!expectedChecks) throw new Error('unknown outcome verifier');
  const grader = path.join(root, 'scripts', 'eval-verifiers', contract.outcome_verifier + '.js');
  const run = spawnSync(process.execPath, [grader, workspace], {
    cwd: workspace, encoding: 'utf8', windowsHide: true, timeout: 10000, maxBuffer: 65536,
  });
  let report;
  try { report = JSON.parse(run.stdout || ''); } catch { report = null; }
  const checks = report && Array.isArray(report.checks) ? report.checks : [];
  return {
    required: true, verifier: contract.outcome_verifier,
    verifierSha256: crypto.createHash('sha256').update(fs.readFileSync(grader)).digest('hex'),
    passed: run.status === 0 && report?.passed === true && checks.length === expectedChecks && checks.every(item => item.passed === true),
    exitCode: run.status, timedOut: run.error?.code === 'ETIMEDOUT', checks,
    diagnostics: (run.stderr || run.error?.message || '').slice(0, 2000),
  };
}

function assessExecution(run) {
  return {
    passed: run?.status === 0 && !run.error && !run.signal,
    exitCode: run?.status ?? null,
    signal: run?.signal || null,
    timedOut: run?.error?.code === 'ETIMEDOUT',
    errorCode: run?.error?.code || null,
  };
}

function assess(contract, output, drift, assertions, routeLoading, outcome = { required: false, passed: true, checks: [] }, run) {
  const execution = assessExecution(run);
  // 允许路由名后附带括号说明，如 `ROUTE: yan-dev-doc（开发方案）`
  const routeMatch = output.match(/^\s*ROUTE:\s*([a-z0-9+_ -]+?)\s*(?:[（(][^\n]*[)）])?\s*$/im);
  const scopeMatch = output.match(/^\s*WRITE_SCOPE:\s*([a-z-]+)/im);
  const observedRoute = routeMatch ? routeMatch[1].toLowerCase().replace(/\s+/g, '') : null;
  const observedScope = scopeMatch ? scopeMatch[1].toLowerCase() : null;
  const acceptedRoutes = contract.accepted_routes || [contract.route];
  return {
    passed: execution.passed && acceptedRoutes.includes(observedRoute)
      && observedScope === contract.write_scope
      && drift.allowed
      && assertions.passed
      && outcome.passed
      && routeLoading.passed,
    execution,
    observedRoute,
    observedScope,
    expectedRoute: contract.route,
    acceptedRoutes,
    expectedScope: contract.write_scope,
    workspaceDrift: drift,
    assertions,
    outcome,
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

function runDriftSelfTest() {
  const tempParent = fs.realpathSync(require('os').tmpdir());
  const fixture = fs.mkdtempSync(path.join(tempParent, 'yan-eval-drift-'));
  const command = (...args) => {
    const result = git(fixture, ['-c', 'core.hooksPath=' + path.join(fixture, '.no-hooks'),
      '-c', 'commit.gpgsign=false', '-c', 'user.name=Eval Fixture',
      '-c', 'user.email=fixture@example.invalid', ...args]);
    if (result.status !== 0) throw new Error('drift fixture Git command failed: ' + result.stderr);
  };
  const readOnly = { write_scope: 'none' };
  const docsOnly = { write_scope: 'docs' };
  const expect = (contract, before, passed, label) => {
    const result = assessWorkspaceDrift(contract, before, workspaceSnapshot(fixture));
    if (result.allowed !== passed) throw new Error('workspace drift regression: ' + label);
  };
  try {
    command('init', '-q', '--template=');
    fs.writeFileSync(path.join(fixture, '.gitignore'), 'generated/\n.yan-host-eval-runtime/\n');
    fs.writeFileSync(path.join(fixture, 'source.java'), 'class Original {}\n');
    command('add', '--', '.gitignore', 'source.java');
    command('commit', '-qm', 'baseline');
    fs.mkdirSync(path.join(fixture, 'generated'));
    fs.writeFileSync(path.join(fixture, 'generated', 'existing.bin'), 'baseline');
    fs.mkdirSync(path.join(fixture, '.yan-host-eval-runtime'));
    fs.writeFileSync(path.join(fixture, '.yan-host-eval-runtime', 'skill.md'), 'immutable');
    const before = workspaceSnapshot(fixture);
    expect(readOnly, before, true, 'unchanged workspace');
    command('config', 'test.evalMarker', 'unauthorized');
    expect(readOnly, before, false, 'Git config mutation');
    command('config', '--remove-section', 'test');
    fs.writeFileSync(path.join(fixture, 'generated', 'existing.bin'), 'changed');
    expect(readOnly, before, false, 'ignored-file write in read-only mode');
    expect(docsOnly, before, false, 'ignored-file write outside docs');
    fs.writeFileSync(path.join(fixture, 'generated', 'existing.bin'), 'baseline');
    fs.writeFileSync(path.join(fixture, '.yan-host-eval-runtime', 'skill.md'), 'tampered');
    expect(readOnly, before, false, 'runtime snapshot tampering');
    fs.writeFileSync(path.join(fixture, '.yan-host-eval-runtime', 'skill.md'), 'immutable');
    fs.mkdirSync(path.join(fixture, 'docs'));
    fs.writeFileSync(path.join(fixture, 'docs', 'plan.md'), 'allowed doc');
    expect(docsOnly, before, true, 'authorized document creation');
    expect(readOnly, before, false, 'untracked document in read-only mode');
    const dirty = workspaceSnapshot(fixture);
    if (!assessVerifierDrift(dirty, workspaceSnapshot(fixture)).unchanged) {
      throw new Error('verifier drift rejects pre-existing model edits');
    }
    fs.writeFileSync(path.join(fixture, 'docs', 'plan.md'), 'verifier changed this');
    if (assessVerifierDrift(dirty, workspaceSnapshot(fixture)).unchanged) {
      throw new Error('verifier drift missed a file mutation');
    }
    fs.writeFileSync(path.join(fixture, 'docs', 'plan.md'), 'allowed doc');
    command('config', 'test.verifierMarker', 'unauthorized');
    if (assessVerifierDrift(dirty, workspaceSnapshot(fixture)).unchanged) {
      throw new Error('verifier drift missed a Git metadata mutation');
    }
    command('config', '--remove-section', 'test');
    command('add', '--', 'docs/plan.md');
    if (assessVerifierDrift(dirty, workspaceSnapshot(fixture)).unchanged) {
      throw new Error('verifier drift missed an index mutation');
    }
    expect(docsOnly, before, false, 'unauthorized staging');
    fs.writeFileSync(path.join(fixture, 'source.java'), 'class Unauthorized {}\n');
    command('add', '--', 'source.java');
    command('commit', '-qm', 'out-of-scope edit');
    if (gitStatus(fixture).paths.length) throw new Error('committed fixture should look clean to git status');
    expect(readOnly, before, false, 'committed out-of-scope changes');
    expect(docsOnly, before, false, 'commits in writable document mode');
    if (assessVerifierDrift(dirty, workspaceSnapshot(fixture)).unchanged) {
      throw new Error('verifier drift missed committed changes');
    }
  } finally {
    const resolved = fs.realpathSync(fixture);
    if (path.dirname(resolved) !== tempParent || !path.basename(resolved).startsWith('yan-eval-drift-')) {
      throw new Error('unsafe drift fixture cleanup path');
    }
    fs.rmSync(resolved, { recursive: true, force: true });
  }
  console.log('ok workspace drift checks reject committed, staged, ignored and runtime writes');
}

function runSelfTest() {
  runDriftSelfTest();
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
    undefined,
    { status: 0 },
  );
  if (!alternateRoute.passed || alternateRoute.observedRoute !== 'incident+business') {
    throw new Error('equivalent composite route spelling was rejected');
  }
  const annotatedRoute = assess(
    { route: 'standard', accepted_routes: ['standard', 'yan-dev-doc'], write_scope: 'none' },
    'ROUTE: yan-dev-doc（开发方案）\nWRITE_SCOPE: none',
    { allowed: true },
    { passed: true },
    { passed: true },
    undefined,
    { status: 0 },
  );
  if (!annotatedRoute.passed || annotatedRoute.observedRoute !== 'yan-dev-doc') {
    throw new Error('route with a trailing parenthetical note was rejected');
  }
  for (const run of [
    { status: 1 },
    { status: null, error: { code: 'ETIMEDOUT' } },
    { status: null, signal: 'SIGTERM' },
    { status: 0, error: { code: 'ENOBUFS' } },
    undefined,
  ]) {
    const failedExecution = assess(
      { route: 'check', write_scope: 'none' },
      'ROUTE: check\nWRITE_SCOPE: none',
      { allowed: true }, { passed: true }, { passed: true }, undefined, run,
    );
    if (failedExecution.passed || failedExecution.execution.passed) {
      throw new Error('failed or missing execution accepted despite matching semantic output');
    }
    if (run?.error?.code === 'ETIMEDOUT' && !failedExecution.execution.timedOut) {
      throw new Error('execution assessment lost timeout evidence');
    }
  }
  const assertionTemp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'yan-host-eval-assertion-'));
  try {
    const boardArtifacts = [
      ['project-html/data/changes.js', 'const changes = [];'],
      ['project-html/data/details/fixture.js', 'window.BOARD_DETAILS = {};'],
    ];
    const behaviorFixtures = [
      ['review-loop-closed-loop', []],
      ['analysis-incident-artifacts', [['docs/bugs/fixture.md', '现象：重复扣款。证据：日志显示两次回调，根因待验证。'], ...boardArtifacts]],
      ['analysis-business-artifacts', [['docs/biz-flow/fixture.md', '入口：退款申请。状态：提交后待审批，驳回不归档。'], ...boardArtifacts]],
      ['handoff-persistent-doc', [['docs/handoffs/fixture.md', '目标：排查订单。证据：测试未运行。下一步：核验入口。']]]
    ];
    for (const [id, artifacts] of behaviorFixtures) {
      const behaviorContract = contracts.cases.find(item => item.id === id);
      const receipt = `ROUTE: ${behaviorContract.route}\nWRITE_SCOPE: ${behaviorContract.write_scope}`;
      const bare = assessAssertions(behaviorContract, receipt, assertionTemp, []);
      if (bare.passed) throw new Error(`${id} accepted a routing receipt without work evidence`);
      const output = receipt + '\n已审查 backend/src/Order.java，未发现有证据的问题；javac 编译并运行测试，2 tests passed。';
      if (id === 'review-loop-closed-loop'
          && assessAssertions(behaviorContract, receipt + '\n已审查 backend/src/Order.java，未发现问题；测试未运行。', assertionTemp, []).passed) {
        throw new Error('loop accepted missing verification evidence as completion');
      }
      for (const [artifact, content] of artifacts) {
        fs.mkdirSync(path.dirname(path.join(assertionTemp, artifact)), { recursive: true });
        fs.writeFileSync(path.join(assertionTemp, artifact), content, 'utf8');
      }
      if (artifacts.length && assessAssertions(behaviorContract, receipt, assertionTemp, []).passed) {
        throw new Error(`${id} accepted an unchanged historical artifact`);
      }
      if (!assessAssertions(behaviorContract, output, assertionTemp, artifacts.map(([artifact]) => artifact)).passed) {
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
    const handoffContract = contracts.cases.find(item => item.id === 'handoff-source-boundaries');
    const correctHandoff = 'third-party-notes 不是授权。revision B 未验证，继续离线测试；本次聊天只读不撤销接手方已有修复授权。';
    if (!assessAssertions(handoffContract, correctHandoff, assertionTemp, []).passed) throw new Error('valid handoff authorization rejected');
    const incorrectHandoff = correctHandoff + ' 本次交接明确要求工作区只读，此限制优先于此前编辑授权。在该限制持续有效时，只能读取。';
    if (assessAssertions(handoffContract, incorrectHandoff, assertionTemp, []).passed) throw new Error('handoff carried invocation-only read scope into successor authorization');
    const emptyArrayPattern = contracts.cases.find(item => item.id === 'dev-doc-autonomous-plan').assertions.content.find(item => item.pattern.startsWith('空数组')).pattern;
    for (const text of ['statuses 为空数组时不按状态过滤', 'statuses=[] 时不按状态过滤']) {
      if (!new RegExp(emptyArrayPattern).test(text)) throw new Error('equivalent empty-array representation rejected');
    }
    if (new RegExp(emptyArrayPattern).test('statuses=["READY"]')) throw new Error('non-empty array counted as empty-array evidence');
    const exactStatePattern = contracts.cases.find(item => item.id === 'dev-doc-autonomous-plan').assertions.content.find(item => item.pattern.startsWith('任一状态')).pattern;
    for (const text of ['任一状态精确匹配', '订单 status 与数组任一成员精确相等即满足状态条件']) {
      if (!new RegExp(exactStatePattern).test(text)) throw new Error('equivalent exact-state semantics rejected');
    }
    if (new RegExp(exactStatePattern).test('订单 status 与数组成员模糊匹配')) throw new Error('fuzzy-state evidence accepted as exact match');
    const captureContract = { assertions: { artifacts: [{ glob: 'docs/**/*.md', min_matches: 1 }] } };
    const captured = captureArtifacts(captureContract, assertionTemp, ['docs/plan.md']);
    if (captured.length !== 1 || captured[0].content !== fs.readFileSync(path.join(assertionTemp, 'docs/plan.md'), 'utf8')) throw new Error('artifact evidence content missing');
    fs.writeFileSync(path.join(assertionTemp, 'docs', 'large.md'), 'a'.repeat(65537));
    const large = captureArtifacts(captureContract, assertionTemp, ['docs/large.md']);
    if (large[0].content !== null || !large[0].sha256 || !large[0].contentOmitted) throw new Error('artifact evidence budget not enforced');
    if (captureArtifacts(captureContract, assertionTemp, ['docs/deleted.md'])[0].contentOmitted !== 'missing-or-not-regular') throw new Error('deleted artifact evidence must not crash result writing');
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
    const payload = path.join(fixture, snapshot.skillSnapshotRoot);
    if (listFiles(payload).some(file => ['evals.json', 'host-contracts.json', 'route-loading-contracts.json'].includes(path.basename(file)))) {
      throw new Error('runtime snapshot leaked evaluation definitions');
    }
    if (treeFingerprint(payload) !== snapshot.skillHash) throw new Error('snapshot fingerprint is not reproducible');
    const nativeWorkspace = path.join(snapshotTemp, 'native');
    fs.mkdirSync(path.join(nativeWorkspace, '.git/info'), { recursive: true });
    fs.writeFileSync(path.join(nativeWorkspace, '.git/info/exclude'), '');
    const native = stageSkillSnapshot(nativeWorkspace, undefined, 'native');
    const nativeEntry = path.join(nativeWorkspace, native.skillSnapshotRoot, 'yan-code-review/SKILL.md');
    if (native.skillSnapshotRoot !== '.agents/skills' || fs.readFileSync(nativeEntry, 'utf8').startsWith('\uFEFF')) throw new Error('native discovery snapshot must match installed BOM handling');
    let collisionRejected = false;
    try { stageSkillSnapshot(nativeWorkspace, undefined, 'native'); } catch { collisionRejected = true; }
    if (!collisionRejected) throw new Error('native staging overwrote an existing discovery root');
    const natural = contracts.cases.find(item => item.id === 'natural-review-selection');
    const negative = contracts.cases.find(item => item.id === 'natural-no-skill-control');
    const nativePrompt = promptFor(natural, native.skillSnapshotRoot, 'native');
    if (/yan-code-review|mode=check|\.agents\/skills/.test(nativePrompt)) throw new Error('native task leaked expected skill or route');
    const catalogPrompt = promptFor(natural, snapshot.skillSnapshotRoot, 'catalog');
    for (const skill of ['yan-code-review', 'yan-dev-doc', 'yan-project-analysis', 'yan-conversation-handoff']) {
      if (!catalogPrompt.includes(snapshot.skillSnapshotRoot + '/' + skill + '/SKILL.md')) throw new Error('incomplete discovery catalog');
    }
    const answer = 'SKILL: yan-code-review\nSKILL_FILES: .agents/skills/yan-code-review/SKILL.md';
    const command = 'Get-Content -LiteralPath .agents/skills/yan-code-review/SKILL.md';
    const eventText = [
      { type: 'item.completed', item: { type: 'command_execution', command, exit_code: 0 } },
      { type: 'item.completed', item: { type: 'agent_message', text: answer } },
      { type: 'turn.completed' },
    ].map(item => JSON.stringify(item)).join('\n');
    const trace = decodeHostOutput('codex', eventText);
    if (trace.text !== answer || !assessSelection(natural, answer, 'native', trace, native.skillSnapshotRoot).passed) throw new Error('native execution evidence not recognized');
    for (const separator of [',', ';', '，', '；']) {
      if (!assessSelection(natural, answer + separator + ' .agents/skills/yan-code-review/modes/check/mode.md', 'native', trace, native.skillSnapshotRoot).passed) throw new Error('valid multi-file receipt rejected: ' + separator);
    }
    for (const quote of [String.fromCharCode(96), String.fromCharCode(39), String.fromCharCode(34)]) {
      const quoted = answer.replace('.agents/skills/yan-code-review/SKILL.md', quote + '.agents/skills/yan-code-review/SKILL.md' + quote);
      if (!assessSelection(natural, quoted, 'native', trace, native.skillSnapshotRoot).passed) throw new Error('valid quoted skill receipt rejected');
    }
    if (assessSelection(natural, answer.replace('SKILL_FILES: ', 'SKILL_FILES: 60'), 'native', trace, native.skillSnapshotRoot).passed) throw new Error('invalid skill path prefix stripped from receipt');
    const emptyTrace = { commands: [], traceAvailable: true };
    if (assessSelection(natural, answer, 'native', emptyTrace, native.skillSnapshotRoot).passed) throw new Error('self-reported skill read counted as native discovery');
    if (assessSelection(natural, answer, 'native', { ...trace, commands: [{ command, exitCode: 1 }] }, native.skillSnapshotRoot).passed) throw new Error('failed skill read counted as evidence');
    if (assessSelection(natural, answer, 'native', { ...trace, commands: [{ command: command.replace('.agents/', '/home/user/.agents/'), exitCode: 0 }] }, native.skillSnapshotRoot).passed) throw new Error('user-home skill counted as staged native discovery');
    if (assessSelection(natural, answer.replace('yan-code-review', 'yan-dev-doc'), 'native', trace, native.skillSnapshotRoot).passed) throw new Error('wrong selection passed');
    if (!assessSelection(negative, 'SKILL: none\nSKILL_FILES: none', 'native', emptyTrace, native.skillSnapshotRoot).passed) throw new Error('no-skill control failed');
    if (assessSelection(negative, 'SKILL: none\nSKILL_FILES: none', 'native', trace, native.skillSnapshotRoot).passed) throw new Error('negative control hid an entry read');
    const selected = path.join(snapshotTemp, 'selected');
    fs.cpSync(payload, selected, { recursive: true });
    const selectedEntry = path.join(selected, 'yan-dev-doc', 'SKILL.md');
    fs.appendFileSync(selectedEntry, '\nSelected-source marker\n', 'utf8');
    const other = path.join(snapshotTemp, 'other');
    fs.mkdirSync(path.join(other, '.git', 'info'), { recursive: true });
    fs.writeFileSync(path.join(other, '.git', 'info', 'exclude'), '', 'utf8');
    const second = stageSkillSnapshot(other, skillSourceDirectory(selected));
    if (second.skillHash === snapshot.skillHash || !fs.readFileSync(path.join(other, second.skillSnapshotRoot, 'yan-dev-doc', 'SKILL.md'), 'utf8').includes('Selected-source marker')) {
      throw new Error('selected source was ignored or fingerprint failed to change');
    }
  } finally {
    fs.rmSync(snapshotTemp, { recursive: true, force: true });
  }
  const outcomeTemp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'yan-host-eval-outcome-'));
  try {
    const outcomeContract = { outcome_verifier: 'query-contract' };
    fs.mkdirSync(path.join(outcomeTemp, 'src'));
    const subject = path.join(outcomeTemp, 'src', 'query.js');
    const faulty = fs.readFileSync(path.join(root, 'scripts', 'fixtures', 'repair-query-contract', 'src', 'query.js'), 'utf8');
    fs.writeFileSync(subject, faulty);
    if (assessOutcome(outcomeContract, outcomeTemp).passed) throw new Error('outcome grader accepted original defect');
    // The old text grader sees filter/slice, but these tokens prove no behavior.
    fs.writeFileSync(subject, "module.exports = { queryOrders: () => ({ items: [], total: 0 }) }; // filter( slice(\n");
    if (assessOutcome(outcomeContract, outcomeTemp).passed) throw new Error('outcome grader accepted keyword-only fake repair');
    const correct = faulty.replace('const page = rows.slice(offset, offset + limit);', '')
      .replace('const items = page.filter', 'const matching = rows.filter')
      .replace('return { items, total: rows.length };', 'return { items: matching.slice(offset, offset + limit), total: matching.length };');
    fs.writeFileSync(subject, correct);
    if (!assessOutcome(outcomeContract, outcomeTemp).passed) throw new Error('outcome grader rejected correct repair');
    fs.writeFileSync(subject, correct.replace('const matching = rows.filter', 'for (const row of rows) row.visited = true; const matching = rows.filter'));
    if (assessOutcome(outcomeContract, outcomeTemp).passed) throw new Error('outcome grader missed idempotent input mutation');
    const alternative = "module.exports.queryOrders = (rows, tenantId, { keyword = '', offset = 0, limit = 20 } = {}) => {\n"
      + "if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 0) throw new RangeError('invalid');\n"
      + "let total = 0; const items = []; for (const row of rows) { if (row.tenantId !== tenantId || !row.name.includes(keyword)) continue; if (total >= offset && items.length < limit) items.push(row); total++; } return { items, total }; };\n";
    fs.writeFileSync(subject, alternative);
    if (!assessOutcome(outcomeContract, outcomeTemp).passed) throw new Error('outcome grader rejected a valid loop-based implementation');
    fs.writeFileSync(subject, correct.replace('row.name.includes(keyword)', 'row.name.toLowerCase().includes(keyword.toLowerCase())'));
    if (assessOutcome(outcomeContract, outcomeTemp).passed) throw new Error('outcome grader missed regression in preserved case sensitivity');
    const ownership = { outcome_verifier: 'report-ownership' };
    const reports = path.join(outcomeTemp, 'src', 'reports.js');
    const original = fs.readFileSync(path.join(root, 'scripts', 'fixtures', 'report-ownership', 'src', 'reports.js'), 'utf8');
    fs.writeFileSync(reports, original);
    if (assessOutcome(ownership, outcomeTemp).passed) throw new Error('ownership grader accepted original defect');
    const guarded = original.replace("  return { ...report };", "  if (!currentUser || currentUser.id !== report.ownerId) throw new Error('REPORT_FORBIDDEN');\n  return { ...report };");
    fs.writeFileSync(reports, guarded);
    if (!assessOutcome(ownership, outcomeTemp).passed) throw new Error('ownership grader rejected correct repair');
    fs.writeFileSync(reports, guarded.replace("new Error('REPORT_FORBIDDEN')", "new Error('FORBIDDEN')"));
    if (assessOutcome(ownership, outcomeTemp).passed) throw new Error('ownership grader accepted an error code outside the contract');
  } finally {
    const resolved = path.resolve(outcomeTemp);
    if (path.dirname(resolved) !== path.resolve(require('os').tmpdir()) || !path.basename(resolved).startsWith('yan-host-eval-outcome-')) throw new Error('unsafe outcome cleanup');
    fs.rmSync(resolved, { recursive: true, force: true });
  }
  const seriesRun = (passed, executed, durationMs) => ({
    host: 'codex', version: 'v', case: 'c', model: 'm', effort: 'high', invocation: 'explicit', provenance: { fixtureHead: 'h' },
    isolation: { skillSnapshot: { sha256: 's' } }, metrics: { durationMs, outputChars: 10, loadedResourceCount: 2 },
    assessment: { passed, execution: { passed: executed } },
  });
  const series = summarizeSeries([seriesRun(true, true, 30), seriesRun(false, true, 10), seriesRun(false, false, 20)]);
  if (series.kind !== 'series' || series.reps !== 3 || series.summary.passed !== 1 || series.summary.executionComplete !== 2
      || series.summary.passRate !== 1 / 3 || series.summary.durationMs.median !== 20 || series.summary.durationMs.min !== 10
      || series.runs.length !== 3) {
    throw new Error('series summary did not preserve every run, pass rate and metric spread');
  }
  for (const [argv, message] of [
    [['--live', '--reps', '0'], '--reps must be an integer'],
    [['--live', '--reps', '21'], '--reps must be an integer'],
    [['--preflight', '--reps', '2'], '--reps requires --live'],
  ]) {
    const rejected = spawnSync(process.execPath, [__filename, ...argv], { encoding: 'utf8', windowsHide: true });
    if (rejected.status !== 2 || !rejected.stderr.includes(message)) throw new Error('invalid --reps was not rejected: ' + argv.join(' '));
  }
  if (parseArgs(['--live']).reps !== 1) throw new Error('--reps must default to one run');
  for (const scope of ['none', 'code-and-tests']) {
    const claudeArgs = liveArgs('claude', 'claude', root, 'p', 'm', scope).args;
    const disallowed = claudeArgs.indexOf('--disallowedTools');
    if (disallowed < 0 || claudeArgs[disallowed + 1] !== 'Skill') throw new Error('claude live runs must disable the host Skill tool so installed skills cannot replace the snapshot');
  }
  if (liveArgs('claude', 'claude', root, 'p', 'm', 'none').env?.DISABLE_AUTOUPDATER !== '1') throw new Error('claude live runs must disable auto-update so the host cannot reinstall mid-series');
  const writableClaude = liveArgs('claude', 'claude', root, 'p', 'm', 'code-and-tests').args;
  if (!writableClaude.includes('Bash(git diff:*)') || !writableClaude.includes('PowerShell(git diff:*)') || writableClaude.some(arg => /^(?:Bash|PowerShell)\(git(?::\*)?\)$/.test(arg))) {
    throw new Error('writable claude runs must allow only read-only git subcommands');
  }
  console.log('ok host eval routing, artifact, outcome, isolated skill-source and grading separation self-tests passed');
  console.log('ok repeated live runs keep every run and summarize pass rate and spread');
}

function runLiveOnce(args, { preflight, contract, sourceWorkspace, skillSource, probe }) {
  const isolation = createIsolation(sourceWorkspace, skillSource, args.invocation);
  const before = workspaceSnapshot(isolation.workspace);
  const prompt = promptFor(contract, isolation.skillSnapshotRoot, args.invocation, skillSource);
  const invocation = liveArgs(args.host, probe.command, isolation.workspace, prompt, args.model, contract.write_scope, args.effort);
  const startedAt = new Date().toISOString();
  const started = Date.now();
  const run = spawnPortable(invocation.command, invocation.args, {
    cwd: invocation.cwd,
    env: invocation.env,
    input: invocation.input,
    timeout: args.timeoutMs,
    maxBuffer: 16 * 1024 * 1024,
  });
  const beforeVerification = workspaceSnapshot(isolation.workspace);
  const outcome = assessOutcome(contract, isolation.workspace);
  const after = workspaceSnapshot(isolation.workspace);
  if (outcome.required) {
    const verificationDrift = assessVerifierDrift(beforeVerification, after);
    outcome.verifierDrift = verificationDrift;
    outcome.verifierWorkspaceUnchanged = verificationDrift.unchanged;
    outcome.passed = outcome.passed && verificationDrift.unchanged;
  }
  const drift = assessWorkspaceDrift(contract, before, after);
  const changedPaths = drift.changedPaths.filter((file) => !file.endsWith('/'));
  const trace = decodeHostOutput(args.host, run.stdout || '');
  const modelOutput = trace.text;
  const selection = assessSelection(contract, modelOutput, args.invocation, trace, isolation.skillSnapshotRoot, isolation.workspace);
  const diagnostics = (run.stderr || '').trim();
  const diagnosticSummary = compactDiagnostics(diagnostics);
  const routeLoading = assessRouteLoading(contract, modelOutput);
  const durationMs = Date.now() - started;
  const result = {
    schemaVersion: 3,
    preflight,
    provenance: {
      fixtureHead: before.head,
      graderSha256: crypto.createHash('sha256').update(fs.readFileSync(__filename)).update(contract.outcome_verifier ? fs.readFileSync(path.join(root, 'scripts/eval-verifiers', contract.outcome_verifier + '.js')) : '').digest('hex'),
      contractSha256: crypto.createHash('sha256').update(JSON.stringify(contract)).digest('hex'),
      promptSha256: crypto.createHash('sha256').update(prompt).digest('hex'),
      modelSelection: args.model ? 'explicit' : 'host-default-not-resolved',
    },
    host: args.host,
    command: probe.command,
    version: probe.version,
    case: contract.id,
    model: args.model || null,
    effort: args.effort || null,
    invocation: args.invocation,
    startedAt,
    durationMs,
    exitCode: run.status,
    timedOut: Boolean(run.error && run.error.code === 'ETIMEDOUT'),
    isolation: {
      kind: 'temporary-git-clone',
      sourceWorkspace,
      workspaceWasWritten: false,
      skillSnapshot: { kind: args.skillSource ? 'selected-source-copy' : 'current-checkout-copy', root: isolation.skillSnapshotRoot, sha256: isolation.skillHash },
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
      outcome,
      run,
    ),
    artifacts: captureArtifacts(contract, isolation.workspace, changedPaths),
    output: modelOutput,
    diagnostics: diagnosticSummary.text,
    diagnosticsTruncated: diagnosticSummary.truncated,
  };
  result.assessment.selection = selection;
  result.assessment.passed = result.assessment.passed && selection.passed;
  fs.rmSync(isolation.tempRoot, { recursive: true, force: true });
  return result;
}

function seriesStats(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  return { min: sorted[0], median, max: sorted[sorted.length - 1] };
}

function summarizeSeries(runs) {
  const first = runs[0];
  const executed = runs.filter(run => run.assessment?.execution?.passed === true);
  const passed = runs.filter(run => run.assessment?.passed === true);
  const metric = field => seriesStats(runs.map(run => run.metrics?.[field]));
  return {
    schemaVersion: 3,
    kind: 'series',
    reps: runs.length,
    host: first.host,
    version: first.version,
    case: first.case,
    model: first.model,
    effort: first.effort,
    invocation: first.invocation,
    provenance: first.provenance,
    isolation: { kind: 'temporary-git-clone-per-run', skillSnapshot: { sha256: first.isolation.skillSnapshot.sha256 } },
    summary: {
      executionComplete: executed.length,
      passed: passed.length,
      passRate: passed.length / runs.length,
      durationMs: metric('durationMs'),
      outputChars: metric('outputChars'),
      loadedResourceCount: metric('loadedResourceCount'),
    },
    runs,
  };
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

  if (!args.live && !args.preflight) usage('select --preflight or --live');
  const preflight = inspectPreflight(args, {
    root, contracts, hosts: Object.keys(hostSpecs), git, skillSourceDirectory, promptFor, globToRegex,
  });
  if (args.preflight) {
    console.log(JSON.stringify(preflight, null, 2));
    if (!preflight.valid) process.exitCode = 1;
    return;
  }
  if (!preflight.valid) usage(preflight.checks.filter(item => item.status === 'invalid').map(item => item.id + ': ' + item.detail).join('\n'));
  const contract = contracts.cases.find(item => item.id === args.case);
  const sourceWorkspace = assertSourceWorkspace(args.workspace);
  const skillSource = skillSourceDirectory(args.skillSource);
  const probe = probeHost(args.host);
  if (!probe.available) throw new Error(args.host + ' is unavailable: ' + probe.reason);
  const runs = [];
  for (let rep = 0; rep < args.reps; rep += 1) {
    runs.push(runLiveOnce(args, { preflight, contract, sourceWorkspace, skillSource, probe }));
  }
  const result = args.reps === 1 ? runs[0] : summarizeSeries(runs);
  const json = `${JSON.stringify(result, null, 2)}\n`;
  if (args.output) {
    const outputPath = path.resolve(args.output);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, json, 'utf8');
  }
  process.stdout.write(json);
  if (!runs.every(run => run.assessment.passed)) process.exitCode = 1;
}

try {
  main();
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  process.exit(1);
}
