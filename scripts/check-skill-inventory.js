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
    if (!row.supportingFiles.includes('`reference.md`')) {
      errors.push(`${rel} supporting files missing reference.md for ${skill}`);
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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function commandReferencesSkill(command, skill) {
  const escaped = escapeRegExp(skill);
  const slashInvocation = new RegExp('(?:^|[\\s`，、；;])/' + escaped + '(?=[\\s`<]|$)');
  const naturalInvocation = new RegExp('\\b' + escaped + ' skill\\b');
  return slashInvocation.test(command) || naturalInvocation.test(command);
}

function validateWorkflowChainInventory(text, rel, expectedSkills, requiredNextStepLabels = []) {
  const responsibilities = parseWorkflowChainSection(
    text,
    rel,
    '## skill 一句话职责',
    ['skill', '阶段', '做什么', '会改代码吗'],
  );
  const nextSteps = parseWorkflowChainSection(
    text,
    rel,
    '## 下一步映射（谁 → 下一步 + 可复制命令）',
    ['当前完成', '默认下一步', 'Claude Code', 'Codex'],
  );
  const errors = [...responsibilities.errors, ...nextSteps.errors];
  const expectedSet = new Set(expectedSkills);

  for (const [skill, count] of responsibilities.counts) {
    if (!expectedSet.has(skill)) errors.push(`${rel} responsibilities table documents unknown Skill: ${skill}`);
    if (count !== 1) errors.push(`${rel} responsibilities table must list ${skill} exactly once; got ${count}`);
  }
  for (const skill of nextSteps.counts.keys()) {
    if (!expectedSet.has(skill)) errors.push(`${rel} next-step table documents unknown Skill: ${skill}`);
  }
  for (const skill of expectedSkills) {
    if (!responsibilities.counts.has(skill)) errors.push(`${rel} responsibilities table missing: ${skill}`);
    if (!nextSteps.counts.has(skill)) errors.push(`${rel} next-step table missing: ${skill}`);
  }
  for (const label of requiredNextStepLabels) {
    if (!nextSteps.labels.has(label)) errors.push(`${rel} next-step table missing required row label: ${label}`);
  }
  for (const row of nextSteps.rows) {
    const targets = [...row.cells[1].matchAll(/`([^`]+)`/g)]
      .map((match) => match[1])
      .filter((skill) => expectedSet.has(skill));
    for (const target of targets) {
      for (const [columnIndex, host] of [[2, 'Claude Code'], [3, 'Codex']]) {
        if (!commandReferencesSkill(row.cells[columnIndex], target)) {
          errors.push(`${rel} next-step row ${row.label} ${host} command missing Skill target: ${target}`);
        }
      }
    }
  }
  return errors;
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

  const workflowChain = [
    '## skill 一句话职责',
    '',
    '| skill | 阶段 | 做什么 | 会改代码吗 |',
    '|-------|------|--------|-----------|',
    '| `alpha` | Plan | Alpha | 否 |',
    '| `beta` | Review | Beta | 是 |',
    '',
    '## 下一步映射（谁 → 下一步 + 可复制命令）',
    '',
    '| 当前完成 | 默认下一步 | Claude Code | Codex |',
    '|----------|-----------|-------------|-------|',
    '| `alpha` | `beta` | `/beta <input>` | `使用 beta skill 继续` |',
    '| `beta`（首轮） | Alpha | alpha | alpha |',
    '| `beta`（复验） | 人工 | 人工 | 人工 |',
    '',
    '## 其他',
  ].join('\n');
  const chainErrors = validateWorkflowChainInventory(
    workflowChain,
    'skills/_shared/workflow-chain.md',
    ['alpha', 'beta'],
    ['`beta`（首轮）', '`beta`（复验）'],
  );
  if (chainErrors.length > 0) {
    fail(`self-test rejected a valid workflow chain: ${chainErrors.join('; ')}`);
  }
  const missingChainRow = workflowChain.replace('| `alpha` | `beta` | `/beta <input>` | `使用 beta skill 继续` |\n', '');
  const missingChainErrors = validateWorkflowChainInventory(
    missingChainRow,
    'skills/_shared/workflow-chain.md',
    ['alpha', 'beta'],
  );
  if (!missingChainErrors.some((message) => message.includes('next-step table missing: alpha'))) {
    fail('self-test did not reject a missing workflow-chain next-step row');
  }
  const missingBranchRow = workflowChain.replace('| `beta`（复验） | 人工 | 人工 | 人工 |\n', '');
  const missingBranchErrors = validateWorkflowChainInventory(
    missingBranchRow,
    'skills/_shared/workflow-chain.md',
    ['alpha', 'beta'],
    ['`beta`（首轮）', '`beta`（复验）'],
  );
  if (!missingBranchErrors.some((message) => message.includes('missing required row label: `beta`（复验）'))) {
    fail('self-test did not reject a missing required workflow-chain branch');
  }
  const missingHostCommand = workflowChain.replace(
    '| `alpha` | `beta` | `/beta <input>` | `使用 beta skill 继续` |',
    '| `alpha` | `beta` | 人工 | `使用 beta skill 继续` |',
  );
  const missingHostErrors = validateWorkflowChainInventory(
    missingHostCommand,
    'skills/_shared/workflow-chain.md',
    ['alpha', 'beta'],
    ['`beta`（首轮）', '`beta`（复验）'],
  );
  if (!missingHostErrors.some((message) => message.includes('Claude Code command missing Skill target: beta'))) {
    fail('self-test did not reject a missing host Skill invocation');
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
  'skills/_shared/workflow-chain.md',
];
const docTextByRel = new Map(docs.map((rel) => [rel, read(rel)]));

for (const error of validateReadmeSkillIndex(
  docTextByRel.get('README.md'),
  'README.md',
  skillNames,
)) {
  fail(error);
}

for (const error of validateWorkflowChainInventory(
  docTextByRel.get('skills/_shared/workflow-chain.md'),
  'skills/_shared/workflow-chain.md',
  skillNames,
  ['`code-reading`（CodeMap）', '`code-reading`（ImpactAnalysis）'],
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
  'biz-flow': ['bug-fix', 'dev-doc', 'code-reading', 'review-check', 'review-fix'],
  'bug-fix': ['review-check', 'review-repair', 'dev-doc', 'biz-flow'],
  'code-reading': ['dev-doc', 'review-check', 'review-repair', 'biz-flow'],
  'dev-doc': ['bug-fix', 'biz-flow', 'code-reading', 'review-fix', 'review-check', 'review-repair'],
  'review-check': ['review-fix', 'review-repair', 'review-loop'],
  'review-fix': ['review-check', 'review-repair', 'review-loop'],
  'review-loop': ['最多 2 个修复循环', '不进入 Submit Gate'],
  'review-repair': ['review-check', 'review-loop'],
};
const agentPromptRequirements = {
  'biz-flow': [
    'bug-fix',
    'dev-doc',
    'code-reading',
    'review-check',
    'review-fix',
  ],
  'bug-fix': [
    'review-check',
    'review-repair',
    'dev-doc',
    'biz-flow',
  ],
  'conversation-handoff': [
    'dev-doc',
    'bug-fix',
    'review-fix',
    'review-check',
    'review-repair',
  ],
  'code-reading': [
    'dev-doc',
    'review-check',
    'review-repair',
    'biz-flow',
  ],
  'dev-doc': [
    'bug-fix',
    'biz-flow',
    'code-reading',
    'review-fix',
    'review-check',
    'review-repair',
  ],
  'review-check': [
    'review-fix',
    'review-repair',
    'review-loop',
  ],
  'review-fix': [
    'review-check',
    'review-repair',
    'review-loop',
  ],
  'review-loop': [
    'at most two repair cycles',
    'do not enter Submit Gate',
    'Never commit or push',
  ],
  'review-repair': [
    'review-check',
    'review-loop',
    'do not repair without findings',
    'fix handoff',
  ],
};

for (const skill of skillNames) {
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

for (const required of ['dev-doc', 'review-check', 'review-repair', 'code-reading']) {
  if (!skillNames.includes(required)) fail(`required workflow skill missing: ${required}`);
}

if (failed) process.exit(1);

for (const row of rows) {
  const examples = row.hasExamples ? 'examples' : 'no-examples';
  console.log(`${row.skill}\t${row.displayName}\t${examples}`);
}
console.log(`ok skill inventory checks passed (${skillNames.length} skills)`);
