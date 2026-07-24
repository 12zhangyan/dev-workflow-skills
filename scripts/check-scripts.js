#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
function listJs(dir) {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...listJs(full));
    else if (entry.name.endsWith('.js')) result.push(path.relative(root, full).replace(/\\/g, '/'));
  }
  return result;
}

const files = [
  ...listJs(path.join(root, 'scripts')),
  ...listJs(path.join(root, 'skills')).filter((rel) => rel.includes('/scripts/')),
].sort();

let failed = false;

function fail(message) {
  failed = true;
  console.error('FAIL: ' + message);
}

for (const file of files) {
  const rel = file;
  const full = path.join(root, rel);
  const text = fs.readFileSync(full, 'utf8');
  if (!/^#!\/usr\/bin\/env node\r?\n/.test(text)) fail(`${rel} must start with a node shebang`);
  if (!text.includes("'use strict';")) fail(`${rel} must enable strict mode`);

  const result = spawnSync('node', ['--check', rel], { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) {
    fail(`${rel} has a syntax error`);
    if (result.stdout) process.stderr.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
  }
}

const validator = 'skills/yan-dev-doc/scripts/validate-openapi.js';
const selfTest = spawnSync('node', [validator, '--self-test'], { cwd: root, encoding: 'utf8' });
if (selfTest.status !== 0) {
  fail(`${validator} self-test failed`);
  if (selfTest.stdout) process.stderr.write(selfTest.stdout);
  if (selfTest.stderr) process.stderr.write(selfTest.stderr);
}

for (const scriptSelfTest of ['scripts/check-docs.js', 'scripts/check-evals.js', 'scripts/check-skill-metadata.js', 'scripts/check-skill-inventory.js', 'scripts/check-workflow-briefs.js']) {
  const result = spawnSync('node', [scriptSelfTest, '--self-test'], { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) {
    fail(`${scriptSelfTest} self-test failed`);
    if (result.stdout) process.stderr.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
  }
}

const devDocOpenApi = fs.readFileSync(path.join(root, 'skills/yan-dev-doc/publishing-openapi.md'), 'utf8');
const fallbackMatch = devDocOpenApi.match(/<!-- OPENAPI_WORKSPACE_FALLBACK_START -->\s*```javascript\r?\n([\s\S]*?)\r?\n```\s*<!-- OPENAPI_WORKSPACE_FALLBACK_END -->/);
if (!fallbackMatch) {
  fail('skills/yan-dev-doc/publishing-openapi.md missing executable OpenAPI workspace fallback block');
} else {
  const tempDir = fs.mkdtempSync(path.join(root, '.openapi-fallback-test-'));
  const validFile = path.join(tempDir, 'valid.openapi.yaml');
  const invalidFile = path.join(tempDir, 'duplicate.openapi.yaml');
  try {
    const valid = 'openapi: 3.0.3\npaths:\n  /compensate:\n    post:\n      operationId: compensate\n      responses:\n        "200":\n          description: ok\n';
    const invalid = `${valid}  /retry:\n    post:\n      operationId: compensate\n`;
    fs.writeFileSync(validFile, valid, 'utf8');
    fs.writeFileSync(invalidFile, invalid, 'utf8');
    const fallbackOk = spawnSync('node', ['-e', fallbackMatch[1], validFile], { cwd: root, encoding: 'utf8' });
    if (fallbackOk.status !== 0 || !fallbackOk.stdout.includes('OPENAPI_VALIDATION_MODE=light:workspace-inline')) {
      fail('OpenAPI workspace fallback rejected a valid fixture or omitted its validation mode');
      if (fallbackOk.stdout) process.stderr.write(fallbackOk.stdout);
      if (fallbackOk.stderr) process.stderr.write(fallbackOk.stderr);
    }
    const fallbackReject = spawnSync('node', ['-e', fallbackMatch[1], invalidFile], { cwd: root, encoding: 'utf8' });
    if (fallbackReject.status === 0 || !fallbackReject.stderr.includes('duplicate operationId')) {
      fail('OpenAPI workspace fallback did not reject duplicate operationId');
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

if (failed) process.exit(1);
console.log(`ok script checks passed (${files.length} scripts)`);
