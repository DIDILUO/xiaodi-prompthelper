"use strict";

const { app, core, action, imaging, constants } = require("photoshop");
const { storage } = require("uxp");
const BUILD_META = require("./build-meta");

const fs = storage.localFileSystem;

const STORAGE_KEY = "xiaodi.psBridge.config.v1";
const DEFAULT_BRIDGE_PORT = 17325;
const DEFAULT_BRIDGE_HOST = "localhost";
const HEARTBEAT_INTERVAL_MS = 1600;
const QUEUE_LONG_POLL_TIMEOUT_MS = 25000;
const QUEUE_RETRY_DELAY_MS = 1200;
const REQUEST_TIMEOUT_MS = 15000;
const CAPTURE_DEFAULT_MAX_SIDE = 0;
const CAPTURE_DEFAULT_OUTPUT_FORMAT = "jpg";
const CAPTURE_DEFAULT_OUTPUT_QUALITY = 1;
const PLUGIN_VERSION = String(BUILD_META.pluginVersion || "0.1.1");
const PLUGIN_BUILD_TAG = String(
  BUILD_META.pluginBuildTag || "capture-v3-20260215-sdppp-chain",
);
const PLUGIN_REVISION = String(BUILD_META.revision || "");
const CAPTURE_OUTPUT_COMPONENT_SIZE = 8;
const CAPTURE_PREFERRED_RGB_PROFILE = "sRGB IEC61966-2.1";
const CAPTURE_SCHEMA_VERSION = 2;
const CAPTURE_TEMP_FILE_PREFIX = "xiaodi-capture-lossless";
const CAPTURE_TEMP_FILE_KIND = "plugin-lossless-intermediate";
const CAPTURE_TEMP_FILE_CLEANUP_POLICY = "software-exit";
const BRIDGE_PROTOCOL_VERSION = 2;
const UI_LOG_LIMIT = 240;
const UI_LOG_TEXT_LIMIT = 1600;

const state = {
  bridgePort: DEFAULT_BRIDGE_PORT,
  started: false,
  heartbeatTimer: null,
  queueLoopTask: null,
  queueLoopToken: 0,
  heartbeatBusy: false,
  queueBusy: false,
  bridgeConnected: false,
  lastBridgeError: "",
  lastBridgeErrorKey: "",
  lastSyncedErrorKey: "",
  lastSyncedErrorAt: 0,
  statusText: "待连接",
  uiLogs: []
};

const ui = {
  portInput: null,
  applyPortBtn: null,
  heartbeatBtn: null,
  captureSelectionBtn: null,
  captureCanvasBtn: null,
  importDataInput: null,
  importToPsBtn: null,
  statusChip: null,
  copyLogsBtn: null,
  exportLogsBtn: null,
  logSinkHint: null,
  pluginLogPanel: null,
  pluginBuildMeta: null
};

let cachedCaptureRgbProfile = undefined;

async function reportPluginLog(level, message, detail, options = {}) {
  const payload = {
    level: String(level || "info").toLowerCase(),
    message: String(message || "").trim(),
    detail: String(detail || "").trim(),
    scene: String(options.scene || "runtime"),
    source: "ps-plugin-uxp",
    at: Date.now()
  };
  try {
    await requestJson("/ps/log", {
      method: "POST",
      timeoutMs: 1200,
      body: payload
    });
  } catch (_) {
    // ignore sync failure; bridge may be offline
  }
}

function appendLog(level, message, detail, options = {}) {
  const normalizedLevel = String(level || "info").toLowerCase();
  const normalizedMessage = String(message || "").trim();
  const normalizedDetail = String(detail || "").trim();
  const normalizedScene = String(options.scene || "runtime").trim();
  if (normalizedMessage || normalizedDetail) {
    pushUiLog({
      level: normalizedLevel,
      message: normalizedMessage,
      detail: normalizedDetail,
      scene: normalizedScene
    });
  }
  if (normalizedLevel !== "error") return;
  if (options.syncToBridge === false) return;
  if (!normalizedMessage && !normalizedDetail) return;
  const dedupeKey = `${normalizedLevel}|${normalizedMessage}|${normalizedDetail}`;
  const now = Date.now();
  if (dedupeKey === state.lastSyncedErrorKey && (now - state.lastSyncedErrorAt) < 2000) return;
  state.lastSyncedErrorKey = dedupeKey;
  state.lastSyncedErrorAt = now;
  void reportPluginLog(normalizedLevel, normalizedMessage, normalizedDetail, {
    scene: options.scene || "runtime"
  });
}

function setStatusChip(mode, text) {
  state.statusText = text;
  if (!ui.statusChip) return;
  ui.statusChip.classList.remove("is-ok", "is-warn", "is-error");
  ui.statusChip.classList.add(
    mode === "ok" ? "is-ok" : mode === "error" ? "is-error" : "is-warn"
  );
  ui.statusChip.textContent = text;
}

function formatUiLogTime(input = Date.now()) {
  const date = input instanceof Date ? input : new Date(input);
  const hh = String(Math.max(0, Number(date.getHours()) || 0)).padStart(2, "0");
  const mm = String(Math.max(0, Number(date.getMinutes()) || 0)).padStart(2, "0");
  const ss = String(Math.max(0, Number(date.getSeconds()) || 0)).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function sanitizeUiLogText(value, maxLength = UI_LOG_TEXT_LIMIT) {
  const text = String(value || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!text) return "";
  const cap = Math.max(120, Number(maxLength) || UI_LOG_TEXT_LIMIT);
  if (text.length <= cap) return text;
  return `${text.slice(0, cap)}...(truncated ${text.length - cap} chars)`;
}

function renderUiLogs() {
  if (!ui.pluginLogPanel) return;
  if (!Array.isArray(state.uiLogs) || state.uiLogs.length <= 0) {
    ui.pluginLogPanel.textContent = "";
    return;
  }
  const content = state.uiLogs
    .map((entry) => {
      const ts = entry?.ts || "--:--:--";
      const level = String(entry?.level || "info").toUpperCase();
      const scene = entry?.scene ? `[${entry.scene}]` : "";
      const text = [entry?.message || "", entry?.detail || ""].filter(Boolean).join(" | ");
      return `[${ts}] [${level}]${scene ? ` ${scene}` : ""} ${text}`;
    })
    .join("\n");
  ui.pluginLogPanel.textContent = content;
  ui.pluginLogPanel.scrollTop = ui.pluginLogPanel.scrollHeight;
}

function renderBuildIdentity() {
  if (!ui.pluginBuildMeta) return;
  const identityParts = [`v${PLUGIN_VERSION}`];
  if (PLUGIN_REVISION) {
    identityParts.push(PLUGIN_REVISION);
  }
  ui.pluginBuildMeta.textContent = identityParts.join(" · ");
}

function pushUiLog(entry = {}) {
  const next = {
    ts: formatUiLogTime(Date.now()),
    level: String(entry?.level || "info").trim().toLowerCase() || "info",
    scene: sanitizeUiLogText(entry?.scene || "", 96),
    message: sanitizeUiLogText(entry?.message || "", UI_LOG_TEXT_LIMIT),
    detail: sanitizeUiLogText(entry?.detail || "", UI_LOG_TEXT_LIMIT)
  };
  if (!next.message && !next.detail) return;
  if (!Array.isArray(state.uiLogs)) state.uiLogs = [];
  state.uiLogs.push(next);
  if (state.uiLogs.length > UI_LOG_LIMIT) {
    state.uiLogs.splice(0, state.uiLogs.length - UI_LOG_LIMIT);
  }
  renderUiLogs();
}

function getPluginLogText() {
  if (!Array.isArray(state.uiLogs) || state.uiLogs.length <= 0) {
    return "";
  }
  return state.uiLogs
    .map((entry) => {
      const ts = entry?.ts || "--:--:--";
      const level = String(entry?.level || "info").toUpperCase();
      const scene = entry?.scene ? `[${entry.scene}]` : "";
      const text = [entry?.message || "", entry?.detail || ""]
        .filter(Boolean)
        .join(" | ");
      return `[${ts}] [${level}]${scene ? ` ${scene}` : ""} ${text}`;
    })
    .join("\n");
}

async function copyUiLogs() {
  const text = getPluginLogText();
  if (!text) {
    appendLog("warn", "暂无插件日志可复制");
    return;
  }
  const clipboard = navigator?.clipboard;
  if (!clipboard) {
    throw new Error("clipboard_write_unavailable");
  }
  if (typeof clipboard.setContent === "function") {
    await clipboard.setContent({ "text/plain": text });
  } else if (typeof clipboard.writeText === "function") {
    await clipboard.writeText(text);
  } else {
    throw new Error("clipboard_write_unavailable");
  }
  appendLog("success", "插件日志已复制");
}

async function exportUiLogs() {
  const text = getPluginLogText();
  if (!text) {
    appendLog("warn", "暂无插件日志可导出");
    return;
  }
  if (typeof fs.getFileForSaving !== "function") {
    throw new Error("log_export_picker_unavailable");
  }
  const targetFile = await fs.getFileForSaving("xiaodi-plugin-logs.txt", {
    types: ["txt"],
  });
  if (!targetFile) {
    appendLog("info", "已取消导出插件日志");
    return;
  }
  await targetFile.write(text, { format: storage.formats.utf8 });
  appendLog("success", `插件日志已导出：${String(targetFile.nativePath || targetFile.name || "xiaodi-plugin-logs.txt")}`);
}

function updateLogSinkHint() {
  if (!ui.logSinkHint) return;
  ui.logSinkHint.textContent = `插件日志上报：${getBridgeBase()}/ps/log（软件端读取：${getBridgeBase()}/ps/logs?since=<id>）`;
}

function parsePort(value, fallback = DEFAULT_BRIDGE_PORT) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  if (!Number.isInteger(n)) return fallback;
  if (n < 1 || n > 65535) return fallback;
  return n;
}

function loadConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    state.bridgePort = parsePort(parsed?.bridgePort, DEFAULT_BRIDGE_PORT);
  } catch (_) {}
}

function saveConfig() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ bridgePort: state.bridgePort, updatedAt: Date.now() })
    );
  } catch (_) {}
}

function getBridgeBase() {
  return `http://${DEFAULT_BRIDGE_HOST}:${state.bridgePort}`;
}

function bridgeUrl(path) {
  const safePath = String(path || "").startsWith("/") ? String(path || "") : `/${String(path || "")}`;
  return `${getBridgeBase()}${safePath}`;
}

function normalizeProfileName(value) {
  return String(value || "").trim().toLowerCase();
}

async function resolveCaptureRgbProfile() {
  if (cachedCaptureRgbProfile !== undefined) return cachedCaptureRgbProfile;
  cachedCaptureRgbProfile = null;
  try {
    const profiles = await app.getColorProfiles("RGB");
    if (!Array.isArray(profiles) || profiles.length <= 0) {
      return cachedCaptureRgbProfile;
    }
    const preferredNormalized = normalizeProfileName(CAPTURE_PREFERRED_RGB_PROFILE);
    const exact = profiles.find((profileName) => normalizeProfileName(profileName) === preferredNormalized);
    if (exact) {
      cachedCaptureRgbProfile = String(exact);
      return cachedCaptureRgbProfile;
    }
    const srgbLike = profiles.find((profileName) => /srgb/i.test(String(profileName || "")));
    if (srgbLike) {
      cachedCaptureRgbProfile = String(srgbLike);
      return cachedCaptureRgbProfile;
    }
  } catch (_) {}
  return cachedCaptureRgbProfile;
}

async function getPixelsForCapture(requestBase) {
  const profile = await resolveCaptureRgbProfile();
  const preferredProfile = profile || CAPTURE_PREFERRED_RGB_PROFILE;
  try {
    const pixels = await imaging.getPixels({
      ...requestBase,
      colorProfile: preferredProfile
    });
    return {
      pixels,
      colorProfile: preferredProfile,
      usedPreferredProfile: true,
      preferredProfileError: "",
      fallbackRequestError: "",
      usedMinimalRequest: false
    };
  } catch (preferredProfileError) {
    const preferredProfileErrorText = String(preferredProfileError?.message || preferredProfileError || "");
    try {
      const pixels = await imaging.getPixels(requestBase);
      return {
        pixels,
        colorProfile: "",
        usedPreferredProfile: false,
        preferredProfileError: preferredProfileErrorText,
        fallbackRequestError: "",
        usedMinimalRequest: false
      };
    } catch (fallbackRequestError) {
      const fallbackRequestErrorText = String(fallbackRequestError?.message || fallbackRequestError || "");
      try {
        const minimalRequest = {
          documentID: Number(requestBase?.documentID),
          sourceBounds: requestBase?.sourceBounds,
          targetSize: requestBase?.targetSize,
          colorSpace: String(requestBase?.colorSpace || "RGB"),
          hasAlpha:
            typeof requestBase?.hasAlpha === "boolean"
              ? requestBase.hasAlpha
              : undefined,
          applyAlpha:
            typeof requestBase?.applyAlpha === "boolean"
              ? requestBase.applyAlpha
              : undefined
        };
        const pixels = await imaging.getPixels(minimalRequest);
        return {
          pixels,
          colorProfile: "",
          usedPreferredProfile: false,
          preferredProfileError: preferredProfileErrorText,
          fallbackRequestError: fallbackRequestErrorText,
          usedMinimalRequest: true
        };
      } catch (minimalRequestError) {
        const minimalRequestErrorText = String(minimalRequestError?.message || minimalRequestError || "");
        throw new Error(
          `getPixels_failed:preferred=${preferredProfileErrorText};fallback=${fallbackRequestErrorText};minimal=${minimalRequestErrorText}`
        );
      }
    }
  }
}

async function fetchWithTimeout(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  let timedOut = false;
  let timer = null;
  try {
    const controller = new AbortController();
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (timedOut) {
      throw new Error(`请求超时（${timeoutMs}ms）`);
    }
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function requestJson(path, options = {}) {
  const method = options.method || "GET";
  const headers = Object.assign({ "Content-Type": "application/json" }, options.headers || {});
  const body = options.body !== undefined ? JSON.stringify(options.body) : undefined;
  const response = await fetchWithTimeout(
    bridgeUrl(path),
    { method, headers, body },
    options.timeoutMs || REQUEST_TIMEOUT_MS
  );
  const raw = await response.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch (_) {
    data = null;
  }
  if (!response.ok) {
    const message = data?.message || data?.error || raw || `HTTP ${response.status}`;
    throw new Error(String(message));
  }
  return data;
}

function toPx(value) {
  const n = Number(value?._value ?? value?.value ?? value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeSelectionBounds(bounds) {
  const left = Math.round(toPx(bounds?.left));
  const top = Math.round(toPx(bounds?.top));
  const right = Math.round(toPx(bounds?.right));
  const bottom = Math.round(toPx(bounds?.bottom));
  const rawWidth = right - left;
  const rawHeight = bottom - top;
  return {
    left,
    top,
    right,
    bottom,
    width: Math.max(1, rawWidth),
    height: Math.max(1, rawHeight),
    isEmpty: rawWidth <= 0 || rawHeight <= 0
  };
}

function normalizeTargetRect(input) {
  if (!input || typeof input !== "object") return null;
  const left = Number(input.left);
  const top = Number(input.top);
  const width = Number(input.width);
  const height = Number(input.height);
  if (!Number.isFinite(left) || !Number.isFinite(top) || !Number.isFinite(width) || !Number.isFinite(height)) {
    return null;
  }
  const safeWidth = Math.max(1, Math.round(width));
  const safeHeight = Math.max(1, Math.round(height));
  const safeLeft = Math.round(left);
  const safeTop = Math.round(top);
  return {
    left: safeLeft,
    top: safeTop,
    width: safeWidth,
    height: safeHeight,
    right: safeLeft + safeWidth,
    bottom: safeTop + safeHeight
  };
}

function normalizeTargetCanvas(input) {
  if (!input || typeof input !== "object") return null;
  const width = Number(input.width);
  const height = Number(input.height);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  return {
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height))
  };
}

function normalizeTargetRectNorm(input) {
  if (!input || typeof input !== "object") return null;
  const leftRaw = Number(input.left);
  const topRaw = Number(input.top);
  const widthRaw = Number(input.width);
  const heightRaw = Number(input.height);
  let left = Number.isFinite(leftRaw) ? leftRaw : null;
  let top = Number.isFinite(topRaw) ? topRaw : null;
  let width = Number.isFinite(widthRaw) ? widthRaw : null;
  let height = Number.isFinite(heightRaw) ? heightRaw : null;
  const rightRaw = Number(input.right);
  const bottomRaw = Number(input.bottom);
  if ((width === null || height === null) && Number.isFinite(rightRaw) && Number.isFinite(bottomRaw) && left !== null && top !== null) {
    width = rightRaw - left;
    height = bottomRaw - top;
  }
  if (left === null || top === null || width === null || height === null) return null;
  if (width <= 0 || height <= 0) return null;
  const safeLeft = Math.min(1, Math.max(0, left));
  const safeTop = Math.min(1, Math.max(0, top));
  const safeWidth = Math.min(1, Math.max(0, width));
  const safeHeight = Math.min(1, Math.max(0, height));
  return {
    left: safeLeft,
    top: safeTop,
    width: safeWidth,
    height: safeHeight,
    right: Math.min(1, safeLeft + safeWidth),
    bottom: Math.min(1, safeTop + safeHeight)
  };
}

function deriveTargetRectNorm(rect, canvas) {
  if (!rect || !canvas) return null;
  const width = Number(canvas.width);
  const height = Number(canvas.height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return normalizeTargetRectNorm({
    left: rect.left / width,
    top: rect.top / height,
    width: rect.width / width,
    height: rect.height / height
  });
}

function getDocumentCanvasSize(doc) {
  if (!doc) return null;
  const width = Math.max(1, Math.round(toPx(doc.width)));
  const height = Math.max(1, Math.round(toPx(doc.height)));
  return { width, height };
}

function clampTargetRectToCanvas(rect, canvas) {
  if (!rect || !canvas) return rect || null;
  const maxW = Math.max(1, Math.round(canvas.width));
  const maxH = Math.max(1, Math.round(canvas.height));
  const left = Math.max(0, Math.min(maxW - 1, Math.round(rect.left)));
  const top = Math.max(0, Math.min(maxH - 1, Math.round(rect.top)));
  const width = Math.max(1, Math.min(maxW - left, Math.round(rect.width)));
  const height = Math.max(1, Math.min(maxH - top, Math.round(rect.height)));
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height
  };
}

function resolveTargetRectForDocument(targetRect, targetRectNorm, targetCanvas, documentCanvas) {
  const explicitRect = normalizeTargetRect(targetRect);
  const normalizedRect = normalizeTargetRectNorm(targetRectNorm)
    || deriveTargetRectNorm(explicitRect, normalizeTargetCanvas(targetCanvas));
  if (normalizedRect && documentCanvas) {
    const next = normalizeTargetRect({
      left: normalizedRect.left * documentCanvas.width,
      top: normalizedRect.top * documentCanvas.height,
      width: normalizedRect.width * documentCanvas.width,
      height: normalizedRect.height * documentCanvas.height
    });
    if (next) return clampTargetRectToCanvas(next, documentCanvas);
  }
  if (explicitRect) return clampTargetRectToCanvas(explicitRect, documentCanvas);
  return null;
}

function findDocumentById(inputId) {
  const targetId = Math.round(Number(inputId));
  if (!Number.isFinite(targetId) || targetId <= 0) return null;
  const docs = app?.documents ? Array.from(app.documents) : [];
  for (const doc of docs) {
    if (Number(doc?.id) === targetId) return doc;
  }
  return null;
}

function listOpenDocumentsMeta() {
  const activeId = Number(app?.activeDocument?.id) || 0;
  const docs = app?.documents ? Array.from(app.documents) : [];
  return docs
    .map((doc, index) => {
      const id = Number(doc?.id) || 0;
      if (!id) return null;
      return {
        id,
        name: String(doc?.title || "").trim() || `Document ${index + 1}`,
        isActive: id === activeId
      };
    })
    .filter(Boolean);
}

async function selectDocumentById(documentId, errorContext = "") {
  const safeId = Math.round(Number(documentId));
  if (!Number.isFinite(safeId) || safeId <= 0) return;
  if (Number(app.activeDocument?.id) === safeId) return;
  try {
    await action.batchPlay([
      {
        _obj: "select",
        _target: [{ _ref: "document", _id: safeId }]
      }
    ], {});
  } catch (err) {
    const message = String(err?.message || err || "unknown");
    if (errorContext) {
      throw new Error(`${errorContext}/select-document:${message}`);
    }
    throw err;
  }
}

async function getDocumentSelectionRect(doc, errorContext = "") {
  if (!doc) return null;
  await selectDocumentById(doc.id, errorContext);
  let selectionGetResult = null;
  try {
    selectionGetResult = await action.batchPlay(
      [
        {
          _obj: "get",
          _target: [
            { _property: "selection" },
            { _ref: "document", _id: Number(doc.id) || 0 }
          ],
          _options: { dialogOptions: "dontDisplay" }
        }
      ],
      {},
    );
  } catch (err) {
    const message = String(err?.message || err || "unknown");
    if (errorContext) {
      throw new Error(`${errorContext}/get-selection:${message}`);
    }
    throw err;
  }
  const selectionPayload = selectionGetResult?.[0]?.selection;
  if (
    !selectionPayload ||
    (typeof selectionPayload === "object" && String(selectionPayload?._enum || "").toLowerCase() === "ordinal")
  ) {
    return null;
  }
  const bounds = normalizeSelectionBounds(selectionPayload);
  if (!bounds || bounds.isEmpty) return null;
  return normalizeTargetRect(bounds);
}

async function clearDocumentSelection(doc) {
  if (!doc) return;
  await selectDocumentById(doc.id);
  try {
    await action.batchPlay([
      {
        _obj: "set",
        _target: [{ _ref: "channel", _property: "selection" }],
        to: { _enum: "ordinal", _value: "none" }
      }
    ], {});
  } catch (_) {}
}

async function restoreDocumentSelection(doc, rect) {
  if (!doc) return;
  const safeRect = normalizeTargetRect(rect);
  if (!safeRect) return;
  await selectDocumentById(doc.id);
  await action.batchPlay([
    {
      _obj: "set",
      _target: [{ _ref: "channel", _property: "selection" }],
      to: {
        _obj: "rectangle",
        top: { _unit: "pixelsUnit", _value: safeRect.top },
        left: { _unit: "pixelsUnit", _value: safeRect.left },
        bottom: { _unit: "pixelsUnit", _value: safeRect.bottom },
        right: { _unit: "pixelsUnit", _value: safeRect.right }
      }
    }
  ], {});
}

async function createRevealSelectionMaskOnActiveLayer() {
  await action.batchPlay([
    {
      _obj: "make",
      new: { _class: "channel" },
      at: { _ref: "channel", _enum: "channel", _value: "mask" },
      using: { _enum: "userMaskEnabled", _value: "revealSelection" }
    }
  ], {});
}

async function createRevealSelectionMaskForLayerId(doc, layerId, rect) {
  const safeRect = normalizeTargetRect(rect);
  if (!doc || !safeRect) return false;
  await restoreDocumentSelection(doc, safeRect);
  await ensureSingleLayerSelectedById(layerId);
  await createRevealSelectionMaskOnActiveLayer();
  return true;
}

function base64ToArrayBuffer(base64) {
  const raw = atob(String(base64 || "").replace(/\s+/g, ""));
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    bytes[i] = raw.charCodeAt(i);
  }
  return bytes.buffer;
}

function parseDataUrl(input) {
  const raw = String(input || "").trim();
  if (!raw) return null;
  const matched = raw.match(/^data:([^;,]+);base64,([\s\S]+)$/i);
  if (matched) {
    return {
      mimeType: String(matched[1] || "image/png").toLowerCase(),
      base64: String(matched[2] || "").replace(/\s+/g, "")
    };
  }
  if (/^[A-Za-z0-9+/=\s]+$/.test(raw)) {
    return {
      mimeType: "image/png",
      base64: raw.replace(/\s+/g, "")
    };
  }
  return null;
}

function getScaledSizeWithinLimit(width, height, maxEdge = CAPTURE_DEFAULT_MAX_SIDE) {
  const w = Math.max(1, Math.round(Number(width) || 1));
  const h = Math.max(1, Math.round(Number(height) || 1));
  const parsedMaxEdge = Number(maxEdge);
  if (!Number.isFinite(parsedMaxEdge) || parsedMaxEdge <= 0) {
    return { width: w, height: h };
  }
  const safeMaxEdge = Math.max(1, Math.round(parsedMaxEdge));
  if (w <= safeMaxEdge && h <= safeMaxEdge) return { width: w, height: h };
  if (w >= h) {
    return {
      width: safeMaxEdge,
      height: Math.max(1, Math.round(h * (safeMaxEdge / w)))
    };
  }
  return {
    width: Math.max(1, Math.round(w * (safeMaxEdge / h))),
    height: safeMaxEdge
  };
}

function toUint8Array(input) {
  if (!input) return null;
  if (input instanceof Uint8Array) return input;
  if (ArrayBuffer.isView(input)) {
    const view = input;
    return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  }
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  return null;
}

function extractBinaryFromEncodeResult(resultValue) {
  if (!resultValue) return null;
  const direct = toUint8Array(resultValue);
  if (direct && direct.byteLength) return direct;

  const binaryCandidates = [
    resultValue?.binary,
    resultValue?.bytes,
    resultValue?.data,
    resultValue?.buffer,
    resultValue?.arrayBuffer,
    resultValue?.encodedData
  ];
  for (const candidate of binaryCandidates) {
    const asBytes = toUint8Array(candidate);
    if (asBytes && asBytes.byteLength) return asBytes;
  }

  const dataUrlCandidates = [
    resultValue?.dataUrl,
    resultValue?.base64,
    resultValue?.encodedBase64,
    resultValue?.blob
  ];
  for (const candidate of dataUrlCandidates) {
    const parsed = parseDataUrl(candidate);
    if (!parsed?.base64) continue;
    try {
      const bytes = toUint8Array(base64ToArrayBuffer(parsed.base64));
      if (bytes && bytes.byteLength) return bytes;
    } catch (_) {}
  }
  return null;
}

function concatUint8Arrays(parts) {
  let total = 0;
  for (const part of parts) {
    total += Number(part?.byteLength || part?.length || 0);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    const view = toUint8Array(part);
    if (!view || !view.byteLength) continue;
    merged.set(view, offset);
    offset += view.byteLength;
  }
  return merged;
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let j = 0; j < 8; j += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  const data = toUint8Array(bytes) || new Uint8Array(0);
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    c = CRC32_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function adler32(bytes) {
  const data = toUint8Array(bytes) || new Uint8Array(0);
  let a = 1;
  let b = 0;
  for (let i = 0; i < data.length; i += 1) {
    a = (a + data[i]) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function uint32be(num) {
  return new Uint8Array([
    (num >>> 24) & 0xff,
    (num >>> 16) & 0xff,
    (num >>> 8) & 0xff,
    num & 0xff
  ]);
}

function asciiBytes(text) {
  const source = String(text || "");
  const bytes = new Uint8Array(source.length);
  for (let i = 0; i < source.length; i += 1) {
    bytes[i] = source.charCodeAt(i) & 0xff;
  }
  return bytes;
}

function buildPngChunk(type, data) {
  const typeBytes = asciiBytes(type);
  const dataBytes = toUint8Array(data) || new Uint8Array(0);
  const lengthBytes = uint32be(dataBytes.byteLength);
  const crcBytes = uint32be(crc32(concatUint8Arrays([typeBytes, dataBytes])));
  return concatUint8Arrays([lengthBytes, typeBytes, dataBytes, crcBytes]);
}

function buildZlibStoredDeflate(raw) {
  const payload = toUint8Array(raw);
  if (!payload) return null;
  const parts = [new Uint8Array([0x78, 0x01])];
  let offset = 0;
  while (offset < payload.byteLength) {
    const blockSize = Math.min(65535, payload.byteLength - offset);
    const finalFlag = (offset + blockSize) >= payload.byteLength ? 1 : 0;
    const nlen = (~blockSize) & 0xffff;
    parts.push(new Uint8Array([
      finalFlag,
      blockSize & 0xff,
      (blockSize >>> 8) & 0xff,
      nlen & 0xff,
      (nlen >>> 8) & 0xff
    ]));
    parts.push(payload.subarray(offset, offset + blockSize));
    offset += blockSize;
  }
  parts.push(uint32be(adler32(payload)));
  return concatUint8Arrays(parts);
}

function sampleInterleavedChannelMean(bytes, channelOffset, channelStride = 4, maxSamples = 4096) {
  const source = toUint8Array(bytes);
  if (!source || !source.byteLength) return 0;
  const stride = Math.max(1, Math.round(Number(channelStride) || 4));
  const offset = Math.max(0, Math.min(stride - 1, Math.round(Number(channelOffset) || 0)));
  const sourceLen = source.byteLength;
  if (offset >= sourceLen) return 0;
  const availableSamples = Math.max(1, Math.floor((sourceLen - offset) / stride));
  const targetSamples = Math.max(1, Math.min(availableSamples, Math.round(Number(maxSamples) || 4096)));
  const sampleStep = Math.max(1, Math.floor(availableSamples / targetSamples));
  let sum = 0;
  let count = 0;
  for (let sampleIndex = 0; sampleIndex < availableSamples; sampleIndex += sampleStep) {
    const byteIndex = offset + sampleIndex * stride;
    if (byteIndex >= sourceLen) break;
    sum += source[byteIndex];
    count += 1;
    if (count >= targetSamples) break;
  }
  return count > 0 ? sum / count : 0;
}

function samplePlaneMean(bytes, startOffset, sampleLen, maxSamples = 4096) {
  const source = toUint8Array(bytes);
  if (!source || !source.byteLength) return 0;
  const start = Math.max(0, Math.min(source.byteLength, Math.round(Number(startOffset) || 0)));
  const length = Math.max(0, Math.min(source.byteLength - start, Math.round(Number(sampleLen) || 0)));
  if (length <= 0) return 0;
  const targetSamples = Math.max(1, Math.min(length, Math.round(Number(maxSamples) || 4096)));
  const sampleStep = Math.max(1, Math.floor(length / targetSamples));
  let sum = 0;
  let count = 0;
  for (let byteIndex = start; byteIndex < start + length; byteIndex += sampleStep) {
    sum += source[byteIndex];
    count += 1;
    if (count >= targetSamples) break;
  }
  return count > 0 ? sum / count : 0;
}

function clampToByte(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return 0;
  if (num >= 255) return 255;
  return Math.round(num);
}

function sampleRgbaLumaStats(bytes, maxSamples = 4096) {
  const source = toUint8Array(bytes);
  if (!source || source.byteLength < 4) {
    return { mean: 0, std: 0, blackRatio: 1, whiteRatio: 0 };
  }
  const pixelCount = Math.max(1, Math.floor(source.byteLength / 4));
  const targetSamples = Math.max(1, Math.min(pixelCount, Math.round(Number(maxSamples) || 4096)));
  const step = Math.max(1, Math.floor(pixelCount / targetSamples));
  let sum = 0;
  let sumSq = 0;
  let blackCount = 0;
  let whiteCount = 0;
  let count = 0;
  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += step) {
    const byteIndex = pixelIndex * 4;
    const r = source[byteIndex];
    const g = source[byteIndex + 1];
    const b = source[byteIndex + 2];
    const luma = r * 0.2126 + g * 0.7152 + b * 0.0722;
    sum += luma;
    sumSq += luma * luma;
    if (luma <= 3) blackCount += 1;
    if (luma >= 252) whiteCount += 1;
    count += 1;
    if (count >= targetSamples) break;
  }
  if (count <= 0) {
    return { mean: 0, std: 0, blackRatio: 1, whiteRatio: 0 };
  }
  const mean = sum / count;
  const variance = Math.max(0, sumSq / count - mean * mean);
  return {
    mean,
    std: Math.sqrt(variance),
    blackRatio: blackCount / count,
    whiteRatio: whiteCount / count
  };
}

function normalizeCaptureOutputFormat(rawFormat, fallback = CAPTURE_DEFAULT_OUTPUT_FORMAT) {
  const normalizedFallback = String(fallback || CAPTURE_DEFAULT_OUTPUT_FORMAT).trim().toLowerCase() === "png"
    ? "png"
    : "jpg";
  const normalizedRaw = String(rawFormat || "").trim().toLowerCase();
  if (normalizedRaw === "png") return "png";
  if (normalizedRaw === "jpg" || normalizedRaw === "jpeg") return "jpg";
  return normalizedFallback;
}

function normalizeCaptureOutputQuality(rawQuality, fallback = CAPTURE_DEFAULT_OUTPUT_QUALITY) {
  const fallbackQuality = Number.isFinite(Number(fallback))
    ? Math.max(0.01, Math.min(1, Number(fallback)))
    : CAPTURE_DEFAULT_OUTPUT_QUALITY;
  const parsed = Number(rawQuality);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallbackQuality;
  return Math.max(0.01, Math.min(1, parsed));
}

function normalizeCaptureMaxSide(rawMaxSide, fallback = CAPTURE_DEFAULT_MAX_SIDE) {
  const parsed = Number(rawMaxSide);
  if (Number.isFinite(parsed) && parsed > 0) return Math.max(1, Math.round(parsed));
  const fallbackSide = Number(fallback);
  if (Number.isFinite(fallbackSide) && fallbackSide > 0) {
    return Math.max(1, Math.round(fallbackSide));
  }
  return CAPTURE_DEFAULT_MAX_SIDE;
}

function normalizeCaptureEncodeOptions(rawOptions = {}) {
  const source = rawOptions && typeof rawOptions === "object" ? rawOptions : {};
  const outputFormat = normalizeCaptureOutputFormat(source.format, CAPTURE_DEFAULT_OUTPUT_FORMAT);
  return {
    format: outputFormat,
    quality: normalizeCaptureOutputQuality(source.quality, CAPTURE_DEFAULT_OUTPUT_QUALITY),
    maxSide: normalizeCaptureMaxSide(source.maxSide, CAPTURE_DEFAULT_MAX_SIDE)
  };
}

function scoreRgbaLumaStats(stats) {
  if (!stats) return -Infinity;
  let score = Number(stats.std) || 0;
  score -= (Number(stats.blackRatio) || 0) * 28;
  score -= (Number(stats.whiteRatio) || 0) * 32;
  const mean = Number(stats.mean) || 0;
  if (mean < 32) score -= (32 - mean) * 1.4;
  if (mean > 236) score -= (mean - 236) * 1.2;
  return score;
}

function convertChunkyArgbToRgba(bytes, expectedLen) {
  const source = toUint8Array(bytes);
  const target = new Uint8Array(expectedLen);
  for (let srcOffset = 0; srcOffset < expectedLen; srcOffset += 4) {
    target[srcOffset] = source[srcOffset + 1];
    target[srcOffset + 1] = source[srcOffset + 2];
    target[srcOffset + 2] = source[srcOffset + 3];
    target[srcOffset + 3] = source[srcOffset];
  }
  return target;
}

function convertChunkyRgbToRgba(bytes, pixelCount) {
  const source = toUint8Array(bytes);
  const expectedRgbLen = pixelCount * 3;
  if (!source || source.byteLength < expectedRgbLen) {
    throw new Error(`rgb_payload_short:${source ? source.byteLength : 0}/${expectedRgbLen}`);
  }
  const target = new Uint8Array(pixelCount * 4);
  for (let pixelIndex = 0, srcOffset = 0, dstOffset = 0; pixelIndex < pixelCount; pixelIndex += 1, srcOffset += 3, dstOffset += 4) {
    target[dstOffset] = source[srcOffset];
    target[dstOffset + 1] = source[srcOffset + 1];
    target[dstOffset + 2] = source[srcOffset + 2];
    target[dstOffset + 3] = 255;
  }
  return target;
}

function convertGrayscaleToRgba(bytes, pixelCount) {
  const source = toUint8Array(bytes);
  const expectedLen = pixelCount;
  if (!source || source.byteLength < expectedLen) {
    throw new Error(`gray_payload_short:${source ? source.byteLength : 0}/${expectedLen}`);
  }
  const target = new Uint8Array(pixelCount * 4);
  for (let pixelIndex = 0, dstOffset = 0; pixelIndex < pixelCount; pixelIndex += 1, dstOffset += 4) {
    const v = source[pixelIndex];
    target[dstOffset] = v;
    target[dstOffset + 1] = v;
    target[dstOffset + 2] = v;
    target[dstOffset + 3] = 255;
  }
  return target;
}

function convertPlanarToRgba(bytes, pixelCount, alphaPlaneFirst = false) {
  const source = toUint8Array(bytes);
  const expectedLen = pixelCount * 4;
  const target = new Uint8Array(expectedLen);
  const plane0Offset = 0;
  const plane1Offset = pixelCount;
  const plane2Offset = pixelCount * 2;
  const plane3Offset = pixelCount * 3;
  const redPlaneOffset = alphaPlaneFirst ? plane1Offset : plane0Offset;
  const greenPlaneOffset = alphaPlaneFirst ? plane2Offset : plane1Offset;
  const bluePlaneOffset = alphaPlaneFirst ? plane3Offset : plane2Offset;
  const alphaPlaneOffset = alphaPlaneFirst ? plane0Offset : plane3Offset;
  for (let pixelIndex = 0, targetOffset = 0; pixelIndex < pixelCount; pixelIndex += 1, targetOffset += 4) {
    target[targetOffset] = source[redPlaneOffset + pixelIndex];
    target[targetOffset + 1] = source[greenPlaneOffset + pixelIndex];
    target[targetOffset + 2] = source[bluePlaneOffset + pixelIndex];
    target[targetOffset + 3] = source[alphaPlaneOffset + pixelIndex];
  }
  return target;
}

function estimateUint16MaxSample(bytes, littleEndian = true, maxSamples = 8192) {
  const source = toUint8Array(bytes);
  if (!source || source.byteLength < 2) return 0;
  const sampleCount = Math.floor(source.byteLength / 2);
  if (sampleCount <= 0) return 0;
  const targetSamples = Math.max(1, Math.min(sampleCount, Math.round(Number(maxSamples) || 8192)));
  const sampleStep = Math.max(1, Math.floor(sampleCount / targetSamples));
  let maxValue = 0;
  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += sampleStep) {
    const srcOffset = sampleIndex * 2;
    const value = littleEndian
      ? (source[srcOffset] | (source[srcOffset + 1] << 8))
      : ((source[srcOffset] << 8) | source[srcOffset + 1]);
    if (value > maxValue) maxValue = value;
    if (maxValue >= 65535) break;
  }
  return maxValue;
}

function decodeUint16ToUint8Channels(bytes, littleEndian = true, denominator = 65535) {
  const source = toUint8Array(bytes);
  if (!source || source.byteLength < 2) return null;
  const sourceLen = source.byteLength - (source.byteLength % 2);
  if (sourceLen < 2) return null;
  const target = new Uint8Array(sourceLen / 2);
  const safeDenominator = Math.max(1, Number(denominator) || 65535);
  for (let srcOffset = 0, dstOffset = 0; srcOffset < sourceLen; srcOffset += 2, dstOffset += 1) {
    const value = littleEndian
      ? (source[srcOffset] | (source[srcOffset + 1] << 8))
      : ((source[srcOffset] << 8) | source[srcOffset + 1]);
    target[dstOffset] = clampToByte((value * 255) / safeDenominator);
  }
  return target;
}

function normalizeFourChannelBytesToRgba(bytes, pixelCount) {
  const source = toUint8Array(bytes);
  const expectedLen = pixelCount * 4;
  if (!source || source.byteLength < expectedLen) {
    throw new Error(`rgba_payload_short:${source ? source.byteLength : 0}/${expectedLen}`);
  }
  const normalizedSource = source.subarray(0, expectedLen);

  const defaultRgba = new Uint8Array(expectedLen);
  defaultRgba.set(normalizedSource);
  const defaultAlphaMean = sampleInterleavedChannelMean(defaultRgba, 3);

  let bestCandidate = defaultRgba;
  let bestAlphaMean = defaultAlphaMean;

  const argbChunkyCandidate = convertChunkyArgbToRgba(normalizedSource, expectedLen);
  const argbChunkyAlphaMean = sampleInterleavedChannelMean(argbChunkyCandidate, 3);
  if (argbChunkyAlphaMean > bestAlphaMean) {
    bestCandidate = argbChunkyCandidate;
    bestAlphaMean = argbChunkyAlphaMean;
  }

  const rgbaPlanarCandidate = convertPlanarToRgba(normalizedSource, pixelCount, false);
  const rgbaPlanarAlphaMean = sampleInterleavedChannelMean(rgbaPlanarCandidate, 3);
  if (rgbaPlanarAlphaMean > bestAlphaMean) {
    bestCandidate = rgbaPlanarCandidate;
    bestAlphaMean = rgbaPlanarAlphaMean;
  }

  const argbPlanarCandidate = convertPlanarToRgba(normalizedSource, pixelCount, true);
  const argbPlanarAlphaMean = sampleInterleavedChannelMean(argbPlanarCandidate, 3);
  if (argbPlanarAlphaMean > bestAlphaMean) {
    bestCandidate = argbPlanarCandidate;
    bestAlphaMean = argbPlanarAlphaMean;
  }

  const alphaPlaneRgbaMean = samplePlaneMean(normalizedSource, pixelCount * 3, pixelCount);
  const alphaPlaneArgbMean = samplePlaneMean(normalizedSource, 0, pixelCount);
  const shouldTryFallbackLayout =
    bestAlphaMean - defaultAlphaMean >= 24 &&
    bestAlphaMean >= 96 &&
    (
      alphaPlaneRgbaMean - defaultAlphaMean >= 24 ||
      alphaPlaneArgbMean - defaultAlphaMean >= 24 ||
      bestAlphaMean >= 140
    );

  return shouldTryFallbackLayout ? bestCandidate : defaultRgba;
}

function decode16BitChannelsToRgba(rawBytes, pixelCount, channelCount) {
  const source = toUint8Array(rawBytes);
  const requiredBytes = pixelCount * channelCount * 2;
  if (!source || source.byteLength < requiredBytes) {
    throw new Error(`rgba_payload_short:${source ? source.byteLength : 0}/${requiredBytes}`);
  }
  const trimmed = source.subarray(0, requiredBytes);
  const maxLE = estimateUint16MaxSample(trimmed, true);
  const maxBE = estimateUint16MaxSample(trimmed, false);
  const useLittleEndian = maxLE >= (maxBE * 0.9);
  const selectedMax = useLittleEndian ? maxLE : maxBE;
  const candidateDenominators = selectedMax <= 33000 ? [65535, 32768] : [65535];

  let bestRgba = null;
  let bestScore = -Infinity;
  for (const denominator of candidateDenominators) {
    const decodedChannels = decodeUint16ToUint8Channels(trimmed, useLittleEndian, denominator);
    if (!decodedChannels) continue;
    const decodedLen = pixelCount * channelCount;
    if (decodedChannels.byteLength < decodedLen) continue;
    const channelBytes = decodedChannels.subarray(0, decodedLen);
    let rgba = null;
    if (channelCount === 4) {
      rgba = normalizeFourChannelBytesToRgba(channelBytes, pixelCount);
    } else if (channelCount === 3) {
      rgba = convertChunkyRgbToRgba(channelBytes, pixelCount);
    } else if (channelCount === 1) {
      rgba = convertGrayscaleToRgba(channelBytes, pixelCount);
    } else {
      throw new Error(`unsupported_channel_count:${channelCount}`);
    }
    const score = scoreRgbaLumaStats(sampleRgbaLumaStats(rgba));
    if (score > bestScore) {
      bestRgba = rgba;
      bestScore = score;
    }
  }
  if (!bestRgba) {
    throw new Error(`decode16_failed:${channelCount}`);
  }
  return bestRgba;
}

function normalizeRawCaptureBytesToRgba(rawBytes, width, height) {
  const source = toUint8Array(rawBytes);
  if (!source || !source.byteLength) {
    throw new Error("rgba_payload_empty");
  }
  const safeWidth = Math.max(1, Math.round(Number(width) || 1));
  const safeHeight = Math.max(1, Math.round(Number(height) || 1));
  const pixelCount = safeWidth * safeHeight;
  const rgbaLen = pixelCount * 4;
  const rgbLen = pixelCount * 3;
  const grayLen = pixelCount;
  const rgba16Len = pixelCount * 8;
  const rgb16Len = pixelCount * 6;
  const gray16Len = pixelCount * 2;
  const sourceLen = source.byteLength;

  if (sourceLen === rgbaLen) return normalizeFourChannelBytesToRgba(source, pixelCount);
  if (sourceLen === rgbLen) return convertChunkyRgbToRgba(source, pixelCount);
  if (sourceLen === grayLen) return convertGrayscaleToRgba(source, pixelCount);
  if (sourceLen === rgba16Len) return decode16BitChannelsToRgba(source, pixelCount, 4);
  if (sourceLen === rgb16Len) return decode16BitChannelsToRgba(source, pixelCount, 3);
  if (sourceLen === gray16Len) return decode16BitChannelsToRgba(source, pixelCount, 1);

  if (sourceLen >= rgba16Len && sourceLen % 2 === 0) {
    return decode16BitChannelsToRgba(source.subarray(0, rgba16Len), pixelCount, 4);
  }
  if (sourceLen >= rgb16Len && sourceLen % 2 === 0) {
    return decode16BitChannelsToRgba(source.subarray(0, rgb16Len), pixelCount, 3);
  }
  if (sourceLen >= rgbaLen) {
    return normalizeFourChannelBytesToRgba(source, pixelCount);
  }
  if (sourceLen >= rgbLen) {
    return convertChunkyRgbToRgba(source, pixelCount);
  }
  if (sourceLen >= grayLen) {
    return convertGrayscaleToRgba(source, pixelCount);
  }
  throw new Error(`rgba_payload_short:${sourceLen}/${rgbaLen}`);
}

function encodeRgbaToPngBytes(rgbaBytes, width, height) {
  const safeWidth = Math.max(1, Math.round(Number(width) || 1));
  const safeHeight = Math.max(1, Math.round(Number(height) || 1));
  const rgba = normalizeRawCaptureBytesToRgba(rgbaBytes, safeWidth, safeHeight);

  const stride = safeWidth * 4;
  const scanlineWidth = stride + 1;
  const raw = new Uint8Array(scanlineWidth * safeHeight);
  for (let y = 0; y < safeHeight; y += 1) {
    const srcOffset = y * stride;
    const dstOffset = y * scanlineWidth;
    raw[dstOffset] = 0;
    raw.set(rgba.subarray(srcOffset, srcOffset + stride), dstOffset + 1);
  }

  const ihdr = new Uint8Array(13);
  ihdr.set(uint32be(safeWidth), 0);
  ihdr.set(uint32be(safeHeight), 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const idatData = buildZlibStoredDeflate(raw);
  if (!idatData || !idatData.byteLength) {
    throw new Error("zlib_payload_empty");
  }

  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  return concatUint8Arrays([
    signature,
    buildPngChunk("IHDR", ihdr),
    buildPngChunk("IDAT", idatData),
    buildPngChunk("IEND", new Uint8Array(0))
  ]);
}

function formatCaptureFileTimestampPrecise(timestampValue = Date.now()) {
  const normalizedTimestamp = Number.isFinite(Number(timestampValue))
      ? Number(timestampValue)
      : Date.now(),
    dateObject = new Date(normalizedTimestamp),
    padTwoDigits = (numberValue) => String(numberValue).padStart(2, "0"),
    padThreeDigits = (numberValue) => String(numberValue).padStart(3, "0");
  return `${dateObject.getFullYear()}${padTwoDigits(dateObject.getMonth() + 1)}${padTwoDigits(dateObject.getDate())}T${padTwoDigits(dateObject.getHours())}${padTwoDigits(dateObject.getMinutes())}${padTwoDigits(dateObject.getSeconds())}${padThreeDigits(dateObject.getMilliseconds())}`;
}

function resolveCaptureTempSourceToken(sourceInput = "") {
  const normalizedSource = String(sourceInput || "").trim().toLowerCase();
  if (normalizedSource === "psselect" || normalizedSource === "ps-select") return "psselect";
  if (normalizedSource === "pscanvas" || normalizedSource === "ps-full") return "pscanvas";
  return "capture";
}

function normalizeCaptureTempSequenceToken(sequenceTokenInput = "") {
  const normalizedSequenceToken = String(sequenceTokenInput || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  return normalizedSequenceToken || "ps01";
}

function buildCaptureTempFilePrefix({
  sourceToken = "",
  occurredAt = Date.now(),
  sequenceToken = "",
  tempKind = "lossless",
} = {}) {
  const normalizedSourceToken = resolveCaptureTempSourceToken(sourceToken);
  const normalizedSequenceToken = normalizeCaptureTempSequenceToken(sequenceToken);
  const normalizedTempKind = String(tempKind || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_") || "lossless";
  return `${normalizedSourceToken}_temp_${normalizedTempKind}_${formatCaptureFileTimestampPrecise(occurredAt)}_${normalizedSequenceToken}`;
}

async function saveCaptureRgbaToTempFile(
  rgbaBytes,
  width,
  height,
  filePrefix = CAPTURE_TEMP_FILE_PREFIX,
  captureOptions = {}
) {
  const normalizedCaptureOptions = normalizeCaptureEncodeOptions(captureOptions);
  const pngBytes = encodeRgbaToPngBytes(rgbaBytes, width, height);
  if (!pngBytes || !pngBytes.byteLength) {
    throw new Error("capture_temp_lossless_png_empty");
  }
  const tempFolder = await fs.getTemporaryFolder();
  const normalizedPrefix = String(filePrefix || CAPTURE_TEMP_FILE_PREFIX).trim() || CAPTURE_TEMP_FILE_PREFIX;
  const tempFileName = `${normalizedPrefix}.png`;
  const tempFile = await tempFolder.createFile(
    tempFileName,
    { overwrite: true }
  );
  const binary = pngBytes.buffer.slice(
    pngBytes.byteOffset,
    pngBytes.byteOffset + pngBytes.byteLength
  );
  await tempFile.write(binary, { format: storage.formats.binary });
  const nativePath = String(tempFile?.nativePath || tempFile?.path || "").trim();
  if (!nativePath) return null;
  return {
    filePath: nativePath,
    fileName: tempFileName,
    mimeType: "image/png",
    byteLength: Number(pngBytes.byteLength) || 0,
    outputFormat: "png",
    outputQuality: normalizedCaptureOptions.quality,
    outputMaxSide: normalizedCaptureOptions.maxSide,
    encodeStrategy: "plugin.temp-lossless-png",
    tempFileKind: CAPTURE_TEMP_FILE_KIND,
    tempFileCleanupPolicy: CAPTURE_TEMP_FILE_CLEANUP_POLICY,
    primaryEncodeError: "",
    fallbackReason: ""
  };
}

async function readDocumentRegionAsCaptureFile(documentId, bounds, captureOptions = {}, traceOptions = {}) {
  const left = Math.round(Number(bounds?.left) || 0);
  const top = Math.round(Number(bounds?.top) || 0);
  const right = Math.round(Number(bounds?.right) || 0);
  const bottom = Math.round(Number(bounds?.bottom) || 0);
  const sourceWidth = Math.max(1, right - left);
  const sourceHeight = Math.max(1, bottom - top);
  const normalizedCaptureOptions = normalizeCaptureEncodeOptions(captureOptions);
  const normalizedOccurredAt = Number.isFinite(Number(traceOptions?.occurredAt))
    ? Number(traceOptions.occurredAt)
    : Date.now();
  const normalizedSourceToken = resolveCaptureTempSourceToken(
    traceOptions?.sourceToken || traceOptions?.source || normalizedCaptureOptions?.source || ""
  );
  const normalizedSequenceToken = normalizeCaptureTempSequenceToken(
    traceOptions?.sequenceToken || traceOptions?.sequence || "ps01"
  );
  const normalizedSourceRefKey = `${formatCaptureFileTimestampPrecise(normalizedOccurredAt)}_${normalizedSequenceToken}`;
  const captureHasAlpha = normalizedCaptureOptions.format === "png";
  const targetSize = getScaledSizeWithinLimit(
    sourceWidth,
    sourceHeight,
    normalizedCaptureOptions.maxSide
  );
  let pixelsResult = null;
  try {
    pixelsResult = await getPixelsForCapture({
      documentID: Number(documentId),
      sourceBounds: { left, top, right, bottom },
      targetSize,
      colorSpace: "RGB",
      componentSize: CAPTURE_OUTPUT_COMPONENT_SIZE,
      hasAlpha: captureHasAlpha,
      applyAlpha: !captureHasAlpha
    });
  } catch (err) {
    throw new Error(`capture_get_pixels_failed:${String(err?.message || err || "unknown")}`);
  }
  const pixels = pixelsResult?.pixels || pixelsResult;
  const imageData = pixels?.imageData;
  if (!imageData) throw new Error("capture_image_data_missing");
  try {
    const width = Math.max(1, Math.round(Number(imageData.width) || targetSize.width));
    const height = Math.max(1, Math.round(Number(imageData.height) || targetSize.height));
    let rawPixels = null;
    try {
      rawPixels = await imageData.getData({
        chunky: true,
        fullRange: true
      });
    } catch (chunkyErr) {
      try {
        rawPixels = await imageData.getData({});
      } catch (fallbackErr) {
        const chunkyText = String(chunkyErr?.message || chunkyErr || "unknown");
        const fallbackText = String(fallbackErr?.message || fallbackErr || "unknown");
        throw new Error(`capture_get_data_failed:${chunkyText} | fallback:${fallbackText}`);
      }
    }
    if (!rawPixels || !rawPixels.byteLength) {
      throw new Error("imageData_getData_empty");
    }
    let captureFileResult = null;
    try {
      captureFileResult = await saveCaptureRgbaToTempFile(
        rawPixels,
        width,
        height,
        buildCaptureTempFilePrefix({
          sourceToken: normalizedSourceToken,
          occurredAt: normalizedOccurredAt,
          sequenceToken: normalizedSequenceToken,
          tempKind: "lossless",
        }),
        normalizedCaptureOptions
      );
    } catch (err) {
      throw new Error(`capture_save_file_failed:${String(err?.message || err || "unknown")}`);
    }
    const filePath = String(captureFileResult?.filePath || "").trim();
    if (!filePath) {
      throw new Error("capture_file_path_empty");
    }
    return {
      capturedAt: normalizedOccurredAt,
      sourceToken: normalizedSourceToken,
      sequenceToken: normalizedSequenceToken,
      sourceRefKey: normalizedSourceRefKey,
      mimeType: String(captureFileResult?.mimeType || "image/png"),
      width,
      height,
      filePath: filePath || "",
      captureMeta: {
        schemaVersion: CAPTURE_SCHEMA_VERSION,
        colorSpace: "RGB",
        componentSize: CAPTURE_OUTPUT_COMPONENT_SIZE,
        alphaPreserved: captureHasAlpha,
        outputChannelCount: captureHasAlpha ? 4 : 3,
        outputPixelDepth: CAPTURE_OUTPUT_COMPONENT_SIZE * (captureHasAlpha ? 4 : 3),
        colorProfile: String(pixelsResult?.colorProfile || ""),
        usedPreferredColorProfile: !!pixelsResult?.usedPreferredProfile,
        preferredColorProfileError: String(pixelsResult?.preferredProfileError || ""),
        fallbackGetPixelsError: String(pixelsResult?.fallbackRequestError || ""),
        usedMinimalGetPixelsRequest: !!pixelsResult?.usedMinimalRequest,
        sourceBounds: {
          left,
          top,
          right,
          bottom
        },
        targetSize: {
          width: Number(targetSize?.width) || width,
          height: Number(targetSize?.height) || height
        },
        outputFormatRequested: normalizedCaptureOptions.format,
        outputQualityRequested: normalizedCaptureOptions.quality,
        outputMaxSideRequested: normalizedCaptureOptions.maxSide,
        outputFormatActual: String(captureFileResult?.outputFormat || normalizedCaptureOptions.format),
        outputMaxSideActual: Number(captureFileResult?.outputMaxSide) || normalizedCaptureOptions.maxSide,
        sourceToken: normalizedSourceToken,
        sequenceToken: normalizedSequenceToken,
        sourceRefKey: normalizedSourceRefKey,
        encodeStrategy: String(captureFileResult?.encodeStrategy || ""),
        tempFileKind: String(captureFileResult?.tempFileKind || CAPTURE_TEMP_FILE_KIND),
        tempFileCleanupPolicy: String(
          captureFileResult?.tempFileCleanupPolicy || CAPTURE_TEMP_FILE_CLEANUP_POLICY
        ),
        tempFileName: String(captureFileResult?.fileName || ""),
        primaryEncodeError: String(captureFileResult?.primaryEncodeError || ""),
        fallbackReason: String(captureFileResult?.fallbackReason || ""),
        encodedByteLength: Number(captureFileResult?.byteLength) || 0,
        rawByteLength: Number(rawPixels?.byteLength) || 0,
        imageDataWidth: width,
        imageDataHeight: height
      }
    };
  } finally {
    try {
      imageData.dispose();
    } catch (_) {}
  }
}

function readDocumentModeText(doc) {
  try {
    const rawMode = doc?.mode;
    if (rawMode == null) return "";
    if (typeof rawMode === "string") return rawMode;
    if (typeof rawMode === "number" && Number.isFinite(rawMode)) return String(rawMode);
    if (typeof rawMode === "object") {
      if (rawMode && typeof rawMode._value === "string") return rawMode._value;
      if (rawMode && typeof rawMode.value === "string") return rawMode.value;
      if (rawMode && Number.isFinite(Number(rawMode.value))) return String(rawMode.value);
    }
    return String(rawMode || "");
  } catch (_) {
    return "";
  }
}

function readDocumentBitsPerChannel(doc) {
  try {
    const rawBits = doc?.bitsPerChannel;
    if (Number.isFinite(Number(rawBits))) {
      return Math.round(Number(rawBits));
    }
    if (rawBits && typeof rawBits === "object") {
      const candidate = Number(rawBits._value ?? rawBits.value ?? rawBits.bits);
      if (Number.isFinite(candidate)) return Math.round(candidate);
    }
  } catch (_) {}
  return undefined;
}

async function captureSelectionData(captureOptions = {}) {
  const sourceDocumentId = Number(app?.activeDocument?.id) || 0;

  let result = null;
  let modalError = null;
  await core.executeAsModal(async () => {
    try {
      const modalDoc = app.activeDocument;
      if (!modalDoc) throw new Error("No active document");
      if (sourceDocumentId > 0 && Number(modalDoc.id) !== sourceDocumentId) {
        throw new Error("no_selection");
      }
      const selectionRect = await getDocumentSelectionRect(modalDoc, "capture-selection");
      if (!selectionRect) throw new Error("no_selection");
      const targetCanvas = getDocumentCanvasSize(modalDoc);
      const capture = await readDocumentRegionAsCaptureFile(
        modalDoc.id,
        selectionRect,
        captureOptions,
        {
          sourceToken: "psselect",
          occurredAt: Date.now(),
          sequenceToken: "ps01",
        }
      );
      const targetRect = normalizeTargetRect(selectionRect);
      const targetRectNorm = deriveTargetRectNorm(targetRect, targetCanvas);
      const documentMode = readDocumentModeText(modalDoc);
      const bitsPerChannel = readDocumentBitsPerChannel(modalDoc);
      result = {
        filePath: capture.filePath || "",
        capturedAt: capture.capturedAt,
        sourceRefKey: capture.sourceRefKey,
        mimeType: capture.mimeType,
        width: capture.width,
        height: capture.height,
        targetRect,
        targetRectNorm,
        targetCanvas,
        documentId: modalDoc.id,
        documentName: String(modalDoc.title || ""),
        documentMode: documentMode || undefined,
        bitsPerChannel: Number.isFinite(bitsPerChannel) ? bitsPerChannel : undefined,
        captureMeta:
          capture?.captureMeta && typeof capture.captureMeta === "object"
            ? {
                ...capture.captureMeta,
                documentMode: documentMode || undefined,
                bitsPerChannel: Number.isFinite(bitsPerChannel)
                  ? bitsPerChannel
                  : undefined
              }
            : undefined
      };
    } catch (err) {
      modalError = err;
    }
  }, { commandName: "Capture selection image" });
  if (modalError) throw modalError;
  return result;
}

async function captureCanvasData(captureOptions = {}) {
  let result = null;
  let modalError = null;
  await core.executeAsModal(async () => {
    try {
      const activeDoc = app.activeDocument;
      if (!activeDoc) throw new Error("No active document");
      const docWidth = Math.max(1, Math.round(toPx(activeDoc.width)));
      const docHeight = Math.max(1, Math.round(toPx(activeDoc.height)));
      const docBounds = {
        left: 0,
        top: 0,
        width: docWidth,
        height: docHeight,
        right: docWidth,
        bottom: docHeight
      };
      const capture = await readDocumentRegionAsCaptureFile(
        activeDoc.id,
        docBounds,
        captureOptions,
        {
          sourceToken: "pscanvas",
          occurredAt: Date.now(),
          sequenceToken: "ps01",
        }
      );
      const targetCanvas = {
        width: docWidth,
        height: docHeight
      };
      const targetRect = normalizeTargetRect(docBounds);
      const targetRectNorm = deriveTargetRectNorm(targetRect, targetCanvas);
      const documentMode = readDocumentModeText(activeDoc);
      const bitsPerChannel = readDocumentBitsPerChannel(activeDoc);
      result = {
        filePath: capture.filePath || "",
        capturedAt: capture.capturedAt,
        sourceRefKey: capture.sourceRefKey,
        mimeType: capture.mimeType,
        width: capture.width,
        height: capture.height,
        targetRect,
        targetRectNorm,
        targetCanvas,
        documentId: activeDoc.id,
        documentName: String(activeDoc.title || ""),
        documentMode: documentMode || undefined,
        bitsPerChannel: Number.isFinite(bitsPerChannel) ? bitsPerChannel : undefined,
        captureMeta:
          capture?.captureMeta && typeof capture.captureMeta === "object"
            ? {
                ...capture.captureMeta,
                documentMode: documentMode || undefined,
                bitsPerChannel: Number.isFinite(bitsPerChannel)
                  ? bitsPerChannel
                  : undefined
              }
            : undefined
      };
    } catch (err) {
      modalError = err;
    }
  }, { commandName: "Capture full canvas image" });
  if (modalError) throw modalError;
  return result;
}

async function readActiveLayerBounds() {
  const boundsResult = await action.batchPlay([
    {
      _obj: "get",
      _target: [
        { _property: "bounds" },
        { _ref: "layer", _enum: "ordinal", _value: "targetEnum" }
      ]
    }
  ], {});
  const layerBounds = boundsResult?.[0]?.bounds || {};
  const left = toPx(layerBounds.left);
  const top = toPx(layerBounds.top);
  const right = toPx(layerBounds.right);
  const bottom = toPx(layerBounds.bottom);
  return normalizeTargetRect({
    left,
    top,
    width: Math.max(1, Math.round(right - left)),
    height: Math.max(1, Math.round(bottom - top))
  });
}

function getPrimaryActiveLayerId() {
  const activeLayerId = Number(app?.activeDocument?.activeLayers?.[0]?.id);
  if (!Number.isFinite(activeLayerId) || activeLayerId <= 0) {
    return null;
  }
  return Math.round(activeLayerId);
}

function getPrimaryActiveLayerName() {
  const activeLayerName = String(app?.activeDocument?.activeLayers?.[0]?.name || "").trim();
  return activeLayerName || "";
}

async function selectSingleLayerById(layerId) {
  const normalizedLayerId = Math.round(Number(layerId));
  if (!Number.isFinite(normalizedLayerId) || normalizedLayerId <= 0) {
    return false;
  }
  const selectionAttempts = [
    {
      _obj: "select",
      _target: [{ _ref: "layer", _id: normalizedLayerId }],
      makeVisible: false,
      layerID: [normalizedLayerId]
    },
    {
      _obj: "select",
      _target: [{ _ref: "layer", _id: normalizedLayerId }],
      makeVisible: false
    }
  ];
  for (const selectionCmd of selectionAttempts) {
    try {
      await action.batchPlay([selectionCmd], {});
      return true;
    } catch (_) {}
  }
  return false;
}

async function ensureSingleLayerSelectedById(layerId) {
  const normalizedLayerId = Math.round(Number(layerId));
  if (!Number.isFinite(normalizedLayerId) || normalizedLayerId <= 0) {
    throw new Error("layer_id_invalid");
  }
  const selected = await selectSingleLayerById(normalizedLayerId);
  if (!selected) {
    throw new Error(`layer_select_failed:${normalizedLayerId}`);
  }
  return normalizedLayerId;
}

async function moveActiveLayer(deltaX, deltaY) {
  const dx = Math.round(Number(deltaX) || 0);
  const dy = Math.round(Number(deltaY) || 0);
  if (dx === 0 && dy === 0) return;
  await action.batchPlay([
    {
      _obj: "move",
      _target: [{ _ref: "layer", _enum: "ordinal", _value: "targetEnum" }],
      to: {
        _obj: "offset",
        horizontal: { _unit: "pixelsUnit", _value: dx },
        vertical: { _unit: "pixelsUnit", _value: dy }
      }
    }
  ], {});
}

async function scaleActiveLayerTo(targetWidth, targetHeight, currentBounds) {
  if (!currentBounds) return;
  const currentWidth = Math.max(1, Number(currentBounds.width) || 1);
  const currentHeight = Math.max(1, Number(currentBounds.height) || 1);
  const nextWidth = Math.max(1, Math.round(Number(targetWidth) || currentWidth));
  const nextHeight = Math.max(1, Math.round(Number(targetHeight) || currentHeight));
  const scaleXPercent = (nextWidth / currentWidth) * 100;
  const scaleYPercent = (nextHeight / currentHeight) * 100;
  if (Math.abs(scaleXPercent - 100) < 0.01 && Math.abs(scaleYPercent - 100) < 0.01) return;

  const activeLayer = app.activeDocument?.activeLayers?.[0];
  if (activeLayer && typeof activeLayer.scale === "function") {
    await activeLayer.scale(scaleXPercent, scaleYPercent);
    return;
  }

  const attempts = [
    {
      _obj: "transform",
      _target: [{ _ref: "layer", _enum: "ordinal", _value: "targetEnum" }],
      freeTransformCenterState: { _enum: "quadCenterState", _value: "QCSAverage" },
      offset: {
        _obj: "offset",
        horizontal: { _unit: "pixelsUnit", _value: 0 },
        vertical: { _unit: "pixelsUnit", _value: 0 }
      },
      width: { _unit: "percentUnit", _value: scaleXPercent },
      height: { _unit: "percentUnit", _value: scaleYPercent },
      linked: false
    },
    {
      _obj: "transform",
      _target: [{ _ref: "layer", _enum: "ordinal", _value: "targetEnum" }],
      _freeTransformCenterState: { _enum: "quadCenterState", _value: "QCSAverage" },
      _offset: {
        _obj: "offset",
        horizontal: { _unit: "pixelsUnit", _value: 0 },
        vertical: { _unit: "pixelsUnit", _value: 0 }
      },
      _width: { _unit: "percentUnit", _value: scaleXPercent },
      _height: { _unit: "percentUnit", _value: scaleYPercent },
      linked: false
    }
  ];
  let lastErr = null;
  for (const cmd of attempts) {
    try {
      await action.batchPlay([cmd], {});
      return;
    } catch (err) {
      lastErr = err;
    }
  }
  if (lastErr) throw lastErr;
}

async function alignActiveLayerToRect(targetRect) {
  if (!targetRect) return null;
  let bounds = await readActiveLayerBounds();
  if (!bounds) return null;
  await scaleActiveLayerTo(targetRect.width, targetRect.height, bounds);
  bounds = await readActiveLayerBounds();
  if (!bounds) return null;
  const deltaX = Math.round(Number(targetRect.left) - Number(bounds.left || 0));
  const deltaY = Math.round(Number(targetRect.top) - Number(bounds.top || 0));
  await moveActiveLayer(deltaX, deltaY);
  return readActiveLayerBounds();
}

async function readLayerBoundsById(layerId) {
  await ensureSingleLayerSelectedById(layerId);
  return readActiveLayerBounds();
}

async function alignLayerByIdToRect(layerId, targetRect) {
  await ensureSingleLayerSelectedById(layerId);
  return alignActiveLayerToRect(targetRect);
}

async function rasterizeActivePlacedLayer() {
  const rasterizeAttempts = [
    {
      _obj: "rasterizeLayer",
      _target: [{ _ref: "layer", _enum: "ordinal", _value: "targetEnum" }],
      what: { _enum: "rasterizeItem", _value: "placed" }
    },
    {
      _obj: "rasterizeLayer",
      _target: [{ _ref: "layer", _enum: "ordinal", _value: "targetEnum" }],
      what: { _enum: "rasterizeItem", _value: "entireLayer" }
    },
    {
      _obj: "rasterizeLayer",
      _target: [{ _ref: "layer", _enum: "ordinal", _value: "targetEnum" }]
    }
  ];
  let lastErr = null;
  for (const rasterizeCmd of rasterizeAttempts) {
    try {
      await action.batchPlay([rasterizeCmd], {});
      return;
    } catch (err) {
      lastErr = err;
    }
  }
  if (lastErr) throw lastErr;
}

async function rasterizePlacedLayerById(layerId) {
  const normalizedLayerId = await ensureSingleLayerSelectedById(layerId);
  await rasterizeActivePlacedLayer();
  return getPrimaryActiveLayerId() || normalizedLayerId;
}

function stripFileExtension(fileName) {
  return String(fileName || "").replace(/\.[^./\\]+$/, "").trim();
}

function resolveImportedLayerGroupName(returnFileName, returnIndex) {
  const strippedFileName = stripFileExtension(returnFileName);
  if (strippedFileName) return strippedFileName;
  const normalizedReturnIndex = Number(returnIndex);
  return Number.isFinite(normalizedReturnIndex) && normalizedReturnIndex >= 0
    ? `回传图层-${normalizedReturnIndex + 1}`
    : "回传图层";
}

function findLayerByIdInCollection(layerCollection, targetLayerId) {
  const normalizedTargetLayerId = Math.round(Number(targetLayerId));
  if (!Array.isArray(layerCollection) || !Number.isFinite(normalizedTargetLayerId) || normalizedTargetLayerId <= 0) {
    return null;
  }
  for (const layerItem of layerCollection) {
    if (!layerItem || typeof layerItem !== "object") continue;
    if (Math.round(Number(layerItem.id)) === normalizedTargetLayerId) {
      return layerItem;
    }
    const nestedLayers = Array.isArray(layerItem.layers) ? layerItem.layers : null;
    if (nestedLayers?.length) {
      const nestedMatch = findLayerByIdInCollection(nestedLayers, normalizedTargetLayerId);
      if (nestedMatch) return nestedMatch;
    }
  }
  return null;
}

async function createLayerGroupFromImportedLayer(doc, layerId, groupName) {
  const normalizedLayerId = await ensureSingleLayerSelectedById(layerId);
  const targetDoc = doc || app.activeDocument;
  if (!targetDoc || typeof targetDoc.createLayerGroup !== "function") {
    throw new Error("create_layer_group_unavailable");
  }
  const sourceLayer = findLayerByIdInCollection(targetDoc.layers, normalizedLayerId);
  if (!sourceLayer) {
    throw new Error(`group_source_layer_not_found:${normalizedLayerId}`);
  }
  const createdGroup = await targetDoc.createLayerGroup({
    name: String(groupName || "").trim() || "回传图层",
    fromLayers: [sourceLayer]
  });
  return {
    groupId: Number(createdGroup?.id) || null,
    groupName: String(createdGroup?.name || groupName || "回传图层").trim()
  };
}

function formatImportedAutoActionError(errorPrefix, errorInput) {
  const normalizedPrefix = String(errorPrefix || "auto_action_failed").trim() || "auto_action_failed";
  const normalizedMessage = String(errorInput?.message || errorInput || "").trim();
  return `${normalizedPrefix}:${normalizedMessage || normalizedPrefix}`;
}

async function importDataUrlToCurrentDocument(inputData, options = {}) {
  const parsed = parseDataUrl(inputData);
  if (!parsed?.base64) throw new Error("invalid_data_url_or_base64");

  const binary = base64ToArrayBuffer(parsed.base64);
  const targetRectRaw = normalizeTargetRect(options?.targetRect);
  const targetCanvasRaw = normalizeTargetCanvas(options?.targetCanvas);
  const targetRectNormRaw = normalizeTargetRectNorm(options?.targetRectNorm)
    || deriveTargetRectNorm(targetRectRaw, targetCanvasRaw);
  const requestedDocumentId = Math.round(Number(options?.targetDocumentId));
  const hasRequestedDocumentId = Number.isFinite(requestedDocumentId) && requestedDocumentId > 0;
  const layerTypeRaw = String(options?.layerType || "").trim().toLowerCase();
  const layerType = layerTypeRaw === "rasterized" ? "rasterized" : "smart-object";
  const autoGroup = options?.autoGroup === true;
  const autoMask = options?.autoMask === true;
  const requestedDocumentName = String(options?.targetDocumentName || "").trim();
  const returnFileName = String(options?.returnFileName || "").trim();
  const returnIndexRaw = Number(options?.returnIndex);
  const returnIndex =
    Number.isFinite(returnIndexRaw) && returnIndexRaw >= 0
      ? Math.floor(returnIndexRaw)
      : undefined;
  const returnTargetSignature = String(options?.returnTargetSignature || "").trim();
  let appliedDocumentId = null;
  let appliedDocumentName = "";
  let appliedTargetRect = null;
  let appliedTargetRectNorm = null;
  let appliedTargetCanvas = null;
  let finalLayerBounds = null;
  let finalLayerId = null;
  let finalLayerName = "";
  let finalGroupId = null;
  let finalGroupName = "";
  let groupCreated = false;
  let maskCreated = false;
  let unresolvedImport = null;
  let modalError = null;

  await core.executeAsModal(async () => {
    try {
      const openDocuments = listOpenDocumentsMeta();
      const activeDocumentId = Number(app?.activeDocument?.id) || null;
      const activeDocumentName = String(app?.activeDocument?.title || "");
      let targetDoc = app.activeDocument;
      if (hasRequestedDocumentId) {
        const requestedDoc = findDocumentById(requestedDocumentId);
        if (!requestedDoc) {
          unresolvedImport = {
            ok: false,
            errorCode: "target_document_not_found",
            message: "target_document_not_found",
            requestedDocumentId,
            requestedDocumentName,
            activeDocumentId,
            activeDocumentName,
            openDocuments
          };
          return;
        }
        try {
          await action.batchPlay([
            {
              _obj: "select",
              _target: [{ _ref: "document", _id: requestedDoc.id }]
            }
          ], {});
        } catch (_) {}
        targetDoc = app.activeDocument || requestedDoc;
      } else if (openDocuments.length > 1) {
        unresolvedImport = {
          ok: false,
          errorCode: "target_document_required",
          message: "target_document_required",
          requestedDocumentId: null,
          requestedDocumentName,
          activeDocumentId,
          activeDocumentName,
          openDocuments
        };
        return;
      }
      if (!targetDoc) throw new Error("no_document");

      appliedDocumentId = Number(targetDoc?.id) || null;
      appliedDocumentName = String(targetDoc?.title || "");
      const documentCanvas = getDocumentCanvasSize(targetDoc);
      appliedTargetCanvas = documentCanvas;
      appliedTargetRect = resolveTargetRectForDocument(
        targetRectRaw,
        targetRectNormRaw,
        targetCanvasRaw,
        documentCanvas
      );
      appliedTargetRectNorm = deriveTargetRectNorm(appliedTargetRect, documentCanvas);

      const selectionSnapshot = await getDocumentSelectionRect(targetDoc, "import-image");
      try {
        if (selectionSnapshot) {
          await clearDocumentSelection(targetDoc);
        }

        const tempFolder = await fs.getTemporaryFolder();
        const ext = parsed.mimeType.includes("jpeg") ? "jpg" : "png";
        const tempFile = await tempFolder.createFile(`xiaodi-import-${Date.now()}.${ext}`, { overwrite: true });
        await tempFile.write(binary, { format: storage.formats.binary });
        let importToken = "";
        if (typeof fs.createSessionToken === "function") {
          importToken = String(await Promise.resolve(fs.createSessionToken(tempFile)) || "").trim();
        }
        if (!importToken) throw new Error("import_file_token_missing");

        await action.batchPlay([
          {
            _obj: "select",
            _target: [{ _ref: "document", _id: targetDoc.id }]
          },
          {
            _obj: "placeEvent",
            null: {
              _path: importToken,
              _kind: "local"
            },
            linked: false
          }
        ], {});
        const importedLayerId = getPrimaryActiveLayerId();
        if (!importedLayerId) throw new Error("imported_layer_id_missing");
        finalLayerId = importedLayerId;
        await ensureSingleLayerSelectedById(importedLayerId);

        // placeEvent already creates a placed (smart object) layer.
        // Running newPlacedLayer again can trigger unnecessary smart-object updates.

        if (appliedTargetRect) {
          finalLayerBounds = await alignLayerByIdToRect(finalLayerId, appliedTargetRect);
        }
        if (layerType === "rasterized") {
          finalLayerId = await rasterizePlacedLayerById(finalLayerId);
        }
        finalLayerBounds = await readLayerBoundsById(finalLayerId);
        finalLayerName = getPrimaryActiveLayerName();
        if (autoGroup) {
          try {
            const createdGroup = await createLayerGroupFromImportedLayer(
              targetDoc,
              finalLayerId,
              resolveImportedLayerGroupName(returnFileName, returnIndex)
            );
            finalGroupId = createdGroup.groupId;
            finalGroupName = createdGroup.groupName;
            groupCreated = !!(finalGroupId || finalGroupName);
          } catch (autoGroupError) {
            throw new Error(formatImportedAutoActionError("auto_group_failed", autoGroupError));
          }
        }
        if (autoMask && appliedTargetRect) {
          try {
            maskCreated = await createRevealSelectionMaskForLayerId(
              targetDoc,
              finalLayerId,
              appliedTargetRect
            );
          } catch (autoMaskError) {
            throw new Error(formatImportedAutoActionError("auto_mask_failed", autoMaskError));
          }
        }
      } finally {
        if (selectionSnapshot) {
          try {
            await restoreDocumentSelection(targetDoc, selectionSnapshot);
          } catch (_) {}
        } else {
          try {
            await clearDocumentSelection(targetDoc);
          } catch (_) {}
        }
      }
    } catch (err) {
      modalError = err;
    }
  }, { commandName: "Import image to document" });

  if (modalError) throw modalError;
  if (unresolvedImport) {
    return unresolvedImport;
  }

  return {
    ok: true,
    documentId: appliedDocumentId,
    documentName: appliedDocumentName,
    returnFileName: returnFileName || undefined,
    returnIndex,
    returnTargetSignature: returnTargetSignature || undefined,
    targetRect: appliedTargetRect,
    targetRectNorm: appliedTargetRectNorm,
    targetCanvas: appliedTargetCanvas,
    layerId: finalLayerId,
    layerName: finalLayerName,
    layerBounds: finalLayerBounds,
    groupId: finalGroupId,
    groupName: finalGroupName || undefined,
    groupCreated,
    maskCreated
  };
}

async function postHeartbeat(source = "manual") {
  await requestJson("/ps/heartbeat", {
    method: "POST",
    body: {
      source,
      plugin: "xiaodi-ps-bridge",
      version: PLUGIN_VERSION,
      at: Date.now()
    }
  });
}

async function reportCapture(kind, capture, extra = {}) {
  const endpoint = kind === "selection" ? "/ps/selection" : "/ps/canvas";
  const imagePayload = {
    mimeType: capture?.mimeType || "image/png",
    width: Number(capture?.width) || undefined,
    height: Number(capture?.height) || undefined,
    targetRect: capture?.targetRect || null,
    targetRectNorm: capture?.targetRectNorm || null,
    targetCanvas: capture?.targetCanvas || null,
    documentId: Number(capture?.documentId) || undefined,
    documentName: capture?.documentName ? String(capture.documentName) : undefined,
    documentMode: capture?.documentMode ? String(capture.documentMode) : undefined,
    bitsPerChannel: Number.isFinite(capture?.bitsPerChannel)
      ? Number(capture.bitsPerChannel)
      : undefined,
    captureMeta:
      capture?.captureMeta && typeof capture.captureMeta === "object"
        ? { ...capture.captureMeta }
        : undefined
  };
  const filePath = String(capture?.filePath || "").trim();
  if (!filePath) {
    throw new Error("capture_file_path_required");
  }
  imagePayload.filePath = filePath;
  return requestJson(endpoint, {
    method: "POST",
    body: {
      bridgeProtocolVersion: BRIDGE_PROTOCOL_VERSION,
      actionType: kind === "selection" ? "capture-selection" : "capture-canvas",
      source: extra.source || "manual",
      queueId: extra.queueId || null,
      slotIndex: Number.isFinite(extra.slotIndex) ? Number(extra.slotIndex) : undefined,
      role: extra.role || undefined,
      image: imagePayload,
      at: Date.now()
    }
  });
}

function normalizeQueueActionType(inputType) {
  const raw = String(inputType || "").trim().toLowerCase();
  if (raw === "ps.capture.selection") return "capture-selection";
  if (raw === "ps.capture.canvas") return "capture-canvas";
  if (raw === "ps.import" || raw === "ps.import.image") return "import-image";
  return raw;
}

async function reportQueueResult(queueId, status, payload = {}, actionType = "") {
  const id = String(queueId || "").trim();
  if (!id) return;
  const normalizedActionType = normalizeQueueActionType(
    actionType || payload?.actionType || ""
  );
  const payloadBody = payload && typeof payload === "object"
    ? { ...payload }
    : {};
  payloadBody.bridgeProtocolVersion = BRIDGE_PROTOCOL_VERSION;
  if (normalizedActionType) payloadBody.actionType = normalizedActionType;
  try {
    await requestJson("/queue/result", {
      method: "POST",
      body: {
        id,
        status: String(status || "done"),
        actionType: normalizedActionType,
        payload: payloadBody
      }
    });
  } catch (err) {
    appendLog(
      "warn",
      `队列结果上报失败：${String(err?.message || err || "未知错误")}`,
      "",
      { scene: "queue", syncToBridge: false }
    );
  }
}

async function reportImport(resultPayload = {}) {
  return requestJson("/ps/import", {
    method: "POST",
    body: {
      bridgeProtocolVersion: BRIDGE_PROTOCOL_VERSION,
      actionType: "import-image",
      source: "plugin",
      ...resultPayload,
      at: Date.now()
    }
  });
}

async function runCaptureSelection(source = "manual", extra = {}) {
  const capture = await captureSelectionData();
  await reportCapture("selection", capture, { source, ...extra });
  appendLog("success", `选区已上报：${capture.width}x${capture.height}`);
}

async function runCaptureCanvas(source = "manual", extra = {}) {
  const capture = await captureCanvasData();
  await reportCapture("canvas", capture, { source, ...extra });
  appendLog("success", `全图已上报：${capture.width}x${capture.height}`);
}

function buildQueueCaptureResultPayload(kind, capture, item = {}, payload = {}) {
  const normalizedKind = kind === "selection" ? "selection" : "canvas";
  const normalizedActionType = normalizedKind === "selection"
    ? "capture-selection"
    : "capture-canvas";
  const safeCapture = capture && typeof capture === "object" ? capture : {};
  return {
    ok: true,
    source: "queue",
    queueId: String(item?.id || "").trim(),
    slotIndex: Number.isFinite(payload?.slotIndex) ? Number(payload.slotIndex) : -1,
    role: payload?.role ? String(payload.role) : "",
    captureKind: normalizedKind,
    actionType: normalizedActionType,
    capturedAt: Number(safeCapture?.capturedAt) || Date.now(),
    image: {
      filePath: String(safeCapture?.filePath || "").trim(),
      sourceRefKey: String(safeCapture?.sourceRefKey || "").trim(),
      mimeType: String(safeCapture?.mimeType || "image/png"),
      width: Number(safeCapture?.width) || undefined,
      height: Number(safeCapture?.height) || undefined,
      targetRect: safeCapture?.targetRect || null,
      targetRectNorm: safeCapture?.targetRectNorm || null,
      targetCanvas: safeCapture?.targetCanvas || null,
      documentId: Number(safeCapture?.documentId) || undefined,
      documentName: safeCapture?.documentName ? String(safeCapture.documentName) : undefined,
      documentMode: safeCapture?.documentMode ? String(safeCapture.documentMode) : undefined,
      bitsPerChannel: Number.isFinite(safeCapture?.bitsPerChannel)
        ? Number(safeCapture.bitsPerChannel)
        : undefined,
      captureMeta:
        safeCapture?.captureMeta && typeof safeCapture.captureMeta === "object"
          ? { ...safeCapture.captureMeta }
          : undefined
    }
  };
}

async function handleQueueItem(item) {
  const type = String(item?.type || "").trim();
  const actionType = normalizeQueueActionType(item?.actionType || type);
  const payload = item?.payload && typeof item.payload === "object" ? item.payload : {};
  const captureOptions = normalizeCaptureEncodeOptions(payload?.captureOptions || {});
  appendLog("info", `收到队列命令：${type || "未知"} (${actionType || "未知"})`);

  if (type === "reconnect" || actionType === "reconnect") {
    await postHeartbeat("queue-reconnect");
    appendLog("success", "已响应重连命令");
    return;
  }

  if (actionType === "capture-selection") {
    const capture = await captureSelectionData(captureOptions);
    const queueCaptureResultPayload = buildQueueCaptureResultPayload(
      "selection",
      capture,
      item,
      payload,
    );
    await reportQueueResult(
      item?.id,
      "done",
      queueCaptureResultPayload,
      actionType,
    );
    appendLog("success", `已执行抓图命令（${type || actionType}）`);
    return;
  }

  if (actionType === "capture-canvas") {
    const capture = await captureCanvasData(captureOptions);
    const queueCaptureResultPayload = buildQueueCaptureResultPayload(
      "canvas",
      capture,
      item,
      payload,
    );
    await reportQueueResult(
      item?.id,
      "done",
      queueCaptureResultPayload,
      actionType,
    );
    appendLog("success", `已执行抓图命令（${type || actionType}）`);
    return;
  }

  if (actionType === "import-image") {
    const dataUrl = String(payload?.dataUrl || payload?.imageDataUrl || "").trim();
    if (!dataUrl) throw new Error("回传命令缺少 dataUrl");
    const returnFileName = String(payload?.returnFileName || "").trim();
    const returnIndexRaw = Number(payload?.returnIndex);
    const returnIndex =
      Number.isFinite(returnIndexRaw) && returnIndexRaw >= 0
        ? Math.floor(returnIndexRaw)
        : undefined;
    const returnTargetSignature = String(payload?.returnTargetSignature || "").trim();
    const importTraceLabelParts = [];
    returnIndex >= 0 && importTraceLabelParts.push(`#${returnIndex + 1}`);
    returnFileName && importTraceLabelParts.push(returnFileName);
    returnTargetSignature && importTraceLabelParts.push(`[${returnTargetSignature}]`);
    const importTraceLabel = importTraceLabelParts.join(" ");
    const importResult = await importDataUrlToCurrentDocument(dataUrl, {
      targetRect: payload?.targetRect || null,
      targetRectNorm: payload?.targetRectNorm || null,
      targetCanvas: payload?.targetCanvas || null,
      targetDocumentId: payload?.targetDocumentId || null,
      targetDocumentName: payload?.targetDocumentName || "",
      returnFileName,
      returnIndex,
      returnTargetSignature,
      layerType: payload?.layerType || "smart-object"
    });
    if (importResult?.ok === false) {
      await reportQueueResult(
        item?.id,
        "error",
        {
          ok: false,
          queueId: String(item?.id || "").trim(),
          actionType: "import-image",
          errorCode: String(importResult?.errorCode || "target_document_required"),
          message: String(importResult?.message || "target_document_required"),
          requestedDocumentId: Number(importResult?.requestedDocumentId) || undefined,
          requestedDocumentName: String(importResult?.requestedDocumentName || ""),
          returnFileName: returnFileName || undefined,
          returnIndex,
          returnTargetSignature: returnTargetSignature || undefined,
          activeDocumentId: Number(importResult?.activeDocumentId) || undefined,
          activeDocumentName: String(importResult?.activeDocumentName || ""),
          openDocuments: Array.isArray(importResult?.openDocuments)
            ? importResult.openDocuments
            : []
        },
        actionType,
      );
      appendLog(
        "warn",
        `${String(importResult?.message || "目标文档未解析")}${importTraceLabel ? ` ${importTraceLabel}` : ""}`,
      );
      return;
    }
    await reportQueueResult(
      item?.id,
      "done",
      {
        ok: true,
        queueId: String(item?.id || "").trim(),
        actionType: "import-image",
        layerType: String(payload?.layerType || "smart-object"),
        documentId: Number(importResult?.documentId) || undefined,
        documentName: importResult?.documentName ? String(importResult.documentName) : undefined,
        returnFileName: importResult?.returnFileName
          ? String(importResult.returnFileName)
          : undefined,
        returnIndex:
          Number.isFinite(importResult?.returnIndex) && Number(importResult.returnIndex) >= 0
            ? Math.floor(Number(importResult.returnIndex))
            : undefined,
        returnTargetSignature: importResult?.returnTargetSignature
          ? String(importResult.returnTargetSignature)
          : undefined,
        layerId: Number(importResult?.layerId) || undefined,
        layerName: importResult?.layerName ? String(importResult.layerName) : undefined,
        targetRect: importResult?.targetRect || null,
        targetRectNorm: importResult?.targetRectNorm || null,
        targetCanvas: importResult?.targetCanvas || null,
        layerBounds: importResult?.layerBounds || null
      },
      actionType,
    );
    appendLog(
      "success",
      `已执行回传命令（${type || actionType}）${importTraceLabel ? ` ${importTraceLabel}` : ""}`,
    );
    return;
  }

  appendLog("warn", `未处理的命令类型：${type || "空"} (${actionType || "未知"})`);
}

async function pollQueueOnce() {
  if (state.queueBusy) return;
  state.queueBusy = true;
  try {
    let next = null;
    try {
      next = await requestJson(`/queue/next?waitMs=${QUEUE_LONG_POLL_TIMEOUT_MS}`, {
        method: "GET",
        timeoutMs: QUEUE_LONG_POLL_TIMEOUT_MS + 5000
      });
    } catch (err) {
      if (err && typeof err === "object") err.__bridgeRequest = true;
      throw err;
    }
    if (!next || !next.id) return;
    try {
      await handleQueueItem(next);
    } catch (err) {
      const message = String(err?.message || err || "queue_item_failed");
      const actionType = normalizeQueueActionType(next?.actionType || next?.type || "");
      const typedMessage = `[${actionType || "unknown"}] ${message}`;
      const errorCode = (
        actionType === "capture-selection"
        && /no[\s_-]*active[\s_-]*selection|selection[_\s-]*not[_\s-]*found|no[\s_-]*selection/i.test(message)
      )
        ? "no_selection"
        : "";
      await reportQueueResult(next?.id, "error", {
        ok: false,
        errorCode,
        actionType,
        message: typedMessage,
        error: typedMessage,
        source: "ps-plugin-uxp",
        scene: "queue"
      }, actionType);
      appendLog("error", typedMessage, "", { syncToBridge: true, scene: "queue" });
    }
  } finally {
    state.queueBusy = false;
  }
}

function normalizeBridgeErrorMessage(rawMessage) {
  const message = String(rawMessage || "").trim();
  if (!message) return "桥接连接失败";
  const permissionDenied = message.match(/Permission denied to the url\s+([^\s]+)\.\s*Manifest entry not found\./i);
  if (permissionDenied) {
    let blockedTarget = permissionDenied[1];
    try {
      blockedTarget = new URL(blockedTarget).origin;
    } catch (_) {}
    return `无权访问桥接地址（${blockedTarget}）。请检查插件 manifest 的 network.domains 后重载插件。`;
  }
  return message;
}

function setBridgeError(err) {
  const rawMessage = String(err?.message || err || "bridge 连接失败");
  const message = normalizeBridgeErrorMessage(rawMessage);
  if (state.bridgeConnected) {
    state.bridgeConnected = false;
    void reportPluginLog("warn", "插件连接中断", message, { scene: "bridge" });
  }
  setStatusChip("error", "连接失败");
  if (message !== state.lastBridgeErrorKey) {
    appendLog("error", message, "", { scene: "bridge" });
    state.lastBridgeError = rawMessage;
    state.lastBridgeErrorKey = message;
  }
}

function clearBridgeError() {
  state.lastBridgeError = "";
  state.lastBridgeErrorKey = "";
}

async function heartbeatOnce(source) {
  await postHeartbeat(source);
  clearBridgeError();
  if (!state.bridgeConnected) {
    state.bridgeConnected = true;
    void reportPluginLog("info", "插件已连接", `bridge: ${getBridgeBase()}`, { scene: "bridge" });
  }
  setStatusChip("ok", "已连接");
}

function startBackgroundTasks() {
  if (state.started) return;
  state.started = true;
  appendLog("info", `插件构建：${PLUGIN_BUILD_TAG}`);
  PLUGIN_REVISION && appendLog("info", `插件修订：${PLUGIN_REVISION}`);
  appendLog("info", `桥接地址：${getBridgeBase()}`);

  const heartbeatTick = async () => {
    if (state.heartbeatBusy) return;
    state.heartbeatBusy = true;
    try {
      await heartbeatOnce("auto");
    } catch (err) {
      setBridgeError(err);
    } finally {
      state.heartbeatBusy = false;
    }
  };

  const queueTick = async () => {
    try {
      await pollQueueOnce();
    } catch (err) {
      if (err && typeof err === "object" && err.__bridgeRequest) {
        setBridgeError(err);
      } else {
        appendLog("error", String(err?.message || err || "queue_tick_failed"), "", {
          syncToBridge: true,
          scene: "queue"
        });
      }
    }
  };

  state.heartbeatTimer = setInterval(() => {
    heartbeatTick();
  }, HEARTBEAT_INTERVAL_MS);

  const loopToken = ++state.queueLoopToken;
  state.queueLoopTask = (async () => {
    while (state.started && state.queueLoopToken === loopToken) {
      await queueTick();
      if (!state.started || state.queueLoopToken !== loopToken) break;
      if (!state.bridgeConnected) {
        await new Promise((resolve) => setTimeout(resolve, QUEUE_RETRY_DELAY_MS));
      }
    }
  })();

  heartbeatTick();
}

function stopBackgroundTasks() {
  if (state.heartbeatTimer) {
    clearInterval(state.heartbeatTimer);
    state.heartbeatTimer = null;
  }
  state.queueLoopTask = null;
  state.heartbeatBusy = false;
  state.queueBusy = false;
  state.queueLoopToken += 1;
  state.started = false;
}

function bindUi() {
  ui.portInput = document.getElementById("bridgePort");
  ui.applyPortBtn = document.getElementById("applyPortBtn");
  ui.heartbeatBtn = document.getElementById("heartbeatBtn");
  ui.captureSelectionBtn = document.getElementById("captureSelectionBtn");
  ui.captureCanvasBtn = document.getElementById("captureCanvasBtn");
  ui.importDataInput = document.getElementById("importDataInput");
  ui.importToPsBtn = document.getElementById("importToPsBtn");
  ui.statusChip = document.getElementById("statusChip");
  ui.copyLogsBtn = document.getElementById("copyLogsBtn");
  ui.exportLogsBtn = document.getElementById("exportLogsBtn");
  ui.logSinkHint = document.getElementById("logSinkHint");
  ui.pluginLogPanel = document.getElementById("pluginLogPanel");
  ui.pluginBuildMeta = document.getElementById("pluginBuildMeta");
  renderBuildIdentity();
}

function bindEvents() {
  ui.applyPortBtn?.addEventListener("click", () => {
    const nextPort = parsePort(ui.portInput?.value, state.bridgePort);
    state.bridgePort = nextPort;
    if (ui.portInput) ui.portInput.value = String(nextPort);
    saveConfig();
    updateLogSinkHint();
    appendLog("info", `桥接地址：${getBridgeBase()}`);
    stopBackgroundTasks();
    startBackgroundTasks();
  });

  ui.heartbeatBtn?.addEventListener("click", async () => {
    try {
      await heartbeatOnce("manual");
      appendLog("success", "手动心跳成功");
    } catch (err) {
      setBridgeError(err);
    }
  });

  ui.captureSelectionBtn?.addEventListener("click", async () => {
    try {
      await runCaptureSelection("manual");
    } catch (err) {
      appendLog("error", `上传选区失败: ${String(err?.message || err)}`);
    }
  });

  ui.captureCanvasBtn?.addEventListener("click", async () => {
    try {
      await runCaptureCanvas("manual");
    } catch (err) {
      appendLog("error", `上传全图失败: ${String(err?.message || err)}`);
    }
  });

  ui.importToPsBtn?.addEventListener("click", async () => {
    const value = String(ui.importDataInput?.value || "").trim();
    if (!value) {
      appendLog("warn", "请先粘贴 dataUrl/base64");
      return;
    }
    try {
      await importDataUrlToCurrentDocument(value);
      await reportImport({ source: "manual", ok: true });
      appendLog("success", "回传完成");
    } catch (err) {
      appendLog("error", `回传失败: ${String(err?.message || err)}`);
    }
  });

  ui.copyLogsBtn?.addEventListener("click", async () => {
    try {
      await copyUiLogs();
    } catch (err) {
      appendLog("error", `复制插件日志失败: ${String(err?.message || err)}`);
    }
  });

  ui.exportLogsBtn?.addEventListener("click", async () => {
    try {
      await exportUiLogs();
    } catch (err) {
      appendLog("error", `导出插件日志失败: ${String(err?.message || err)}`);
    }
  });
}

let runtimeInitialized = false;
let uiInitialized = false;

function ensureRuntimeStarted() {
  if (runtimeInitialized) return;
  runtimeInitialized = true;
  loadConfig();
  appendLog(
    "info",
    "插件已启动（" +
      [PLUGIN_BUILD_TAG, PLUGIN_REVISION].filter(Boolean).join(" / ") +
      "）",
  );
  setStatusChip("warn", "等待连接");
  startBackgroundTasks();
}

function initUi() {
  bindUi();
  if (ui.portInput) ui.portInput.value = String(state.bridgePort);
  updateLogSinkHint();
  renderUiLogs();
  if (!uiInitialized) {
    bindEvents();
    uiInitialized = true;
  }
  if (ui.statusChip) {
    const currentStatusText = String(state.statusText || "等待连接");
    const statusMode = state.bridgeConnected
      ? "ok"
      : state.lastBridgeErrorKey
        ? "error"
        : "warn";
    setStatusChip(statusMode, currentStatusText);
  }
}

ensureRuntimeStarted();
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initUi);
} else {
  initUi();
}
window.addEventListener("beforeunload", stopBackgroundTasks);


