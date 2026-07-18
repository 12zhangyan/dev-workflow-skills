#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
let failed = false;

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

requireText('install.sh', [
  'claude cursor codex',
  'normalize_codex_skill',
  'if [ "$target" = "codex" ]',
  'SKILL.md',
  '\\xef\\xbb\\xbf',
  'npx superpowers-zh'
]);

requireText('install.ps1', [
  '@("claude", "cursor", "codex")',
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

if (failed) process.exit(1);
console.log('ok installer checks passed');
