#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function fail(message) {
  process.stderr.write(`ERROR: ${message}\n`);
  process.exit(1);
}

function todayLocal() {
  const now = new Date();
  const year = String(now.getFullYear()).padStart(4, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function findVcs(start) {
  let current = path.resolve(start || process.cwd());
  while (true) {
    if (fs.existsSync(path.join(current, '.git'))) return { type: 'git', root: current };
    if (fs.existsSync(path.join(current, '.svn'))) return { type: 'svn', root: current };
    const parent = path.dirname(current);
    if (parent === current) return { type: 'none', root: path.resolve(start || process.cwd()) };
    current = parent;
  }
}

function skillRoots() {
  const home = process.env.USERPROFILE || process.env.HOME || '';
  return [
    path.resolve(__dirname, '..', '..'),
    process.env.DEV_WORKFLOW_SKILLS_ROOT,
    home && path.join(home, '.claude', 'skills'),
    home && path.join(home, '.cursor', 'skills'),
    home && path.join(home, '.codex', 'skills'),
    home && path.join(home, '.agents', 'skills'),
  ].filter(Boolean);
}

const [command, ...args] = process.argv.slice(2);

if (command === 'prepare-date-dir') {
  if (args.length !== 1 || !args[0]) fail('usage: prepare-date-dir <base-directory>');
  const relative = path.join(args[0], todayLocal());
  fs.mkdirSync(relative, { recursive: true });
  process.stdout.write(relative.replace(/\\/g, '/') + '\n');
} else if (command === 'exists') {
  if (args.length !== 1 || !args[0]) fail('usage: exists <path>');
  process.stdout.write(fs.existsSync(args[0]) ? 'EXISTS\n' : 'MISSING\n');
} else if (command === 'file-state') {
  if (args.length !== 1 || !args[0]) fail('usage: file-state <path>');
  if (!fs.existsSync(args[0])) {
    process.stdout.write('MISSING\n');
  } else {
    try {
      const stat = fs.statSync(args[0]);
      if (!stat.isFile()) throw new Error('target is not a regular file');
      const descriptor = fs.openSync(args[0], 'r');
      fs.closeSync(descriptor);
      process.stdout.write('EXISTS_READABLE\n');
    } catch (_error) {
      process.stdout.write('EXISTS_UNREADABLE_OR_UNKNOWN\n');
    }
  }
} else if (command === 'ensure-dir') {
  if (args.length !== 1 || !args[0]) fail('usage: ensure-dir <directory>');
  fs.mkdirSync(args[0], { recursive: true });
  process.stdout.write(args[0].replace(/\\/g, '/') + '\n');
} else if (command === 'detect-vcs') {
  if (args.length > 1) fail('usage: detect-vcs [start-directory]');
  const result = findVcs(args[0]);
  process.stdout.write(JSON.stringify({ ...result, root: result.root.replace(/\\/g, '/') }) + '\n');
} else if (command === 'resolve-skill-file') {
  if (args.length !== 2 || !args[0] || !args[1]) fail('usage: resolve-skill-file <skill-name> <relative-path>');
  for (const skillsRoot of skillRoots()) {
    const candidate = path.join(skillsRoot, args[0], args[1]);
    if (fs.existsSync(candidate)) {
      process.stdout.write(path.resolve(candidate).replace(/\\/g, '/') + '\n');
      process.exit(0);
    }
  }
  fail(`skill file not found: ${args[0]}/${args[1]}`);
} else if (command === 'contains') {
  if (args.length !== 2 || !args[0]) fail('usage: contains <file> <text>');
  if (!fs.existsSync(args[0])) fail(`file not found: ${args[0]}`);
  process.stdout.write(fs.readFileSync(args[0], 'utf8').includes(args[1]) ? 'YES\n' : 'NO\n');
} else {
  fail('commands: prepare-date-dir, exists, file-state, ensure-dir, detect-vcs, resolve-skill-file, contains');
}
