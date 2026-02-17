import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: "30mb" }));

const queue = [];
const queueResults = new Map();
const QUEUE_RESULT_TTL_MS = 2 * 60 * 1000;
const QUEUE_NEXT_WAIT_MAX_MS = 30 * 1000;
const QUEUE_RESULT_WAIT_MAX_MS = 30 * 1000;
const PS_HEARTBEAT_TIMEOUT_MS = 4000;
const PS_PLUGIN_LOG_LIMIT = 200;
const EVENT_STREAM_HEARTBEAT_MS = 15 * 1000;
const EVENT_STREAM_BUFFER_LIMIT = 300;
let psLastSeenAt = 0;
let activeChat = null;
let psPluginLogSeq = 0;
const psPluginLogs = [];
const queueNextWaiters = [];
const queueResultWaiters = new Map();
const eventClients = new Map();
const eventBuffer = [];
let eventSeq = 0;
let eventClientSeq = 0;
let psConnectedSnapshot = false;

const DATA_DIR = path.join(__dirname, "data");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");
const CHAT_HISTORY_FILE = path.join(DATA_DIR, "chat-history.json");
const CAPTURE_CACHE_DIR = path.join(DATA_DIR, "ps-capture-cache");
const CAPTURE_COMM_DIR = path.join(DATA_DIR, "ps-capture-comm");
const CAPTURE_FILE_TTL_MS = 10 * 60 * 1000;

const defaultSettings = {
  chat: {
    providerMode: "openai-compat",
    baseUrl: "",
    apiKey: "",
    model: "gemini-2.5-flash",
    timeoutMs: 120000,
    contextCount: 20,
    maxTokens: 4096,
    systemPrompt: "",
    temperature: 0.7,
    topP: 1,
    presencePenalty: 0,
    frequencyPenalty: 0
  },
  image: {
    providerMode: "openai-compat",
    baseUrl: "",
    apiKey: "",
    model: "",
    timeoutMs: 180000
  }
};

function markPsSeen() {
  psLastSeenAt = Date.now();
  syncPsConnectionState();
}

function pruneQueueResults(now = Date.now()) {
  for (const [id, entry] of queueResults.entries()) {
    if (!entry || !Number.isFinite(entry.expiresAt) || entry.expiresAt <= now) {
      queueResults.delete(id);
    }
  }
}

function clampWaitMs(value, maxMs) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(Math.max(1, Math.floor(n)), maxMs);
}

function writeSseEvent(res, event) {
  res.write(`id: ${event.id}\n`);
  res.write(`event: ${event.type}\n`);
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

function pushBridgeEvent(type, payload = {}) {
  const event = {
    id: ++eventSeq,
    type: String(type || "bridge.event"),
    at: Date.now(),
    payload: payload && typeof payload === "object" ? payload : {}
  };
  eventBuffer.push(event);
  if (eventBuffer.length > EVENT_STREAM_BUFFER_LIMIT) {
    eventBuffer.splice(0, eventBuffer.length - EVENT_STREAM_BUFFER_LIMIT);
  }
  for (const client of eventClients.values()) {
    try {
      writeSseEvent(client.res, event);
    } catch (_) {}
  }
  return event;
}

function getQueueItem() {
  if (!queue.length) return null;
  return queue.shift();
}

function dispatchQueueItem(item) {
  if (!item || !item.id) return;
  pushBridgeEvent("queue.dispatched", {
    id: String(item.id),
    type: String(item.type || ""),
    queueSize: queue.length
  });
}

function flushQueueNextWaiters() {
  while (queueNextWaiters.length > 0 && queue.length > 0) {
    const waiter = queueNextWaiters.shift();
    if (!waiter || waiter.closed) continue;
    waiter.closed = true;
    if (waiter.timer) clearTimeout(waiter.timer);
    const item = getQueueItem();
    if (!item) {
      try {
        waiter.res.json({ id: null });
      } catch (_) {}
      continue;
    }
    dispatchQueueItem(item);
    try {
      waiter.res.json(item);
    } catch (_) {}
  }
}

function removeQueueNextWaiter(target) {
  const idx = queueNextWaiters.indexOf(target);
  if (idx >= 0) queueNextWaiters.splice(idx, 1);
}

function enqueueQueueItem(type, payload = {}) {
  const item = {
    id: `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: String(type || "").trim(),
    payload: payload && typeof payload === "object" ? payload : {}
  };
  queue.push(item);
  pushBridgeEvent("queue.enqueued", {
    id: item.id,
    type: item.type,
    queueSize: queue.length
  });
  flushQueueNextWaiters();
  return item;
}

function removeQueueResultWaiter(id, target) {
  const list = queueResultWaiters.get(id);
  if (!list || !list.length) return;
  const idx = list.indexOf(target);
  if (idx >= 0) list.splice(idx, 1);
  if (!list.length) queueResultWaiters.delete(id);
}

function settleQueueResultWaiters(id, entry) {
  const waiters = queueResultWaiters.get(id);
  if (!waiters || !waiters.length) return;
  queueResultWaiters.delete(id);
  queueResults.delete(id);
  for (const waiter of waiters) {
    if (!waiter || waiter.closed) continue;
    waiter.closed = true;
    if (waiter.timer) clearTimeout(waiter.timer);
    try {
      waiter.res.json({
        ok: true,
        id,
        status: entry?.status || "done",
        result: entry
      });
    } catch (_) {}
  }
}

function syncPsConnectionState(force = false) {
  const connected = isPsConnected();
  if (!force && connected === psConnectedSnapshot) return;
  psConnectedSnapshot = connected;
  pushBridgeEvent("ps.connection", {
    connected,
    at: Date.now()
  });
}

function setQueueResult(queueId, payload = {}) {
  const id = String(queueId || "").trim();
  if (!id) return;
  const now = Date.now();
  const entry = {
    id,
    status: String(payload?.status || "done"),
    payload: payload?.payload !== undefined ? payload.payload : payload,
    updatedAt: now,
    expiresAt: now + QUEUE_RESULT_TTL_MS
  };
  queueResults.set(id, entry);
  pushBridgeEvent("queue.result", {
    id,
    status: entry.status
  });
  settleQueueResultWaiters(id, entry);
}

function isPsConnected() {
  if (!psLastSeenAt) return false;
  return Date.now() - psLastSeenAt <= PS_HEARTBEAT_TIMEOUT_MS;
}

function pushPsPluginLog(rawEntry = {}) {
  const level = String(rawEntry?.level || "info").trim().toLowerCase();
  const message = String(rawEntry?.message || "").trim();
  const detail = String(rawEntry?.detail || "").trim();
  const scene = String(rawEntry?.scene || "").trim();
  if (!message && !detail) return null;
  const next = {
    id: ++psPluginLogSeq,
    level,
    message,
    detail,
    scene,
    source: String(rawEntry?.source || "ps-plugin").trim(),
    at: Number.isFinite(Number(rawEntry?.at)) ? Number(rawEntry.at) : Date.now()
  };
  psPluginLogs.push(next);
  if (psPluginLogs.length > PS_PLUGIN_LOG_LIMIT) {
    psPluginLogs.splice(0, psPluginLogs.length - PS_PLUGIN_LOG_LIMIT);
  }
  pushBridgeEvent("ps.log", next);
  return next;
}

function ensureCaptureDirs() {
  fs.mkdirSync(CAPTURE_CACHE_DIR, { recursive: true });
  fs.mkdirSync(CAPTURE_COMM_DIR, { recursive: true });
}

function cleanupCaptureFilesByAge(dir, maxAgeMs, now = Date.now()) {
  try {
    if (!fs.existsSync(dir)) return;
    const list = fs.readdirSync(dir);
    list.forEach((name) => {
      const fullPath = path.join(dir, name);
      try {
        const stat = fs.statSync(fullPath);
        if (!stat.isFile()) return;
        const age = now - Math.max(stat.mtimeMs || 0, stat.ctimeMs || 0);
        if (age > maxAgeMs) fs.unlinkSync(fullPath);
      } catch (_) {}
    });
  } catch (_) {}
}

function pruneCaptureFiles(now = Date.now()) {
  cleanupCaptureFilesByAge(CAPTURE_CACHE_DIR, CAPTURE_FILE_TTL_MS, now);
  cleanupCaptureFilesByAge(CAPTURE_COMM_DIR, CAPTURE_FILE_TTL_MS, now);
}

function getExtByMimeType(mime) {
  const m = String(mime || "").toLowerCase();
  if (m.includes("png")) return "png";
  if (m.includes("webp")) return "webp";
  if (m.includes("gif")) return "gif";
  if (m.includes("bmp")) return "bmp";
  if (m.includes("svg")) return "svg";
  if (m.includes("jpeg") || m.includes("jpg")) return "jpg";
  return "bin";
}

function getMimeTypeByExt(filePath) {
  const ext = String(path.extname(String(filePath || "")) || "").toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  if (ext === ".bmp") return "image/bmp";
  if (ext === ".svg") return "image/svg+xml";
  return "application/octet-stream";
}

function normalizeTargetRect(input) {
  if (!input || typeof input !== "object") return null;
  const left = Number(input.left);
  const top = Number(input.top);
  const width = Number(input.width);
  const height = Number(input.height);
  let safeWidth = width;
  let safeHeight = height;
  if ((!Number.isFinite(safeWidth) || !Number.isFinite(safeHeight))
    && Number.isFinite(Number(input.right))
    && Number.isFinite(Number(input.bottom))
    && Number.isFinite(left)
    && Number.isFinite(top)) {
    safeWidth = Number(input.right) - left;
    safeHeight = Number(input.bottom) - top;
  }
  if (!Number.isFinite(left) || !Number.isFinite(top) || !Number.isFinite(safeWidth) || !Number.isFinite(safeHeight)) {
    return null;
  }
  if (safeWidth <= 0 || safeHeight <= 0) return null;
  const rectLeft = Math.round(left);
  const rectTop = Math.round(top);
  const rectWidth = Math.max(1, Math.round(safeWidth));
  const rectHeight = Math.max(1, Math.round(safeHeight));
  return {
    left: rectLeft,
    top: rectTop,
    width: rectWidth,
    height: rectHeight,
    right: rectLeft + rectWidth,
    bottom: rectTop + rectHeight
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
  if ((width === null || height === null)
    && Number.isFinite(Number(input.right))
    && Number.isFinite(Number(input.bottom))
    && left !== null
    && top !== null) {
    width = Number(input.right) - left;
    height = Number(input.bottom) - top;
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

function deriveTargetRectNorm(targetRect, targetCanvas) {
  if (!targetRect || !targetCanvas) return null;
  const width = Number(targetCanvas.width);
  const height = Number(targetCanvas.height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return normalizeTargetRectNorm({
    left: targetRect.left / width,
    top: targetRect.top / height,
    width: targetRect.width / width,
    height: targetRect.height / height
  });
}

function normalizeCaptureFilePath(inputPath) {
  const raw = String(inputPath || "").trim();
  if (!raw) return "";
  if (/^file:\/\//i.test(raw)) {
    try {
      const u = new URL(raw);
      let pathname = decodeURIComponent(u.pathname || "");
      if (/^\/[A-Za-z]:/.test(pathname)) pathname = pathname.slice(1);
      return pathname;
    } catch (_) {}
  }
  return raw;
}

function resolveCaptureImageBinary(image = {}) {
  const candidateFilePath = normalizeCaptureFilePath(
    image?.filePath || image?.nativePath || image?.path || ""
  );
  if (candidateFilePath) {
    if (!fs.existsSync(candidateFilePath)) {
      throw new Error(`capture_file_missing:${candidateFilePath}`);
    }
    const stat = fs.statSync(candidateFilePath);
    if (!stat.isFile()) {
      throw new Error(`capture_file_invalid:${candidateFilePath}`);
    }
    const buffer = fs.readFileSync(candidateFilePath);
    if (!buffer?.length) {
      throw new Error(`capture_file_empty:${candidateFilePath}`);
    }
    return {
      buffer,
      mime: getMimeTypeByExt(candidateFilePath),
      sourceType: "file",
      sourcePath: candidateFilePath
    };
  }
  throw new Error("capture_file_path_required");
}

function sanitizeCaptureBaseName(input) {
  return String(input || "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 120) || `capture-${Date.now()}`;
}

function persistCaptureToCache(kind, body = {}) {
  const image = body?.image && typeof body.image === "object" ? body.image : {};
  const captureImage = resolveCaptureImageBinary(image);
  if (!captureImage || !captureImage.buffer?.length) {
    throw new Error("capture_file_buffer_empty");
  }

  ensureCaptureDirs();
  pruneCaptureFiles();

  const queueId = String(body?.queueId || `capture-${Date.now()}`).trim();
  const baseName = sanitizeCaptureBaseName(queueId || `${kind}-${Date.now()}`);
  const mimeType = String(image?.mimeType || image?.type || captureImage.mime || "image/png").trim();
  const ext = getExtByMimeType(mimeType);
  const targetRect = normalizeTargetRect(image?.targetRect || image?.selection);
  const targetCanvas = normalizeTargetCanvas(image?.targetCanvas);
  const targetRectNorm = normalizeTargetRectNorm(image?.targetRectNorm)
    || deriveTargetRectNorm(targetRect, targetCanvas);

  const imageFileName = `${baseName}.${ext}`;
  const imagePath = path.join(CAPTURE_CACHE_DIR, imageFileName);
  fs.writeFileSync(imagePath, captureImage.buffer);

  const commFileName = `${baseName}.json`;
  const commPath = path.join(CAPTURE_COMM_DIR, commFileName);
  const commPayload = {
    version: 1,
    queueId,
    action: String(kind || "capture"),
    createdAt: Date.now(),
    image: {
      fileName: imageFileName,
      filePath: imagePath,
      mimeType,
      width: Number(image?.width) || undefined,
      height: Number(image?.height) || undefined,
      sourceType: captureImage.sourceType || undefined,
      sourcePath: captureImage.sourcePath || undefined,
      selection: image?.selection || targetRect || null,
      targetRect: targetRect || null,
      targetRectNorm: targetRectNorm || null,
      targetCanvas: targetCanvas || null,
      documentId: Number(image?.documentId) || undefined,
      documentName: image?.documentName ? String(image.documentName) : undefined
    },
    bridge: {
      source: String(body?.source || "plugin"),
      role: body?.role ? String(body.role) : "",
      slotIndex: Number.isFinite(body?.slotIndex) ? Number(body.slotIndex) : -1,
      at: Number(body?.at) || Date.now()
    }
  };
  fs.writeFileSync(commPath, JSON.stringify(commPayload, null, 2), "utf8");

  return {
    commPath,
    commFileName,
    imagePath,
    imageFileName
  };
}

function ensureDataFiles() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  ensureCaptureDirs();
  pruneCaptureFiles();
  if (!fs.existsSync(SETTINGS_FILE)) {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(defaultSettings, null, 2), "utf8");
  }
  if (!fs.existsSync(CHAT_HISTORY_FILE)) {
    fs.writeFileSync(
      CHAT_HISTORY_FILE,
      JSON.stringify({ updatedAt: Date.now(), messages: [] }, null, 2),
      "utf8"
    );
  }
}

function safeReadJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    const raw = fs.readFileSync(file, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function safeWriteJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2), "utf8");
}

function readSettings() {
  const saved = safeReadJson(SETTINGS_FILE, defaultSettings);
  return {
    ...defaultSettings,
    ...saved,
    chat: { ...defaultSettings.chat, ...(saved?.chat || {}) },
    image: { ...defaultSettings.image, ...(saved?.image || {}) }
  };
}

function writeSettings(nextSettings) {
  const merged = {
    ...defaultSettings,
    ...nextSettings,
    chat: { ...defaultSettings.chat, ...(nextSettings?.chat || {}) },
    image: { ...defaultSettings.image, ...(nextSettings?.image || {}) }
  };
  safeWriteJson(SETTINGS_FILE, merged);
  return merged;
}

function readHistory() {
  const history = safeReadJson(CHAT_HISTORY_FILE, { updatedAt: Date.now(), messages: [] });
  if (!Array.isArray(history.messages)) history.messages = [];
  return history;
}

function writeHistory(history) {
  const next = {
    updatedAt: Date.now(),
    messages: Array.isArray(history?.messages) ? history.messages : []
  };
  safeWriteJson(CHAT_HISTORY_FILE, next);
  return next;
}

function normalizeBaseUrl(url) {
  const input = String(url || "").trim();
  if (!input) return "";
  const noSlash = input.replace(/\/+$/, "");
  return noSlash.endsWith("/v1") ? noSlash : `${noSlash}/v1`;
}

function extractAssistantText(data) {
  if (!data) return "";
  const choice = data?.choices?.[0];
  if (!choice) return "";
  const msg = choice.message;
  if (typeof msg?.content === "string") return msg.content;
  if (Array.isArray(msg?.content)) {
    return msg.content
      .map((part) => (typeof part?.text === "string" ? part.text : ""))
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

function tryParseJson(text) {
  if (!text) return null;
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    const candidate = fenced[1].trim();
    try {
      return JSON.parse(candidate);
    } catch {}
  }
  return null;
}

function toIsoTs() {
  return new Date().toISOString();
}

function mapHistoryToContext(history, contextCount) {
  const all = Array.isArray(history?.messages) ? history.messages : [];
  const done = all.filter((m) => m?.status !== "pending" && (m?.role === "user" || m?.role === "assistant"));
  const sliced = done.slice(-Math.max(0, contextCount));
  return sliced.map((m) => ({
    role: m.role,
    content: String(m.text || "")
  }));
}

function buildUserContent(text, images) {
  const safeText = String(text || "").trim();
  const safeImages = Array.isArray(images) ? images : [];
  if (!safeImages.length) return safeText;
  const content = [];
  if (safeText) content.push({ type: "text", text: safeText });
  for (const item of safeImages) {
    if (!item?.dataUrl || typeof item.dataUrl !== "string") continue;
    content.push({
      type: "image_url",
      image_url: { url: item.dataUrl }
    });
  }
  return content;
}

function nowId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

app.get("/status", (req, res) => {
  res.json({
    ok: true,
    psConnected: isPsConnected(),
    queueSize: queue.length,
    psLastSeenAt,
    psPluginLogLatestId: psPluginLogSeq,
    heartbeatTimeoutMs: PS_HEARTBEAT_TIMEOUT_MS,
    chatBusy: !!activeChat
  });
});

app.get("/queue/next", (req, res) => {
  const next = getQueueItem();
  if (next) {
    dispatchQueueItem(next);
    return res.json(next);
  }
  const waitMs = clampWaitMs(req.query?.waitMs, QUEUE_NEXT_WAIT_MAX_MS);
  if (waitMs <= 0) return res.json({ id: null });
  const waiter = { res, timer: null, closed: false };
  if (waitMs > 0) {
    waiter.timer = setTimeout(() => {
      if (waiter.closed) return;
      waiter.closed = true;
      removeQueueNextWaiter(waiter);
      try {
        res.json({ id: null });
      } catch (_) {}
    }, waitMs);
  }
  queueNextWaiters.push(waiter);
  req.on("close", () => {
    waiter.closed = true;
    if (waiter.timer) clearTimeout(waiter.timer);
    removeQueueNextWaiter(waiter);
  });
});

app.post("/queue", (req, res) => {
  const { type, payload } = req.body || {};
  if (!type) return res.status(400).json({ ok: false, error: "type_required" });
  const item = enqueueQueueItem(type, payload || {});
  res.json({ ok: true, item });
});

app.get("/queue/result/:id", (req, res) => {
  pruneQueueResults();
  const id = String(req.params?.id || "").trim();
  if (!id) {
    return res.status(400).json({ ok: false, error: "id_required", message: "id 必填" });
  }
  const entry = queueResults.get(id);
  if (!entry) {
    return res.json({ ok: true, id, status: "pending" });
  }
  queueResults.delete(id);
  return res.json({
    ok: true,
    id,
    status: entry.status || "done",
    result: entry
  });
});

app.get("/queue/result/:id/wait", (req, res) => {
  pruneQueueResults();
  const id = String(req.params?.id || "").trim();
  if (!id) {
    return res.status(400).json({ ok: false, error: "id_required", message: "id 蹇呭～" });
  }
  const waitMs = clampWaitMs(req.query?.timeoutMs ?? req.query?.waitMs, QUEUE_RESULT_WAIT_MAX_MS);
  const entry = queueResults.get(id);
  if (entry) {
    queueResults.delete(id);
    return res.json({
      ok: true,
      id,
      status: entry.status || "done",
      result: entry
    });
  }
  if (waitMs <= 0) {
    return res.json({ ok: true, id, status: "pending" });
  }
  const waiter = { res, timer: null, closed: false };
  const list = queueResultWaiters.get(id) || [];
  list.push(waiter);
  queueResultWaiters.set(id, list);
  waiter.timer = setTimeout(() => {
    if (waiter.closed) return;
    waiter.closed = true;
    removeQueueResultWaiter(id, waiter);
    try {
      res.json({ ok: true, id, status: "pending" });
    } catch (_) {}
  }, waitMs);
  req.on("close", () => {
    waiter.closed = true;
    if (waiter.timer) clearTimeout(waiter.timer);
    removeQueueResultWaiter(id, waiter);
  });
});

app.post("/queue/result", (req, res) => {
  const body = req.body || {};
  const id = String(body?.id || "").trim();
  if (!id) {
    return res.status(400).json({ ok: false, error: "id_required", message: "id 必填" });
  }
  const status = String(body?.status || "done").trim() || "done";
  const payload = body?.payload !== undefined ? body.payload : {};
  setQueueResult(id, { status, payload });
  return res.json({ ok: true, id, status });
});

app.get("/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  if (typeof res.flushHeaders === "function") res.flushHeaders();
  res.write(": connected\n\n");

  const clientId = ++eventClientSeq;
  const heartbeat = setInterval(() => {
    try {
      res.write(`: hb ${Date.now()}\n\n`);
    } catch (_) {}
  }, EVENT_STREAM_HEARTBEAT_MS);

  eventClients.set(clientId, { res, heartbeat });

  const since = Number(req.query?.since);
  const sinceId = Number.isFinite(since) ? Math.floor(since) : 0;
  const replay = sinceId > 0
    ? eventBuffer.filter((item) => Number(item?.id) > sinceId)
    : [];
  for (const item of replay) {
    try {
      writeSseEvent(res, item);
    } catch (_) {}
  }

  req.on("close", () => {
    clearInterval(heartbeat);
    eventClients.delete(clientId);
  });
});

app.post("/ps/selection", (req, res) => {
  markPsSeen();
  const body = req.body || {};
  let persisted = null;
  let persistError = "";
  try {
    persisted = persistCaptureToCache("selection", body);
  } catch (err) {
    persistError = String(err?.message || err || "capture_cache_persist_failed");
    pushPsPluginLog({
      level: "warn",
      scene: "capture-cache",
      source: "bridge",
      message: "selection capture cache persist failed",
      detail: persistError,
      at: Date.now()
    });
  }
  if (body?.queueId) {
    const payload = persisted
      ? {
          ...body,
          image: body?.image && typeof body.image === "object"
            ? (() => {
                const next = { ...body.image };
                delete next.dataUrl;
                return next;
              })()
            : body?.image,
          captureKind: "selection",
          captureCommPath: persisted.commPath,
          captureCommFile: persisted.commFileName,
          captureImagePath: persisted.imagePath,
          captureImageFile: persisted.imageFileName
        }
      : {
          ...body,
          captureKind: "selection",
          captureCommError: persistError || undefined
        };
    setQueueResult(body.queueId, {
      status: "done",
      payload
    });
  }
  res.json({
    ok: true,
    captureCommPath: persisted?.commPath || null,
    captureCommError: persistError || ""
  });
});

app.post("/ps/canvas", (req, res) => {
  markPsSeen();
  const body = req.body || {};
  let persisted = null;
  let persistError = "";
  try {
    persisted = persistCaptureToCache("canvas", body);
  } catch (err) {
    persistError = String(err?.message || err || "capture_cache_persist_failed");
    pushPsPluginLog({
      level: "warn",
      scene: "capture-cache",
      source: "bridge",
      message: "canvas capture cache persist failed",
      detail: persistError,
      at: Date.now()
    });
  }
  if (body?.queueId) {
    const payload = persisted
      ? {
          ...body,
          image: body?.image && typeof body.image === "object"
            ? (() => {
                const next = { ...body.image };
                delete next.dataUrl;
                return next;
              })()
            : body?.image,
          captureKind: "canvas",
          captureCommPath: persisted.commPath,
          captureCommFile: persisted.commFileName,
          captureImagePath: persisted.imagePath,
          captureImageFile: persisted.imageFileName
        }
      : {
          ...body,
          captureKind: "canvas",
          captureCommError: persistError || undefined
        };
    setQueueResult(body.queueId, {
      status: "done",
      payload
    });
  }
  res.json({
    ok: true,
    captureCommPath: persisted?.commPath || null,
    captureCommError: persistError || ""
  });
});

app.post("/ps/import", (req, res) => {
  markPsSeen();
  const body = req.body || {};
  if (body?.queueId) {
    setQueueResult(body.queueId, {
      status: body?.ok === false ? "error" : "done",
      payload: body
    });
  }
  res.json({ ok: true });
});

app.post("/ps/heartbeat", (req, res) => {
  markPsSeen();
  res.json({ ok: true });
});

app.post("/ps/log", (req, res) => {
  markPsSeen();
  const body = req.body || {};
  const saved = pushPsPluginLog(body);
  res.json({
    ok: true,
    log: saved,
    latestId: psPluginLogSeq
  });
});

app.get("/ps/logs", (req, res) => {
  const since = Number(req.query?.since);
  const startId = Number.isFinite(since) && since > 0 ? Math.floor(since) : 0;
  const logs = startId > 0 ? psPluginLogs.filter((item) => item.id > startId) : [...psPluginLogs];
  res.json({
    ok: true,
    logs,
    latestId: psPluginLogSeq
  });
});

app.post("/reconnect", (req, res) => {
  const item = enqueueQueueItem("reconnect", {});
  res.json({ ok: true, item });
});

app.post("/open-cache", (req, res) => {
  res.json({ ok: true });
});

app.get("/config", (req, res) => {
  const settings = readSettings();
  res.json({ ok: true, settings });
});

app.put("/config", (req, res) => {
  const incoming = req.body || {};
  const next = writeSettings(incoming);
  res.json({ ok: true, settings: next });
});

app.get("/chat/history", (req, res) => {
  const history = readHistory();
  res.json({ ok: true, history });
});

app.put("/chat/history", (req, res) => {
  const body = req.body || {};
  const list = Array.isArray(body.messages) ? body.messages : null;
  if (!list) {
    return res.status(400).json({ ok: false, error: "invalid_messages", message: "messages 必须是数组" });
  }
  const normalized = list
    .filter((m) => m && (m.role === "user" || m.role === "assistant"))
    .map((m, idx) => ({
      id: String(m.id || nowId(`import-${idx}`)),
      role: m.role,
      text: String(m.text || ""),
      images: Array.isArray(m.images) ? m.images : [],
      status: String(m.status || "done"),
      createdAt: m.createdAt || toIsoTs(),
      error: m.error ? String(m.error) : undefined,
      jsonPrompt: m.jsonPrompt || null
    }));
  const history = writeHistory({ messages: normalized });
  res.json({ ok: true, history });
});

app.delete("/chat/history", (req, res) => {
  const empty = writeHistory({ messages: [] });
  res.json({ ok: true, history: empty });
});

app.get("/chat/models", async (req, res) => {
  const settings = readSettings();
  const chatCfg = settings.chat || {};
  const baseUrl = normalizeBaseUrl(chatCfg.baseUrl);
  const apiKey = String(chatCfg.apiKey || "").trim();
  if (!baseUrl || !apiKey) {
    return res.status(400).json({
      ok: false,
      error: "chat_config_incomplete",
      message: "聊天 API 配置不完整（地址 / Key）"
    });
  }
  try {
    const response = await fetch(`${baseUrl}/models`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    });
    const raw = await response.text();
    let parsed = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      parsed = null;
    }
    if (!response.ok) {
      const message = parsed?.error?.message || parsed?.message || raw || `HTTP ${response.status}`;
      throw new Error(message);
    }
    const list = Array.isArray(parsed?.data) ? parsed.data : [];
    const models = list
      .map((m) => String(m?.id || "").trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
    return res.json({ ok: true, models });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "models_fetch_failed",
      message: String(err?.message || err)
    });
  }
});

app.post("/chat/stop", (req, res) => {
  if (!activeChat) return res.json({ ok: true, stopped: false });
  try {
    activeChat.controller.abort();
  } catch {}
  res.json({ ok: true, stopped: true });
});

app.post("/chat/send", async (req, res) => {
  if (activeChat) {
    return res.status(409).json({ ok: false, error: "chat_busy", message: "当前已有消息在生成中" });
  }

  const body = req.body || {};
  const text = String(body.text || "").trim();
  const images = Array.isArray(body.images) ? body.images : [];
  if (!text && !images.length) {
    return res.status(400).json({ ok: false, error: "empty_message", message: "文本和图片不能同时为空" });
  }

  const settings = readSettings();
  const chatCfg = settings.chat || {};
  const baseUrl = normalizeBaseUrl(chatCfg.baseUrl);
  const apiKey = String(chatCfg.apiKey || "").trim();
  const model = String(chatCfg.model || "").trim();

  if (!baseUrl || !apiKey || !model) {
    return res.status(400).json({
      ok: false,
      error: "chat_config_incomplete",
      message: "聊天 API 配置不完整（地址 / Key / 模型）"
    });
  }

  const history = readHistory();

  const userMsg = {
    id: nowId("msg-user"),
    role: "user",
    text,
    images,
    createdAt: toIsoTs(),
    status: "done"
  };

  const assistantMsg = {
    id: nowId("msg-assistant"),
    role: "assistant",
    text: "",
    createdAt: toIsoTs(),
    status: "pending"
  };

  history.messages.push(userMsg, assistantMsg);
  writeHistory(history);

  const controller = new AbortController();
  activeChat = { controller, startedAt: Date.now(), assistantId: assistantMsg.id };

  const timeoutMs = Math.max(5000, Number(chatCfg.timeoutMs) || 120000);
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  req.on("close", () => {
    if (!res.writableEnded) {
      try {
        controller.abort();
      } catch {}
    }
  });

  try {
    const contextMessages = mapHistoryToContext(history, Number(chatCfg.contextCount) || 20);
    const messages = [];

    if (chatCfg.systemPrompt && String(chatCfg.systemPrompt).trim()) {
      messages.push({ role: "system", content: String(chatCfg.systemPrompt).trim() });
    }

    for (const m of contextMessages) {
      if (!m?.content) continue;
      messages.push(m);
    }

    messages.push({ role: "user", content: buildUserContent(text, images) });

    const payload = {
      model,
      stream: false,
      messages,
      max_tokens: Number(chatCfg.maxTokens) || 4096
    };
    const temperature = Number(chatCfg.temperature);
    const topP = Number(chatCfg.topP);
    const presencePenalty = Number(chatCfg.presencePenalty);
    const frequencyPenalty = Number(chatCfg.frequencyPenalty);
    if (Number.isFinite(temperature)) payload.temperature = temperature;
    if (Number.isFinite(topP)) payload.top_p = topP;
    if (Number.isFinite(presencePenalty)) payload.presence_penalty = presencePenalty;
    if (Number.isFinite(frequencyPenalty)) payload.frequency_penalty = frequencyPenalty;

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    const raw = await response.text();
    let parsed = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      parsed = null;
    }

    if (!response.ok) {
      const message = parsed?.error?.message || parsed?.message || raw || `HTTP ${response.status}`;
      throw new Error(message);
    }

    const assistantText = extractAssistantText(parsed);
    const jsonPrompt = tryParseJson(assistantText);

    const latest = readHistory();
    const idx = latest.messages.findIndex((m) => m.id === assistantMsg.id);
    if (idx >= 0) {
      latest.messages[idx] = {
        ...latest.messages[idx],
        status: "done",
        text: assistantText,
        jsonPrompt
      };
      writeHistory(latest);
    }

    clearTimeout(timer);
    activeChat = null;
    return res.json({
      ok: true,
      assistant: {
        id: assistantMsg.id,
        text: assistantText,
        jsonPrompt
      },
      history: readHistory()
    });
  } catch (err) {
    clearTimeout(timer);
    const isAbort = err?.name === "AbortError";
    const latest = readHistory();
    const idx = latest.messages.findIndex((m) => m.id === assistantMsg.id);
    if (idx >= 0) {
      latest.messages[idx] = {
        ...latest.messages[idx],
        status: "error",
        text: isAbort ? "已停止生成" : "请求失败",
        error: isAbort ? "abort" : String(err?.message || err)
      };
      writeHistory(latest);
    }
    activeChat = null;
    return res.status(isAbort ? 499 : 500).json({
      ok: false,
      error: isAbort ? "aborted" : "chat_failed",
      message: isAbort ? "已停止生成" : String(err?.message || err)
    });
  }
});

ensureDataFiles();
syncPsConnectionState(true);
const psConnectionTicker = setInterval(() => {
  syncPsConnectionState();
}, 1000);
if (typeof psConnectionTicker.unref === "function") psConnectionTicker.unref();

const PORT = process.env.PORT || 17325;
const server = app.listen(PORT, "127.0.0.1", () => {
  console.log(`bridge server listening on http://127.0.0.1:${PORT}`);
});

const shutdown = () => {
  if (activeChat?.controller) {
    try {
      activeChat.controller.abort();
    } catch {}
  }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 1000).unref();
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
