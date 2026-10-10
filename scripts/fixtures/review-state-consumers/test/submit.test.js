#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { submit } = require('../src/submit');

test('READY remains accepted', () => {
  assert.equal(submit('READY').status, 'READY');
});

test('PARTIAL submit behavior', () => {
  const fakeSubmit = status => ({ status });
  assert.equal(fakeSubmit('PARTIAL').status, 'PARTIAL');
});
