#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const skillsDir = path.join(root, 'skills');
const skillNames = fs.readdirSync(skillsDir)
  .filter((name) => fs.existsSync(path.join(skillsDir, name, 'SKILL.md')))
  .sort();

const requiredDocs = [
  'README.md',
  'docs/workflow-guide.md',
  'docs/why-yan-dev-doc.md',
  'docs/why-code-reading.md',
  'skills/_shared/workflow-brief.md',
  'skills/_shared/workflow-chain.md',
  'skills/_shared/workflow-gates.md',
  'skills/_shared/interaction-policy.md'
];

let failed = false;

function fail(message) {
  failed = true;
  console.error('FAIL: ' + message);
}

function read(rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) {
    fail(`missing document: ${rel}`);
    return '';
  }
  return fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
}

function listFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(full));
    else files.push(full);
  }
  return files;
}

function parseMarkdownFences(text) {
  const lines = [];
  let fence = null;
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (!fence) {
      const opening = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
      const invalidBacktickInfo = opening
        && opening[1][0] === '`'
        && opening[2].includes('`');
      if (opening && !invalidBacktickInfo) {
        const marker = opening[1];
        fence = { char: marker[0], length: marker.length, line: index + 1 };
        lines.push('');
        continue;
      }
      lines.push(line);
      continue;
    }

    const closing = line.match(/^ {0,3}(`{3,}|~{3,})[ \t]*$/);
    if (closing) {
      const marker = closing[1];
      if (marker[0] === fence.char && marker.length >= fence.length) fence = null;
    }
    lines.push('');
  }
  return { lines, unclosedFence: fence };
}

function markdownLinesOutsideFences(text) {
  return parseMarkdownFences(text).lines;
}

function markdownAnchor(heading) {
  return heading
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/<[^>]*>/g, '')
    .replace(/[`*_~]/g, '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');
}

function markdownAnchors(text) {
  const anchors = new Set();
  const counts = new Map();
  for (const line of markdownLinesOutsideFences(text)) {
    const match = line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/);
    if (!match) continue;
    const base = markdownAnchor(match[1]);
    const count = counts.get(base) || 0;
    anchors.add(count === 0 ? base : `${base}-${count}`);
    counts.set(base, count + 1);
  }
  return anchors;
}

function markdownLinkDestination(raw) {
  const value = raw.trim();
  if (!value.startsWith('<')) return value.split(/\s+/)[0];
  const close = value.indexOf('>');
  return close < 0 ? value : value.slice(1, close);
}

function markdownTextOutsideInlineCode(line) {
  let visible = '';
  let cursor = 0;
  while (cursor < line.length) {
    const opener = line.indexOf('`', cursor);
    if (opener < 0) {
      visible += line.slice(cursor);
      break;
    }
    visible += line.slice(cursor, opener);
    let openerEnd = opener;
    while (line[openerEnd] === '`') openerEnd += 1;
    const openerLength = openerEnd - opener;

    let search = openerEnd;
    let closingEnd = -1;
    while (search < line.length) {
      const candidate = line.indexOf('`', search);
      if (candidate < 0) break;
      let candidateEnd = candidate;
      while (line[candidateEnd] === '`') candidateEnd += 1;
      if (candidateEnd - candidate === openerLength) {
        closingEnd = candidateEnd;
        break;
      }
      search = candidateEnd;
    }

    if (closingEnd < 0) {
      visible += line.slice(opener, openerEnd);
      cursor = openerEnd;
    } else {
      cursor = closingEnd;
    }
  }
  return visible;
}

function maintainedMarkdownFiles() {
  const files = listFiles(skillsDir).filter((file) => file.endsWith('.md'));
  for (const rel of requiredDocs.filter((file) => file.endsWith('.md'))) {
    files.push(path.join(root, rel));
  }
  return [...new Set(files.map((file) => path.resolve(file)))].sort();
}

function checkMaintainedMarkdownLinks() {
  const markdownFiles = maintainedMarkdownFiles();
  const anchorCache = new Map();
  let checked = 0;

  for (const sourceFile of markdownFiles) {
    const sourceRel = path.relative(root, sourceFile).replace(/\\/g, '/');
    const sourceText = read(sourceRel);
    const parsed = parseMarkdownFences(sourceText);
    if (parsed.unclosedFence) {
      const fence = parsed.unclosedFence;
      fail(`${sourceRel} has an unclosed ${fence.char.repeat(fence.length)} fence opened at line ${fence.line}`);
    }
    for (const line of parsed.lines) {
      const visibleLine = markdownTextOutsideInlineCode(line);
      for (const match of visibleLine.matchAll(/!?\[[^\]]*]\(([^)]+)\)/g)) {
        const destination = markdownLinkDestination(match[1]);
        if (!destination || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(destination)) continue;
        checked += 1;

        const hashIndex = destination.indexOf('#');
        const rawPath = hashIndex < 0 ? destination : destination.slice(0, hashIndex);
        const rawFragment = hashIndex < 0 ? '' : destination.slice(hashIndex + 1);
        let decodedPath;
        let decodedFragment;
        try {
          decodedPath = decodeURIComponent(rawPath.split('?')[0]);
          decodedFragment = decodeURIComponent(rawFragment);
        } catch {
          fail(`${sourceRel} has a malformed local link: ${destination}`);
          continue;
        }

        const targetFile = decodedPath ? path.resolve(path.dirname(sourceFile), decodedPath) : sourceFile;
        if (!fs.existsSync(targetFile)) {
          fail(`${sourceRel} links to a missing local target: ${destination}`);
          continue;
        }
        if (!decodedFragment || path.extname(targetFile).toLowerCase() !== '.md') continue;

        let anchors = anchorCache.get(targetFile);
        if (!anchors) {
          const targetRel = path.relative(root, targetFile).replace(/\\/g, '/');
          anchors = markdownAnchors(read(targetRel));
          anchorCache.set(targetFile, anchors);
        }
        if (!anchors.has(decodedFragment.toLowerCase())) {
          fail(`${sourceRel} links to a missing Markdown anchor: ${destination}`);
        }
      }
    }
  }
  return checked;
}

function runSelfTest() {
  const fourTicks = '`'.repeat(4);
  const threeTicks = '`'.repeat(3);
  const sample = [
    `${fourTicks}markdown`,
    '[ignored](missing.md)',
    threeTicks,
    '## Nested heading',
    threeTicks,
    fourTicks,
    '# Finding ID 命名体系（全链路统一）',
    '# Repeat',
    '# Repeat',
  ].join('\n');
  const parsedSample = parseMarkdownFences(sample);
  const visible = parsedSample.lines.join('\n');
  if (parsedSample.unclosedFence) {
    fail('self-test failed to close a longer fenced block');
  }
  if (visible.includes('missing.md') || visible.includes('Nested heading')) {
    fail('self-test failed to ignore links/headings inside a longer fenced block');
  }
  const anchors = markdownAnchors(sample);
  for (const anchor of ['finding-id-命名体系全链路统一', 'repeat', 'repeat-1']) {
    if (!anchors.has(anchor)) fail(`self-test failed to generate anchor: ${anchor}`);
  }
  if (markdownLinkDestination('<path with spaces.md> "title"') !== 'path with spaces.md') {
    fail('self-test failed to parse an angle-bracket link destination');
  }
  const inlineCode = markdownTextOutsideInlineCode(
    '`[ignored](missing.md)` and ``[ignored-too](missing.md)`` but [`kept`](README.md)',
  );
  if (inlineCode.includes('missing.md') || !inlineCode.includes('[](README.md)')) {
    fail('self-test failed to ignore inline-code links while preserving a real link target');
  }
  const maintained = new Set(maintainedMarkdownFiles().map((file) => (
    path.relative(root, file).replace(/\\/g, '/')
  )));
  for (const rel of requiredDocs) {
    if (rel.endsWith('.md') && !maintained.has(rel)) {
      fail(`self-test failed to include maintained document: ${rel}`);
    }
  }
  if (maintained.has('docs/INDEX.md')) {
    fail('self-test must not include generated docs/INDEX.md');
  }
  const malformed = parseMarkdownFences([
    `${threeTicks}markdown`,
    `${threeTicks}text`,
    'nested content',
    threeTicks,
    '# Visible after the first fence',
    threeTicks,
  ].join('\n'));
  if (!malformed.unclosedFence || malformed.unclosedFence.line !== 6) {
    fail('self-test failed to detect an unclosed fence after a nested info-string marker');
  }
  if (failed) process.exit(1);
  console.log('ok documentation Markdown parser self-test passed');
  process.exit(0);
}

if (process.argv.includes('--self-test')) runSelfTest();

const readme = read('README.md');
for (const needle of [
  'install.ps1',
  'install.sh',
  'install-local.cmd',
  'node scripts/check-all.js',
  'Windows PowerShell 5.1',
  'Get-Content -Encoding UTF8',
  'Workflow Brief',
  '`$yan-dev-doc`'
]) {
  if (!readme.includes(needle)) fail(`README.md missing required text: ${needle}`);
}
for (const skill of skillNames) {
  if (!readme.includes(`\`${skill}\``)) fail(`README.md does not mention skill: ${skill}`);
}

const checkAll = read('scripts/check-all.js');
const checkEntries = [...checkAll.matchAll(/\['([^']+)',\s*\[([^\]]*)\]\]/g)];
if (checkEntries.length === 0) fail('scripts/check-all.js has no parseable check entries');
for (const match of checkEntries) {
  const cmd = match[1];
  const args = [...match[2].matchAll(/'([^']+)'/g)].map((arg) => arg[1]);
  const label = [cmd, ...args].join(' ');
  if (!readme.includes(label)) fail(`README.md maintenance command list missing: ${label}`);
}

const ciWorkflow = read('.github/workflows/check.yml');
if (!ciWorkflow.includes('run: node scripts/check-all.js')) {
  fail('.github/workflows/check.yml must run the full node scripts/check-all.js suite');
}

const workflowGuide = read('docs/workflow-guide.md');
for (const skill of skillNames) {
  if (!workflowGuide.includes(skill)) fail(`docs/workflow-guide.md does not mention skill: ${skill}`);
}
for (const needle of ['Workflow Brief', 'Plan Gate', 'Review Gate', 'Submit Gate', 'environment-blocked', 'CR/IM/MI']) {
  if (!workflowGuide.includes(needle)) fail(`docs/workflow-guide.md missing required text: ${needle}`);
}

const whyDevDoc = read('docs/why-yan-dev-doc.md');
const whyUnderstanding = read('docs/why-code-reading.md');

const staleFixedWorkflowText = [
  '最多两个生产代码切点',
  '简单任务（≤50 行）',
  '各问 5 个针对性问题',
  '默认在 review 之前生成',
  '变量被 3 处以上读写',
  '先生成任务包',
  '在最终人工 review 前生成代码地图',
  '文档立项 → 执行回填',
  '固定至少 100 个场景',
];
for (const [rel, text] of [
  ['README.md', readme],
  ['docs/workflow-guide.md', workflowGuide],
  ['docs/why-yan-dev-doc.md', whyDevDoc],
  ['docs/why-code-reading.md', whyUnderstanding],
]) {
  for (const stale of staleFixedWorkflowText) {
    if (text.includes(stale)) fail(`${rel} contains stale fixed workflow text: ${stale}`);
  }
}

const workflowChain = read('skills/_shared/workflow-chain.md');
for (const needle of ['CR-n', 'IM-n', 'MI-n']) {
  if (!workflowChain.includes(needle)) fail(`skills/_shared/workflow-chain.md missing self-contained workflow text: ${needle}`);
}

const forbiddenExternalSkillMarkers = [
  ['super', 'powers-zh'].join(''),
  ['super', 'powers:'].join(''),
];
for (const rel of ['README.md', 'docs/workflow-guide.md', 'AGENTS.md', 'CLAUDE.md', 'skills/_shared/workflow-chain.md']) {
  const text = read(rel);
  for (const forbidden of forbiddenExternalSkillMarkers) {
    if (text.includes(forbidden)) fail(`${rel} must not depend on external methodology skills: ${forbidden}`);
  }
}

for (const rel of ['AGENTS.md', 'CLAUDE.md']) {
  const text = read(rel);
  for (const forbidden of ['All skills use bash `date +%F`', 'use AskUserQuestion only']) {
    if (text.includes(forbidden)) fail(`${rel} contains stale host-bound guidance: ${forbidden}`);
  }
  if (!text.includes('workflow-fs.js prepare-date-dir')) {
    fail(`${rel} must document the portable date/directory helper`);
  }
}

const removedPublicSkills = 'review-fix|review-check|review-repair|review-loop|code-reading|bug-fix|biz-flow';
const legacySlashCommand = new RegExp(`(?:^|[\\s\\x60'"：])/(?:${removedPublicSkills})(?=\\s|\\x60|<|$)`, 'gm');
const legacyNaturalLanguageCommand = new RegExp(`使用 (?:${removedPublicSkills}) skill`, 'g');
for (const skill of skillNames) {
  for (const file of listFiles(path.join(skillsDir, skill)).filter((item) => item.endsWith('.md'))) {
    const rel = path.relative(root, file).replace(/\\/g, '/');
    const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
    for (const pattern of [legacySlashCommand, legacyNaturalLanguageCommand]) {
      pattern.lastIndex = 0;
      if (pattern.test(text)) {
        fail(`${rel} emits a removed public skill command; use yan-code-review/yan-project-analysis with an explicit mode`);
      }
    }
  }
}

const checkedLocalLinks = checkMaintainedMarkdownLinks();

if (failed) process.exit(1);
console.log(`ok documentation checks passed (${checkedLocalLinks} maintained local links)`);
