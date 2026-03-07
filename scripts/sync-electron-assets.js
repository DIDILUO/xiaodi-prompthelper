/*
 * @phb-version-tag: recovered-ce8k-r17
 * @phb-version: 0.0.1-recovered-r17
 * @phb-version-note: CE8K reverse-recovered baseline; naming refactor batch17 complete.
 * @phb-updated-at: 2026-02-18
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(root, '..');
const webuiDist = path.join(root, 'webui', 'dist');
const serverDir = path.join(root, 'server');
const electronDir = path.join(root, 'electron');
const targetWebui = path.join(electronDir, 'webui', 'dist');
const targetServer = path.join(electronDir, 'server');
const backupRoot = path.join(
  workspaceRoot,
  '\u672c\u5730\u5907\u4efd',
  '03-\u6253\u5305\u8fc7\u7a0b\u5f52\u6863',
  'sync-electron-assets-history'
);

function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return [
    d.getFullYear(),
    pad(d.getMonth() + 1),
    pad(d.getDate())
  ].join('') + '-' + [pad(d.getHours()), pad(d.getMinutes()), pad(d.getSeconds())].join('');
}

function moveToTrashIfExists(src, trashBatchDir, label) {
  if (!fs.existsSync(src)) return null;
  const dst = path.join(trashBatchDir, label);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.renameSync(src, dst);
  return dst;
}

function copyDir(src, dest, options = {}) {
  const { exclude = [] } = options;
  if (!fs.existsSync(src)) {
    throw new Error(`Missing source: ${src}`);
  }
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const childSrc = path.join(src, entry.name);
    const childDest = path.join(dest, entry.name);
    const childRel = path.relative(src, childSrc).replace(/\\/g, '/');
    if (exclude.includes(childRel) || exclude.some((p) => childRel.startsWith(`${p}/`))) {
      continue;
    }
    if (entry.isDirectory()) {
      copyDir(childSrc, childDest, options);
      continue;
    }
    if (entry.isFile()) {
      fs.mkdirSync(path.dirname(childDest), { recursive: true });
      fs.copyFileSync(childSrc, childDest);
      continue;
    }
    throw new Error(`Unsupported file type: ${childSrc}`);
  }
}

try {
  const backupBatchDir = path.join(backupRoot, `sync-electron-assets-${nowStamp()}`);
  fs.mkdirSync(backupBatchDir, { recursive: true });
  moveToTrashIfExists(targetWebui, backupBatchDir, 'electron-webui-dist');
  moveToTrashIfExists(targetServer, backupBatchDir, 'electron-server');
  copyDir(webuiDist, targetWebui);
  copyDir(serverDir, targetServer, { exclude: ['data', 'package-lock.json'] });
  console.log(`[sync] Rebuilt electron/webui/dist and electron/server from fresh copies (backup: ${backupBatchDir})`);
} catch (err) {
  console.error('[sync] Failed:', err.message);
  process.exit(1);
}
