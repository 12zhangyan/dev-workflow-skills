#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const skillsDir = path.join(root, 'skills');
const skillNames = fs.readdirSync(skillsDir)
  .filter((name) => fs.existsSync(path.join(skillsDir, name, 'SKILL.md')))
  .sort();

let failed = false;

function fail(message) {
  failed = true;
  console.error('FAIL: ' + message);
}

function hasUtf8Bom(file) {
  const bytes = fs.readFileSync(file);
  return bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
}

function readUtf8(file) {
  return fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
}

function parseFrontmatter(text, rel) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!match) {
    fail(`${rel} missing YAML frontmatter block`);
    return {};
  }
  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (m) fields[m[1]] = m[2].trim();
  }
  return fields;
}

function yamlScalar(text, key) {
  const match = text.match(new RegExp(`^\\s*${key}:\\s*(.+)$`, 'm'));
  if (!match) return '';
  return match[1].trim().replace(/^["']|["']$/g, '');
}

for (const skill of skillNames) {
  const dir = path.join(skillsDir, skill);
  const skillMd = path.join(dir, 'SKILL.md');
  const reference = path.join(dir, 'reference.md');
  const evals = path.join(dir, 'evals.json');
  const openaiYaml = path.join(dir, 'agents', 'openai.yaml');

  if (!hasUtf8Bom(skillMd)) fail(`skills/${skill}/SKILL.md must start with a UTF-8 BOM`);
  const skillText = readUtf8(skillMd);
  const lineCount = skillText.split(/\r?\n/).length;
  if (lineCount > 500) fail(`skills/${skill}/SKILL.md should stay under 500 lines; got ${lineCount}`);
  const frontmatter = parseFrontmatter(skillText, `skills/${skill}/SKILL.md`);
  if (frontmatter.name !== skill) {
    fail(`skills/${skill}/SKILL.md name mismatch: got "${frontmatter.name || ''}", want "${skill}"`);
  }
  if (!frontmatter.description) fail(`skills/${skill}/SKILL.md missing description`);

  if (!fs.existsSync(reference)) fail(`skills/${skill}/reference.md is missing`);
  else if (!hasUtf8Bom(reference)) fail(`skills/${skill}/reference.md must start with a UTF-8 BOM`);

  const examples = path.join(dir, 'examples.md');
  if (fs.existsSync(examples) && !hasUtf8Bom(examples)) {
    fail(`skills/${skill}/examples.md must start with a UTF-8 BOM`);
  }

  if (!fs.existsSync(evals)) fail(`skills/${skill}/evals.json is missing`);
  else if (hasUtf8Bom(evals)) fail(`skills/${skill}/evals.json must not start with a BOM`);

  if (!fs.existsSync(openaiYaml)) {
    fail(`skills/${skill}/agents/openai.yaml is missing`);
  } else {
    if (hasUtf8Bom(openaiYaml)) fail(`skills/${skill}/agents/openai.yaml must not start with a BOM`);
    const yaml = readUtf8(openaiYaml);
    for (const key of ['display_name', 'short_description', 'default_prompt']) {
      if (!yamlScalar(yaml, key)) fail(`skills/${skill}/agents/openai.yaml missing ${key}`);
    }
    const defaultPrompt = yamlScalar(yaml, 'default_prompt');
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
console.log(`ok skill metadata checks passed (${skillNames.length} skills)`);
