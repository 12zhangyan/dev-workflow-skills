#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const DISTRIBUTION = 'dev-workflow-skills';
const MANIFEST = '.yan-dev-workflow-skills.json';
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

function readManifest(skillsRoot) {
  const file = path.join(skillsRoot, MANIFEST);
  if (!fs.existsSync(file)) return null;
  try {
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    return value.distribution === DISTRIBUTION ? value : null;
  } catch (_error) {
    return null;
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

function backupDirectory(skillsRoot, name, reason) {
  const source = path.join(skillsRoot, name);
  if (!fs.existsSync(source)) return null;
  const backupRoot = path.join(skillsRoot, '.yan-backups', timestamp());
  fs.mkdirSync(backupRoot, { recursive: true });
  let destination = path.join(backupRoot, name);
  let suffix = 2;
  while (fs.existsSync(destination)) destination = path.join(backupRoot, `${name}-${suffix++}`);
  fs.renameSync(source, destination);
  process.stdout.write(`  [BACKUP] ${name} (${reason}) -> ${path.relative(skillsRoot, destination).replace(/\\/g, '/')}\n`);
  return destination;
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

function installTarget(sourceRoot, home, targetName, version, migrateLegacy) {
  const target = TARGETS[targetName];
  const skillsRoot = path.resolve(home, target.dotDir, 'skills');
  const expectedRoot = path.resolve(home, target.dotDir);
  const relative = path.relative(expectedRoot, skillsRoot);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    fail(`unsafe skills target for ${targetName}: ${skillsRoot}`);
  }
  fs.mkdirSync(skillsRoot, { recursive: true });
  const previous = readManifest(skillsRoot);
  const names = sourceSkillNames(sourceRoot);
  const previousHashes = previous && previous.installedHashes ? previous.installedHashes : {};

  process.stdout.write(`==> ${target.label}: ${skillsRoot}\n`);

  const removedManaged = previous && Array.isArray(previous.managedSkills)
    ? previous.managedSkills.filter((name) => safeManagedName(name) && !names.includes(name))
    : [];
  for (const name of removedManaged) {
    if (fs.existsSync(path.join(skillsRoot, name))) {
      backupDirectory(skillsRoot, name, 'removed from current distribution');
    }
  }

  const preservedLegacy = [];
  for (const legacy of LEGACY_NAMES) {
    const legacyPath = path.join(skillsRoot, legacy);
    if (!fs.existsSync(legacyPath)) continue;
    const previouslyManaged = previous && Array.isArray(previous.managedLegacy)
      && previous.managedLegacy.includes(legacy);
    if (previouslyManaged) {
      backupDirectory(skillsRoot, legacy, 'managed legacy migration');
    } else if (migrateLegacy) {
      backupDirectory(skillsRoot, legacy, 'explicit legacy migration');
    } else {
      preservedLegacy.push(legacy);
      process.stdout.write(`  [KEEP] ${legacy} (unowned legacy name; use --migrate-legacy to back it up)\n`);
    }
  }

  const installedHashes = {};
  for (const name of names) {
    const source = path.join(sourceRoot, 'skills', name);
    const destination = path.join(skillsRoot, name);
    if (fs.existsSync(destination)) {
      const currentHash = hashTree(destination);
      if (previousHashes[name] && previousHashes[name] === currentHash) {
        fs.rmSync(destination, { recursive: true, force: true });
      } else {
        backupDirectory(skillsRoot, name, previousHashes[name] ? 'locally modified managed skill' : 'pre-manifest skill');
      }
    }
    copySkill(source, destination, target.stripSkillBom);
    installedHashes[name] = hashTree(destination);
    process.stdout.write(`  [OK] ${name}\n`);
  }

  const manifest = {
    schemaVersion: 1,
    distribution: DISTRIBUTION,
    target: targetName,
    sourceVersion: version,
    sourceTreeHash: hashTree(path.join(sourceRoot, 'skills')),
    installedAt: new Date().toISOString(),
    managedSkills: names,
    installedHashes,
    managedLegacy: [],
    preservedLegacy,
  };
  fs.writeFileSync(path.join(skillsRoot, MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  process.stdout.write(`  [MANIFEST] ${MANIFEST}\n\n`);
}

function statusTarget(sourceRoot, home, targetName) {
  const target = TARGETS[targetName];
  const skillsRoot = path.resolve(home, target.dotDir, 'skills');
  const manifest = readManifest(skillsRoot);
  if (!manifest) {
    process.stdout.write(`${targetName}\tUNMANAGED\t${skillsRoot}\n`);
    return false;
  }
  let state = 'CURRENT';
  const notes = [];
  const managedSkills = Array.isArray(manifest.managedSkills) ? manifest.managedSkills : [];
  const installedHashes = manifest.installedHashes && typeof manifest.installedHashes === 'object'
    ? manifest.installedHashes
    : {};
  if (!Array.isArray(manifest.managedSkills)) {
    state = 'DRIFT';
    notes.push('invalid-managed-skills');
  }
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
  process.stdout.write(`${targetName}\t${state}\t${manifest.sourceVersion}\t${notes.join(',') || '-'}\n`);
  return state === 'CURRENT';
}

const options = parseArgs(process.argv.slice(2));
if (!['install', 'status'].includes(options.command)) {
  fail('usage: install-core.js <install|status> --source <repo-root> --home <home> [--targets ...] [--migrate-legacy]');
}
const home = path.resolve(options.home || process.env.USERPROFILE || process.env.HOME || '');
if (!home) fail('home directory is required');
const targets = validateTargets(options.targets);

if (options.command === 'install') {
  if (!options.source) fail('--source is required for install');
  const sourceRoot = path.resolve(options.source);
  const version = sourceVersion(sourceRoot, options.version);
  for (const target of targets) installTarget(sourceRoot, home, target, version, options.migrateLegacy);
  process.stdout.write('Done. Open a new host session if the current one does not refresh its skill catalog.\n');
} else {
  const sourceRoot = options.source ? path.resolve(options.source) : null;
  let current = true;
  for (const target of targets) current = statusTarget(sourceRoot, home, target) && current;
  process.exitCode = current ? 0 : 2;
}
