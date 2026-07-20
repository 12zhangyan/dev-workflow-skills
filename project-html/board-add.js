#!/usr/bin/env node
/* 看板写入助手 — 各 skill 提供独立撰写的人类方案 entry，本脚本确定性拆成：
 *   data/changes.js              轻量目录（首页 / 搜索 / 筛选）
 *   data/details/<detailId>.js  人类方案详情（点击后加载）
 *
 * 用法：
 *   node project-html/board-add.js <entry.json>
 *   node project-html/board-add.js --migrate   # 将现有富 entry 确定性拆分
 *
 * md 是 Agent 执行文档，entry 是人类方案；本脚本不读取或摘录 md，只共享 docPath 等结构元数据。
 * 与 skills/dev-doc/assets/board/board-add.js 保持一致，修改时两处同步。 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BOARD_DIR = __dirname;
const DATA = path.join(BOARD_DIR, 'data', 'changes.js');
const DETAILS_DIR = path.join(BOARD_DIR, 'data', 'details');
const BAK = DATA + '.bak';
const CATALOG_KEYS = [
  'kind', 'service', 'module', 'title', 'date', 'updatedAt', 'createdAt',
  'type', 'complexity', 'status', 'severity', 'branch', 'docPath',
  'apiSpecPath', 'apiIndexPath', 'apis', 'lifecycle', 'pinned'
];
const EXECUTION_ONLY = new Set(['changeList', 'todos', 'stackTrace', 'codeLocation']);
const GENERATED = new Set(['detailId', 'detailPath', 'summary', 'searchText']);
const CATALOG_HEADER = `

// ─── 轻量目录数据 ────────────────────────────────────────────────────────────
// 首页、搜索和筛选只读取这里；人类方案正文位于 data/details/<detailId>.js，点击后加载。
// md 是 Agent 执行文档；看板详情是独立撰写的人类方案，不是 md 摘录。
// Agent 专属字段 changeList / todos / stackTrace / codeLocation 禁止进入目录和详情。
// 目录字段由 board-add.js 白名单控制；禁止手工整体重写本文件。
`;

function die(msg) { console.error('✗ ' + msg); process.exit(1); }
function today() { return new Date().toISOString().slice(0, 10); }
function exists(file) { try { fs.accessSync(file); return true; } catch (e) { return false; } }
function emit(obj) { return JSON.stringify(obj, null, 2).split('\n').map(l => '  ' + l).join('\n'); }
function detailIdOf(entry) {
  const stable = entry.docPath || [entry.service, entry.module, entry.date, entry.title].filter(Boolean).join('::');
  return 'd-' + crypto.createHash('sha1').update(stable || JSON.stringify(entry)).digest('hex').slice(0, 16);
}
function firstSentence(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  const match = text.match(/^[^。！？!?]+[。！？!?]?/);
  return (match ? match[0] : text).slice(0, 180);
}
function collectStrings(value, out, limit) {
  if (typeof value === 'string') out.push(value.slice(0, limit));
  else if (Array.isArray(value)) value.slice(0, 6).forEach(v => collectStrings(v, out, limit));
  else if (value && typeof value === 'object') Object.values(value).slice(0, 6).forEach(v => collectStrings(v, out, limit));
}
function humanDetailOf(entry, explicitDetail) {
  const source = explicitDetail && typeof explicitDetail === 'object' ? explicitDetail : entry;
  const detail = {};
  for (const [key, value] of Object.entries(source)) {
    if (CATALOG_KEYS.includes(key) || GENERATED.has(key) || EXECUTION_ONLY.has(key)) continue;
    detail[key] = value;
  }
  return detail;
}
function splitEntry(entry, explicitDetail) {
  const detail = humanDetailOf(entry, explicitDetail);
  const catalog = {};
  for (const key of CATALOG_KEYS) {
    if (Object.prototype.hasOwnProperty.call(entry, key)) catalog[key] = entry[key];
  }
  const detailId = entry.detailId || detailIdOf(entry);
  const lead = entry.summary || detail.summary || detail.background || detail.symptom || detail.entry || detail.solution || entry.title;
  const words = [entry.title, entry.service, entry.module, entry.type, firstSentence(lead)].filter(Boolean);
  for (const key of ['goals', 'symptom', 'rootCause', 'solution', 'roles', 'validations']) {
    collectStrings(detail[key], words, 120);
  }
  catalog.detailId = detailId;
  catalog.detailPath = `data/details/${detailId}.js`;
  catalog.summary = firstSentence(lead);
  catalog.searchText = words.join(' ').replace(/\s+/g, ' ').trim().slice(0, 600);
  return { catalog, detail };
}
function detailSource(detailId, detail) {
  return 'window.BOARD_DETAILS = window.BOARD_DETAILS || {};\n' +
    `window.BOARD_DETAILS[${JSON.stringify(detailId)}] = ${JSON.stringify(detail, null, 2)};\n`;
}
function validateDetail(source, detailId) {
  const holder = {};
  new Function('window', source)(holder);
  if (!holder.BOARD_DETAILS || !holder.BOARD_DETAILS[detailId]) throw new Error(`详情脚本校验失败：${detailId}`);
}
function writeDetail(detailId, detail) {
  fs.mkdirSync(DETAILS_DIR, { recursive: true });
  const source = detailSource(detailId, detail);
  validateDetail(source, detailId);
  const file = path.join(DETAILS_DIR, detailId + '.js');
  if (!exists(file) || fs.readFileSync(file, 'utf8') !== source) fs.writeFileSync(file, source);
  return file;
}
function loadDetail(catalog) {
  if (!catalog.detailPath || !catalog.detailId) return null;
  const file = path.join(BOARD_DIR, catalog.detailPath.replace(/\//g, path.sep));
  if (!exists(file)) return null;
  const holder = {};
  new Function('window', fs.readFileSync(file, 'utf8'))(holder);
  return holder.BOARD_DETAILS && holder.BOARD_DETAILS[catalog.detailId] || null;
}
function loadCurrent() {
  if (!exists(DATA)) die(`找不到 ${DATA}（看板尚未创建？先复制外壳与 data 模板）`);
  const raw = fs.readFileSync(DATA, 'utf8');
  let cur;
  try {
    cur = new Function(raw + '\n;return { changes: typeof changes!=="undefined"?changes:[], htmlChangelog: typeof htmlChangelog!=="undefined"?htmlChangelog:[] };')();
  } catch (e) { die('现有 data/changes.js 解析失败，请先修复：' + e.message); }
  return { raw, changes: cur.changes, changelog: cur.htmlChangelog };
}
function compose(raw, changes, changelog) {
  const hcStart = raw.indexOf('const htmlChangelog');
  const chStart = raw.indexOf('const changes');
  if (hcStart < 0 || chStart < 0) throw new Error('data/changes.js 结构异常：缺少 htmlChangelog 或 changes 声明');
  const head = raw.slice(0, hcStart);
  return head +
    'const htmlChangelog = [\n' + changelog.map(emit).join(',\n') + (changelog.length ? ',\n' : '') +
    '  // ─── 在此行上方追加变更日志 ───\n];\n' + CATALOG_HEADER +
    'const changes = [\n' + changes.map(emit).join(',\n') + (changes.length ? ',\n' : '') +
    '  // ─── 在此行上方追加新记录 ───\n];\n';
}
function writeData(raw, changes, changelog, oldLen) {
  const out = compose(raw, changes, changelog);
  let parsed;
  try { parsed = new Function(out + '\n;return changes')(); }
  catch (e) { throw new Error('生成结果语法错误（已放弃写入，原文件未动）：' + e.message); }
  if (parsed.length < oldLen) throw new Error(`记录数从 ${oldLen} 降到 ${parsed.length}，已放弃写入`);
  for (const c of parsed) {
    const allowed = new Set([...CATALOG_KEYS, ...GENERATED]);
    const unexpected = Object.keys(c).filter(k => !allowed.has(k));
    if (unexpected.length) throw new Error(`目录仍含详情/执行字段：${c.title || '(无标题)'} -> ${unexpected.join(', ')}`);
  }
  fs.copyFileSync(DATA, BAK);
  fs.writeFileSync(DATA, out);
}
function migrate() {
  const { raw, changes, changelog } = loadCurrent();
  const catalogs = [];
  for (const current of changes) {
    const existingDetail = loadDetail(current);
    const merged = Object.assign({}, current, existingDetail || {});
    const { catalog, detail } = splitEntry(merged, existingDetail || undefined);
    catalog.status = current.status;
    for (const key of ['lifecycle', 'pinned', 'createdAt']) {
      if (Object.prototype.hasOwnProperty.call(current, key)) catalog[key] = current[key];
    }
    writeDetail(catalog.detailId, detail);
    catalogs.push(catalog);
  }
  const migrationDesc = `外壳数据迁移：${catalogs.length} 条记录拆分为轻量目录 + 人类方案详情`;
  const nextLog = changelog.filter(item => !String(item && item.desc || '').startsWith('外壳数据迁移：'))
    .concat({ date: today(), desc: migrationDesc });
  try { writeData(raw, catalogs, nextLog, changes.length); }
  catch (e) { die(e.message); }
  console.log(`✓ 看板数据迁移完成：${catalogs.length} 条目录 + ${catalogs.length} 份人类方案详情（备份 data/changes.js.bak）`);
}
function add(arg) {
  let input;
  try { input = JSON.parse(fs.readFileSync(arg, 'utf8')); }
  catch (e) { die('无法解析输入 JSON：' + e.message); }
  const entry = input.entry || input.catalog;
  if (!entry || typeof entry !== 'object') die('输入缺少 entry/catalog 对象');
  const { raw, changes, changelog } = loadCurrent();
  const oldLen = changes.length;
  const { catalog, detail } = splitEntry(entry, input.detail);
  let action = 'append';
  if (catalog.docPath) {
    const idx = changes.findIndex(c => c.docPath && c.docPath === catalog.docPath);
    if (idx >= 0) {
      const old = changes[idx], stateful = {};
      for (const key of ['lifecycle', 'pinned', 'createdAt']) {
        if (!Object.prototype.hasOwnProperty.call(catalog, key) && Object.prototype.hasOwnProperty.call(old, key)) stateful[key] = old[key];
      }
      changes[idx] = Object.assign({}, catalog, stateful, { status: old.status, updatedAt: entry.updatedAt || today() });
      action = 'update';
    }
  }
  if (action === 'append') changes.push(Object.assign({ updatedAt: entry.date || today() }, catalog));
  writeDetail(catalog.detailId, detail);
  if (input.changelog) changelog.push({ date: entry.date || today(), desc: input.changelog });
  try { writeData(raw, changes, changelog, oldLen); }
  catch (e) { die(e.message); }
  console.log(`✓ 看板已${action === 'update' ? '更新' : '追加'}：${entry.title || '(无标题)'}（目录 ${oldLen} → ${changes.length}，详情 ${catalog.detailPath}，备份 data/changes.js.bak）`);
}
function main() {
  const arg = process.argv[2];
  if (!arg) die('用法：node project-html/board-add.js <entry.json> | --migrate');
  if (arg === '--migrate') return migrate();
  add(arg);
}
main();
