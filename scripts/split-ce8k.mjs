/*
 * @phb-version-tag: recovered-ce8k-r17
 * @phb-version: 0.0.1-recovered-r17
 * @phb-version-note: CE8K reverse-recovered baseline; naming refactor batch17 complete.
 * @phb-updated-at: 2026-02-18
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const projectRoot = process.cwd();
const sourcePath = path.join(projectRoot, "webui", "src", "ce8k", "index-CE8kT8gA.js");
const chunkDir = path.join(projectRoot, "webui", "src", "ce8k", "chunks");
const manifestPath = path.join(chunkDir, "manifest.json");
const readmePath = path.join(chunkDir, "README.zh-CN.md");
const runtimeDir = path.join(chunkDir, "runtime-prelude");
const consoleDir = path.join(chunkDir, "component-console-m3");
const settingsDir = path.join(chunkDir, "component-settings-p3");
const appRootDir = path.join(chunkDir, "app-root-f5");
const runPipelineDir = path.join(appRootDir, "run-pipeline");
const runtimeManifestPath = path.join(runtimeDir, "manifest.json");
const consoleManifestPath = path.join(consoleDir, "manifest.json");
const settingsManifestPath = path.join(settingsDir, "manifest.json");
const appRootManifestPath = path.join(appRootDir, "manifest.json");
const runPipelineManifestPath = path.join(runPipelineDir, "manifest.json");

function sha256(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function resetDir(dirPath) {
  fs.rmSync(dirPath, { recursive: true, force: true });
  fs.mkdirSync(dirPath, { recursive: true });
}

function findAnchor(content, anchor, fromIndex = 0) {
  const idx = content.indexOf(anchor, fromIndex);
  if (idx < 0) return -1;
  return idx;
}

function findAnyAnchor(content, anchors, fromIndex = 0) {
  for (const anchor of anchors) {
    const idx = findAnchor(content, anchor, fromIndex);
    if (idx >= 0) return idx;
  }
  throw new Error(`Anchor not found: ${anchors.join(" | ")}`);
}

function writeSectionGroup(sourceChunkPath, targetDir, targetManifestPath, sections) {
  const content = fs.readFileSync(sourceChunkPath, "utf8");
  resetDir(targetDir);
  const groupManifest = {
    generatedAt: new Date().toISOString(),
    sourcePath: path.relative(projectRoot, sourceChunkPath).replaceAll("\\", "/"),
    sourceSha256: sha256(content),
    sourceLength: content.length,
    sections: []
  };

  for (const item of sections) {
    const part = content.slice(item.start, item.end);
    fs.writeFileSync(path.join(targetDir, item.file), part, "utf8");
    groupManifest.sections.push({
      file: item.file,
      role: item.role,
      start: item.start,
      end: item.end,
      length: part.length,
      sha256: sha256(part)
    });
  }

  fs.writeFileSync(targetManifestPath, `${JSON.stringify(groupManifest, null, 2)}\n`, "utf8");
  const rebuilt = groupManifest.sections.map((item) => fs.readFileSync(path.join(targetDir, item.file), "utf8")).join("");
  if (rebuilt !== content) {
    throw new Error(`Section group roundtrip check failed: ${targetDir}`);
  }
}

function splitRuntimeChunk(runtimeChunkPath) {
  const content = fs.readFileSync(runtimeChunkPath, "utf8");
  const f3Index = findAnyAnchor(content, ["function f3("], 0);
  if (!(0 < f3Index && f3Index < content.length)) {
    throw new Error("Invalid runtime split anchors.");
  }
  const sections = [
    { file: "01-react-runtime-core.js", role: "react-runtime-core", start: 0, end: f3Index },
    { file: "02-log-classifier-f3.js", role: "log-classifier-f3", start: f3Index, end: content.length }
  ];
  writeSectionGroup(runtimeChunkPath, runtimeDir, runtimeManifestPath, sections);
}

function splitConsoleChunk(consoleChunkPath) {
  const content = fs.readFileSync(consoleChunkPath, "utf8");
  const h3Index = findAnyAnchor(content, ["function h3("], 0);
  const g3Index = findAnyAnchor(content, ["function g3("], h3Index + 1);
  const ygIndex = findAnyAnchor(content, ["function yg("], g3Index + 1);
  const vgIndex = findAnyAnchor(content, ["function vg("], ygIndex + 1);
  const bgIndex = findAnyAnchor(content, ["function bg("], vgIndex + 1);
  if (!(0 < h3Index && h3Index < g3Index && g3Index < ygIndex && ygIndex < vgIndex && vgIndex < bgIndex)) {
    throw new Error("Invalid console split anchors.");
  }
  const sections = [
    { file: "01-console-panel-m3.js", role: "console-panel-m3", start: 0, end: h3Index },
    { file: "02-topbar-api-status-h3.js", role: "topbar-api-status-h3", start: h3Index, end: g3Index },
    { file: "03-mask-secret-g3.js", role: "mask-secret-g3", start: g3Index, end: ygIndex },
    { file: "04-settings-api-key-field-yg.js", role: "settings-api-key-field-yg", start: ygIndex, end: vgIndex },
    { file: "05-mask-secret-vg.js", role: "mask-secret-vg", start: vgIndex, end: bgIndex },
    { file: "06-summary-model-bg.js", role: "summary-model-bg", start: bgIndex, end: content.length }
  ];
  writeSectionGroup(consoleChunkPath, consoleDir, consoleManifestPath, sections);
}

function splitSettingsChunk(settingsChunkPath) {
  const content = fs.readFileSync(settingsChunkPath, "utf8");
  const l1Index = findAnyAnchor(content, ["function L1("], 0);
  const veIndex = findAnyAnchor(content, ["const Ve=280"], l1Index + 1);
  const slIndex = findAnyAnchor(content, ["function Sl("], veIndex + 1);
  const liIndex = findAnyAnchor(content, ["function li("], slIndex + 1);
  if (!(0 < l1Index && l1Index < veIndex && veIndex < slIndex && slIndex < liIndex)) {
    throw new Error("Invalid settings split anchors.");
  }
  const sections = [
    { file: "01-settings-view-p3.js", role: "settings-view-p3", start: 0, end: l1Index },
    { file: "02-settings-runtime-guards.js", role: "settings-runtime-guards", start: l1Index, end: veIndex },
    { file: "03-settings-constants-presets.js", role: "settings-constants-presets", start: veIndex, end: slIndex },
    { file: "04-settings-provider-utils.js", role: "settings-provider-utils", start: slIndex, end: liIndex },
    { file: "05-settings-storage-helpers.js", role: "settings-storage-helpers", start: liIndex, end: content.length }
  ];
  writeSectionGroup(settingsChunkPath, settingsDir, settingsManifestPath, sections);
}

function splitAppRootChunk(appRootChunkPath) {
  const content = fs.readFileSync(appRootChunkPath, "utf8");
  const stateIdx = findAnyAnchor(content, ["const _r=", "_r="], 0);
  const bridgeIdx = findAnyAnchor(content, ["ll=async", "ll="], stateIdx + 1);
  const runIdx = findAnyAnchor(content, ["wu=async", "wu="], bridgeIdx + 1);
  const renderIdx = findAnyAnchor(content, ["return c.jsxs(\"div\"", "return c.jsx(\"div\""], runIdx + 1);

  if (!(0 < stateIdx && stateIdx < bridgeIdx && bridgeIdx < runIdx && runIdx < renderIdx)) {
    throw new Error("Invalid app-root split anchor ordering.");
  }

  const sections = [
    { file: "01-state-and-refs.js", role: "state-and-refs", start: 0, end: stateIdx },
    { file: "02-config-and-validation.js", role: "config-and-validation", start: stateIdx, end: bridgeIdx },
    { file: "03-bridge-and-export.js", role: "bridge-and-export", start: bridgeIdx, end: runIdx },
    { file: "04-run-pipeline.js", role: "run-pipeline", start: runIdx, end: renderIdx },
    { file: "05-render-tree.js", role: "render-tree", start: renderIdx, end: content.length }
  ];
  writeSectionGroup(appRootChunkPath, appRootDir, appRootManifestPath, sections);
}

function splitRunPipelineSection(runPipelinePath) {
  const content = fs.readFileSync(runPipelinePath, "utf8");
  const yfIndex = findAnyAnchor(content, ["yf=async"], 0);
  const guIndex = findAnyAnchor(content, ["Gu=async"], yfIndex + 1);
  const wfIndex = findAnyAnchor(content, ["wf=async"], guIndex + 1);
  const ehIndex = findAnyAnchor(content, ["eh=async"], wfIndex + 1);
  const geIndex = findAnyAnchor(content, ["ge=async"], ehIndex + 1);
  if (!(0 < yfIndex && yfIndex < guIndex && guIndex < wfIndex && wfIndex < ehIndex && ehIndex < geIndex)) {
    throw new Error("Invalid run-pipeline split anchors.");
  }
  const sections = [
    { file: "01-image-run-core.js", role: "image-run-core", start: 0, end: yfIndex },
    { file: "02-image-processing-and-upload.js", role: "image-processing-and-upload", start: yfIndex, end: guIndex },
    { file: "03-ps-upload-and-slot-bridge.js", role: "ps-upload-and-slot-bridge", start: guIndex, end: wfIndex },
    { file: "04-chat-request-pipeline.js", role: "chat-request-pipeline", start: wfIndex, end: ehIndex },
    { file: "05-chat-action-handlers.js", role: "chat-action-handlers", start: ehIndex, end: geIndex },
    { file: "06-chat-ui-side-effects.js", role: "chat-ui-side-effects", start: geIndex, end: content.length }
  ];
  writeSectionGroup(runPipelinePath, runPipelineDir, runPipelineManifestPath, sections);
}

function main() {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source file not found: ${sourcePath}`);
  }

  const content = fs.readFileSync(sourcePath, "utf8");
  const m3Index = findAnyAnchor(content, ["function m3(", "const m3="]);
  const p3Index = findAnyAnchor(content, ["function p3(", "const p3="], m3Index + 1);
  const f5Index = findAnyAnchor(content, ["function F5(", "const F5="], p3Index + 1);

  const chunks = [
    { file: "00-runtime-prelude.js", start: 0, end: m3Index, role: "runtime-prelude" },
    { file: "10-component-console-m3.js", start: m3Index, end: p3Index, role: "console-component-m3" },
    { file: "20-component-settings-p3.js", start: p3Index, end: f5Index, role: "settings-component-p3" },
    { file: "30-app-root-f5.js", start: f5Index, end: content.length, role: "app-root-f5" }
  ];

  resetDir(chunkDir);

  const manifest = {
    generatedAt: new Date().toISOString(),
    sourcePath: path.relative(projectRoot, sourcePath).replaceAll("\\", "/"),
    sourceSha256: sha256(content),
    sourceLength: content.length,
    chunks: []
  };

  for (const item of chunks) {
    const part = content.slice(item.start, item.end);
    const chunkPath = path.join(chunkDir, item.file);
    fs.writeFileSync(chunkPath, part, "utf8");
    manifest.chunks.push({
      file: item.file,
      role: item.role,
      start: item.start,
      end: item.end,
      length: part.length,
      sha256: sha256(part)
    });
  }

  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  fs.writeFileSync(
    readmePath,
    [
      "# CE8K 拆分说明",
      "",
      "本目录由 `npm run split:ce8k` 自动生成，来源仅为当前 `webui/src/ce8k/index-CE8kT8gA.js`。",
      "",
      "## 文件职责",
      "1. `00-runtime-prelude.js`: React/runtime 与公共函数预备段。",
      "2. `10-component-console-m3.js`: 控制台组件段（m3）。",
      "3. `20-component-settings-p3.js`: 设置页组件段（p3）。",
      "4. `30-app-root-f5.js`: 主应用根组件段（F5）与入口收尾。",
      "5. `runtime-prelude/*`: runtime 子段。",
      "6. `component-console-m3/*`: 控制台子段。",
      "7. `component-settings-p3/*`: 设置页子段。",
      "8. `app-root-f5/*`: 主应用根子段。",
      "9. `app-root-f5/run-pipeline/*`: 跑图与对话核心流程子段。",
      "",
      "## 修改流程",
      "1. 在 `chunks` 中修改目标段。",
      "2. 运行 `npm run rebuild:ce8k` 回拼到 `index-CE8kT8gA.js`。",
      "3. 运行 `npm run build --prefix webui` 验证。",
      "",
      "## 约束",
      "- 禁止引入旧备份文件内容。",
      "- 以当前 CE8K 文件为唯一真源（single source of truth）。",
      ""
    ].join("\n"),
    "utf8"
  );

  const rebuilt = manifest.chunks
    .map((item) => fs.readFileSync(path.join(chunkDir, item.file), "utf8"))
    .join("");
  if (rebuilt !== content) {
    throw new Error("Chunk roundtrip check failed: rebuilt content differs from source.");
  }

  console.log(`Split OK: ${manifest.chunks.length} chunks`);
  console.log(`Manifest: ${path.relative(projectRoot, manifestPath).replaceAll("\\", "/")}`);
  console.log(`Source SHA256: ${manifest.sourceSha256}`);

  const appRootChunkPath = path.join(chunkDir, "30-app-root-f5.js");
  splitAppRootChunk(appRootChunkPath);
  console.log(`App root split OK: ${path.relative(projectRoot, appRootManifestPath).replaceAll("\\", "/")}`);

  const runPipelinePath = path.join(appRootDir, "04-run-pipeline.js");
  splitRunPipelineSection(runPipelinePath);
  console.log(`Run pipeline split OK: ${path.relative(projectRoot, runPipelineManifestPath).replaceAll("\\", "/")}`);

  const runtimeChunkPath = path.join(chunkDir, "00-runtime-prelude.js");
  splitRuntimeChunk(runtimeChunkPath);
  console.log(`Runtime split OK: ${path.relative(projectRoot, runtimeManifestPath).replaceAll("\\", "/")}`);

  const consoleChunkPath = path.join(chunkDir, "10-component-console-m3.js");
  splitConsoleChunk(consoleChunkPath);
  console.log(`Console split OK: ${path.relative(projectRoot, consoleManifestPath).replaceAll("\\", "/")}`);

  const settingsChunkPath = path.join(chunkDir, "20-component-settings-p3.js");
  splitSettingsChunk(settingsChunkPath);
  console.log(`Settings split OK: ${path.relative(projectRoot, settingsManifestPath).replaceAll("\\", "/")}`);
}

main();
