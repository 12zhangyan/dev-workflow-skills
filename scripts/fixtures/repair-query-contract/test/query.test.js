#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { queryOrders } = require('../src/query');

const rows = [
  { id: 1, tenantId: 'other', name: 'pump' },
  { id: 2, tenantId: 'mine', name: 'pump A' },
  { id: 3, tenantId: 'mine', name: 'valve' },
  { id: 4, tenantId: 'mine', name: 'pump B' }
];

test('filters before pagination and computes filtered total', () => {
  const result = queryOrders(rows, 'mine', { keyword: 'pump', limit: 1 });
  assert.deepEqual(result.items.map(row => row.id), [2]);
  assert.equal(result.total, 2);
});

test('next page is indexed within matching rows', () => {
  const result = queryOrders(rows, 'mine', { keyword: 'pump', offset: 1, limit: 1 });
  assert.deepEqual(result.items.map(row => row.id), [4]);
  assert.equal(result.total, 2);
});

test('empty page preserves matching total', () => {
  assert.deepEqual(queryOrders(rows, 'mine', { keyword: 'pump', limit: 0 }), { items: [], total: 2 });
});

test('tenant without rows receives empty result and zero total', () => {
  assert.deepEqual(queryOrders(rows, 'absent'), { items: [], total: 0 });
});

test('input order and contents stay unchanged', () => {
  const before = JSON.stringify(rows);
  queryOrders(rows, 'mine');
  assert.equal(JSON.stringify(rows), before);
});

test('negative or fractional page arguments remain invalid', () => {
  for (const options of [{ offset: -1 }, { offset: 0.5 }, { limit: -1 }, { limit: 0.5 }]) {
    assert.throws(() => queryOrders(rows, 'mine', options), RangeError);
  }
});
