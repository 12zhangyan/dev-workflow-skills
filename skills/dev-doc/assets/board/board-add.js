#!/usr/bin/env node
/* 看板写入助手 — 各 skill 在收集完字段后调用，替代手工 Edit data/changes.js：
 *   node project-html/board-add.js <entry.json>
 * entry.json 形如 { "changelog": "新增文档：xxx", "entry": { ...看板字段... } }
 *
 * 为什么用脚本而不是让 AI 手改 JS（CLAUDE.md Rule 5：能用代码判定的别用模型判定）：
 *   - 转义（双引号 / 换行 / 反引号）、标记行定位、按 docPath 查重、备份、回滚、记录数回归
 *     全是确定性逻辑，交给脚本零出错；AI 只负责产出结构化字段。
 *   - 按构造只会「追加或就地更新」，记录数永不减少，从根上杜绝「误判看板不存在→整体覆盖」事故。
 * 纯 Node 无依赖。与 skills/dev-doc/assets/board/board-add.js 保持一致，修改时两处同步。 */
'use strict';
const fs = require('fs');
const path = require('path');

const BOARD_DIR = __dirname;
const DATA = path.join(BOARD_DIR, 'data', 'changes.js');
const BAK = DATA + '.bak';

function die(msg) { console.error('✗ ' + msg); process.exit(1); }
function today() { return new Date().toISOString().slice(0, 10); }

// 把对象序列化为合法 JS（JSON 双引号 + \n 转义，board.js / build.js 用 new Function 解析，引号 key 无碍）
function emit(obj) {
  return JSON.stringify(obj, null, 2).split('\n').map(l => '  ' + l).join('\n');
}

function main() {
  const arg = process.argv[2];
  if (!arg) die('用法：node project-html/board-add.js <entry.json>');
  if (!fs.existsSync(DATA)) die(`找不到 ${DATA}（看板尚未创建？先复制外壳与 data 模板）`);

  let input;
  try { input = JSON.parse(fs.readFileSync(arg, 'utf8')); }
  catch (e) { die('无法解析输入 JSON：' + e.message); }
  const entry = input.entry;
  if (!entry || typeof entry !== 'object') die('输入缺少 entry 对象');
  const changelogDesc = input.changelog || '';

  const raw = fs.readFileSync(DATA, 'utf8');

  // 解析现有数组（权威值）
  let cur;
  try {
    cur = new Function(raw + '\n;return { changes: typeof changes!=="undefined"?changes:[], htmlChangelog: typeof htmlChangelog!=="undefined"?htmlChangelog:[] };')();
  } catch (e) { die('现有 data/changes.js 解析失败，请先修复：' + e.message); }
  const changes = cur.changes, changelog = cur.htmlChangelog;
  const oldLen = changes.length;

  // 切出两段注释（HEAD：htmlChangelog 之前；MID：两数组之间的字段说明），原样保留
  const hcStart = raw.indexOf('const htmlChangelog');
  const chStart = raw.indexOf('const changes');
  if (hcStart < 0 || chStart < 0) die('data/changes.js 结构异常：缺少 htmlChangelog 或 changes 声明');
  const hcMarker = raw.indexOf('追加变更日志');
  const endHc = raw.indexOf('];', hcMarker >= 0 ? hcMarker : hcStart) + 2;
  const HEAD = raw.slice(0, hcStart);
  const MID = raw.slice(endHc, chStart);

  // 按 docPath 查重：命中则就地更新（保留原 status），否则追加
  let action = 'append';
  if (entry.docPath) {
    const idx = changes.findIndex(c => c.docPath && c.docPath === entry.docPath);
    if (idx >= 0) {
      const keepStatus = changes[idx].status;
      changes[idx] = Object.assign({}, entry, { status: keepStatus });
      action = 'update';
    }
  }
  if (action === 'append') changes.push(entry);

  if (changelogDesc) changelog.push({ date: entry.date || today(), desc: changelogDesc });

  // 重新拼装文件
  const out =
    HEAD +
    'const htmlChangelog = [\n' +
    changelog.map(emit).join(',\n') + (changelog.length ? ',\n' : '') +
    '  // ─── 在此行上方追加变更日志 ───\n];\n' +
    MID +
    'const changes = [\n' +
    changes.map(emit).join(',\n') + (changes.length ? ',\n' : '') +
    '  // ─── 在此行上方追加新记录 ───\n];\n';

  // 校验：能解析 + 记录数不减少（按构造必然成立，仍兜底）
  let check;
  try { check = new Function(out + '\n;return changes.length')(); }
  catch (e) { die('生成结果语法错误（已放弃写入，原文件未动）：' + e.message); }
  if (check < oldLen) die(`记录数从 ${oldLen} 降到 ${check}，已放弃写入`);

  fs.copyFileSync(DATA, BAK);
  fs.writeFileSync(DATA, out);
  console.log(`✓ 看板已${action === 'update' ? '更新' : '追加'}：${entry.title || '(无标题)'}（记录数 ${oldLen} → ${check}，备份 data/changes.js.bak）`);
}
main();
