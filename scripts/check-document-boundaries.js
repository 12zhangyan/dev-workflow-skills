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

function read(rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) {
    fail(`missing file: ${rel}`);
    return '';
  }
  return fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
}

function requireSmokePath(projectRoot, rel, kind) {
  const file = path.join(projectRoot, ...rel.split('/'));
  if (!fs.existsSync(file)) {
    fail(`board-shell bootstrap smoke missing ${kind}: ${rel}`);
    return false;
  }
  const stat = fs.statSync(file);
  const matches = kind === 'directory' ? stat.isDirectory() : stat.isFile();
  if (!matches) {
    fail(`board-shell bootstrap smoke expected ${kind}: ${rel}`);
    return false;
  }
  return true;
}

function requireMarker(result, marker, label) {
  if (!result) return;
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  if (!output.includes(marker)) fail(`${label} missing marker: ${marker}`);
}

function removeTempRoot(tempRoot) {
  const tempBase = path.resolve(os.tmpdir());
  const target = path.resolve(tempRoot);
  const relative = path.relative(tempBase, target);
  const outside = !relative
    || relative === '..'
    || relative.startsWith(`..${path.sep}`)
    || path.isAbsolute(relative);
  if (outside) {
    fail(`refusing to remove board-shell smoke path outside os.tmpdir(): ${target}`);
    return;
  }
  try {
    fs.rmSync(target, { recursive: true, force: true });
  } catch (error) {
    fail(`could not remove board-shell smoke directory: ${error.message}`);
  }
}

function runBoardAdapter(command, project, label) {
  const adapter = path.join(root, 'skills', '_shared', 'scripts', 'board-bootstrap.js');
  const result = spawnSync(process.execPath, [adapter, command, project], {
    cwd: project,
    encoding: 'utf8',
    timeout: 30000,
    windowsHide: true,
  });
  if (result.error) {
    fail(`${label} could not start: ${result.error.message}`);
    return null;
  }
  if (result.status !== 0) {
    fail(`${label} exited with ${result.status}`);
    if (result.stdout) process.stderr.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    return null;
  }
  return result;
}

function smokeBoardShellBootstrap() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-workflow-skills-board-shell-'));
  try {
    const home = path.join(tempRoot, 'home');
    const project = path.join(tempRoot, 'project');
    const installedTemplate = path.join(home, '.codex', 'skills', 'yan-dev-doc', 'assets', 'board');
    fs.mkdirSync(path.dirname(installedTemplate), { recursive: true });
    fs.cpSync(path.join(root, 'skills', 'yan-dev-doc', 'assets', 'board'), installedTemplate, { recursive: true });
    fs.mkdirSync(project, { recursive: true });

    const missing = runBoardAdapter('status', project, 'board-shell absent smoke');
    requireMarker(missing, 'BOARD_SHELL_INIT_REQUIRED', 'board-shell absent smoke');
    if (fs.existsSync(path.join(project, 'project-html'))) fail('status must not initialize a missing shell');
    const firstCopy = runBoardAdapter('sync', project, 'board-shell initial copy smoke');
    const requiredFiles = [
      'project-html/index.html',
      'project-html/css/board.css',
      'project-html/js/board.js',
      'project-html/js/vendor/mermaid.min.js',
      'project-html/build.js',
      'project-html/board-add.js',
      'project-html/data/changes.js',
    ];
    let copyReady = Boolean(firstCopy);
    for (const rel of requiredFiles) {
      copyReady = requireSmokePath(project, rel, 'file') && copyReady;
    }
    copyReady = requireSmokePath(project, 'project-html/data/details', 'directory') && copyReady;
    if (!copyReady) return;

    const changesPath = path.join(project, 'project-html', 'data', 'changes.js');
    const detailPath = path.join(project, 'project-html', 'data', 'details', 'sentinel.js');
    const changesSentinel = `${fs.readFileSync(changesPath, 'utf8')}\n// BOARD_BOOTSTRAP_CHANGES_SENTINEL\n`;
    const detailSentinel = '// BOARD_BOOTSTRAP_DETAIL_SENTINEL\n';
    fs.writeFileSync(changesPath, changesSentinel, 'utf8');
    fs.writeFileSync(detailPath, detailSentinel, 'utf8');
    const ignorePath = path.join(project, 'project-html', '.gitignore');
    const ignoreText = fs.existsSync(ignorePath) ? fs.readFileSync(ignorePath, 'utf8') : '';
    if (!['pages/', 'data/.entry-*/', 'data/changes.js.bak'].every((line) => ignoreText.split('\n').includes(line))
        || /^data\/(changes\.js|details\/?)$/m.test(ignoreText)) {
      fail('board-shell initial copy must ignore generated/temporary board files but keep catalog and details tracked');
    }
    const ignoreSentinel = '# user-owned ignore\n';
    fs.writeFileSync(ignorePath, ignoreSentinel, 'utf8');

    const secondCopy = runBoardAdapter('sync', project, 'board-shell repeat copy smoke');
    if (secondCopy && fs.readFileSync(changesPath, 'utf8') !== changesSentinel) {
      fail('board-shell repeat copy overwrote existing data/changes.js');
    }
    if (secondCopy && fs.readFileSync(detailPath, 'utf8') !== detailSentinel) {
      fail('board-shell repeat copy overwrote an existing data/details sidecar');
    }
    if (secondCopy && fs.readFileSync(ignorePath, 'utf8') !== ignoreSentinel) {
      fail('board-shell repeat copy overwrote an existing project-html/.gitignore');
    }

    const current = runBoardAdapter('status', project, 'board-shell current-version smoke');
    requireMarker(current, 'BOARD_SHELL_CURRENT', 'board-shell current-version smoke');

    // Same version but stale content (mixed shell) must not pass as current; CRLF-only differences must.
    const buildJsPath = path.join(project, 'project-html', 'build.js');
    const buildJsBytes = fs.readFileSync(buildJsPath);
    fs.writeFileSync(buildJsPath, Buffer.concat([buildJsBytes, Buffer.from('// stale shell\n')]));
    const modified = runBoardAdapter('status', project, 'board-shell modified smoke');
    requireMarker(modified, 'BOARD_SHELL_MODIFIED', 'board-shell modified smoke');
    requireMarker(modified, 'BOARD_SHELL_DIFFERENT_FILES=build.js', 'board-shell modified smoke');
    fs.writeFileSync(buildJsPath, buildJsBytes.toString('utf8').replace(/\r?\n/g, '\r\n'), 'utf8');
    requireMarker(runBoardAdapter('status', project, 'board-shell CRLF smoke'), 'BOARD_SHELL_CURRENT', 'board-shell CRLF smoke');
    fs.writeFileSync(buildJsPath, buildJsBytes);

    const boardJsPath = path.join(project, 'project-html', 'js', 'board.js');
    const boardJs = fs.readFileSync(boardJsPath, 'utf8');
    const versionPattern = /(BOARD_VERSION[ \t]*=[ \t]*)\d+/;
    if (!versionPattern.test(boardJs)) {
      fail('board-shell smoke could not locate BOARD_VERSION in copied board.js');
      return;
    }
    fs.writeFileSync(boardJsPath, boardJs.replace(versionPattern, (_match, prefix) => `${prefix}0`), 'utf8');
    const trackedFiles = [...requiredFiles, 'project-html/data/details/sentinel.js', 'project-html/.gitignore'];
    const beforeStatus = trackedFiles.map(rel => fs.readFileSync(path.join(project, rel)));
    const upgrade = runBoardAdapter('status', project, 'board-shell optional-update smoke');
    requireMarker(upgrade, 'BOARD_SHELL_UPGRADE_AVAILABLE', 'board-shell optional-update smoke');
    for (let i = 0; i < trackedFiles.length; i++) {
      if (!fs.readFileSync(path.join(project, trackedFiles[i])).equals(beforeStatus[i])) fail('status changed ' + trackedFiles[i]);
    }

    // A lower version alone must not require a shell copy for a real publish/build.
    const input = path.join(project, 'entry.json');
    fs.writeFileSync(input, JSON.stringify({ entry: { title: 'compatible shell', docPath: 'docs/compatible.md', status: '草稿' }, detail: { solution: 'human solution' } }));
    for (const [script, args] of [['board-add.js', [input]], ['build.js', []]]) {
      const result = spawnSync(process.execPath, [path.join(project, 'project-html', script), ...args], { cwd: project, encoding: 'utf8', timeout: 30000, windowsHide: true });
      if (result.error || result.status !== 0) fail('compatible older shell publication failed: ' + (result.error || result.stderr));
    }
    for (let i = 0; i < 6; i++) {
      if (!fs.readFileSync(path.join(project, requiredFiles[i])).equals(beforeStatus[i])) fail('compatible publication replaced shell: ' + requiredFiles[i]);
    }
    const records = new Function(fs.readFileSync(changesPath, 'utf8') + '; return changes;')();
    if (records.length !== 1 || records[0].docPath !== 'docs/compatible.md') fail('compatible publication must create exactly the requested record');
    if (!fs.existsSync(path.join(project, 'docs', 'INDEX.md'))) fail('compatible publication must build its index');
    if (fs.readFileSync(detailPath, 'utf8') !== detailSentinel) fail('compatible publication changed an unrelated sidecar');

    // An older shell is upgraded by sync: replaced shell files are backed up, data/ is untouched.
    const oldBoardJs = fs.readFileSync(boardJsPath);
    const upgraded = runBoardAdapter('sync', project, 'board-shell upgrade smoke');
    requireMarker(upgraded, 'BOARD_SHELL_REPLACED=js/board.js', 'board-shell upgrade smoke');
    const backupLine = ((upgraded && upgraded.stdout) || '').split(/\r?\n/).find((line) => line.startsWith('BOARD_SHELL_BACKUP=project-html/.shell-backup/v0-'));
    if (!backupLine) fail('board-shell upgrade must report a versioned backup directory');
    else if (!fs.readFileSync(path.join(project, ...backupLine.slice('BOARD_SHELL_BACKUP='.length).split('/'), 'js', 'board.js')).equals(oldBoardJs)) {
      fail('board-shell upgrade backup must hold the replaced board.js bytes');
    }
    if (!fs.readFileSync(changesPath, 'utf8').includes('docs/compatible.md')) fail('board-shell upgrade lost catalog records');
    if (fs.readFileSync(detailPath, 'utf8') !== detailSentinel) fail('board-shell upgrade changed a detail sidecar');
    requireMarker(runBoardAdapter('status', project, 'board-shell post-upgrade smoke'), 'BOARD_SHELL_CURRENT', 'board-shell post-upgrade smoke');

    // Unknown and newer versions must remain read-only diagnostics, not a forced downgrade.
    fs.writeFileSync(boardJsPath, boardJs.replace(versionPattern, (_match, prefix) => prefix + '99999'), 'utf8');
    requireMarker(runBoardAdapter('status', project, 'newer shell smoke'), 'BOARD_SHELL_CURRENT', 'newer shell smoke');
    const newerBytes = fs.readFileSync(boardJsPath);
    const downgrade = spawnSync(process.execPath, [path.join(root, 'skills/_shared/scripts/board-bootstrap.js'), 'sync', project], { encoding: 'utf8', windowsHide: true });
    if (downgrade.status === 0 || !downgrade.stderr.includes('BOARD_SHELL_DOWNGRADE_REFUSED') || !fs.readFileSync(boardJsPath).equals(newerBytes)) fail('sync must reject a downgrade before copying');
    fs.writeFileSync(boardJsPath, boardJs.replace(versionPattern, 'constUnknownVersion = 0'), 'utf8');
    requireMarker(runBoardAdapter('status', project, 'unknown shell smoke'), 'BOARD_SHELL_VERSION_UNKNOWN', 'unknown shell smoke');
    fs.unlinkSync(path.join(project, 'project-html', 'board-add.js'));
    const incomplete = runBoardAdapter('status', project, 'incomplete shell smoke');
    requireMarker(incomplete, 'BOARD_SHELL_INCOMPLETE', 'incomplete shell smoke');
    requireMarker(incomplete, 'BOARD_SHELL_MISSING_FILES=board-add.js', 'incomplete shell smoke');
  } finally {
    removeTempRoot(tempRoot);
  }
}

// sync must never leave a half-initialized or mixed-version shell behind.
function smokeBoardShellSyncFailures() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-workflow-skills-board-shell-'));
  try {
    const template = path.join(root, 'skills', 'yan-dev-doc', 'assets', 'board');
    const home = path.join(tempRoot, 'home');
    // A loose adapter resolves its "current skill tree" template to tempRoot/yan-dev-doc/assets/board.
    const adapter = path.join(tempRoot, 'loose', 'scripts', 'board-bootstrap.js');
    const localTemplate = path.join(tempRoot, 'yan-dev-doc', 'assets', 'board');
    fs.mkdirSync(path.dirname(adapter), { recursive: true });
    fs.copyFileSync(path.join(root, 'skills', '_shared', 'scripts', 'board-bootstrap.js'), adapter);
    fs.cpSync(template, localTemplate, { recursive: true });
    fs.rmSync(path.join(localTemplate, 'js', 'vendor', 'mermaid.min.js'));
    const env = Object.assign({}, process.env, { HOME: home, USERPROFILE: home });
    delete env.DEV_WORKFLOW_SKILLS_BOARD_TEMPLATE;
    const run = (command, project) => spawnSync(process.execPath, [adapter, command, project], { encoding: 'utf8', timeout: 30000, windowsHide: true, env });

    const project = path.join(tempRoot, 'project');
    fs.mkdirSync(project, { recursive: true });
    const refused = run('sync', project);
    if (refused.status === 0 || !refused.stderr.includes('BOARD_TEMPLATE_INCOMPLETE') || fs.existsSync(path.join(project, 'project-html'))) {
      fail('sync with only an incomplete template must fail before creating project-html');
    }

    fs.cpSync(template, path.join(home, '.agents', 'skills', 'yan-dev-doc', 'assets', 'board'), { recursive: true });
    const initialized = run('sync', project);
    if (initialized.status !== 0 || !fs.existsSync(path.join(project, 'project-html', 'js', 'vendor', 'mermaid.min.js'))) {
      fail('sync must prefer a complete installed template over an incomplete local one: ' + initialized.stderr);
      return;
    }
    if (fs.readdirSync(path.join(project, 'project-html')).includes('.shell-backup')) fail('a clean initial sync must not leave staging directories');
    if (fs.existsSync(path.join(project, 'project-html', 'data', 'changes.js.lock'))) fail('a successful sync must release its board write lock');

    // Older shell, one created file pending, and a vendor path that cannot be replaced mid-sync.
    const boardJsPath = path.join(project, 'project-html', 'js', 'board.js');
    const oldBoardJs = Buffer.from(fs.readFileSync(boardJsPath, 'utf8').replace(/(BOARD_VERSION[ \t]*=[ \t]*)\d+/, '$10'), 'utf8');
    fs.writeFileSync(boardJsPath, oldBoardJs);

    // A held board write lock blocks sync before any shell file or the holder's lock changes.
    const lockPath = path.join(project, 'project-html', 'data', 'changes.js.lock');
    const holder = JSON.stringify({ pid: process.pid, host: os.hostname(), createdAt: new Date().toISOString() }) + '\n';
    fs.writeFileSync(lockPath, holder);
    const locked = run('sync', project);
    if (locked.status === 0 || !locked.stderr.includes('BOARD_WRITE_LOCKED')) fail('sync must refuse while the board write lock is held: ' + locked.stderr);
    if (!fs.readFileSync(boardJsPath).equals(oldBoardJs)) fail('a lock-blocked sync must not replace shell files');
    if (!fs.existsSync(lockPath) || fs.readFileSync(lockPath, 'utf8') !== holder) fail('a lock-blocked sync must leave the holder lock intact');
    fs.rmSync(lockPath);

    fs.rmSync(path.join(project, 'project-html', 'index.html'));
    const vendor = path.join(project, 'project-html', 'js', 'vendor');
    fs.rmSync(vendor, { recursive: true });
    fs.writeFileSync(vendor, 'not a directory');
    const broken = run('sync', project);
    if (broken.status === 0 || !broken.stderr.includes('BOARD_SHELL_SYNC_FAILED') || !broken.stderr.includes('rolled back')) {
      fail('a mid-sync failure must report BOARD_SHELL_SYNC_FAILED with a completed rollback: ' + broken.stderr);
    }
    if (!fs.readFileSync(boardJsPath).equals(oldBoardJs)) fail('a failed sync must restore the replaced board.js');
    if (fs.existsSync(path.join(project, 'project-html', 'index.html'))) fail('a failed sync must remove files it created');
    if ((broken.stdout || '').includes('BOARD_SHELL_REPLACED=') || (broken.stdout || '').includes('BOARD_SHELL_SYNCED=')) fail('a failed sync must not report replaced or synced files');
    const backupDir = path.join(project, 'project-html', '.shell-backup');
    if (fs.existsSync(backupDir) && fs.readdirSync(backupDir).some((name) => name.startsWith('.staging-'))) fail('a failed sync must remove its staging directory');
    if (fs.existsSync(lockPath)) fail('a failed sync must release its board write lock');
    const status = run('status', project);
    if (status.status !== 0 || !status.stdout.includes('BOARD_SHELL_INCOMPLETE')) fail('status after a failed sync must still report the incomplete old shell');
  } finally {
    removeTempRoot(tempRoot);
  }
}

// The plan example is copied by agents; a fixed gate in it would roll continued dossiers back to the plan stage.
if (/"currentGate"\s*:/.test(read('skills/yan-dev-doc/publishing-board.md'))) {
  fail('skills/yan-dev-doc/publishing-board.md example must not set currentGate; continued dossiers keep their real gate');
}

smokeBoardShellBootstrap();
smokeBoardShellSyncFailures();

// Historical records may keep the retired SVN zero-command rule, but must not present it as current.
{
  const retiredSvnRule = /不执行任何 `?svn`? 命令|SVN 工作副本零命令|SVN 项目一律不执行命令/;
  const supersededMarker = /#35|已被取代/;
  const unmarked = [];
  const collect = (dir, ext) => !fs.existsSync(dir) ? [] : fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? collect(full, ext) : full.endsWith(ext) ? [full] : [];
  });
  for (const file of collect(path.join(root, 'docs'), '.md')) {
    const rel = path.relative(root, file).replace(/\\/g, '/');
    if (rel === 'docs/INDEX.md') continue;
    const text = fs.readFileSync(file, 'utf8');
    const fileMarked = /已被取代/.test(text.split('\n').slice(0, 6).join('\n'));
    text.split('\n').forEach((line, index) => {
      if (retiredSvnRule.test(line) && !fileMarked && !supersededMarker.test(line)) unmarked.push(`${rel}:${index + 1}`);
    });
  }
  for (const file of collect(path.join(root, 'project-html/data/details'), '.js')) {
    const holder = {};
    new Function('window', fs.readFileSync(file, 'utf8'))(holder);
    const visit = (value, where) => {
      if (typeof value === 'string') { if (retiredSvnRule.test(value) && !supersededMarker.test(value)) unmarked.push(`${where}: ${value.slice(0, 60)}`); }
      else if (Array.isArray(value)) value.forEach((item, index) => visit(item, `${where}[${index}]`));
      else if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) visit(item, `${where}.${key}`);
    };
    visit(holder.BOARD_DETAILS, path.relative(root, file).replace(/\\/g, '/'));
  }
  if (unmarked.length) fail('retired SVN zero-command rule appears without a superseded marker (#35 / 已被取代):\n  ' + unmarked.join('\n  '));
}

if (failed) process.exit(1);
console.log('ok document skill boundary checks passed; cross-platform board adapter smoke executed');
