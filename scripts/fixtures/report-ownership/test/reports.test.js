'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { getReport } = require('../src/reports');

test('owner reads own report', () => {
  assert.equal(getReport({ id: 'alice' }, 'r1').title, 'Q3 revenue');
});

test('unknown report is rejected', () => {
  assert.throws(() => getReport({ id: 'alice' }, 'missing'), /REPORT_NOT_FOUND/);
});
