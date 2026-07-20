#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SHELL_FILES = [
  'index.html',
  'css/board.css',
  'js/board.js',
  'js/vendor/mermaid.min.js',
  'build.js',
  'board-add.js'
];
const CHECK_FILES = [
  'project-html/js/board.js',
  'project-html/build.js',
  'project-html/board-add.js',
  'project-html/data/changes.js',
  'skills/dev-doc/assets/board/js/board.js',
  'skills/dev-doc/assets/board/build.js',
  'skills/dev-doc/assets/board/board-add.js',
  'skills/dev-doc/assets/board/data/changes.js'
];

let failed = false;

function fail(message) {
  failed = true;
  console.error(message);
}

for (const file of SHELL_FILES) {
  const projectFile = path.join(ROOT, 'project-html', file);
  const templateFile = path.join(ROOT, 'skills/dev-doc/assets/board', file);
  const a = fs.existsSync(projectFile) ? fs.readFileSync(projectFile) : null;
  const b = fs.existsSync(templateFile) ? fs.readFileSync(templateFile) : null;
  if (!a || !b || !a.equals(b)) fail(`x shell out of sync: ${file}`);
}

for (const file of CHECK_FILES) {
  const result = spawnSync('node', ['--check', file], { cwd: ROOT, encoding: 'utf8' });
  if (result.status !== 0) {
    fail(`x syntax error: ${file}`);
    if (result.stdout) process.stderr.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
  }
}

const detailsDir = path.join(ROOT, 'project-html/data/details');
if (!fs.existsSync(detailsDir)) fail('x project-html/data/details is missing');
else {
  for (const name of fs.readdirSync(detailsDir).filter(name => name.endsWith('.js'))) {
    const file = path.join(detailsDir, name);
    const result = spawnSync('node', ['--check', file], { cwd: ROOT, encoding: 'utf8' });
    if (result.status !== 0) fail(`x syntax error: project-html/data/details/${name}`);
  }
}
if (!fs.existsSync(path.join(ROOT, 'skills/dev-doc/assets/board/data/details/.gitkeep'))) {
  fail('x template data/details/.gitkeep is missing');
}

const boardJs = fs.readFileSync(path.join(ROOT, 'project-html/js/board.js'), 'utf8');
const versionMatch = boardJs.match(/BOARD_VERSION\s*=\s*(\d+)/);
if (!versionMatch) fail('x project-html/js/board.js is missing BOARD_VERSION');

const projectData = fs.readFileSync(path.join(ROOT, 'project-html/data/changes.js'), 'utf8');
const templateData = fs.readFileSync(path.join(ROOT, 'skills/dev-doc/assets/board/data/changes.js'), 'utf8');
for (const marker of ['在此行上方追加变更日志', '在此行上方追加新记录']) {
  if (!projectData.includes(marker)) fail(`x project-html/data/changes.js missing marker: ${marker}`);
  if (!templateData.includes(marker)) fail(`x template data/changes.js missing marker: ${marker}`);
}
if (/^\s*service:\s*"/m.test(templateData) || /^\s*\{\s*date:\s*"/m.test(templateData)) {
  fail('x template data/changes.js must stay empty; do not ship demo entries in the board template');
}

if (failed) process.exit(1);
console.log(`ok board sync and syntax checks passed (${versionMatch ? `BOARD_VERSION = ${versionMatch[1]}` : 'BOARD_VERSION unknown'})`);
