import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const rootDir = process.cwd();
const plansActiveDir = path.join(rootDir, "plans", "active");

function pad2(value) {
  return String(value).padStart(2, "0");
}

function toStamp(date = new Date()) {
  return `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}-${pad2(date.getHours())}${pad2(date.getMinutes())}${pad2(date.getSeconds())}`;
}

function toIsoLocal(date = new Date()) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

function normalizePathForMarkdown(filePath) {
  return filePath.replace(/\\/g, "/");
}

function findLineBySubstring(content, substring) {
  const idx = content.indexOf(substring);
  if (idx < 0) return -1;
  return content.slice(0, idx).split("\n").length;
}

function runCommand(command, args, options = {}) {
  const startedAt = Date.now();
  const result = spawnSync(command, args, {
    cwd: rootDir,
    encoding: "utf8",
    shell: false,
    ...options,
  });
  return {
    command,
    args,
    durationMs: Date.now() - startedAt,
    status: Number.isFinite(result.status) ? result.status : 1,
    stdout: String(result.stdout || ""),
    stderr: String(result.stderr || ""),
    error: result.error ? String(result.error.message || result.error) : "",
  };
}

function getWebuiBuildInvocation() {
  if (process.platform === "win32") {
    return {
      command: process.env.ComSpec || "cmd.exe",
      args: ["/d", "/s", "/c", "npm --prefix webui run build"],
      displayCommand: "npm --prefix webui run build",
    };
  }
  return {
    command: "npm",
    args: ["--prefix", "webui", "run", "build"],
    displayCommand: "npm --prefix webui run build",
  };
}

const webuiBuildInvocation = getWebuiBuildInvocation();

const commandChecks = [
  {
    id: "CMD-01",
    label: "electron syntax check",
    command: process.execPath,
    args: ["-c", "electron/main.js"],
  },
  {
    id: "CMD-02",
    label: "server syntax check",
    command: process.execPath,
    args: ["-c", "server/index.js"],
  },
  {
    id: "CMD-03",
    label: "uxp plugin syntax check",
    command: process.execPath,
    args: ["-c", "ps-plugin-uxp-starter/index.js"],
  },
  {
    id: "CMD-04",
    label: "webui build check",
    command: webuiBuildInvocation.command,
    args: webuiBuildInvocation.args,
    displayCommand: webuiBuildInvocation.displayCommand,
  },
];

const staticChecks = [
  {
    id: "STA-01",
    file: "server/index.js",
    substring: "const FORCE_LEGACY_CAPTURE_RELAY",
    label: "server rollback switch exists",
  },
  {
    id: "STA-02",
    file: "server/index.js",
    substring: "forceLegacyCaptureRelay",
    label: "server /status exposes rollback switch",
  },
  {
    id: "STA-03",
    file: "server/index.js",
    substring: 'captureRelayMode: shouldUseLegacyCaptureRelay ? "legacy-comm" : "queue-result-v2"',
    label: "server capture relay mode marker exists",
  },
  {
    id: "STA-04",
    file: "electron/main.js",
    substring: "const FORCE_LEGACY_CAPTURE_RELAY",
    label: "electron rollback switch exists",
  },
  {
    id: "STA-05",
    file: "electron/main.js",
    substring: "legacy_comm_fallback_disabled",
    label: "electron v2 disables legacy fallback by default",
  },
  {
    id: "STA-06",
    file: "ps-plugin-uxp-starter/index.js",
    substring: "const BRIDGE_PROTOCOL_VERSION = 2;",
    label: "plugin reports bridge protocol version",
  },
  {
    id: "STA-07",
    file: "webui/src/App.jsx",
    substring: "chatSessionsSchemaVersion",
    label: "webui session schema storage key exists",
  },
  {
    id: "STA-08",
    file: "webui/src/App.jsx",
    substring: "CHAT_SESSIONS_SCHEMA_VERSION = 2",
    label: "webui session schema version exists",
  },
];

const commandResults = commandChecks.map((check) => ({
  ...check,
  result: runCommand(check.command, check.args),
}));

const fileCache = new Map();
const staticResults = staticChecks.map((check) => {
  const absolutePath = path.join(rootDir, check.file);
  let content = fileCache.get(absolutePath);
  if (content === undefined) {
    content = fs.readFileSync(absolutePath, "utf8");
    fileCache.set(absolutePath, content);
  }
  const line = findLineBySubstring(content, check.substring);
  return {
    ...check,
    absolutePath,
    line,
    ok: line > 0,
  };
});

const commandPassCount = commandResults.filter((entry) => entry.result.status === 0).length;
const staticPassCount = staticResults.filter((entry) => entry.ok).length;
const totalChecks = commandResults.length + staticResults.length;
const passedChecks = commandPassCount + staticPassCount;
const failedChecks = totalChecks - passedChecks;

fs.mkdirSync(plansActiveDir, { recursive: true });
const reportName = `P7-acceptance-gate-report-${toStamp()}.md`;
const reportPath = path.join(plansActiveDir, reportName);

const now = new Date();
const lines = [];
lines.push(`# P7 Acceptance Gate Report (${toIsoLocal(now)})`);
lines.push("");
lines.push("## 1. Summary");
lines.push(`- Total checks: ${totalChecks}`);
lines.push(`- Passed: ${passedChecks}`);
lines.push(`- Failed: ${failedChecks}`);
lines.push(
  failedChecks === 0
    ? "- Gate status: PASS (ready for manual matrix validation)"
    : "- Gate status: FAIL (fix failed items before manual validation)",
);
lines.push("");
lines.push("## 2. Command Checks");
for (const entry of commandResults) {
  const status = entry.result.status === 0 ? "PASS" : "FAIL";
  const displayCommand = entry.displayCommand || [entry.command, ...entry.args].join(" ");
  lines.push(`- ${entry.id} ${entry.label}: ${status} (${entry.result.durationMs}ms)`);
  lines.push(`  - Command: \`${displayCommand}\``);
  if (entry.result.status !== 0) {
    const errorText = entry.result.error || entry.result.stderr || entry.result.stdout || "unknown_error";
    lines.push(`  - Error: \`${errorText.replace(/\r?\n/g, " ").trim()}\``);
  }
}
lines.push("");
lines.push("## 3. Static Checks (source + code anchor)");
for (const entry of staticResults) {
  const status = entry.ok ? "PASS" : "FAIL";
  const relativePath = normalizePathForMarkdown(path.relative(rootDir, entry.absolutePath));
  lines.push(`- ${entry.id} ${entry.label}: ${status}`);
  lines.push(
    entry.ok
      ? `  - Code anchor: \`${relativePath}:${entry.line}\``
      : `  - Code anchor: \`${relativePath}\` (substring not found)`,
  );
  lines.push(`  - Substring: \`${entry.substring}\``);
}
lines.push("");
lines.push("## 4. References");
lines.push("- Adobe UXP executeAsModal: https://developer.adobe.com/photoshop/uxp/2022/ps_reference/media/executeasmodal/");
lines.push("- Adobe UXP batchPlay: https://developer.adobe.com/photoshop/uxp/2022/ps_reference/media/batchplay/");
lines.push("- Adobe UXP imaging: https://developer.adobe.com/photoshop/uxp/2022/ps_reference/media/imaging/");
lines.push("- UXP manifest v5: https://developer.adobe.com/photoshop/uxp/2022/guides/uxp_guide/uxp-misc/manifest-v5/");
lines.push("- SDPPP local reference: `_repo_inspect/sd-ppp-monorepo/packages/ps-common/sdk/sdppp-ps-sdk.d.ts`");
lines.push("- SDPPP local reference: `_repo_inspect/sd-ppp-monorepo/packages/sdppp-photoshop/src/providers/base/widgetable-photoshop/work-boundary.ts`");
lines.push("");
lines.push("## 5. Manual Matrix (manual execution required)");
lines.push("- [ ] Mode matrix: RGB8 / RGB16 / Grayscale8 / CMYK8 / Lab8");
lines.push("- [ ] Scene matrix: no selection / has selection / smart object / mask / multi-document");
lines.push("- [ ] Action coverage: upload selection / upload full image / import back to PS");
lines.push("- [ ] Color threshold: `abs(meanYDiff)<=4`, `abs(medianYDiff)<=5`, `p95<=12`");
lines.push("- [ ] UX threshold: 20 mixed captures in series, no manual document switching on import");
lines.push("");
lines.push("## 6. Failed Items");
if (failedChecks === 0) {
  lines.push("- None");
} else {
  for (const entry of commandResults.filter((item) => item.result.status !== 0)) {
    lines.push(`- ${entry.id} command failed: ${entry.label}`);
  }
  for (const entry of staticResults.filter((item) => !item.ok)) {
    lines.push(`- ${entry.id} static check failed: ${entry.label}`);
  }
}

fs.writeFileSync(reportPath, `${lines.join("\n")}\n`, "utf8");

console.log(`[p7-gate] report: ${normalizePathForMarkdown(path.relative(rootDir, reportPath))}`);
console.log(`[p7-gate] summary: total=${totalChecks}, pass=${passedChecks}, fail=${failedChecks}`);

if (failedChecks > 0) {
  process.exitCode = 1;
}
