"use strict";

const { app, core, action, imaging } = require("photoshop");
const { storage } = require("uxp");

const fs = storage.localFileSystem;

const STORAGE_KEY = "xiaodi.psBridge.config.v1";
const DEFAULT_BRIDGE_PORT = 17325;
const DEFAULT_BRIDGE_HOST = "localhost";
const HEARTBEAT_INTERVAL_MS = 1600;
const QUEUE_LONG_POLL_TIMEOUT_MS = 25000;
const QUEUE_RETRY_DELAY_MS = 1200;
const REQUEST_TIMEOUT_MS = 15000;
const MAX_CAPTURE_EDGE = 4096;
const PLUGIN_BUILD_TAG = "capture-v3-20260215-sdppp-chain";

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
};

const ui = {
  portInput: null,
  applyPortBtn: null,
  heartbeatBtn: null,
  captureSelectionBtn: null,
  captureCanvasBtn: null,
  importDataInput: null,
  importToPsBtn: null,
  statusChip: null
};

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
  if (normalizedLevel !== "error") return;
  if (options.syncToBridge === false) return;
  const normalizedMessage = String(message || "").trim();
  const normalizedDetail = String(detail || "").trim();
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
  if (!ui.statusChip) return;
  ui.statusChip.classList.remove("is-ok", "is-warn", "is-error");
  ui.statusChip.classList.add(
    mode === "ok" ? "is-ok" : mode === "error" ? "is-error" : "is-warn"
  );
  ui.statusChip.textContent = text;
  state.statusText = text;
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

async function selectDocumentById(documentId) {
  const safeId = Math.round(Number(documentId));
  if (!Number.isFinite(safeId) || safeId <= 0) return;
  if (Number(app.activeDocument?.id) === safeId) return;
  await action.batchPlay([
    {
      _obj: "select",
      _target: [{ _ref: "document", _id: safeId }]
    }
  ], {});
}

async function getDocumentSelectionRect(doc) {
  if (!doc) return null;
  await selectDocumentById(doc.id);
  try {
    const boundsRaw = doc.selection?.bounds;
    const bounds = normalizeSelectionBounds(boundsRaw);
    if (!bounds || bounds.isEmpty) return null;
    return normalizeTargetRect(bounds);
  } catch (_) {
    return null;
  }
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

function getScaledSizeWithinLimit(width, height, maxEdge = MAX_CAPTURE_EDGE) {
  const w = Math.max(1, Math.round(Number(width) || 1));
  const h = Math.max(1, Math.round(Number(height) || 1));
  if (w <= maxEdge && h <= maxEdge) return { width: w, height: h };
  if (w >= h) {
    return {
      width: maxEdge,
      height: Math.max(1, Math.round(h * (maxEdge / w)))
    };
  }
  return {
    width: Math.max(1, Math.round(w * (maxEdge / h))),
    height: maxEdge
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

function encodeRgbaToPngBytes(rgbaBytes, width, height) {
  const rgba = toUint8Array(rgbaBytes);
  if (!rgba || !rgba.byteLength) {
    throw new Error("rgba_payload_empty");
  }
  const safeWidth = Math.max(1, Math.round(Number(width) || 1));
  const safeHeight = Math.max(1, Math.round(Number(height) || 1));
  const expectedLen = safeWidth * safeHeight * 4;
  if (rgba.byteLength < expectedLen) {
    throw new Error(`rgba_payload_short:${rgba.byteLength}/${expectedLen}`);
  }

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

async function saveCaptureRgbaToTempFile(rgbaBytes, width, height, filePrefix = "xiaodi-capture") {
  const pngBytes = encodeRgbaToPngBytes(rgbaBytes, width, height);
  const tempFolder = await fs.getTemporaryFolder();
  const tempFile = await tempFolder.createFile(`${filePrefix}-${Date.now()}.png`, { overwrite: true });
  const binary = pngBytes.buffer.slice(pngBytes.byteOffset, pngBytes.byteOffset + pngBytes.byteLength);
  await tempFile.write(binary, { format: storage.formats.binary });
  const nativePath = String(tempFile?.nativePath || tempFile?.path || "").trim();
  return nativePath || null;
}

async function readDocumentRegionAsCaptureFile(documentId, bounds) {
  const left = Math.round(Number(bounds?.left) || 0);
  const top = Math.round(Number(bounds?.top) || 0);
  const right = Math.round(Number(bounds?.right) || 0);
  const bottom = Math.round(Number(bounds?.bottom) || 0);
  const sourceWidth = Math.max(1, right - left);
  const sourceHeight = Math.max(1, bottom - top);
  const targetSize = getScaledSizeWithinLimit(sourceWidth, sourceHeight, MAX_CAPTURE_EDGE);
  const pixels = await imaging.getPixels({
    documentID: Number(documentId),
    sourceBounds: { left, top, right, bottom },
    targetSize,
    colorSpace: "RGB",
    hasAlpha: true,
    applyAlpha: false
  });
  const imageData = pixels?.imageData;
  if (!imageData) throw new Error("getPixels returned no imageData");
  try {
    const width = Math.max(1, Math.round(Number(imageData.width) || targetSize.width));
    const height = Math.max(1, Math.round(Number(imageData.height) || targetSize.height));
    const rawPixels = await imageData.getData({});
    if (!rawPixels || !rawPixels.byteLength) {
      throw new Error("imageData_getData_empty");
    }
    const filePath = await saveCaptureRgbaToTempFile(rawPixels, width, height, "xiaodi-capture");
    if (!filePath) {
      throw new Error("capture_file_path_empty");
    }
    return {
      mimeType: "image/png",
      width,
      height,
      filePath: filePath || ""
    };
  } finally {
    try {
      imageData.dispose();
    } catch (_) {}
  }
}

async function closeDocSilently(doc) {
  if (!doc) return;
  try {
    await core.executeAsModal(async () => {
      await doc.closeWithoutSaving();
    }, { commandName: "Close temporary document" });
  } catch (_) {}
}

async function captureSelectionData() {
  let result = null;
  await core.executeAsModal(async () => {
    const activeDoc = app.activeDocument;
    if (!activeDoc) throw new Error("No active document");
    const targetCanvas = getDocumentCanvasSize(activeDoc);

    let boundsRaw = null;
    try {
      boundsRaw = activeDoc.selection.bounds;
    } catch (_) {
      throw new Error("no_selection");
    }
    const bounds = normalizeSelectionBounds(boundsRaw);
    if (!bounds || bounds.isEmpty) {
      throw new Error("no_selection");
    }
    const capture = await readDocumentRegionAsCaptureFile(activeDoc.id, bounds);
    const targetRect = normalizeTargetRect(bounds);
    const targetRectNorm = deriveTargetRectNorm(targetRect, targetCanvas);
    result = {
      filePath: capture.filePath || "",
      mimeType: capture.mimeType,
      width: capture.width,
      height: capture.height,
      targetRect,
      targetRectNorm,
      targetCanvas,
      documentId: activeDoc.id,
      documentName: String(activeDoc.title || "")
    };
  }, { commandName: "Capture selection image" });
  return result;
}

async function captureCanvasData() {
  let result = null;
  await core.executeAsModal(async () => {
    const activeDoc = app.activeDocument;
    if (!activeDoc) throw new Error("No active document");
    const docBounds = {
      left: 0,
      top: 0,
      right: Math.max(1, Math.round(toPx(activeDoc.width))),
      bottom: Math.max(1, Math.round(toPx(activeDoc.height)))
    };
    const capture = await readDocumentRegionAsCaptureFile(activeDoc.id, docBounds);
    const targetCanvas = {
      width: docBounds.right,
      height: docBounds.bottom
    };
    const targetRect = normalizeTargetRect(docBounds);
    const targetRectNorm = deriveTargetRectNorm(targetRect, targetCanvas);
    result = {
      filePath: capture.filePath || "",
      mimeType: capture.mimeType,
      width: capture.width,
      height: capture.height,
      targetRect,
      targetRectNorm,
      targetCanvas,
      documentId: activeDoc.id,
      documentName: String(activeDoc.title || "")
    };
  }, { commandName: "Capture full canvas image" });
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
  const requestedDocumentName = String(options?.targetDocumentName || "").trim();
  let appliedDocumentId = null;
  let appliedDocumentName = "";
  let appliedTargetRect = null;
  let appliedTargetRectNorm = null;
  let appliedTargetCanvas = null;
  let finalLayerBounds = null;
  let unresolvedImport = null;

  await core.executeAsModal(async () => {
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

    const selectionSnapshot = await getDocumentSelectionRect(targetDoc);
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
        },
        {
          _obj: "select",
          _target: [{ _ref: "layer", _enum: "ordinal", _value: "front" }],
          makeVisible: false
        }
      ], {});

      if (layerType === "smart-object") {
        await action.batchPlay([
          { _obj: "newPlacedLayer" }
        ], {});
      }

      if (appliedTargetRect) {
        finalLayerBounds = await alignActiveLayerToRect(appliedTargetRect);
      } else {
        finalLayerBounds = await readActiveLayerBounds();
      }
    } finally {
      if (selectionSnapshot) {
        try {
          await restoreDocumentSelection(targetDoc, selectionSnapshot);
        } catch (_) {}
      }
    }
  }, { commandName: "Import image to document" });

  if (unresolvedImport) {
    return unresolvedImport;
  }

  return {
    ok: true,
    documentId: appliedDocumentId,
    documentName: appliedDocumentName,
    targetRect: appliedTargetRect,
    targetRectNorm: appliedTargetRectNorm,
    targetCanvas: appliedTargetCanvas,
    layerBounds: finalLayerBounds
  };
}

async function postHeartbeat(source = "manual") {
  await requestJson("/ps/heartbeat", {
    method: "POST",
    body: {
      source,
      plugin: "xiaodi-ps-bridge",
      version: "0.1.0",
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
    documentName: capture?.documentName ? String(capture.documentName) : undefined
  };
  const filePath = String(capture?.filePath || "").trim();
  if (!filePath) {
    throw new Error("capture_file_path_required");
  }
  imagePayload.filePath = filePath;
  return requestJson(endpoint, {
    method: "POST",
    body: {
      source: extra.source || "manual",
      queueId: extra.queueId || null,
      slotIndex: Number.isFinite(extra.slotIndex) ? Number(extra.slotIndex) : undefined,
      role: extra.role || undefined,
      image: imagePayload,
      at: Date.now()
    }
  });
}

async function reportQueueResult(queueId, status, payload = {}) {
  const id = String(queueId || "").trim();
  if (!id) return;
  try {
    await requestJson("/queue/result", {
      method: "POST",
      body: {
        id,
        status: String(status || "done"),
        payload
      }
    });
  } catch (_) {
    // Ignore; bridge may be restarting.
  }
}

async function reportImport(resultPayload = {}) {
  return requestJson("/ps/import", {
    method: "POST",
    body: {
      source: "plugin",
      ...resultPayload,
      at: Date.now()
    }
  });
}

async function runCaptureSelection(source = "manual", extra = {}) {
  const capture = await captureSelectionData();
  await reportCapture("selection", capture, { source, ...extra });
  appendLog("success", `閫夊尯宸蹭笂鎶?${capture.width}x${capture.height}`);
}

async function runCaptureCanvas(source = "manual", extra = {}) {
  const capture = await captureCanvasData();
  await reportCapture("canvas", capture, { source, ...extra });
  appendLog("success", `鍏ㄥ浘宸蹭笂鎶?${capture.width}x${capture.height}`);
}

async function handleQueueItem(item) {
  const type = String(item?.type || "").trim();
  const payload = item?.payload && typeof item.payload === "object" ? item.payload : {};
  appendLog("info", `received queue command: ${type || "unknown"}`);

  if (type === "reconnect") {
    await postHeartbeat("queue-reconnect");
    appendLog("success", "已响应重连命令");
    return;
  }

  if (type === "capture-selection" || type === "ps.capture.selection") {
    await runCaptureSelection("queue", {
      queueId: item?.id,
      slotIndex: payload?.slotIndex,
      role: payload?.role
    });
    return;
  }

  if (type === "capture-canvas" || type === "ps.capture.canvas") {
    await runCaptureCanvas("queue", {
      queueId: item?.id,
      slotIndex: payload?.slotIndex,
      role: payload?.role
    });
    return;
  }

  if (type === "import-image" || type === "ps.import.image" || type === "ps.import") {
    const dataUrl = String(payload?.dataUrl || payload?.imageDataUrl || "").trim();
    if (!dataUrl) throw new Error("鍥炰紶鍛戒护缂哄皯 dataUrl");
    const importResult = await importDataUrlToCurrentDocument(dataUrl, {
      targetRect: payload?.targetRect || null,
      targetRectNorm: payload?.targetRectNorm || null,
      targetCanvas: payload?.targetCanvas || null,
      targetDocumentId: payload?.targetDocumentId || null,
      targetDocumentName: payload?.targetDocumentName || "",
      layerType: payload?.layerType || "smart-object"
    });
    if (importResult?.ok === false) {
      await reportImport({
        queueId: item?.id,
        ok: false,
        errorCode: String(importResult?.errorCode || "target_document_required"),
        message: String(importResult?.message || "target_document_required"),
        requestedDocumentId: Number(importResult?.requestedDocumentId) || undefined,
        requestedDocumentName: String(importResult?.requestedDocumentName || ""),
        activeDocumentId: Number(importResult?.activeDocumentId) || undefined,
        activeDocumentName: String(importResult?.activeDocumentName || ""),
        openDocuments: Array.isArray(importResult?.openDocuments) ? importResult.openDocuments : []
      });
      appendLog("warn", String(importResult?.message || "target document unresolved"));
      return;
    }
    await reportImport({
      queueId: item?.id,
      ok: true,
      layerType: String(payload?.layerType || "smart-object"),
      documentId: Number(importResult?.documentId) || undefined,
      documentName: importResult?.documentName ? String(importResult.documentName) : undefined,
      targetRect: importResult?.targetRect || null,
      targetRectNorm: importResult?.targetRectNorm || null,
      targetCanvas: importResult?.targetCanvas || null,
      layerBounds: importResult?.layerBounds || null
    });
    appendLog("success", "已执行回传命令");
    return;
  }

  appendLog("warn", `鏈鐞嗙殑鍛戒护绫诲瀷: ${type || "empty"}`);
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
      const actionType = String(next?.type || "").trim().toLowerCase();
      const errorCode = (
        (actionType === "capture-selection" || actionType === "ps.capture.selection")
        && /no[\s_-]*active[\s_-]*selection|selection[_\s-]*not[_\s-]*found|no[\s_-]*selection/i.test(message)
      )
        ? "no_selection"
        : "";
      await reportQueueResult(next?.id, "error", {
        ok: false,
        errorCode,
        message,
        error: message,
        source: "ps-plugin-uxp",
        scene: "queue"
      });
      appendLog("error", message, "", { syncToBridge: true, scene: "queue" });
    }
  } finally {
    state.queueBusy = false;
  }
}

function normalizeBridgeErrorMessage(rawMessage) {
  const message = String(rawMessage || "").trim();
  if (!message) return "bridge connection failed";
  const permissionDenied = message.match(/Permission denied to the url\s+([^\s]+)\.\s*Manifest entry not found\./i);
  if (permissionDenied) {
    let blockedTarget = permissionDenied[1];
    try {
      blockedTarget = new URL(blockedTarget).origin;
    } catch (_) {}
    return `Permission denied to bridge URL (${blockedTarget}). Check plugin manifest network.domains and reload plugin.`;
  }
  return message;
}

function setBridgeError(err) {
  const rawMessage = String(err?.message || err || "bridge 杩炴帴澶辫触");
  const message = normalizeBridgeErrorMessage(rawMessage);
  if (state.bridgeConnected) {
    state.bridgeConnected = false;
    void reportPluginLog("warn", "鎻掍欢杩炴帴涓柇", message, { scene: "bridge" });
  }
  setStatusChip("error", "杩炴帴澶辫触");
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
  appendLog("info", `bridge: ${getBridgeBase()}`);

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
}

function bindEvents() {
  ui.applyPortBtn?.addEventListener("click", () => {
    const nextPort = parsePort(ui.portInput?.value, state.bridgePort);
    state.bridgePort = nextPort;
    if (ui.portInput) ui.portInput.value = String(nextPort);
    saveConfig();
  appendLog("info", `bridge: ${getBridgeBase()}`);
    stopBackgroundTasks();
    startBackgroundTasks();
  });

  ui.heartbeatBtn?.addEventListener("click", async () => {
    try {
      await heartbeatOnce("manual");
      appendLog("success", "鎵嬪姩蹇冭烦鎴愬姛");
    } catch (err) {
      setBridgeError(err);
    }
  });

  ui.captureSelectionBtn?.addEventListener("click", async () => {
    try {
      await runCaptureSelection("manual");
    } catch (err) {
      appendLog("error", `涓婁紶閫夊尯澶辫触: ${String(err?.message || err)}`);
    }
  });

  ui.captureCanvasBtn?.addEventListener("click", async () => {
    try {
      await runCaptureCanvas("manual");
    } catch (err) {
      appendLog("error", `涓婁紶鍏ㄥ浘澶辫触: ${String(err?.message || err)}`);
    }
  });

  ui.importToPsBtn?.addEventListener("click", async () => {
    const value = String(ui.importDataInput?.value || "").trim();
    if (!value) {
      appendLog("warn", "璇峰厛绮樿创 dataUrl/base64");
      return;
    }
    try {
      await importDataUrlToCurrentDocument(value);
      await reportImport({ source: "manual", ok: true });
      appendLog("success", "鍥炰紶瀹屾垚");
    } catch (err) {
      appendLog("error", `鍥炰紶澶辫触: ${String(err?.message || err)}`);
    }
  });
}

function init() {
  loadConfig();
  bindUi();
  if (ui.portInput) ui.portInput.value = String(state.bridgePort);
  bindEvents();
  appendLog("info", "plugin started (" + PLUGIN_BUILD_TAG + ")");
  setStatusChip("warn", "绛夊緟杩炴帴");
  startBackgroundTasks();
}

document.addEventListener("DOMContentLoaded", init);
window.addEventListener("beforeunload", stopBackgroundTasks);


