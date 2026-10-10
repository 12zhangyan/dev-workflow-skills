#!/usr/bin/env node
'use strict';

// Trusted fixture grader, outside the agent workspace. Not an OS security sandbox.
const assert = require('node:assert/strict');
const path = require('node:path');
const { queryOrders } = require(path.join(path.resolve(process.argv[2]), 'src', 'query.js'));
const rows = [
  { id: 1, tenantId: 'other', name: 'apple' },
  { id: 2, tenantId: 'owner', name: 'apricot' },
  { id: 3, tenantId: 'owner', name: 'apple' },
  { id: 4, tenantId: 'owner', name: 'Apple' },
  { id: 5, tenantId: 'owner', name: 'pear' },
  { id: 6, tenantId: 'owner', name: 'pineapple' },
];
// Capture expected input before any candidate call can mutate shared test data.
const originalRows = JSON.stringify(rows);
const checks = [];
function check(name, verify) {
  try { verify(); checks.push({ name, passed: true }); }
  catch (error) { checks.push({ name, passed: false, error: error.message.slice(0, 1000) }); }
}
check('filter-before-pagination-and-total', () => {
  assert.deepEqual(queryOrders(rows, 'owner', { keyword: 'apple', offset: 1, limit: 1 }), { items: [rows[5]], total: 2 });
});
check('tenant-isolation-and-default-page', () => {
  assert.deepEqual(queryOrders(rows, 'owner'), { items: rows.slice(1), total: 5 });
});
check('empty-tenant', () => {
  assert.deepEqual(queryOrders(rows, 'missing'), { items: [], total: 0 });
});
check('case-sensitive-keyword', () => {
  assert.deepEqual(queryOrders(rows, 'owner', { keyword: 'Apple' }), { items: [rows[3]], total: 1 });
});
check('zero-limit-retains-total', () => {
  assert.deepEqual(queryOrders(rows, 'owner', { keyword: 'apple', limit: 0 }), { items: [], total: 2 });
});
check('out-of-range-page-retains-total', () => {
  assert.deepEqual(queryOrders(rows, 'owner', { offset: 20 }), { items: [], total: 5 });
});
check('invalid-pagination-still-rejected', () => {
  for (const options of [{ offset: -1 }, { limit: -1 }, { offset: 0.5 }, { limit: 1.5 }]) {
    assert.throws(() => queryOrders(rows, 'owner', options), RangeError);
  }
});
check('input-preserved', () => {
  assert.deepEqual(rows, JSON.parse(originalRows));
  const input = JSON.parse(originalRows);
  queryOrders(input, 'owner', { keyword: 'apple', limit: 1 });
  assert.deepEqual(input, JSON.parse(originalRows));
});
const passed = checks.every(item => item.passed);
console.log(JSON.stringify({ passed, checks }));
process.exitCode = passed ? 0 : 1;
