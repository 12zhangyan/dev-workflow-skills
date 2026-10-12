#!/usr/bin/env node
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { quote, DISCOUNT_RATE } = require('../src/quote');
for (const subtotal of [100, 80, 0]) {
  test('quote for ' + subtotal, () => {
    const expected = Math.round(subtotal * (1 - DISCOUNT_RATE) * 100) / 100;
    assert.equal(quote(subtotal), expected);
  });
}
test('reject invalid subtotal', () => {
  assert.throws(() => quote(-1), RangeError);
  assert.throws(() => quote(NaN), RangeError);
});
