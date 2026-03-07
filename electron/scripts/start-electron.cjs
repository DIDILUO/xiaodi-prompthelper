/*
 * @phb-version-tag: recovered-ce8k-r17
 * @phb-version: 0.0.1-recovered-r17
 * @phb-version-note: CE8K reverse-recovered baseline; naming refactor batch17 complete.
 * @phb-updated-at: 2026-02-18
 */
const { spawn } = require("child_process");

const electronBinary = require("electron");
const cwd = process.cwd();
const env = { ...process.env };

delete env.ELECTRON_RUN_AS_NODE;
if (!env.ELECTRON_DEV_SERVER_URL) {
  env.ELECTRON_DEV_SERVER_URL = "http://127.0.0.1:5173";
}

const child = spawn(electronBinary, ["."], {
  cwd,
  env,
  stdio: "inherit"
});

child.on("exit", (code, signal) => {
  if (typeof code === "number") {
    process.exit(code);
    return;
  }
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(1);
});
