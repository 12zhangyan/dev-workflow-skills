#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');

let failed = false;

function fail(message) {
  failed = true;
  console.error('FAIL: ' + message);
}

// When a real svn client is installed, confirm the failure signals named in skills/_shared/workflow-gates.md match its actual output,
// and that the allowed commands work inside a working copy without the server.
{
  const run = (command, args, cwd) => spawnSync(command, args, { cwd, encoding: 'utf8', windowsHide: true, timeout: 30000 });
  const svnAvailable = run('svn', ['--version', '--quiet']).status === 0 && run('svnversion', ['--version', '--quiet']).status === 0;
  if (!svnAvailable) {
    console.log('note: svn client not installed; skipped the live svn signal probe');
  } else {
    const probeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'svn-signal-probe-'));
    try {
      const outside = path.join(probeRoot, 'not-a-working-copy');
      fs.mkdirSync(path.join(outside, 'project-html'), { recursive: true });
      for (const args of [['status', '--non-interactive'], ['status', '--non-interactive', 'project-html']]) {
        const result = run('svn', args, outside);
        if (result.status !== 0 || result.stdout.trim() || !/svn: warning: W155007/.test(result.stderr)) {
          fail(`svn ${args.join(' ')} outside a working copy no longer looks like "exit 0, empty stdout, W155007 warning" (exit ${result.status}); update the SVN failure signals in workflow-gates.md`);
        }
      }
      const unversioned = run('svnversion', [], outside);
      if (unversioned.status !== 0 || /^\d+(?::\d+)?[MSP]*$/.test(unversioned.stdout.trim())) {
        fail(`svnversion outside a working copy should exit 0 with a non-revision result; got exit ${unversioned.status}: ${unversioned.stdout.trim()}`);
      } else if (unversioned.stdout.trim() !== 'Unversioned directory') {
        console.log(`note: svnversion printed "${unversioned.stdout.trim()}" (localized?); the rule also covers other non-revision results`);
      }
      if (run('svnversion', ['--non-interactive'], outside).status === 0) {
        fail('svnversion now accepts --non-interactive; the "不带参数的 svnversion" rule can be relaxed');
      }

      if (run('svnadmin', ['--version', '--quiet']).status === 0) {
        const repo = path.join(probeRoot, 'repo');
        const wc = path.join(probeRoot, 'wc');
        const url = 'file:///' + repo.replace(/\\/g, '/').replace(/^\//, '');
        const steps = [
          ['svnadmin', ['create', repo], probeRoot],
          ['svn', ['checkout', '--quiet', '--non-interactive', url, wc], probeRoot],
        ];
        for (const [command, args, cwd] of steps) {
          const result = run(command, args, cwd);
          if (result.status !== 0) throw new Error(`${command} ${args[0]} failed: ${result.stderr}`);
        }
        fs.writeFileSync(path.join(wc, 'A.java'), 'a\n');
        for (const args of [['add', '--quiet', 'A.java'], ['commit', '--quiet', '--non-interactive', '-m', 'probe']]) {
          const result = run('svn', args, wc);
          if (result.status !== 0) throw new Error(`fixture svn ${args[0]} failed: ${result.stderr}`);
        }
        fs.writeFileSync(path.join(wc, 'A.java'), 'a\nb\n');
        fs.writeFileSync(path.join(wc, 'NewTest.java'), 'new\n');
        fs.renameSync(repo, repo + '-unreachable');
        const atRoot = run('svn', ['status', '--non-interactive'], wc);
        const byPath = run('svn', ['status', '--non-interactive', path.join(wc, 'A.java'), path.join(wc, 'NewTest.java')], outside);
        for (const [label, result] of [['at the working-copy root', atRoot], ['with file paths from outside', byPath]]) {
          if (result.status !== 0 || !/^M\s+.*A\.java$/m.test(result.stdout) || !/^\?\s+.*NewTest\.java$/m.test(result.stdout) || /svn: warning/.test(result.stderr)) {
            fail(`svn status ${label} should list M A.java and ? NewTest.java without the server: ${result.stdout}${result.stderr}`);
          }
        }
        const version = run('svnversion', [], wc);
        if (version.status !== 0 || !/^\d+(?::\d+)?M$/.test(version.stdout.trim())) {
          fail(`svnversion inside the working copy should report a modified revision without the server: ${version.stdout}${version.stderr}`);
        }
        const networked = run('svn', ['log', '--non-interactive', '-l', '1'], wc);
        if (networked.status === 0) fail('svn log unexpectedly worked without the repository; recheck the networked-command list');
        console.log('ok live svn probe: failure signals outside a working copy and offline status/svnversion inside one match the rule');
      } else {
        console.log('ok live svn probe: failure signals outside a working copy match the rule (svnadmin not installed; offline working-copy probe skipped)');
      }
    } catch (error) {
      fail('svn signal probe could not run: ' + error.message);
    } finally {
      fs.rmSync(probeRoot, { recursive: true, force: true });
    }
  }
}

// Networked or writing svn commands may only appear inside a prohibition, in skill text and eval expectations alike.
{
  const forbiddenSvn = /svn (?:log|update|commit|add|revert|blame|cleanup|upgrade|resolve|delete|move|propset|lock)\b|status -u|`(?:log|update|commit|add|revert|blame|cleanup|upgrade)`/;
  const negation = /不|禁止|禁用|勿/;
  const svnContext = /svn|SVN/;
  const offending = [];
  const scan = (where, text) => {
    for (const sentence of text.split(/[。；;\n]/)) {
      if (svnContext.test(sentence) && forbiddenSvn.test(sentence) && !negation.test(sentence)) offending.push(`${where}: ${sentence.trim().slice(0, 120)}`);
    }
  };
  const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
  for (const file of walk(path.join(root, 'skills'))) {
    const rel = path.relative(root, file).replace(/\\/g, '/');
    if (rel.includes('/assets/')) continue;
    if (rel.endsWith('.md')) scan(rel, fs.readFileSync(file, 'utf8'));
    if (rel.endsWith('evals.json')) {
      const suite = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
      for (const ev of suite.evals || []) scan(`${rel}#${ev.id}`, ev.expected_output || '');
    }
  }
  if (offending.length) fail('networked or writing svn commands must only appear as prohibitions:\n  ' + offending.join('\n  '));

  // Removed concepts must not come back through eval expectations, where no prose check would see them.
  const retired = [
    [/BoardPublishOwner/, 'BoardPublishOwner is not a skill concept; the coordinator is the only board publisher'],
    [/审查清单/, 'check mode has no fixed review checklist'],
    [/写入 ReviewScopeType/, 'the board review event field is scopeType'],
  ];
  const stale = [];
  for (const file of walk(path.join(root, 'skills'))) {
    const rel = path.relative(root, file).replace(/\\/g, '/');
    if (rel.includes('/assets/') || !(rel.endsWith('.md') || rel.endsWith('evals.json'))) continue;
    const text = fs.readFileSync(file, 'utf8');
    for (const [pattern, why] of retired) if (pattern.test(text)) stale.push(`${rel}: ${why}`);
  }
  if (stale.length) fail('retired review concepts reappeared:\n  ' + stale.join('\n  '));
}

function listMarkdown(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listMarkdown(full);
    return entry.name.endsWith('.md') ? [full] : [];
  });
}

const obsoleteReceiptPatterns = [
  [/BoardPublishStatus[^\n]*NotRequested/, 'board status placeholder when nothing was published'],
  [/RepairCycles\s*:\s*<\s*0\s*\|\s*1\s*\|\s*2\s*>/, 'fixed repair-cycle cap'],
];
for (const file of listMarkdown(path.join(root, 'skills'))) {
  const rel = path.relative(root, file).replace(/\\/g, '/');
  const text = fs.readFileSync(file, 'utf8');
  for (const [pattern, label] of obsoleteReceiptPatterns) {
    if (pattern.test(text)) fail(`${rel} reintroduces ${label}`);
  }
}

if (failed) process.exit(1);
console.log('ok review boundary checks passed');
