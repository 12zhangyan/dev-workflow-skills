#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const HTTP_METHODS = new Set(['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace']);

function fail(message) {
  throw new Error(message);
}

function walkRefs(value, refs = []) {
  if (!value || typeof value !== 'object') return refs;
  if (typeof value.$ref === 'string') refs.push(value.$ref);
  for (const child of Object.values(value)) walkRefs(child, refs);
  return refs;
}

function resolvePointer(doc, ref) {
  // This check resolves JSON Pointers; external refs and named anchors are outside its scope.
  if (!ref.startsWith('#/')) return true;
  let pointer;
  try { pointer = decodeURIComponent(ref.slice(1)); } catch (_) { return false; }
  if (pointer === '') return true;
  if (!pointer.startsWith('/')) return false;
  let current = doc;
  for (const rawPart of pointer.slice(1).split('/')) {
    if (/~(?:[^01]|$)/.test(rawPart)) return false;
    const part = rawPart.replace(/~1/g, '/').replace(/~0/g, '~');
    if (!current || typeof current !== 'object' || !Object.prototype.hasOwnProperty.call(current, part)) return false;
    current = current[part];
  }
  return true;
}

function validateParsed(doc) {
  if (!doc || typeof doc !== 'object') fail('document root must be an object');
  if (typeof doc.openapi !== 'string' || !doc.openapi.startsWith('3.')) fail('openapi must declare a 3.x version');
  if (!doc.paths || typeof doc.paths !== 'object' || Array.isArray(doc.paths)) fail('paths must be a non-empty object');

  const ids = new Set();
  let operationCount = 0;
  for (const [apiPath, pathItem] of Object.entries(doc.paths)) {
    if (!apiPath.startsWith('/') || !pathItem || typeof pathItem !== 'object') continue;
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!HTTP_METHODS.has(method.toLowerCase())) continue;
      operationCount += 1;
      const operationId = operation && operation.operationId;
      if (typeof operationId !== 'string' || !operationId.trim()) fail(`${method.toUpperCase()} ${apiPath} missing operationId`);
      if (ids.has(operationId)) fail(`duplicate operationId: ${operationId}`);
      ids.add(operationId);
    }
  }
  if (operationCount === 0) fail('paths contains no HTTP operations');
  for (const ref of walkRefs(doc)) {
    if (!resolvePointer(doc, ref)) fail(`unresolved local $ref: ${ref}`);
  }
  return [...ids];
}

function optionalParser() {
  for (const name of ['yaml', 'js-yaml']) {
    try {
      const resolved = require.resolve(name, { paths: [process.cwd(), __dirname] });
      const pkg = require(resolved);
      return { name, parse: name === 'yaml' ? pkg.parse : pkg.load };
    } catch (_) {
      // Optional parser is not installed; deterministic light validation remains available.
    }
  }
  return null;
}

function validateText(raw) {
  // A regex cannot resolve arbitrary YAML mappings, aliases or JSON Pointers.
  // Refuse incomplete validation instead of blessing only the schemas subset.
  if (/\$ref["']?\s*:/.test(raw)) {
    fail('OPENAPI_VALIDATION_UNAVAILABLE: YAML $ref validation requires yaml/js-yaml; use a JSON-form document for dependency-free validation');
  }
  if (!/^openapi:\s*["']?3\./m.test(raw)) fail('missing OpenAPI 3.x declaration');
  const lines = raw.split(/\r?\n/);
  const indentOf = (line) => (line.match(/^\s*/) || [''])[0].length;
  const pathsIndex = lines.findIndex((line) => /^\s*paths:\s*$/.test(line));
  if (pathsIndex < 0) fail('missing paths mapping');
  const pathsIndent = indentOf(lines[pathsIndex]);
  let currentPath = null;
  let currentPathIndent = -1;
  const operationIds = [];

  for (let i = pathsIndex + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const indent = indentOf(line);
    if (indent <= pathsIndent) break;
    const pathMatch = line.match(/^\s*(\/[^:]*):\s*$/);
    if (pathMatch) {
      currentPath = pathMatch[1];
      currentPathIndent = indent;
      continue;
    }
    const keyMatch = line.match(/^\s*([A-Za-z]+):\s*$/);
    if (!currentPath || !keyMatch || indent <= currentPathIndent || !HTTP_METHODS.has(keyMatch[1].toLowerCase())) continue;
    const method = keyMatch[1].toLowerCase();
    let operationId = '';
    for (let j = i + 1; j < lines.length; j += 1) {
      const child = lines[j];
      if (!child.trim() || child.trimStart().startsWith('#')) continue;
      if (indentOf(child) <= indent) break;
      const idMatch = child.match(/^\s*operationId:\s*["']?([^\s"'#]+)["']?\s*$/);
      if (idMatch) operationId = idMatch[1];
    }
    if (!operationId) fail(`${method.toUpperCase()} ${currentPath} missing operationId`);
    operationIds.push(operationId);
  }
  if (operationIds.length === 0) fail('paths contains no HTTP operations');
  const duplicates = operationIds.filter((id, index) => operationIds.indexOf(id) !== index);
  if (duplicates.length) fail(`duplicate operationId: ${[...new Set(duplicates)].join(',')}`);

  return operationIds;
}

function validateRaw(raw, parser) {
  // JSON is also a YAML-compatible representation; it needs no optional parser.
  if (raw.trimStart().startsWith('{')) {
    let json;
    try { json = JSON.parse(raw); } catch (error) {
      if (!parser) fail('OPENAPI_VALIDATION_UNAVAILABLE: invalid JSON or flow-style YAML; a YAML parser is required');
    }
    if (json !== undefined) return { mode: 'full:json', operationIds: validateParsed(json) };
  }
  const operationIds = parser ? validateParsed(parser.parse(raw)) : validateText(raw);
  return { mode: parser ? `full:${parser.name}` : 'light:no-yaml-parser', operationIds };
}

function validateFile(file) {
  const raw = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  return validateRaw(raw, optionalParser());
}

function selfTest() {
  const valid = 'openapi: "3.0.3"\npaths:\n  /ping:\n    get:\n      operationId: ping\n      responses:\n        "200":\n          description: ok\n';
  const ids = validateText(valid);
  if (ids.join(',') !== 'ping') fail('self-test operationId mismatch');
  let duplicateRejected = false;
  try {
    validateText(`${valid}  /pong:\n    get:\n      operationId: ping\n`);
  } catch (error) {
    duplicateRejected = error.message.includes('duplicate operationId');
  }
  if (!duplicateRejected) fail('self-test did not reject duplicate operationId');
  const flexibleIndent = 'openapi: 3.0.3\npaths:\n    /items:\n        post:\n            operationId: createItem\n            responses:\n                "200":\n                    description: ok\ncomponents:\n    schemas:\n        Item:\n            type: object\n';
  if (validateText(flexibleIndent).join(',') !== 'createItem') fail('self-test rejected valid flexible indentation');
  let misplacedRejected = false;
  try {
    validateText('openapi: 3.0.3\npaths:\n  /ping:\n    parameters:\n      operationId: notAnOperation\n');
  } catch (error) {
    misplacedRejected = error.message.includes('no HTTP operations');
  }
  if (!misplacedRejected) fail('self-test accepted operationId outside an HTTP operation');
  for (const section of ['schemas', 'parameters', 'responses', 'requestBodies', 'headers']) {
    const ref = `#/components/${section}/Example`;
    const doc = {
      openapi: '3.0.3',
      paths: { '/ping': { get: { operationId: 'ping', responses: { '200': { $ref: ref } } } } },
      components: { [section]: { Example: { description: 'fixture' } } }
    };
    if (validateRaw(JSON.stringify(doc), null).mode !== 'full:json') fail('JSON reference validation unavailable');
    delete doc.components[section].Example;
    let rejected = false;
    try { validateRaw(JSON.stringify(doc), null); } catch (error) { rejected = error.message.includes('unresolved local $ref'); }
    if (!rejected) fail(`missing ${section} reference was accepted`);
    rejected = false;
    try { validateRaw(`${valid}components:\n  ${section}:\n    Example:\n      $ref: "${ref}"\n`, null); }
    catch (error) { rejected = error.message.includes('OPENAPI_VALIDATION_UNAVAILABLE'); }
    if (!rejected) fail(`YAML ${section} reference silently passed without a parser`);
  }
  const pointerDoc = { components: { schemas: { 'A/B ~': { type: 'string' } } } };
  if (!resolvePointer(pointerDoc, '#/components/schemas/A~1B%20~0')) fail('escaped local pointer was rejected');
  if (resolvePointer(pointerDoc, '#/components/schemas/toString')) fail('inherited property was accepted as a ref');
  console.log('ok validate-openapi self-test passed');
}

try {
  if (process.argv[2] === '--self-test') {
    selfTest();
  } else {
    const input = process.argv[2];
    if (!input) fail('usage: validate-openapi.js <openapi.yaml> | --self-test');
    const file = path.resolve(input);
    if (!fs.existsSync(file)) fail(`file not found: ${file}`);
    const result = validateFile(file);
    console.log(`OPENAPI_VALIDATION_MODE=${result.mode}`);
    console.log(`ok OpenAPI validation passed (${result.mode}); operationIds=${result.operationIds.join(',')}`);
    if (result.mode.startsWith('light:')) console.log('note: YAML parser and actual Apifox import were not verified');
  }
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  process.exit(1);
}
