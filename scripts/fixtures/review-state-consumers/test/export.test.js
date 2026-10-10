#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { exportCompleted } = require('../src/export');

test('export includes completed orders only', () => {
  const rows = [{ id: 1, status: 'COMPLETED' }, { id: 2, status: 'PARTIAL' }];
  assert.deepEqual(exportCompleted(rows), [rows[0]]);
});
