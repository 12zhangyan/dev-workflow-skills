#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');

const root = path.resolve(__dirname, '..');
let failed = false;
const legacyNames = new Set([
  'dev-doc', 'project-analysis', 'code-review', 'conversation-handoff',
  'bug-fix', 'biz-flow', 'code-reading',
  'review-fix', 'review-check', 'review-repair', 'review-loop',
]);

function fail(message) {
  failed = true;
  console.error('FAIL: ' + message);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function requireText(rel, needles) {
  const text = read(rel);
  for (const needle of needles) {
    if (!text.includes(needle)) fail(`${rel} missing required text: ${needle}`);
  }
}

function runChecked(command, args, options, label) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    timeout: 120000,
    windowsHide: true,
    ...options,
  });
  if (result.error) {
    fail(`${label} could not start: ${result.error.message}`);
    return false;
  }
  if (result.status !== 0) {
    fail(`${label} exited with ${result.status}`);
    if (result.stdout) process.stderr.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    return false;
  }
  return true;
}

function listTree(dir, base = dir) {
  const entries = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(base, full).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      entries.push(`D:${rel}`);
      entries.push(...listTree(full, base));
    } else if (entry.isFile()) {
      entries.push(`F:${rel}`);
    } else {
      entries.push(`O:${rel}`);
    }
  }
  return entries.sort();
}

function sourceDirectories() {
  return fs.readdirSync(path.join(root, 'skills'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !legacyNames.has(entry.name))
    .map((entry) => entry.name)
    .sort();
}

function withoutUtf8Bom(bytes) {
  return bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf
    ? bytes.subarray(3)
    : bytes;
}

const targets = [
  { name: 'claude', dotDir: '.claude', stripSkillBom: false },
  { name: 'cursor', dotDir: '.cursor', stripSkillBom: false },
  { name: 'codex', dotDir: '.codex', stripSkillBom: true },
];

function seedDestination(home) {
  for (const target of targets) {
    const skillsRoot = path.join(home, target.dotDir, 'skills');
    fs.mkdirSync(path.join(skillsRoot, 'user-owned-skill'), { recursive: true });
    fs.writeFileSync(path.join(skillsRoot, 'user-owned-skill', 'marker.txt'), 'preserve me\n', 'utf8');
    fs.mkdirSync(path.join(skillsRoot, 'yan-dev-doc'), { recursive: true });
    fs.writeFileSync(path.join(skillsRoot, 'yan-dev-doc', 'stale-from-old-install.txt'), 'remove me\n', 'utf8');
    for (const legacy of legacyNames) {
      fs.mkdirSync(path.join(skillsRoot, legacy), { recursive: true });
      fs.writeFileSync(path.join(skillsRoot, legacy, 'legacy-marker.txt'), 'remove me\n', 'utf8');
    }
  }
}

function assertInstallation(home, target) {
  const sourceRoot = path.join(root, 'skills');
  const installedRoot = path.join(home, target.dotDir, 'skills');
  const unrelatedMarker = path.join(installedRoot, 'user-owned-skill', 'marker.txt');
  if (!fs.existsSync(unrelatedMarker)) {
    fail(`${target.name} installer smoke removed an unrelated user skill`);
  }
  if (fs.existsSync(path.join(installedRoot, 'yan-dev-doc', 'stale-from-old-install.txt'))) {
    fail(`${target.name} installer smoke did not replace a stale same-named skill directory`);
  }
  for (const legacy of legacyNames) {
    if (fs.existsSync(path.join(installedRoot, legacy))) {
      fail(`${target.name} installer smoke did not remove merged legacy skill directory: ${legacy}`);
    }
  }

  for (const name of sourceDirectories()) {
    const source = path.join(sourceRoot, name);
    const installed = path.join(installedRoot, name);
    if (!fs.existsSync(installed)) {
      fail(`${target.name} installer smoke missing copied directory: ${name}`);
      continue;
    }
    const sourceTree = listTree(source);
    const installedTree = listTree(installed);
    if (JSON.stringify(sourceTree) !== JSON.stringify(installedTree)) {
      fail(`${target.name} installer smoke tree mismatch for ${name}`);
      continue;
    }
    for (const item of sourceTree.filter((entry) => entry.startsWith('F:'))) {
      const rel = item.slice(2);
      const sourceFile = path.join(source, ...rel.split('/'));
      const installedFile = path.join(installed, ...rel.split('/'));
      const sourceBytes = fs.readFileSync(sourceFile);
      const expected = target.stripSkillBom && path.basename(sourceFile) === 'SKILL.md'
        ? withoutUtf8Bom(sourceBytes)
        : sourceBytes;
      const actual = fs.readFileSync(installedFile);
      if (!actual.equals(expected)) {
        fail(`${target.name} installer smoke byte mismatch: skills/${name}/${rel}`);
      }
    }
  }
}

function assertAllInstallations(home) {
  for (const target of targets) assertInstallation(home, target);
}

function smokeWindowsLocalInstaller(tempRoot) {
  const cmdHome = path.join(tempRoot, 'cmd-home');
  fs.mkdirSync(cmdHome, { recursive: true });
  seedDestination(cmdHome);
  const cmdOk = runChecked(
    process.env.ComSpec || 'cmd.exe',
    ['/d', '/q', '/c', 'call install-local.cmd claude cursor codex'],
    { cwd: root, env: { ...process.env, USERPROFILE: cmdHome, HOME: cmdHome } },
    'install-local.cmd three-host smoke',
  );
  if (cmdOk) assertAllInstallations(cmdHome);

  const psHome = path.join(tempRoot, 'powershell-home');
  fs.mkdirSync(psHome, { recursive: true });
  seedDestination(psHome);
  const psOk = runChecked(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'install.ps1'],
    {
      cwd: root,
      env: {
        ...process.env,
        USERPROFILE: psHome,
        HOME: psHome,
        DEV_WORKFLOW_SKILLS_SOURCE: root,
      },
    },
    'install.ps1 three-host smoke',
  );
  if (psOk) assertAllInstallations(psHome);
}

function smokePosixInstaller(tempRoot) {
  const home = path.join(tempRoot, 'home');
  const fixtureParent = path.join(tempRoot, 'fixture');
  const fixtureRoot = path.join(fixtureParent, 'dev-workflow-skills-main');
  const archive = path.join(tempRoot, 'dev-workflow-skills-main.tar.gz');
  fs.mkdirSync(home, { recursive: true });
  fs.mkdirSync(fixtureRoot, { recursive: true });
  fs.cpSync(path.join(root, 'skills'), path.join(fixtureRoot, 'skills'), { recursive: true });
  seedDestination(home);
  const packed = runChecked(
    'tar',
    ['-czf', archive, '-C', fixtureParent, path.basename(fixtureRoot)],
    { cwd: root },
    'installer fixture archive creation',
  );
  if (!packed) return;
  const ok = runChecked(
    'bash',
    ['install.sh', 'claude', 'cursor', 'codex'],
    {
      cwd: root,
      env: {
        ...process.env,
        HOME: home,
        DEV_WORKFLOW_SKILLS_TARBALL: pathToFileURL(archive).href,
      },
    },
    'install.sh three-host smoke',
  );
  if (ok) assertAllInstallations(home);
}

requireText('install.sh', [
  'claude cursor codex',
  'DEV_WORKFLOW_SKILLS_TARBALL',
  'normalize_codex_skill',
  'if [ "$target" = "codex" ]',
  'SKILL.md',
  '\\xef\\xbb\\xbf',
  'npx superpowers-zh'
]);

requireText('install.ps1', [
  '@("claude", "cursor", "codex")',
  'DEV_WORKFLOW_SKILLS_SOURCE',
  'Remove-SkillMarkdownBom',
  '"codex"',
  'SKILL.md',
  '0xEF',
  'npx superpowers-zh'
]);

requireText('install-local.cmd', [
  'DO_CODEX',
  ':codex_normalize',
  'Codex CLI',
  'SKILL.md',
  '0xEF',
  'npx superpowers-zh'
]);

const cmdBytes = fs.readFileSync(path.join(root, 'install-local.cmd'));
cmdBytes.forEach((byte, idx) => {
  if (byte > 0x7f) fail(`install-local.cmd must stay pure ASCII; non-ASCII byte at offset ${idx}`);
});

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-workflow-skills-installer-'));
try {
  if (process.platform === 'win32') smokeWindowsLocalInstaller(tempRoot);
  else smokePosixInstaller(tempRoot);
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

if (failed) process.exit(1);
console.log(`ok installer checks and ${process.platform === 'win32' ? 'Windows local' : 'POSIX archive'} three-host smoke passed`);
