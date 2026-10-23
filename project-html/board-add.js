#!/usr/bin/env node
/* 看板写入助手 — 各 skill 提供独立撰写的人类方案 entry，本脚本确定性拆成：
 *   data/changes.js              轻量目录（首页 / 搜索 / 筛选）
 *   data/details/<detailId>.js  人类方案详情（点击后加载）
 *
 * 用法：
 *   node project-html/board-add.js <entry.json>
 *   node project-html/board-add.js --migrate   # 将现有富 entry 确定性拆分
 *   node project-html/board-add.js --unlock-stale   # 只移除持有进程已退出或超时的写入锁
 *
 * md 是 Agent 执行文档，entry 是人类方案；本脚本不读取或摘录 md，只共享 docPath 等结构元数据。
 * 与 skills/yan-dev-doc/assets/board/board-add.js 保持一致，修改时两处同步。 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const BOARD_DIR = __dirname;
const DATA = path.join(BOARD_DIR, 'data', 'changes.js');
const DETAILS_DIR = path.join(BOARD_DIR, 'data', 'details');
const BAK = DATA + '.bak';
const LOCK = DATA + '.lock';
const CATALOG_KEYS = [
  'kind', 'service', 'module', 'title', 'date', 'updatedAt', 'createdAt',
  'type', 'complexity', 'status', 'severity', 'branch', 'docPath',
  'apiSpecPath', 'apiIndexPath', 'apis', 'lifecycle', 'pinned',
  'deliveryId', 'currentGate', 'gateStatus', 'reviewState', 'reviewCounts'
];
const NON_DELIVERY_KINDS = ['bug', 'reading', 'biz'];
const EXECUTION_ONLY = new Set(['changeList', 'todos', 'stackTrace', 'codeLocation']);
// 正常写入只持锁毫秒级；超过该时长的锁即使 pid 被复用也视为失效。
const STALE_LOCK_MS = 10 * 60 * 1000;
const GENERATED = new Set(['detailId', 'detailPath', 'summary', 'searchText']);
const INPUT_ONLY = new Set(['sourceDocPath']);
const CATALOG_HEADER = `

// ─── 轻量目录数据 ────────────────────────────────────────────────────────────
// 首页、搜索和筛选只读取这里；人类方案正文位于 data/details/<detailId>.js，点击后加载。
// md 是 Agent 执行文档；看板详情是独立撰写的人类方案，不是 md 摘录。
// Agent 专属字段 changeList / todos / stackTrace / codeLocation 禁止进入目录和详情。
// 目录字段由 board-add.js 白名单控制；禁止手工整体重写本文件。
`;

function die(msg) { throw new Error(msg); }
// 与 workflow-fs.js prepare-date-dir 一致使用本地日期，避免 UTC 偏移让记录日期与文档目录相差一天。
function today() {
  const now = new Date();
  return [now.getFullYear(), now.getMonth() + 1, now.getDate()].map((n, i) => String(n).padStart(i ? 2 : 4, '0')).join('-');
}
function exists(file) { try { fs.accessSync(file); return true; } catch (e) { return false; } }
function emit(obj) { return JSON.stringify(obj, null, 2).split('\n').map(l => '  ' + l).join('\n'); }
function stableHash(value) {
  return crypto.createHash('sha1').update(String(value || '')).digest('hex');
}
function deliveryIdOf(entry) {
  const stable = entry.docPath || entry.sourceDocPath ||
    [entry.service, entry.module, entry.date, entry.title].filter(Boolean).join('::') ||
    JSON.stringify(entry);
  return 'DLV-' + stableHash(stable).slice(0, 10).toUpperCase();
}
// Keep mutable board files inside the board, including through junctions/links.
function localFile(file) {
  const relative = path.relative(BOARD_DIR, file);
  if (!relative || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) die('BOARD_PATH_INVALID: ' + file);
  let current = BOARD_DIR;
  for (const part of relative.split(path.sep)) {
    current = path.join(current, part);
    try {
      if (fs.lstatSync(current).isSymbolicLink()) die('BOARD_PATH_INVALID: linked path ' + current);
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return file;
}
function detailPathOf(id) {
  if (typeof id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(id)
    || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(id)) die('BOARD_PATH_INVALID: invalid detailId');
  return 'data/details/' + id + '.js';
}
function detailFile(catalog) {
  const relative = detailPathOf(catalog.detailId);
  if (catalog.detailPath && catalog.detailPath !== relative) die('BOARD_PATH_INVALID: detailPath does not match detailId');
  return localFile(path.join(BOARD_DIR, relative));
}
function atomicWrite(file, content) {
  localFile(file);
  const temporary = file + '.' + process.pid + '-' + crypto.randomBytes(8).toString('hex') + '.tmp';
  try {
    fs.writeFileSync(temporary, content, { flag: 'wx' });
    fs.renameSync(temporary, file);
  } finally {
    if (exists(temporary)) fs.unlinkSync(temporary);
  }
}
function processAlive(pid) {
  try { process.kill(pid, 0); return true; }
  catch (error) { return error.code === 'EPERM'; }
}
// 持有进程已退出，或锁存在超过 STALE_LOCK_MS 时返回原因；无法确认失效时返回 null。
// pid 只在同一主机内有意义：共享目录上其他主机或未记录主机的锁只按存在时长判断。
function staleLockReason() {
  let raw;
  let stat;
  try { raw = fs.readFileSync(LOCK, 'utf8'); stat = fs.statSync(LOCK); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  let holder = {};
  try { holder = JSON.parse(raw) || {}; } catch (e) { /* 写入中断的锁没有可解析内容，按文件时间判断 */ }
  const pid = Number.isInteger(holder.pid) && holder.pid > 0 ? holder.pid : null;
  if (pid && holder.host === os.hostname() && !processAlive(pid)) return `pid ${pid} 已退出`;
  const created = Date.parse(holder.createdAt);
  const age = Date.now() - (Number.isNaN(created) ? stat.mtimeMs : created);
  return age > STALE_LOCK_MS ? `锁已存在 ${Math.round(age / 60000)} 分钟` : null;
}
function unlockStale() {
  localFile(LOCK);
  if (!exists(LOCK)) return console.log('BOARD_WRITE_UNLOCKED: 没有写入锁');
  const reason = staleLockReason();
  if (!reason) die('BOARD_WRITE_LOCKED: ' + LOCK + ' 的持有者仍可能在写入；等待其结束，不移除');
  fs.unlinkSync(LOCK);
  console.log('BOARD_WRITE_UNLOCKED: 已移除失效写入锁（' + reason + '）');
}
function withWriteLock(operation) {
  localFile(DATA);
  localFile(BAK);
  let fd;
  try { fd = fs.openSync(LOCK, 'wx'); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const reason = staleLockReason();
    if (reason) die('BOARD_WRITE_LOCK_STALE: ' + LOCK + '（' + reason + '）；确认没有其他写入后运行 node project-html/board-add.js --unlock-stale，再用原输入重试');
    die('BOARD_WRITE_LOCKED: another publisher holds ' + LOCK + '; retry after it finishes');
  }
  try {
    fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, host: os.hostname(), createdAt: new Date().toISOString() }) + '\n');
    return operation();
  } finally {
    fs.closeSync(fd);
    fs.unlinkSync(LOCK);
  }
}
function detailIdOf(entry) {
  const stable = entry.deliveryId || entry.docPath || entry.sourceDocPath ||
    [entry.service, entry.module, entry.date, entry.title].filter(Boolean).join('::');
  return 'd-' + stableHash(stable || JSON.stringify(entry)).slice(0, 16);
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
  let detail = {};
  for (const source of [entry, explicitDetail]) {
    if (!isPlainObject(source)) continue;
    const narrative = {};
    for (const [key, value] of Object.entries(source)) {
      if (CATALOG_KEYS.includes(key) || GENERATED.has(key) || EXECUTION_ONLY.has(key) || INPUT_ONLY.has(key)) continue;
      narrative[key] = value;
    }
    detail = mergeHumanDetail(detail, narrative);
  }
  return detail;
}
function splitEntry(entry, explicitDetail, fallbackSummary) {
  const detail = humanDetailOf(entry, explicitDetail);
  const catalog = {};
  for (const key of CATALOG_KEYS) {
    if (Object.prototype.hasOwnProperty.call(entry, key)) catalog[key] = entry[key];
  }
  const isDelivery = !NON_DELIVERY_KINDS.includes(entry.kind);
  if (isDelivery && !catalog.deliveryId) catalog.deliveryId = deliveryIdOf(entry);
  if (isDelivery && !catalog.currentGate) catalog.currentGate = 'plan';
  const detailId = entry.detailId || detailIdOf(entry);
  const deliveryLead = detail.delivery && (
    detail.delivery.plan && (detail.delivery.plan.summary || detail.delivery.plan.background) ||
    detail.delivery.review && Array.isArray(detail.delivery.review.events) &&
      detail.delivery.review.events.slice(-1)[0] && detail.delivery.review.events.slice(-1)[0].summary
  );
  const lead = entry.summary || detail.summary || deliveryLead || detail.background || detail.symptom || detail.entry || detail.solution || fallbackSummary || entry.title;
  const words = [entry.title, entry.service, entry.module, entry.type, firstSentence(lead)].filter(Boolean);
  for (const key of ['goals', 'symptom', 'rootCause', 'solution', 'dataFlowSummary', 'coreDesign', 'keyImpl', 'acceptance', 'roles', 'validations', 'delivery']) {
    collectStrings(detail[key], words, 120);
  }
  catalog.detailId = detailId;
  catalog.detailPath = detailPathOf(detailId);
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
  const file = detailFile({ detailId });
  fs.mkdirSync(DETAILS_DIR, { recursive: true });
  const source = detailSource(detailId, detail);
  validateDetail(source, detailId);
  if (!exists(file) || fs.readFileSync(file, 'utf8') !== source) atomicWrite(file, source);
  return file;
}
function loadDetail(catalog) {
  if (!catalog.detailPath || !catalog.detailId) return null;
  const file = detailFile(catalog);
  if (!exists(file)) return null;
  const holder = {};
  new Function('window', fs.readFileSync(file, 'utf8'))(holder);
  return holder.BOARD_DETAILS && holder.BOARD_DETAILS[catalog.detailId] || null;
}
function loadCurrent() {
  localFile(DATA);
  if (!exists(DATA)) die(`找不到 ${DATA}（看板尚未创建？先复制外壳与 data 模板）`);
  const raw = fs.readFileSync(DATA, 'utf8');
  let cur;
  try {
    cur = new Function(raw + '\n;return { changes: typeof changes!=="undefined"?changes:[], htmlChangelog: typeof htmlChangelog!=="undefined"?htmlChangelog:[] };')();
  } catch (e) { die('现有 data/changes.js 解析失败，请先修复：' + e.message); }
  const ids = new Set();
  for (const catalog of cur.changes) {
    if (!catalog.detailId && !catalog.detailPath) continue;
    detailFile(catalog);
    const identity = catalog.detailId.toLowerCase();
    if (ids.has(identity)) die('BOARD_DETAIL_CONFLICT: duplicate detailId');
    ids.add(identity);
  }
  return { raw, changes: cur.changes, changelog: cur.htmlChangelog };
}
function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}
function mergeHumanDetail(base, patch) {
  if (!isPlainObject(base) || !isPlainObject(patch)) return patch;
  const out = Object.assign({}, base);
  for (const [key, value] of Object.entries(patch)) {
    if (Array.isArray(value)) {
      const old = Array.isArray(out[key]) ? out[key] : [];
      const eventArray = (key === 'events' || value.length > 0)
        && value.every(item => isPlainObject(item) && item.eventId);
      if (eventArray) {
        const byId = new Map(old.filter(item => isPlainObject(item) && item.eventId).map(item => [item.eventId, item]));
        for (const item of value) {
          byId.set(item.eventId, byId.has(item.eventId) ? mergeHumanDetail(byId.get(item.eventId), item) : item);
        }
        out[key] = [...old.filter(item => !isPlainObject(item) || !item.eventId), ...byId.values()];
      } else {
        out[key] = value;
      }
    } else if (isPlainObject(value) && isPlainObject(out[key])) {
      out[key] = mergeHumanDetail(out[key], value);
    } else {
      out[key] = value;
    }
  }
  return out;
}
// deliveryOnly 只在交付档案中匹配，避免 Review 写入落到 bug / reading / biz 条目。
function findExistingIndex(changes, entry, catalog, deliveryOnly) {
  const eligible = c => !deliveryOnly || !NON_DELIVERY_KINDS.includes(c.kind);
  if (catalog.deliveryId) {
    const byDelivery = changes.findIndex(c => eligible(c) && c.deliveryId && c.deliveryId === catalog.deliveryId);
    if (byDelivery >= 0) return byDelivery;
  }
  if (entry.sourceDocPath) {
    const bySource = changes.findIndex(c => eligible(c) && c.docPath && c.docPath === entry.sourceDocPath);
    if (bySource >= 0) return bySource;
  }
  if (catalog.docPath) return changes.findIndex(c => eligible(c) && c.docPath && c.docPath === catalog.docPath);
  return -1;
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
  atomicWrite(BAK, fs.readFileSync(DATA));
  atomicWrite(DATA, out);
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
function checkMigration() {
  const { changes } = loadCurrent();
  const allowed = new Set([...CATALOG_KEYS, ...GENERATED]);
  const legacy = changes.some(entry => !entry.detailId || !entry.detailPath
    || Object.keys(entry).some(key => !allowed.has(key)));
  console.log(legacy ? 'BOARD_DATA_MIGRATION_REQUIRED' : 'BOARD_DATA_CURRENT');
}
function add(arg) {
  let input;
  try { input = JSON.parse(fs.readFileSync(arg, 'utf8')); }
  catch (e) { die('无法解析输入 JSON：' + e.message); }
  const entry = input.entry || input.catalog;
  if (!entry || typeof entry !== 'object') die('输入缺少 entry/catalog 对象');
  if (input.requireExisting !== undefined && typeof input.requireExisting !== 'boolean') die('BOARD_USAGE_ERROR: requireExisting 必须是布尔值');
  const requireExisting = input.requireExisting === true;
  if (requireExisting && NON_DELIVERY_KINDS.includes(entry.kind)) die('BOARD_TARGET_NOT_FOUND: requireExisting 只更新交付档案，不接受 kind=' + entry.kind);
  const { raw, changes, changelog } = loadCurrent();
  const oldLen = changes.length;
  let { catalog, detail } = splitEntry(entry, input.detail);
  let action = 'append';
  const idx = findExistingIndex(changes, entry, catalog, requireExisting);
  if (requireExisting && idx < 0) die('BOARD_TARGET_NOT_FOUND: 没有与 deliveryId / sourceDocPath / docPath 匹配的交付档案；requireExisting 不新建记录');
  if (idx >= 0) {
    const old = changes[idx];
    const oldDetail = loadDetail(old) || {};
    const mergedDetail = mergeHumanDetail(oldDetail, detail);
    const mergedEntry = Object.assign({}, old, catalog, {
      detailId: old.detailId || catalog.detailId,
      deliveryId: old.deliveryId || catalog.deliveryId,
      docPath: old.docPath || catalog.docPath,
      currentGate: entry.currentGate || old.currentGate || catalog.currentGate
    });
    // 本次未显式给 summary 时，从合并后的详情重新推导，不让只含 Review 事件的写入把摘要退化成标题。
    if (!Object.prototype.hasOwnProperty.call(entry, 'summary')) delete mergedEntry.summary;
    const split = splitEntry(mergedEntry, mergedDetail, old.summary);
    catalog = split.catalog;
    detail = split.detail;
    catalog.detailId = old.detailId || catalog.detailId;
    catalog.detailPath = old.detailPath || `data/details/${catalog.detailId}.js`;
    for (const key of ['lifecycle', 'pinned', 'createdAt']) {
      if (!Object.prototype.hasOwnProperty.call(entry, key) && Object.prototype.hasOwnProperty.call(old, key)) catalog[key] = old[key];
    }
    changes[idx] = Object.assign({}, old, catalog, {
      status: Object.prototype.hasOwnProperty.call(entry, 'status') ? entry.status : old.status,
      updatedAt: entry.updatedAt || today()
    });
    action = 'update';
  }
  if (action === 'append') {
    if (changes.some(current => current.detailId && current.detailId.toLowerCase() === catalog.detailId.toLowerCase())) die('BOARD_DETAIL_CONFLICT: detailId belongs to another record');
    changes.push(Object.assign({ updatedAt: entry.date || today() }, catalog));
  }
  writeDetail(catalog.detailId, detail);
  if (input.changelog) changelog.push({ date: entry.date || today(), desc: input.changelog });
  try { writeData(raw, changes, changelog, oldLen); }
  catch (e) { die(e.message); }
  const cleaned = removeAllocatedInput(arg);
  console.log(`✓ 看板已${action === 'update' ? '更新' : '追加'}：${entry.title || '(无标题)'}（目录 ${oldLen} → ${changes.length}，详情 ${catalog.detailPath}，备份 data/changes.js.bak${cleaned ? '，已清理本次临时输入' : ''}）`);
}
// 只清理 workflow-fs.js prepare-board-entry 为本次发布分配的 data/.entry-*/entry.json；其他输入路径一律保留。
function removeAllocatedInput(arg) {
  const file = path.resolve(arg);
  const dir = path.dirname(file);
  if (path.basename(file) !== 'entry.json' || !path.basename(dir).startsWith('.entry-') ||
      path.dirname(dir) !== path.dirname(DATA) || fs.lstatSync(dir).isSymbolicLink()) return false;
  try {
    fs.unlinkSync(file);
    fs.rmdirSync(dir);
    return true;
  } catch (e) { return false; }
}
const USAGE = [
  '用法：node project-html/board-add.js <entry.json>',
  '      node project-html/board-add.js --check-migration | --migrate | --unlock-stale',
  '      node project-html/board-add.js --help | -h | help',
  'entry.json 使用 {"entry": {...}, "detail": {...}} 包装；填写已创建的临时 JSON。',
  '包装顶层 "requireExisting": true 时只更新已有交付档案，找不到则 BOARD_TARGET_NOT_FOUND 且不写入。',
  '--check-migration 只读检查；--migrate 迁移并备份现有目录；--unlock-stale 只移除持有进程已退出或超时的锁；帮助不读写看板数据。',
].join('\n');
function main() {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !args[0]) die('BOARD_USAGE_ERROR: 需要且仅接受一个参数\n' + USAGE);
  const arg = args[0];
  if (['--help', '-h', 'help'].includes(arg)) {
    console.log(USAGE);
    return;
  }
  if (arg === '--check-migration') return checkMigration();
  if (arg === '--unlock-stale') return unlockStale();
  if (arg.startsWith('-') && arg !== '--migrate') die('BOARD_USAGE_ERROR: 未知参数 ' + arg + '\n' + USAGE);
  return withWriteLock(() => arg === '--migrate' ? migrate() : add(arg));
}
try { main(); }
catch (error) { console.error('✗ ' + error.message); process.exitCode = 1; }
