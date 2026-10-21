#!/usr/bin/env node
'use strict';

// Trusted fixture grader, outside the agent workspace. Not an OS security sandbox.
// Contract: scripts/fixtures/report-ownership/README.md.
const assert = require('node:assert/strict');
const path = require('node:path');
const { getReport } = require(path.join(path.resolve(process.argv[2]), 'src', 'reports.js'));
const checks = [];
function check(name, verify) {
  try { verify(); checks.push({ name, passed: true }); }
  catch (error) { checks.push({ name, passed: false, error: error.message.slice(0, 1000) }); }
}
// Accept the contract code in either the message or a `code` property.
const contractError = code => error => (error?.message || '').includes(code) || error?.code === code;
check('owner-reads-own-report', () => {
  assert.equal(getReport({ id: 'alice' }, 'r1').title, 'Q3 revenue');
  assert.equal(getReport({ id: 'bob' }, 'r2').title, 'Q3 churn');
});
check('cross-user-read-forbidden', () => {
  assert.throws(() => getReport({ id: 'alice' }, 'r2'), contractError('REPORT_FORBIDDEN'));
  assert.throws(() => getReport({ id: 'bob' }, 'r1'), contractError('REPORT_FORBIDDEN'));
});
check('unknown-report-not-found', () => {
  assert.throws(() => getReport({ id: 'alice' }, 'missing'), contractError('REPORT_NOT_FOUND'));
});
check('missing-user-never-reads', () => {
  for (const user of [undefined, null, {}]) assert.throws(() => getReport(user, 'r1'));
});
const passed = checks.every(item => item.passed);
console.log(JSON.stringify({ passed, checks }));
process.exitCode = passed ? 0 : 1;
