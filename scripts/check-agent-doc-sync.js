#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const agentsPath = path.join(root, 'AGENTS.md');
const claudePath = path.join(root, 'CLAUDE.md');

function read(file) {
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

const agents = read(agentsPath);
const claude = read(claudePath);

const expectedClaude = agents
  .replace('# AGENTS.md', '# CLAUDE.md')
  .replace(
    'This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.',
    'This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.'
  )
  .replace('This is the AGENTS.md Rule 5', 'This is the CLAUDE.md Rule 5');

if (claude !== expectedClaude) {
  console.error('FAIL: CLAUDE.md is out of sync with AGENTS.md.');
  console.error('Update AGENTS.md first, then mirror it to CLAUDE.md with only the documented title/tool-name differences.');
  process.exit(1);
}

console.log('ok AGENTS.md and CLAUDE.md are in sync.');
