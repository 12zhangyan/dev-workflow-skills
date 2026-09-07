#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.resolve(__dirname, '..');
const contractRel = 'skills/_shared/route-loading-contracts.json';

function normalizeRel(value) {
  return value.replace(/\\/g, '/').replace(/^\.\//, '');
}

function readText(base, rel) {
  return fs.readFileSync(path.join(base, rel), 'utf8').replace(/^\uFEFF/, '');
}

function extractDirectMarkdownReferences(base, sourceRel, text) {
  const references = [];
  const linkPattern = /\[[^\]]*]\(([^)\r\n]+)\)/g;
  for (const match of text.matchAll(linkPattern)) {
    let raw = match[1].trim();
    if (raw.startsWith('<') && raw.endsWith('>')) raw = raw.slice(1, -1);
    raw = raw.split(/\s+["']/)[0];
    if (!raw || raw.startsWith('#') || /^[a-z][a-z0-9+.-]*:/i.test(raw)) continue;
    const withoutAnchor = raw.split('#')[0].split('?')[0];
    if (path.extname(withoutAnchor).toLowerCase() !== '.md') continue;
    const absolute = path.resolve(base, path.dirname(sourceRel), withoutAnchor);
    const rel = normalizeRel(path.relative(base, absolute));
    const line = text.slice(0, match.index).split(/\r?\n/).length;
    const sourceLine = text.split(/\r?\n/)[line - 1] || '';
    references.push({ target: rel, line, sourceLine });
  }
  return references;
}

function eagerLoadContradiction(line) {
  const eager = /(?:先|同时|统一|全部|完整|一次性|无差别|所有)[^。；\n]{0,48}(?:读取|加载)|(?:读取|加载)[^。；\n]{0,48}(?:全部|完整|所有|一次性)/;
  const guarded = /不要|不得|禁止|不应|不作为|仅在|只有|才(?:读取|加载)|按需|选定|对应|当前模式|第一阶段|第二阶段|进入[^。；\n]{0,20}(?:时|后)|如果|若|除/;
  return eager.test(line) && !guarded.test(line);
}

function collectDeclaredResources(route, errors) {
  const resources = route.direct_resources;
  const declared = new Map();

  function add(target, policy, guard) {
    if (typeof target !== 'string' || !target) {
      errors.push(`${route.id} has an invalid ${policy} target`);
      return;
    }
    const normalized = normalizeRel(target);
    if (declared.has(normalized)) {
      errors.push(`${route.id} declares ${normalized} more than once`);
      return;
    }
    declared.set(normalized, { policy, guard });
  }

  if (!resources || typeof resources !== 'object' || Array.isArray(resources)) {
    errors.push(`${route.id} direct_resources must be an object`);
    return declared;
  }
  for (const key of ['always', 'routed', 'conditional', 'index_only']) {
    if (!Array.isArray(resources[key])) errors.push(`${route.id} direct_resources.${key} must be an array`);
  }
  for (const target of resources.always || []) add(target, 'always', '');
  for (const group of resources.routed || []) {
    if (!group || typeof group !== 'object' || !group.name || !group.guard || !Array.isArray(group.targets) || group.targets.length < 2) {
      errors.push(`${route.id} has an invalid routed group`);
      continue;
    }
    for (const target of group.targets) add(target, `routed:${group.name}`, group.guard);
  }
  for (const policy of ['conditional', 'index_only']) {
    for (const item of resources[policy] || []) {
      if (!item || typeof item !== 'object' || typeof item.guard !== 'string' || !item.guard) {
        errors.push(`${route.id} has an invalid ${policy} resource`);
        continue;
      }
      add(item.target, policy, item.guard);
    }
  }
  return declared;
}

function validateRoute(base, route) {
  const errors = [];
  if (!route || typeof route !== 'object' || !route.id || !route.source) {
    return ['route must have id and source'];
  }
  const sourceRel = normalizeRel(route.source);
  const sourcePath = path.join(base, sourceRel);
  if (!fs.existsSync(sourcePath)) return [`${route.id} source is missing: ${sourceRel}`];

  const text = readText(base, sourceRel);
  const references = extractDirectMarkdownReferences(base, sourceRel, text);
  const sourceLines = text.split(/\r?\n/);
  const actual = new Set(references.map((item) => item.target));
  const declared = collectDeclaredResources(route, errors);

  for (const target of actual) {
    if (!declared.has(target)) errors.push(`${route.id} directly references undeclared runtime resource: ${target}`);
  }
  for (const [target, policy] of declared) {
    if (!actual.has(target)) errors.push(`${route.id} declares unused direct runtime resource: ${target}`);
    if (!fs.existsSync(path.join(base, target))) errors.push(`${route.id} runtime resource is missing: ${target}`);
    if (policy.guard && !text.includes(policy.guard)) {
      errors.push(`${route.id} ${target} is missing ${policy.policy} guard: ${policy.guard}`);
    }
    if (path.basename(target) === 'examples.md' && policy.policy !== 'conditional') {
      errors.push(`${route.id} examples.md must be conditional, not ${policy.policy}`);
    }
    if (/(?:^|-)template(?:-|\.md$)/i.test(path.basename(target)) && !(
      policy.policy === 'conditional' || policy.policy.startsWith('routed:')
    )) {
      errors.push(`${route.id} template resource must be routed or conditional: ${target}`);
    }
    if (policy.policy === 'conditional' || policy.policy === 'index_only') {
      const targetName = path.basename(target);
      for (let index = 0; index < sourceLines.length; index += 1) {
        if (sourceLines[index].includes(targetName) && eagerLoadContradiction(sourceLines[index])) {
          errors.push(`${route.id} ${policy.policy} resource has a contradictory eager-load directive at line ${index + 1}: ${target}`);
        }
      }
    }
  }

  const hasModeRouter = [...declared].some(([target, policy]) => (
    policy.policy.startsWith('routed:') && /\/modes\/[^/]+\/mode\.md$/.test(target)
  ));
  if (hasModeRouter) {
    for (const target of actual) {
      if (/\/modes\/[^/]+\/(?:reference|examples|[^/]*template[^/]*)\.md$/i.test(target)) {
        errors.push(`${route.id} router must not bypass mode.md and preload child resource: ${target}`);
      }
    }
  }

  const evalBinding = route.eval;
  if (!evalBinding || typeof evalBinding !== 'object' || !evalBinding.suite || !evalBinding.required_tag) {
    errors.push(`${route.id} must declare eval.suite and eval.required_tag`);
  } else {
    const suiteRel = normalizeRel(evalBinding.suite);
    const suitePath = path.join(base, suiteRel);
    if (!fs.existsSync(suitePath)) {
      errors.push(`${route.id} eval suite is missing: ${suiteRel}`);
    } else {
      try {
        const suite = JSON.parse(readText(base, suiteRel));
        const matches = Array.isArray(suite.evals)
          ? suite.evals.filter((item) => Array.isArray(item.tags) && item.tags.includes(evalBinding.required_tag))
          : [];
        if (matches.length === 0) {
          errors.push(`${route.id} eval suite lacks required tag ${evalBinding.required_tag}: ${suiteRel}`);
        }
      } catch (error) {
        errors.push(`${route.id} eval suite is invalid JSON: ${suiteRel}: ${error.message}`);
      }
    }
  }
  return errors;
}

function listFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(full));
    else if (entry.isFile()) files.push(full);
  }
  return files;
}

function budgetKind(rel, routeSources) {
  const name = path.basename(rel);
  if (routeSources.has(rel)) return name === 'SKILL.md' ? 'public_entry' : 'mode';
  if (name === 'completion.md') return 'completion';
  if (name === 'reference.md') return 'reference';
  if (name === 'examples.md') return 'examples';
  if (/(?:^|-)template(?:-|\.md$)/i.test(name)) return 'template';
  return '';
}

function routeBudgetKind(route) {
  return path.basename(normalizeRel(route.source || '')) === 'SKILL.md' ? 'public_entry' : 'mode';
}

function defaultRouteFootprint(base, route) {
  const paths = [...new Set([
    normalizeRel(route.source || ''),
    ...((route.direct_resources && route.direct_resources.always) || []).map(normalizeRel),
  ].filter(Boolean))];
  let chars = 0;
  for (const rel of paths) {
    const full = path.join(base, rel);
    if (fs.existsSync(full)) chars += readText(base, rel).length;
  }
  return { paths, chars };
}

function validateBudgets(base, contract) {
  const errors = [];
  const limits = contract.budgets && contract.budgets.max_chars;
  const defaultLimits = contract.budgets && contract.budgets.max_default_chars;
  const requiredKinds = ['public_entry', 'mode', 'completion', 'reference', 'examples', 'template'];
  const requiredRouteKinds = ['public_entry', 'mode'];
  if (!limits || typeof limits !== 'object') return ['route loading contract must define budgets.max_chars'];
  for (const kind of requiredKinds) {
    if (!Number.isInteger(limits[kind]) || limits[kind] <= 0) {
      errors.push(`route loading budget ${kind} must be a positive integer`);
    }
  }
  if (!defaultLimits || typeof defaultLimits !== 'object') {
    errors.push('route loading contract must define budgets.max_default_chars');
  } else {
    for (const kind of requiredRouteKinds) {
      if (!Number.isInteger(defaultLimits[kind]) || defaultLimits[kind] <= 0) {
        errors.push(`route loading default-load budget ${kind} must be a positive integer`);
      }
    }
  }
  const routeSources = new Set((contract.routes || []).map((route) => normalizeRel(route.source || '')));
  const skillRoot = path.join(base, 'skills');
  for (const full of listFiles(skillRoot)) {
    const rel = normalizeRel(path.relative(base, full));
    if (!/^skills\/yan-[^/]+\//.test(rel) && !routeSources.has(rel)) continue;
    const kind = budgetKind(rel, routeSources);
    if (!kind || !Number.isInteger(limits[kind])) continue;
    const chars = readText(base, rel).length;
    if (chars > limits[kind]) {
      errors.push(`${rel} exceeds ${kind} budget: ${chars} > ${limits[kind]} chars`);
    }
  }
  if (defaultLimits && typeof defaultLimits === 'object') {
    for (const route of contract.routes || []) {
      const kind = routeBudgetKind(route);
      const footprint = defaultRouteFootprint(base, route);
      if (Number.isInteger(defaultLimits[kind]) && footprint.chars > defaultLimits[kind]) {
        errors.push(`${route.id} exceeds ${kind} default-load budget: ${footprint.chars} > ${defaultLimits[kind]} chars (${footprint.paths.length} resources)`);
      }
    }
  }
  return errors;
}

function loadingReport(base, contract) {
  const routeSources = new Set(contract.routes.map((route) => normalizeRel(route.source)));
  const limits = contract.budgets.max_chars;
  const defaultLimits = contract.budgets.max_default_chars;
  const resources = [];
  for (const full of listFiles(path.join(base, 'skills'))) {
    const rel = normalizeRel(path.relative(base, full));
    if (!/^skills\/yan-[^/]+\//.test(rel) && !routeSources.has(rel)) continue;
    const kind = budgetKind(rel, routeSources);
    if (!kind) continue;
    const chars = readText(base, rel).length;
    resources.push({ path: rel, kind, chars, limit: limits[kind], utilization: Number((chars / limits[kind]).toFixed(3)) });
  }
  const routes = contract.routes.map((route) => {
    const declared = collectDeclaredResources(route, []);
    const routeKind = routeBudgetKind(route);
    const footprint = defaultRouteFootprint(base, route);
    const policies = { always: 0, routed: 0, conditional: 0, index_only: 0 };
    for (const { policy } of declared.values()) {
      if (policy.startsWith('routed:')) policies.routed += 1;
      else policies[policy] += 1;
    }
    return {
      id: route.id,
      source: route.source,
      source_chars: readText(base, route.source).length,
      default_loaded_chars: footprint.chars,
      default_loaded_resources: footprint.paths.length,
      default_loaded_limit: defaultLimits[routeKind],
      direct_resources: declared.size,
      policies,
      eval_suite: route.eval.suite,
      eval_tag: route.eval.required_tag,
    };
  });
  return {
    schema_version: 2,
    generated_from: contractRel,
    note: 'Character counts, including source plus declared always resources, are static regression baselines, not measured model token usage.',
    routes,
    resources: resources.sort((left, right) => right.utilization - left.utilization),
  };
}

function discoverRouteSources(base) {
  const sources = [];
  const skillsDir = path.join(base, 'skills');
  for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const skillRel = normalizeRel(path.join('skills', entry.name, 'SKILL.md'));
    if (fs.existsSync(path.join(base, skillRel))) sources.push(skillRel);
  }
  for (const skill of ['yan-code-review', 'yan-project-analysis']) {
    const modesDir = path.join(skillsDir, skill, 'modes');
    if (!fs.existsSync(modesDir)) continue;
    for (const entry of fs.readdirSync(modesDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const modeRel = normalizeRel(path.join('skills', skill, 'modes', entry.name, 'mode.md'));
      if (fs.existsSync(path.join(base, modeRel))) sources.push(modeRel);
    }
  }
  return sources.sort();
}

function validateContract(base, contract, options = {}) {
  const errors = [];
  if (!contract || typeof contract !== 'object' || Array.isArray(contract)) {
    return ['route loading contract root must be an object'];
  }
  if (!Number.isInteger(contract.schema_version) || contract.schema_version < 1) {
    errors.push('route loading contract needs a positive schema_version');
  }
  if (!Array.isArray(contract.routes) || contract.routes.length === 0) {
    errors.push('route loading contract needs routes');
    return errors;
  }

  const ids = new Set();
  const sources = new Set();
  for (const route of contract.routes) {
    if (route && ids.has(route.id)) errors.push(`duplicate route id: ${route.id}`);
    if (route && sources.has(normalizeRel(route.source || ''))) errors.push(`duplicate route source: ${route.source}`);
    if (route) {
      ids.add(route.id);
      sources.add(normalizeRel(route.source || ''));
    }
    errors.push(...validateRoute(base, route));
  }
  errors.push(...validateBudgets(base, contract));

  if (options.discover !== false) {
    const discovered = discoverRouteSources(base);
    for (const source of discovered) {
      if (!sources.has(source)) errors.push(`runtime route has no loading contract: ${source}`);
    }
    for (const source of sources) {
      if (!discovered.includes(source)) errors.push(`loading contract source is not a discovered route: ${source}`);
    }
  }
  return errors;
}

function runSelfTest() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'route-loading-check-'));
  try {
    fs.mkdirSync(path.join(temp, 'skills', 'sample', 'modes', 'check'), { recursive: true });
    fs.writeFileSync(
      path.join(temp, 'skills', 'sample', 'SKILL.md'),
      '选定模式后只读取对应文件：[check](modes/check/mode.md)\n仅在首次执行时读取：[示例](examples.md)\n',
      'utf8',
    );
    fs.writeFileSync(path.join(temp, 'skills', 'sample', 'examples.md'), '# example\n', 'utf8');
    fs.writeFileSync(
      path.join(temp, 'skills', 'sample', 'evals.json'),
      '{"skill_name":"sample","evals":[{"id":1,"prompt":"x","expected_output":"y","tags":["route_minimal_loading"]}]}',
      'utf8',
    );
    fs.writeFileSync(path.join(temp, 'skills', 'sample', 'modes', 'check', 'mode.md'), '# mode\n', 'utf8');
    const validRoute = {
      id: 'sample',
      source: 'skills/sample/SKILL.md',
      eval: { suite: 'skills/sample/evals.json', required_tag: 'route_minimal_loading' },
      direct_resources: {
        always: [],
        routed: [{
          name: 'mode',
          guard: '选定模式后只读取对应文件',
          targets: ['skills/sample/modes/check/mode.md', 'skills/sample/modes/check/other-mode.md'],
        }],
        conditional: [{ target: 'skills/sample/examples.md', guard: '仅在首次执行时' }],
        index_only: [],
      },
    };
    fs.writeFileSync(path.join(temp, 'skills', 'sample', 'modes', 'check', 'other-mode.md'), '# other\n', 'utf8');
    fs.appendFileSync(
      path.join(temp, 'skills', 'sample', 'SKILL.md'),
      '[other](modes/check/other-mode.md)\n',
      'utf8',
    );
    const validErrors = validateRoute(temp, validRoute);
    if (validErrors.length) throw new Error(`valid fixture rejected: ${validErrors.join('; ')}`);

    fs.appendFileSync(path.join(temp, 'skills', 'sample', 'SKILL.md'), '[all](reference.md)\n', 'utf8');
    const undeclared = validateRoute(temp, validRoute);
    if (!undeclared.some((message) => message.includes('undeclared runtime resource'))) {
      throw new Error('unlisted direct resource fixture was not rejected');
    }

    const missingGuard = JSON.parse(JSON.stringify(validRoute));
    missingGuard.direct_resources.conditional[0].guard = '不存在的条件';
    const guardErrors = validateRoute(temp, missingGuard);
    if (!guardErrors.some((message) => message.includes('missing conditional guard'))) {
      throw new Error('missing conditional guard fixture was not rejected');
    }

    const eagerExample = JSON.parse(JSON.stringify(validRoute));
    eagerExample.direct_resources.always.push('skills/sample/examples.md');
    eagerExample.direct_resources.conditional = [];
    const eagerErrors = validateRoute(temp, eagerExample);
    if (!eagerErrors.some((message) => message.includes('examples.md must be conditional'))) {
      throw new Error('eager examples fixture was not rejected');
    }

    fs.appendFileSync(
      path.join(temp, 'skills', 'sample', 'SKILL.md'),
      '先统一加载全部示例：[示例](examples.md)\n',
      'utf8',
    );
    const contradictionErrors = validateRoute(temp, validRoute);
    if (!contradictionErrors.some((message) => message.includes('contradictory eager-load directive'))) {
      throw new Error('contradictory eager-load fixture was not rejected');
    }

    const budgetErrors = validateBudgets(temp, {
      routes: [validRoute],
      budgets: {
        max_chars: { public_entry: 10, mode: 100, completion: 100, reference: 100, examples: 100, template: 100 },
        max_default_chars: { public_entry: 1000, mode: 1000 },
      },
    });
    if (!budgetErrors.some((message) => message.includes('exceeds public_entry budget'))) {
      throw new Error('oversized route fixture was not rejected');
    }

    fs.writeFileSync(path.join(temp, 'skills', 'sample', 'completion.md'), '# completion\nmore context\n', 'utf8');
    const aggregateRoute = JSON.parse(JSON.stringify(validRoute));
    aggregateRoute.direct_resources.always.push('skills/sample/completion.md');
    const aggregateBudgetErrors = validateBudgets(temp, {
      routes: [aggregateRoute],
      budgets: {
        max_chars: { public_entry: 1000, mode: 1000, completion: 1000, reference: 1000, examples: 1000, template: 1000 },
        max_default_chars: { public_entry: 100, mode: 1000 },
      },
    });
    if (!aggregateBudgetErrors.some((message) => message.includes('exceeds public_entry default-load budget'))) {
      throw new Error('aggregate default-load budget fixture was not rejected');
    }
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
  console.log('ok route loading self-test passed');
}

if (process.argv.includes('--self-test')) {
  try {
    runSelfTest();
  } catch (error) {
    console.error(`FAIL: ${error.message}`);
    process.exit(1);
  }
  process.exit(0);
}

let contract;
try {
  contract = JSON.parse(readText(root, contractRel));
} catch (error) {
  console.error(`FAIL: ${contractRel} is not valid JSON: ${error.message}`);
  process.exit(1);
}

const errors = validateContract(root, contract);
if (errors.length) {
  for (const error of errors) console.error(`FAIL: ${error}`);
  process.exit(1);
}
if (process.argv.includes('--report')) {
  const report = loadingReport(root, contract);
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log('Route loading baseline (static source/default-loaded characters/direct resources):');
    for (const route of report.routes) {
      console.log(`${route.id}\tsource ${route.source_chars}\tdefault ${route.default_loaded_chars}/${route.default_loaded_limit}\t${route.direct_resources} direct`);
    }
    const hottest = report.resources.slice(0, 5);
    console.log('Highest budget utilization:');
    for (const item of hottest) console.log(`${item.path}\t${item.chars}/${item.limit}\t${Math.round(item.utilization * 100)}%`);
  }
} else {
  const report = loadingReport(root, contract);
  console.log(`ok route loading contracts passed (${contract.routes.length} entry/mode routes, ${report.resources.length} budgeted resources)`);
}
