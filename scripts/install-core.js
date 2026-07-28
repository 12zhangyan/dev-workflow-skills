#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const DISTRIBUTION = 'dev-workflow-skills';
const MANIFEST = '.yan-dev-workflow-skills.json';
const MANIFEST_SCHEMA = 2;
const BACKUP_DIR = '.yan-dev-workflow-skills-backups';
const STAGING_DIR = '.yan-dev-workflow-skills-staging';
const LOCK = '.yan-dev-workflow-skills.lock';
const LEGACY_NAMES = new Set([
  'dev-doc', 'project-analysis', 'code-review', 'conversation-handoff',
  'bug-fix', 'biz-flow', 'code-reading',
  'review-fix', 'review-check', 'review-repair', 'review-loop',
]);
const TARGETS = {
  claude: { dotDir: '.claude', label: 'Claude Code', stripSkillBom: false },
  cursor: { dotDir: '.cursor', label: 'Cursor', stripSkillBom: false },
  codex: { dotDir: '.codex', label: 'Codex', stripSkillBom: true },
};

function fail(message) {
  process.stderr.write(`[ERROR] ${message}\n`);
  process.exit(1);
}

function parseArgs(argv) {
  const result = { command: argv[0], targets: [] };
  for (let index = 1; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--source') result.source = argv[++index];
    else if (arg === '--home') result.home = argv[++index];
    else if (arg === '--version') result.version = argv[++index];
    else if (arg === '--migrate-legacy') result.migrateLegacy = true;
    else if (arg === '--dry-run') result.dryRun = true;
    else if (arg === '--backup') result.backup = argv[++index];
    else if (arg === '--skill') result.skill = argv[++index];
    else if (arg === '--keep') result.keep = argv[++index];
    else if (arg === '--targets') {
      while (index + 1 < argv.length && !argv[index + 1].startsWith('--')) {
        result.targets.push(argv[++index].toLowerCase());
      }
    } else fail(`unknown argument: ${arg}`);
  }
  return result;
}

function validateTargets(targets) {
  const selected = targets.length ? targets : Object.keys(TARGETS);
  for (const target of selected) {
    if (!TARGETS[target]) fail(`unknown target: ${target} (allowed: claude cursor codex)`);
  }
  return [...new Set(selected)];
}

function listFiles(root, base = root) {
  if (!fs.existsSync(root)) return [];
  const result = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) result.push(...listFiles(full, base));
    else if (entry.isFile()) result.push(path.relative(base, full).replace(/\\/g, '/'));
  }
  return result.sort();
}

function hashTree(root) {
  const hash = crypto.createHash('sha256');
  for (const rel of listFiles(root)) {
    hash.update(rel);
    hash.update('\0');
    hash.update(fs.readFileSync(path.join(root, ...rel.split('/'))));
    hash.update('\0');
  }
  return hash.digest('hex');
}

function loadManifest(skillsRoot, targetName) {
  const file = path.join(skillsRoot, MANIFEST);
  if (!fs.existsSync(file)) return { manifest: null, state: 'missing', notes: [] };
  try {
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (value.distribution !== DISTRIBUTION) {
      return { manifest: null, state: 'foreign', notes: ['foreign-distribution'] };
    }
    const schemaVersion = value.schemaVersion === undefined ? 1 : value.schemaVersion;
    if (![1, MANIFEST_SCHEMA].includes(schemaVersion)) {
      return { manifest: null, state: 'unsupported', notes: [`unsupported-schema:${schemaVersion}`] };
    }
    if (!Array.isArray(value.managedSkills)
      || !value.managedSkills.every(safeManagedName)
      || !value.installedHashes
      || typeof value.installedHashes !== 'object'
      || Array.isArray(value.installedHashes)) {
      return { manifest: null, state: 'invalid', notes: ['invalid-managed-contract'] };
    }
    if (value.target && targetName && value.target !== targetName) {
      return { manifest: null, state: 'invalid', notes: [`target-mismatch:${value.target}`] };
    }
    const migrated = schemaVersion === 1;
    return {
      manifest: {
        ...value,
        schemaVersion: MANIFEST_SCHEMA,
        installMode: value.installMode || 'legacy-update',
        managedLegacy: Array.isArray(value.managedLegacy) ? value.managedLegacy : [],
        preservedLegacy: Array.isArray(value.preservedLegacy) ? value.preservedLegacy : [],
      },
      state: migrated ? 'migrated-v1' : 'valid',
      notes: migrated ? ['schema-migrated:1->2'] : [],
    };
  } catch (error) {
    return { manifest: null, state: 'invalid', notes: [`invalid-json:${error.message}`] };
  }
}

function removeUtf8BomFromSkillFiles(root) {
  for (const rel of listFiles(root)) {
    if (path.basename(rel) !== 'SKILL.md') continue;
    const file = path.join(root, ...rel.split('/'));
    const bytes = fs.readFileSync(file);
    if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
      fs.writeFileSync(file, bytes.subarray(3));
    }
  }
}

function timestamp() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');
}

function transactionId() {
  return `${timestamp()}-${process.pid}-${crypto.randomBytes(3).toString('hex')}`;
}

function atomicWrite(file, content) {
  const temporary = `${file}.tmp-${process.pid}-${crypto.randomBytes(3).toString('hex')}`;
  fs.writeFileSync(temporary, content);
  try {
    fs.renameSync(temporary, file);
  } catch (error) {
    fs.rmSync(temporary, { force: true });
    throw error;
  }
}

function maybeFail(point) {
  if (process.env.DEV_WORKFLOW_SKILLS_FAILPOINT === point) {
    throw new Error(`injected installer failure at ${point}`);
  }
}

function targetPaths(home, targetName) {
  const target = TARGETS[targetName];
  const targetRoot = path.resolve(home, target.dotDir);
  const skillsRoot = path.resolve(targetRoot, 'skills');
  const relative = path.relative(targetRoot, skillsRoot);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`unsafe skills target for ${targetName}: ${skillsRoot}`);
  }
  return {
    target,
    targetRoot,
    skillsRoot,
    lockPath: path.join(targetRoot, LOCK),
  };
}

function acquireLock(home, targetName) {
  const paths = targetPaths(home, targetName);
  fs.mkdirSync(paths.targetRoot, { recursive: true });
  let handle;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      handle = fs.openSync(paths.lockPath, 'wx');
      break;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      let stale = false;
      try {
        const lock = JSON.parse(fs.readFileSync(paths.lockPath, 'utf8'));
        if (Number.isInteger(lock.pid) && lock.pid > 0) {
          try {
            process.kill(lock.pid, 0);
          } catch (processError) {
            stale = processError.code === 'ESRCH';
          }
        }
      } catch (_error) {
        const ageMs = Date.now() - fs.statSync(paths.lockPath).mtimeMs;
        stale = ageMs > 6 * 60 * 60 * 1000;
      }
      if (!stale || attempt > 0) {
        throw new Error(`another installer is active for ${targetName}: ${paths.lockPath}`);
      }
      const stalePath = `${paths.lockPath}.stale-${process.pid}-${crypto.randomBytes(3).toString('hex')}`;
      fs.renameSync(paths.lockPath, stalePath);
      fs.rmSync(stalePath, { force: true });
      process.stderr.write(`  [RECOVER] removed stale installer lock for ${targetName}\n`);
    }
  }
  if (handle === undefined) throw new Error(`could not acquire installer lock for ${targetName}`);
  fs.writeFileSync(handle, `${JSON.stringify({
    distribution: DISTRIBUTION,
    target: targetName,
    pid: process.pid,
    startedAt: new Date().toISOString(),
  })}\n`);
  return () => {
    try {
      fs.closeSync(handle);
    } finally {
      fs.rmSync(paths.lockPath, { force: true });
    }
  };
}

function cleanupEmptyParents(start, stop) {
  let current = start;
  const relative = path.relative(stop, current);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return;
  while (fs.existsSync(current)) {
    if (fs.readdirSync(current).length) break;
    fs.rmdirSync(current);
    if (current === stop) break;
    current = path.dirname(current);
  }
}

function sourceSkillNames(sourceRoot) {
  const skills = path.join(sourceRoot, 'skills');
  if (!fs.existsSync(skills)) fail(`source does not contain skills/: ${sourceRoot}`);
  return fs.readdirSync(skills, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !LEGACY_NAMES.has(entry.name))
    .map((entry) => entry.name)
    .sort();
}

function safeManagedName(name) {
  return typeof name === 'string'
    && /^[A-Za-z0-9_][A-Za-z0-9._-]*$/.test(name)
    && name !== '.'
    && name !== '..';
}

function sourceVersion(sourceRoot, explicit) {
  if (explicit) return explicit;
  const result = spawnSync('git', ['-C', sourceRoot, 'rev-parse', 'HEAD'], {
    encoding: 'utf8',
    windowsHide: true,
  });
  return result.status === 0 ? result.stdout.trim() : 'archive-main';
}

function copySkill(source, destination, stripSkillBom) {
  fs.cpSync(source, destination, { recursive: true });
  if (stripSkillBom) removeUtf8BomFromSkillFiles(destination);
}

function addPlanItem(plan, name, disposition, reason) {
  const existing = plan.get(name);
  if (!existing || (existing.disposition === 'discard' && disposition === 'backup')) {
    plan.set(name, { name, disposition, reason });
  }
}

function prepareInstallContext(sourceRoot, home, targetName, version) {
  const paths = targetPaths(home, targetName);
  const manifestState = loadManifest(paths.skillsRoot, targetName);
  if (['foreign', 'unsupported', 'invalid'].includes(manifestState.state)) {
    throw new Error(
      `cannot safely replace ${targetName}: ${MANIFEST} is ${manifestState.state}`
      + ` (${manifestState.notes.join(', ')})`,
    );
  }
  const previous = manifestState.manifest;
  const names = sourceSkillNames(sourceRoot);
  const previousHashes = previous ? previous.installedHashes : {};
  const plan = new Map();

  const removedManaged = previous
    ? previous.managedSkills.filter((name) => !names.includes(name))
    : [];
  for (const name of removedManaged) {
    if (fs.existsSync(path.join(paths.skillsRoot, name))) {
      addPlanItem(plan, name, 'backup', 'removed from current distribution');
    }
  }
  for (const legacy of LEGACY_NAMES) {
    if (!fs.existsSync(path.join(paths.skillsRoot, legacy))) continue;
    const previouslyManaged = previous && previous.managedLegacy.includes(legacy);
    addPlanItem(
      plan,
      legacy,
      'backup',
      previouslyManaged ? 'managed legacy cleanup' : 'known legacy cleanup',
    );
  }
  for (const name of names) {
    const destination = path.join(paths.skillsRoot, name);
    if (!fs.existsSync(destination)) continue;
    const currentHash = hashTree(destination);
    if (previousHashes[name] && previousHashes[name] === currentHash) {
      addPlanItem(plan, name, 'discard', 'previous managed install');
    } else {
      addPlanItem(
        plan,
        name,
        'backup',
        previousHashes[name] ? 'locally modified managed skill' : 'pre-manifest skill',
      );
    }
  }

  const id = transactionId();
  return {
    ...paths,
    sourceRoot,
    home,
    targetName,
    version,
    names,
    plan: [...plan.values()],
    manifestState,
    stageRoot: path.join(home, STAGING_DIR, targetName, id),
    transactionRoot: path.join(home, BACKUP_DIR, targetName, id),
    stagedHashes: {},
    moved: [],
    activated: [],
    previousManifestMoved: false,
    manifestWritten: false,
  };
}

function printInstallPlan(context) {
  process.stdout.write(`==> ${context.target.label}: ${context.skillsRoot}\n`);
  if (context.manifestState.state === 'migrated-v1') {
    process.stdout.write('  [MIGRATE] manifest schema 1 -> 2\n');
  }
  for (const item of context.plan) {
    process.stdout.write(
      `  [PLAN] ${item.disposition === 'discard' ? 'REMOVE' : 'BACKUP'}`
      + ` ${item.name} (${item.reason})\n`,
    );
  }
  for (const name of context.names) process.stdout.write(`  [PLAN] INSTALL ${name}\n`);
}

function stageInstall(context) {
  fs.mkdirSync(path.join(context.stageRoot, 'skills'), { recursive: true });
  for (const name of context.names) {
    const source = path.join(context.sourceRoot, 'skills', name);
    const staged = path.join(context.stageRoot, 'skills', name);
    copySkill(source, staged, context.target.stripSkillBom);
    maybeFail(`stage:${context.targetName}:${name}`);
    context.stagedHashes[name] = hashTree(staged);
  }
  const manifest = {
    schemaVersion: MANIFEST_SCHEMA,
    distribution: DISTRIBUTION,
    target: context.targetName,
    sourceVersion: context.version,
    sourceTreeHash: hashTree(path.join(context.sourceRoot, 'skills')),
    installedAt: new Date().toISOString(),
    installMode: 'clean-replace',
    managedSkills: context.names,
    installedHashes: context.stagedHashes,
    managedLegacy: [],
    preservedLegacy: [],
  };
  atomicWrite(
    path.join(context.stageRoot, MANIFEST),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  process.stdout.write(`  [STAGED] ${context.names.length} Skill directories\n`);
}

function activateInstall(context) {
  fs.mkdirSync(context.skillsRoot, { recursive: true });
  fs.mkdirSync(context.transactionRoot, { recursive: true });
  for (const item of context.plan) {
    const active = path.join(context.skillsRoot, item.name);
    if (!fs.existsSync(active)) throw new Error(`planned Skill disappeared before activation: ${active}`);
    const held = path.join(context.transactionRoot, item.name);
    fs.renameSync(active, held);
    context.moved.push({ ...item, active, held });
  }

  const activeManifest = path.join(context.skillsRoot, MANIFEST);
  if (fs.existsSync(activeManifest)) {
    fs.renameSync(activeManifest, path.join(context.transactionRoot, MANIFEST));
    context.previousManifestMoved = true;
  }

  for (const name of context.names) {
    const staged = path.join(context.stageRoot, 'skills', name);
    const active = path.join(context.skillsRoot, name);
    fs.renameSync(staged, active);
    context.activated.push({ name, active });
    maybeFail(`activate:${context.targetName}:${name}`);
  }
  maybeFail(`manifest:${context.targetName}`);
  fs.renameSync(path.join(context.stageRoot, MANIFEST), activeManifest);
  context.manifestWritten = true;
}

function rollbackInstall(context) {
  const errors = [];
  const attempt = (operation) => {
    try {
      operation();
    } catch (error) {
      errors.push(error.message);
    }
  };
  if (context.manifestWritten) {
    attempt(() => fs.rmSync(path.join(context.skillsRoot, MANIFEST), { force: true }));
  }
  for (const item of [...context.activated].reverse()) {
    attempt(() => fs.rmSync(item.active, { recursive: true, force: true }));
  }
  for (const item of [...context.moved].reverse()) {
    attempt(() => {
      if (fs.existsSync(item.held)) fs.renameSync(item.held, item.active);
    });
  }
  if (context.previousManifestMoved) {
    attempt(() => fs.renameSync(
      path.join(context.transactionRoot, MANIFEST),
      path.join(context.skillsRoot, MANIFEST),
    ));
  }
  attempt(() => fs.rmSync(context.stageRoot, { recursive: true, force: true }));
  attempt(() => fs.rmSync(context.transactionRoot, { recursive: true, force: true }));
  attempt(() => cleanupEmptyParents(
    path.dirname(context.stageRoot),
    path.join(context.home, STAGING_DIR),
  ));
  attempt(() => cleanupEmptyParents(
    path.dirname(context.transactionRoot),
    path.join(context.home, BACKUP_DIR, context.targetName),
  ));
  if (errors.length) throw new Error(`rollback incomplete for ${context.targetName}: ${errors.join('; ')}`);
  process.stdout.write(`  [ROLLBACK] ${context.targetName} restored previous installation\n`);
}

function finalizeInstall(context) {
  const cleanup = (operation, label) => {
    try {
      operation();
    } catch (error) {
      process.stderr.write(`  [WARN] ${label}: ${error.message}\n`);
    }
  };
  if (context.previousManifestMoved) {
    cleanup(
      () => fs.rmSync(path.join(context.transactionRoot, MANIFEST), { force: true }),
      `could not remove previous manifest backup for ${context.targetName}`,
    );
  }
  for (const item of context.moved) {
    if (item.disposition === 'discard') {
      cleanup(
        () => fs.rmSync(item.held, { recursive: true, force: true }),
        `could not remove replaced managed Skill ${item.name}`,
      );
      process.stdout.write(`  [CLEAN] ${item.name} (${item.reason})\n`);
    } else {
      process.stdout.write(
        `  [BACKUP] ${item.name} (${item.reason}) -> ${item.held.replace(/\\/g, '/')}\n`,
      );
    }
  }
  cleanup(
    () => fs.rmSync(context.stageRoot, { recursive: true, force: true }),
    `could not remove staging directory for ${context.targetName}`,
  );
  cleanup(
    () => cleanupEmptyParents(path.dirname(context.stageRoot), path.join(context.home, STAGING_DIR)),
    `could not clean empty staging parents for ${context.targetName}`,
  );
  cleanup(
    () => cleanupEmptyParents(context.transactionRoot, path.join(context.home, BACKUP_DIR, context.targetName)),
    `could not clean empty backup parents for ${context.targetName}`,
  );
  for (const name of context.names) process.stdout.write(`  [OK] ${name}\n`);
  process.stdout.write(`  [MANIFEST] ${MANIFEST} (schema ${MANIFEST_SCHEMA})\n\n`);
}

function installTargets(sourceRoot, home, targetNames, version, dryRun) {
  const contexts = targetNames.map((targetName) => (
    prepareInstallContext(sourceRoot, home, targetName, version)
  ));
  for (const context of contexts) printInstallPlan(context);
  if (dryRun) {
    process.stdout.write('Dry run complete. No files were changed.\n');
    return;
  }

  const releases = [];
  try {
    for (const targetName of targetNames) releases.push(acquireLock(home, targetName));
    for (const context of contexts) stageInstall(context);
    for (const context of contexts) activateInstall(context);
    for (const context of contexts) finalizeInstall(context);
  } catch (error) {
    const rollbackErrors = [];
    for (const context of [...contexts].reverse()) {
      if (!context.moved.length && !context.activated.length && !context.manifestWritten) {
        fs.rmSync(context.stageRoot, { recursive: true, force: true });
        cleanupEmptyParents(path.dirname(context.stageRoot), path.join(context.home, STAGING_DIR));
        continue;
      }
      try {
        rollbackInstall(context);
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError.message);
      }
    }
    if (rollbackErrors.length) {
      throw new Error(`${error.message}; ${rollbackErrors.join('; ')}`);
    }
    throw error;
  } finally {
    for (const release of releases.reverse()) release();
  }
}

function backupSnapshots(home, targetName) {
  const root = path.join(home, BACKUP_DIR, targetName);
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const directory = path.join(root, entry.name);
      const skills = fs.readdirSync(directory, { withFileTypes: true })
        .filter((child) => child.isDirectory() && safeManagedName(child.name))
        .map((child) => child.name)
        .sort();
      return { id: entry.name, directory, skills, mtimeMs: fs.statSync(directory).mtimeMs };
    })
    .filter((snapshot) => snapshot.skills.length)
    .sort((left, right) => right.mtimeMs - left.mtimeMs || right.id.localeCompare(left.id));
}

function listBackups(home, targetNames) {
  let count = 0;
  for (const targetName of targetNames) {
    for (const snapshot of backupSnapshots(home, targetName)) {
      process.stdout.write(
        `BACKUP\t${targetName}\t${snapshot.id}\t${snapshot.skills.join(',')}`
        + `\t${snapshot.directory.replace(/\\/g, '/')}\n`,
      );
      count += 1;
    }
  }
  if (!count) process.stdout.write('No managed backup snapshots found.\n');
}

function parseKeep(value) {
  if (value === undefined) throw new Error('--keep <count> is required');
  if (!/^\d+$/.test(String(value))) throw new Error(`invalid --keep count: ${value}`);
  const count = Number(value);
  if (!Number.isSafeInteger(count)) throw new Error(`invalid --keep count: ${value}`);
  return count;
}

function pruneBackups(home, targetNames, keep, dryRun) {
  const releases = [];
  try {
    if (!dryRun) {
      for (const targetName of targetNames) releases.push(acquireLock(home, targetName));
    }
    for (const targetName of targetNames) {
      const snapshots = backupSnapshots(home, targetName);
      for (const snapshot of snapshots.slice(keep)) {
        process.stdout.write(
          `  [${dryRun ? 'PLAN' : 'PRUNE'}] ${targetName}/${snapshot.id}`
          + ` (${snapshot.skills.join(', ')})\n`,
        );
        if (!dryRun) fs.rmSync(snapshot.directory, { recursive: true, force: true });
      }
    }
  } finally {
    for (const release of releases.reverse()) release();
  }
  if (dryRun) process.stdout.write('Dry run complete. No backup snapshots were removed.\n');
}

function selectRestoreSnapshot(home, targetName, backupId) {
  if (!backupId || !safeManagedName(backupId)) {
    throw new Error('restore requires --backup <snapshot-id> from the backups command');
  }
  const snapshot = backupSnapshots(home, targetName).find((item) => item.id === backupId);
  if (!snapshot) throw new Error(`backup snapshot not found for ${targetName}: ${backupId}`);
  return snapshot;
}

function restoreBackup(home, targetName, backupId, skillName, dryRun) {
  if (skillName && !safeManagedName(skillName)) throw new Error(`invalid Skill name: ${skillName}`);
  const paths = targetPaths(home, targetName);
  const snapshot = selectRestoreSnapshot(home, targetName, backupId);
  const names = skillName ? snapshot.skills.filter((name) => name === skillName) : snapshot.skills;
  if (!names.length) {
    throw new Error(`backup snapshot ${backupId} does not contain ${skillName || 'any Skill'}`);
  }
  process.stdout.write(`==> Restore ${targetName} backup ${backupId}\n`);
  for (const name of names) {
    const action = fs.existsSync(path.join(paths.skillsRoot, name)) ? 'BACKUP+RESTORE' : 'RESTORE';
    process.stdout.write(`  [PLAN] ${action} ${name}\n`);
  }
  if (dryRun) {
    process.stdout.write('Dry run complete. No files were changed.\n');
    return;
  }

  const release = acquireLock(home, targetName);
  const id = transactionId();
  const stageRoot = path.join(home, STAGING_DIR, targetName, `${id}-restore`);
  const displacedRoot = path.join(home, BACKUP_DIR, targetName, `${id}-restore`);
  const activated = [];
  const displaced = [];
  try {
    fs.mkdirSync(stageRoot, { recursive: true });
    for (const name of names) {
      fs.cpSync(path.join(snapshot.directory, name), path.join(stageRoot, name), { recursive: true });
      maybeFail(`restore-stage:${targetName}:${name}`);
    }
    fs.mkdirSync(paths.skillsRoot, { recursive: true });
    fs.mkdirSync(displacedRoot, { recursive: true });
    for (const name of names) {
      const active = path.join(paths.skillsRoot, name);
      if (!fs.existsSync(active)) continue;
      const held = path.join(displacedRoot, name);
      fs.renameSync(active, held);
      displaced.push({ active, held, name });
    }
    for (const name of names) {
      const active = path.join(paths.skillsRoot, name);
      fs.renameSync(path.join(stageRoot, name), active);
      activated.push({ active, name });
      maybeFail(`restore-activate:${targetName}:${name}`);
    }
    fs.rmSync(stageRoot, { recursive: true, force: true });
    cleanupEmptyParents(path.dirname(stageRoot), path.join(home, STAGING_DIR, targetName));
    cleanupEmptyParents(path.dirname(displacedRoot), path.join(home, BACKUP_DIR, targetName));
  } catch (error) {
    for (const item of [...activated].reverse()) {
      fs.rmSync(item.active, { recursive: true, force: true });
    }
    for (const item of [...displaced].reverse()) {
      if (fs.existsSync(item.held)) fs.renameSync(item.held, item.active);
    }
    fs.rmSync(stageRoot, { recursive: true, force: true });
    fs.rmSync(displacedRoot, { recursive: true, force: true });
    cleanupEmptyParents(path.dirname(stageRoot), path.join(home, STAGING_DIR));
    cleanupEmptyParents(displacedRoot, path.join(home, BACKUP_DIR, targetName));
    throw error;
  } finally {
    release();
  }
  for (const name of names) process.stdout.write(`  [RESTORED] ${name}\n`);
  if (displaced.length) {
    process.stdout.write(`  [BACKUP] replaced current Skills -> ${displacedRoot.replace(/\\/g, '/')}\n`);
  }
  process.stdout.write('Restore complete. Run status; restored Skills are expected to report DRIFT.\n');
}

function inspectManifest(sourceRoot, skillsRoot, targetName) {
  const loaded = loadManifest(skillsRoot, targetName);
  const manifest = loaded.manifest;
  if (!manifest && loaded.state === 'missing') {
    return { state: 'UNMANAGED', version: '-', notes: [] };
  }
  if (!manifest) {
    return { state: 'DRIFT', version: '-', notes: loaded.notes };
  }
  let state = loaded.state === 'migrated-v1' ? 'OUTDATED' : 'CURRENT';
  const notes = [...loaded.notes];
  const managedSkills = manifest.managedSkills;
  const installedHashes = manifest.installedHashes;
  for (const name of managedSkills) {
    if (!safeManagedName(name)) {
      state = 'DRIFT';
      notes.push('invalid-managed-name');
      continue;
    }
    const installed = path.join(skillsRoot, name);
    if (!fs.existsSync(installed)) {
      state = 'DRIFT';
      notes.push(`missing:${name}`);
    } else if (installedHashes[name] !== hashTree(installed)) {
      state = 'DRIFT';
      notes.push(`modified:${name}`);
    }
  }
  if (sourceRoot && fs.existsSync(path.join(sourceRoot, 'skills'))) {
    const sourceHash = hashTree(path.join(sourceRoot, 'skills'));
    if (manifest.sourceTreeHash !== sourceHash) {
      if (state === 'CURRENT') state = 'OUTDATED';
      notes.push('source-tree-changed');
    }
  }
  return { state, version: manifest.sourceVersion || '-', notes };
}

function statusTarget(sourceRoot, home, targetName) {
  const target = TARGETS[targetName];
  const skillsRoot = path.resolve(home, target.dotDir, 'skills');
  const result = inspectManifest(sourceRoot, skillsRoot, targetName);
  if (result.state === 'UNMANAGED') {
    process.stdout.write(`${targetName}\tUNMANAGED\t${skillsRoot}\n`);
    return false;
  }
  process.stdout.write(`${targetName}\t${result.state}\t${result.version}\t${result.notes.join(',') || '-'}\n`);
  return result.state === 'CURRENT';
}

function doctor(sourceRoot, home, targets) {
  const skillOwners = new Map();
  const orderedTargets = Object.keys(TARGETS).filter((targetName) => targets.includes(targetName));
  for (const targetName of orderedTargets) {
    const target = TARGETS[targetName];
    const skillsRoot = path.resolve(home, target.dotDir, 'skills');
    const rootState = fs.existsSync(skillsRoot) && fs.statSync(skillsRoot).isDirectory() ? 'PRESENT' : 'MISSING';
    const rawManifest = loadManifest(skillsRoot, targetName).manifest;
    const manifest = inspectManifest(sourceRoot, skillsRoot, targetName);
    process.stdout.write(`ROOT\t${targetName}\t${rootState}\t${skillsRoot.replace(/\\/g, '/')}\n`);
    process.stdout.write(`MANIFEST\t${targetName}\t${manifest.state}\t${manifest.version}\t${manifest.notes.join(',') || '-'}\n`);
    if (rootState === 'MISSING') continue;
    const names = fs.readdirSync(skillsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name !== '.yan-backups')
      .map((entry) => entry.name)
      .sort();
    for (const name of names) {
      if (LEGACY_NAMES.has(name)) process.stdout.write(`LEGACY\t${targetName}\t${name}\tPRESENT\n`);
      if (!skillOwners.has(name)) skillOwners.set(name, []);
      const managed = Boolean(rawManifest
        && Array.isArray(rawManifest.managedSkills)
        && rawManifest.managedSkills.includes(name));
      skillOwners.get(name).push({
        target: targetName,
        managed,
        sourceTreeHash: managed ? rawManifest.sourceTreeHash || null : null,
      });
    }
  }
  for (const [name, owners] of [...skillOwners.entries()].sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))) {
    if (owners.length < 2) continue;
    const targetsText = owners.map((owner) => owner.target).join(',');
    const expectedMirror = owners.every((owner) => owner.managed)
      && owners.every((owner) => owner.sourceTreeHash)
      && new Set(owners.map((owner) => owner.sourceTreeHash)).size === 1;
    process.stdout.write(`${expectedMirror ? 'MIRROR' : 'DUPLICATE'}\t${name}\t${targetsText}\n`);
  }
}

const options = parseArgs(process.argv.slice(2));
const commands = ['install', 'status', 'doctor', 'backups', 'restore', 'backup-prune'];
if (!commands.includes(options.command)) {
  fail(
    'usage: install-core.js <install|status|doctor|backups|restore|backup-prune>'
    + ' --home <home> [--source <repo-root>] [--targets ...] [--dry-run]'
    + ' [--backup <snapshot-id>] [--skill <name>] [--keep <count>]',
  );
}
const homeInput = options.home || process.env.USERPROFILE || process.env.HOME;
if (!homeInput) fail('home directory is required');
const home = path.resolve(homeInput);
const targets = validateTargets(options.targets);

try {
  if (options.command === 'install') {
    if (!options.source) throw new Error('--source is required for install');
    if (options.migrateLegacy) {
      process.stderr.write(
        '[DEPRECATED] --migrate-legacy is no longer required; every install performs clean replacement.\n',
      );
    }
    const sourceRoot = path.resolve(options.source);
    const version = sourceVersion(sourceRoot, options.version);
    installTargets(sourceRoot, home, targets, version, Boolean(options.dryRun));
    if (!options.dryRun) {
      process.stdout.write('Done. Open a new host session if the current one does not refresh its skill catalog.\n');
    }
  } else if (options.command === 'status') {
    const sourceRoot = options.source ? path.resolve(options.source) : null;
    let current = true;
    for (const target of targets) current = statusTarget(sourceRoot, home, target) && current;
    process.exitCode = current ? 0 : 2;
  } else if (options.command === 'doctor') {
    doctor(options.source ? path.resolve(options.source) : null, home, targets);
  } else if (options.command === 'backups') {
    listBackups(home, targets);
  } else if (options.command === 'backup-prune') {
    pruneBackups(home, targets, parseKeep(options.keep), Boolean(options.dryRun));
  } else {
    if (targets.length !== 1) throw new Error('restore requires exactly one target');
    restoreBackup(home, targets[0], options.backup, options.skill, Boolean(options.dryRun));
  }
} catch (error) {
  fail(error.message);
}
