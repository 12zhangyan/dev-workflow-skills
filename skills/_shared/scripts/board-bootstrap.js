#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function fail(message) {
  process.stderr.write(`BOARD_TEMPLATE_ERROR: ${message}\n`);
  process.exit(1);
}

function candidateTemplates() {
  const home = process.env.USERPROFILE || process.env.HOME || '';
  return [
    path.resolve(__dirname, '..', '..', 'yan-dev-doc', 'assets', 'board'),
    process.env.DEV_WORKFLOW_SKILLS_BOARD_TEMPLATE,
    home && path.join(home, '.claude', 'skills', 'yan-dev-doc', 'assets', 'board'),
    home && path.join(home, '.cursor', 'skills', 'yan-dev-doc', 'assets', 'board'),
    home && path.join(home, '.codex', 'skills', 'yan-dev-doc', 'assets', 'board'),
    home && path.join(home, '.agents', 'skills', 'yan-dev-doc', 'assets', 'board'),
  ].filter(Boolean);
}

function templateRoot() {
  const found = candidateTemplates().find((candidate) => fs.existsSync(path.join(candidate, 'js', 'board.js')));
  if (!found) fail('yan-dev-doc/assets/board not found');
  return found;
}

function versionOf(file) {
  if (!fs.existsSync(file)) return null;
  const match = fs.readFileSync(file, 'utf8').match(/BOARD_VERSION[ \t]*=[ \t]*(\d+)/);
  return match ? Number(match[1]) : null;
}

function copyFile(sourceRoot, targetRoot, rel) {
  const source = path.join(sourceRoot, ...rel.split('/'));
  const target = path.join(targetRoot, ...rel.split('/'));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

const SHELL_FILES = [
  'index.html', 'css/board.css', 'js/board.js', 'js/vendor/mermaid.min.js',
  'build.js', 'board-add.js',
];
const USAGE = 'usage: node board-bootstrap.js <status|sync> [project-directory]';
const [command, projectArg = '.', ...extra] = process.argv.slice(2);
if (extra.length) fail(USAGE);
if (['help', '--help', '-h'].includes(command)) {
  process.stdout.write(USAGE + '\nstatus is read-only. sync upgrades an older shell to the template version: shell files only,'
    + ' never data/, never a downgrade; replaced files are backed up under project-html/.shell-backup/.\n');
  process.exit(0);
}
if (!['status', 'sync'].includes(command)) fail(USAGE);
const source = templateRoot();
const project = path.resolve(projectArg);
const target = path.join(project, 'project-html');
const templateVersion = versionOf(path.join(source, 'js', 'board.js'));
if (templateVersion === null) fail('BOARD_VERSION missing from template');

if (command === 'status') {
  const projectVersion = versionOf(path.join(target, 'js', 'board.js'));
  process.stdout.write(`PROJECT_BOARD_VERSION=${projectVersion === null ? 'MISSING' : projectVersion}\n`);
  process.stdout.write(`TEMPLATE_BOARD_VERSION=${templateVersion}\n`);
  const missing = SHELL_FILES.filter(rel => !fs.existsSync(path.join(target, rel)));
  if (missing.length) process.stdout.write('BOARD_SHELL_MISSING_FILES=' + missing.join(',') + '\n');
  const state = !fs.existsSync(target) ? 'BOARD_SHELL_INIT_REQUIRED'
    : missing.length ? 'BOARD_SHELL_INCOMPLETE'
    : projectVersion === null ? 'BOARD_SHELL_VERSION_UNKNOWN'
    : projectVersion < templateVersion ? 'BOARD_SHELL_UPGRADE_AVAILABLE'
    : 'BOARD_SHELL_CURRENT';
  process.stdout.write(state + '\n');
} else if (command === 'sync') {
  const projectVersion = versionOf(path.join(target, 'js', 'board.js'));
  if (projectVersion !== null && projectVersion > templateVersion) fail('BOARD_SHELL_DOWNGRADE_REFUSED');
  // 被替换的旧外壳文件先备份：未纳管的看板没有 VCS 可回退，升级必须可还原。
  const replaced = SHELL_FILES.filter((rel) => {
    const current = path.join(target, ...rel.split('/'));
    return fs.existsSync(current) && !fs.readFileSync(current).equals(fs.readFileSync(path.join(source, ...rel.split('/'))));
  });
  if (replaced.length) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupRel = `.shell-backup/v${projectVersion === null ? 'unknown' : projectVersion}-${stamp}`;
    for (const rel of replaced) copyFile(target, path.join(target, ...backupRel.split('/')), rel);
    process.stdout.write(`BOARD_SHELL_BACKUP=project-html/${backupRel}\n`);
    process.stdout.write(`BOARD_SHELL_REPLACED=${replaced.join(',')}\n`);
  }
  for (const rel of SHELL_FILES) copyFile(source, target, rel);
  fs.mkdirSync(path.join(target, 'data', 'details'), { recursive: true });
  const changes = path.join(target, 'data', 'changes.js');
  if (!fs.existsSync(changes)) copyFile(source, target, 'data/changes.js');
  const ignore = path.join(target, '.gitignore');
  if (!fs.existsSync(ignore)) {
    fs.writeFileSync(ignore, [
      '# 由 build.js / board-add.js 生成或临时使用；data/changes.js 与 data/details/ 是需要保留的看板数据。',
      'pages/', 'exports/', 'data/changes.js.bak', 'data/changes.js.lock', 'data/.entry-*/', '.shell-backup/', '',
    ].join('\n'), { flag: 'wx' });
  }
  process.stdout.write(`BOARD_SHELL_SYNCED=${templateVersion}\n`);
}
