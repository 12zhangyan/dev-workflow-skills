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
  'skills/dev-doc/assets/board/board-add.js'
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

const boardJs = fs.readFileSync(path.join(ROOT, 'project-html/js/board.js'), 'utf8');
const versionMatch = boardJs.match(/BOARD_VERSION\s*=\s*(\d+)/);
if (!versionMatch) fail('x project-html/js/board.js is missing BOARD_VERSION');

if (failed) process.exit(1);
console.log(`ok board sync and syntax checks passed (${versionMatch ? `BOARD_VERSION = ${versionMatch[1]}` : 'BOARD_VERSION unknown'})`);
