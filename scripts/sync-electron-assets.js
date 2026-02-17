const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const webuiDist = path.join(root, 'webui', 'dist');
const serverDir = path.join(root, 'server');
const electronDir = path.join(root, 'electron');
const targetWebui = path.join(electronDir, 'webui', 'dist');
const targetServer = path.join(electronDir, 'server');

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    throw new Error(`Missing source: ${src}`);
  }
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
}

try {
  copyDir(webuiDist, targetWebui);
  copyDir(serverDir, targetServer);
  console.log('[sync] Copied webui/dist and server into electron package');
} catch (err) {
  console.error('[sync] Failed:', err.message);
  process.exit(1);
}
