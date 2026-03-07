/*
 * Staged packaging workflow:
 * 1) Copy only required runtime files into a temporary staging dir
 * 2) Move non-runtime state/cache files into backup archive (no delete)
 * 3) Package from staging dir
 * 4) Emit release folder in user-facing structure (software + plugin placeholder)
 */
const fs = require("fs");
const path = require("path");

const DIR_BUILD = "\u6784\u5efa\u6587\u4ef6";
const DIR_BACKUP = "\u672c\u5730\u5907\u4efd";
const DIR_TEMP = "\u4e34\u65f6\u7f13\u5b58";
const DIR_PLUGIN = "\uff08\u5fc5\u987b\u5b89\u88c5\uff09\u63d2\u4ef6";
const DIR_PLUGIN_REUSE = "00-\u63d2\u4ef6\u590d\u7528";
const APP_NAME = "\u5c0f\u8fea\u52a9\u8bcd\u5668";
const REUSED_PLUGIN_FILE_NAME = "\u5c0f\u8fea\u52a9\u8bcd\u5668\uff08\u53cc\u51fb\u81ea\u52a8\u5b89\u88c5\uff09.ccx";

function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return [
    d.getFullYear(),
    pad(d.getMonth() + 1),
    pad(d.getDate())
  ].join("") + "-" + [pad(d.getHours()), pad(d.getMinutes()), pad(d.getSeconds())].join("");
}

function dateTagYYMMDD(input = new Date()) {
  const d = input;
  const pad = (n) => String(n).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${yy}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

function buildReleaseFolderName(version, dateTag) {
  const safeVersion = String(version || "0.0.0").trim() || "0.0.0";
  const safeDateTag = String(dateTag || "").trim() || dateTagYYMMDD();
  return `${APP_NAME}v${safeVersion}-${safeDateTag}`;
}

function formatLogDateTime(inputMs) {
  if (!Number.isFinite(inputMs) || inputMs <= 0) return "n/a";
  const d = new Date(inputMs);
  const pad = (n) => String(n).padStart(2, "0");
  return [
    d.getFullYear(),
    pad(d.getMonth() + 1),
    pad(d.getDate())
  ].join("-") + " " + [pad(d.getHours()), pad(d.getMinutes()), pad(d.getSeconds())].join(":");
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function copyPath(src, dst) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    ensureDir(dst);
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      const childSrc = path.join(src, entry.name);
      const childDst = path.join(dst, entry.name);
      if (entry.isDirectory()) {
        copyPath(childSrc, childDst);
        continue;
      }
      if (entry.isFile()) {
        ensureDir(path.dirname(childDst));
        fs.copyFileSync(childSrc, childDst);
        continue;
      }
      throw new Error(`unsupported file type: ${childSrc}`);
    }
    return;
  }
  ensureDir(path.dirname(dst));
  fs.copyFileSync(src, dst);
}

function readJsonFile(jsonPath) {
  const raw = fs.readFileSync(jsonPath, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(raw);
}

function getLatestFileMtimeMs(rootDir, options = {}) {
  if (!fs.existsSync(rootDir)) return 0;
  const ignoreDirNames = new Set(options.ignoreDirNames || []);
  let latestMtimeMs = 0;
  const walk = (dir) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (ignoreDirNames.has(entry.name)) continue;
        walk(fullPath);
        continue;
      }
      if (!entry.isFile()) continue;
      if (/\.ccx$/i.test(entry.name) || /\.xdx$/i.test(entry.name)) continue;
      const stat = fs.statSync(fullPath);
      if (stat.mtimeMs > latestMtimeMs) latestMtimeMs = stat.mtimeMs;
    }
  };
  walk(rootDir);
  return latestMtimeMs;
}

function moveToArchive(srcPath, archiveRoot, label) {
  if (!fs.existsSync(srcPath)) {
    return { target: null, sourceStillExists: false, mode: "none" };
  }
  const target = path.join(archiveRoot, label);
  ensureDir(path.dirname(target));
  try {
    fs.renameSync(srcPath, target);
    return { target, sourceStillExists: false, mode: "rename" };
  } catch (err) {
    copyPath(srcPath, target);
    let removeError = null;
    try {
      fs.rmSync(srcPath, { recursive: true, force: true });
    } catch (rmErr) {
      removeError = rmErr;
    }
    const sourceStillExists = fs.existsSync(srcPath);
    if (sourceStillExists) {
      console.warn(
        `[package-staged] warn: source still exists after backup copy: ${srcPath}`
        + (removeError ? ` (${removeError && removeError.message ? removeError.message : removeError})` : "")
      );
    }
    console.warn(
      `[package-staged] warn: rename fallback to copy for ${srcPath} -> ${target}: ${err && err.message ? err.message : err}`
    );
    return { target, sourceStillExists, mode: "copy" };
  }
}

async function main() {
  const stamp = nowStamp();
  const electronRoot = path.resolve(__dirname, "..");
  const repoRoot = path.resolve(electronRoot, "..");
  const workspaceRoot = path.resolve(repoRoot, "..");
  const electronPackageJsonPath = path.join(electronRoot, "package.json");
  const electronPackageJson = readJsonFile(electronPackageJsonPath);
  const releaseVersion = String(electronPackageJson.version || "0.0.0");
  const releaseFolderName = buildReleaseFolderName(releaseVersion, dateTagYYMMDD());

  const buildRoot = ensureDir(path.join(workspaceRoot, DIR_BUILD, "01-\u53d1\u5e03\u4ea7\u7269"));
  const backupRoot = ensureDir(path.join(workspaceRoot, DIR_BACKUP, "03-\u6253\u5305\u8fc7\u7a0b\u5f52\u6863", "pack-prune-history"));
  const tempRoot = ensureDir(path.join(workspaceRoot, DIR_TEMP, "01-\u6253\u5305\u4e2d\u95f4\u6001", "packaging-stage"));

  const stageDir = path.join(tempRoot, `_stage-${stamp}`);
  const rawPackOutDir = path.join(tempRoot, `_raw-pack-${stamp}`);
  let outDir = path.join(buildRoot, releaseFolderName);
  let pluginDir = "";
  const pluginReuseDir = ensureDir(path.join(workspaceRoot, DIR_BUILD, DIR_PLUGIN_REUSE));
  const pluginReuseFile = path.join(pluginReuseDir, REUSED_PLUGIN_FILE_NAME);
  const backupBatchDir = ensureDir(path.join(backupRoot, `pack-prune-${stamp}`));

  const keepEntries = [
    "main.js",
    "preload.js",
    "shell-ipc-contract.js",
    "package.json",
    "renderer",
    "server",
    "webui"
  ];

  if (fs.existsSync(stageDir)) {
    moveToArchive(stageDir, backupBatchDir, "_previous-stage");
  }
  ensureDir(stageDir);

  for (const name of keepEntries) {
    const src = path.join(electronRoot, name);
    if (!fs.existsSync(src)) {
      throw new Error(`missing required package entry: ${src}`);
    }
    copyPath(src, path.join(stageDir, name));
  }

  const pruned = [];
  const pruneItems = [
    { rel: path.join("server", "data"), label: "server-data" },
    { rel: path.join("server", "package-lock.json"), label: "server-package-lock.json" }
  ];
  for (const item of pruneItems) {
    const src = path.join(stageDir, item.rel);
    const moved = moveToArchive(src, backupBatchDir, item.label);
    if (moved && moved.target) pruned.push({ from: src, to: moved.target });
  }

  const packager = require(path.join(electronRoot, "node_modules", "electron-packager"));
  const electronPkg = require(path.join(electronRoot, "node_modules", "electron", "package.json"));
  const iconPath = path.join(electronRoot, "assets", "app-icon.ico");
  if (!fs.existsSync(iconPath)) {
    throw new Error(`missing icon file: ${iconPath}`);
  }

  if (fs.existsSync(outDir)) {
    moveToArchive(outDir, backupBatchDir, path.join("release-overwrite", path.basename(outDir)));
    if (fs.existsSync(outDir)) {
      const fallbackOutDir = path.join(buildRoot, `${releaseFolderName}-${stamp}`);
      console.warn(`[package-staged] warn: release dir busy, fallback to: ${fallbackOutDir}`);
      outDir = fallbackOutDir;
    }
  }
  ensureDir(outDir);
  pluginDir = path.join(outDir, DIR_PLUGIN);
  const appPaths = await packager({
    dir: stageDir,
    out: rawPackOutDir,
    name: APP_NAME,
    platform: "win32",
    arch: "x64",
    icon: iconPath,
    overwrite: true,
    prune: false,
    electronVersion: electronPkg.version
  });

  ensureDir(pluginDir);
  let reusedPluginOutputPath = "";
  if (fs.existsSync(pluginReuseFile)) {
    reusedPluginOutputPath = path.join(pluginDir, REUSED_PLUGIN_FILE_NAME);
    if (fs.existsSync(reusedPluginOutputPath)) {
      moveToArchive(
        reusedPluginOutputPath,
        backupBatchDir,
        path.join("plugin-overwrite", path.basename(reusedPluginOutputPath))
      );
    }
    copyPath(pluginReuseFile, reusedPluginOutputPath);
  } else {
    console.warn(`[package-staged] remind: reusable plugin file missing: ${pluginReuseFile}`);
    console.warn("[package-staged] remind: please place your manually packaged plugin file before release.");
  }

  const pluginSourceRoot = path.join(repoRoot, "ps-plugin-uxp-starter");
  const pluginSourceLatestMtimeMs = getLatestFileMtimeMs(pluginSourceRoot, {
    ignoreDirNames: ["dist", ".git", "node_modules"],
  });
  if (fs.existsSync(pluginReuseFile)) {
    const pluginReuseMtimeMs = fs.statSync(pluginReuseFile).mtimeMs;
    if (pluginSourceLatestMtimeMs > pluginReuseMtimeMs + 1000) {
      console.warn("[package-staged] remind: plugin source is newer than reusable plugin package.");
      console.warn(
        `[package-staged] remind: sourceLatest=${formatLogDateTime(pluginSourceLatestMtimeMs)}, `
        + `pluginFile=${formatLogDateTime(pluginReuseMtimeMs)}`
      );
      console.warn("[package-staged] remind: please repackage plugin manually and replace the reusable plugin file.");
    }
  }

  let softwareDir = "";
  for (const appPath of appPaths) {
    let target = path.join(outDir, `\uff08\u8f6f\u4ef6\u672c\u4f53\uff09${path.basename(appPath)}`);
    if (fs.existsSync(target)) {
      moveToArchive(target, backupBatchDir, path.join("software-overwrite", path.basename(target)));
      if (fs.existsSync(target)) {
        target = `${target}-${stamp}`;
        console.warn(`[package-staged] warn: software target busy, fallback to: ${target}`);
      }
    }
    softwareDir = target;
    copyPath(appPath, target);
  }

  moveToArchive(rawPackOutDir, backupBatchDir, "_raw-pack-output");
  moveToArchive(stageDir, backupBatchDir, "_stage-after-pack");

  console.log("[package-staged] success");
  console.log(`[package-staged] out: ${outDir}`);
  console.log(`[package-staged] releaseVersion: ${releaseVersion}`);
  console.log(`[package-staged] buildRoot: ${buildRoot}`);
  console.log(`[package-staged] backupRoot: ${backupBatchDir}`);
  console.log(`[package-staged] software: ${softwareDir}`);
  console.log(`[package-staged] plugin dir: ${pluginDir}`);
  console.log(`[package-staged] plugin reuse source: ${pluginReuseFile}`);
  if (reusedPluginOutputPath) {
    console.log(`[package-staged] plugin reused: ${reusedPluginOutputPath}`);
  }
  if (pruned.length) {
    console.log("[package-staged] archived pruned items:");
    for (const item of pruned) {
      console.log(`  - ${item.from} -> ${item.to}`);
    }
  }
}

main().catch((error) => {
  console.error("[package-staged] failed:", error && error.stack ? error.stack : error);
  process.exit(1);
});
