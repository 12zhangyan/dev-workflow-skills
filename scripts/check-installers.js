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

function hashFile(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
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

function seedStaleManagedFile(home) {
  for (const target of targets) {
    const skillsRoot = path.join(home, target.dotDir, 'skills');
    const managed = path.join(skillsRoot, 'yan-code-review');
    fs.writeFileSync(path.join(managed, 'stale-from-previous-release.txt'), 'remove me before reinstall\n');
    const manifestPath = path.join(skillsRoot, '.yan-dev-workflow-skills.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    manifest.installedHashes['yan-code-review'] = hashTree(managed);
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }
}

function downgradeManifestToV1(home) {
  for (const target of targets) {
    const manifestPath = path.join(home, target.dotDir, 'skills', '.yan-dev-workflow-skills.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    manifest.schemaVersion = 1;
    delete manifest.installMode;
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

function skillRootsState(home) {
  return JSON.stringify(targets.map((target) => {
    const rootDir = path.join(home, target.dotDir, 'skills');
    return fs.existsSync(rootDir) ? listTree(rootDir) : [];
  }));
}

function assertInstall(home) {
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
    if (manifest.installMode !== 'clean-replace') {
      fail(`${target.name} manifest did not record clean replacement mode`);
    }
    if (manifest.schemaVersion !== 2) {
      fail(`${target.name} manifest did not migrate to schema 2`);
    }

    for (const legacy of legacyNames) {
      const exists = fs.existsSync(path.join(skillsRoot, legacy));
      if (exists) fail(`${target.name} clean install kept known legacy directory: ${legacy}`);
    }
    if (findFile(backupRoot(home, target), 'legacy-marker.txt').length < legacyNames.length) {
      fail(`${target.name} did not move every known legacy directory out of discovery roots`);
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
  const beforeDryRun = JSON.stringify(listTree(cmdHome));
  const dryRun = run(process.env.ComSpec || 'cmd.exe',
    ['/d', '/q', '/c', 'call install-local.cmd --dry-run claude cursor codex'],
    { cwd: root, env: cmdEnv }, 'install-local.cmd dry run');
  if (!dryRun.stdout.includes('[PLAN]') || !dryRun.stdout.includes('No files were changed')) {
    fail('install-local.cmd dry run did not print a cleanup/install plan');
  }
  if (JSON.stringify(listTree(cmdHome)) !== beforeDryRun) {
    fail('install-local.cmd dry run modified the home directory');
  }
  run(process.env.ComSpec || 'cmd.exe', ['/d', '/q', '/c', 'call install-local.cmd claude cursor codex'],
    { cwd: root, env: cmdEnv }, 'install-local.cmd default');
  assertInstall(cmdHome);
  const beforeDoctor = JSON.stringify(listTree(cmdHome));
  const doctor = run(process.env.ComSpec || 'cmd.exe', ['/d', '/q', '/c', 'call install-local.cmd doctor'],
    { cwd: root, env: cmdEnv }, 'install-local.cmd doctor');
  if (!doctor.stdout.includes('ROOT\tclaude\tPRESENT')
    || !doctor.stdout.includes('MANIFEST\tcodex\tCURRENT')
    || !doctor.stdout.includes('MIRROR\tyan-dev-doc\tclaude,cursor,codex')
    || !doctor.stdout.includes('DUPLICATE\tuser-owned-skill\tclaude,cursor,codex')) {
    fail('install-local.cmd doctor did not distinguish managed mirrors from unmanaged duplicates');
  }
  if (doctor.stdout.includes('LEGACY\t')) fail('clean install left a known legacy directory discoverable');
  if (JSON.stringify(listTree(cmdHome)) !== beforeDoctor) fail('install-local.cmd doctor modified the home directory');
  downgradeManifestToV1(cmdHome);
  const oldSchema = run(process.env.ComSpec || 'cmd.exe', ['/d', '/q', '/c', 'call install-local.cmd status'],
    { cwd: root, env: cmdEnv }, 'install-local.cmd schema 1 status', 2);
  if (!oldSchema.stdout.includes('OUTDATED') || !oldSchema.stdout.includes('schema-migrated:1->2')) {
    fail('status did not report the supported schema 1 migration');
  }
  seedRemovedManagedSkill(cmdHome);
  seedStaleManagedFile(cmdHome);
  const migrated = run(process.env.ComSpec || 'cmd.exe',
    ['/d', '/q', '/c', 'call install-local.cmd --migrate-legacy claude cursor codex'],
    { cwd: root, env: cmdEnv }, 'install-local.cmd clean reinstall');
  if (!migrated.stderr.includes('[DEPRECATED]')) {
    fail('deprecated --migrate-legacy did not emit a warning');
  }
  assertInstall(cmdHome);
  for (const target of targets) {
    const skillsRoot = path.join(cmdHome, target.dotDir, 'skills');
    if (fs.existsSync(path.join(skillsRoot, 'yan-removed-skill'))) {
      fail(`${target.name} kept a Skill removed from the managed distribution`);
    }
    if (findFile(backupRoot(cmdHome, target), 'removed-marker.txt').length !== 1) {
      fail(`${target.name} did not back up a Skill removed from the managed distribution`);
    }
    if (fs.existsSync(path.join(skillsRoot, 'yan-code-review', 'stale-from-previous-release.txt'))) {
      fail(`${target.name} clean reinstall retained a stale managed file`);
    }
  }

  const beforeFailure = JSON.stringify(listTree(cmdHome));
  run(process.env.ComSpec || 'cmd.exe', ['/d', '/q', '/c', 'call install-local.cmd claude cursor codex'],
    {
      cwd: root,
      env: { ...cmdEnv, DEV_WORKFLOW_SKILLS_FAILPOINT: 'manifest:cursor' },
    },
    'install-local.cmd activation rollback', 1);
  if (JSON.stringify(listTree(cmdHome)) !== beforeFailure) {
    fail('cross-target activation failure did not roll back the complete installation');
  }
  run(process.env.ComSpec || 'cmd.exe', ['/d', '/q', '/c', 'call install-local.cmd claude'],
    {
      cwd: root,
      env: { ...cmdEnv, DEV_WORKFLOW_SKILLS_FAILPOINT: 'stage:claude:yan-code-review' },
    },
    'install-local.cmd staging failure', 1);
  if (JSON.stringify(listTree(cmdHome)) !== beforeFailure) {
    fail('staging failure modified the active installation');
  }

  const lockPath = path.join(cmdHome, '.claude', '.yan-dev-workflow-skills.lock');
  fs.writeFileSync(lockPath, `${JSON.stringify({ pid: process.pid, startedAt: 'test' })}\n`);
  run(process.env.ComSpec || 'cmd.exe', ['/d', '/q', '/c', 'call install-local.cmd claude'],
    { cwd: root, env: cmdEnv }, 'install-local.cmd concurrent lock', 1);
  fs.rmSync(lockPath, { force: true });
  if (JSON.stringify(listTree(cmdHome)) !== beforeFailure) {
    fail('lock rejection modified the active installation');
  }
  fs.writeFileSync(lockPath, 'stale lock\n');
  const staleTime = new Date(Date.now() - 7 * 60 * 60 * 1000);
  fs.utimesSync(lockPath, staleTime, staleTime);
  const staleLock = run(process.env.ComSpec || 'cmd.exe',
    ['/d', '/q', '/c', 'call install-local.cmd claude'],
    { cwd: root, env: cmdEnv }, 'install-local.cmd stale lock recovery');
  if (!staleLock.stderr.includes('[RECOVER]') || fs.existsSync(lockPath)) {
    fail('stale installer lock was not recovered');
  }
  assertInstall(cmdHome);

  const claudeManifestPath = path.join(
    cmdHome,
    '.claude',
    'skills',
    '.yan-dev-workflow-skills.json',
  );
  const validManifestText = fs.readFileSync(claudeManifestPath, 'utf8');
  const unsupportedManifest = JSON.parse(validManifestText);
  unsupportedManifest.schemaVersion = 99;
  fs.writeFileSync(claudeManifestPath, `${JSON.stringify(unsupportedManifest, null, 2)}\n`);
  const beforeUnsupportedSchema = JSON.stringify(listTree(cmdHome));
  const unsupported = run(process.env.ComSpec || 'cmd.exe',
    ['/d', '/q', '/c', 'call install-local.cmd --dry-run claude'],
    { cwd: root, env: cmdEnv }, 'install-local.cmd unsupported schema', 1);
  if (!unsupported.stderr.includes('unsupported-schema:99')) {
    fail('unsupported manifest schema did not fail explicitly');
  }
  if (JSON.stringify(listTree(cmdHome)) !== beforeUnsupportedSchema) {
    fail('unsupported manifest schema changed the installation');
  }
  fs.writeFileSync(claudeManifestPath, validManifestText);

  const backupList = run(process.env.ComSpec || 'cmd.exe',
    ['/d', '/q', '/c', 'call install-local.cmd backups codex'],
    { cwd: root, env: cmdEnv }, 'install-local.cmd backup list');
  const restoreLine = backupList.stdout.split(/\r?\n/)
    .find((line) => line.startsWith('BACKUP\tcodex\t') && line.split('\t')[3].split(',').includes('yan-dev-doc'));
  if (!restoreLine) {
    fail('backups command did not list the pre-manifest yan-dev-doc snapshot');
  } else {
    const backupId = restoreLine.split('\t')[2];
    const beforeRestoreFailure = JSON.stringify(listTree(cmdHome));
    run(process.env.ComSpec || 'cmd.exe',
      ['/d', '/q', '/c', `call install-local.cmd restore --backup ${backupId} --skill yan-dev-doc codex`],
      {
        cwd: root,
        env: { ...cmdEnv, DEV_WORKFLOW_SKILLS_FAILPOINT: 'restore-activate:codex:yan-dev-doc' },
      },
      'install-local.cmd restore rollback', 1);
    if (JSON.stringify(listTree(cmdHome)) !== beforeRestoreFailure) {
      fail('restore activation failure did not roll back the active Skill');
    }
    run(process.env.ComSpec || 'cmd.exe',
      ['/d', '/q', '/c', `call install-local.cmd restore --backup ${backupId} --skill yan-dev-doc codex`],
      { cwd: root, env: cmdEnv }, 'install-local.cmd restore');
    if (!fs.existsSync(path.join(cmdHome, '.codex', 'skills', 'yan-dev-doc', 'stale-from-old-install.txt'))) {
      fail('restore did not recover the selected backup Skill');
    }
    const restoredStatus = run(process.env.ComSpec || 'cmd.exe',
      ['/d', '/q', '/c', 'call install-local.cmd status codex'],
      { cwd: root, env: cmdEnv }, 'install-local.cmd restored drift status', 2);
    if (!restoredStatus.stdout.includes('codex\tDRIFT')) {
      fail('status did not report a restored historical Skill as drift');
    }
    run(process.env.ComSpec || 'cmd.exe', ['/d', '/q', '/c', 'call install-local.cmd codex'],
      { cwd: root, env: cmdEnv }, 'install-local.cmd reinstall after restore');
    assertInstall(cmdHome);
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

  const beforePrune = run(process.env.ComSpec || 'cmd.exe',
    ['/d', '/q', '/c', 'call install-local.cmd backups codex'],
    { cwd: root, env: cmdEnv }, 'install-local.cmd backups before prune').stdout;
  const beforePruneCount = beforePrune.split(/\r?\n/).filter((line) => line.startsWith('BACKUP\tcodex\t')).length;
  run(process.env.ComSpec || 'cmd.exe',
    ['/d', '/q', '/c', 'call install-local.cmd backup-prune --keep 1 --dry-run codex'],
    { cwd: root, env: cmdEnv }, 'install-local.cmd backup prune dry run');
  const afterDryPrune = run(process.env.ComSpec || 'cmd.exe',
    ['/d', '/q', '/c', 'call install-local.cmd backups codex'],
    { cwd: root, env: cmdEnv }, 'install-local.cmd backups after dry prune').stdout;
  const afterDryPruneCount = afterDryPrune.split(/\r?\n/)
    .filter((line) => line.startsWith('BACKUP\tcodex\t')).length;
  if (afterDryPruneCount !== beforePruneCount) fail('backup prune dry run removed snapshots');
  run(process.env.ComSpec || 'cmd.exe',
    ['/d', '/q', '/c', 'call install-local.cmd backup-prune --keep 1 codex'],
    { cwd: root, env: cmdEnv }, 'install-local.cmd backup prune');
  const afterPrune = run(process.env.ComSpec || 'cmd.exe',
    ['/d', '/q', '/c', 'call install-local.cmd backups codex'],
    { cwd: root, env: cmdEnv }, 'install-local.cmd backups after prune').stdout;
  if (afterPrune.split(/\r?\n/).filter((line) => line.startsWith('BACKUP\tcodex\t')).length !== 1) {
    fail('backup prune did not retain exactly the requested snapshot count');
  }

  const psHome = path.join(tempRoot, 'powershell-home');
  fs.mkdirSync(psHome, { recursive: true });
  seedHome(psHome);
  const beforePowerShellDryRun = skillRootsState(psHome);
  run('powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'install.ps1', '-DryRun'],
    {
      cwd: root,
      env: {
        ...process.env,
        USERPROFILE: psHome,
        HOME: psHome,
        DEV_WORKFLOW_SKILLS_SOURCE: root,
      },
    },
    'install.ps1 dry run');
  if (skillRootsState(psHome) !== beforePowerShellDryRun) {
    fail('install.ps1 dry run modified an active Skill root');
  }
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
  const psBackups = run('powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'install.ps1', '-Backups', '-Targets', 'codex'],
    {
      cwd: root,
      env: {
        ...process.env,
        USERPROFILE: psHome,
        HOME: psHome,
        DEV_WORKFLOW_SKILLS_SOURCE: root,
      },
    },
    'install.ps1 backups');
  if (!psBackups.stdout.includes('BACKUP\tcodex\t')) {
    fail('install.ps1 did not route the backups command');
  }
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
  const archiveSha256 = hashFile(archive);
  run('bash', ['install.sh', '--ref', 'fixture-v1', '--sha256', archiveSha256, 'claude', 'cursor', 'codex'],
    {
      cwd: root,
      env: { ...process.env, HOME: home, DEV_WORKFLOW_SKILLS_TARBALL: pathToFileURL(archive).href },
    },
    'install.sh default');
  assertInstall(home);
  for (const target of targets) {
    const manifest = JSON.parse(fs.readFileSync(
      path.join(home, target.dotDir, 'skills', '.yan-dev-workflow-skills.json'),
      'utf8',
    ));
    if (manifest.sourceVersion !== 'fixture-v1') {
      fail(`${target.name} did not record the pinned archive ref`);
    }
  }
  const beforeChecksumFailure = JSON.stringify(listTree(home));
  run('bash', ['install.sh', '--sha256', '0'.repeat(64), 'claude'],
    {
      cwd: root,
      env: { ...process.env, HOME: home, DEV_WORKFLOW_SKILLS_TARBALL: pathToFileURL(archive).href },
    },
    'install.sh checksum rejection', 1);
  if (JSON.stringify(listTree(home)) !== beforeChecksumFailure) {
    fail('checksum rejection modified the installed home');
  }
}

requireText('install.sh', [
  'scripts/install-core.js',
  'Node.js is required',
  'backup-prune',
  '--dry-run',
  '--sha256',
]);
requireText('install.ps1', [
  'scripts\\install-core.js',
  'Node.js is required',
  'DEV_WORKFLOW_SKILLS_SOURCE',
  'BackupPrune',
  'Get-FileHash',
]);
requireText('install-local.cmd', [
  'scripts\\install-core.js',
  'backups',
  'restore',
  'backup-prune',
  '--dry-run',
]);
requireText('scripts/install-core.js', [
  '.yan-dev-workflow-skills.json',
  '.yan-dev-workflow-skills-backups',
  '.yan-dev-workflow-skills-staging',
  '.yan-dev-workflow-skills.lock',
  'function doctor',
  'MIRROR',
  'DUPLICATE',
  'known legacy cleanup',
  'clean-replace',
  'rollbackInstall',
  'backupSnapshots',
  'schema-migrated:1->2',
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
console.log(`ok transactional installer rollback, lock, backup lifecycle, schema, checksum, BOM, and ${process.platform} smoke passed`);
