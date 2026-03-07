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
const chunkDir = path.join(projectRoot, "webui", "src", "ce8k", "chunks");
const manifestPath = path.join(chunkDir, "manifest.json");
const runtimeDir = path.join(chunkDir, "runtime-prelude");
const runtimeManifestPath = path.join(runtimeDir, "manifest.json");
const runtimeChunkPath = path.join(chunkDir, "00-runtime-prelude.js");
const consoleDir = path.join(chunkDir, "component-console-m3");
const consoleManifestPath = path.join(consoleDir, "manifest.json");
const consoleChunkPath = path.join(chunkDir, "10-component-console-m3.js");
const settingsDir = path.join(chunkDir, "component-settings-p3");
const settingsManifestPath = path.join(settingsDir, "manifest.json");
const settingsChunkPath = path.join(chunkDir, "20-component-settings-p3.js");
const appRootDir = path.join(chunkDir, "app-root-f5");
const appRootManifestPath = path.join(appRootDir, "manifest.json");
const appRootChunkPath = path.join(chunkDir, "30-app-root-f5.js");
const outputPath = path.join(projectRoot, "webui", "src", "ce8k", "index-CE8kT8gA.js");

function sha256(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

function rebuildSectionGroup(groupDir, groupManifestPath, targetChunkPath) {
  if (!fs.existsSync(groupManifestPath)) return false;
  const groupManifest = JSON.parse(fs.readFileSync(groupManifestPath, "utf8"));
  if (!Array.isArray(groupManifest.sections) || groupManifest.sections.length === 0) return false;
  const merged = groupManifest.sections.map((item) => {
    const fileName = String(item.file || "");
    if (!fileName) throw new Error(`Invalid section entry in ${groupManifestPath}: file is empty.`);
    const sectionPath = path.join(groupDir, fileName);
    if (!fs.existsSync(sectionPath)) {
      throw new Error(`Section missing: ${sectionPath}`);
    }
    return fs.readFileSync(sectionPath, "utf8");
  }).join("");
  fs.writeFileSync(targetChunkPath, merged, "utf8");
  return true;
}

function main() {
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Manifest not found: ${manifestPath}`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (!Array.isArray(manifest.chunks) || manifest.chunks.length === 0) {
    throw new Error("Invalid chunk manifest: chunks is empty.");
  }

  rebuildSectionGroup(runtimeDir, runtimeManifestPath, runtimeChunkPath);
  rebuildSectionGroup(consoleDir, consoleManifestPath, consoleChunkPath);
  rebuildSectionGroup(settingsDir, settingsManifestPath, settingsChunkPath);
  rebuildSectionGroup(appRootDir, appRootManifestPath, appRootChunkPath);

  const merged = manifest.chunks.map((item) => {
    const fileName = String(item.file || "");
    if (!fileName) throw new Error("Invalid chunk entry: file is empty.");
    const chunkPath = path.join(chunkDir, fileName);
    if (!fs.existsSync(chunkPath)) {
      throw new Error(`Chunk missing: ${chunkPath}`);
    }
    return fs.readFileSync(chunkPath, "utf8");
  }).join("");

  fs.writeFileSync(outputPath, merged, "utf8");

  console.log(`Rebuild OK: ${path.relative(projectRoot, outputPath).replaceAll("\\", "/")}`);
  console.log(`Output SHA256: ${sha256(merged)}`);
}

main();
