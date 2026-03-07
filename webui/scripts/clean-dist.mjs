import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return [
    d.getFullYear(),
    pad(d.getMonth() + 1),
    pad(d.getDate())
  ].join("") + "-" + [pad(d.getHours()), pad(d.getMinutes()), pad(d.getSeconds())].join("");
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webuiDir = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(webuiDir, "..");
const workspaceRoot = path.resolve(repoRoot, "..");
const distDir = path.join(webuiDir, "dist");
const backupRoot = path.join(
  workspaceRoot,
  "本地备份",
  "03-打包过程归档",
  "webui-dist-history"
);

if (!fs.existsSync(distDir)) {
  console.log("[clean-dist] skip: dist not found");
  process.exit(0);
}

fs.mkdirSync(backupRoot, { recursive: true });
const target = path.join(backupRoot, `dist-${nowStamp()}`);
fs.renameSync(distDir, target);
console.log(`[clean-dist] moved to backup: ${distDir} -> ${target}`);
