#!/usr/bin/env node
'use strict';

function exportCompleted(orders) {
  return orders.filter(order => order.status === 'COMPLETED');
}

module.exports = { exportCompleted };
