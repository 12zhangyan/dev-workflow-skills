#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');

const root = path.resolve(__dirname, '..');
const legacyNames = [
  'dev-doc', 'project-analysis', 'code-review', 'conversation-handoff',
  'bug-fix', 'biz-flow', 'code-reading',
  'review-fix', 'review-check', 'review-repair', 'review-loop',
];
const targets = [
  { name: 'claude', dotDir: '.claude', stripSkillBom: false },
  { name: 'cursor', dotDir: '.cursor', stripSkillBom: false },
  { name: 'codex', dotDir: '.codex', stripSkillBom: true },
];
let failed = false;

function fail(message) {
  failed = true;
  console.error(`FAIL: ${message}`);
}

function run(command, args, options, label, expectedStatus = 0) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    timeout: 120000,
    windowsHide: true,
    ...options,
  });
  if (result.error) {
    fail(`${label} could not start: ${result.error.message}`);
    return result;
  }
  if (result.status !== expectedStatus) {
    fail(`${label} exited with ${result.status}; expected ${expectedStatus}`);
    if (result.stdout) process.stderr.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
  }
  return result;
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

function sourceDirectories() {
  return fs.readdirSync(path.join(root, 'skills'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !legacyNames.includes(entry.name))
    .map((entry) => entry.name)
    .sort();
}

function listTree(dir, base = dir) {
  const entries = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(base, full).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      entries.push(`D:${rel}`);
      entries.push(...listTree(full, base));
    } else if (entry.isFile()) entries.push(`F:${rel}`);
  }
  return entries.sort();
}

function withoutUtf8Bom(bytes) {
  return bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf
    ? bytes.subarray(3)
    : bytes;
}

function hashTree(dir) {
  const hash = crypto.createHash('sha256');
  for (const item of listTree(dir).filter((entry) => entry.startsWith('F:'))) {
    const rel = item.slice(2);
    hash.update(rel);
    hash.update('\0');
    hash.update(fs.readFileSync(path.join(dir, ...rel.split('/'))));
    hash.update('\0');
  }
  return hash.digest('hex');
}

function seedRemovedManagedSkill(home) {
  for (const target of targets) {
    const skillsRoot = path.join(home, target.dotDir, 'skills');
    const removed = path.join(skillsRoot, 'yan-removed-skill');
    fs.mkdirSync(removed, { recursive: true });
    fs.writeFileSync(path.join(removed, 'removed-marker.txt'), 'recover me\n');
    const manifestPath = path.join(skillsRoot, '.yan-dev-workflow-skills.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    manifest.managedSkills.push('yan-removed-skill');
    manifest.installedHashes['yan-removed-skill'] = hashTree(removed);
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }
}

function seedHome(home) {
  for (const target of targets) {
    const skillsRoot = path.join(home, target.dotDir, 'skills');
    fs.mkdirSync(path.join(skillsRoot, 'user-owned-skill'), { recursive: true });
    fs.writeFileSync(path.join(skillsRoot, 'user-owned-skill', 'marker.txt'), 'preserve me\n');
    fs.mkdirSync(path.join(skillsRoot, 'yan-dev-doc'), { recursive: true });
    fs.writeFileSync(path.join(skillsRoot, 'yan-dev-doc', 'stale-from-old-install.txt'), 'back me up\n');
    fs.mkdirSync(path.join(skillsRoot, '.yan-backups', 'legacy-install'), { recursive: true });
    fs.writeFileSync(path.join(skillsRoot, '.yan-backups', 'legacy-install', 'old-backup-marker.txt'), 'keep me\n');
    for (const legacy of legacyNames) {
      fs.mkdirSync(path.join(skillsRoot, legacy), { recursive: true });
      fs.writeFileSync(path.join(skillsRoot, legacy, 'legacy-marker.txt'), 'unknown owner\n');
    }
  }
}

function findFile(rootDir, fileName) {
  if (!fs.existsSync(rootDir)) return [];
  const found = [];
  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    const full = path.join(rootDir, entry.name);
    if (entry.isDirectory()) found.push(...findFile(full, fileName));
    else if (entry.name === fileName) found.push(full);
  }
  return found;
}

function backupRoot(home, target) {
  return path.join(home, '.yan-dev-workflow-skills-backups', target.name);
}

function assertInstall(home, { legacyMigrated = false } = {}) {
  for (const target of targets) {
    const skillsRoot = path.join(home, target.dotDir, 'skills');
    if (!fs.existsSync(path.join(skillsRoot, 'user-owned-skill', 'marker.txt'))) {
      fail(`${target.name} removed an unrelated user skill`);
    }
    const manifestPath = path.join(skillsRoot, '.yan-dev-workflow-skills.json');
    if (!fs.existsSync(manifestPath)) {
      fail(`${target.name} missing install manifest`);
      continue;
    }
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (manifest.distribution !== 'dev-workflow-skills' || manifest.target !== target.name) {
      fail(`${target.name} manifest identity mismatch`);
    }
    if (!manifest.sourceVersion || !manifest.sourceTreeHash || !manifest.installedAt) {
      fail(`${target.name} manifest missing version/hash/time`);
    }

    for (const legacy of legacyNames) {
      const exists = fs.existsSync(path.join(skillsRoot, legacy));
      if (legacyMigrated && exists) fail(`${target.name} explicit migration kept legacy: ${legacy}`);
      if (!legacyMigrated && !exists) fail(`${target.name} default install deleted unowned legacy: ${legacy}`);
    }
    if (legacyMigrated && findFile(backupRoot(home, target), 'legacy-marker.txt').length < legacyNames.length) {
      fail(`${target.name} did not back up every explicitly migrated legacy directory`);
    }
    if (findFile(backupRoot(home, target), 'stale-from-old-install.txt').length < 1) {
      fail(`${target.name} did not back up a pre-manifest same-name skill`);
    }
    if (!fs.existsSync(path.join(skillsRoot, '.yan-backups', 'legacy-install', 'old-backup-marker.txt'))) {
      fail(`${target.name} removed a pre-existing legacy in-root backup`);
    }
    if (findFile(path.join(skillsRoot, '.yan-backups'), 'stale-from-old-install.txt').length) {
      fail(`${target.name} wrote a new backup inside the active skills root`);
    }

    for (const name of sourceDirectories()) {
      const source = path.join(root, 'skills', name);
      const installed = path.join(skillsRoot, name);
      if (!fs.existsSync(installed)) {
        fail(`${target.name} missing copied directory: ${name}`);
        continue;
      }
      if (JSON.stringify(listTree(source)) !== JSON.stringify(listTree(installed))) {
        fail(`${target.name} tree mismatch for ${name}`);
        continue;
      }
      for (const item of listTree(source).filter((entry) => entry.startsWith('F:'))) {
        const rel = item.slice(2);
        const sourceBytes = fs.readFileSync(path.join(source, ...rel.split('/')));
        const expected = target.stripSkillBom && path.basename(rel) === 'SKILL.md'
          ? withoutUtf8Bom(sourceBytes)
          : sourceBytes;
        const actual = fs.readFileSync(path.join(installed, ...rel.split('/')));
        if (!actual.equals(expected)) fail(`${target.name} byte mismatch: skills/${name}/${rel}`);
      }
    }
  }
}

function smokeWindows(tempRoot) {
  const cmdHome = path.join(tempRoot, 'cmd-home');
  fs.mkdirSync(cmdHome, { recursive: true });
  seedHome(cmdHome);
  const cmdEnv = { ...process.env, USERPROFILE: cmdHome, HOME: cmdHome };
  run(process.env.ComSpec || 'cmd.exe', ['/d', '/q', '/c', 'call install-local.cmd claude cursor codex'],
    { cwd: root, env: cmdEnv }, 'install-local.cmd default');
  assertInstall(cmdHome);
  const beforeDoctor = JSON.stringify(listTree(cmdHome));
  const doctor = run(process.env.ComSpec || 'cmd.exe', ['/d', '/q', '/c', 'call install-local.cmd doctor'],
    { cwd: root, env: cmdEnv }, 'install-local.cmd doctor');
  if (!doctor.stdout.includes('ROOT\tclaude\tPRESENT')
    || !doctor.stdout.includes('MANIFEST\tcodex\tCURRENT')
    || !doctor.stdout.includes('LEGACY\tclaude\tdev-doc\tPRESENT')
    || !doctor.stdout.includes('MIRROR\tyan-dev-doc\tclaude,cursor,codex')
    || !doctor.stdout.includes('DUPLICATE\tuser-owned-skill\tclaude,cursor,codex')) {
    fail('install-local.cmd doctor did not distinguish managed mirrors from unmanaged duplicates');
  }
  if (JSON.stringify(listTree(cmdHome)) !== beforeDoctor) fail('install-local.cmd doctor modified the home directory');
  seedRemovedManagedSkill(cmdHome);
  run(process.env.ComSpec || 'cmd.exe', ['/d', '/q', '/c', 'call install-local.cmd --migrate-legacy claude cursor codex'],
    { cwd: root, env: cmdEnv }, 'install-local.cmd explicit migration');
  assertInstall(cmdHome, { legacyMigrated: true });
  for (const target of targets) {
    const skillsRoot = path.join(cmdHome, target.dotDir, 'skills');
    if (fs.existsSync(path.join(skillsRoot, 'yan-removed-skill'))) {
      fail(`${target.name} kept a Skill removed from the managed distribution`);
    }
    if (findFile(backupRoot(cmdHome, target), 'removed-marker.txt').length !== 1) {
      fail(`${target.name} did not back up a Skill removed from the managed distribution`);
    }
  }
  const status = run(process.env.ComSpec || 'cmd.exe', ['/d', '/q', '/c', 'call install-local.cmd status'],
    { cwd: root, env: cmdEnv }, 'install-local.cmd status');
  if (!status.stdout.includes('claude\tCURRENT') || !status.stdout.includes('codex\tCURRENT')) {
    fail('install-local.cmd status did not report current targets');
  }

  const codexSkill = path.join(cmdHome, '.codex', 'skills', 'yan-dev-doc', 'SKILL.md');
  fs.appendFileSync(codexSkill, '\nlocal drift\n');
  const drift = run(process.env.ComSpec || 'cmd.exe', ['/d', '/q', '/c', 'call install-local.cmd status codex'],
    { cwd: root, env: cmdEnv }, 'install-local.cmd drift status', 2);
  if (!drift.stdout.includes('codex\tDRIFT')) fail('status did not detect local drift');

  const psHome = path.join(tempRoot, 'powershell-home');
  fs.mkdirSync(psHome, { recursive: true });
  seedHome(psHome);
  run('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'install.ps1'],
    {
      cwd: root,
      env: {
        ...process.env,
        USERPROFILE: psHome,
        HOME: psHome,
        DEV_WORKFLOW_SKILLS_SOURCE: root,
      },
    },
    'install.ps1 default');
  assertInstall(psHome);
}

function smokePosix(tempRoot) {
  const home = path.join(tempRoot, 'home');
  const fixtureParent = path.join(tempRoot, 'fixture');
  const fixtureRoot = path.join(fixtureParent, 'dev-workflow-skills-main');
  const archive = path.join(tempRoot, 'dev-workflow-skills-main.tar.gz');
  fs.mkdirSync(path.join(fixtureRoot, 'scripts'), { recursive: true });
  fs.cpSync(path.join(root, 'skills'), path.join(fixtureRoot, 'skills'), { recursive: true });
  fs.copyFileSync(path.join(root, 'scripts', 'install-core.js'), path.join(fixtureRoot, 'scripts', 'install-core.js'));
  fs.mkdirSync(home, { recursive: true });
  seedHome(home);
  run('tar', ['-czf', archive, '-C', fixtureParent, path.basename(fixtureRoot)], { cwd: root }, 'fixture archive');
  run('bash', ['install.sh', 'claude', 'cursor', 'codex'],
    {
      cwd: root,
      env: { ...process.env, HOME: home, DEV_WORKFLOW_SKILLS_TARBALL: pathToFileURL(archive).href },
    },
    'install.sh default');
  assertInstall(home);
}

requireText('install.sh', ['scripts/install-core.js', 'Node.js is required', 'doctor', '--migrate-legacy']);
requireText('install.ps1', ['scripts\\install-core.js', 'Node.js is required', 'DEV_WORKFLOW_SKILLS_SOURCE', 'Doctor']);
requireText('install-local.cmd', ['scripts\\install-core.js', 'status', 'doctor', '--migrate-legacy']);
requireText('scripts/install-core.js', [
  '.yan-dev-workflow-skills.json',
  '.yan-dev-workflow-skills-backups',
  'function doctor',
  'MIRROR',
  'DUPLICATE',
  'unowned legacy name',
  'removeUtf8BomFromSkillFiles',
  'sourceTreeHash',
]);
if (/\bpython3\b|\bperl\b/.test(read('install.sh'))) {
  fail('install.sh must not depend on python3/perl for Codex BOM normalization');
}

const cmdBytes = fs.readFileSync(path.join(root, 'install-local.cmd'));
cmdBytes.forEach((byte, index) => {
  if (byte > 0x7f) fail(`install-local.cmd must stay ASCII; non-ASCII byte at ${index}`);
});

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-workflow-skills-installer-'));
try {
  if (process.platform === 'win32') smokeWindows(tempRoot);
  else smokePosix(tempRoot);
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

if (failed) process.exit(1);
console.log(`ok safe installer manifest, backup, status, migration, BOM, and ${process.platform} smoke passed`);
