#!/usr/bin/env node
'use strict';

function queryOrders(rows, tenantId, options = {}) {
  const { keyword = '', offset = 0, limit = 20 } = options;
  if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 0) {
    throw new RangeError('offset and limit must be non-negative integers');
  }
  const page = rows.slice(offset, offset + limit);
  const items = page.filter(row => row.tenantId === tenantId && row.name.includes(keyword));
  return { items, total: rows.length };
}

module.exports = { queryOrders };
