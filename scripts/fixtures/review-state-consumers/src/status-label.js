#!/usr/bin/env node
'use strict';

function statusLabel(status) {
  const labels = { DRAFT: 'Draft', READY: 'Ready' };
  return labels[status] || 'Unknown';
}

module.exports = { statusLabel };
