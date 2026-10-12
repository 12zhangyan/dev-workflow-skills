#!/usr/bin/env node
'use strict';
const DISCOUNT_RATE = 0.15;
function quote(subtotal) {
  if (!Number.isFinite(subtotal) || subtotal < 0) throw new RangeError('invalid subtotal');
  return Math.round(subtotal * (1 - DISCOUNT_RATE) * 100) / 100;
}
module.exports = { quote, DISCOUNT_RATE };
