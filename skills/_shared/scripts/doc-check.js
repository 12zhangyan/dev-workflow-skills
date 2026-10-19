#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const USAGE = [
  'usage: node doc-check.js <command> [args]',
  '  refs <markdown-file> [--root <dir>]   verify backticked/linked repo paths and path:line references exist',
  '  mermaid <markdown-or-json-file>       lint Mermaid blocks: header, block balance, unquoted reserved labels, size budget',
  '  --self-test                           run built-in fixtures',
  'exit code: 0 = no errors (warnings may be printed), 2 = findings that must be fixed or labeled, 1 = usage/IO error',
].join('\n');

const SOURCE_EXT = 'java|kt|groovy|xml|yml|yaml|properties|sql|js|cjs|mjs|ts|tsx|jsx|vue|json|md|py|go|rs|cs|sh|ps1|cmd|gradle|kts|html|css|scss|proto|conf|toml|ini|txt';
const PATH_RE = new RegExp(`^(?:\\.{1,2}/)?[\\w@.\\-\\u4e00-\\u9fa5]+(?:/[\\w@.\\-\\u4e00-\\u9fa5]+)*\\.(?:${SOURCE_EXT})(?::(\\d+)(?:-(\\d+))?)?$`, 'i');

function findRoot(start) {
  let current = path.resolve(start);
  while (true) {
    if (fs.existsSync(path.join(current, '.git')) || fs.existsSync(path.join(current, '.svn'))) return current;
    const parent = path.dirname(current);
    if (parent === current) return path.resolve(start);
    current = parent;
  }
}

function stripFences(text) {
  // Fenced code is example content, not a claim about the repository.
  return text.replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1[ \t]*$/gm, (block) => block.replace(/[^\n]/g, ' '));
}

function collectRefs(text) {
  const refs = [];
  const body = stripFences(text);
  const lines = body.split(/\r?\n/);
  lines.forEach((line, index) => {
    const candidates = [];
    for (const match of line.matchAll(/`([^`\n]+)`/g)) candidates.push(match[1].trim());
    for (const match of line.matchAll(/\]\(([^)\s]+)\)/g)) candidates.push(match[1].split('#')[0].trim());
    for (const raw of candidates) {
      if (!raw || /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) || /[*?<>{}|$]/.test(raw)) continue;
      const match = raw.match(PATH_RE);
      // A bare file name without a directory or line is a generic mention, not a locatable claim.
      if (!match || (!raw.includes('/') && !match[1])) continue;
      refs.push({ raw, docLine: index + 1, file: raw.replace(/:\d+(?:-\d+)?$/, ''), start: match[1] && Number(match[1]), end: match[2] && Number(match[2]) });
    }
  });
  return refs;
}

function checkRefs(docPath, root) {
  const text = fs.readFileSync(docPath, 'utf8');
  const docDir = path.dirname(path.resolve(docPath));
  const problems = [];
  let ok = 0;
  const seen = new Set();
  for (const ref of collectRefs(text)) {
    if (seen.has(ref.raw)) continue;
    seen.add(ref.raw);
    const candidates = [path.resolve(root, ref.file), path.resolve(docDir, ref.file)];
    const found = candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
    if (!found) {
      problems.push(`MISSING ${ref.raw} (doc line ${ref.docLine})`);
      continue;
    }
    if (ref.start) {
      const lineCount = fs.readFileSync(found, 'utf8').split(/\r?\n/).length;
      const last = ref.end || ref.start;
      if (ref.start < 1 || last > lineCount || last < ref.start) {
        problems.push(`LINE_OUT_OF_RANGE ${ref.raw} (file has ${lineCount} lines; doc line ${ref.docLine})`);
        continue;
      }
    }
    ok += 1;
  }
  return { ok, problems };
}

const HEADERS = /^(flowchart|graph|sequenceDiagram|stateDiagram(?:-v2)?|erDiagram|classDiagram|gantt|journey|pie|mindmap|timeline|gitGraph|quadrantChart|C4Context|C4Container|C4Component|block-beta|sankey-beta|xychart-beta|requirementDiagram)\b/;
const BUDGET = {
  flowchart: { nodes: 12, edges: 18 },
  state: { nodes: 12, edges: 18 },
  sequence: { nodes: 8, edges: 24 },
};

function collectMermaid(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const blocks = [];
  if (/\.json$/i.test(filePath)) {
    const visit = (value, where) => {
      if (typeof value === 'string') {
        if (HEADERS.test(value.trim())) blocks.push({ where, source: value });
      } else if (Array.isArray(value)) {
        value.forEach((item, index) => visit(item, `${where}[${index}]`));
      } else if (value && typeof value === 'object') {
        for (const [key, item] of Object.entries(value)) visit(item, where ? `${where}.${key}` : key);
      }
    };
    visit(JSON.parse(text.replace(/^﻿/, '')), '');
    return blocks;
  }
  const re = /^(`{3,}|~{3,})[ \t]*mermaid[^\n]*\n([\s\S]*?)^\1[ \t]*$/gm;
  for (const match of text.matchAll(re)) {
    blocks.push({ where: `line ${text.slice(0, match.index).split('\n').length}`, source: match[2] });
  }
  return blocks;
}

function lintMermaid(source) {
  const errors = [];
  const warnings = [];
  const lines = source.split(/\r?\n/).map((line) => line.replace(/%%.*$/, '').trim()).filter(Boolean);
  const header = lines[0] && lines[0].match(HEADERS);
  if (!header) return { kind: 'unknown', errors: ['missing or unknown diagram header'], warnings, nodes: 0, edges: 0 };
  const kind = /^(flowchart|graph)$/.test(header[1]) ? 'flowchart'
    : header[1] === 'sequenceDiagram' ? 'sequence'
      : header[1].startsWith('stateDiagram') ? 'state' : header[1];
  if (source.includes('`')) warnings.push('backtick found; board JSON fields and many renderers reject it');
  const nodes = new Set();
  let edges = 0;
  let depth = 0;
  for (const line of lines.slice(1)) {
    if (kind === 'flowchart') {
      if (/^subgraph\b/.test(line)) depth += 1;
      else if (/^end\b/.test(line)) depth -= 1;
      if (/^(subgraph|end|classDef|class|style|linkStyle|click|direction)\b/.test(line)) continue;
      for (const match of line.matchAll(/([A-Za-z_][\w-]*)\s*(\[\[|\[\(|\(\(|\[\/|\[\\|\[|\(\[|\(|\{\{|\{|>)([^\]\)\}]*)/g)) {
        nodes.add(match[1]);
        const label = match[3].trim();
        if (label && !/^"/.test(label) && /[()[\]{}]/.test(label)) {
          errors.push(`unquoted label with reserved characters for node ${match[1]}; wrap the label in double quotes`);
        }
      }
      for (const match of line.matchAll(/(?:^|[\s\])}>])([A-Za-z_][\w-]*)(?=\s*(?:-->|---|-\.->|==>|--[xo]|<-->|$|&))/g)) nodes.add(match[1]);
      edges += (line.match(/-->|---|-\.->|==>|--[xo]\b|<-->/g) || []).length;
    } else if (kind === 'sequence') {
      if (/^(alt|opt|loop|par|critical|break|rect|box)\b/.test(line)) depth += 1;
      else if (/^end\b/.test(line)) depth -= 1;
      const participant = line.match(/^(?:participant|actor)\s+([^\s]+)/);
      if (participant) nodes.add(participant[1]);
      const message = line.match(/^([^\s:-]+)\s*(?:-->>|->>|-->|->|--x|-x|--\)|-\))\s*\+?-?([^\s:]+)\s*:/);
      if (message) {
        nodes.add(message[1]);
        nodes.add(message[2]);
        edges += 1;
      }
    } else if (kind === 'state') {
      if (/^state\s+.*\{\s*$/.test(line)) depth += 1;
      else if (/^\}\s*$/.test(line)) depth -= 1;
      const transition = line.match(/^(\S+)\s*-->\s*(\S+)/);
      if (transition) {
        for (const id of [transition[1], transition[2]]) if (id !== '[*]') nodes.add(id.replace(/:$/, ''));
        edges += 1;
      }
    }
    if (depth < 0) {
      errors.push('unbalanced block: "end" without a matching opener');
      depth = 0;
    }
  }
  if (depth > 0) errors.push(`unbalanced block: ${depth} opener(s) without "end"`);
  const budget = BUDGET[kind];
  if (budget && (nodes.size > budget.nodes || edges > budget.edges)) {
    warnings.push(`over budget (${nodes.size} nodes / ${edges} edges; limit ${budget.nodes} / ${budget.edges}); consider overview + detail diagrams`);
  }
  return { kind, errors, warnings, nodes: nodes.size, edges };
}

function runMermaid(filePath) {
  const blocks = collectMermaid(filePath);
  let errorCount = 0;
  const output = [];
  for (const block of blocks) {
    const result = lintMermaid(block.source);
    errorCount += result.errors.length;
    output.push(`${result.errors.length ? 'ERROR' : result.warnings.length ? 'WARN' : 'OK'} ${block.where} ${result.kind} nodes=${result.nodes} edges=${result.edges}`);
    for (const item of result.errors) output.push(`  error: ${item}`);
    for (const item of result.warnings) output.push(`  warn: ${item}`);
  }
  output.push(`mermaid blocks=${blocks.length} errors=${errorCount}`);
  return { errorCount, output };
}

function selfTest() {
  const assert = (condition, message) => {
    if (!condition) {
      process.stderr.write(`SELF-TEST FAIL: ${message}\n`);
      process.exit(1);
    }
  };
  const good = lintMermaid('flowchart TD\n  A["提交(草稿)"] --> B{校验}\n  B -->|通过| C[入库]\n  B -->|失败| D[返回错误]');
  assert(good.errors.length === 0 && good.nodes === 4 && good.edges === 3, `valid flowchart misread: ${JSON.stringify(good)}`);
  assert(lintMermaid('flowchart TD\n  A[调用(x)] --> B').errors.length === 1, 'unquoted reserved label not reported');
  assert(lintMermaid('flowchart TD\n  subgraph S\n  A --> B').errors.length === 1, 'missing end not reported');
  assert(lintMermaid('graphs TD\n A --> B').errors.length === 1, 'unknown header not reported');
  const seq = lintMermaid('sequenceDiagram\n  participant C as Client\n  C->>S: 请求\n  alt 成功\n  S-->>C: 200\n  end');
  assert(seq.errors.length === 0 && seq.edges === 2, `sequence misread: ${JSON.stringify(seq)}`);
  const big = ['flowchart LR'];
  for (let i = 0; i < 14; i += 1) big.push(`  N${i} --> N${i + 1}`);
  assert(lintMermaid(big.join('\n')).warnings.some((item) => item.includes('over budget')), 'budget warning missing');

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-check-'));
  try {
    fs.mkdirSync(path.join(dir, '.git'));
    fs.mkdirSync(path.join(dir, 'src'));
    fs.writeFileSync(path.join(dir, 'src', 'App.java'), 'a\nb\nc\n');
    const doc = path.join(dir, 'plan.md');
    fs.writeFileSync(doc, '见 `src/App.java:2`、`src/App.java:9`、`src/Missing.java` 与 [链接](src/App.java)。\n```\n`src/Ignored.java`\n```\n`https://x.io/a.java` `src/*.java`\n');
    const result = checkRefs(doc, findRoot(dir));
    assert(result.ok === 2, `expected 2 ok refs, got ${result.ok}`);
    assert(result.problems.length === 2 && result.problems.some((item) => item.startsWith('LINE_OUT_OF_RANGE')) && result.problems.some((item) => item.startsWith('MISSING src/Missing.java')), `unexpected problems: ${result.problems.join('; ')}`);
    const json = path.join(dir, 'entry.json');
    fs.writeFileSync(json, JSON.stringify({ bizFlow: 'flowchart TD\n A[x(y)] --> B', title: 'not a diagram' }));
    assert(runMermaid(json).errorCount === 1, 'json mermaid field not linted');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  process.stdout.write('ok doc-check self-test\n');
}

const [command, ...args] = process.argv.slice(2);
try {
  if (command === '--self-test') {
    selfTest();
  } else if (command === 'refs') {
    const rootIndex = args.indexOf('--root');
    const root = rootIndex >= 0 ? args[rootIndex + 1] : undefined;
    const file = args.find((_arg, index) => rootIndex < 0 || (index !== rootIndex && index !== rootIndex + 1));
    if (!file || (rootIndex >= 0 && !root)) throw new Error('usage: refs <markdown-file> [--root <dir>]');
    const result = checkRefs(file, path.resolve(root || findRoot(path.dirname(path.resolve(file)))));
    for (const problem of result.problems) process.stdout.write(problem + '\n');
    process.stdout.write(`refs ok=${result.ok} problems=${result.problems.length}\n`);
    process.exit(result.problems.length ? 2 : 0);
  } else if (command === 'mermaid') {
    if (args.length !== 1) throw new Error('usage: mermaid <markdown-or-json-file>');
    const result = runMermaid(args[0]);
    process.stdout.write(result.output.join('\n') + '\n');
    process.exit(result.errorCount ? 2 : 0);
  } else if (command === 'help' || command === '--help' || command === '-h') {
    process.stdout.write(USAGE + '\n');
  } else {
    throw new Error(`unknown command: ${command || '(none)'}\n${USAGE}`);
  }
} catch (error) {
  process.stderr.write(`ERROR: ${error.message}\n`);
  process.exit(1);
}
