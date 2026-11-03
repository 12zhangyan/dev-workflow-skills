#!/usr/bin/env node
'use strict';

// Guards the hard behavior invariants and contract tokens registered in scripts/invariants.json.
// Invariants match per sentence with keyword regexes, so equivalent rewording keeps passing;
// wording and non-safety guidance are left to evals.
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const registryRel = 'scripts/invariants.json';
const CJK = /[㐀-鿿]/;

function loadRegistry() {
  return JSON.parse(fs.readFileSync(path.join(root, registryRel), 'utf8').replace(/^﻿/, ''));
}

function sentences(text) {
  return text.split(/[。；;\n]/);
}

function sentenceMatches(text, patterns) {
  const regexes = patterns.map((source) => new RegExp(source));
  return sentences(text).some((sentence) => regexes.every((regex) => regex.test(sentence)));
}

// Returns error strings; readText(rel) returns the file text or null when missing.
function evaluate(registry, readText) {
  const errors = [];
  const ids = new Set();
  for (const invariant of registry.invariants || []) {
    if (!invariant.id || ids.has(invariant.id)) errors.push(`${registryRel} invariant id missing or duplicated: ${invariant.id}`);
    ids.add(invariant.id);
    if (!invariant.why || !Array.isArray(invariant.files) || !invariant.files.length || !Array.isArray(invariant.sentence) || !invariant.sentence.length) {
      errors.push(`${registryRel} invariant ${invariant.id} needs why, files and sentence`);
      continue;
    }
    for (const rel of invariant.files) {
      const text = readText(rel);
      if (text === null) errors.push(`${rel} missing (invariant ${invariant.id})`);
      else if (!sentenceMatches(text, invariant.sentence)) {
        errors.push(`${rel} lost invariant ${invariant.id}: ${invariant.why} (no sentence matches ${invariant.sentence.map((s) => `/${s}/`).join(' + ')})`);
      }
    }
  }
  for (const contract of registry.contracts || []) {
    const text = readText(contract.file);
    if (text === null) {
      errors.push(`${contract.file} missing (contract tokens)`);
      continue;
    }
    for (const token of contract.tokens || []) {
      if (CJK.test(token)) errors.push(`${registryRel} contract token for ${contract.file} is prose, not an identifier: ${token}`);
      else if (!text.includes(token)) errors.push(`${contract.file} missing contract token: ${token}`);
    }
  }
  for (const rule of registry.forbidden || []) {
    const text = readText(rule.file);
    if (text !== null && new RegExp(rule.pattern).test(text)) errors.push(`${rule.file} matches forbidden /${rule.pattern}/: ${rule.why}`);
  }
  return errors;
}

function readFromDisk(rel) {
  const file = path.join(root, rel);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').replace(/^﻿/, '') : null;
}

function runSelfTest() {
  const registry = loadRegistry();
  const problems = [];
  if (evaluate(registry, readFromDisk).length) problems.push('current tree does not pass; fix it before running the self-test');
  // Dropping every matching sentence from one file must trip that invariant.
  for (const invariant of registry.invariants) {
    const target = invariant.files[0];
    const regexes = invariant.sentence.map((source) => new RegExp(source));
    const stripped = sentences(readFromDisk(target) || '').filter((sentence) => !regexes.every((regex) => regex.test(sentence))).join('\n');
    const errors = evaluate({ invariants: [invariant] }, (rel) => (rel === target ? stripped : readFromDisk(rel)));
    if (!errors.some((error) => error.includes(`lost invariant ${invariant.id}`))) problems.push(`removing ${invariant.id} from ${target} went unnoticed`);
  }
  // Equivalent rewording keeps passing; prose tokens and forbidden flows are rejected.
  const reworded = evaluate({ invariants: [{ id: 'demo', why: 'demo', files: ['a.md'], sentence: ['数据库', '只读'] }] }, () => '本技能对数据库始终保持只读访问。');
  if (reworded.length) problems.push('equivalent rewording was rejected');
  const prose = evaluate({ contracts: [{ file: 'a.md', tokens: ['不回显值'] }] }, () => '不回显值');
  if (!prose.some((error) => error.includes('is prose'))) problems.push('a CJK prose contract token was accepted');
  const flow = evaluate({ forbidden: [{ file: 'a.md', pattern: '每次只问一个', why: 'demo' }] }, () => '每次只问一个问题');
  if (!flow.length) problems.push('a forbidden pattern was not reported');
  if (problems.length) {
    for (const problem of problems) console.error('FAIL: ' + problem);
    process.exit(1);
  }
  console.log(`ok invariant self-test passed (${registry.invariants.length} invariants mutated)`);
  process.exit(0);
}

if (process.argv.includes('--self-test')) runSelfTest();

const registry = loadRegistry();
const errors = evaluate(registry, readFromDisk);
for (const error of errors) console.error('FAIL: ' + error);
if (errors.length) process.exit(1);
const tokenCount = (registry.contracts || []).reduce((sum, contract) => sum + contract.tokens.length, 0);
console.log(`ok ${registry.invariants.length} behavior invariants and ${tokenCount} contract tokens hold`);
