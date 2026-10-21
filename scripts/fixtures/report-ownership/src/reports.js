#!/usr/bin/env node
'use strict';

const reports = new Map([
  ['r1', { id: 'r1', ownerId: 'alice', title: 'Q3 revenue' }],
  ['r2', { id: 'r2', ownerId: 'bob', title: 'Q3 churn' }],
]);

function getReport(currentUser, reportId) {
  const report = reports.get(reportId);
  if (!report) throw new Error('REPORT_NOT_FOUND');
  return { ...report };
}

module.exports = { getReport };
