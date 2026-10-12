#!/usr/bin/env node
'use strict';

const accepted = new Set(['DRAFT', 'READY', 'PARTIAL']);

function submit(status) {
  if (!accepted.has(status)) throw new Error('unsupported status');
  return { status };
}

module.exports = { submit };
