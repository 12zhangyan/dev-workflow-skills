#!/usr/bin/env node
'use strict';

const fs = require('fs');
const assert = require('assert/strict');

function conditionReasons(before, after, prefix = '') {
  const reasons = [];
  for (const field of ['host', 'version', 'case', 'model', 'invocation']) {
    if (!before[field] || before[field] !== after[field]) reasons.push(prefix + field + ' missing or different');
  }
  if (before.effort !== after.effort || (before.host === 'codex' && !before.effort)) reasons.push(prefix + 'effort missing or different');
  for (const field of ['fixtureHead', 'contractSha256', 'promptSha256', 'graderSha256']) {
    if (!before.provenance?.[field] || before.provenance[field] !== after.provenance?.[field]) reasons.push(prefix + field + ' missing or different');
  }
  return reasons;
}

function runReasons(label, result) {
  const reasons = [];
  if (result.provenance?.modelSelection !== 'explicit') reasons.push(label + ' model is not pinned');
  if (!result.isolation?.skillSnapshot?.sha256) reasons.push(label + ' skill fingerprint missing');
  if (typeof result.assessment?.passed !== 'boolean') reasons.push(label + ' assessment missing');
  if (result.assessment?.execution?.passed !== true) reasons.push(label + ' host execution incomplete');
  return reasons;
}

function median(values) {
  const sorted = values.filter(Number.isFinite).sort((x, y) => x - y);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function sameSkillWarnings(beforeSha, afterSha) {
  return beforeSha && beforeSha === afterSha
    ? ['before and after use the same skill fingerprint; this is a noise (A/A) sample, not a version comparison']
    : [];
}

function compare(before, after) {
  if (before.kind === 'series' || after.kind === 'series') return compareSeries(before, after);
  const reasons = [...conditionReasons(before, after), ...runReasons('before', before), ...runReasons('after', after)];
  const comparable = reasons.length === 0;
  const delta = field => comparable && Number.isFinite(before.metrics?.[field]) && Number.isFinite(after.metrics?.[field])
    ? after.metrics[field] - before.metrics[field] : null;
  return {
    comparable, reasons,
    warnings: sameSkillWarnings(before.isolation?.skillSnapshot?.sha256, after.isolation?.skillSnapshot?.sha256),
    conditions: { host: before.host, case: before.case, model: before.model, effort: before.effort, invocation: before.invocation },
    before: { skillSha256: before.isolation?.skillSnapshot?.sha256, passed: before.assessment?.passed },
    after: { skillSha256: after.isolation?.skillSnapshot?.sha256, passed: after.assessment?.passed },
    deltas: { durationMs: delta('durationMs'), outputChars: delta('outputChars'), loadedResourceCount: delta('loadedResourceCount') },
    limitation: 'One matched pair is a regression sample, not an improvement rate. Unrecorded host settings and service variability remain uncontrolled.',
  };
}

function compareSeries(before, after) {
  const sides = { before: before.kind === 'series' ? before.runs || [] : [before], after: after.kind === 'series' ? after.runs || [] : [after] };
  const reasons = [];
  for (const [label, runs] of Object.entries(sides)) {
    if (!runs.length) reasons.push(label + ' series has no runs');
    runs.forEach((run, index) => {
      reasons.push(...conditionReasons(runs[0], run, label + ' run ' + (index + 1) + ' '));
      if (run.isolation?.skillSnapshot?.sha256 !== runs[0].isolation?.skillSnapshot?.sha256) reasons.push(label + ' run ' + (index + 1) + ' skill fingerprint differs within series');
      reasons.push(...runReasons(label + ' run ' + (index + 1), run));
    });
  }
  if (sides.before.length && sides.after.length) reasons.push(...conditionReasons(sides.before[0], sides.after[0]));
  if (sides.before.length !== sides.after.length) reasons.push('series sizes differ');
  const comparable = reasons.length === 0;
  const describe = runs => {
    const passed = runs.filter(run => run.assessment?.passed === true).length;
    return { skillSha256: runs[0]?.isolation?.skillSnapshot?.sha256, runs: runs.length, passed, passRate: runs.length ? passed / runs.length : null };
  };
  const delta = field => comparable ? median(sides.after.map(run => run.metrics?.[field])) - median(sides.before.map(run => run.metrics?.[field])) : null;
  const beforeSummary = describe(sides.before);
  const afterSummary = describe(sides.after);
  return {
    comparable, reasons,
    warnings: sameSkillWarnings(beforeSummary.skillSha256, afterSummary.skillSha256),
    conditions: { host: sides.before[0]?.host, case: sides.before[0]?.case, model: sides.before[0]?.model, effort: sides.before[0]?.effort, invocation: sides.before[0]?.invocation },
    before: beforeSummary,
    after: afterSummary,
    passRateDelta: comparable ? afterSummary.passRate - beforeSummary.passRate : null,
    medianDeltas: { durationMs: delta('durationMs'), outputChars: delta('outputChars'), loadedResourceCount: delta('loadedResourceCount') },
    limitation: 'Matched series show a sampled pass-rate difference under recorded conditions, not a population rate. Read every failing run; graders can mistake quoted text for behavior. Any incomplete host run rejects the series; rerun it rather than dropping runs.',
  };
}

function selfTest() {
  const result = {
    host: 'codex', version: 'fixture', case: 'sample', model: 'fixed', effort: 'high', invocation: 'native',
    provenance: { fixtureHead: 'head', contractSha256: 'contract', promptSha256: 'prompt', graderSha256: 'grader', modelSelection: 'explicit' },
    isolation: { skillSnapshot: { sha256: 'old' } }, assessment: { passed: true, execution: { passed: true } }, metrics: { durationMs: 10, outputChars: 100 },
  };
  const changed = structuredClone(result);
  changed.isolation.skillSnapshot.sha256 = 'new';
  changed.metrics.durationMs = 20;
  assert.equal(compare(result, changed).comparable, true);
  assert.equal(compare(result, changed).deltas.durationMs, 10);
  for (const field of ['host', 'version', 'case', 'model', 'effort', 'invocation']) {
    assert.equal(compare(result, { ...changed, [field]: 'different' }).comparable, false, field);
  }
  for (const field of Object.keys(result.provenance)) {
    assert.equal(compare(result, { ...changed, provenance: { ...changed.provenance, [field]: null } }).comparable, false, field);
  }
  assert.equal(compare(result, { ...changed, assessment: undefined }).comparable, false);
  assert.equal(compare(result, { ...changed, assessment: { passed: false, execution: { passed: true } } }).comparable, true);
  const timeout = compare({ ...result, assessment: { passed: false, execution: { passed: false, timedOut: true } } }, changed);
  assert.equal(timeout.comparable, false);
  assert.equal(timeout.deltas.durationMs, null);
  const series = runs => ({ kind: 'series', reps: runs.length, runs });
  const failing = structuredClone(changed);
  failing.assessment.passed = false;
  const seriesResult = compare(series([result, result]), series([changed, failing]));
  assert.equal(seriesResult.comparable, true);
  assert.equal(seriesResult.before.passRate, 1);
  assert.equal(seriesResult.after.passRate, 0.5);
  assert.equal(seriesResult.passRateDelta, -0.5);
  assert.equal(seriesResult.medianDeltas.durationMs, 10);
  assert.deepEqual(seriesResult.warnings, []);
  assert.equal(compare(series([result]), series([result])).warnings.length, 1);
  assert.equal(compare(result, result).warnings.length, 1);
  const incomplete = structuredClone(changed);
  incomplete.assessment.execution.passed = false;
  assert.equal(compare(series([result, result]), series([changed, incomplete])).comparable, false);
  assert.equal(compare(series([result, result]), series([changed])).comparable, false);
  const drifted = structuredClone(changed);
  drifted.isolation.skillSnapshot.sha256 = 'other';
  assert.equal(compare(series([result, result]), series([changed, drifted])).comparable, false);
  console.log('ok paired eval comparison rejects incompatible or unpinned results');
  console.log('ok series comparison reports pass rates and rejects incomplete or mixed series');
}

if (process.argv[2] === '--self-test') selfTest();
else if (process.argv.length !== 4) {
  console.error('Usage: node scripts/compare-host-evals.js <before.json> <after.json> | --self-test');
  process.exitCode = 2;
} else {
  try {
    const result = compare(...process.argv.slice(2).map(file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''))));
    console.log(JSON.stringify(result, null, 2));
    if (!result.comparable) process.exitCode = 2;
  } catch (error) {
    console.error('ERROR: ' + error.message);
    process.exitCode = 2;
  }
}
