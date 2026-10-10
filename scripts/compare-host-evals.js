#!/usr/bin/env node
'use strict';

const fs = require('fs');
const assert = require('assert/strict');

function compare(before, after) {
  const reasons = [];
  for (const field of ['host', 'version', 'case', 'model', 'invocation']) {
    if (!before[field] || before[field] !== after[field]) reasons.push(field + ' missing or different');
  }
  if (before.effort !== after.effort || (before.host === 'codex' && !before.effort)) reasons.push('effort missing or different');
  for (const field of ['fixtureHead', 'contractSha256', 'promptSha256', 'graderSha256']) {
    if (!before.provenance?.[field] || before.provenance[field] !== after.provenance?.[field]) reasons.push(field + ' missing or different');
  }
  for (const [label, result] of [['before', before], ['after', after]]) {
    if (result.provenance?.modelSelection !== 'explicit') reasons.push(label + ' model is not pinned');
    if (!result.isolation?.skillSnapshot?.sha256) reasons.push(label + ' skill fingerprint missing');
    if (typeof result.assessment?.passed !== 'boolean') reasons.push(label + ' assessment missing');
    if (result.assessment?.execution?.passed !== true) reasons.push(label + ' host execution incomplete');
  }
  const comparable = reasons.length === 0;
  const delta = field => comparable && Number.isFinite(before.metrics?.[field]) && Number.isFinite(after.metrics?.[field])
    ? after.metrics[field] - before.metrics[field] : null;
  return {
    comparable, reasons,
    conditions: { host: before.host, case: before.case, model: before.model, effort: before.effort, invocation: before.invocation },
    before: { skillSha256: before.isolation?.skillSnapshot?.sha256, passed: before.assessment?.passed },
    after: { skillSha256: after.isolation?.skillSnapshot?.sha256, passed: after.assessment?.passed },
    deltas: { durationMs: delta('durationMs'), outputChars: delta('outputChars'), loadedResourceCount: delta('loadedResourceCount') },
    limitation: 'One matched pair is a regression sample, not an improvement rate. Unrecorded host settings and service variability remain uncontrolled.',
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
  console.log('ok paired eval comparison rejects incompatible or unpinned results');
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
