#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { TextDecoder } = require('util');

const root = path.resolve(__dirname, '..');
const skillsDir = path.join(root, 'skills');

function listFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(full));
    else files.push(full);
  }
  return files;
}

const skillNames = fs.readdirSync(skillsDir)
  .filter((name) => fs.existsSync(path.join(skillsDir, name, 'SKILL.md')))
  .sort();
const skillMarkdownFiles = listFiles(skillsDir)
  .filter((file) => file.endsWith('.md'))
  .sort();

let failed = false;

function fail(message) {
  failed = true;
  console.error('FAIL: ' + message);
}

function hasUtf8BomBytes(bytes) {
  return bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
}

function hasUtf8Bom(file) {
  return hasUtf8BomBytes(fs.readFileSync(file));
}

function isValidUtf8(bytes) {
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}

function readUtf8(file) {
  return fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
}

function duplicateKeys(lines, fieldPattern) {
  const seen = new Set();
  const duplicates = [];
  for (const line of lines) {
    const match = line.match(fieldPattern);
    if (!match) continue;
    const key = match[1];
    if (seen.has(key) && !duplicates.includes(key)) duplicates.push(key);
    seen.add(key);
  }
  return duplicates;
}

function duplicateFrontmatterKeys(body) {
  return duplicateKeys(body.split(/\r?\n/), /^([A-Za-z0-9_-]+):/);
}

function duplicateFlatYamlBlockKeys(text, blockName) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `${blockName}:` && !/^\s/.test(line));
  if (start === -1) return [];
  const directFields = [];
  let directIndent = null;
  for (const line of lines.slice(start + 1)) {
    if (line.trim() && !/^\s/.test(line)) break;
    const match = line.match(/^(\s+)([A-Za-z0-9_-]+):/);
    if (!match) continue;
    if (directIndent === null) directIndent = match[1];
    if (match[1] === directIndent) directFields.push(`${match[2]}:`);
  }
  return duplicateKeys(directFields, /^([A-Za-z0-9_-]+):/);
}

function parseFrontmatter(text, rel) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!match) {
    fail(`${rel} missing YAML frontmatter block`);
    return {};
  }
  for (const key of duplicateFrontmatterKeys(match[1])) {
    fail(`${rel} has duplicate YAML frontmatter field: ${key}`);
  }
  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (m && !Object.prototype.hasOwnProperty.call(fields, m[1])) fields[m[1]] = m[2].trim();
  }
  return fields;
}

function yamlScalarRaw(text, key) {
  const match = text.match(new RegExp(`^\\s*${key}:\\s*(.+)$`, 'm'));
  if (!match) return '';
  return match[1].trim();
}

function unquoteYamlScalar(raw, rel, key) {
  if (!raw) return '';
  const first = raw[0];
  if (first === '"' || first === "'") {
    if (!hasBalancedYamlScalar(raw)) {
      fail(`${rel} has an unbalanced quoted scalar for ${key}`);
      return '';
    }
    return raw.slice(1, -1);
  }
  return raw;
}

function yamlScalar(text, rel, key) {
  return unquoteYamlScalar(yamlScalarRaw(text, key), rel, key);
}

function hasBalancedYamlScalar(raw) {
  if (!raw) return true;
  const first = raw[0];
  return (first !== '"' && first !== "'") || (raw.length >= 2 && raw[raw.length - 1] === first);
}

function runSelfTest() {
  const cases = [
    ['plain text', true],
    ['"quoted text"', true],
    ["'quoted text'", true],
    ['"missing close', false],
    ["'missing close", false],
  ];
  for (const [raw, expected] of cases) {
    const actual = hasBalancedYamlScalar(raw);
    if (actual !== expected) fail(`self-test failed for scalar: ${raw}`);
  }
  const validUtf8Bom = Buffer.from([0xef, 0xbb, 0xbf, 0xe4, 0xb8, 0xad]);
  const invalidUtf8Bom = Buffer.from([0xef, 0xbb, 0xbf, 0xc3, 0x28]);
  if (!hasUtf8BomBytes(validUtf8Bom)) fail('self-test failed to detect a UTF-8 BOM');
  if (hasUtf8BomBytes(Buffer.from('plain text'))) fail('self-test reported a false UTF-8 BOM');
  if (!isValidUtf8(validUtf8Bom)) fail('self-test rejected valid UTF-8 bytes');
  if (isValidUtf8(invalidUtf8Bom)) fail('self-test accepted invalid UTF-8 bytes');
  const duplicateFrontmatter = duplicateFrontmatterKeys('name: alpha\ndescription: one\nname: beta');
  if (duplicateFrontmatter.length !== 1 || duplicateFrontmatter[0] !== 'name') {
    fail('self-test failed to detect a duplicate frontmatter key');
  }
  const duplicateInterface = duplicateFlatYamlBlockKeys([
    'interface:',
    '  display_name: "Alpha"',
    '  default_prompt: "one"',
    '  default_prompt: "two"',
    'policy:',
    '  allow_implicit_invocation: true',
  ].join('\n'), 'interface');
  if (duplicateInterface.length !== 1 || duplicateInterface[0] !== 'default_prompt') {
    fail('self-test failed to detect a duplicate interface key');
  }
  const separatedBlocks = [
    'interface:',
    '  enabled: true',
    'policy:',
    '  enabled: true',
  ].join('\n');
  if (duplicateFlatYamlBlockKeys(separatedBlocks, 'interface').length !== 0
    || duplicateFlatYamlBlockKeys(separatedBlocks, 'policy').length !== 0) {
    fail('self-test treated the same key in separate YAML blocks as a duplicate');
  }
  if (failed) process.exit(1);
  console.log('ok skill metadata parser and encoding self-test passed');
  process.exit(0);
}

if (process.argv.includes('--self-test')) runSelfTest();

for (const markdown of skillMarkdownFiles) {
  const rel = path.relative(root, markdown).replace(/\\/g, '/');
  const bytes = fs.readFileSync(markdown);
  if (!hasUtf8BomBytes(bytes)) fail(`${rel} must start with a UTF-8 BOM`);
  if (!isValidUtf8(bytes)) fail(`${rel} must contain valid UTF-8`);
}

for (const skill of skillNames) {
  const dir = path.join(skillsDir, skill);
  const skillMd = path.join(dir, 'SKILL.md');
  const reference = path.join(dir, 'reference.md');
  const evals = path.join(dir, 'evals.json');
  const openaiYaml = path.join(dir, 'agents', 'openai.yaml');

  const skillText = readUtf8(skillMd);
  const lineCount = skillText.split(/\r?\n/).length;
  if (lineCount > 500) fail(`skills/${skill}/SKILL.md should stay under 500 lines; got ${lineCount}`);
  const frontmatter = parseFrontmatter(skillText, `skills/${skill}/SKILL.md`);
  if (frontmatter.name !== skill) {
    fail(`skills/${skill}/SKILL.md name mismatch: got "${frontmatter.name || ''}", want "${skill}"`);
  }
  if (!frontmatter.description) fail(`skills/${skill}/SKILL.md missing description`);

  if (!fs.existsSync(reference)) fail(`skills/${skill}/reference.md is missing`);

  if (!fs.existsSync(evals)) fail(`skills/${skill}/evals.json is missing`);
  else if (hasUtf8Bom(evals)) fail(`skills/${skill}/evals.json must not start with a BOM`);

  if (!fs.existsSync(openaiYaml)) {
    fail(`skills/${skill}/agents/openai.yaml is missing`);
  } else {
    if (hasUtf8Bom(openaiYaml)) fail(`skills/${skill}/agents/openai.yaml must not start with a BOM`);
    const yaml = readUtf8(openaiYaml);
    const openaiRel = `skills/${skill}/agents/openai.yaml`;
    for (const blockName of ['interface', 'policy']) {
      for (const key of duplicateFlatYamlBlockKeys(yaml, blockName)) {
        fail(`${openaiRel} has duplicate ${blockName} field: ${key}`);
      }
    }
    for (const key of ['display_name', 'short_description', 'default_prompt']) {
      if (!yamlScalar(yaml, openaiRel, key)) fail(`${openaiRel} missing ${key}`);
    }
    const defaultPrompt = yamlScalar(yaml, openaiRel, 'default_prompt');
    if (!/(evidence|implementation|verified|unverified|missing|guess|finding|pending|证据|验证|待确认|材料不足)/i.test(defaultPrompt)) {
      fail(`skills/${skill}/agents/openai.yaml default_prompt should include an accuracy/evidence boundary`);
    }
    if (!/^policy:\s*$/m.test(yaml)) fail(`skills/${skill}/agents/openai.yaml missing policy block`);
    if (!/^\s*allow_implicit_invocation:\s*true\s*$/m.test(yaml)) {
      fail(`skills/${skill}/agents/openai.yaml must set allow_implicit_invocation: true`);
    }
  }
}

if (failed) process.exit(1);
console.log(`ok skill metadata checks passed (${skillNames.length} skills, ${skillMarkdownFiles.length} markdown files)`);
