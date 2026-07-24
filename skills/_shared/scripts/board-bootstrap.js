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

const [command, projectArg = '.'] = process.argv.slice(2);
const source = templateRoot();
const project = path.resolve(projectArg);
const target = path.join(project, 'project-html');
const templateVersion = versionOf(path.join(source, 'js', 'board.js'));
if (templateVersion === null) fail('BOARD_VERSION missing from template');

if (command === 'status') {
  const projectVersion = versionOf(path.join(target, 'js', 'board.js'));
  process.stdout.write(`PROJECT_BOARD_VERSION=${projectVersion === null ? 'MISSING' : projectVersion}\n`);
  process.stdout.write(`TEMPLATE_BOARD_VERSION=${templateVersion}\n`);
  process.stdout.write(projectVersion === null || projectVersion < templateVersion
    ? 'BOARD_SHELL_UPGRADE_REQUIRED\n'
    : 'BOARD_SHELL_CURRENT\n');
} else if (command === 'sync') {
  for (const rel of [
    'index.html',
    'css/board.css',
    'js/board.js',
    'js/vendor/mermaid.min.js',
    'build.js',
    'board-add.js',
  ]) copyFile(source, target, rel);
  fs.mkdirSync(path.join(target, 'data', 'details'), { recursive: true });
  const changes = path.join(target, 'data', 'changes.js');
  if (!fs.existsSync(changes)) copyFile(source, target, 'data/changes.js');
  process.stdout.write(`BOARD_SHELL_SYNCED=${templateVersion}\n`);
} else {
  fail('usage: board-bootstrap.js <status|sync> [project-directory]');
}
