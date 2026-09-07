#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const skillsDir = path.join(root, 'skills');

let failed = false;

function fail(message) {
  failed = true;
  console.error('FAIL: ' + message);
}

function read(rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) {
    fail(`missing file: ${rel}`);
    return '';
  }
  return fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
}

function parseFlatYamlBlock(text, rel, prefixPattern) {
  const fields = {};
  let inBlock = false;
  for (const line of text.split(/\r?\n/)) {
    if (prefixPattern.test(line)) {
      inBlock = true;
      continue;
    }
    if (inBlock && /^[^\s].*:\s*$/.test(line)) break;
    if (!inBlock) continue;
    const match = line.match(/^\s+([A-Za-z0-9_-]+):\s*(.*)$/);
    if (match) fields[match[1]] = unquoteYamlScalar(match[2].trim(), rel, match[1]);
  }
  if (!inBlock) fail(`${rel} missing expected YAML block`);
  return fields;
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

function hasBalancedYamlScalar(raw) {
  if (!raw) return true;
  const first = raw[0];
  return (first !== '"' && first !== "'") || (raw.length >= 2 && raw[raw.length - 1] === first);
}

function parseMarkdownTableRow(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return null;
  return trimmed.slice(1, -1).split('|').map((cell) => cell.trim());
}

function parseSkillTable(text, rel) {
  const errors = [];
  const rows = new Map();
  const lines = text.split(/\r?\n/);
  const sectionStart = lines.findIndex((line) => line.trim() === '## Skills');
  if (sectionStart === -1) {
    return { rows, errors: [`${rel} missing ## Skills section`] };
  }

  const sectionEndOffset = lines.slice(sectionStart + 1)
    .findIndex((line) => /^##\s+/.test(line.trim()));
  const sectionEnd = sectionEndOffset === -1
    ? lines.length
    : sectionStart + 1 + sectionEndOffset;
  const sectionLines = lines.slice(sectionStart + 1, sectionEnd);
  const headerIndex = sectionLines.findIndex((line) => {
    const cells = parseMarkdownTableRow(line);
    return cells && cells.join('|') === 'Skill|Entry point|Supporting files';
  });
  if (headerIndex === -1) {
    return { rows, errors: [`${rel} missing Skill inventory table header`] };
  }

  for (let index = headerIndex + 1; index < sectionLines.length; index += 1) {
    const cells = parseMarkdownTableRow(sectionLines[index]);
    if (!cells) {
      if (rows.size > 0) break;
      continue;
    }
    if (cells.every((cell) => /^:?-{3,}:?$/.test(cell))) continue;
    if (cells.length !== 3) {
      errors.push(`${rel} has malformed Skill table row at line ${sectionStart + index + 2}`);
      continue;
    }
    const skillMatch = cells[0].match(/^`([^`]+)`$/);
    if (!skillMatch) {
      errors.push(`${rel} has invalid Skill name cell at line ${sectionStart + index + 2}`);
      continue;
    }
    const skill = skillMatch[1];
    if (rows.has(skill)) {
      errors.push(`${rel} has duplicate Skill table row: ${skill}`);
      continue;
    }
    rows.set(skill, {
      entryPoint: cells[1],
      supportingFiles: cells[2],
    });
  }

  return { rows, errors };
}

function validateSkillTable(text, rel, expectedSkills, resourceExists) {
  const parsed = parseSkillTable(text, rel);
  const errors = [...parsed.errors];
  const expectedSet = new Set(expectedSkills);

  for (const documentedSkill of parsed.rows.keys()) {
    if (!expectedSet.has(documentedSkill)) {
      errors.push(`${rel} documents unknown Skill: ${documentedSkill}`);
    }
  }

  for (const skill of expectedSkills) {
    const row = parsed.rows.get(skill);
    if (!row) {
      errors.push(`${rel} missing Skill table row: ${skill}`);
      continue;
    }
    const expectedEntryPoint = `\`skills/${skill}/SKILL.md\``;
    if (row.entryPoint !== expectedEntryPoint) {
      errors.push(`${rel} has wrong entry point for ${skill}: got "${row.entryPoint}", want "${expectedEntryPoint}"`);
    }
    const actualExamples = resourceExists(skill, 'examples.md');
    const documentedExamples = row.supportingFiles.includes('`examples.md`');
    if (actualExamples !== documentedExamples) {
      const expectation = actualExamples ? 'declare' : 'omit';
      errors.push(`${rel} must ${expectation} examples.md for ${skill} to match the filesystem`);
    }
  }

  return errors;
}

function parseReadmeSkillIndex(text, rel) {
  const errors = [];
  const rows = new Map();
  const lines = text.split(/\r?\n/);
  const sectionStart = lines.findIndex((line) => line.trim() === '### 3. 选择 skill');
  if (sectionStart === -1) {
    return { rows, errors: [`${rel} missing ### 3. 选择 skill section`] };
  }

  const sectionEndOffset = lines.slice(sectionStart + 1)
    .findIndex((line) => /^#{1,3}\s+/.test(line.trim()));
  const sectionEnd = sectionEndOffset === -1
    ? lines.length
    : sectionStart + 1 + sectionEndOffset;
  const sectionLines = lines.slice(sectionStart + 1, sectionEnd);
  const headerIndex = sectionLines.findIndex((line) => {
    const cells = parseMarkdownTableRow(line);
    return cells && cells.join('|') === '你要做什么|用哪个 skill|主要产物';
  });
  if (headerIndex === -1) {
    return { rows, errors: [`${rel} missing Skill choice table header`] };
  }

  for (let index = headerIndex + 1; index < sectionLines.length; index += 1) {
    const cells = parseMarkdownTableRow(sectionLines[index]);
    if (!cells) {
      if (rows.size > 0) break;
      continue;
    }
    if (cells.every((cell) => /^:?-{3,}:?$/.test(cell))) continue;
    if (cells.length !== 3) {
      errors.push(`${rel} has malformed Skill choice row at line ${sectionStart + index + 2}`);
      continue;
    }
    const skillMatch = cells[1].match(/^`([^`]+)`$/);
    if (!skillMatch) {
      errors.push(`${rel} has invalid Skill choice cell at line ${sectionStart + index + 2}`);
      continue;
    }
    const skill = skillMatch[1];
    if (rows.has(skill)) {
      errors.push(`${rel} has duplicate Skill choice row: ${skill}`);
      continue;
    }
    rows.set(skill, { purpose: cells[0], output: cells[2] });
  }

  return { rows, errors };
}

function validateReadmeSkillIndex(text, rel, expectedSkills) {
  const parsed = parseReadmeSkillIndex(text, rel);
  const errors = [...parsed.errors];
  const expectedSet = new Set(expectedSkills);
  for (const documentedSkill of parsed.rows.keys()) {
    if (!expectedSet.has(documentedSkill)) {
      errors.push(`${rel} Skill choice table documents unknown Skill: ${documentedSkill}`);
    }
  }
  for (const skill of expectedSkills) {
    if (!parsed.rows.has(skill)) errors.push(`${rel} Skill choice table missing: ${skill}`);
  }
  return errors;
}

function parseWorkflowChainSection(text, rel, heading, expectedHeader) {
  const errors = [];
  const counts = new Map();
  const labels = new Set();
  const rows = [];
  const lines = text.split(/\r?\n/);
  const sectionStart = lines.findIndex((line) => line.trim() === heading);
  if (sectionStart === -1) {
    return { counts, labels, rows, errors: [`${rel} missing ${heading} section`] };
  }
  const sectionEndOffset = lines.slice(sectionStart + 1)
    .findIndex((line) => /^##\s+/.test(line.trim()));
  const sectionEnd = sectionEndOffset === -1
    ? lines.length
    : sectionStart + 1 + sectionEndOffset;
  const sectionLines = lines.slice(sectionStart + 1, sectionEnd);
  const headerIndex = sectionLines.findIndex((line) => {
    const cells = parseMarkdownTableRow(line);
    return cells && cells.join('|') === expectedHeader.join('|');
  });
  if (headerIndex === -1) {
    return { counts, labels, rows, errors: [`${rel} missing ${heading} table header`] };
  }

  for (let index = headerIndex + 1; index < sectionLines.length; index += 1) {
    const cells = parseMarkdownTableRow(sectionLines[index]);
    if (!cells) {
      if (labels.size > 0) break;
      continue;
    }
    if (cells.every((cell) => /^:?-{3,}:?$/.test(cell))) continue;
    if (cells.length !== expectedHeader.length) {
      errors.push(`${rel} has malformed ${heading} row at line ${sectionStart + index + 2}`);
      continue;
    }
    const skillMatch = cells[0].match(/^`([^`]+)`(?:（[^）]+）)?$/);
    if (!skillMatch) {
      errors.push(`${rel} has invalid Skill cell in ${heading} at line ${sectionStart + index + 2}`);
      continue;
    }
    if (labels.has(cells[0])) {
      errors.push(`${rel} has duplicate ${heading} row label: ${cells[0]}`);
      continue;
    }
    labels.add(cells[0]);
    const skill = skillMatch[1];
    counts.set(skill, (counts.get(skill) || 0) + 1);
    rows.push({ label: cells[0], cells });
  }
  return { counts, labels, rows, errors };
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

  const table = [
    '## Skills',
    '',
    '| Skill | Entry point | Supporting files |',
    '|-------|-------------|-----------------|',
    '| `alpha` | `skills/alpha/SKILL.md` | `reference.md`, `examples.md` |',
    '| `beta` | `skills/beta/SKILL.md` | `reference.md` |',
    '',
    '## Installation',
  ].join('\n');
  const resources = new Set(['alpha/reference.md', 'alpha/examples.md', 'beta/reference.md']);
  const resourceExists = (skill, file) => resources.has(`${skill}/${file}`);
  const parsed = parseSkillTable(table, 'TEST.md');
  if (parsed.errors.length > 0 || parsed.rows.size !== 2 || !parsed.rows.has('alpha')) {
    fail('self-test failed to parse the Skill inventory table');
  }
  const validErrors = validateSkillTable(table, 'TEST.md', ['alpha', 'beta'], resourceExists);
  if (validErrors.length > 0) {
    fail(`self-test rejected a valid Skill table: ${validErrors.join('; ')}`);
  }
  const missingExampleTable = table.replace(', `examples.md`', '');
  const invalidErrors = validateSkillTable(
    missingExampleTable,
    'TEST.md',
    ['alpha', 'beta'],
    resourceExists,
  );
  if (!invalidErrors.some((message) => message.includes('must declare examples.md for alpha'))) {
    fail('self-test did not reject an omitted examples.md declaration');
  }

  const readmeTable = [
    '### 3. 选择 skill',
    '',
    '| 你要做什么 | 用哪个 skill | 主要产物 |',
    '|------------|--------------|----------|',
    '| Alpha task | `alpha` | Alpha output |',
    '| Beta task | `beta` | Beta output |',
    '',
    '## 推荐工作流',
  ].join('\n');
  const parsedReadme = parseReadmeSkillIndex(readmeTable, 'README.md');
  if (parsedReadme.errors.length > 0 || parsedReadme.rows.size !== 2) {
    fail('self-test failed to parse the README Skill choice table');
  }
  const missingReadmeRow = readmeTable.replace('| Beta task | `beta` | Beta output |\n', '');
  const readmeErrors = validateReadmeSkillIndex(
    missingReadmeRow,
    'README.md',
    ['alpha', 'beta'],
  );
  if (!readmeErrors.some((message) => message.includes('Skill choice table missing: beta'))) {
    fail('self-test did not reject a missing README Skill choice row');
  }

  if (failed) process.exit(1);
  console.log('ok skill inventory parser self-test passed');
  process.exit(0);
}

if (process.argv.includes('--self-test')) runSelfTest();

function parseFrontmatter(text, rel) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!match) {
    fail(`${rel} missing YAML frontmatter block`);
    return {};
  }
  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const field = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (field) fields[field[1]] = field[2].trim();
  }
  return fields;
}

const skillNames = fs.readdirSync(skillsDir)
  .filter((name) => name !== '_shared')
  .filter((name) => fs.existsSync(path.join(skillsDir, name, 'SKILL.md')))
  .sort();

if (skillNames.length === 0) fail('no skills found under skills/');

const docs = [
  'README.md',
  'docs/workflow-guide.md',
  'AGENTS.md',
  'CLAUDE.md',
];
const docTextByRel = new Map(docs.map((rel) => [rel, read(rel)]));

for (const error of validateReadmeSkillIndex(
  docTextByRel.get('README.md'),
  'README.md',
  skillNames,
)) {
  fail(error);
}

for (const rel of ['AGENTS.md', 'CLAUDE.md']) {
  const errors = validateSkillTable(
    docTextByRel.get(rel),
    rel,
    skillNames,
    (skill, file) => fs.existsSync(path.join(skillsDir, skill, file)),
  );
  for (const error of errors) fail(error);
}

const rows = [];
const skillDescriptionRequirements = {
  'yan-dev-doc': ['需求和验收已清楚且用户要求直接实现时不要触发'],
  'yan-project-analysis': ['understanding', 'incident', 'business', 'code-reading', 'bug-fix', 'biz-flow'],
  'yan-code-review': ['check', 'repair', 'loop', 'package', 'review-check', 'review-repair', 'review-loop', 'review-fix'],
};
const agentPromptRequirements = {
  'yan-conversation-handoff': [
    'yan-dev-doc',
    'yan-project-analysis',
    'yan-code-review',
  ],
  'yan-dev-doc': [
    'Do not invoke it for a direct implementation request',
    'Publish the HTML board only',
    'yan-project-analysis',
    'yan-code-review',
  ],
  'yan-project-analysis': ['understanding', 'incident', 'business'],
  'yan-code-review': ['package', 'check', 'repair', 'loop'],
};

for (const skill of skillNames) {
  if (!skill.startsWith('yan-')) {
    fail(`public Skill directory must use yan- prefix: ${skill}`);
  }
  const skillRel = `skills/${skill}/SKILL.md`;
  const skillText = read(skillRel);
  const frontmatter = parseFrontmatter(skillText, skillRel);
  if (frontmatter.name !== skill) {
    fail(`${skillRel} name mismatch: got "${frontmatter.name || ''}", want "${skill}"`);
  }
  if (!frontmatter.description) fail(`${skillRel} missing description`);
  for (const needle of skillDescriptionRequirements[skill] || []) {
    if (!frontmatter.description.includes(needle)) {
      fail(`${skillRel} description missing routing boundary: ${needle}`);
    }
  }

  const agentRel = `skills/${skill}/agents/openai.yaml`;
  const agentText = read(agentRel);
  const agent = parseFlatYamlBlock(agentText, agentRel, /^interface:\s*$/);
  for (const field of ['display_name', 'short_description', 'default_prompt']) {
    if (!agent[field]) fail(`${agentRel} missing interface.${field}`);
  }
  if (agent.display_name && !agent.display_name.startsWith('Yan ')) {
    fail(`${agentRel} interface.display_name must use Yan prefix`);
  }
  for (const needle of agentPromptRequirements[skill] || []) {
    if (!agent.default_prompt.includes(needle)) {
      fail(`${agentRel} default_prompt missing routing boundary: ${needle}`);
    }
  }

  for (const [docRel, text] of docTextByRel.entries()) {
    if (!text.includes(`\`${skill}\``) && !text.includes(skill)) {
      fail(`${docRel} does not mention skill: ${skill}`);
    }
  }

  rows.push({
    skill,
    displayName: agent.display_name || '',
    hasExamples: fs.existsSync(path.join(skillsDir, skill, 'examples.md')),
  });
}

for (const required of ['yan-dev-doc', 'yan-project-analysis', 'yan-code-review', 'yan-conversation-handoff']) {
  if (!skillNames.includes(required)) fail(`required workflow skill missing: ${required}`);
}

if (failed) process.exit(1);

for (const row of rows) {
  const examples = row.hasExamples ? 'examples' : 'no-examples';
  console.log(`${row.skill}\t${row.displayName}\t${examples}`);
}
console.log(`ok skill inventory checks passed (${skillNames.length} skills)`);
