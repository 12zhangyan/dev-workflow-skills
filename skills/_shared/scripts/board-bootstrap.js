#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

function fail(message) {
  process.stderr.write(`BOARD_TEMPLATE_ERROR: ${message}\n`);
  process.exit(1);
}

function candidateTemplates() {
  const home = process.env.USERPROFILE || process.env.HOME || '';
  return [
    path.resolve(__dirname, '..', '..', 'yan-dev-doc', 'assets', 'board'),
    process.env.DEV_WORKFLOW_SKILLS_BOARD_TEMPLATE,
    // 共享根是唯一维护的安装位置；旧宿主目录只作兜底，避免过期副本优先于当前模板。
    home && path.join(home, '.agents', 'skills', 'yan-dev-doc', 'assets', 'board'),
    home && path.join(home, '.claude', 'skills', 'yan-dev-doc', 'assets', 'board'),
    home && path.join(home, '.cursor', 'skills', 'yan-dev-doc', 'assets', 'board'),
    home && path.join(home, '.codex', 'skills', 'yan-dev-doc', 'assets', 'board'),
  ].filter(Boolean);
}

function missingTemplateFiles(candidate) {
  return TEMPLATE_FILES.filter((rel) => !fs.existsSync(path.join(candidate, ...rel.split('/'))));
}

// 优先完整模板：缺文件的副本（如误删 vendor）不能抢先于完整安装，否则 sync 会半途失败。
function templateRoot(requireComplete) {
  const candidates = candidateTemplates().filter((candidate) => fs.existsSync(path.join(candidate, 'js', 'board.js')));
  if (!candidates.length) fail('yan-dev-doc/assets/board not found');
  const complete = candidates.find((candidate) => !missingTemplateFiles(candidate).length);
  if (complete) return complete;
  if (requireComplete) fail(`BOARD_TEMPLATE_INCOMPLETE ${candidates[0]} missing ${missingTemplateFiles(candidates[0]).join(',')}`);
  return candidates[0];
}

function versionOf(file) {
  if (!fs.existsSync(file)) return null;
  const match = fs.readFileSync(file, 'utf8').match(/BOARD_VERSION[ \t]*=[ \t]*(\d+)/);
  return match ? Number(match[1]) : null;
}

function copyFile(sourceRoot, targetRoot, rel) {
  const source = path.join(sourceRoot, ...rel.split('/'));
  const target = path.join(targetRoot, ...rel.split('/'));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

function sameShellFile(sourceRoot, targetRoot, rel) {
  const left = fs.readFileSync(path.join(sourceRoot, ...rel.split('/')));
  const right = fs.readFileSync(path.join(targetRoot, ...rel.split('/')));
  if (left.equals(right)) return true;
  // 文本外壳可能被 Git autocrlf 转成 CRLF，只差换行时视为相同；vendor 按二进制比较。
  return !rel.endsWith('.min.js')
    && left.toString('utf8').replace(/\r\n/g, '\n') === right.toString('utf8').replace(/\r\n/g, '\n');
}

// 与 board-add.js 共用写入锁和锁内容格式：换外壳期间不允许发布，--unlock-stale 也能识别失效的同步锁。
function acquireBoardLock(lock) {
  const token = JSON.stringify({ pid: process.pid, host: os.hostname(), createdAt: new Date().toISOString() }) + '\n';
  fs.mkdirSync(path.dirname(lock), { recursive: true });
  try {
    fs.writeFileSync(lock, token, { flag: 'wx' });
  } catch (error) {
    if (error.code === 'EEXIST') return null;
    throw error;
  }
  return token;
}

function releaseBoardLock(lock, token) {
  try {
    if (fs.readFileSync(lock, 'utf8') === token) fs.unlinkSync(lock);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

const SHELL_FILES = [
  'index.html', 'css/board.css', 'js/board.js', 'js/vendor/mermaid.min.js',
  'build.js', 'board-add.js',
];
const TEMPLATE_FILES = [...SHELL_FILES, 'data/changes.js'];
const USAGE = 'usage: node board-bootstrap.js <status|sync> [project-directory]';
const [command, projectArg = '.', ...extra] = process.argv.slice(2);
if (extra.length) fail(USAGE);
if (['help', '--help', '-h'].includes(command)) {
  process.stdout.write(USAGE + '\nstatus is read-only. sync upgrades an older shell to the template version: shell files only,'
    + ' never data/, never a downgrade; replaced files are backed up under project-html/.shell-backup/.\n');
  process.exit(0);
}
if (!['status', 'sync'].includes(command)) fail(USAGE);
const source = templateRoot(command === 'sync');
const project = path.resolve(projectArg);
const target = path.join(project, 'project-html');
const templateVersion = versionOf(path.join(source, 'js', 'board.js'));
if (templateVersion === null) fail('BOARD_VERSION missing from template');

if (command === 'status') {
  const projectVersion = versionOf(path.join(target, 'js', 'board.js'));
  process.stdout.write(`PROJECT_BOARD_VERSION=${projectVersion === null ? 'MISSING' : projectVersion}\n`);
  process.stdout.write(`TEMPLATE_BOARD_VERSION=${templateVersion}\n`);
  const missing = SHELL_FILES.filter(rel => !fs.existsSync(path.join(target, rel)));
  if (missing.length) process.stdout.write('BOARD_SHELL_MISSING_FILES=' + missing.join(',') + '\n');
  // 同版本却与模板内容不同，说明新旧混杂或本地定制；只看 board.js 版本号会误报 CURRENT。
  const different = !missing.length && projectVersion === templateVersion
    ? SHELL_FILES.filter((rel) => fs.existsSync(path.join(source, rel)) && !sameShellFile(source, target, rel))
    : [];
  if (different.length) process.stdout.write('BOARD_SHELL_DIFFERENT_FILES=' + different.join(',') + '\n');
  const state = !fs.existsSync(target) ? 'BOARD_SHELL_INIT_REQUIRED'
    : missing.length ? 'BOARD_SHELL_INCOMPLETE'
    : projectVersion === null ? 'BOARD_SHELL_VERSION_UNKNOWN'
    : projectVersion < templateVersion ? 'BOARD_SHELL_UPGRADE_AVAILABLE'
    : different.length ? 'BOARD_SHELL_MODIFIED'
    : 'BOARD_SHELL_CURRENT';
  process.stdout.write(state + '\n');
} else if (command === 'sync') {
  const projectVersion = versionOf(path.join(target, 'js', 'board.js'));
  if (projectVersion !== null && projectVersion > templateVersion) fail('BOARD_SHELL_DOWNGRADE_REFUSED');
  // 先把模板复制到暂存目录，再逐个改名替换；任一步失败都撤回已替换文件，避免留下新旧混杂或半初始化的外壳。
  const targetExisted = fs.existsSync(target);
  const plan = SHELL_FILES.concat(fs.existsSync(path.join(target, 'data', 'changes.js')) ? [] : ['data/changes.js']);
  const created = plan.filter((rel) => !fs.existsSync(path.join(target, ...rel.split('/'))));
  const replaced = SHELL_FILES.filter((rel) => !created.includes(rel) && !sameShellFile(source, target, rel));
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupRel = `.shell-backup/v${projectVersion === null ? 'unknown' : projectVersion}-${stamp}`;
  const ignore = path.join(target, '.gitignore');
  const ignoreExisted = fs.existsSync(ignore);
  const staging = path.join(target, '.shell-backup', `.staging-${process.pid}-${Date.now()}`);
  const lock = path.join(target, 'data', 'changes.js.lock');
  const applied = [];
  let lockToken = null;
  try {
    lockToken = acquireBoardLock(lock);
    if (!lockToken) throw Object.assign(new Error('BOARD_WRITE_LOCKED'), { locked: true });
    // 被替换的旧外壳文件先备份：未纳管的看板没有 VCS 可回退，升级必须可还原。
    if (replaced.length) {
      for (const rel of replaced) copyFile(target, path.join(target, ...backupRel.split('/')), rel);
      process.stdout.write(`BOARD_SHELL_BACKUP=project-html/${backupRel}\n`);
    }
    for (const rel of plan) copyFile(source, staging, rel);
    for (const rel of plan) {
      const final = path.join(target, ...rel.split('/'));
      fs.mkdirSync(path.dirname(final), { recursive: true });
      fs.renameSync(path.join(staging, ...rel.split('/')), final);
      applied.push(rel);
    }
    fs.mkdirSync(path.join(target, 'data', 'details'), { recursive: true });
    if (!ignoreExisted) {
      fs.writeFileSync(ignore, [
        '# 由 build.js / board-add.js 生成或临时使用；data/changes.js 与 data/details/ 是需要保留的看板数据。',
        'pages/', 'exports/', 'data/changes.js.bak', 'data/changes.js.lock', 'data/.entry-*/', '.shell-backup/', '',
      ].join('\n'), { flag: 'wx' });
    }
  } catch (error) {
    if (error.locked) fail(`BOARD_WRITE_LOCKED ${lock}; another publisher or sync holds it, retry after it finishes`);
    const leftovers = [];
    if (!targetExisted) {
      try { fs.rmSync(target, { recursive: true, force: true }); } catch (_) { leftovers.push('project-html'); }
    } else {
      for (const rel of applied) {
        try {
          if (created.includes(rel)) fs.rmSync(path.join(target, ...rel.split('/')), { force: true });
          else if (replaced.includes(rel)) copyFile(path.join(target, ...backupRel.split('/')), target, rel);
        } catch (_) { leftovers.push(rel); }
      }
      try { fs.rmSync(staging, { recursive: true, force: true }); } catch (_) { /* 暂存目录位于已忽略的 .shell-backup/ */ }
      try { if (lockToken) releaseBoardLock(lock, lockToken); } catch (_) { leftovers.push('data/changes.js.lock'); }
    }
    fail(`BOARD_SHELL_SYNC_FAILED ${error.message}; ` + (leftovers.length
      ? `rollback incomplete: ${leftovers.join(',')}` : 'shell rolled back to its previous state'));
  }
  fs.rmSync(staging, { recursive: true, force: true });
  try { fs.rmdirSync(path.dirname(staging)); } catch (_) { /* 仍有历史备份时保留 .shell-backup/ */ }
  releaseBoardLock(lock, lockToken);
  if (replaced.length) process.stdout.write(`BOARD_SHELL_REPLACED=${replaced.join(',')}\n`);
  process.stdout.write(`BOARD_SHELL_SYNCED=${templateVersion}\n`);
}
