/*
 * @phb-version-tag: recovered-ce8k-r17
 * @phb-version: 0.0.1-recovered-r17
 * @phb-version-note: CE8K reverse-recovered baseline; naming refactor batch17 complete.
 * @phb-updated-at: 2026-02-18
 */
const { app, BrowserWindow, ipcMain, shell, dialog, screen, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const crypto = require('crypto');
const {
  FLOAT_WIN_DRAG_STRIP_HEIGHT,
  FLOAT_WIN_TOGGLE_HEIGHT,
  FLOAT_WIN_QUICK_BUTTON_SIZE,
  FLOAT_WIN_QUICK_BUTTON_GAP,
  FLOAT_WIN_QUICK_GROUP_TOP_GAP,
  FLOAT_WIN_QUICK_BUTTON_COUNT,
  FLOAT_WIN_QUICK_MAIN_BUTTON_COUNT,
  FLOAT_WIN_DIVIDER_HEIGHT,
  FLOAT_WIN_DIVIDER_MARGIN_Y,
  FLOAT_WIN_QUICK_PADDING_Y,
  FLOAT_WIN_OUTER_GAP,
  FLOAT_WIN_RESIZE_ANIMATION_MS,
  FLOAT_WIN_COLLAPSED_HEIGHT,
  FLOAT_WIN_EXPANDED_HEIGHT,
  FLOAT_WIN_MARGIN,
  FLOAT_WIN_OPACITY_MIN,
  FLOAT_WIN_OPACITY_MAX,
  FLOAT_WIN_OPACITY_DEFAULT,
  getFloatingToggleCollapsedWidth,
  getFloatingToggleExpandedWidth
} = require('./renderer/floating-toggle/layout-config');
const {
  SHELL_CHANNELS,
  SHELL_EVENT_CHANNELS,
  buildShellOkResponse,
  buildShellErrorResponse
} = require('./shell-ipc-contract');

let win;
const MAIN_WINDOW_DEFAULT_WIDTH = 300;
const MAIN_WINDOW_DEFAULT_HEIGHT = 880;
let normalBounds = { width: MAIN_WINDOW_DEFAULT_WIDTH, height: MAIN_WINDOW_DEFAULT_HEIGHT };
let minBounds = { width: MAIN_WINDOW_DEFAULT_WIDTH, height: 1 };
let pendingScaledBoundsRequest = null;
let internalMainResizeExpectation = null;
let floatWin = null;
let floatingToggleEnabled = true;
let floatingToggleStatus = 'idle';
let floatingToggleRunnerSource = 'none';
let floatingToggleRunnerPhase = 'idle';
let floatingToggleRunnerLen = 'soft-short';
let floatingToggleRunnerColorTone = 'orange';
let floatingToggleRunnerVisible = false;
let floatingToggleRunnerFrozen = false;
let floatingToggleRunnerFading = false;
let floatingToggleRunnerSpinDurationMs = 2000;
let mainAlwaysOnTop = true;
let autoMinimizeOnBlur = false;
const MAIN_ALWAYS_ON_TOP_LEVEL = 'screen-saver';
// Release default: disable internal quick actions (global-restart).
// Set PHB_ENABLE_INTERNAL_QUICK_ACTIONS=1 to force-enable when needed.
const ENABLE_INTERNAL_FLOATING_QUICK_ACTIONS =
  !app.isPackaged || String(process.env.PHB_ENABLE_INTERNAL_QUICK_ACTIONS || '').trim() === '1';
const FLOATING_TOGGLE_INTERNAL_QUICK_ACTIONS = ['global-restart'];
const FLOATING_QUICK_ACTION_SET = new Set([
  'history',
  'identity',
  'chat-preset',
  'image-preset',
  'instruction-mode',
  ...(ENABLE_INTERNAL_FLOATING_QUICK_ACTIONS ? FLOATING_TOGGLE_INTERNAL_QUICK_ACTIONS : [])
]);
const FLOATING_QUICK_TRIGGER_SET = new Set(['hover-enter', 'hover-leave', 'click']);
let floatingToggleOpacity = FLOAT_WIN_OPACITY_DEFAULT;
let suppressFloatingMoveSync = false;
let suppressMainMoveSync = false;
let suppressFloatingMoveSyncTimer = null;
let suppressMainMoveSyncTimer = null;
let floatingResizeAnimationTimer = null;
let mainMoveSettleTimer = null;
let blurMinimizeTimer = null;
let lastFloatingBounds = null;
let serverProc = null;
let serverProcStartedAt = 0;
const BRIDGE_PORT_DEFAULT = 17325;
const BRIDGE_PORT_MIN = 1;
const BRIDGE_PORT_MAX = 65535;
let bridgePort = BRIDGE_PORT_DEFAULT;
let logFile = null;
let perfLogFile = null;
let stateFile = null;
let bridgeConfigFile = null;
let bridgeConfigState = {};
let saveTimer = null;
let displayTopologyChangeHandler = null;
let lastMainDisplayScaleFactor = 1;
const DEV_SERVER_URL = process.env.ELECTRON_DEV_SERVER_URL;
const DEV_SERVER_ORIGIN = (() => {
  if (!DEV_SERVER_URL) return '';
  try {
    return new URL(DEV_SERVER_URL).origin;
  } catch {
    return '';
  }
})();
const INSECURE_TLS_HOST_ALLOWLIST = new Set([
  'ai.comfly.chat',
  'api.comfly.chat'
]);
const PS_CACHE_TTL_DEFAULT_MS = 2 * 60 * 1000;
const PS_CACHE_TTL_MIN_MS = 15 * 1000;
const PS_CACHE_TTL_MAX_MS = 10 * 60 * 1000;
const PS_CACHE_MAX_ITEMS = 24;
const BRIDGE_REQUEST_TIMEOUT_MS = 8000;
const BRIDGE_ACTION_TIMEOUT_MS = 45000;
const BRIDGE_RESULT_WAIT_WINDOW_MS = 25000;
const BRIDGE_PROTOCOL_VERSION = 2;
const BRIDGE_CAPTURE_LEGACY_FALLBACK_MAX_VERSION = 1;
const FORCE_LEGACY_CAPTURE_RELAY = String(process.env.PHB_FORCE_LEGACY_CAPTURE_RELAY || '').trim() === '1';
const CAPTURE_INLINE_MAX_BYTES = 8 * 1024 * 1024;
const CAPTURE_PAYLOAD_HARD_LIMIT_BYTES = 256 * 1024 * 1024;
const GENERATED_CACHE_MAX_FILES_DEFAULT = 120;
const GENERATED_CACHE_MAX_FILES_MIN = 10;
const GENERATED_CACHE_MAX_FILES_MAX = 500;
const PS_CAPTURE_SHARP_OUTPUT_DIRNAME = 'ps-capture-temp-compressed';
const CHAT_IMAGE_CACHE_MAX_FILES = 1200;
const CACHE_RETENTION_DAYS_DEFAULT = {
  chatRecords: 30,
  images: 14,
  other: 30
};
const CACHE_RETENTION_DAYS_MIN = 0;
const CACHE_RETENTION_DAYS_MAX = 3650;
const CACHE_POLICY_CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;
// Legacy monolithic snapshot file (kept only for migration/fallback).
const CHAT_CACHE_FILE_BASENAME = 'chat-sessions.json';
// New sharded chat persistence: one index + one file per session.
const CHAT_INDEX_FILE_BASENAME = 'chat-index.json';
const CHAT_SESSION_SHARDS_DIRNAME = 'sessions';
let cachePolicy = { ...CACHE_RETENTION_DAYS_DEFAULT, updatedAt: 0 };
let cachePolicyCleanupTimer = null;
let sharpModuleRef = null;
let sharpModuleConfigured = false;
let psCaptureCompressionActive = false;
const psCaptureCompressionQueue = [];
const pluginIntermediateCapturePaths = new Set();
const psImageCacheMap = new Map();
const migratedCachePaths = new Set();
const deletedChatSessionIdGuardSet = new Set();
const GLOBAL_UPLOAD_SHORTCUT_ACTION_SET = new Set(['select', 'full']);
const SHORTCUT_MODIFIER_ACCELERATOR_MAP = Object.freeze({
  ctrl: 'CommandOrControl',
  control: 'CommandOrControl',
  alt: 'Alt',
  option: 'Alt',
  shift: 'Shift',
  meta: 'Super',
  cmd: 'Super',
  command: 'Super',
  win: 'Super',
  windows: 'Super'
});
const SHORTCUT_PRIMARY_ACCELERATOR_MAP = Object.freeze({
  esc: 'Esc',
  escape: 'Esc',
  enter: 'Enter',
  return: 'Enter',
  tab: 'Tab',
  space: 'Space',
  spacebar: 'Space',
  backspace: 'Backspace',
  delete: 'Delete',
  del: 'Delete',
  insert: 'Insert',
  ins: 'Insert',
  home: 'Home',
  end: 'End',
  pageup: 'PageUp',
  pgup: 'PageUp',
  pagedown: 'PageDown',
  pgdn: 'PageDown',
  up: 'Up',
  arrowup: 'Up',
  down: 'Down',
  arrowdown: 'Down',
  left: 'Left',
  arrowleft: 'Left',
  right: 'Right',
  arrowright: 'Right',
  minus: '-',
  equal: '=',
  bracketleft: '[',
  bracketright: ']',
  backslash: '\\',
  semicolon: ';',
  quote: "'",
  comma: ',',
  period: '.',
  slash: '/',
  backquote: '`'
});
let globalUploadShortcutBindings = {
  select: { shortcut: '', accelerator: '', registered: false, reason: '' },
  full: { shortcut: '', accelerator: '', registered: false, reason: '' }
};

function sanitizeRetentionDays(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(
    CACHE_RETENTION_DAYS_MAX,
    Math.max(CACHE_RETENTION_DAYS_MIN, Math.round(n))
  );
}

function sanitizeCachePolicy(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  return {
    chatRecords: sanitizeRetentionDays(source.chatRecords, CACHE_RETENTION_DAYS_DEFAULT.chatRecords),
    images: sanitizeRetentionDays(source.images, CACHE_RETENTION_DAYS_DEFAULT.images),
    other: sanitizeRetentionDays(source.other, CACHE_RETENTION_DAYS_DEFAULT.other),
    updatedAt: Number(source.updatedAt) || Date.now()
  };
}

function getCachePolicySnapshot() {
  return {
    chatRecords: cachePolicy.chatRecords,
    images: cachePolicy.images,
    other: cachePolicy.other,
    updatedAt: Number(cachePolicy.updatedAt) || Date.now()
  };
}

function normalizeGlobalUploadShortcutAction(actionInput) {
  const action = String(actionInput || '').trim().toLowerCase();
  return GLOBAL_UPLOAD_SHORTCUT_ACTION_SET.has(action) ? action : '';
}

function normalizeGlobalShortcutAccelerator(shortcutInput) {
  const shortcutText = String(shortcutInput || '').trim();
  if (!shortcutText) return '';
  const tokens = shortcutText
    .split('+')
    .map((token) => String(token || '').trim())
    .filter(Boolean);
  if (!tokens.length) return '';
  const modifiers = [];
  const modifierSet = new Set();
  let primaryToken = '';
  for (const token of tokens) {
    const lowerToken = token.toLowerCase();
    const modifierToken = SHORTCUT_MODIFIER_ACCELERATOR_MAP[lowerToken];
    if (modifierToken) {
      if (!modifierSet.has(modifierToken)) {
        modifierSet.add(modifierToken);
        modifiers.push(modifierToken);
      }
      continue;
    }
    if (primaryToken) return '';
    if (/^f\d{1,2}$/i.test(token)) {
      primaryToken = token.toUpperCase();
      continue;
    }
    if (/^[a-z0-9]$/i.test(token)) {
      primaryToken = token.toUpperCase();
      continue;
    }
    primaryToken = SHORTCUT_PRIMARY_ACCELERATOR_MAP[lowerToken] || '';
    if (!primaryToken) return '';
  }
  if (!primaryToken) return '';
  return [...modifiers, primaryToken].join('+');
}

function getGlobalUploadShortcutBindingsSnapshot() {
  return {
    select: { ...globalUploadShortcutBindings.select },
    full: { ...globalUploadShortcutBindings.full }
  };
}

function clearRegisteredGlobalUploadShortcuts() {
  for (const action of ['select', 'full']) {
    const binding = globalUploadShortcutBindings[action];
    const accelerator = String(binding?.accelerator || '').trim();
    if (accelerator) {
      try {
        globalShortcut.unregister(accelerator);
      } catch (err) {
        log('global shortcut unregister failed', {
          action,
          accelerator,
          message: err.message
        }, 'warn');
      }
    }
  }
  globalUploadShortcutBindings = {
    select: { shortcut: '', accelerator: '', registered: false, reason: '' },
    full: { shortcut: '', accelerator: '', registered: false, reason: '' }
  };
}

function sendGlobalUploadShortcutAction(action, accelerator) {
  if (!win || win.isDestroyed() || !win.webContents || win.webContents.isDestroyed()) {
    return false;
  }
  try {
    win.webContents.send(SHELL_EVENT_CHANNELS.globalUploadShortcutAction, {
      action: normalizeGlobalUploadShortcutAction(action),
      accelerator: String(accelerator || '').trim(),
      at: Date.now()
    });
    return true;
  } catch (err) {
    log('global shortcut emit failed', {
      action,
      accelerator,
      message: err.message
    }, 'warn');
    return false;
  }
}

function applyGlobalUploadShortcuts(payload = {}) {
  const requestedShortcutByAction = {
    select: String(payload?.uploadSelectionShortcut || '').trim(),
    full: String(payload?.uploadFullImageShortcut || '').trim()
  };
  const requestedAcceleratorByAction = {
    select: normalizeGlobalShortcutAccelerator(requestedShortcutByAction.select),
    full: normalizeGlobalShortcutAccelerator(requestedShortcutByAction.full)
  };
  clearRegisteredGlobalUploadShortcuts();
  const response = {
    ok: true,
    shortcuts: {
      select: {
        shortcut: requestedShortcutByAction.select,
        accelerator: requestedAcceleratorByAction.select,
        registered: false,
        reason: ''
      },
      full: {
        shortcut: requestedShortcutByAction.full,
        accelerator: requestedAcceleratorByAction.full,
        registered: false,
        reason: ''
      }
    }
  };
  const selectAccelerator = requestedAcceleratorByAction.select;
  const fullAccelerator = requestedAcceleratorByAction.full;
  const hasConflict =
    !!selectAccelerator &&
    !!fullAccelerator &&
    selectAccelerator.toLowerCase() === fullAccelerator.toLowerCase();
  for (const action of ['select', 'full']) {
    const requestedShortcut = requestedShortcutByAction[action];
    const accelerator = requestedAcceleratorByAction[action];
    if (!requestedShortcut) {
      response.shortcuts[action].reason = 'empty';
      continue;
    }
    if (!accelerator) {
      response.shortcuts[action].reason = 'invalid_shortcut';
      continue;
    }
    if (hasConflict && action === 'full') {
      response.shortcuts[action].reason = 'accelerator_conflict';
      continue;
    }
    let registered = false;
    try {
      registered = globalShortcut.register(accelerator, () => {
        const dispatched = sendGlobalUploadShortcutAction(action, accelerator);
        if (!dispatched) {
          log('global shortcut trigger ignored: renderer unavailable', {
            action,
            accelerator
          }, 'warn');
        }
      });
    } catch (err) {
      response.shortcuts[action].reason = String(err?.message || 'register_failed');
      log('global shortcut register failed', {
        action,
        accelerator,
        message: String(err?.message || 'register_failed')
      }, 'warn');
      continue;
    }
    if (!registered) {
      response.shortcuts[action].reason = 'register_rejected';
      log('global shortcut register rejected', { action, accelerator }, 'warn');
      continue;
    }
    response.shortcuts[action].registered = true;
    response.shortcuts[action].reason = 'ok';
    globalUploadShortcutBindings[action] = {
      shortcut: requestedShortcut,
      accelerator,
      registered: true,
      reason: 'ok'
    };
  }
  return response;
}

function getUnifiedCacheRootDir() {
  return path.join(app.getPath('userData'), 'cache');
}

function ensureUnifiedCacheRootDir() {
  const dir = getUnifiedCacheRootDir();
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getLegacyGeneratedCacheDir() {
  return path.resolve(__dirname, '..', 'cache');
}

function getLegacyChatImageCacheDir() {
  return path.join(app.getPath('userData'), 'chat-image-cache');
}

function getLegacyPsImageCacheDir() {
  return path.join(app.getPath('userData'), 'ps-image-cache');
}

function getLegacyChatStateFile() {
  return path.join(app.getPath('userData'), CHAT_CACHE_FILE_BASENAME);
}

function getLegacyLogsDir() {
  return path.join(app.getPath('userData'), 'logs');
}

function getGeneratedCacheDir() {
  return path.join(getUnifiedCacheRootDir(), 'generated');
}

function getLogsCacheDir() {
  return path.join(getUnifiedCacheRootDir(), 'logs');
}

function getBridgeServerDataDir() {
  const candidates = [
    path.join(__dirname, 'server', 'data'),
    path.join(__dirname, '..', 'server', 'data')
  ];
  const existing = candidates.find((dir) => fs.existsSync(path.join(path.dirname(dir), 'index.js')));
  return existing || candidates[0];
}

function getBridgeCaptureCacheDir() {
  return path.join(getBridgeServerDataDir(), 'ps-capture-cache');
}

function getBridgeCaptureCommDir() {
  return path.join(getBridgeServerDataDir(), 'ps-capture-comm');
}

function getPsImageCacheDir() {
  return path.join(getUnifiedCacheRootDir(), 'ps-image-cache');
}

function ensurePsImageCacheDir() {
  const dir = getPsImageCacheDir();
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getChatImageCacheDir() {
  return path.join(getUnifiedCacheRootDir(), 'chat-image-cache');
}

function ensureChatImageCacheDir() {
  const dir = getChatImageCacheDir();
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getChatImageCacheSearchDirs() {
  const primaryDir = getChatImageCacheDir();
  const legacyDir = getLegacyChatImageCacheDir();
  const searchDirs = [primaryDir];
  if (
    legacyDir &&
    path.resolve(legacyDir).toLowerCase() !== path.resolve(primaryDir).toLowerCase()
  ) {
    searchDirs.push(legacyDir);
  }
  return Array.from(new Set(searchDirs.map((dirPath) => String(dirPath || '').trim()).filter(Boolean)));
}

function isPsCacheId(cacheIdInput = '') {
  const normalizedCacheId = String(cacheIdInput || '').trim();
  return (
    /^pscache_/i.test(normalizedCacheId)
    || /^(psselect_upload|pscanvas_upload|upload_input|run_result|return_export)(_|$)/i.test(normalizedCacheId)
  );
}

function deriveCacheIdFromFileName(fileNameInput = '') {
  const rawText = String(fileNameInput || '').trim();
  if (!rawText) return '';
  const normalizedPathText = rawText.split(/[?#]/)[0];
  const baseName = String(path.basename(normalizedPathText) || '').trim();
  if (!baseName) return '';
  const stem = String(path.basename(baseName, path.extname(baseName)) || '').trim();
  if (!stem) return '';
  if (isPsCacheId(stem)) return stem;
  return /^[a-f0-9]{16,128}$/i.test(stem) ? stem.toLowerCase() : '';
}

function resolveChatImageIdsFromRecord(imageRecord = {}) {
  const legacyImageRecord =
    imageRecord?.legacy && typeof imageRecord.legacy === 'object'
      ? imageRecord.legacy
      : {};
  const rawCacheId = String(
    imageRecord?.cacheId || legacyImageRecord?.cacheId || ''
  ).trim();
  const rawPsCacheId = String(
    imageRecord?.psCacheId || legacyImageRecord?.psCacheId || ''
  ).trim();
  const rawInternalCacheId = String(imageRecord?.internalCacheId || '').trim();
  const rawItemId = String(imageRecord?.itemId || '').trim();
  const fileDerivedId = deriveCacheIdFromFileName(
    imageRecord?.cacheFileName
      || legacyImageRecord?.cacheFileName
      || imageRecord?.fileName
      || imageRecord?.cacheFilePath
      || legacyImageRecord?.cacheFilePath
      || imageRecord?.filePath
      || '',
  );

  let normalizedChatCacheId = '';
  if (rawCacheId && !isPsCacheId(rawCacheId)) {
    normalizedChatCacheId = rawCacheId;
  } else if (rawInternalCacheId && !isPsCacheId(rawInternalCacheId)) {
    normalizedChatCacheId = rawInternalCacheId;
  } else if (rawItemId && !isPsCacheId(rawItemId)) {
    normalizedChatCacheId = rawItemId;
  } else if (fileDerivedId && !isPsCacheId(fileDerivedId)) {
    normalizedChatCacheId = fileDerivedId;
  } else if (rawPsCacheId && !isPsCacheId(rawPsCacheId)) {
    normalizedChatCacheId = rawPsCacheId;
  } else if (rawCacheId && !fileDerivedId) {
    normalizedChatCacheId = rawCacheId;
  }

  const normalizedPsCacheId =
    rawPsCacheId
    || (isPsCacheId(rawInternalCacheId) ? rawInternalCacheId : '')
    || (isPsCacheId(rawItemId) ? rawItemId : '')
    || (isPsCacheId(fileDerivedId) ? fileDerivedId : '')
    || (isPsCacheId(rawCacheId) ? rawCacheId : '');
  return {
    chatCacheId: String(normalizedChatCacheId || '').trim(),
    psCacheId: String(normalizedPsCacheId || '').trim(),
    fileDerivedId: String(fileDerivedId || '').trim(),
  };
}

function getChatCacheDir() {
  return path.join(getUnifiedCacheRootDir(), 'chat');
}

function ensureChatCacheDir() {
  const dir = getChatCacheDir();
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getChatStateBackupFile(filePath) {
  return `${filePath}.bak`;
}

function getChatIndexFile() {
  ensureUnifiedCacheLayout();
  return path.join(getChatCacheDir(), CHAT_INDEX_FILE_BASENAME);
}

function getChatSessionShardsDir() {
  return path.join(getChatCacheDir(), CHAT_SESSION_SHARDS_DIRNAME);
}

function ensureChatSessionShardsDir() {
  const dir = getChatSessionShardsDir();
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function normalizeChatSessionShardToken(tokenInput = '') {
  const normalized = String(tokenInput || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
  return normalized || 'session';
}

function buildChatSessionShardFileName(sessionId = '') {
  const normalizedSessionId = String(sessionId || '').trim();
  const safeToken = normalizeChatSessionShardToken(normalizedSessionId);
  const stableHash = crypto
    .createHash('sha1')
    .update(normalizedSessionId || `${Date.now()}-${Math.random()}`)
    .digest('hex')
    .slice(0, 12);
  return `${safeToken}--${stableHash}.json`;
}

function getChatSessionShardFileById(sessionId = '') {
  return path.join(
    getChatSessionShardsDir(),
    buildChatSessionShardFileName(sessionId),
  );
}

function getGeneratedTargetMetaDir() {
  return path.join(getUnifiedCacheRootDir(), 'generated-target-meta');
}

function copyDirRecursive(sourceDir, targetDir) {
  const source = String(sourceDir || '').trim();
  const target = String(targetDir || '').trim();
  if (!source || !target || !fs.existsSync(source)) return;
  fs.mkdirSync(target, { recursive: true });
  const entries = fs.readdirSync(source, { withFileTypes: true });
  entries.forEach((entry) => {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(sourcePath, targetPath);
      return;
    }
    if (!entry.isFile()) return;
    fs.copyFileSync(sourcePath, targetPath);
  });
}

function migratePathIfNeeded(legacyPath, nextPath, type = 'dir') {
  const key = `${type}:${legacyPath}->${nextPath}`;
  if (migratedCachePaths.has(key)) return;
  migratedCachePaths.add(key);
  try {
    const hasLegacy = fs.existsSync(legacyPath);
    if (!hasLegacy) return;
    const hasNext = fs.existsSync(nextPath);
    if (hasNext && type !== 'dir') return;
    if (type === 'dir') {
      fs.mkdirSync(path.dirname(nextPath), { recursive: true });
      if (hasNext) {
        copyDirRecursive(legacyPath, nextPath);
        try {
          fs.rmSync(legacyPath, { recursive: true, force: true });
        } catch {}
        return;
      }
      try {
        fs.renameSync(legacyPath, nextPath);
      } catch {
        copyDirRecursive(legacyPath, nextPath);
      }
    } else {
      fs.mkdirSync(path.dirname(nextPath), { recursive: true });
      fs.copyFileSync(legacyPath, nextPath);
      try {
        fs.unlinkSync(legacyPath);
      } catch {}
    }
  } catch (err) {
    log('cache path migrate failed', { legacyPath, nextPath, message: err.message });
  }
}

function ensureUnifiedCacheLayout() {
  ensureUnifiedCacheRootDir();
  const generatedDir = getGeneratedCacheDir();
  const chatImagesDir = getChatImageCacheDir();
  const psImagesDir = getPsImageCacheDir();
  const chatDir = getChatCacheDir();
  const generatedMetaDir = getGeneratedTargetMetaDir();

  migratePathIfNeeded(getLegacyGeneratedCacheDir(), generatedDir, 'dir');
  migratePathIfNeeded(getLegacyChatImageCacheDir(), chatImagesDir, 'dir');
  migratePathIfNeeded(getLegacyPsImageCacheDir(), psImagesDir, 'dir');
  migratePathIfNeeded(path.join(getLegacyGeneratedCacheDir(), 'import-target-cache'), generatedMetaDir, 'dir');
  migratePathIfNeeded(path.join(generatedDir, 'import-target-cache'), generatedMetaDir, 'dir');
  migratePathIfNeeded(getLegacyLogsDir(), getLogsCacheDir(), 'dir');

  fs.mkdirSync(generatedDir, { recursive: true });
  fs.mkdirSync(chatImagesDir, { recursive: true });
  fs.mkdirSync(psImagesDir, { recursive: true });
  fs.mkdirSync(chatDir, { recursive: true });
  fs.mkdirSync(generatedMetaDir, { recursive: true });
  fs.mkdirSync(getLogsCacheDir(), { recursive: true });
}

function sanitizePsCacheTtlMs(input) {
  const n = Number(input);
  if (!Number.isFinite(n)) return PS_CACHE_TTL_DEFAULT_MS;
  return Math.min(PS_CACHE_TTL_MAX_MS, Math.max(PS_CACHE_TTL_MIN_MS, Math.round(n)));
}

function snapshotMainMemoryUsage() {
  const usage = process.memoryUsage();
  return {
    rss: Number(usage.rss || 0),
    heapTotal: Number(usage.heapTotal || 0),
    heapUsed: Number(usage.heapUsed || 0),
    external: Number(usage.external || 0),
    arrayBuffers: Number(usage.arrayBuffers || 0),
    psCacheItems: psImageCacheMap.size
  };
}

function getExtByMimeType(mime) {
  const m = String(mime || '').toLowerCase();
  if (m.includes('png')) return 'png';
  if (m.includes('webp')) return 'webp';
  if (m.includes('gif')) return 'gif';
  if (m.includes('bmp')) return 'bmp';
  if (m.includes('svg')) return 'svg';
  if (m.includes('jpeg') || m.includes('jpg')) return 'jpg';
  return 'bin';
}

function replaceFileNameExtension(fileNameInput, nextExtInput) {
  const normalizedFileName = String(fileNameInput || '').trim();
  const normalizedNextExt = String(nextExtInput || '').trim().replace(/^\./, '').toLowerCase();
  if (!normalizedNextExt) return normalizedFileName;
  if (!normalizedFileName) return `ps-capture.${normalizedNextExt}`;
  const baseName = stripTrailingImageExtensions(path.basename(normalizedFileName));
  return `${baseName || 'ps-capture'}.${normalizedNextExt}`;
}

function stripTrailingImageExtensions(fileNameInput = '') {
  let normalizedName = String(fileNameInput || '').trim();
  if (!normalizedName) return '';
  while (true) {
    const ext = String(path.extname(normalizedName) || '').trim().toLowerCase();
    if (!ext || !/^\.(png|jpe?g|webp|gif|bmp|svg|bin)$/i.test(ext)) {
      break;
    }
    const nextName = path.basename(normalizedName, ext).trim();
    if (!nextName || nextName === normalizedName) {
      break;
    }
    normalizedName = nextName;
  }
  return normalizedName;
}

function getPsCaptureCompressedCacheDir() {
  return path.join(getGeneratedCacheDir(), PS_CAPTURE_SHARP_OUTPUT_DIRNAME);
}

function getSharpModule() {
  if (!sharpModuleRef) {
    // Lazy-load sharp so main process startup cost stays low until the
    // PS capture compression path is actually used.
    // eslint-disable-next-line global-require, import/no-dynamic-require
    sharpModuleRef = require('sharp');
  }
  if (!sharpModuleConfigured && sharpModuleRef) {
    try {
      sharpModuleRef.concurrency(1);
      sharpModuleRef.cache(false);
      if (typeof sharpModuleRef.simd === 'function') {
        sharpModuleRef.simd(true);
      }
    } catch (err) {
      log('sharp configure failed', { message: err.message });
    }
    sharpModuleConfigured = true;
  }
  return sharpModuleRef;
}

function normalizeSharpOutputFormat(rawFormat, fallback = 'jpg') {
  const normalizedFallback = String(fallback || 'jpg').trim().toLowerCase() === 'png' ? 'png' : 'jpg';
  const normalizedRaw = String(rawFormat || '').trim().toLowerCase();
  if (normalizedRaw === 'png') return 'png';
  if (normalizedRaw === 'jpg' || normalizedRaw === 'jpeg') return 'jpg';
  return normalizedFallback;
}

function normalizeSharpQualityPercent(rawQuality, fallback = 1) {
  const normalizedFallback = Number.isFinite(Number(fallback))
    ? Math.max(0.01, Math.min(1, Number(fallback)))
    : 1;
  const normalizedQuality = Number.isFinite(Number(rawQuality))
    ? Math.max(0.01, Math.min(1, Number(rawQuality)))
    : normalizedFallback;
  return Math.max(1, Math.min(100, Math.round(normalizedQuality * 100)));
}

function normalizeSharpPngCompressionLevel(rawQuality, fallback = 1) {
  const normalizedFallback = Number.isFinite(Number(fallback))
    ? Math.max(0.01, Math.min(1, Number(fallback)))
    : 1;
  const normalizedQuality = Number.isFinite(Number(rawQuality))
    ? Math.max(0.01, Math.min(1, Number(rawQuality)))
    : normalizedFallback;
  return Math.max(0, Math.min(9, Math.round(normalizedQuality * 9)));
}

async function compressPsCaptureTempFileWithSharp({
  inputFilePath,
  inputBuffer,
  inputMimeType = '',
  outputFormat = 'jpg',
  maxSide = 0,
  quality = 1,
  source = '',
  occurredAt = Date.now(),
  sequenceIndex = 1,
} = {}) {
  const sourceFilePath = String(inputFilePath || '').trim();
  const sourceBinary = Buffer.isBuffer(inputBuffer)
    ? inputBuffer
    : (inputBuffer ? Buffer.from(inputBuffer) : Buffer.alloc(0));
  const hasSourceFilePath = !!sourceFilePath;
  if (!hasSourceFilePath && !sourceBinary.length) {
    throw new Error('sharp_input_missing');
  }
  if (hasSourceFilePath) {
    if (!fs.existsSync(sourceFilePath)) {
      throw new Error('sharp_input_file_missing');
    }
    const sourceStat = fs.statSync(sourceFilePath);
    if (!sourceStat.isFile() || !Number(sourceStat.size)) {
      throw new Error('sharp_input_file_empty');
    }
  } else if (!sourceBinary.length) {
    throw new Error('sharp_input_buffer_empty');
  }
  ensureUnifiedCacheLayout();
  const sharp = getSharpModule();
  const normalizedOutputFormat = normalizeSharpOutputFormat(outputFormat, 'jpg');
  const normalizedMaxSide = Number.isFinite(Number(maxSide)) && Number(maxSide) > 0
    ? Math.max(1, Math.round(Number(maxSide)))
    : 0;
  const normalizedQualityPercent = normalizeSharpQualityPercent(quality, 1);
  const normalizedPngCompressionLevel = normalizeSharpPngCompressionLevel(quality, 1);
  const outputDir = getPsCaptureCompressedCacheDir();
  fs.mkdirSync(outputDir, { recursive: true });
  const tempIdentity = buildPsAssetTempIdentity({
    mimeType: normalizedOutputFormat === 'png' ? 'image/png' : 'image/jpeg',
    source,
    tempKind: 'compressed',
    occurredAt,
    sequenceIndex,
  });
  const outputFileName = tempIdentity.fileName;
  const outputFilePath = path.join(outputDir, outputFileName);
  try {
    if (fs.existsSync(outputFilePath) && fs.statSync(outputFilePath).isFile()) {
      fs.unlinkSync(outputFilePath);
    }
  } catch {}

  let pipeline = hasSourceFilePath
    ? sharp(sourceFilePath, {
      sequentialRead: true,
      limitInputPixels: false
    }).rotate()
    : sharp(sourceBinary, {
      sequentialRead: true,
      limitInputPixels: false,
      ...(String(inputMimeType || '').trim()
        ? { failOn: 'none' }
        : {})
    }).rotate();

  const inputMetadata = await pipeline.metadata();
  if (normalizedMaxSide > 0) {
    pipeline = pipeline.resize({
      width: normalizedMaxSide,
      height: normalizedMaxSide,
      fit: 'inside',
      withoutEnlargement: true
    });
  }

  if (normalizedOutputFormat === 'png') {
    pipeline = pipeline.png({
      compressionLevel: normalizedPngCompressionLevel,
      adaptiveFiltering: true,
      palette: false
    });
  } else {
    pipeline = pipeline.jpeg({
      quality: normalizedQualityPercent,
      mozjpeg: false,
      chromaSubsampling: '4:4:4'
    });
  }

  await pipeline.toFile(outputFilePath);
  const outputStat = fs.statSync(outputFilePath);
  const outputMetadata = await sharp(outputFilePath, {
    sequentialRead: true,
    limitInputPixels: false
  }).metadata();

  return {
    ok: true,
    inputFilePath: hasSourceFilePath ? sourceFilePath : '',
    outputFilePath,
    outputFileName,
    outputFormat: normalizedOutputFormat,
    outputMimeType: normalizedOutputFormat === 'png' ? 'image/png' : 'image/jpeg',
    outputQualityPercent: normalizedOutputFormat === 'jpg' ? normalizedQualityPercent : undefined,
    outputPngCompressionLevel: normalizedOutputFormat === 'png' ? normalizedPngCompressionLevel : undefined,
    inputByteLength: hasSourceFilePath
      ? Number(fs.statSync(sourceFilePath).size || 0)
      : Number(sourceBinary.length || 0),
    outputByteLength: Number(outputStat.size || 0),
    inputWidth: Number(inputMetadata?.width) || 0,
    inputHeight: Number(inputMetadata?.height) || 0,
    outputWidth: Number(outputMetadata?.width) || 0,
    outputHeight: Number(outputMetadata?.height) || 0
  };
}

function trackPluginIntermediateCaptureFile(filePathInput = '') {
  const normalizedFilePath = String(filePathInput || '').trim();
  if (!normalizedFilePath) return '';
  pluginIntermediateCapturePaths.add(normalizedFilePath);
  return normalizedFilePath;
}

function forgetPluginIntermediateCaptureFile(filePathInput = '') {
  const normalizedFilePath = String(filePathInput || '').trim();
  if (!normalizedFilePath) return;
  pluginIntermediateCapturePaths.delete(normalizedFilePath);
}

function removePluginIntermediateCaptureFile(filePathInput = '') {
  const normalizedFilePath = String(filePathInput || '').trim();
  if (!normalizedFilePath) return;
  pluginIntermediateCapturePaths.delete(normalizedFilePath);
  try {
    if (fs.existsSync(normalizedFilePath) && fs.statSync(normalizedFilePath).isFile()) {
      fs.unlinkSync(normalizedFilePath);
    }
  } catch (err) {
    log('plugin intermediate capture cleanup failed', {
      filePath: normalizedFilePath,
      message: err.message
    }, 'warn');
  }
}

function clearPluginIntermediateCaptureFiles() {
  Array.from(pluginIntermediateCapturePaths).forEach((filePath) => {
    removePluginIntermediateCaptureFile(filePath);
  });
}

function schedulePsCaptureCompressionQueuePump() {
  if (psCaptureCompressionActive || !psCaptureCompressionQueue.length) return;
  psCaptureCompressionActive = true;
  setTimeout(async () => {
    while (psCaptureCompressionQueue.length) {
      const job = psCaptureCompressionQueue.shift();
      const queueStartedAt = Date.now();
      try {
        const result = await runPsCaptureCompressionJob(job.options);
        job.resolve({
          ...result,
          queueWaitMs: Math.max(0, queueStartedAt - job.enqueuedAt),
          queueRunMs: Math.max(0, Date.now() - queueStartedAt),
        });
      } catch (err) {
        job.reject(err);
      }
    }
    psCaptureCompressionActive = false;
  }, 0);
}

function enqueuePsCaptureCompressionJob(options = {}) {
  return new Promise((resolve, reject) => {
    psCaptureCompressionQueue.push({
      options,
      resolve,
      reject,
      enqueuedAt: Date.now(),
    });
    schedulePsCaptureCompressionQueuePump();
  });
}

async function runPsCaptureCompressionJob(options = {}) {
  const trackedInputFilePath = trackPluginIntermediateCaptureFile(options.inputFilePath);
  if (!trackedInputFilePath || !fs.existsSync(trackedInputFilePath)) {
    throw new Error('ps_capture_temp_file_missing');
  }
  let sharpResult = null;
  try {
    sharpResult = await compressPsCaptureTempFileWithSharp({
      inputFilePath: trackedInputFilePath,
      outputFormat: options.outputFormat,
      maxSide: options.maxSide,
      quality: options.quality,
      source: options.source,
      occurredAt: options.occurredAt,
      sequenceIndex: options.sequenceIndex,
    });

    const normalizedOutputExt = sharpResult.outputFormat === 'png' ? 'png' : 'jpg';
    const normalizedDisplayName = replaceFileNameExtension(
      options.displayFileName || options.originName || options.name || sharpResult.outputFileName,
      normalizedOutputExt,
    );
    const cacheMeta = {
      ...(options.meta && typeof options.meta === 'object' ? options.meta : {}),
      compressionStrategy: 'electron-sharp',
      sharpOutputFormat: sharpResult.outputFormat,
      sharpOutputQualityPercent: Number(sharpResult.outputQualityPercent) || null,
      sharpPngCompressionLevel: Number(sharpResult.outputPngCompressionLevel) || null,
      sharpInputByteLength: Number(sharpResult.inputByteLength) || 0,
      sharpOutputByteLength: Number(sharpResult.outputByteLength) || 0,
      sharpInputWidth: Number(sharpResult.inputWidth) || 0,
      sharpInputHeight: Number(sharpResult.inputHeight) || 0,
      sharpOutputWidth: Number(sharpResult.outputWidth) || 0,
      sharpOutputHeight: Number(sharpResult.outputHeight) || 0,
    };

    const cachedResult = cacheExistingFileToPsImageCache({
      filePath: sharpResult.outputFilePath,
      mimeType: sharpResult.outputMimeType,
      ttlMs: options.ttlMs,
      name: normalizedDisplayName,
      originName: normalizedDisplayName,
      source: options.source || 'ps',
      occurredAt: options.occurredAt || Date.now(),
      sequenceIndex: Number.isFinite(Number(options.sequenceIndex))
        ? Number(options.sequenceIndex)
        : 1,
      role: options.role || '',
      slotIndex: options.slotIndex,
      clientRef: options.clientRef || '',
      meta: cacheMeta,
    });

    removePluginIntermediateCaptureFile(trackedInputFilePath);
    return {
      entry: cachedResult.entry,
      ttlMs: cachedResult.ttlMs,
      sharpResult,
      displayFileName: normalizedDisplayName,
    };
  } catch (err) {
    if (sharpResult?.outputFilePath) {
      try {
        if (fs.existsSync(sharpResult.outputFilePath) && fs.statSync(sharpResult.outputFilePath).isFile()) {
          fs.unlinkSync(sharpResult.outputFilePath);
        }
      } catch {}
    }
    throw err;
  }
}

function parseImageDataUrl(dataUrl) {
  const raw = String(dataUrl || '');
  const matched = raw.match(/^data:([^;,]+);base64,([\s\S]+)$/i);
  if (!matched) return null;
  const mime = String(matched[1] || 'application/octet-stream').toLowerCase();
  const base64 = String(matched[2] || '').trim();
  if (!base64) return null;
  return { mime, buffer: Buffer.from(base64, 'base64') };
}

function computeBufferSha1(buffer) {
  return crypto.createHash('sha1').update(buffer).digest('hex');
}

const LEGACY_IMAGE_ID_CONVERSION_REMOVE_AFTER = '2026-05-18';

function normalizeTraceTextPart(value, fallback = '') {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || String(fallback || '').trim().toLowerCase();
}

function formatImageTraceTimestamp(timestampValue) {
  const normalizedTimestamp = Number.isFinite(timestampValue)
    ? Number(timestampValue)
    : Date.now();
  const dateObject = new Date(normalizedTimestamp);
  const padTwoDigits = (numberValue) => String(numberValue).padStart(2, '0');
  return `${dateObject.getFullYear()}${padTwoDigits(dateObject.getMonth() + 1)}${padTwoDigits(dateObject.getDate())}T${padTwoDigits(dateObject.getHours())}${padTwoDigits(dateObject.getMinutes())}${padTwoDigits(dateObject.getSeconds())}`;
}

function normalizeParentImageTraceIds(parentImageTraceIdsInput) {
  const parentImageTraceIds = Array.isArray(parentImageTraceIdsInput)
    ? parentImageTraceIdsInput
    : [];
  return Array.from(
    new Set(
      parentImageTraceIds
        .map((item) => String(item || '').trim())
        .filter(Boolean)
    )
  );
}

function normalizeImageSourceKindValue(sourceKindInput) {
  const normalizedValue = normalizeTraceTextPart(sourceKindInput);
  return normalizedValue || 'unknown';
}

function normalizeImageSourceMethodValue(sourceMethodInput) {
  const normalizedValue = normalizeTraceTextPart(sourceMethodInput);
  return normalizedValue || 'unknown';
}

function buildImageTraceId({
  prefix = 'image',
  sourceKind = '',
  sourceMethod = '',
  occurredAt = Date.now(),
  parentImageTraceIds = []
} = {}) {
  const normalizedPrefix = normalizeTraceTextPart(prefix, 'image');
  const normalizedSourceKind = normalizeImageSourceKindValue(sourceKind);
  const normalizedSourceMethod = normalizeImageSourceMethodValue(sourceMethod);
  const normalizedParentImageTraceIds = normalizeParentImageTraceIds(parentImageTraceIds);
  const parentSignature = normalizedParentImageTraceIds.length
    ? normalizedParentImageTraceIds.join('-')
    : '';
  const traceSegments = [
    normalizedPrefix,
    normalizedSourceKind,
    normalizedSourceMethod,
    parentSignature,
    formatImageTraceTimestamp(occurredAt)
  ].filter(Boolean);
  return traceSegments.join('-');
}

function resolveLegacyImageDisplayFileName(imageRecord = {}, options = {}) {
  const fileNameCandidates = [
    options.displayFileName,
    imageRecord.displayFileName,
    imageRecord.originName,
    imageRecord.name,
    imageRecord.fileName,
    imageRecord.cacheFileName
  ];
  for (const fileNameCandidate of fileNameCandidates) {
    const normalizedFileName = String(fileNameCandidate || '').trim();
    if (normalizedFileName) return normalizedFileName;
  }
  const imageExt = getExtByMimeType(
    imageRecord.mimeType || imageRecord.type || options.mimeType || 'image/png'
  );
  return `${buildImageTraceId({
    prefix: options.prefix || 'image',
    sourceKind: options.imageSourceKind || imageRecord.imageSourceKind || imageRecord.source || 'unknown',
    sourceMethod: options.imageSourceMethod || imageRecord.imageSourceMethod || imageRecord.role || 'unknown',
    occurredAt: options.occurredAt || imageRecord.capturedAt || imageRecord.cachedAt || Date.now(),
    parentImageTraceIds: options.parentImageTraceIds || imageRecord.parentImageTraceIds || []
  })}.${imageExt}`;
}

function normalizeLegacyImageRecordToTraceImage(imageRecordInput, options = {}) {
  const imageRecord =
    imageRecordInput && typeof imageRecordInput === 'object' ? imageRecordInput : {};
  const normalizedParentImageTraceIds = normalizeParentImageTraceIds(
    options.parentImageTraceIds || imageRecord.parentImageTraceIds
  );
  const normalizedSourceKind = normalizeImageSourceKindValue(
    options.imageSourceKind || imageRecord.imageSourceKind || imageRecord.source
  );
  const normalizedSourceMethod = normalizeImageSourceMethodValue(
    options.imageSourceMethod || imageRecord.imageSourceMethod || imageRecord.role
  );
  const imageTraceId = String(
    imageRecord.imageTraceId ||
      options.imageTraceId ||
      buildImageTraceId({
        prefix: options.prefix || 'image',
        sourceKind: normalizedSourceKind,
        sourceMethod: normalizedSourceMethod,
        occurredAt:
          options.occurredAt ||
          imageRecord.capturedAt ||
          imageRecord.cachedAt ||
          imageRecord.createdAt ||
          Date.now(),
        parentImageTraceIds: normalizedParentImageTraceIds
      })
  ).trim();
  return {
    ...imageRecord,
    imageTraceId,
    parentImageTraceIds: normalizedParentImageTraceIds,
    imageSourceKind: normalizedSourceKind,
    imageSourceMethod: normalizedSourceMethod,
    displayFileName: resolveLegacyImageDisplayFileName(imageRecord, {
      ...options,
      imageSourceKind: normalizedSourceKind,
      imageSourceMethod: normalizedSourceMethod,
      parentImageTraceIds: normalizedParentImageTraceIds,
      prefix: options.prefix || 'image'
    }),
    legacyIdConversionTag: 'legacy-image-id-conversion-remove-after-2026-05-18',
    legacyIdConversionRemoveAfter: LEGACY_IMAGE_ID_CONVERSION_REMOVE_AFTER
  };
}

function extractImageFileLeafName(fileNameInput) {
  const normalizedFileName = String(fileNameInput || '').trim();
  if (!normalizedFileName) return '';
  return normalizedFileName.split(/[\\/]/).filter(Boolean).pop() || '';
}

function pickLegacyImageReferenceSnapshot(imageRecord = {}) {
  const legacyFieldMap = {
    cacheId: imageRecord.cacheId,
    psCacheId: imageRecord.psCacheId,
    chatCacheId: imageRecord.chatCacheId,
    cacheFileName: imageRecord.cacheFileName,
    cacheFilePath: imageRecord.cacheFilePath,
    originName: imageRecord.originName,
    oldFileName: imageRecord.oldFileName
  };
  return Object.entries(legacyFieldMap).reduce((legacyRecord, [fieldName, fieldValue]) => {
    const normalizedFieldValue = String(fieldValue || '').trim();
    if (normalizedFieldValue) legacyRecord[fieldName] = normalizedFieldValue;
    return legacyRecord;
  }, {});
}

function stripTopLevelLegacyImageReferenceFields(
  imageRecordInput = {},
  { clearPsCache = false } = {},
) {
  const imageRecord =
    imageRecordInput && typeof imageRecordInput === 'object'
      ? { ...imageRecordInput }
      : {};
  ['cacheId', 'chatCacheId', 'cacheFileName', 'cacheFilePath'].forEach((fieldName) => {
    if (Object.prototype.hasOwnProperty.call(imageRecord, fieldName)) {
      delete imageRecord[fieldName];
    }
  });
  if (clearPsCache) {
    ['psCacheId', 'psCacheExpiresAt'].forEach((fieldName) => {
      if (Object.prototype.hasOwnProperty.call(imageRecord, fieldName)) {
        delete imageRecord[fieldName];
      }
    });
  }
  return imageRecord;
}

function normalizeImageInputMethodValue(inputMethodInput, fallback = 'unknown') {
  const normalizedValue = normalizeTraceTextPart(inputMethodInput);
  return normalizedValue || normalizeTraceTextPart(fallback, 'unknown');
}

function resolveAssetRecordFileName(imageRecord = {}, options = {}) {
  const fileNameCandidates = [
    options.fileName,
    imageRecord.fileName,
    imageRecord.cacheFileName,
    imageRecord.displayFileName,
    imageRecord.originName,
    imageRecord.name,
    imageRecord.assetId,
    imageRecord.itemId,
    imageRecord.internalCacheId
  ];
  for (const fileNameCandidate of fileNameCandidates) {
    const normalizedFileName = extractImageFileLeafName(fileNameCandidate);
    if (normalizedFileName) return normalizedFileName;
  }
  const imageExt = getExtByMimeType(
    imageRecord.mimeType || imageRecord.type || options.mimeType || 'image/png'
  );
  return `${buildImageTraceId({
    prefix: options.prefix || 'image',
    sourceKind: options.imageSourceKind || imageRecord.imageSourceKind || imageRecord.source || 'unknown',
    sourceMethod: options.imageSourceMethod || imageRecord.imageSourceMethod || imageRecord.role || 'unknown',
    occurredAt:
      options.occurredAt ||
      imageRecord.capturedAt ||
      imageRecord.cachedAt ||
      imageRecord.createdAt ||
      Date.now(),
    parentImageTraceIds: options.parentImageTraceIds || imageRecord.parentImageTraceIds || []
  })}.${imageExt}`;
}

function buildImageRecordLookupKeys(imageRecordInput = {}) {
  const imageRecord =
    imageRecordInput && typeof imageRecordInput === 'object' ? imageRecordInput : {};
  const legacyImageRecord =
    imageRecord.legacy && typeof imageRecord.legacy === 'object' ? imageRecord.legacy : {};
  const stableLookupKeys = Array.from(
    new Set(
      [
        imageRecord.assetId,
        imageRecord.internalCacheId,
        imageRecord.itemId,
        imageRecord.cacheId,
        imageRecord.psCacheId,
        imageRecord.chatCacheId,
        legacyImageRecord.cacheId,
        legacyImageRecord.psCacheId,
        legacyImageRecord.chatCacheId,
        imageRecord.fileName
      ]
        .map((item) => String(item || '').trim())
        .filter(Boolean)
    )
  );
  if (stableLookupKeys.length) return stableLookupKeys;
  return Array.from(
    new Set(
      [
        imageRecord.cacheFileName,
        legacyImageRecord.cacheFileName,
        imageRecord.originName,
        legacyImageRecord.originName
      ]
        .map((item) => extractImageFileLeafName(item))
        .filter(Boolean)
    )
  );
}

function resolveAssetRecordDisplayName(imageRecordInput, fallbackLabel = 'image') {
  const imageRecord =
    imageRecordInput && typeof imageRecordInput === 'object' ? imageRecordInput : {};
  const legacyImageRecord =
    imageRecord.legacy && typeof imageRecord.legacy === 'object' ? imageRecord.legacy : {};
  const displayNameCandidates = [
    imageRecord.fileName,
    imageRecord.displayFileName,
    imageRecord.internalCacheId,
    imageRecord.itemId,
    imageRecord.cacheFileName,
    legacyImageRecord.cacheFileName,
    imageRecord.originName,
    legacyImageRecord.originName,
    legacyImageRecord.oldFileName,
    imageRecord.name
  ];
  for (const displayNameCandidate of displayNameCandidates) {
    const normalizedDisplayName = extractImageFileLeafName(displayNameCandidate);
    if (normalizedDisplayName) return normalizedDisplayName;
  }
  return toSafeText(fallbackLabel, 'image');
}

function resolveAssetRecordStoragePath(imageRecordInput) {
  const imageRecord =
    imageRecordInput && typeof imageRecordInput === 'object' ? imageRecordInput : {};
  const legacyImageRecord =
    imageRecord.legacy && typeof imageRecord.legacy === 'object' ? imageRecord.legacy : {};
  const storagePathCandidates = [
    imageRecord.filePath,
    imageRecord.cacheFilePath,
    legacyImageRecord.cacheFilePath
  ];
  for (const storagePathCandidate of storagePathCandidates) {
    const normalizedStoragePath = String(storagePathCandidate || '').trim();
    if (normalizedStoragePath) return normalizedStoragePath;
  }
  return '';
}

function normalizeLegacyImageRecordToAssetRecord(imageRecordInput, options = {}) {
  const imageRecord =
    imageRecordInput && typeof imageRecordInput === 'object' ? imageRecordInput : {};
  const traceImageRecord = normalizeLegacyImageRecordToTraceImage(imageRecord, options);
  const resolvedFileName = resolveAssetRecordFileName(traceImageRecord, options);
  const parsedAssetIdentity = parseAssetIdentityFromFileName(resolvedFileName);
  const resolvedFilePath = String(
    options.filePath || imageRecord.filePath || imageRecord.cacheFilePath || ''
  ).trim();
  const normalizedInputMethod = normalizeImageInputMethodValue(
    options.inputMethod ||
      imageRecord.inputMethod ||
      traceImageRecord.imageSourceMethod ||
      imageRecord.source ||
      'unknown'
  );
  const normalizedAssetId = String(
    options.assetId ||
      imageRecord.assetId ||
      imageRecord.itemId ||
      imageRecord.internalCacheId ||
      resolvedFileName ||
      traceImageRecord.imageTraceId
  ).trim();
  const normalizedInternalCacheId = String(
    options.internalCacheId ||
      imageRecord.internalCacheId ||
      resolvedFileName ||
      normalizedAssetId
  ).trim();
  const normalizedItemId = String(
    options.itemId ||
      imageRecord.itemId ||
      normalizedInternalCacheId ||
      normalizedAssetId
  ).trim();
  const normalizedSourceRefKey = String(
    options.sourceRefKey ||
      imageRecord.sourceRefKey ||
      parsedAssetIdentity?.sourceRefKey ||
      traceImageRecord.imageTraceId ||
      normalizedAssetId
  ).trim();
  const mergedUsageMeta = {
    ...(traceImageRecord.usageMeta && typeof traceImageRecord.usageMeta === 'object'
      ? traceImageRecord.usageMeta
      : {}),
    ...(options.usageMeta && typeof options.usageMeta === 'object' ? options.usageMeta : {})
  };
  const legacySnapshot = {
    ...(traceImageRecord.legacy && typeof traceImageRecord.legacy === 'object'
      ? traceImageRecord.legacy
      : {}),
    ...pickLegacyImageReferenceSnapshot(imageRecord)
  };
  return {
    ...traceImageRecord,
    assetId: normalizedAssetId,
    fileName: resolvedFileName,
    filePath: resolvedFilePath,
    internalCacheId: normalizedInternalCacheId,
    itemId: normalizedItemId,
    sourceRefKey: normalizedSourceRefKey,
    inputMethod: normalizedInputMethod,
    usageMeta: mergedUsageMeta,
    legacy: legacySnapshot
  };
}

function writeChatImageCacheFromBuffer(bufferInput, mimeTypeInput, context = {}) {
  const buffer = Buffer.isBuffer(bufferInput) ? bufferInput : null;
  if (!buffer?.length) return null;
  const mimeType = String(mimeTypeInput || 'image/png').trim() || 'image/png';
  const cacheId = computeBufferSha1(buffer);
  const ext = getExtByMimeType(mimeType);
  const fileName = `${cacheId}.${ext}`;
  const dir = ensureChatImageCacheDir();
  const filePath = path.join(dir, fileName);
  if (!fs.existsSync(filePath)) {
    try {
      fs.writeFileSync(filePath, buffer);
    } catch (err) {
      const wrapped = new Error(
        `聊天图片落盘失败：写入缓存文件失败（${String(err?.code || 'UNKNOWN')}）`
      );
      wrapped.code = 'CHAT_IMAGE_CACHE_WRITE_FAILED';
      wrapped.context = {
        ...(context && typeof context === 'object' ? context : {}),
        filePath,
        cacheId,
        mimeType,
        byteLength: Number(buffer?.length) || 0
      };
      wrapped.cause = err;
      throw wrapped;
    }
  }
  return {
    cacheId,
    fileName,
    filePath,
    mimeType
  };
}

function writeChatImageCacheFromDataUrl(dataUrl, context = {}) {
  const parsed = parseImageDataUrl(dataUrl);
  if (!parsed?.buffer?.length) return null;
  return writeChatImageCacheFromBuffer(parsed.buffer, parsed.mime, context);
}

function writeChatImageCacheFromFilePath(filePathInput, context = {}) {
  const resolvedFilePath = resolveExistingImageFilePath(filePathInput);
  if (!resolvedFilePath) return null;
  const buffer = fs.readFileSync(resolvedFilePath);
  if (!buffer?.length) return null;
  return writeChatImageCacheFromBuffer(
    buffer,
    getMimeTypeByExt(resolvedFilePath) || 'image/png',
    {
      ...(context && typeof context === 'object' ? context : {}),
      sourceFilePath: resolvedFilePath
    }
  );
}

function resolveChatImageCacheFileRecord(cacheIdOrPayload, options = {}) {
  const payload =
    cacheIdOrPayload && typeof cacheIdOrPayload === 'object'
      ? cacheIdOrPayload
      : {
          cacheId: cacheIdOrPayload,
          cacheFileName: options?.cacheFileName || options?.fileName || ''
        };
  const hintedFileName = extractImageFileLeafName(
    payload?.cacheFileName ||
      payload?.fileName ||
      payload?.name ||
      payload?.filePath ||
      payload?.cacheFilePath ||
      ''
  );
  const normalizedLookupPayload = {
    ...payload,
    fileName: hintedFileName || extractImageFileLeafName(payload?.fileName || ''),
    cacheFileName: hintedFileName || extractImageFileLeafName(payload?.cacheFileName || ''),
    name: hintedFileName || extractImageFileLeafName(payload?.name || ''),
    filePath: String(payload?.filePath || payload?.cacheFilePath || '').trim()
  };
  const lookupKeys = Array.from(
    new Set(
      [
        ...buildImageRecordLookupKeys(normalizedLookupPayload),
        String(payload?.cacheId || '').trim(),
        deriveCacheIdFromFileName(hintedFileName)
      ]
        .map((item) => extractImageFileLeafName(item))
        .filter(Boolean)
    )
  );
  const lookupLeafNameSet = new Set(
    lookupKeys.map((item) => extractImageFileLeafName(item)).filter(Boolean)
  );
  const lookupBaseNameSet = new Set(
    lookupKeys
      .map((item) => {
        const normalizedLeafName = extractImageFileLeafName(item);
        return String(
          path.basename(normalizedLeafName, path.extname(normalizedLeafName)) || ''
        ).trim();
      })
      .filter(Boolean)
  );
  const hintedFileNames = Array.from(
    new Set(
      [
        hintedFileName,
        extractImageFileLeafName(payload?.fileName || ''),
        extractImageFileLeafName(payload?.cacheFileName || ''),
        extractImageFileLeafName(payload?.name || '')
      ].filter(Boolean)
    )
  );
  const searchDirs = getChatImageCacheSearchDirs().filter((dirPath) => fs.existsSync(dirPath));
  if (!searchDirs.length) return null;

  const findMatchedFileName = (dirPath) => {
    try {
      return (
        fs.readdirSync(dirPath).find((entryName) => {
          const normalizedEntryName = extractImageFileLeafName(entryName);
          const normalizedEntryBaseName = String(
            path.basename(normalizedEntryName, path.extname(normalizedEntryName)) || ''
          ).trim();
          return (
            hintedFileNames.includes(normalizedEntryName) ||
            lookupLeafNameSet.has(normalizedEntryName) ||
            lookupBaseNameSet.has(normalizedEntryName) ||
            lookupBaseNameSet.has(normalizedEntryBaseName)
          );
        }) || ''
      );
    } catch {
      return '';
    }
  };

  let matchedDir = '';
  let matchedFileName = '';
  for (const dirPath of searchDirs) {
    const fileNameByLookup = findMatchedFileName(dirPath);
    if (fileNameByLookup) {
      matchedDir = dirPath;
      matchedFileName = fileNameByLookup;
      break;
    }
    for (const hintedName of hintedFileNames) {
      const hintedBaseName = String(path.basename(hintedName) || '').trim();
      const hintedPath = path.join(dirPath, hintedBaseName);
      if (hintedBaseName && fs.existsSync(hintedPath)) {
        matchedDir = dirPath;
        matchedFileName = hintedBaseName;
        break;
      }
    }
    if (matchedFileName) break;
  }
  if (!matchedFileName) return null;

  let filePath = path.join(matchedDir, matchedFileName);
  if (!fs.existsSync(filePath)) return null;

  const primaryDir = getChatImageCacheDir();
  if (
    primaryDir &&
    matchedDir &&
    path.resolve(primaryDir).toLowerCase() !== path.resolve(matchedDir).toLowerCase()
  ) {
    try {
      fs.mkdirSync(primaryDir, { recursive: true });
      const primaryFilePath = path.join(primaryDir, matchedFileName);
      if (!fs.existsSync(primaryFilePath)) {
        fs.copyFileSync(filePath, primaryFilePath);
      }
      filePath = primaryFilePath;
    } catch {}
  }

  const ext = String(path.extname(filePath) || '').replace(/^\./, '').toLowerCase();
  const mimeByExt = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    bmp: 'image/bmp',
    svg: 'image/svg+xml'
  };
  return {
    cacheId: String(path.basename(matchedFileName, path.extname(matchedFileName)) || '').trim(),
    fileName: matchedFileName,
    filePath,
    mimeType: mimeByExt[ext] || 'application/octet-stream',
    hintedFileName
  };
}

function listChatImageCacheFiles() {
  const dir = getChatImageCacheDir();
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .map((name) => {
      const filePath = path.join(dir, name);
      try {
        const stat = fs.statSync(filePath);
        if (!stat.isFile()) return null;
        const ext = String(path.extname(name) || '').replace(/^\./, '').toLowerCase();
        const cacheId = String(path.basename(name, path.extname(name)) || '').trim();
        if (!cacheId) return null;
        return {
          cacheId,
          name,
          ext,
          filePath,
          mtimeMs: Number(stat.mtimeMs || 0)
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function pruneChatImageCacheByUsedIds(usedCacheIds = new Set()) {
  const used = usedCacheIds instanceof Set ? usedCacheIds : new Set();
  const files = listChatImageCacheFiles();
  const stale = [];
  files.forEach((entry) => {
    if (!used.has(entry.cacheId)) stale.push(entry);
  });
  stale.forEach((entry) => {
    try {
      fs.unlinkSync(entry.filePath);
    } catch (err) {
      log('chat-image-cache prune unlink failed', { message: err.message, filePath: entry.filePath });
    }
  });
  const alive = files.filter((entry) => used.has(entry.cacheId))
    .sort((a, b) => (b.mtimeMs || 0) - (a.mtimeMs || 0));
  if (alive.length <= CHAT_IMAGE_CACHE_MAX_FILES) return;
  alive.slice(CHAT_IMAGE_CACHE_MAX_FILES).forEach((entry) => {
    try {
      fs.unlinkSync(entry.filePath);
    } catch (err) {
      log('chat-image-cache trim unlink failed', { message: err.message, filePath: entry.filePath });
    }
  });
}

function listFilesRecursive(dirPath) {
  const root = String(dirPath || '').trim();
  if (!root || !fs.existsSync(root)) return [];
  const out = [];
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    let names = [];
    try {
      names = fs.readdirSync(current);
    } catch {
      continue;
    }
    names.forEach((name) => {
      const fullPath = path.join(current, name);
      let stat = null;
      try {
        stat = fs.statSync(fullPath);
      } catch {
        stat = null;
      }
      if (!stat) return;
      if (stat.isDirectory()) {
        stack.push(fullPath);
        return;
      }
      if (!stat.isFile()) return;
      out.push({
        filePath: fullPath,
        name,
        size: Number(stat.size || 0),
        mtimeMs: Number(stat.mtimeMs || 0),
        ctimeMs: Number(stat.ctimeMs || 0)
      });
    });
  }
  return out;
}

function getDirectorySizeBytes(dirPath) {
  return listFilesRecursive(dirPath).reduce((sum, entry) => sum + (Number(entry.size) || 0), 0);
}

function getFileSizeBytes(filePath) {
  const target = String(filePath || '').trim();
  if (!target || !fs.existsSync(target)) return 0;
  try {
    const stat = fs.statSync(target);
    if (!stat.isFile()) return 0;
    return Number(stat.size || 0);
  } catch {
    return 0;
  }
}

function removeEmptyDirsRecursive(rootPath) {
  const root = String(rootPath || '').trim();
  if (!root || !fs.existsSync(root)) return;
  const stack = [root];
  const dirs = [];
  while (stack.length) {
    const current = stack.pop();
    let stat = null;
    try {
      stat = fs.statSync(current);
    } catch {
      stat = null;
    }
    if (!stat || !stat.isDirectory()) continue;
    dirs.push(current);
    let names = [];
    try {
      names = fs.readdirSync(current);
    } catch {
      names = [];
    }
    names.forEach((name) => stack.push(path.join(current, name)));
  }
  dirs
    .sort((a, b) => b.length - a.length)
    .forEach((dir) => {
      if (dir === root) return;
      try {
        const names = fs.readdirSync(dir);
        if (!names.length) fs.rmdirSync(dir);
      } catch {}
    });
}

function pruneDirectoryFilesByAge(dirPath, cutoffMs) {
  if (!Number.isFinite(cutoffMs) || cutoffMs <= 0) return 0;
  const files = listFilesRecursive(dirPath);
  let removed = 0;
  files.forEach((entry) => {
    const fileTime = Math.max(Number(entry.mtimeMs) || 0, Number(entry.ctimeMs) || 0);
    if (!Number.isFinite(fileTime) || fileTime <= 0 || fileTime >= cutoffMs) return;
    try {
      fs.unlinkSync(entry.filePath);
      removed += 1;
    } catch {}
  });
  removeEmptyDirsRecursive(dirPath);
  return removed;
}

function collectChatImageCacheIdsFromSessions(sessions = []) {
  const ids = new Set();
  const source = Array.isArray(sessions) ? sessions : [];
  const collectIdsFromMessageList = (messageListInput = []) => {
    const messages = Array.isArray(messageListInput) ? messageListInput : [];
    messages.forEach((message) => {
      const images = Array.isArray(message?.images) ? message.images : [];
      images.forEach((image) => {
        const { chatCacheId } = resolveChatImageIdsFromRecord(image);
        if (chatCacheId) ids.add(chatCacheId);
      });
    });
  };
  source.forEach((session) => {
    collectIdsFromMessageList(session?.messages);
    const branchEntries = Array.isArray(session?.messageBranchState?.entries)
      ? session.messageBranchState.entries
      : [];
    branchEntries.forEach((branchEntry) => {
      const variants = Array.isArray(branchEntry?.variants) ? branchEntry.variants : [];
      variants.forEach((variantItem) => {
        collectIdsFromMessageList(variantItem?.messages);
      });
    });
  });
  return ids;
}

function pruneChatSessionsByRetentionDays(retentionDays, now = Date.now()) {
  const keepDays = Number(retentionDays);
  if (!Number.isFinite(keepDays) || keepDays <= 0) return { removedCount: 0, remainingCount: 0 };
  const cutoff = now - (keepDays * 24 * 60 * 60 * 1000);
  const snapshot = readChatStateData();
  const currentSessions = Array.isArray(snapshot?.data?.sessions) ? snapshot.data.sessions : [];
  if (!currentSessions.length) return { removedCount: 0, remainingCount: 0 };
  const remainingSessions = currentSessions.filter((session) => {
    const updatedAt = Number(session?.updatedAt) || 0;
    if (!Number.isFinite(updatedAt) || updatedAt <= 0) return true;
    return updatedAt >= cutoff;
  });
  const removedCount = currentSessions.length - remainingSessions.length;
  if (removedCount <= 0) return { removedCount: 0, remainingCount: currentSessions.length };

  const currentActiveId = String(snapshot?.data?.activeId || '').trim();
  const activeExists = remainingSessions.some((session) => String(session?.id || '').trim() === currentActiveId);
  const nextActiveId = activeExists
    ? currentActiveId
    : String(remainingSessions[0]?.id || '');
  const nextData = {
    ...snapshot.data,
    updatedAt: now,
    activeId: nextActiveId,
    sessions: remainingSessions
  };
  writeChatStateData(nextData, {
    previousData: snapshot.data,
    reason: 'retention-prune'
  });
  return {
    removedCount,
    remainingCount: remainingSessions.length
  };
}

function getManagedCacheStats() {
  ensureUnifiedCacheLayout();
  const chatIndexFile = getChatIndexFile();
  const chatIndexBackupFile = getChatStateBackupFile(chatIndexFile);
  const legacyChatStateFile = getChatStateFile();
  const legacyChatBackupFile = getChatStateBackupFile(legacyChatStateFile);
  const chatBytes =
    getFileSizeBytes(chatIndexFile)
    + getFileSizeBytes(chatIndexBackupFile)
    + getDirectorySizeBytes(getChatSessionShardsDir())
    + getFileSizeBytes(legacyChatStateFile)
    + getFileSizeBytes(legacyChatBackupFile);
  const imageBytes =
    getDirectorySizeBytes(getChatImageCacheDir())
    + getDirectorySizeBytes(getPsImageCacheDir())
    + getDirectorySizeBytes(getCacheDir())
    + getDirectorySizeBytes(getGeneratedTargetMetaDir())
    + getDirectorySizeBytes(getBridgeCaptureCacheDir())
    + getDirectorySizeBytes(getBridgeCaptureCommDir());
  const logsDir = getLogsCacheDir();
  const otherBytes = getDirectorySizeBytes(logsDir);
  const totalBytes = chatBytes + imageBytes + otherBytes;
  return {
    ok: true,
    rootDir: getUnifiedCacheRootDir(),
    categories: {
      chatRecords: { bytes: chatBytes },
      images: { bytes: imageBytes },
      other: { bytes: otherBytes }
    },
    totalBytes,
    updatedAt: Date.now()
  };
}

function emitCacheCleanupResult(cleanupPayload = {}) {
  if (!win || win.isDestroyed() || !win.webContents || win.webContents.isDestroyed()) {
    return;
  }
  try {
    win.webContents.send(SHELL_EVENT_CHANNELS.cacheCleanupResult, cleanupPayload);
  } catch (err) {
    log('cache cleanup event emit failed', { message: err.message }, 'warn');
  }
}

function cleanupByCachePolicy(policyInput, reason = 'manual') {
  ensureUnifiedCacheLayout();
  const policy = sanitizeCachePolicy(policyInput || cachePolicy);
  cachePolicy = policy;
  const now = Date.now();
  let removedChatSessions = 0;
  let removedImageFiles = 0;
  let removedOtherFiles = 0;

  if (policy.chatRecords > 0) {
    const chatResult = pruneChatSessionsByRetentionDays(policy.chatRecords, now);
    removedChatSessions = Number(chatResult?.removedCount || 0);
    const snapshot = readChatStateData();
    const used = collectChatImageCacheIdsFromSessions(snapshot?.data?.sessions || []);
    pruneChatImageCacheByUsedIds(used);
  }

  if (policy.images > 0) {
    const cutoffMs = now - (policy.images * 24 * 60 * 60 * 1000);
    removedImageFiles += pruneDirectoryFilesByAge(getChatImageCacheDir(), cutoffMs);
    removedImageFiles += pruneDirectoryFilesByAge(getPsImageCacheDir(), cutoffMs);
    removedImageFiles += pruneDirectoryFilesByAge(getCacheDir(), cutoffMs);
    removedImageFiles += pruneDirectoryFilesByAge(getGeneratedTargetMetaDir(), cutoffMs);
    removedImageFiles += pruneDirectoryFilesByAge(getBridgeCaptureCacheDir(), cutoffMs);
    removedImageFiles += pruneDirectoryFilesByAge(getBridgeCaptureCommDir(), cutoffMs);
    pruneGeneratedTargetMetaDir();
  }

  if (policy.other > 0) {
    const cutoffMs = now - (policy.other * 24 * 60 * 60 * 1000);
    const logsDir = getLogsCacheDir();
    removedOtherFiles += pruneDirectoryFilesByAge(logsDir, cutoffMs);
  }

  const stats = getManagedCacheStats();
  log('cache cleanup finished', {
    reason,
    policy,
    removedChatSessions,
    removedImageFiles,
    removedOtherFiles,
    totalBytes: stats.totalBytes
  });
  const cleanupResult = {
    ok: true,
    policy,
    removedChatSessions,
    removedImageFiles,
    removedOtherFiles,
    stats
  };
  emitCacheCleanupResult({
    ...cleanupResult,
    reason,
    cleanedAt: now
  });
  return cleanupResult;
}

function scheduleCachePolicyCleanup() {
  if (cachePolicyCleanupTimer) {
    clearInterval(cachePolicyCleanupTimer);
    cachePolicyCleanupTimer = null;
  }
  cachePolicyCleanupTimer = setInterval(() => {
    try {
      cleanupByCachePolicy(cachePolicy, 'timer');
    } catch (err) {
      log('cache cleanup timer failed', { message: err.message });
    }
  }, CACHE_POLICY_CLEANUP_INTERVAL_MS);
}

function persistChatImageForSession(
  image,
  usedCacheIds,
  context = {},
  changeTracker = null,
) {
  if (!image || typeof image !== 'object') return image;
  let next = image;
  const markChanged = () => {
    changeTracker && (changeTracker.changed = true);
  };
  const ensureMutable = () => {
    if (next === image) next = { ...image };
  };
  const setFieldIfChanged = (key, value) => {
    const currentValue = String(next?.[key] || '');
    const nextValue = String(value || '');
    if (currentValue === nextValue) return;
    ensureMutable();
    if (nextValue) {
      next[key] = nextValue;
    } else {
      delete next[key];
    }
    markChanged();
  };
  const mergeLegacyReferenceSnapshot = (imageRecordInput = {}) => {
    const nextLegacySnapshot = {
      ...(next?.legacy && typeof next.legacy === 'object' ? next.legacy : {}),
      ...pickLegacyImageReferenceSnapshot(imageRecordInput)
    };
    const normalizedLegacySnapshot = Object.entries(nextLegacySnapshot).reduce(
      (result, [fieldName, fieldValue]) => {
        const normalizedFieldValue = String(fieldValue || '').trim();
        if (normalizedFieldValue) {
          result[fieldName] = normalizedFieldValue;
        }
        return result;
      },
      {}
    );
    const currentLegacySnapshot =
      next?.legacy && typeof next.legacy === 'object' ? next.legacy : {};
    if (JSON.stringify(currentLegacySnapshot) === JSON.stringify(normalizedLegacySnapshot)) {
      return;
    }
    ensureMutable();
    if (Object.keys(normalizedLegacySnapshot).length) {
      next.legacy = normalizedLegacySnapshot;
    } else {
      delete next.legacy;
    }
    markChanged();
  };
  const clearTopLevelLegacyReferenceFields = ({
    clearPsCache = false
  } = {}) => {
    const fieldNames = ['cacheId', 'chatCacheId', 'cacheFileName', 'cacheFilePath'];
    if (clearPsCache) {
      fieldNames.push('psCacheId', 'psCacheExpiresAt');
    }
    let didDeleteField = false;
    fieldNames.forEach((fieldName) => {
      if (!Object.prototype.hasOwnProperty.call(next || {}, fieldName)) return;
      if (!didDeleteField) {
        ensureMutable();
        didDeleteField = true;
      }
      delete next[fieldName];
    });
    if (didDeleteField) {
      markChanged();
    }
  };
  const resolveStableDisplayFileName = (fallbackFileName = '') =>
    String(
      next?.fileName ||
        next?.originName ||
        next?.legacy?.originName ||
        next?.name ||
        fallbackFileName ||
        ''
    ).trim();
  const syncStableAssetFields = (imageRecordInput, options = {}) => {
    const assetRecord = normalizeLegacyImageRecordToAssetRecord(imageRecordInput, {
      prefix: 'chat',
      assetId:
        options.assetId ||
        imageRecordInput?.assetId ||
        imageRecordInput?.internalCacheId ||
        imageRecordInput?.itemId ||
        imageRecordInput?.sourceRefKey ||
        '',
      internalCacheId:
        options.internalCacheId ||
        imageRecordInput?.internalCacheId ||
        imageRecordInput?.assetId ||
        imageRecordInput?.itemId ||
        imageRecordInput?.sourceRefKey ||
        '',
      itemId:
        options.itemId ||
        imageRecordInput?.itemId ||
        imageRecordInput?.internalCacheId ||
        imageRecordInput?.assetId ||
        imageRecordInput?.sourceRefKey ||
        '',
      fileName:
        options.fileName ||
        imageRecordInput?.fileName ||
        imageRecordInput?.cacheFileName ||
        imageRecordInput?.name ||
        '',
      filePath:
        options.filePath ||
        imageRecordInput?.filePath ||
        imageRecordInput?.cacheFilePath ||
        '',
      inputMethod:
        options.inputMethod ||
        imageRecordInput?.inputMethod ||
        imageRecordInput?.source ||
        'chat',
      sourceRefKey:
        options.sourceRefKey ||
        imageRecordInput?.sourceRefKey ||
        '',
      usageMeta: {
        ownerType: 'chat-image-cache',
        ...(imageRecordInput?.usageMeta && typeof imageRecordInput.usageMeta === 'object'
          ? imageRecordInput.usageMeta
          : {}),
        ...(options.usageMeta && typeof options.usageMeta === 'object' ? options.usageMeta : {}),
      },
    });
    setFieldIfChanged('assetId', assetRecord.assetId);
    setFieldIfChanged('fileName', assetRecord.fileName);
    setFieldIfChanged('filePath', assetRecord.filePath);
    setFieldIfChanged('internalCacheId', assetRecord.internalCacheId);
    setFieldIfChanged('itemId', assetRecord.itemId);
    setFieldIfChanged('sourceRefKey', assetRecord.sourceRefKey);
    setFieldIfChanged('inputMethod', assetRecord.inputMethod);
  };

  const dataUrl = String(image.dataUrl || '').trim();
  if (dataUrl.startsWith('data:image/')) {
    const cached = writeChatImageCacheFromDataUrl(dataUrl, context);
    if (cached?.cacheId) {
      usedCacheIds.add(cached.cacheId);
      setFieldIfChanged('cacheMimeType', cached.mimeType);
      if (String(next.dataUrl || '').trim()) {
        ensureMutable();
        next.dataUrl = '';
        markChanged();
      }
      mergeLegacyReferenceSnapshot({
        ...next,
        cacheId: cached.cacheId,
        chatCacheId: cached.cacheId,
        cacheFileName: cached.fileName,
        cacheFilePath: cached.filePath,
      });
      syncStableAssetFields(
        {
          ...next,
          fileName: resolveStableDisplayFileName(cached.fileName),
          filePath: cached.filePath,
          cacheFileName: cached.fileName,
          cacheFilePath: cached.filePath,
          cacheId: cached.cacheId,
          type: cached.mimeType,
        },
        {
          assetId: String(next.assetId || next.internalCacheId || next.itemId || next.sourceRefKey || '').trim(),
          internalCacheId: String(next.internalCacheId || next.assetId || next.itemId || next.sourceRefKey || '').trim(),
          itemId: String(next.itemId || next.internalCacheId || next.assetId || next.sourceRefKey || '').trim(),
          fileName: resolveStableDisplayFileName(cached.fileName),
          filePath: cached.filePath,
        }
      );
      clearTopLevelLegacyReferenceFields({ clearPsCache: true });
      return next;
    }
  }

  const { chatCacheId, psCacheId, fileDerivedId } = resolveChatImageIdsFromRecord(image);
  if (chatCacheId) {
    usedCacheIds.add(chatCacheId);
    const existingChatCache = resolveChatImageCacheFileRecord(
      {
        ...next,
        cacheId: chatCacheId,
        cacheFileName: next.cacheFileName || next.fileName || '',
        filePath: next.cacheFilePath || next.filePath || '',
      },
      {},
    );
    if (String(next.dataUrl || '').trim()) {
      ensureMutable();
      next.dataUrl = '';
      markChanged();
    }
    let fallbackCacheFileName = '';
    if (existingChatCache?.fileName) {
      fallbackCacheFileName = existingChatCache.fileName;
      setFieldIfChanged('cacheMimeType', existingChatCache.mimeType);
    } else if (!String(next.cacheFileName || '').trim() && fileDerivedId && !isPsCacheId(fileDerivedId)) {
      const currentMimeType = String(next.cacheMimeType || next.type || '').trim();
      const nextExt = getExtByMimeType(currentMimeType || 'image/png');
      fallbackCacheFileName = `${fileDerivedId}.${nextExt}`;
    }
    mergeLegacyReferenceSnapshot({
      ...next,
      cacheId: chatCacheId,
      chatCacheId,
      cacheFileName: String(
        existingChatCache?.fileName || next.cacheFileName || fallbackCacheFileName || ''
      ).trim(),
      cacheFilePath: String(
        existingChatCache?.filePath || next.cacheFilePath || next.filePath || ''
      ).trim(),
      psCacheId,
    });
    syncStableAssetFields(
      {
        ...next,
        cacheId: chatCacheId,
        fileName: resolveStableDisplayFileName(existingChatCache?.fileName || next.cacheFileName || ''),
        filePath: String(existingChatCache?.filePath || next.cacheFilePath || next.filePath || '').trim(),
        cacheFileName: String(existingChatCache?.fileName || next.cacheFileName || '').trim(),
        cacheFilePath: String(existingChatCache?.filePath || next.cacheFilePath || next.filePath || '').trim(),
        type: String(existingChatCache?.mimeType || next.cacheMimeType || next.type || '').trim(),
      },
      {
        assetId: String(next.assetId || next.internalCacheId || next.itemId || next.sourceRefKey || '').trim(),
        internalCacheId: String(next.internalCacheId || next.assetId || next.itemId || next.sourceRefKey || '').trim(),
        itemId: String(next.itemId || next.internalCacheId || next.assetId || next.sourceRefKey || '').trim(),
        fileName: resolveStableDisplayFileName(existingChatCache?.fileName || next.cacheFileName || ''),
        filePath: String(existingChatCache?.filePath || next.cacheFilePath || next.filePath || '').trim(),
      }
    );
    clearTopLevelLegacyReferenceFields({ clearPsCache: true });
    return next;
  }

  if (psCacheId) {
    const psCacheData = readPsImageCacheDataUrl(psCacheId, { ignoreExpiry: true });
    const psCacheDataUrl = String(psCacheData?.dataUrl || '').trim();
    if (psCacheDataUrl.startsWith('data:image/')) {
      const migrated = writeChatImageCacheFromDataUrl(psCacheDataUrl, {
        ...(context && typeof context === 'object' ? context : {}),
        migratedFromPsCacheId: psCacheId,
      });
      if (migrated?.cacheId) {
        usedCacheIds.add(migrated.cacheId);
        setFieldIfChanged('cacheMimeType', migrated.mimeType);
        if (String(next.dataUrl || '').trim()) {
          ensureMutable();
          next.dataUrl = '';
          markChanged();
        }
        mergeLegacyReferenceSnapshot({
          ...next,
          cacheId: migrated.cacheId,
          chatCacheId: migrated.cacheId,
          cacheFileName: migrated.fileName,
          cacheFilePath: migrated.filePath,
          psCacheId,
        });
        syncStableAssetFields(
          {
            ...next,
            fileName: resolveStableDisplayFileName(migrated.fileName),
            filePath: migrated.filePath,
            cacheFileName: migrated.fileName,
            cacheFilePath: migrated.filePath,
            cacheId: migrated.cacheId,
            type: migrated.mimeType,
          },
          {
            assetId: String(next.assetId || next.internalCacheId || next.itemId || next.sourceRefKey || '').trim(),
            internalCacheId: String(next.internalCacheId || next.assetId || next.itemId || next.sourceRefKey || '').trim(),
            itemId: String(next.itemId || next.internalCacheId || next.assetId || next.sourceRefKey || '').trim(),
            fileName: resolveStableDisplayFileName(migrated.fileName),
            filePath: migrated.filePath,
          }
        );
        clearTopLevelLegacyReferenceFields({ clearPsCache: true });
        return next;
      }
    }
  }
  return next;
}

function persistMessageListImagesForSession(
  messageListInput,
  usedCacheIds,
  {
    sessionId = '',
    sessionIndex = -1,
    branchRootId = '',
    branchEntryIndex = -1,
    variantIndex = -1,
  } = {},
  changeTracker = null,
) {
  const sourceMessageList = Array.isArray(messageListInput) ? messageListInput : [];
  let hasMessageListChanged = false;
  const nextMessageList = sourceMessageList.map((message, messageIndex) => {
    const messageId = String(message?.id || '').trim();
    if (!Array.isArray(message?.images) || !message.images.length) return message;
    let hasMessageImageChanged = false;
    const images = message.images.map((image, imageIndex) => {
      const nextImage = persistChatImageForSession(
        image,
        usedCacheIds,
        {
          sessionId,
          sessionIndex,
          messageId,
          messageIndex,
          imageIndex,
          branchRootId,
          branchEntryIndex,
          variantIndex,
        },
        changeTracker,
      );
      if (nextImage !== image) {
        hasMessageImageChanged = true;
      }
      return nextImage;
    });
    if (!hasMessageImageChanged) return message;
    hasMessageListChanged = true;
    return { ...message, images };
  });
  return {
    messages: nextMessageList,
    changed: hasMessageListChanged,
  };
}

function persistBranchStateImagesForSession(
  branchStateInput,
  usedCacheIds,
  {
    sessionId = '',
    sessionIndex = -1,
  } = {},
  changeTracker = null,
) {
  const sourceEntries = Array.isArray(branchStateInput?.entries)
    ? branchStateInput.entries
    : [];
  if (!sourceEntries.length) {
    return {
      branchState: branchStateInput,
      changed: false,
    };
  }
  let hasBranchStateChanged = false;
  const nextEntries = sourceEntries.map((entryItem, branchEntryIndex) => {
    const sourceVariants = Array.isArray(entryItem?.variants) ? entryItem.variants : [];
    if (!sourceVariants.length) return entryItem;
    const branchRootId = String(entryItem?.branchRootId || '').trim();
    let hasEntryChanged = false;
    const nextVariants = sourceVariants.map((variantItem, variantIndex) => {
      const { messages, changed } = persistMessageListImagesForSession(
        variantItem?.messages,
        usedCacheIds,
        {
          sessionId,
          sessionIndex,
          branchRootId,
          branchEntryIndex,
          variantIndex,
        },
        changeTracker,
      );
      if (!changed) return variantItem;
      hasEntryChanged = true;
      return {
        ...variantItem,
        messages,
        updatedAt: Date.now(),
      };
    });
    if (!hasEntryChanged) return entryItem;
    hasBranchStateChanged = true;
    return {
      ...entryItem,
      variants: nextVariants,
    };
  });
  if (!hasBranchStateChanged) {
    return {
      branchState: branchStateInput,
      changed: false,
    };
  }
  return {
    branchState: {
      ...(branchStateInput && typeof branchStateInput === 'object' ? branchStateInput : {}),
      entries: nextEntries,
    },
    changed: true,
  };
}

function persistChatSessionsWithoutInlineImages(sessions = []) {
  const usedCacheIds = new Set();
  const changeTracker = { changed: false };
  const nextSessions = Array.isArray(sessions)
    ? sessions.map((session, sessionIndex) => {
        const sessionId = String(session?.id || '').trim();
        const {
          messages,
          changed: hasSessionMessageChanged,
        } = persistMessageListImagesForSession(
          session?.messages,
          usedCacheIds,
          {
            sessionId,
            sessionIndex,
          },
          changeTracker,
        );
        const {
          branchState: nextBranchState,
          changed: hasBranchStateChanged,
        } = persistBranchStateImagesForSession(
          session?.messageBranchState,
          usedCacheIds,
          {
            sessionId,
            sessionIndex,
          },
          changeTracker,
        );
        if (!hasSessionMessageChanged && !hasBranchStateChanged) return session;
        changeTracker.changed = true;
        const nextSession = {
          ...session,
          messages,
        };
        if (hasBranchStateChanged) {
          nextSession.messageBranchState = nextBranchState;
        }
        return nextSession;
      })
    : [];
  return { sessions: nextSessions, usedCacheIds, changed: !!changeTracker.changed };
}

function persistApiInputImageRecord(
  imageInput,
  usedCacheIds = new Set(),
  context = {},
) {
  if (!imageInput || typeof imageInput !== 'object') return imageInput;
  const image = {
    ...imageInput,
    usageMeta: {
      ...(imageInput?.usageMeta && typeof imageInput.usageMeta === 'object'
        ? imageInput.usageMeta
        : {}),
      ownerType:
        String(
          context?.usageMeta?.ownerType
          || imageInput?.usageMeta?.ownerType
          || 'api-input-cache'
        ).trim() || 'api-input-cache',
      ...(context?.usageMeta && typeof context.usageMeta === 'object'
        ? context.usageMeta
        : {})
    }
  };
  const normalizedDataUrl = String(image.dataUrl || '').trim();
  const directFilePath = resolveExistingImageFilePath(
    image.filePath || image.cacheFilePath || ''
  );
  const { chatCacheId } = resolveChatImageIdsFromRecord(image);
  if (!chatCacheId && !normalizedDataUrl.startsWith('data:image/') && directFilePath) {
    const cached = writeChatImageCacheFromFilePath(directFilePath, context);
    if (cached?.cacheId) {
      return persistChatImageForSession(
        {
          ...image,
          cacheId: cached.cacheId,
          chatCacheId: cached.cacheId,
          cacheFileName: cached.fileName,
          cacheFilePath: cached.filePath,
          filePath: cached.filePath,
          type: cached.mimeType,
          dataUrl: '',
          psCacheId: '',
          psCacheExpiresAt: undefined
        },
        usedCacheIds,
        context,
        null
      );
    }
  }
  return persistChatImageForSession(image, usedCacheIds, context, null);
}

function persistApiInputImageList(sourceImageListInput = [], options = {}) {
  const sourceImageList = Array.isArray(sourceImageListInput) ? sourceImageListInput : [];
  const usedCacheIds = options.usedCacheIds instanceof Set ? options.usedCacheIds : new Set();
  return sourceImageList.map((imageItem, imageIndex) => {
    const clientRef = String(
      imageItem?.clientRef
        || imageItem?.id
        || imageItem?.assetId
        || imageItem?.internalCacheId
        || imageItem?.itemId
        || imageItem?.sourceRefKey
        || `api-image-${imageIndex + 1}`
    ).trim();
    const persistedImage = persistApiInputImageRecord(
      {
        ...(imageItem && typeof imageItem === 'object' ? imageItem : {}),
        clientRef
      },
      usedCacheIds,
      {
        ...(options?.context && typeof options.context === 'object' ? options.context : {}),
        clientRef,
        imageIndex
      }
    );
    return {
      ...(persistedImage && typeof persistedImage === 'object' ? persistedImage : {}),
      clientRef,
    };
  });
}

function hasInlineImageDataInMessageList(messageListInput) {
  const sourceMessageList = Array.isArray(messageListInput) ? messageListInput : [];
  return sourceMessageList.some((message) => (
    Array.isArray(message?.images)
    && message.images.some((image) => String(image?.dataUrl || '').trim().startsWith('data:image/'))
  ));
}

function hasInlineImageDataInSessions(sessions = []) {
  if (!Array.isArray(sessions) || !sessions.length) return false;
  return sessions.some((session) => {
    const hasInlineDataInMainMessages = hasInlineImageDataInMessageList(session?.messages);
    if (hasInlineDataInMainMessages) return true;
    const branchEntries = Array.isArray(session?.messageBranchState?.entries)
      ? session.messageBranchState.entries
      : [];
    return branchEntries.some((entryItem) => {
      const variants = Array.isArray(entryItem?.variants) ? entryItem.variants : [];
      return variants.some((variantItem) =>
        hasInlineImageDataInMessageList(variantItem?.messages));
    });
  });
}

function readChatImageCacheDataUrl(cacheIdOrPayload, options = {}) {
  const resolvedChatCacheFile = resolveChatImageCacheFileRecord(cacheIdOrPayload, options);
  if (!resolvedChatCacheFile) return null;
  const { cacheId: normalizedCacheId, fileName: matchedFileName, filePath, mimeType, hintedFileName } =
    resolvedChatCacheFile;
  const buffer = fs.readFileSync(filePath);
  if (!buffer?.length) return null;
  const resolvedDisplayName = String(hintedFileName || matchedFileName || '').trim();
  const normalizedLegacyImageRecord = {
    ok: true,
    cacheId: normalizedCacheId,
    cacheFileName: matchedFileName,
    cacheFilePath: filePath,
    fileName: resolvedDisplayName || matchedFileName,
    filePath,
    mimeType,
    dataUrl: `data:${mimeType};base64,${buffer.toString('base64')}`
  };
  const assetRecord = normalizeLegacyImageRecordToAssetRecord(
    normalizedLegacyImageRecord,
    {
      prefix: 'chat',
      imageSourceKind: 'chat',
      imageSourceMethod: 'cache',
      assetId: normalizedCacheId,
      internalCacheId: normalizedCacheId,
      itemId: normalizedCacheId,
      displayFileName: resolvedDisplayName || matchedFileName || '',
      fileName: resolvedDisplayName || matchedFileName || '',
      filePath,
      inputMethod: 'chat-cache',
      usageMeta: {
        ownerType: 'chat-image-cache',
        ownerId: normalizedCacheId
      }
    }
  );
  return {
    ...stripTopLevelLegacyImageReferenceFields(assetRecord),
    ok: true,
    dataUrl: normalizedLegacyImageRecord.dataUrl
  };
}

async function resolveGeneratedCacheSource(item = {}) {
  const raw = String(item?.dataUrl || item?.sourceUrl || '').trim();
  if (!raw) return null;
  const parsed = parseImageDataUrl(raw);
  if (parsed?.buffer?.length) {
    return {
      mime: String(item?.type || parsed.mime || 'application/octet-stream'),
      buffer: parsed.buffer
    };
  }
  if (!/^https?:\/\//i.test(raw)) return null;
  const response = await fetch(raw);
  if (!response.ok) {
    throw new Error(`download_failed_http_${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  if (!buffer.length) {
    throw new Error('download_empty_buffer');
  }
  const contentType = String(response.headers.get('content-type') || '').split(';')[0].trim();
  return {
    mime: String(item?.type || contentType || 'application/octet-stream'),
    buffer
  };
}

function normalizeTargetRect(input) {
  if (!input || typeof input !== 'object') return null;
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
  if (!input || typeof input !== 'object') return null;
  const width = Number(input.width);
  const height = Number(input.height);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  return {
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height))
  };
}

function normalizeTargetRectNorm(input) {
  if (!input || typeof input !== 'object') return null;
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

function normalizeCaptureMeta(input) {
  if (!input || typeof input !== 'object') return null;
  const sourceBounds = normalizeTargetRect(input?.sourceBounds);
  const targetSize = normalizeTargetCanvas(input?.targetSize);
  const schemaVersionRaw = Number(input?.schemaVersion);
  const componentSizeRaw = Number(input?.componentSize);
  const rawByteLengthRaw = Number(input?.rawByteLength);
  const encodedByteLengthRaw = Number(input?.encodedByteLength);
  const imageDataWidthRaw = Number(input?.imageDataWidth);
  const imageDataHeightRaw = Number(input?.imageDataHeight);
  const bitsPerChannelRaw = Number(input?.bitsPerChannel);
  const outputQualityRequestedRaw = Number(input?.outputQualityRequested);
  const outputQualityActualRaw = Number(input?.outputQualityActual);
  const outputChannelCountRaw = Number(input?.outputChannelCount);
  const outputPixelDepthRaw = Number(input?.outputPixelDepth);
  const outputMaxSideRequestedRaw = Number(input?.outputMaxSideRequested);
  const outputMaxSideActualRaw = Number(input?.outputMaxSideActual);
  const normalizeCaptureOutputFormat = (rawValue) => {
    const value = String(rawValue || '').trim().toLowerCase();
    if (value === 'png') return 'png';
    if (value === 'jpg' || value === 'jpeg') return 'jpg';
    return undefined;
  };
  const normalized = {
    schemaVersion: Number.isFinite(schemaVersionRaw) ? Math.max(1, Math.round(schemaVersionRaw)) : undefined,
    colorSpace: input?.colorSpace ? String(input.colorSpace) : undefined,
    componentSize: Number.isFinite(componentSizeRaw) ? Math.max(1, Math.round(componentSizeRaw)) : undefined,
    colorProfile: input?.colorProfile ? String(input.colorProfile) : undefined,
    usedPreferredColorProfile:
      typeof input?.usedPreferredColorProfile === 'boolean'
        ? input.usedPreferredColorProfile
        : undefined,
    preferredColorProfileError:
      input?.preferredColorProfileError ? String(input.preferredColorProfileError) : undefined,
    sourceBounds: sourceBounds || undefined,
    targetSize: targetSize || undefined,
    rawByteLength: Number.isFinite(rawByteLengthRaw)
      ? Math.max(0, Math.round(rawByteLengthRaw))
      : undefined,
    encodedByteLength: Number.isFinite(encodedByteLengthRaw)
      ? Math.max(0, Math.round(encodedByteLengthRaw))
      : undefined,
    imageDataWidth: Number.isFinite(imageDataWidthRaw)
      ? Math.max(1, Math.round(imageDataWidthRaw))
      : undefined,
    imageDataHeight: Number.isFinite(imageDataHeightRaw)
      ? Math.max(1, Math.round(imageDataHeightRaw))
      : undefined,
    documentMode: input?.documentMode ? String(input.documentMode) : undefined,
    bitsPerChannel: Number.isFinite(bitsPerChannelRaw)
      ? Math.max(1, Math.round(bitsPerChannelRaw))
      : undefined,
    alphaPreserved:
      typeof input?.alphaPreserved === 'boolean'
        ? input.alphaPreserved
        : undefined,
    outputChannelCount: Number.isFinite(outputChannelCountRaw)
      ? Math.max(1, Math.round(outputChannelCountRaw))
      : undefined,
    outputPixelDepth: Number.isFinite(outputPixelDepthRaw)
      ? Math.max(1, Math.round(outputPixelDepthRaw))
      : undefined,
    outputFormatRequested: normalizeCaptureOutputFormat(input?.outputFormatRequested),
    outputFormatActual: normalizeCaptureOutputFormat(input?.outputFormatActual),
    outputQualityRequested: Number.isFinite(outputQualityRequestedRaw)
      ? Math.max(0, Math.min(1, outputQualityRequestedRaw))
      : undefined,
    outputQualityActual: Number.isFinite(outputQualityActualRaw)
      ? Math.max(0, Math.min(1, outputQualityActualRaw))
      : undefined,
    outputMaxSideRequested: Number.isFinite(outputMaxSideRequestedRaw)
      ? Math.max(1, Math.round(outputMaxSideRequestedRaw))
      : undefined,
    outputMaxSideActual: Number.isFinite(outputMaxSideActualRaw)
      ? Math.max(1, Math.round(outputMaxSideActualRaw))
      : undefined,
    encodeStrategy: input?.encodeStrategy ? String(input.encodeStrategy) : undefined,
    primaryEncodeError: input?.primaryEncodeError ? String(input.primaryEncodeError) : undefined,
    fallbackReason: input?.fallbackReason ? String(input.fallbackReason) : undefined
  };
  return Object.keys(normalized).some((key) => normalized[key] !== undefined)
    ? normalized
    : null;
}

function normalizeTargetDocumentId(input) {
  const value = Number(input);
  if (!Number.isFinite(value)) return null;
  const safeValue = Math.round(value);
  return safeValue > 0 ? safeValue : null;
}

function normalizeImportLayerType(raw) {
  const value = String(raw || '').trim().toLowerCase();
  return value === 'rasterized' ? 'rasterized' : 'smart-object';
}

function detectCaptureErrorCode(rawMessage, action = '') {
  const text = String(rawMessage || '').trim();
  if (!text) return '';
  const lower = text.toLowerCase();
  const normalizedAction = String(action || '').trim().toLowerCase();
  if (
    /no[\s_-]*active[\s_-]*selection|selection[_\s-]*not[_\s-]*found|no[\s_-]*selection/.test(lower)
  ) {
    return 'no_selection';
  }
  if (
    /no[\s_-]*active[\s_-]*document|no_document/.test(lower)
    || /未找到活动文档|无活动文档/.test(text)
  ) {
    return 'no_document';
  }
  if (/capture[_\s-]*file[_\s-]*path[_\s-]*required|capture_file_path_required/.test(lower)) {
    return normalizedAction === 'select' ? 'capture_selection_unavailable' : 'capture_canvas_unavailable';
  }
  if (/capture[_\s-]*payload[_\s-]*too[_\s-]*large|capture_payload_too_large/.test(lower)) {
    return 'capture_payload_too_large';
  }
  if (
    /cannot[\s_-]*input[\s_-]*clipboard|cannot_input_clipboard/.test(lower)
    || /不能输入剪贴板/.test(text)
  ) {
    return normalizedAction === 'select'
      ? 'capture_selection_clipboard_unavailable'
      : 'capture_canvas_clipboard_unavailable';
  }
  if (
    /cannot[\s_-]*update[\s_-]*smart[\s_-]*object[\s_-]*file|unable[\s_-]*to[\s_-]*update[\s_-]*smart[\s_-]*object[\s_-]*file|smart[_\s-]*object[_\s-]*update[_\s-]*failed|capture_runtime_conflict/.test(lower)
    || /无法更新智能对象文件/.test(text)
  ) {
    return normalizedAction === 'select'
      ? 'capture_selection_runtime_conflict'
      : 'capture_canvas_runtime_conflict';
  }
  if (
    /capture_get_pixels_failed|capture_image_data_missing|capture_get_data_failed/.test(lower)
  ) {
    return normalizedAction === 'select'
      ? 'capture_selection_runtime_conflict'
      : 'capture_canvas_runtime_conflict';
  }
  if (
    /queue_result_action_mismatch|action_type_mismatch|bridge_action_type_mismatch|capture_action_domain_mismatch/.test(lower)
  ) {
    return 'bridge_action_type_mismatch';
  }
  if (/bridge_runtime_contract_mismatch/.test(lower)) {
    return 'bridge_runtime_contract_mismatch';
  }
  return '';
}

function normalizeCaptureBridgeError(rawMessage, action = '') {
  const message = String(rawMessage || '').trim();
  const code = detectCaptureErrorCode(message, action);
  if (code === 'no_selection') {
    return {
      code,
      message: 'no_selection',
      rawMessage: message || 'No active selection'
    };
  }
  if (code === 'no_document') {
    return {
      code,
      message: 'no_document',
      rawMessage: message || 'No active document'
    };
  }
  if (code === 'bridge_action_type_mismatch') {
    return {
      code,
      message: 'capture_action_domain_mismatch',
      rawMessage: message || 'queue_result_action_mismatch'
    };
  }
  if (code === 'bridge_runtime_contract_mismatch') {
    return {
      code,
      message: 'bridge_runtime_contract_mismatch',
      rawMessage: message || 'bridge_runtime_contract_mismatch'
    };
  }
  if (
    code === 'capture_selection_clipboard_unavailable'
    || code === 'capture_canvas_clipboard_unavailable'
  ) {
    return {
      code,
      message: code,
      rawMessage: message || 'cannot_input_clipboard'
    };
  }
  if (
    code === 'capture_selection_runtime_conflict'
    || code === 'capture_canvas_runtime_conflict'
  ) {
    return {
      code,
      message: code,
      rawMessage: message || 'capture_runtime_conflict'
    };
  }
  if (code === 'capture_payload_too_large') {
    return {
      code,
      message: code,
      rawMessage: message || 'capture_payload_too_large'
    };
  }
  if (
    code === 'capture_selection_unavailable'
    || code === 'capture_canvas_unavailable'
  ) {
    return {
      code,
      message: code,
      rawMessage: message || 'capture_file_path_required'
    };
  }
  return {
    code,
    message: message || 'capture_failed',
    rawMessage: message
  };
}

function removePsCacheEntryFile(entry) {
  const filePath = String(entry?.filePath || '');
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (err) {
    log('ps-cache unlink failed', { message: err.message, filePath });
  }
}

function prunePsImageCache(now = Date.now()) {
  for (const [cacheId, entry] of psImageCacheMap.entries()) {
    if (!entry || !Number.isFinite(entry.expiresAt) || entry.expiresAt <= now) {
      removePsCacheEntryFile(entry);
      psImageCacheMap.delete(cacheId);
    }
  }
  if (psImageCacheMap.size <= PS_CACHE_MAX_ITEMS) return;
  const overflow = psImageCacheMap.size - PS_CACHE_MAX_ITEMS;
  const staleList = Array.from(psImageCacheMap.values())
    .sort((a, b) => (a.cachedAt || 0) - (b.cachedAt || 0))
    .slice(0, overflow);
  staleList.forEach((entry) => {
    removePsCacheEntryFile(entry);
    psImageCacheMap.delete(entry.cacheId);
  });
}

function clearPsImageCache() {
  for (const entry of psImageCacheMap.values()) {
    removePsCacheEntryFile(entry);
  }
  psImageCacheMap.clear();
  try {
    const dir = ensurePsImageCacheDir();
    fs.readdirSync(dir).forEach((name) => {
      const fullPath = path.join(dir, name);
      try {
        if (fs.statSync(fullPath).isFile()) fs.unlinkSync(fullPath);
      } catch {}
    });
  } catch {}
}

function formatAssetFileTimestampPrecise(timestampValue = Date.now()) {
  const normalizedTimestamp = Number.isFinite(Number(timestampValue))
      ? Number(timestampValue)
      : Date.now(),
    dateObject = new Date(normalizedTimestamp),
    padTwoDigits = (numberValue) => String(numberValue).padStart(2, '0'),
    padThreeDigits = (numberValue) => String(numberValue).padStart(3, '0');
  return `${dateObject.getFullYear()}${padTwoDigits(dateObject.getMonth() + 1)}${padTwoDigits(dateObject.getDate())}T${padTwoDigits(dateObject.getHours())}${padTwoDigits(dateObject.getMinutes())}${padTwoDigits(dateObject.getSeconds())}${padThreeDigits(dateObject.getMilliseconds())}`;
}

function resolvePsAssetSourceToken(sourceInput = '') {
  const normalizedSource = String(sourceInput || '').trim().toLowerCase();
  if (normalizedSource === 'ps-select') return 'psselect';
  if (normalizedSource === 'ps-full') return 'pscanvas';
  if (normalizedSource === 'local' || normalizedSource === 'drop' || normalizedSource === 'paste') {
    return 'upload';
  }
  if (normalizedSource === 'run') return 'run';
  if (normalizedSource === 'return') return 'return';
  return normalizeTraceTextPart(normalizedSource, 'image');
}

function resolvePsAssetUsageToken(sourceToken = '', usageInput = '') {
  const normalizedUsage = normalizeTraceTextPart(usageInput);
  if (normalizedUsage) return normalizedUsage;
  if (sourceToken === 'upload') return 'input';
  if (sourceToken === 'run') return 'result';
  if (sourceToken === 'return') return 'export';
  return 'upload';
}

function buildPsAssetSequenceToken(sourceToken = '', sequenceIndex = 1) {
  const normalizedSequenceIndex = Math.max(
      1,
      Math.floor(Number.isFinite(Number(sequenceIndex)) ? Number(sequenceIndex) : 1),
    ),
    sequencePrefix = sourceToken === 'upload'
      ? 'up'
      : sourceToken === 'run'
        ? 'r'
        : sourceToken === 'return'
          ? 'rt'
          : sourceToken.startsWith('ps')
            ? 'ps'
            : 'it';
  return sequencePrefix === 'r'
    ? `r${normalizedSequenceIndex}`
    : `${sequencePrefix}${String(normalizedSequenceIndex).padStart(2, '0')}`;
}

function parseAssetIdentityFromFileName(fileNameInput = '') {
  const normalizedLeafName = extractImageFileLeafName(fileNameInput);
  if (!normalizedLeafName) return null;
  const fileStem = String(path.basename(normalizedLeafName, path.extname(normalizedLeafName)) || '').trim();
  if (!fileStem) return null;
  const stemParts = fileStem
    .split('_')
    .map((part) => String(part || '').trim())
    .filter(Boolean);
  if (stemParts.length < 4) {
    return { fileStem, stemParts, sourceRefKey: '' };
  }
  const sequenceToken = stemParts[stemParts.length - 1];
  const timestampToken = stemParts[stemParts.length - 2];
  const looksLikeTimestamp = /^\d{8}T\d{9}$/.test(timestampToken);
  const looksLikeSequence = /^(?:ps|up|rt|it)\d{2}$|^r\d+$/.test(sequenceToken);
  if (!looksLikeTimestamp || !looksLikeSequence) {
    return { fileStem, stemParts, sourceRefKey: '' };
  }
  const isTempIdentity = stemParts[1] === 'temp';
  return {
    fileStem,
    stemParts,
    sourceToken: stemParts[0] || '',
    usageToken: isTempIdentity ? 'temp' : (stemParts[1] || ''),
    tempKind: isTempIdentity ? (stemParts.slice(2, -2).join('_') || '') : '',
    timestampToken,
    sequenceToken,
    sourceRefKey: `${timestampToken}_${sequenceToken}`,
  };
}

function buildPsAssetTempIdentity({
  mimeType = 'image/png',
  source = '',
  tempKind = 'temp',
  occurredAt = Date.now(),
  sequenceIndex = 1,
} = {}) {
  const sourceToken = resolvePsAssetSourceToken(source);
  const normalizedTempKind = normalizeTraceTextPart(tempKind, 'temp');
  const timestampToken = formatAssetFileTimestampPrecise(occurredAt);
  const sequenceToken = buildPsAssetSequenceToken(sourceToken, sequenceIndex);
  const imageExt = getExtByMimeType(mimeType);
  const tempId = [sourceToken, 'temp', normalizedTempKind, timestampToken, sequenceToken]
    .filter(Boolean)
    .join('_');
  return {
    tempId,
    fileName: `${tempId}.${imageExt}`,
    sourceToken,
    sequenceToken,
    sourceRefKey: `${timestampToken}_${sequenceToken}`,
    occurredAt: Number.isFinite(Number(occurredAt)) ? Number(occurredAt) : Date.now(),
  };
}

function buildPsAssetCacheIdentity({
  mimeType = 'image/png',
  source = '',
  usage = '',
  occurredAt = Date.now(),
  sequenceIndex = 1,
} = {}) {
  const sourceToken = resolvePsAssetSourceToken(source),
    usageToken = resolvePsAssetUsageToken(sourceToken, usage),
    timestampToken = formatAssetFileTimestampPrecise(occurredAt),
    sequenceToken = buildPsAssetSequenceToken(sourceToken, sequenceIndex),
    imageExt = getExtByMimeType(mimeType),
    cacheId = [sourceToken, usageToken, timestampToken, sequenceToken]
      .filter(Boolean)
      .join('_');
  return {
    cacheId,
    fileName: `${cacheId}.${imageExt}`,
    sourceToken,
    usageToken,
    sequenceToken,
    sourceRefKey: `${timestampToken}_${sequenceToken}`,
    occurredAt: Number.isFinite(Number(occurredAt)) ? Number(occurredAt) : Date.now(),
  };
}

function cacheBufferToPsImageCache({
  buffer,
  mimeType = 'image/png',
  ttlMs = PS_CACHE_TTL_DEFAULT_MS,
  name = '',
  originName = '',
  source = 'ps',
  usage = '',
  role = '',
  slotIndex = undefined,
  clientRef = '',
  meta = undefined,
  occurredAt = Date.now(),
  sequenceIndex = 1,
} = {}) {
  const binary = Buffer.isBuffer(buffer)
    ? buffer
    : (buffer ? Buffer.from(buffer) : Buffer.alloc(0));
  if (!binary.length) {
    throw new Error('ps_cache_buffer_empty');
  }
  prunePsImageCache();
  const normalizedTtlMs = sanitizePsCacheTtlMs(ttlMs);
  const originalDisplayName = String(originName || name || '').trim();
  const cacheIdentity = buildPsAssetCacheIdentity({
    mimeType,
    source,
    usage,
    occurredAt,
    sequenceIndex,
  });
  const cacheId = cacheIdentity.cacheId;
  const fileName = cacheIdentity.fileName;
  const filePath = path.join(ensurePsImageCacheDir(), fileName);
  fs.writeFileSync(filePath, binary);
  const now = cacheIdentity.occurredAt;
  const entryMeta = {
    ...(meta && typeof meta === 'object' ? meta : {}),
    sourceToken: cacheIdentity.sourceToken,
    usageToken: cacheIdentity.usageToken,
    sequenceToken: cacheIdentity.sequenceToken,
    sourceRefKey: cacheIdentity.sourceRefKey,
  };
  if (originalDisplayName && originalDisplayName !== fileName) {
    entryMeta.originalInputName = originalDisplayName;
  }
  const entry = {
    cacheId,
    filePath,
    fileName,
    name: fileName,
    originName: fileName,
    type: String(mimeType || 'application/octet-stream'),
    source: String(source || 'ps'),
    role: String(role || ''),
    slotIndex: Number.isFinite(slotIndex) ? Number(slotIndex) : undefined,
    clientRef: String(clientRef || ''),
    meta: entryMeta,
    cachedAt: now,
    expiresAt: now + normalizedTtlMs,
    byteLength: binary.length
  };
  const normalizedEntry = normalizeLegacyImageRecordToAssetRecord(entry, {
    prefix: 'ps',
    filePath,
    fileName,
    assetId: fileName,
    internalCacheId: fileName,
    itemId: fileName,
    sourceRefKey: cacheIdentity.sourceRefKey,
    inputMethod: source,
    usageMeta: {
      ownerType: 'ps-image-cache',
      ownerId: fileName
    }
  });
  psImageCacheMap.set(cacheId, normalizedEntry);
  prunePsImageCache();
  return { entry: normalizedEntry, ttlMs: normalizedTtlMs };
}

function cacheExistingFileToPsImageCache({
  filePath,
  mimeType = '',
  ttlMs = PS_CACHE_TTL_DEFAULT_MS,
  name = '',
  originName = '',
  source = 'ps',
  usage = '',
  role = '',
  slotIndex = undefined,
  clientRef = '',
  meta = undefined,
  occurredAt = Date.now(),
  sequenceIndex = 1,
} = {}) {
  const normalizedFilePath = String(filePath || '').trim();
  if (!normalizedFilePath || !fs.existsSync(normalizedFilePath)) {
    throw new Error('ps_cache_file_missing');
  }
  const stat = fs.statSync(normalizedFilePath);
  if (!stat.isFile() || !Number(stat.size)) {
    throw new Error('ps_cache_file_empty');
  }
  prunePsImageCache();
  const normalizedTtlMs = sanitizePsCacheTtlMs(ttlMs);
  const originalDisplayName = String(originName || name || '').trim();
  const cacheIdentity = buildPsAssetCacheIdentity({
    mimeType: mimeType || getMimeTypeByExt(normalizedFilePath) || 'image/png',
    source,
    usage,
    occurredAt,
    sequenceIndex,
  });
  const cacheId = cacheIdentity.cacheId;
  const fileName = cacheIdentity.fileName;
  const adoptedFilePath = path.join(ensurePsImageCacheDir(), fileName);
  try {
    fs.renameSync(normalizedFilePath, adoptedFilePath);
  } catch {
    fs.copyFileSync(normalizedFilePath, adoptedFilePath);
    fs.unlinkSync(normalizedFilePath);
  }
  const adoptedStat = fs.statSync(adoptedFilePath);
  const now = cacheIdentity.occurredAt;
  const entryMeta = {
    ...(meta && typeof meta === 'object' ? meta : {}),
    sourceToken: cacheIdentity.sourceToken,
    usageToken: cacheIdentity.usageToken,
    sequenceToken: cacheIdentity.sequenceToken,
    sourceRefKey: cacheIdentity.sourceRefKey,
  };
  if (originalDisplayName && originalDisplayName !== fileName) {
    entryMeta.originalInputName = originalDisplayName;
  }
  const entry = {
    cacheId,
    filePath: adoptedFilePath,
    fileName,
    name: fileName,
    originName: fileName,
    type: String(mimeType || getMimeTypeByExt(adoptedFilePath) || 'application/octet-stream'),
    source: String(source || 'ps'),
    role: String(role || ''),
    slotIndex: Number.isFinite(slotIndex) ? Number(slotIndex) : undefined,
    clientRef: String(clientRef || ''),
    meta: entryMeta,
    cachedAt: now,
    expiresAt: now + normalizedTtlMs,
    byteLength: Number(adoptedStat.size || 0)
  };
  const normalizedEntry = normalizeLegacyImageRecordToAssetRecord(entry, {
    prefix: 'ps',
    filePath: adoptedFilePath,
    fileName,
    assetId: fileName,
    internalCacheId: fileName,
    itemId: fileName,
    sourceRefKey: cacheIdentity.sourceRefKey,
    inputMethod: source,
    usageMeta: {
      ownerType: 'ps-image-cache',
      ownerId: fileName
    }
  });
  psImageCacheMap.set(cacheId, normalizedEntry);
  prunePsImageCache();
  return { entry: normalizedEntry, ttlMs: normalizedTtlMs };
}

function rebuildPsCacheEntryFromDisk(cacheId) {
  const id = String(cacheId || '').trim();
  if (!id) return null;
  try {
    const dir = ensurePsImageCacheDir();
    const normalizedLeafId = extractImageFileLeafName(id);
    const matchedName = fs.readdirSync(dir).find((name) => {
      try {
        const filePath = path.join(dir, name);
        const stat = fs.statSync(filePath);
        if (!stat.isFile()) return false;
        const fileId = String(path.basename(name, path.extname(name)) || '').trim();
        const fileLeafName = extractImageFileLeafName(name);
        return (
          fileId === id ||
          name === id ||
          (normalizedLeafId && fileLeafName === normalizedLeafId)
        );
      } catch {
        return false;
      }
    });
    if (!matchedName) return null;
    const filePath = path.join(dir, matchedName);
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return null;
    const now = Date.now();
    const cachedAt = Number(stat.mtimeMs || stat.ctimeMs || now);
    const resolvedCacheId = String(
      path.basename(matchedName, path.extname(matchedName)) || ''
    ).trim();
    const entry = {
      cacheId: resolvedCacheId || id,
      filePath,
      fileName: matchedName,
      name: matchedName,
      originName: matchedName,
      type: getMimeTypeByExt(filePath),
      source: 'ps-disk-fallback',
      role: '',
      slotIndex: undefined,
      clientRef: '',
      meta: undefined,
      cachedAt,
      expiresAt: Math.max(now + PS_CACHE_TTL_MIN_MS, cachedAt + PS_CACHE_TTL_DEFAULT_MS),
      byteLength: Number(stat.size || 0)
    };
    const normalizedEntry = normalizeLegacyImageRecordToAssetRecord(entry, {
      prefix: 'ps',
      sourceRefKey: parseAssetIdentityFromFileName(matchedName)?.sourceRefKey || '',
      filePath,
      fileName: matchedName,
      inputMethod: 'ps-disk-fallback',
      usageMeta: {
        ownerType: 'ps-image-cache',
        ownerId: matchedName
      }
    });
    psImageCacheMap.set(normalizedEntry.cacheId, normalizedEntry);
    return normalizedEntry;
  } catch (err) {
    log('ps-cache rebuild from disk failed', { cacheId: id, message: err.message });
    return null;
  }
}

function readPsImageCacheDataUrl(cacheId, options = {}) {
  const id = String(cacheId || '').trim();
  if (!id) return null;
  const ignoreExpiry = !!options?.ignoreExpiry;
  let entry = psImageCacheMap.get(id);
  if (!entry) {
    entry =
      Array.from(psImageCacheMap.values()).find((candidate) => {
        if (!candidate || typeof candidate !== 'object') return false;
        return [
          candidate.cacheId,
          candidate.internalCacheId,
          candidate.itemId,
          candidate.fileName,
          candidate.cacheFileName
        ].some((lookupValue) => String(lookupValue || '').trim() === id);
      }) || null;
  }
  if (!entry) {
    entry = rebuildPsCacheEntryFromDisk(id);
  }
  if (!entry) return null;

  if (
    !ignoreExpiry &&
    (!Number.isFinite(entry.expiresAt) || entry.expiresAt <= Date.now())
  ) {
    removePsCacheEntryFile(entry);
    psImageCacheMap.delete(id);
    return null;
  }

  if (!entry.filePath || !fs.existsSync(entry.filePath)) {
    psImageCacheMap.delete(id);
    entry = rebuildPsCacheEntryFromDisk(id);
    if (!entry || !entry.filePath || !fs.existsSync(entry.filePath)) {
      return null;
    }
  }

  const buffer = fs.readFileSync(entry.filePath);
  if (!buffer?.length) return null;
  return {
    ok: true,
    cacheId: entry.cacheId,
    fileName: entry.fileName,
    filePath: entry.filePath,
    mimeType: entry.type,
    dataUrl: `data:${entry.type};base64,${buffer.toString('base64')}`,
    entry,
  };
}

function cleanupPsCacheDirectory() {
  try {
    const dir = ensurePsImageCacheDir();
    const now = Date.now();
    const files = fs.readdirSync(dir);
    files.forEach((name) => {
      const fullPath = path.join(dir, name);
      try {
        const stat = fs.statSync(fullPath);
        if (!stat.isFile()) return;
        const age = now - Math.max(stat.mtimeMs || 0, stat.ctimeMs || 0);
        if (age > PS_CACHE_TTL_MAX_MS) {
          fs.unlinkSync(fullPath);
        }
      } catch {}
    });
  } catch {}
}

function initLogger() {
  try {
    ensureUnifiedCacheLayout();
    const dir = getLogsCacheDir();
    fs.mkdirSync(dir, { recursive: true });
    logFile = path.join(dir, 'main.log');
    try {
      const repoRoot = path.resolve(__dirname, '..');
      const workspaceRoot = path.resolve(repoRoot, '..');
      const workspacePerfLogsDir = path.join(
        workspaceRoot,
        '日志文件',
        '01-开发日志',
        'dev-logs',
      );
      fs.mkdirSync(workspacePerfLogsDir, { recursive: true });
      perfLogFile = path.join(workspacePerfLogsDir, 'instruction-drag-perf.log');
    } catch {
      perfLogFile = path.join(dir, 'drag-perf.log');
    }
    stateFile = path.join(app.getPath('userData'), 'window-state.json');
    bridgeConfigFile = path.join(app.getPath('userData'), 'bridge-config.json');
  } catch {
    logFile = null;
    perfLogFile = null;
    stateFile = null;
    bridgeConfigFile = null;
  }
}

function normalizeLogLevel(level) {
  const raw = String(level || 'info').trim().toLowerCase();
  if (raw === 'error' || raw === 'fatal') return 'ERROR';
  if (raw === 'warn' || raw === 'warning') return 'WARN';
  if (raw === 'debug' || raw === 'trace') return 'DEBUG';
  return 'INFO';
}

function serializeLogExtra(extra) {
  if (extra === undefined || extra === null) return '';
  const seen = new WeakSet();
  try {
    return JSON.stringify(extra, (_key, value) => {
      if (value instanceof Error) {
        return {
          name: value.name,
          message: value.message,
          stack: value.stack
        };
      }
      if (typeof value === 'string' && value.length > 4000) {
        const rest = value.length - 4000;
        return `${value.slice(0, 4000)}...(truncated ${rest} chars)`;
      }
      if (Buffer.isBuffer(value)) {
        return `[Buffer length=${value.length}]`;
      }
      if (value && typeof value === 'object') {
        if (seen.has(value)) return '[Circular]';
        seen.add(value);
      }
      return value;
    });
  } catch {
    return '"[unserializable extra]"';
  }
}

function mapRendererConsoleLevel(level) {
  const n = Number(level);
  if (n >= 3) return 'error';
  if (n === 2) return 'warn';
  if (n === 1) return 'info';
  return 'debug';
}

function log(message, extra, level = 'info') {
  const levelText = normalizeLogLevel(level);
  const extraText = serializeLogExtra(extra);
  const suffix = extraText ? ` ${extraText}` : '';
  const line = `[${new Date().toISOString()}] [${levelText}] ${String(message || '')}${suffix}\n`;
  try {
    if (logFile) fs.appendFileSync(logFile, line);
  } catch {}
}

function appendPerfLog(rawPayload) {
  const nowIso = new Date().toISOString();
  const payload =
    rawPayload && typeof rawPayload === 'object'
      ? rawPayload
      : { message: String(rawPayload || '').trim() };
  const scope = String(payload.scope || 'renderer').trim() || 'renderer';
  const event = String(payload.event || 'sample').trim() || 'sample';
  const message = String(payload.message || '').trim();
  const data = payload.data && typeof payload.data === 'object' ? payload.data : null;
  const extraText = data ? serializeLogExtra(data) : '';
  const line = `[${nowIso}] [${scope}] [${event}]${message ? ` ${message}` : ''}${extraText ? ` ${extraText}` : ''}\n`;
  try {
    if (!perfLogFile) return buildShellErrorResponse('perf_log_path_missing', '性能日志路径不可用');
    fs.appendFileSync(perfLogFile, line);
    return buildShellOkResponse({ path: perfLogFile });
  } catch (err) {
    return buildShellErrorResponse('perf_log_write_failed', String(err?.message || err || 'write failed'));
  }
}

function readFileTailUtf8(filePath, maxBytes = 180 * 1024) {
  try {
    if (!filePath || !fs.existsSync(filePath)) return '';
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return '';
    const size = Number(stat.size || 0);
    if (size <= 0) return '';
    const cap = Math.max(4096, Number(maxBytes) || 180 * 1024);
    const start = Math.max(0, size - cap);
    const length = Math.max(0, size - start);
    if (length <= 0) return '';
    const fd = fs.openSync(filePath, 'r');
    try {
      const buffer = Buffer.alloc(length);
      fs.readSync(fd, buffer, 0, length, start);
      return buffer.toString('utf-8');
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return '';
  }
}

function stripAnsiControlCodes(text) {
  return String(text || '').replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, '');
}

function summarizeDevLogText(rawText, maxLines = 320) {
  const plain = stripAnsiControlCodes(String(rawText || ''))
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
  if (!plain) return '';
  const cap = Math.max(40, Number(maxLines) || 320);
  const lines = plain.split('\n');
  if (lines.length <= cap) return plain;
  const dropped = lines.length - cap;
  const tail = lines.slice(-cap).join('\n').trim();
  return `[dev-log] 已省略较早日志 ${dropped} 行，仅保留最近 ${cap} 行\n${tail}`;
}

function resolveLatestFileInDir(dir, pattern, fallbackName = '') {
  try {
    if (!dir || !fs.existsSync(dir)) return '';
    if (fallbackName) {
      const preferred = path.join(dir, fallbackName);
      if (fs.existsSync(preferred)) return preferred;
    }
    const list = fs.readdirSync(dir)
      .filter((name) => pattern.test(name))
      .map((name) => {
        const fullPath = path.join(dir, name);
        const mtimeMs = Number(fs.statSync(fullPath).mtimeMs || 0);
        return { fullPath, mtimeMs };
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs);
    return list[0]?.fullPath || '';
  } catch {
    return '';
  }
}

function readDevLogSections() {
  const repoRoot = path.resolve(__dirname, '..');
  const workspaceRoot = path.resolve(repoRoot, '..');
  const candidateDirs = [
    path.join(workspaceRoot, '\u65e5\u5fd7\u6587\u4ef6', '01-\u5f00\u53d1\u65e5\u5fd7', 'dev-logs'),
    path.join(workspaceRoot, '\u4e34\u65f6\u7f13\u5b58', '02-\u5f00\u53d1\u4e34\u65f6', 'dev-logs'),
    path.resolve(repoRoot, '.tmp-logs')
  ];
  const devLogsDir = candidateDirs.find((dir) => fs.existsSync(dir));
  if (!devLogsDir) return [];
  const sections = [];
  const webuiOut = resolveLatestFileInDir(devLogsDir, /^webui-dev\.out(?:-\d{8}-\d{6})?\.log$/i, 'webui-dev.out.log');
  const webuiErr = resolveLatestFileInDir(devLogsDir, /^webui-dev\.err(?:-\d{8}-\d{6})?\.log$/i, 'webui-dev.err.log');
  const candidates = [
    { label: 'webui dev stdout', filePath: webuiOut },
    { label: 'webui dev stderr', filePath: webuiErr }
  ];
  candidates.forEach((item) => {
    const rawText = readFileTailUtf8(item.filePath);
    const text = summarizeDevLogText(rawText);
    if (!text) return;
    sections.push({
      label: item.label,
      filePath: item.filePath,
      text
    });
  });
  return sections;
}

function parseBridgePort(value) {
  const raw = Number(value);
  if (!Number.isFinite(raw)) return null;
  if (!Number.isInteger(raw)) return null;
  const port = Math.trunc(raw);
  if (port < BRIDGE_PORT_MIN || port > BRIDGE_PORT_MAX) return null;
  return port;
}

function parseUrlSafe(raw) {
  try {
    return new URL(String(raw || ''));
  } catch {
    return null;
  }
}

function isHttpUrl(raw) {
  const parsed = parseUrlSafe(raw);
  if (!parsed) return false;
  return parsed.protocol === 'http:' || parsed.protocol === 'https:';
}

function isRendererAppUrl(raw) {
  const parsed = parseUrlSafe(raw);
  if (!parsed) return false;
  if (parsed.protocol === 'file:') return true;
  if (DEV_SERVER_ORIGIN && parsed.origin === DEV_SERVER_ORIGIN) return true;
  return false;
}

function openExternalInDefaultBrowser(raw) {
  if (!isHttpUrl(raw)) return false;
  try {
    shell.openExternal(String(raw));
    return true;
  } catch (err) {
    log('openExternal failed', { message: err.message, url: String(raw || '') });
    return false;
  }
}

function resolveExistingImageFilePath(rawPath) {
  const normalizedPath = String(rawPath || '').trim();
  if (!normalizedPath) return '';
  try {
    const resolvedPath = path.resolve(normalizedPath);
    if (!fs.existsSync(resolvedPath)) return '';
    return fs.statSync(resolvedPath).isFile() ? resolvedPath : '';
  } catch {
    return '';
  }
}

function ensureOpenImageTempDir() {
  const dir = path.join(getUnifiedCacheRootDir(), 'open-image-temp');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function writeOpenImageTempFileFromDataUrl(payload = {}, dataUrl = '') {
  const parsed = parseImageDataUrl(dataUrl);
  if (!parsed?.buffer?.length) return '';
  const ext = getExtByMimeType(String(payload?.type || parsed.mime || 'image/png'));
  const stem = sanitizeGeneratedCacheFileStem(
    resolveAssetRecordDisplayName(payload, `open-image-${Date.now()}`)
  );
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${stem}.${ext}`;
  const filePath = path.join(ensureOpenImageTempDir(), fileName);
  fs.writeFileSync(filePath, parsed.buffer);
  return filePath;
}

function resolveImageFilePathForSystemOpen(payload = {}) {
  const directPathCandidates = [resolveAssetRecordStoragePath(payload)];
  for (const directPathCandidate of directPathCandidates) {
    const resolvedDirectPath = resolveExistingImageFilePath(directPathCandidate);
    if (resolvedDirectPath) return resolvedDirectPath;
  }

  const generatedCachePath = resolveGeneratedCacheFilePath({
    filePath: resolveAssetRecordStoragePath(payload),
    fileName: resolveAssetRecordDisplayName(payload, '')
  });
  if (generatedCachePath) return generatedCachePath;

  const assetLookupKeys = buildImageRecordLookupKeys(payload);
  if (assetLookupKeys.length) {
    prunePsImageCache();
    for (const assetLookupKey of assetLookupKeys) {
      const psCacheEntry = psImageCacheMap.get(assetLookupKey);
      if (
        psCacheEntry &&
        Number.isFinite(psCacheEntry.expiresAt) &&
        psCacheEntry.expiresAt > Date.now()
      ) {
        const psCacheFilePath = resolveExistingImageFilePath(psCacheEntry.filePath);
        if (psCacheFilePath) return psCacheFilePath;
      }
    }
  }

  const chatCacheLookupKey = String(assetLookupKeys[0] || '').trim();
  const chatCacheDisplayName = resolveAssetRecordDisplayName(payload, '');
  if (chatCacheLookupKey || chatCacheDisplayName) {
    const chatCacheData = readChatImageCacheDataUrl({
      assetId: String(payload?.assetId || '').trim(),
      internalCacheId: String(payload?.internalCacheId || '').trim(),
      itemId: String(payload?.itemId || '').trim(),
      sourceRefKey: String(payload?.sourceRefKey || '').trim(),
      fileName: chatCacheDisplayName,
      filePath: resolveAssetRecordStoragePath(payload),
      legacy:
        payload?.legacy && typeof payload.legacy === 'object'
          ? { ...payload.legacy }
          : void 0
    });
    const chatCacheFilePath = resolveExistingImageFilePath(chatCacheData?.filePath);
    if (chatCacheFilePath) return chatCacheFilePath;
  }

  const dataUrl = String(payload?.dataUrl || '').trim();
  if (/^data:[^;,]+;base64,/i.test(dataUrl)) {
    return writeOpenImageTempFileFromDataUrl(payload, dataUrl);
  }

  return '';
}

async function openImageInSystemDefaultViewer(payload = {}) {
  try {
    const filePath = resolveImageFilePathForSystemOpen(payload);
    if (!filePath) {
      return { ok: false, message: 'not_found' };
    }
    const openResult = await shell.openPath(filePath);
    if (String(openResult || '').trim()) {
      return {
        ok: false,
        filePath,
        message: String(openResult || '').trim()
      };
    }
    return { ok: true, filePath };
  } catch (err) {
    log('openImageInSystemDefaultViewer failed', { message: err.message });
    return { ok: false, message: err.message };
  }
}

function sanitizeBridgePort(value) {
  const parsed = parseBridgePort(value);
  return parsed || BRIDGE_PORT_DEFAULT;
}

function loadBridgeConfig() {
  try {
    bridgeConfigState = {};
    cachePolicy = sanitizeCachePolicy(CACHE_RETENTION_DAYS_DEFAULT);
    if (!bridgeConfigFile || !fs.existsSync(bridgeConfigFile)) return;
    const raw = fs.readFileSync(bridgeConfigFile, 'utf-8');
    const parsed = JSON.parse(raw);
    bridgeConfigState = parsed && typeof parsed === 'object' ? parsed : {};
    bridgePort = sanitizeBridgePort(parsed?.port);
    cachePolicy = sanitizeCachePolicy(parsed?.cachePolicy);
  } catch (err) {
    log('bridge config load failed', { message: err.message });
    bridgePort = BRIDGE_PORT_DEFAULT;
    cachePolicy = sanitizeCachePolicy(CACHE_RETENTION_DAYS_DEFAULT);
  }
}

function saveBridgeConfig() {
  try {
    if (!bridgeConfigFile) return;
    const payload = {
      ...(bridgeConfigState && typeof bridgeConfigState === 'object' ? bridgeConfigState : {}),
      port: bridgePort,
      cachePolicy: getCachePolicySnapshot(),
      updatedAt: Date.now()
    };
    bridgeConfigState = payload;
    fs.writeFileSync(bridgeConfigFile, JSON.stringify(payload, null, 2), 'utf-8');
  } catch (err) {
    log('bridge config save failed', { message: err.message });
  }
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

function getServerStatus() {
  return {
    running: !!serverProc,
    pid: serverProc ? serverProc.pid : null,
    port: bridgePort
  };
}

function startServer(options = {}) {
  if (serverProc) return getServerStatus();
  bridgePort = sanitizeBridgePort(options?.port ?? bridgePort);
  saveBridgeConfig();
  const serverDirCandidates = [
    path.join(__dirname, 'server'),
    path.join(__dirname, '..', 'server')
  ];
  const serverDir = serverDirCandidates.find((dir) => fs.existsSync(path.join(dir, 'index.js')));
  const entry = serverDir
    ? path.join(serverDir, 'index.js')
    : path.join(serverDirCandidates[0], 'index.js');
  if (!serverDir) {
    log('server entry missing', {
      entry,
      entryCandidates: serverDirCandidates.map((dir) => path.join(dir, 'index.js'))
    });
    return getServerStatus();
  }
  log('server spawn start', {
    pid: process.pid,
    ppid: process.ppid,
    entry,
    cwd: serverDir,
    port: bridgePort,
    runAsNode: true
  });
  serverProc = spawn(process.execPath, [entry], {
    cwd: serverDir,
    env: {
      ...process.env,
      PORT: String(bridgePort),
      ELECTRON_RUN_AS_NODE: '1'
    },
    stdio: 'ignore',
    windowsHide: true
  });
  const procRef = serverProc;
  const childPid = Number(procRef?.pid || 0) || null;
  serverProcStartedAt = Date.now();
  log('server spawn ok', {
    pid: process.pid,
    childPid,
    port: bridgePort,
    runAsNode: true
  });
  serverProc.on('error', (err) => {
    log('server process error', {
      pid: process.pid,
      childPid,
      port: bridgePort,
      code: String(err?.code || ''),
      message: String(err?.message || err || '')
    }, 'error');
  });
  serverProc.on('exit', (code, signal) => {
    const uptimeMs = serverProcStartedAt ? Math.max(0, Date.now() - serverProcStartedAt) : null;
    log('server process exit', {
      pid: process.pid,
      childPid,
      port: bridgePort,
      code: typeof code === 'number' ? code : null,
      signal: signal || null,
      uptimeMs
    }, code === 0 ? 'info' : 'warn');
    if (serverProc === procRef) {
      serverProc = null;
      serverProcStartedAt = 0;
    }
  });
  return getServerStatus();
}

function stopServer() {
  if (!serverProc) return getServerStatus();
  try {
    serverProc.kill();
  } catch (err) {
    log('stop server kill failed', {
      message: String(err?.message || err || ''),
      pid: serverProc ? (serverProc.pid || null) : null
    }, 'warn');
  }
  return getServerStatus();
}

function getBridgeBaseUrl() {
  return `http://127.0.0.1:${bridgePort}`;
}

async function fetchBridgeJson(route, options = {}) {
  const timeoutMs = Math.max(1000, Number(options.timeoutMs) || BRIDGE_REQUEST_TIMEOUT_MS);
  const method = String(options.method || 'GET').toUpperCase();
  const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
  const body = options.body !== undefined ? JSON.stringify(options.body) : undefined;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const url = `${getBridgeBaseUrl()}${String(route || '').startsWith('/') ? route : `/${String(route || '')}`}`;
  try {
    const response = await fetch(url, {
      method,
      headers,
      body,
      signal: controller.signal
    });
    const raw = await response.text();
    let data = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = null;
    }
    if (!response.ok) {
      throw new Error(String(data?.message || data?.error || raw || `HTTP ${response.status}`));
    }
    return data;
  } catch (err) {
    log('bridge request failed', {
      route,
      url,
      method,
      timeoutMs,
      serverRunning: !!serverProc,
      serverPid: serverProc ? (serverProc.pid || null) : null,
      errorName: String(err?.name || ''),
      errorCode: String(err?.code || ''),
      causeCode: String(err?.cause?.code || ''),
      message: String(err?.message || err || '')
    }, 'warn');
    if (err?.name === 'AbortError') {
      throw new Error(`bridge 请求超时（${timeoutMs}ms）`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function isBridgeRuntimeContractReady(statusPayload = {}) {
  if (!statusPayload || typeof statusPayload !== 'object') return false;
  const protocolVersion = normalizeBridgeProtocolVersion(statusPayload.bridgeProtocolVersion);
  const hasLegacyRelayFlag = typeof statusPayload.forceLegacyCaptureRelay === 'boolean';
  if (protocolVersion >= BRIDGE_PROTOCOL_VERSION && hasLegacyRelayFlag) return true;
  const hasContractFields =
    Object.prototype.hasOwnProperty.call(statusPayload, 'bridgeProtocolVersion')
    || Object.prototype.hasOwnProperty.call(statusPayload, 'forceLegacyCaptureRelay');
  // Backward compatibility: legacy /status payloads without contract fields are still usable.
  if (!hasContractFields && statusPayload.ok === true) return true;
  return false;
}

async function ensureBridgeRuntimeContract(routeLabel = 'bridge') {
  const status = await fetchBridgeJson('/status', {
    method: 'GET',
    timeoutMs: BRIDGE_REQUEST_TIMEOUT_MS
  });
  if (isBridgeRuntimeContractReady(status)) {
    return { ...status, runtimeContractReady: true };
  }
  const protocolVersion = normalizeBridgeProtocolVersion(status?.bridgeProtocolVersion);
  const legacyFlag = typeof status?.forceLegacyCaptureRelay === 'boolean'
    ? String(status.forceLegacyCaptureRelay)
    : 'missing';
  log('bridge runtime contract mismatch detected', {
    routeLabel,
    protocolVersion,
    legacyFlag,
    serverRunning: !!serverProc
  });
  const nonBlockingWarning =
    `${routeLabel}:bridge_runtime_contract_mismatch`
    + `:protocol=${protocolVersion || 0}:legacyRelay=${legacyFlag}`
    + ':建议更新插件（当前继续尝试执行）';
  log('bridge runtime contract mismatch (non-blocking)', {
    routeLabel,
    protocolVersion,
    legacyFlag,
    suggestion: '建议更新插件'
  }, 'warn');
  return {
    ...status,
    runtimeContractReady: false,
    runtimeContractWarning: nonBlockingWarning
  };
}

async function getBridgeRuntimeContractSnapshotForStatus() {
  try {
    const status = await fetchBridgeJson('/status', {
      method: 'GET',
      timeoutMs: 1200
    });
    const protocolVersion = normalizeBridgeProtocolVersion(status?.bridgeProtocolVersion);
    const hasLegacyRelayFlag = typeof status?.forceLegacyCaptureRelay === 'boolean';
    const hasContractFields =
      Object.prototype.hasOwnProperty.call(status || {}, 'bridgeProtocolVersion')
      || Object.prototype.hasOwnProperty.call(status || {}, 'forceLegacyCaptureRelay');
    const isLegacyStatusCompatible = !hasContractFields && status?.ok === true;
    const ready = isBridgeRuntimeContractReady(status) || isLegacyStatusCompatible;
    return {
      available: true,
      ready,
      errorCode: ready ? '' : 'bridge_runtime_contract_mismatch',
      message: ready
        ? ''
        : `bridge_runtime_contract_mismatch:protocol=${protocolVersion || 0}:legacyRelay=${hasLegacyRelayFlag ? String(status.forceLegacyCaptureRelay) : 'missing'}:建议更新插件（当前可继续尝试）`,
      bridgeProtocolVersion: protocolVersion,
      forceLegacyCaptureRelay: hasLegacyRelayFlag ? status.forceLegacyCaptureRelay : null
    };
  } catch (error) {
    return {
      available: false,
      ready: false,
      errorCode: 'bridge_status_unreachable',
      message: String(error?.message || error || ''),
      bridgeProtocolVersion: 0,
      forceLegacyCaptureRelay: null
    };
  }
}

function normalizeBridgeActionType(inputType = '') {
  const raw = String(inputType || '').trim().toLowerCase();
  if (raw === 'ps.capture.selection') return 'capture-selection';
  if (raw === 'ps.capture.canvas') return 'capture-canvas';
  if (raw === 'ps.import' || raw === 'ps.import.image') return 'import-image';
  return raw;
}

function normalizeBridgeProtocolVersion(inputVersion = 0) {
  const parsedVersion = Number(inputVersion);
  if (!Number.isFinite(parsedVersion)) return 0;
  const normalizedVersion = Math.floor(parsedVersion);
  return normalizedVersion > 0 ? normalizedVersion : 0;
}

function extractBridgeProtocolVersion(payload = {}) {
  if (!payload || typeof payload !== 'object') return 0;
  return normalizeBridgeProtocolVersion(
    payload?.bridgeProtocolVersion
    || payload?.payload?.bridgeProtocolVersion
    || payload?.image?.bridgeProtocolVersion
    || payload?.captureMeta?.bridgeProtocolVersion
  );
}

async function enqueueBridgeCommand(type, payload = {}) {
  const actionType = normalizeBridgeActionType(type);
  if (!actionType) {
    throw new Error('bridge_action_type_required');
  }
  const payloadBody = payload && typeof payload === 'object' ? { ...payload } : {};
  payloadBody.actionType = actionType;
  const queued = await fetchBridgeJson('/queue', {
    method: 'POST',
    body: { type: actionType, payload: payloadBody },
    timeoutMs: BRIDGE_REQUEST_TIMEOUT_MS
  });
  const queueId = String(queued?.item?.id || '').trim();
  if (!queueId) {
    throw new Error('bridge 队列返回了空命令 ID');
  }
  return {
    queueId,
    actionType
  };
}

async function waitBridgeQueueResult(
  queueId,
  timeoutMs = BRIDGE_ACTION_TIMEOUT_MS,
  expectedActionType = ''
) {
  const safeQueueId = String(queueId || '').trim();
  if (!safeQueueId) throw new Error('queue_id_required');
  const normalizedExpectedActionType = normalizeBridgeActionType(expectedActionType);
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const elapsed = Date.now() - startedAt;
    const remaining = Math.max(0, timeoutMs - elapsed);
    if (remaining <= 0) break;
    const waitMs = Math.min(BRIDGE_RESULT_WAIT_WINDOW_MS, Math.max(1000, remaining));
    const next = await fetchBridgeJson(
      `/queue/result/${encodeURIComponent(safeQueueId)}/wait?timeoutMs=${waitMs}`,
      {
        method: 'GET',
        timeoutMs: waitMs + 2000
      }
    );
    if (next?.status === 'done' || next?.status === 'error') {
      if (normalizedExpectedActionType) {
        const normalizedResultActionType = normalizeBridgeActionType(
          next?.actionType
          || next?.result?.actionType
          || next?.result?.payload?.actionType
          || ''
        );
        if (!normalizedResultActionType) {
          throw new Error(`queue_result_missing_action_type:${safeQueueId}`);
        }
        if (normalizedResultActionType !== normalizedExpectedActionType) {
          throw new Error(
            `queue_result_action_mismatch:${safeQueueId}:${normalizedExpectedActionType}->${normalizedResultActionType}`
          );
        }
      }
      return next;
    }
  }
  throw new Error('等待插件处理结果超时');
}

function watchDistAndReload() {
  const distDir = path.join(__dirname, 'webui', 'dist');
  const indexFile = path.join(distDir, 'index.html');
  let reloadTimer = null;

  const scheduleReload = () => {
    if (!win) return;
    if (reloadTimer) clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => {
      try {
        win.webContents.reloadIgnoringCache();
      } catch {}
    }, 120);
  };

  try {
    fs.watch(distDir, { recursive: true }, (_event, _filename) => {
      scheduleReload();
    });
  } catch {
    // fallback: watch index.html only
    try {
      fs.watchFile(indexFile, { interval: 300 }, () => scheduleReload());
    } catch {}
  }
}

function getCacheDir() {
  return getGeneratedCacheDir();
}

function sanitizeGeneratedTargetMeta(input = {}) {
  const targetRect = normalizeTargetRect(input?.targetRect);
  const targetRectNorm = normalizeTargetRectNorm(input?.targetRectNorm);
  const targetCanvas = normalizeTargetCanvas(input?.targetCanvas);
  const targetDocumentId = normalizeTargetDocumentId(
    input?.targetDocumentId ?? input?.documentId
  );
  const targetDocumentName = String(
    input?.targetDocumentName || input?.documentName || ''
  ).trim();
  if (!targetRect && !targetRectNorm && !targetCanvas && !targetDocumentId && !targetDocumentName) {
    return null;
  }
  return {
    targetRect: targetRect || null,
    targetRectNorm: targetRectNorm || null,
    targetCanvas: targetCanvas || null,
    targetDocumentId: targetDocumentId || null,
    targetDocumentName: targetDocumentName || ''
  };
}

function writeGeneratedTargetMeta(stem, targetMeta, now = Date.now()) {
  const safeStem = sanitizeGeneratedCacheFileStem(stem || `target-${now}`);
  const dir = getGeneratedTargetMetaDir();
  fs.mkdirSync(dir, { recursive: true });
  const fileName = `${safeStem}.json`;
  const filePath = path.join(dir, fileName);
  const payload = {
    version: 1,
    updatedAt: now,
    target: targetMeta
  };
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8');
  return { fileName, filePath };
}

function pruneGeneratedTargetMetaDir() {
  const cacheDir = getCacheDir();
  const targetDir = getGeneratedTargetMetaDir();
  if (!fs.existsSync(targetDir)) return;
  const keepStems = new Set();
  try {
    if (fs.existsSync(cacheDir)) {
      fs.readdirSync(cacheDir).forEach((name) => {
        const fullPath = path.join(cacheDir, name);
        try {
          const stat = fs.statSync(fullPath);
          if (!stat.isFile()) return;
          const stem = String(path.parse(name).name || '').trim();
          if (stem) keepStems.add(stem);
        } catch {}
      });
    }
    fs.readdirSync(targetDir).forEach((name) => {
      const fullPath = path.join(targetDir, name);
      try {
        const stat = fs.statSync(fullPath);
        if (!stat.isFile()) return;
        const stem = String(path.parse(name).name || '').trim();
        if (!stem || keepStems.has(stem)) return;
        fs.unlinkSync(fullPath);
      } catch {}
    });
  } catch {}
}

function sanitizeGeneratedCacheMaxFiles(input) {
  const value = Number(input);
  if (!Number.isFinite(value)) return GENERATED_CACHE_MAX_FILES_DEFAULT;
  return Math.min(
    GENERATED_CACHE_MAX_FILES_MAX,
    Math.max(GENERATED_CACHE_MAX_FILES_MIN, Math.round(value))
  );
}

function sanitizeGeneratedCacheFileStem(input) {
  const text = stripTrailingImageExtensions(String(input || '').trim());
  const replaced = text.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
  const compact = replaced.replace(/\s+/g, '_').replace(/_+/g, '_');
  const trimmed = compact.replace(/^_+|_+$/g, '');
  if (!trimmed) return 'generated-image';
  return trimmed.slice(0, 48);
}

function pruneGeneratedCacheDir(maxFiles = GENERATED_CACHE_MAX_FILES_DEFAULT) {
  const dir = getCacheDir();
  if (!fs.existsSync(dir)) return;
  const keepCount = sanitizeGeneratedCacheMaxFiles(maxFiles);
  const files = fs.readdirSync(dir)
    .map((name) => {
      const filePath = path.join(dir, name);
      try {
        const stat = fs.statSync(filePath);
        if (!stat.isFile()) return null;
        return { name, filePath, mtimeMs: stat.mtimeMs || 0 };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => (b.mtimeMs || 0) - (a.mtimeMs || 0));
  files.slice(keepCount).forEach((entry) => {
    try {
      fs.unlinkSync(entry.filePath);
    } catch (err) {
      log('generated-cache prune unlink failed', {
        message: err.message,
        filePath: entry.filePath
      });
    }
  });
}

function resolveGeneratedCacheFilePath(payload = {}) {
  const cacheDir = path.resolve(getCacheDir());
  const safePrefix = `${cacheDir}${path.sep}`;
  const rawFilePath = String(payload?.filePath || '').trim();
  const rawFileName = String(payload?.fileName || '').trim();

  if (rawFilePath) {
    const resolved = path.resolve(rawFilePath);
    if ((resolved === cacheDir || resolved.startsWith(safePrefix)) && fs.existsSync(resolved)) {
      try {
        if (fs.statSync(resolved).isFile()) return resolved;
      } catch {}
    }
  }

  if (rawFileName) {
    const safeName = path.basename(rawFileName);
    const resolved = path.resolve(cacheDir, safeName);
    if ((resolved === cacheDir || resolved.startsWith(safePrefix)) && fs.existsSync(resolved)) {
      try {
        if (fs.statSync(resolved).isFile()) return resolved;
      } catch {}
    }
  }

  return '';
}

function readGeneratedTargetMetaByCacheFilePath(cacheFilePath = '') {
  const normalizedCacheFilePath = String(cacheFilePath || '').trim();
  if (!normalizedCacheFilePath) {
    return {
      targetMeta: null,
      targetMetaFileName: '',
      targetMetaFilePath: ''
    };
  }
  const stem = String(path.parse(normalizedCacheFilePath).name || '').trim();
  if (!stem) {
    return {
      targetMeta: null,
      targetMetaFileName: '',
      targetMetaFilePath: ''
    };
  }
  const targetMetaDir = getGeneratedTargetMetaDir();
  const targetMetaFileName = `${stem}.json`;
  const targetMetaFilePath = path.join(targetMetaDir, targetMetaFileName);
  if (!fs.existsSync(targetMetaFilePath)) {
    return {
      targetMeta: null,
      targetMetaFileName: '',
      targetMetaFilePath: ''
    };
  }
  try {
    const raw = fs.readFileSync(targetMetaFilePath, 'utf-8');
    const parsed = raw ? JSON.parse(raw) : {};
    const targetMeta = sanitizeGeneratedTargetMeta(parsed?.target || parsed);
    if (!targetMeta) {
      return {
        targetMeta: null,
        targetMetaFileName: '',
        targetMetaFilePath: ''
      };
    }
    return {
      targetMeta,
      targetMetaFileName,
      targetMetaFilePath
    };
  } catch (err) {
    log('generated-target-meta read failed', {
      message: err.message,
      targetMetaFilePath
    });
    return {
      targetMeta: null,
      targetMetaFileName: '',
      targetMetaFilePath: ''
    };
  }
}

function readGeneratedCacheDataUrl(payload = {}) {
  const filePath = resolveGeneratedCacheFilePath(payload);
  if (!filePath) return { ok: false, message: 'not_found' };
  const buffer = fs.readFileSync(filePath);
  if (!buffer.length) return { ok: false, message: 'empty_file' };
  const mimeType = getMimeTypeByExt(filePath);
  const generatedTargetMeta = readGeneratedTargetMetaByCacheFilePath(filePath);
  return {
    ok: true,
    filePath,
    fileName: path.basename(filePath),
    mimeType,
    dataUrl: `data:${mimeType};base64,${buffer.toString('base64')}`,
    targetMeta: generatedTargetMeta.targetMeta || null,
    targetMetaFileName: generatedTargetMeta.targetMetaFileName || '',
    targetMetaFilePath: generatedTargetMeta.targetMetaFilePath || ''
  };
}

function readCaptureFromCommFile(commPath) {
  const filePath = String(commPath || '').trim();
  if (!filePath) throw new Error('comm_path_empty');
  if (!fs.existsSync(filePath)) throw new Error('comm_file_missing');
  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(raw);
  const image = parsed?.image || {};
  const imgPath = String(image?.filePath || '').trim();
  if (!imgPath || !fs.existsSync(imgPath)) throw new Error('capture_image_missing');
  const stat = fs.statSync(imgPath);
  if (!stat.isFile() || !Number(stat.size)) throw new Error('capture_image_empty');
  const mimeType = String(image?.mimeType || 'image/png').trim();
  const captureMeta = normalizeCaptureMeta({
    ...(image?.captureMeta && typeof image.captureMeta === 'object' ? image.captureMeta : {}),
    documentMode: image?.documentMode,
    bitsPerChannel: image?.bitsPerChannel
  });
  return {
    buffer: null,
    byteLength: Number(stat.size || 0),
    imagePath: imgPath,
    mimeType,
    width: Number(image?.width) || undefined,
    height: Number(image?.height) || undefined,
    targetRect: normalizeTargetRect(image?.targetRect) || null,
    targetRectNorm: normalizeTargetRectNorm(image?.targetRectNorm) || null,
    targetCanvas: normalizeTargetCanvas(image?.targetCanvas) || null,
    documentId: Number(image?.documentId) || undefined,
    documentName: image?.documentName ? String(image.documentName) : undefined,
    documentMode:
      image?.documentMode
        ? String(image.documentMode)
        : (captureMeta?.documentMode || undefined),
    bitsPerChannel: Number.isFinite(Number(image?.bitsPerChannel))
      ? Number(image.bitsPerChannel)
      : (Number.isFinite(Number(captureMeta?.bitsPerChannel)) ? Number(captureMeta.bitsPerChannel) : undefined),
    captureMeta: captureMeta || undefined,
    queueId: parsed?.queueId ? String(parsed.queueId) : '',
    role: parsed?.bridge?.role ? String(parsed.bridge.role) : '',
    slotIndex: Number.isFinite(parsed?.bridge?.slotIndex) ? Number(parsed.bridge.slotIndex) : -1,
    capturedAt: Number(parsed?.bridge?.at) || Number(parsed?.createdAt) || Date.now(),
    commPath: filePath,
    bridgeProtocolVersion: 0
  };
}

function readCaptureFromResultPayload(payloadBody = {}) {
  const body = payloadBody && typeof payloadBody === 'object' ? payloadBody : {};
  const image = body?.image && typeof body.image === 'object' ? body.image : {};
  const imgPath = String(image?.filePath || body?.filePath || '').trim();
  if (!imgPath) {
    return { capture: null, error: '' };
  }
  if (!fs.existsSync(imgPath)) {
    return { capture: null, error: 'capture_image_missing' };
  }
  const stat = fs.statSync(imgPath);
  if (!stat.isFile() || !Number(stat.size)) {
    return { capture: null, error: 'capture_image_empty' };
  }
  const mimeType = String(image?.mimeType || body?.mimeType || 'image/png').trim();
  const captureMeta = normalizeCaptureMeta({
    ...(image?.captureMeta && typeof image.captureMeta === 'object' ? image.captureMeta : {}),
    documentMode: image?.documentMode || body?.documentMode,
    bitsPerChannel: image?.bitsPerChannel ?? body?.bitsPerChannel
  });
  return {
    capture: {
      buffer: null,
      byteLength: Number(stat.size || 0),
      imagePath: imgPath,
      mimeType,
      width: Number(image?.width ?? body?.width) || undefined,
      height: Number(image?.height ?? body?.height) || undefined,
      targetRect: normalizeTargetRect(image?.targetRect || body?.targetRect) || null,
      targetRectNorm: normalizeTargetRectNorm(image?.targetRectNorm || body?.targetRectNorm) || null,
      targetCanvas: normalizeTargetCanvas(image?.targetCanvas || body?.targetCanvas) || null,
      documentId: Number(image?.documentId ?? body?.documentId) || undefined,
      documentName:
        image?.documentName
          ? String(image.documentName)
          : (body?.documentName ? String(body.documentName) : undefined),
      documentMode:
        image?.documentMode
          ? String(image.documentMode)
          : (captureMeta?.documentMode || (body?.documentMode ? String(body.documentMode) : undefined)),
      bitsPerChannel: Number.isFinite(Number(image?.bitsPerChannel))
        ? Number(image.bitsPerChannel)
        : (
            Number.isFinite(Number(captureMeta?.bitsPerChannel))
              ? Number(captureMeta.bitsPerChannel)
              : (Number.isFinite(Number(body?.bitsPerChannel)) ? Number(body.bitsPerChannel) : undefined)
          ),
      captureMeta: captureMeta || undefined,
      queueId: body?.queueId ? String(body.queueId) : '',
      role: body?.role ? String(body.role) : '',
      slotIndex: Number.isFinite(body?.slotIndex) ? Number(body.slotIndex) : -1,
      capturedAt: Number(body?.capturedAt) || Date.now(),
      commPath: '',
      bridgeProtocolVersion: extractBridgeProtocolVersion(body)
    },
    error: ''
  };
}

function hasCaptureBinaryOrPath(capture) {
  const normalizedCapture = capture && typeof capture === 'object' ? capture : null;
  if (!normalizedCapture) return false;
  if (normalizedCapture.buffer && Buffer.isBuffer(normalizedCapture.buffer) && normalizedCapture.buffer.length > 0) {
    return true;
  }
  return !!String(normalizedCapture.imagePath || '').trim();
}

function resolveCaptureFromBridgeResult(payloadBody = {}, action = 'select') {
  const expectedActionType = action === 'select' ? 'capture-selection' : 'capture-canvas';
  const resultActionType = normalizeBridgeActionType(
    payloadBody?.actionType
    || payloadBody?.payload?.actionType
    || ''
  );
  const captureKind = String(payloadBody?.captureKind || '').trim().toLowerCase();
  if (resultActionType && resultActionType !== expectedActionType) {
    throw new Error(`queue_result_action_mismatch:${expectedActionType}->${resultActionType}`);
  }
  if (captureKind) {
    const expectedCaptureKind = action === 'select' ? 'selection' : 'canvas';
    if (captureKind !== expectedCaptureKind) {
      throw new Error(`queue_result_action_mismatch:${expectedCaptureKind}->${captureKind}`);
    }
  }
  const directPayloadCaptureResult = readCaptureFromResultPayload(payloadBody);
  let capture = directPayloadCaptureResult.capture || null;
  const directReadError = String(directPayloadCaptureResult.error || '').trim();
  const preferredCommPath = String(payloadBody?.captureCommPath || '').trim();
  const bridgeProtocolVersion = extractBridgeProtocolVersion(payloadBody);
  const shouldAllowLegacyCommFallback =
    FORCE_LEGACY_CAPTURE_RELAY ||
    !bridgeProtocolVersion ||
    bridgeProtocolVersion <= BRIDGE_CAPTURE_LEGACY_FALLBACK_MAX_VERSION;
  let commReadError = '';
  if (
    !hasCaptureBinaryOrPath(capture) &&
    preferredCommPath &&
    shouldAllowLegacyCommFallback
  ) {
    try {
      capture = readCaptureFromCommFile(preferredCommPath);
    } catch (err) {
      commReadError = String(err?.message || err || 'capture_comm_read_failed');
      log('capture comm read failed', { path: preferredCommPath, message: commReadError });
    }
  } else if (
    !hasCaptureBinaryOrPath(capture) &&
    preferredCommPath &&
    !shouldAllowLegacyCommFallback
  ) {
    commReadError = 'legacy_comm_fallback_disabled';
  }

  if (!hasCaptureBinaryOrPath(capture)) {
    const persistError = String(payloadBody?.captureCommError || '').trim();
    const parts = [persistError, directReadError, commReadError].filter(Boolean);
    if (!shouldAllowLegacyCommFallback && bridgeProtocolVersion) {
      parts.push(`bridge_protocol_v${bridgeProtocolVersion}`);
    }
    if (parts.length) {
      throw new Error(`capture_data_unavailable: ${parts.join(' | ')}`);
    }
    throw new Error('capture_data_unavailable');
  }
  if (
    (!Number.isFinite(Number(capture?.bridgeProtocolVersion)) ||
      Number(capture?.bridgeProtocolVersion) <= 0) &&
    bridgeProtocolVersion
  ) {
    capture.bridgeProtocolVersion = bridgeProtocolVersion;
  }

  const ext = getExtByMimeType(capture?.mimeType || 'image/png');
  const fileName = `${action === 'select' ? 'ps-selection' : 'ps-canvas'}-${Date.now()}.${ext}`;
  const source = action === 'select' ? 'ps-select' : 'ps-full';
  return {
    fileName,
    source,
    capture
  };
}

function getChatStateFile() {
  ensureUnifiedCacheLayout();
  return path.join(getChatCacheDir(), CHAT_CACHE_FILE_BASENAME);
}

function readJsonFileWithBackup(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (error) {
    const backupFile = `${filePath}.bak`;
    if (!fs.existsSync(backupFile)) throw error;
    const backupRaw = fs.readFileSync(backupFile, 'utf-8');
    return JSON.parse(backupRaw);
  }
}

function writeJsonFileAtomic(filePath, data) {
  const serialized = JSON.stringify(data || {}, null, 2);
  // Guard against unexpected non-serializable payloads.
  JSON.parse(serialized);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempFilePath =
    `${filePath}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  fs.writeFileSync(tempFilePath, serialized, 'utf-8');
  fs.renameSync(tempFilePath, filePath);
}

function readChatStateFromLegacySnapshot() {
  const legacyFile = getChatStateFile();
  const parsed = readJsonFileWithBackup(legacyFile);
  if (!parsed) return null;
  const sessions = Array.isArray(parsed?.sessions) ? parsed.sessions : [];
  return {
    file: legacyFile,
    data: {
      updatedAt: Number(parsed?.updatedAt) || Date.now(),
      activeId: typeof parsed?.activeId === 'string' ? parsed.activeId : '',
      sessions
    }
  };
}

function readChatStateFromShardedIndex() {
  const indexFile = getChatIndexFile();
  const parsedIndex = readJsonFileWithBackup(indexFile);
  if (!parsedIndex) return null;
  const indexSessions = Array.isArray(parsedIndex?.sessions)
    ? parsedIndex.sessions
    : [];
  const sessions = indexSessions
    .map((indexSession, idx) => {
    const sessionId = String(indexSession?.id || '').trim();
    if (!sessionId) return null;
    const shardFile = getChatSessionShardFileById(sessionId);
    const shardData = readJsonFileWithBackup(shardFile);
    if (shardData && typeof shardData === 'object') {
      return sanitizeChatSessionForPersist(shardData, idx);
    }
    return null;
  })
    .filter(Boolean);
  return {
    file: indexFile,
    data: {
      updatedAt: Number(parsedIndex?.updatedAt) || Date.now(),
      activeId: typeof parsedIndex?.activeId === 'string' ? parsedIndex.activeId : '',
      sessions
    }
  };
}

function writeChatStateData(dataInput = {}, options = {}) {
  const nextData = dataInput && typeof dataInput === 'object'
    ? dataInput
    : { updatedAt: Date.now(), activeId: '', sessions: [] };
  const previousData = options?.previousData && typeof options.previousData === 'object'
    ? options.previousData
    : null;
  const shardDir = ensureChatSessionShardsDir();
  const indexFile = getChatIndexFile();
  const sourceSessions = Array.isArray(nextData?.sessions) ? nextData.sessions : [];
  const persistedSessions = sourceSessions.map((session, idx) =>
    sanitizeChatSessionForPersist(session, idx)
  );

  const expectedShardFiles = new Set();
  persistedSessions.forEach((sessionItem, idx) => {
    const sessionId = String(sessionItem?.id || `chat-${Date.now()}-${idx}`).trim();
    const shardFile = getChatSessionShardFileById(sessionId);
    expectedShardFiles.add(path.resolve(shardFile).toLowerCase());
    writeJsonFileAtomic(shardFile, sessionItem);
  });

  try {
    const shardEntries = fs.readdirSync(shardDir, { withFileTypes: true });
    shardEntries.forEach((entry) => {
      if (!entry.isFile()) return;
      const fullPath = path.resolve(path.join(shardDir, entry.name));
      const lowerFullPath = fullPath.toLowerCase();
      if (
        lowerFullPath.endsWith('.json') &&
        !expectedShardFiles.has(lowerFullPath)
      ) {
        try { fs.unlinkSync(fullPath); } catch {}
        const backupPath = `${fullPath}.bak`;
        if (fs.existsSync(backupPath)) {
          try { fs.unlinkSync(backupPath); } catch {}
        }
      }
    });
  } catch {}

  const indexData = {
    updatedAt: Number(nextData?.updatedAt) || Date.now(),
    activeId: typeof nextData?.activeId === 'string' ? nextData.activeId : '',
    sessions: persistedSessions.map((sessionItem, idx) => toChatSessionSummary(sessionItem, idx))
  };
  if (previousData) {
    const previousIndexData = {
      updatedAt: Number(previousData?.updatedAt) || Date.now(),
      activeId: typeof previousData?.activeId === 'string' ? previousData.activeId : '',
      sessions: (Array.isArray(previousData?.sessions) ? previousData.sessions : [])
        .map((sessionItem, idx) => toChatSessionSummary(sessionItem, idx))
    };
    backupChatStateFile(indexFile, previousIndexData);
  } else {
    const existingIndex = readJsonFileWithBackup(indexFile);
    existingIndex && backupChatStateFile(indexFile, existingIndex);
  }
  writeJsonFileAtomic(indexFile, indexData);
  return {
    file: indexFile,
    data: {
      ...indexData,
      sessions: persistedSessions
    }
  };
}

function readChatStateData() {
  const shardedSnapshot = readChatStateFromShardedIndex();
  if (shardedSnapshot) return shardedSnapshot;

  return {
    file: getChatIndexFile(),
    data: { updatedAt: Date.now(), activeId: '', sessions: [] }
  };
}

function sanitizeMessageBranchStateForPersist(messageBranchStateInput) {
  const sourceEntries = Array.isArray(messageBranchStateInput)
    ? messageBranchStateInput
    : Array.isArray(messageBranchStateInput?.entries)
      ? messageBranchStateInput.entries
      : [];
  const sanitizedEntries = sourceEntries
    .map((entryItem) => {
      const branchRootId = String(entryItem?.branchRootId || '').trim();
      if (!branchRootId) return null;
      const sourceVariants = Array.isArray(entryItem?.variants) ? entryItem.variants : [];
      const sanitizedVariants = sourceVariants
        .map((variantItem, variantIndex) => {
          const messages = Array.isArray(variantItem?.messages) ? variantItem.messages : [];
          if (!messages.length) return null;
          const signature = String(variantItem?.signature || '').trim();
          if (!signature) return null;
          return {
            id: String(variantItem?.id || `branch-${Date.now()}-${variantIndex}`),
            signature,
            messages,
            createdAt: Number(variantItem?.createdAt) || Date.now(),
            updatedAt: Number(variantItem?.updatedAt) || Date.now()
          };
        })
        .filter(Boolean);
      if (!sanitizedVariants.length) return null;
      const activeIndex = Number.isFinite(Number(entryItem?.activeIndex))
        ? Math.max(0, Math.floor(Number(entryItem.activeIndex)))
        : 0;
      return {
        branchRootId,
        activeIndex: Math.min(sanitizedVariants.length - 1, activeIndex),
        variants: sanitizedVariants
      };
    })
    .filter(Boolean);
  return sanitizedEntries.length
    ? {
      version: 1,
      entries: sanitizedEntries
    }
    : null;
}

function sanitizeChatSessionForPersist(session, idx = 0) {
  const source = session && typeof session === 'object' ? session : {};
  const safeSession = {
    id: String(source.id || `chat-${Date.now()}-${idx}`),
    name: String(source.name || '新对话'),
    pinned: !!source.pinned,
    updatedAt: Number(source.updatedAt) || Date.now(),
    messages: Array.isArray(source.messages) ? source.messages : []
  };
  const messageBranchState = sanitizeMessageBranchStateForPersist(source.messageBranchState);
  if (messageBranchState) {
    safeSession.messageBranchState = messageBranchState;
  }
  return safeSession;
}

function finalizeInterruptedPendingMessage(messageItem) {
  if (!messageItem || typeof messageItem !== 'object') {
    return {
      message: messageItem,
      changed: false,
    };
  }
  const messageStatus = String(messageItem.status || '').trim().toLowerCase();
  if (messageStatus !== 'pending') {
    return {
      message: messageItem,
      changed: false,
    };
  }
  const messageRole = String(messageItem.role || '').trim().toLowerCase();
  if (messageRole === 'assistant') {
    return {
      message: {
        ...messageItem,
        status: 'error',
        error: String(messageItem.error || 'interrupted_on_exit'),
        text: '已停止生成',
      },
      changed: true,
    };
  }
  const nextMessage = {
    ...messageItem,
    status: 'done',
  };
  if (Object.prototype.hasOwnProperty.call(nextMessage, 'error')) {
    delete nextMessage.error;
  }
  return {
    message: nextMessage,
    changed: true,
  };
}

function finalizeInterruptedPendingMessageList(messageListInput) {
  const sourceMessageList = Array.isArray(messageListInput) ? messageListInput : [];
  if (!sourceMessageList.length) {
    return {
      messages: sourceMessageList,
      changed: false,
    };
  }
  let hasMessageListChanged = false;
  const nextMessageList = sourceMessageList.map((messageItem) => {
    const { message, changed } = finalizeInterruptedPendingMessage(messageItem);
    if (!changed) return messageItem;
    hasMessageListChanged = true;
    return message;
  });
  return {
    messages: nextMessageList,
    changed: hasMessageListChanged,
  };
}

function finalizeInterruptedPendingBranchState(branchStateInput) {
  const sourceEntries = Array.isArray(branchStateInput?.entries)
    ? branchStateInput.entries
    : [];
  if (!sourceEntries.length) {
    return {
      branchState: branchStateInput,
      changed: false,
    };
  }
  let hasBranchStateChanged = false;
  const nextEntries = sourceEntries.map((entryItem) => {
    const sourceVariants = Array.isArray(entryItem?.variants) ? entryItem.variants : [];
    if (!sourceVariants.length) return entryItem;
    let hasEntryChanged = false;
    const nextVariants = sourceVariants.map((variantItem) => {
      const { messages, changed } = finalizeInterruptedPendingMessageList(
        variantItem?.messages,
      );
      if (!changed) return variantItem;
      hasEntryChanged = true;
      return {
        ...variantItem,
        messages,
        updatedAt: Date.now(),
      };
    });
    if (!hasEntryChanged) return entryItem;
    hasBranchStateChanged = true;
    return {
      ...entryItem,
      variants: nextVariants,
    };
  });
  if (!hasBranchStateChanged) {
    return {
      branchState: branchStateInput,
      changed: false,
    };
  }
  return {
    branchState: {
      ...(branchStateInput && typeof branchStateInput === 'object' ? branchStateInput : {}),
      entries: nextEntries,
    },
    changed: true,
  };
}

function finalizeInterruptedPendingMessages(sessionsInput = []) {
  const sourceSessions = Array.isArray(sessionsInput) ? sessionsInput : [];
  if (!sourceSessions.length) return { sessions: sourceSessions, changed: false };
  let hasSessionChanged = false;
  const nextSessions = sourceSessions.map((sessionItem) => {
    if (!sessionItem || typeof sessionItem !== 'object') return sessionItem;
    const {
      messages: nextMessages,
      changed: hasMessageChanged,
    } = finalizeInterruptedPendingMessageList(sessionItem?.messages);
    const {
      branchState: nextBranchState,
      changed: hasBranchStateChanged,
    } = finalizeInterruptedPendingBranchState(sessionItem?.messageBranchState);
    if (!hasMessageChanged && !hasBranchStateChanged) return sessionItem;
    hasSessionChanged = true;
    const nextSession = {
      ...sessionItem,
      messages: nextMessages,
      updatedAt: Number(sessionItem.updatedAt) || Date.now()
    };
    if (hasBranchStateChanged) {
      nextSession.messageBranchState = nextBranchState;
    }
    return nextSession;
  });
  return hasSessionChanged
    ? { sessions: nextSessions, changed: true }
    : { sessions: sourceSessions, changed: false };
}

function toChatSessionSummary(session, idx = 0) {
  const source = session && typeof session === 'object' ? session : {};
  const messages = Array.isArray(source.messages) ? source.messages : [];
  return {
    id: String(source.id || `chat-${Date.now()}-${idx}`),
    name: String(source.name || '新对话'),
    pinned: !!source.pinned,
    updatedAt: Number(source.updatedAt) || Date.now(),
    messages: [],
    messageCount: messages.length,
    messagesLoaded: false
  };
}

function mergeIncomingChatSessions(incomingSessions = [], existingSessions = []) {
  const existingList = Array.isArray(existingSessions) ? existingSessions : [];
  const incomingList = Array.isArray(incomingSessions) ? incomingSessions : [];
  const filteredIncomingList = incomingList.filter((session) => {
    const sessionId = String(session?.id || '').trim();
    return !sessionId || !deletedChatSessionIdGuardSet.has(sessionId);
  });
  const existingMap = new Map(
    existingList
      .map((session) => [String(session?.id || '').trim(), session])
      .filter(([id]) => !!id)
  );
  const mergedByIncoming = filteredIncomingList.map((session, idx) => {
    const safe = sanitizeChatSessionForPersist(session, idx);
    const sessionId = String(safe.id || '').trim();
    const existing = existingMap.get(sessionId);
    const incomingMessages = Array.isArray(session?.messages) ? session.messages : [];
    const incomingLoaded = !(session && typeof session === 'object' && session.messagesLoaded === false);
    if (!incomingLoaded && existing && typeof existing === 'object') {
      safe.messages = Array.isArray(existing?.messages) ? existing.messages : [];
      const existingBranchState = sanitizeMessageBranchStateForPersist(existing?.messageBranchState);
      if (existingBranchState) {
        safe.messageBranchState = existingBranchState;
      } else if (Object.prototype.hasOwnProperty.call(safe, 'messageBranchState')) {
        delete safe.messageBranchState;
      }
      safe.updatedAt = Number(session?.updatedAt) || Number(existing?.updatedAt) || Date.now();
      return safe;
    }
    safe.messages = incomingMessages;
    return safe;
  });
  const incomingIds = new Set(
    mergedByIncoming
      .map((session) => String(session?.id || '').trim())
      .filter(Boolean)
  );
  const missingExisting = existingList
    .map((session, idx) => sanitizeChatSessionForPersist(session, idx))
    .filter((session) => {
      const sessionId = String(session?.id || '').trim();
      return !incomingIds.has(sessionId) && !deletedChatSessionIdGuardSet.has(sessionId);
    });
  return mergedByIncoming.concat(missingExisting);
}

function countSessionMessages(sessions = []) {
  const source = Array.isArray(sessions) ? sessions : [];
  return source.reduce((sum, session) => {
    const messages = Array.isArray(session?.messages) ? session.messages : [];
    return sum + messages.length;
  }, 0);
}

function backupChatStateFile(file, data) {
  try {
    fs.writeFileSync(`${file}.bak`, JSON.stringify(data || {}, null, 2), 'utf-8');
  } catch {
    // backup failure should not block primary save
  }
}

function getMimeTypeByExt(filePath) {
  const ext = String(path.extname(filePath || '') || '').toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.bmp') return 'image/bmp';
  if (ext === '.svg') return 'image/svg+xml';
  return 'application/octet-stream';
}

function readWindowState() {
  if (!stateFile || !fs.existsSync(stateFile)) return null;
  try {
    const raw = fs.readFileSync(stateFile, 'utf-8');
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    const persistedWidth = Math.round(Number(data.width) || 0);
    const persistedHeight = Math.round(Number(data.height) || 0);
    if (!persistedWidth || !persistedHeight) return null;
    if (persistedWidth < MAIN_WINDOW_DEFAULT_WIDTH || persistedHeight < 600) return null;
    const persistedScaleFactor = normalizeDisplayScaleFactor(
      data.displayScaleFactor,
      0
    );
    const currentScaleFactor = getDisplayScaleFactorForBounds({
      x: Number.isFinite(Number(data.x)) ? Math.round(Number(data.x)) : 0,
      y: Number.isFinite(Number(data.y)) ? Math.round(Number(data.y)) : 0,
      width: persistedWidth,
      height: persistedHeight
    });
    const stateBeforeNormalize = persistedScaleFactor > 0
      ? adaptBoundsByDisplayScale(
        {
          ...data,
          width: persistedWidth,
          height: persistedHeight
        },
        persistedScaleFactor,
        currentScaleFactor
      )
      : {
        ...data,
        width: persistedWidth,
        height: persistedHeight
      };
    return normalizeMainWindowBounds(stateBeforeNormalize, {
      centerIfMissing: false,
      positionPolicy: 'strict-visible'
    });
  } catch {
    return null;
  }
}

function getPrimaryWorkArea() {
  const area = screen.getPrimaryDisplay()?.workArea;
  if (area && Number.isFinite(area.width) && Number.isFinite(area.height)) {
    return area;
  }
  return { x: 0, y: 0, width: 1920, height: 1080 };
}

function normalizeDisplayScaleFactor(value, fallback = 1) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0
    ? numericValue
    : fallback;
}

function getDisplayScaleFactorForBounds(boundsInput) {
  const fallbackBounds = (
    boundsInput && typeof boundsInput === 'object'
      ? boundsInput
      : (win && !win.isDestroyed())
        ? win.getBounds()
        : normalBounds
  ) || { x: 0, y: 0, width: MAIN_WINDOW_DEFAULT_WIDTH, height: MAIN_WINDOW_DEFAULT_HEIGHT };
  let matchedDisplay = null;
  try {
    matchedDisplay = screen.getDisplayMatching(fallbackBounds);
  } catch {}
  return normalizeDisplayScaleFactor(matchedDisplay?.scaleFactor, 1);
}

function syncMainDisplayScaleFactor(boundsInput = null) {
  const nextScaleFactor = getDisplayScaleFactorForBounds(boundsInput);
  lastMainDisplayScaleFactor = nextScaleFactor;
  return nextScaleFactor;
}

function adaptBoundsByDisplayScale(boundsInput, fromScaleFactor, toScaleFactor) {
  const sourceBounds = boundsInput && typeof boundsInput === 'object'
    ? boundsInput
    : { x: 0, y: 0, width: MAIN_WINDOW_DEFAULT_WIDTH, height: MAIN_WINDOW_DEFAULT_HEIGHT };
  const normalizedFromScale = normalizeDisplayScaleFactor(fromScaleFactor, 1);
  const normalizedToScale = normalizeDisplayScaleFactor(toScaleFactor, 1);
  const currentWidth = Math.max(1, Math.round(Number(sourceBounds.width) || MAIN_WINDOW_DEFAULT_WIDTH));
  const currentHeight = Math.max(1, Math.round(Number(sourceBounds.height) || MAIN_WINDOW_DEFAULT_HEIGHT));
  if (Math.abs(normalizedFromScale - normalizedToScale) <= 1e-6) {
    return {
      ...sourceBounds,
      width: currentWidth,
      height: currentHeight
    };
  }
  const scaleRatio = normalizedFromScale / normalizedToScale;
  return {
    ...sourceBounds,
    width: Math.max(1, Math.round(currentWidth * scaleRatio)),
    height: Math.max(1, Math.round(currentHeight * scaleRatio))
  };
}

function getAllDisplayWorkAreas() {
  const displayList = screen.getAllDisplays();
  const areaList = Array.isArray(displayList)
    ? displayList
      .map((display) => display?.workArea)
      .filter((area) => (
        area
        && Number.isFinite(area.x)
        && Number.isFinite(area.y)
        && Number.isFinite(area.width)
        && Number.isFinite(area.height)
        && area.width > 0
        && area.height > 0
      ))
    : [];
  return areaList.length ? areaList : [getPrimaryWorkArea()];
}

function getRectIntersectionArea(leftRect, rightRect) {
  const left = Math.max(Number(leftRect?.x) || 0, Number(rightRect?.x) || 0);
  const top = Math.max(Number(leftRect?.y) || 0, Number(rightRect?.y) || 0);
  const right = Math.min(
    (Number(leftRect?.x) || 0) + Math.max(0, Number(leftRect?.width) || 0),
    (Number(rightRect?.x) || 0) + Math.max(0, Number(rightRect?.width) || 0)
  );
  const bottom = Math.min(
    (Number(leftRect?.y) || 0) + Math.max(0, Number(leftRect?.height) || 0),
    (Number(rightRect?.y) || 0) + Math.max(0, Number(rightRect?.height) || 0)
  );
  const intersectionWidth = right - left;
  const intersectionHeight = bottom - top;
  if (intersectionWidth <= 0 || intersectionHeight <= 0) return 0;
  return intersectionWidth * intersectionHeight;
}

function isRectFullyInsideArea(rect, area) {
  const rectX = Number(rect?.x) || 0;
  const rectY = Number(rect?.y) || 0;
  const rectWidth = Math.max(0, Number(rect?.width) || 0);
  const rectHeight = Math.max(0, Number(rect?.height) || 0);
  const areaX = Number(area?.x) || 0;
  const areaY = Number(area?.y) || 0;
  const areaWidth = Math.max(0, Number(area?.width) || 0);
  const areaHeight = Math.max(0, Number(area?.height) || 0);
  return (
    rectX >= areaX
    && rectY >= areaY
    && (rectX + rectWidth) <= (areaX + areaWidth)
    && (rectY + rectHeight) <= (areaY + areaHeight)
  );
}

function classifyWindowBoundsVisibility(bounds, workAreas) {
  const areas = Array.isArray(workAreas) && workAreas.length
    ? workAreas
    : [getPrimaryWorkArea()];
  const hasVisibleIntersection = areas.some(
    (area) => getRectIntersectionArea(bounds, area) > 0
  );
  if (!hasVisibleIntersection) return 'offscreen';
  const fullyInsideAnyDisplay = areas.some((area) => isRectFullyInsideArea(bounds, area));
  return fullyInsideAnyDisplay ? 'inside' : 'partial';
}

function normalizeMainWindowBounds(rawBounds, options = {}) {
  const source = rawBounds && typeof rawBounds === 'object' ? rawBounds : {};
  const centerIfMissing = !!options.centerIfMissing;
  const positionPolicy = options.positionPolicy === 'offscreen-only'
    ? 'offscreen-only'
    : 'strict-visible';
  const workAreas = getAllDisplayWorkAreas();
  const primaryArea = getPrimaryWorkArea();
  const minWidth = Math.max(1, Math.round(Number(minBounds?.width) || 1));
  const minHeight = Math.max(1, Math.round(Number(minBounds?.height) || 1));
  const maxWidth = Math.max(minWidth, ...workAreas.map((area) => Math.round(area.width)));
  const maxHeight = Math.max(minHeight, ...workAreas.map((area) => Math.round(area.height)));

  let width = Math.round(Number(source.width));
  let height = Math.round(Number(source.height));
  if (!Number.isFinite(width)) width = Math.round(Number(normalBounds?.width) || MAIN_WINDOW_DEFAULT_WIDTH);
  if (!Number.isFinite(height)) height = Math.round(Number(normalBounds?.height) || MAIN_WINDOW_DEFAULT_HEIGHT);
  width = Math.max(minWidth, Math.min(maxWidth, width));
  height = Math.max(minHeight, Math.min(maxHeight, height));

  const hasX = Number.isFinite(Number(source.x));
  const hasY = Number.isFinite(Number(source.y));
  const probe = {
    x: hasX ? Math.round(Number(source.x)) : primaryArea.x,
    y: hasY ? Math.round(Number(source.y)) : primaryArea.y,
    width,
    height
  };
  const targetArea = screen.getDisplayMatching(probe)?.workArea || primaryArea;

  let x = hasX ? probe.x : Math.round(targetArea.x + ((targetArea.width - width) / 2));
  let y = hasY ? probe.y : Math.round(targetArea.y + ((targetArea.height - height) / 2));
  if (centerIfMissing && (!hasX || !hasY)) {
    x = Math.round(targetArea.x + ((targetArea.width - width) / 2));
    y = Math.round(targetArea.y + ((targetArea.height - height) / 2));
  }

  if (positionPolicy === 'strict-visible') {
    const minX = targetArea.x;
    const maxX = targetArea.x + Math.max(0, targetArea.width - width);
    const minY = targetArea.y;
    const maxY = targetArea.y + Math.max(0, targetArea.height - height);
    x = Math.max(minX, Math.min(maxX, x));
    y = Math.max(minY, Math.min(maxY, y));
  } else {
    const currentVisibility = classifyWindowBoundsVisibility({ x, y, width, height }, workAreas);
    if (currentVisibility === 'offscreen') {
      x = Math.round(targetArea.x + ((targetArea.width - width) / 2));
      y = Math.round(targetArea.y + ((targetArea.height - height) / 2));
    }
  }

  return { x, y, width, height };
}

function updateNormalBoundsForCurrentDisplays(reason = '') {
  const next = normalizeMainWindowBounds(normalBounds, {
    centerIfMissing: true,
    positionPolicy: 'offscreen-only'
  });
  const changed = (
    !normalBounds
    || next.x !== normalBounds.x
    || next.y !== normalBounds.y
    || next.width !== normalBounds.width
    || next.height !== normalBounds.height
  );
  normalBounds = { ...normalBounds, ...next };
  if (changed && reason) {
    log('main-window-bounds-normalized', { reason, ...next });
  }
  return changed;
}

function ensureMainWindowOnVisibleDisplay(reason = '', options = {}) {
  if (!win || win.isDestroyed()) return false;
  const positionPolicy = options.positionPolicy === 'strict-visible'
    ? 'strict-visible'
    : 'offscreen-only';
  const current = win.getBounds();
  const next = normalizeMainWindowBounds(current, {
    centerIfMissing: true,
    positionPolicy
  });
  const changed = (
    next.x !== current.x
    || next.y !== current.y
    || next.width !== current.width
    || next.height !== current.height
  );
  if (changed) {
    holdMainMoveSyncSuppress(140);
    win.setBounds(next, false);
    scheduleSaveWindowState();
    if (reason) {
      log('main-window-position-corrected', { reason, ...next });
    }
  }
  normalBounds = { ...normalBounds, ...win.getBounds() };
  return changed;
}

function scheduleSaveWindowState() {
  if (!win || !stateFile) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const bounds = win.getBounds();
      const payload = {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        displayScaleFactor: getDisplayScaleFactorForBounds(bounds)
      };
      fs.writeFileSync(stateFile, JSON.stringify(payload, null, 2));
    } catch {}
  }, 200);
}

function normalizeFloatingToggleStatus(raw) {
  const value = String(raw || '').trim().toLowerCase();
  if (value === 'error') return 'warn';
  if (value === 'info') return 'connected';
  if (
    value === 'idle'
    || value === 'ok'
    || value === 'connected'
    || value === 'busy'
    || value === 'warn'
    || value === 'task-running'
    || value === 'task-success'
    || value === 'task-failed'
    || value === 'chat-running'
    || value === 'chat-success'
    || value === 'chat-failed'
  ) {
    return value;
  }
  return 'idle';
}

function normalizeFloatingToggleRunnerSource(raw) {
  const value = String(raw || '').trim().toLowerCase();
  if (value === 'run' || value === 'chat' || value === 'mixed' || value === 'none') {
    return value;
  }
  return 'none';
}

function normalizeFloatingToggleRunnerPhase(raw) {
  const value = String(raw || '').trim().toLowerCase();
  if (
    value === 'running'
    || value === 'filling'
    || value === 'frozen'
    || value === 'shrinking'
    || value === 'fading'
    || value === 'idle'
  ) {
    return value;
  }
  return 'idle';
}

function normalizeFloatingToggleRunnerLen(raw) {
  const value = String(raw || '').trim().toLowerCase();
  if (
    value === 'full'
    || value === 'sharp-short'
    || value === 'sharp-medium'
    || value === 'sharp-long'
    || value === 'soft-short'
    || value === 'soft-medium'
    || value === 'soft-long'
  ) {
    return value;
  }
  return 'soft-short';
}

function normalizeFloatingToggleRunnerColorTone(raw) {
  const value = String(raw || '').trim().toLowerCase();
  if (value === 'success' || value === 'error') return value;
  return 'orange';
}

function normalizeFloatingToggleRunnerSpinDurationMs(raw) {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return 2000;
  return Math.max(600, Math.min(6000, Math.round(value)));
}

function normalizeFloatingToggleRunnerFlag(raw, fallback = false) {
  if (typeof raw === 'boolean') return raw;
  return !!fallback;
}

function sanitizeFloatingToggleOpacity(raw) {
  const value = Number(raw);
  if (!Number.isFinite(value)) return FLOAT_WIN_OPACITY_DEFAULT;
  return Math.min(FLOAT_WIN_OPACITY_MAX, Math.max(FLOAT_WIN_OPACITY_MIN, value));
}

function hasEnabledFloatingQuickButtons() {
  return FLOATING_QUICK_ACTION_SET.size > 0;
}

function getFloatingToggleConfig() {
  const quickButtonCount = hasEnabledFloatingQuickButtons()
    ? FLOAT_WIN_QUICK_BUTTON_COUNT
    : 0;
  return {
    outerGap: FLOAT_WIN_OUTER_GAP,
    dragStripHeight: FLOAT_WIN_DRAG_STRIP_HEIGHT,
    toggleHeight: FLOAT_WIN_TOGGLE_HEIGHT,
    quickButtonSize: FLOAT_WIN_QUICK_BUTTON_SIZE,
    quickButtonGap: FLOAT_WIN_QUICK_BUTTON_GAP,
    quickGroupTopGap: FLOAT_WIN_QUICK_GROUP_TOP_GAP,
    quickButtonCount,
    quickMainButtonCount: FLOAT_WIN_QUICK_MAIN_BUTTON_COUNT,
    quickPaddingY: FLOAT_WIN_QUICK_PADDING_Y,
    dividerHeight: FLOAT_WIN_DIVIDER_HEIGHT,
    dividerMarginY: FLOAT_WIN_DIVIDER_MARGIN_Y,
    opacityMin: FLOAT_WIN_OPACITY_MIN,
    opacityMax: FLOAT_WIN_OPACITY_MAX,
    opacityDefault: FLOAT_WIN_OPACITY_DEFAULT,
    enabledQuickActions: Array.from(FLOATING_QUICK_ACTION_SET)
  };
}

function normalizeFloatingQuickActionPayload(payload) {
  const source = payload && typeof payload === 'object' ? payload : {};
  const action = String(source.action || '').trim().toLowerCase();
  if (!FLOATING_QUICK_ACTION_SET.has(action)) return null;
  const triggerRaw = String(source.trigger || 'click').trim().toLowerCase();
  const trigger = FLOATING_QUICK_TRIGGER_SET.has(triggerRaw) ? triggerRaw : 'click';
  return { action, trigger, ts: Date.now() };
}

function sendFloatingQuickActionToMain(payload) {
  const normalized = normalizeFloatingQuickActionPayload(payload);
  if (!normalized) return { ok: false, error: 'invalid-action' };
  if (normalized.action === 'global-restart' && normalized.trigger === 'click') {
    return handleGlobalRestartRequest('floating-quick-action');
  }
  if (!win || win.isDestroyed()) return { ok: false, error: 'main-window-unavailable' };
  try {
    win.webContents.send('shell:floating-quick-action', normalized);
    return { ok: true, ...normalized };
  } catch (error) {
    return { ok: false, error: String(error?.message || error || 'send-failed') };
  }
}

function handleGlobalRestartRequest(source = 'unknown') {
  try {
    // In dev mode, relaunch may terminate without reopening.
    // Use soft restart to keep window recoverable.
    if (!app.isPackaged) {
      if (!win || win.isDestroyed()) {
        createWindow();
      } else {
        updateNormalBoundsForCurrentDisplays(`global-restart-dev:${source}`);
        if (win.isMinimized()) win.restore();
        if (!win.isVisible()) win.show();
        ensureMainWindowOnVisibleDisplay(`global-restart-dev:${source}`);
        win.focus();
        try {
          win.webContents.reloadIgnoringCache();
        } catch {
          win.reload();
        }
      }
      applyMainAlwaysOnTop();
      positionFloatingToggleWindow();
      sendFloatingToggleState();
      return { ok: true, restarting: false, mode: 'soft-reload' };
    }
    app.relaunch();
    setTimeout(() => app.exit(0), 32);
    return { ok: true, restarting: true, mode: 'relaunch' };
  } catch (error) {
    return { ok: false, message: String(error?.message || error || 'restart-failed') };
  }
}

function holdFloatingMoveSyncSuppress(ms = 72) {
  suppressFloatingMoveSync = true;
  if (suppressFloatingMoveSyncTimer) {
    clearTimeout(suppressFloatingMoveSyncTimer);
    suppressFloatingMoveSyncTimer = null;
  }
  suppressFloatingMoveSyncTimer = setTimeout(() => {
    suppressFloatingMoveSync = false;
    suppressFloatingMoveSyncTimer = null;
  }, Math.max(16, Math.round(Number(ms) || 0)));
}

function holdMainMoveSyncSuppress(ms = 72) {
  suppressMainMoveSync = true;
  if (suppressMainMoveSyncTimer) {
    clearTimeout(suppressMainMoveSyncTimer);
    suppressMainMoveSyncTimer = null;
  }
  suppressMainMoveSyncTimer = setTimeout(() => {
    suppressMainMoveSync = false;
    suppressMainMoveSyncTimer = null;
  }, Math.max(16, Math.round(Number(ms) || 0)));
}

function isMainWindowShown() {
  return !!(win && !win.isDestroyed() && win.isVisible() && !win.isMinimized());
}

function clearBlurMinimizeTimer() {
  if (!blurMinimizeTimer) return;
  clearTimeout(blurMinimizeTimer);
  blurMinimizeTimer = null;
}

function scheduleAutoMinimizeIfUnfocused(delayMs = 140) {
  if (!autoMinimizeOnBlur) return;
  clearBlurMinimizeTimer();
  blurMinimizeTimer = setTimeout(() => {
    blurMinimizeTimer = null;
    if (!win || win.isDestroyed()) return;
    if (!isMainWindowShown()) return;
    const focusedWindow = BrowserWindow.getFocusedWindow();
    if (focusedWindow === win) return;
    // Floating toggle window is part of this app's main interaction surface.
    // Do not auto-minimize main window when focus is on floating toggle.
    if (floatWin && !floatWin.isDestroyed() && focusedWindow === floatWin) return;
    win.minimize();
    sendFloatingToggleState();
  }, Math.max(40, Math.round(Number(delayMs) || 0)));
}

function applyMainAlwaysOnTop() {
  if (!win || win.isDestroyed()) return;
  const desiredAlwaysOnTop = !!mainAlwaysOnTop;
  try {
    if (
      typeof win.isAlwaysOnTop === 'function' &&
      win.isAlwaysOnTop() === desiredAlwaysOnTop
    ) {
      return;
    }
    if (desiredAlwaysOnTop) {
      win.setAlwaysOnTop(true, MAIN_ALWAYS_ON_TOP_LEVEL);
    } else {
      win.setAlwaysOnTop(false);
    }
  } catch {
    try {
      win.setAlwaysOnTop(desiredAlwaysOnTop);
    } catch {}
  }
}

function syncFloatingToggleOnMainWindowActive(options = {}) {
  if (!floatingToggleEnabled) return;
  ensureFloatingToggleOnTop({
    forceShow: !!options.forceShow,
  });
}

function getFloatingToggleTargetHeight(mainVisible = isMainWindowShown()) {
  return mainVisible && hasEnabledFloatingQuickButtons()
    ? FLOAT_WIN_EXPANDED_HEIGHT
    : FLOAT_WIN_COLLAPSED_HEIGHT;
}

function getFloatingToggleTargetWidth(mainVisible = isMainWindowShown()) {
  return mainVisible ? getFloatingToggleExpandedWidth() : getFloatingToggleCollapsedWidth();
}

function getFloatingToggleBounds(mainVisible = isMainWindowShown()) {
  const fallbackBounds = normalBounds || { x: 0, y: 0, width: MAIN_WINDOW_DEFAULT_WIDTH, height: MAIN_WINDOW_DEFAULT_HEIGHT };
  const base = (mainVisible && win && !win.isDestroyed()) ? win.getBounds() : fallbackBounds;
  const targetWidth = getFloatingToggleTargetWidth(mainVisible);
  const targetHeight = getFloatingToggleTargetHeight(mainVisible);
  const rawX = Math.round(base.x + base.width + FLOAT_WIN_MARGIN);
  const rawY = Math.round(base.y);
  const display = screen.getDisplayMatching(base);
  const area = display?.workArea || { x: 0, y: 0, width: 1920, height: 1080 };
  const minX = area.x + FLOAT_WIN_MARGIN;
  const maxX = area.x + area.width - targetWidth - FLOAT_WIN_MARGIN;
  const minY = area.y;
  const maxY = area.y + area.height - targetHeight;
  const x = Math.max(minX, Math.min(maxX, rawX));
  const y = Math.max(minY, Math.min(maxY, rawY));
  return { x, y, width: targetWidth, height: targetHeight };
}

function clearFloatingResizeAnimation() {
  if (!floatingResizeAnimationTimer) return;
  clearTimeout(floatingResizeAnimationTimer);
  floatingResizeAnimationTimer = null;
}

function easeInOutCubic(t) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t < 0.5
    ? 4 * t * t * t
    : 1 - (Math.pow(-2 * t + 2, 3) / 2);
}

function animateFloatingToggleBounds(nextBounds, durationMs = FLOAT_WIN_RESIZE_ANIMATION_MS) {
  if (!floatWin || floatWin.isDestroyed()) return;
  const start = floatWin.getBounds();
  if (
    start.x === nextBounds.x
    && start.y === nextBounds.y
    && start.width === nextBounds.width
    && start.height === nextBounds.height
  ) {
    return;
  }
  clearFloatingResizeAnimation();
  const duration = Math.max(100, Math.round(Number(durationMs) || 0));
  const beginTs = Date.now();
  holdFloatingMoveSyncSuppress(duration + 120);
  const step = () => {
    if (!floatWin || floatWin.isDestroyed()) {
      clearFloatingResizeAnimation();
      return;
    }
    const elapsed = Date.now() - beginTs;
    const t = Math.min(1, elapsed / duration);
    const k = easeInOutCubic(t);
    const bounds = {
      x: Math.round(start.x + ((nextBounds.x - start.x) * k)),
      y: Math.round(start.y + ((nextBounds.y - start.y) * k)),
      width: Math.round(start.width + ((nextBounds.width - start.width) * k)),
      height: Math.round(start.height + ((nextBounds.height - start.height) * k))
    };
    floatWin.setBounds(bounds, false);
    lastFloatingBounds = { ...bounds };
    if (t >= 1) {
      clearFloatingResizeAnimation();
      return;
    }
    floatingResizeAnimationTimer = setTimeout(step, 16);
  };
  step();
}

function syncFloatingToggleWindowSize(mainVisible = isMainWindowShown()) {
  if (!floatWin || floatWin.isDestroyed()) return;
  const targetWidth = getFloatingToggleTargetWidth(mainVisible);
  const targetHeight = getFloatingToggleTargetHeight(mainVisible);
  const bounds = floatWin.getBounds();
  const nextBounds = {
    x: bounds.x,
    y: bounds.y,
    width: targetWidth,
    height: targetHeight
  };
  const display = screen.getDisplayMatching(bounds);
  const area = display?.workArea || { x: 0, y: 0, width: 1920, height: 1080 };
  const minX = area.x + FLOAT_WIN_MARGIN;
  const maxX = area.x + area.width - targetWidth - FLOAT_WIN_MARGIN;
  const minY = area.y;
  const maxY = area.y + area.height - targetHeight;
  nextBounds.x = Math.max(minX, Math.min(maxX, nextBounds.x));
  nextBounds.y = Math.max(minY, Math.min(maxY, nextBounds.y));
  if (
    nextBounds.x === bounds.x
    && nextBounds.y === bounds.y
    && nextBounds.width === bounds.width
    && nextBounds.height === bounds.height
  ) {
    return;
  }
  const sizeChanged = nextBounds.width !== bounds.width || nextBounds.height !== bounds.height;
  if (sizeChanged) {
    clearFloatingResizeAnimation();
    holdFloatingMoveSyncSuppress(96);
    floatWin.setBounds(nextBounds, false);
    lastFloatingBounds = { ...nextBounds };
    return;
  }
  clearFloatingResizeAnimation();
  holdFloatingMoveSyncSuppress(72);
  floatWin.setBounds(nextBounds, false);
  lastFloatingBounds = { ...nextBounds };
}

function sendFloatingToggleState() {
  if (!floatWin || floatWin.isDestroyed()) return;
  const mainVisible = isMainWindowShown();
  const quickButtonsVisible = mainVisible && hasEnabledFloatingQuickButtons();
  syncFloatingToggleWindowSize(mainVisible);
  try {
    floatWin.webContents.send('shell:floating-toggle-state', {
      visible: mainVisible,
      enabled: !!floatingToggleEnabled,
      status: normalizeFloatingToggleStatus(floatingToggleStatus),
      runnerSource: normalizeFloatingToggleRunnerSource(floatingToggleRunnerSource),
      runnerPhase: normalizeFloatingToggleRunnerPhase(floatingToggleRunnerPhase),
      runnerLen: normalizeFloatingToggleRunnerLen(floatingToggleRunnerLen),
      runnerColorTone: normalizeFloatingToggleRunnerColorTone(floatingToggleRunnerColorTone),
      runnerVisible: normalizeFloatingToggleRunnerFlag(floatingToggleRunnerVisible, false),
      runnerFrozen: normalizeFloatingToggleRunnerFlag(floatingToggleRunnerFrozen, false),
      runnerFading: normalizeFloatingToggleRunnerFlag(floatingToggleRunnerFading, false),
      runnerSpinDurationMs: normalizeFloatingToggleRunnerSpinDurationMs(
        floatingToggleRunnerSpinDurationMs,
      ),
      opacity: floatingToggleOpacity,
      quickButtonsVisible
    });
  } catch {}
}

function applyFloatingToggleOpacity(opacity) {
  floatingToggleOpacity = sanitizeFloatingToggleOpacity(opacity);
  if (floatWin && !floatWin.isDestroyed()) {
    try {
      floatWin.setOpacity(floatingToggleOpacity);
    } catch {}
  }
  sendFloatingToggleState();
  return floatingToggleOpacity;
}

function positionFloatingToggleWindow() {
  if (!floatWin || floatWin.isDestroyed()) return;
  const mainVisible = isMainWindowShown();
  const bounds = getFloatingToggleBounds(mainVisible);
  clearFloatingResizeAnimation();
  holdFloatingMoveSyncSuppress(72);
  floatWin.setBounds(bounds, false);
  lastFloatingBounds = { ...bounds };
}

function ensureFloatingToggleWindow() {
  if (floatWin && !floatWin.isDestroyed()) return floatWin;
  floatWin = new BrowserWindow({
    width: getFloatingToggleTargetWidth(isMainWindowShown()),
    height: getFloatingToggleTargetHeight(isMainWindowShown()),
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    show: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: true,
    roundedCorners: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  floatWin.setAlwaysOnTop(true, 'screen-saver');
  floatWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  floatWin.setMenuBarVisibility(false);
  floatWin.removeMenu?.();
  floatWin.on('closed', () => {
    clearFloatingResizeAnimation();
    floatWin = null;
    lastFloatingBounds = null;
  });
  applyFloatingToggleOpacity(floatingToggleOpacity);
  floatWin.loadFile(path.join(__dirname, 'renderer', 'floating-toggle', 'index.html')).catch(() => {});
  floatWin.webContents.on('did-finish-load', () => {
    positionFloatingToggleWindow();
    sendFloatingToggleState();
  });
  floatWin.on('move', () => {
    if (!floatWin || floatWin.isDestroyed()) return;
    const current = floatWin.getBounds();
    if (suppressFloatingMoveSync) {
      lastFloatingBounds = current;
      return;
    }
    if (!lastFloatingBounds) {
      lastFloatingBounds = current;
      return;
    }
    const dx = current.x - lastFloatingBounds.x;
    const dy = current.y - lastFloatingBounds.y;
    lastFloatingBounds = current;
    if (!dx && !dy) return;
    if (isMainWindowShown()) {
      const winBounds = win.getBounds();
      const sizeAnchorBounds = normalBounds && typeof normalBounds === 'object'
        ? normalBounds
        : winBounds;
      const anchoredMainWidth = Math.max(
        1,
        Math.round(
          Number(sizeAnchorBounds?.width)
          || Number(winBounds?.width)
          || MAIN_WINDOW_DEFAULT_WIDTH
        )
      );
      const anchoredMainHeight = Math.max(
        1,
        Math.round(
          Number(sizeAnchorBounds?.height)
          || Number(winBounds?.height)
          || 880
        )
      );
      const nextMainBounds = {
        x: Math.round(winBounds.x + dx),
        y: Math.round(winBounds.y + dy),
        width: anchoredMainWidth,
        height: anchoredMainHeight
      };
      holdMainMoveSyncSuppress(92);
      // Move by bounds instead of setPosition to keep width/height stable on Windows.
      win.setBounds(nextMainBounds, false);
      normalBounds = nextMainBounds;
      scheduleSaveWindowState();
    } else {
      normalBounds = {
        ...normalBounds,
        x: (Number(normalBounds?.x) || 0) + dx,
        y: (Number(normalBounds?.y) || 0) + dy
      };
    }
  });
  return floatWin;
}

function ensureFloatingToggleOnTop(options = {}) {
  if (!floatingToggleEnabled) {
    return { ok: false, visible: false, reason: 'floating-toggle-disabled' };
  }
  const ensured = ensureFloatingToggleWindow();
  if (!ensured || ensured.isDestroyed()) {
    return { ok: false, visible: false, reason: 'floating-toggle-unavailable' };
  }
  try {
    ensured.setAlwaysOnTop(true, 'screen-saver');
  } catch {
    try {
      ensured.setAlwaysOnTop(true);
    } catch {}
  }
  if ((options && options.forceShow) || isMainWindowShown()) {
    if (!ensured.isVisible()) {
      ensured.showInactive();
    }
  }
  try {
    ensured.moveTop();
  } catch {}
  sendFloatingToggleState();
  return { ok: true, visible: ensured.isVisible() };
}

function setFloatingToggleEnabledState(nextEnabled) {
  floatingToggleEnabled = !!nextEnabled;
  if (!floatingToggleEnabled) {
    if (floatWin && !floatWin.isDestroyed()) {
      floatWin.hide();
    }
    if (win && !win.isDestroyed() && !isMainWindowShown()) {
      updateNormalBoundsForCurrentDisplays('floating-toggle-disabled');
      if (win.isMinimized()) win.restore();
      if (!win.isVisible()) win.show();
      ensureMainWindowOnVisibleDisplay('floating-toggle-disabled');
      win.focus();
      applyMainAlwaysOnTop();
    }
    return {
      ok: true,
      enabled: floatingToggleEnabled,
      visible: isMainWindowShown(),
      status: normalizeFloatingToggleStatus(floatingToggleStatus),
      opacity: floatingToggleOpacity,
      quickButtonsVisible: isMainWindowShown() && hasEnabledFloatingQuickButtons()
    };
  }
  const ensured = ensureFloatingToggleWindow();
  positionFloatingToggleWindow();
  if (ensured && !ensured.isDestroyed()) {
    ensured.showInactive();
  }
  sendFloatingToggleState();
  return {
    ok: true,
    enabled: floatingToggleEnabled,
    visible: isMainWindowShown(),
    status: normalizeFloatingToggleStatus(floatingToggleStatus),
    opacity: floatingToggleOpacity,
    quickButtonsVisible: isMainWindowShown() && hasEnabledFloatingQuickButtons()
  };
}

function toggleMainWindowVisibility() {
  if (!win || win.isDestroyed()) return { ok: false, visible: false };
  if (isMainWindowShown()) {
    win.minimize();
  } else {
    updateNormalBoundsForCurrentDisplays('toggle-main-window-visibility');
    const current = win.getBounds();
    const targetBounds = normalizeMainWindowBounds({
      x: Number.isFinite(Number(normalBounds?.x)) ? Number(normalBounds.x) : current.x,
      y: Number.isFinite(Number(normalBounds?.y)) ? Number(normalBounds.y) : current.y,
      width: Number.isFinite(Number(normalBounds?.width)) ? Number(normalBounds.width) : current.width,
      height: Number.isFinite(Number(normalBounds?.height)) ? Number(normalBounds.height) : current.height
    }, {
      centerIfMissing: true,
      positionPolicy: 'offscreen-only'
    });
    if (win.isMinimized()) win.restore();
    if (!win.isVisible()) win.show();
    const latest = win.getBounds();
    if (
      targetBounds.x !== latest.x
      || targetBounds.y !== latest.y
      || targetBounds.width !== latest.width
      || targetBounds.height !== latest.height
    ) {
      holdMainMoveSyncSuppress(120);
      win.setBounds(targetBounds, false);
    }
    win.focus();
    applyMainAlwaysOnTop();
    scheduleAutoMinimizeIfUnfocused(180);
    normalBounds = win.getBounds();
  }
  sendFloatingToggleState();
  return { ok: true, visible: isMainWindowShown() };
}

function createWindow() {
  const restored = readWindowState();
  if (restored) {
    normalBounds = {
      width: restored.width,
      height: restored.height,
      x: restored.x,
      y: restored.y
    };
  }
  let devLoadRetryTimer = null;
  let devLoadRetryCount = 0;
  const clearDevLoadRetryTimer = () => {
    if (devLoadRetryTimer) {
      clearTimeout(devLoadRetryTimer);
      devLoadRetryTimer = null;
    }
  };
  const scheduleDevReload = (reason = 'did-fail-load') => {
    if (!DEV_SERVER_URL || !win || win.isDestroyed()) return;
    if (devLoadRetryTimer) return;
    const delayMs = Math.min(2600, 800 + (devLoadRetryCount * 250));
    devLoadRetryTimer = setTimeout(() => {
      devLoadRetryTimer = null;
      if (!win || win.isDestroyed()) return;
      devLoadRetryCount += 1;
      log('dev-reload-attempt', { reason, count: devLoadRetryCount, delayMs });
      Promise.resolve(win.loadURL(DEV_SERVER_URL)).catch((err) => {
        log('dev-reload-error', { message: String(err?.message || err || 'loadURL failed') });
      });
    }, delayMs);
  };
  win = new BrowserWindow({
    width: normalBounds.width || MAIN_WINDOW_DEFAULT_WIDTH,
    height: normalBounds.height || MAIN_WINDOW_DEFAULT_HEIGHT,
    x: typeof normalBounds.x === 'number' ? normalBounds.x : undefined,
    y: typeof normalBounds.y === 'number' ? normalBounds.y : undefined,
    center: typeof normalBounds.x !== 'number' || typeof normalBounds.y !== 'number',
    show: false,
    minWidth: minBounds.width,
    minHeight: minBounds.height,
    resizable: true,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#323232',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  ensureMainWindowOnVisibleDisplay('create-window', { positionPolicy: 'strict-visible' });

  // Ensure all web links open in system default browser instead of Electron child windows.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (openExternalInDefaultBrowser(url)) {
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (isRendererAppUrl(url)) return;
    if (openExternalInDefaultBrowser(url)) {
      event.preventDefault();
    }
  });

  normalBounds = win.getBounds();
  syncMainDisplayScaleFactor(normalBounds);

  // Disable maximize/fullscreen (including double-click on drag region)
  win.setMaximizable(false);
  if (typeof win.setFullScreenable === 'function') {
    win.setFullScreenable(false);
  }

  if (DEV_SERVER_URL) {
    win.loadURL(DEV_SERVER_URL);
  } else {
    const repoDistIndex = path.resolve(__dirname, '..', 'webui', 'dist', 'index.html');
    const bundledDistIndex = path.join(__dirname, 'webui', 'dist', 'index.html');
    const distIndex = fs.existsSync(repoDistIndex) ? repoDistIndex : bundledDistIndex;
    if (!fs.existsSync(distIndex)) {
      log('dist index missing', { distIndex });
      win.loadURL(`data:text/plain;charset=utf-8,Missing%20webui%20build`);
    } else {
      win.loadFile(distIndex);
    }
  }

  win.once('ready-to-show', () => {
    if (!win) return;
    win.show();
    win.focus();
    applyMainAlwaysOnTop();
    normalBounds = win.getBounds();
    syncMainDisplayScaleFactor(normalBounds);
    setFloatingToggleEnabledState(floatingToggleEnabled);
  });

  win.webContents.on('did-finish-load', () => {
    devLoadRetryCount = 0;
    clearDevLoadRetryTimer();
    console.log('[electron] did-finish-load');
  });

  if (DEV_SERVER_URL) {
    win.webContents.openDevTools({ mode: 'detach' });
  }
  win.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    log('did-fail-load', { errorCode, errorDescription, validatedURL, isMainFrame });
    if (DEV_SERVER_URL && isMainFrame) {
      scheduleDevReload('did-fail-load');
    }
  });
  win.webContents.on('console-message', (event, level, message, line, sourceId) => {
    const rendererLevel = mapRendererConsoleLevel(level);
    log(
      'renderer',
      {
        level: rendererLevel,
        rawLevel: Number(level),
        message,
        line,
        sourceId
      },
      rendererLevel
    );
  });

  if (!DEV_SERVER_URL) {
    watchDistAndReload();
  }

  win.on('closed', () => {
    clearDevLoadRetryTimer();
    if (floatWin && !floatWin.isDestroyed()) {
      floatWin.close();
      floatWin = null;
    }
    win = null;
    if (process.platform !== 'darwin') {
      app.quit();
      setTimeout(() => app.exit(0), 300);
    }
  });

  win.on('resize', () => {
    const nextBounds = win.getBounds();
    consumeInternalMainResizeExpectation(nextBounds) || clearPendingScaledBoundsRequest();
    normalBounds = nextBounds;
    syncMainDisplayScaleFactor(nextBounds);
    positionFloatingToggleWindow();
    scheduleSaveWindowState();
  });
  win.on('will-resize', () => {
    if (!win) return;
    win.webContents.send('shell:resizing', { resizing: true });
  });
  win.on('resized', () => {
    if (!win) return;
    win.webContents.send('shell:resizing', { resizing: false });
  });
  win.on('move', () => {
    const prevBounds = normalBounds && typeof normalBounds === 'object' ? normalBounds : win.getBounds();
    const nextBounds = win.getBounds();
    const dx = (Number(nextBounds.x) || 0) - (Number(prevBounds.x) || 0);
    const dy = (Number(nextBounds.y) || 0) - (Number(prevBounds.y) || 0);
    normalBounds = nextBounds;
    syncMainDisplayScaleFactor(nextBounds);
    if (suppressMainMoveSync) {
      // During floating-drag synchronized moves, keep size anchored to pre-move values.
      const anchoredWidth = Math.max(
        1,
        Math.round(
          Number(prevBounds?.width)
          || Number(nextBounds?.width)
          || MAIN_WINDOW_DEFAULT_WIDTH
        )
      );
      const anchoredHeight = Math.max(
        1,
        Math.round(
          Number(prevBounds?.height)
          || Number(nextBounds?.height)
          || 880
        )
      );
      if (
        nextBounds.width !== anchoredWidth
        || nextBounds.height !== anchoredHeight
      ) {
        holdMainMoveSyncSuppress(96);
        setInternalMainResizeExpectation(anchoredWidth, anchoredHeight, 3);
        win.setBounds({
          x: nextBounds.x,
          y: nextBounds.y,
          width: anchoredWidth,
          height: anchoredHeight
        }, false);
      }
      normalBounds = {
        ...nextBounds,
        width: anchoredWidth,
        height: anchoredHeight
      };
      return;
    }
    if (floatWin && !floatWin.isDestroyed()) {
      if (dx || dy) {
        const floatBounds = floatWin.getBounds();
        const nextFloatX = floatBounds.x + dx;
        const nextFloatY = floatBounds.y + dy;
        holdFloatingMoveSyncSuppress(72);
        floatWin.setPosition(nextFloatX, nextFloatY, false);
        lastFloatingBounds = {
          ...floatBounds,
          x: nextFloatX,
          y: nextFloatY
        };
      }
    } else {
      positionFloatingToggleWindow();
    }
    if (mainMoveSettleTimer) {
      clearTimeout(mainMoveSettleTimer);
      mainMoveSettleTimer = null;
    }
    mainMoveSettleTimer = setTimeout(() => {
      mainMoveSettleTimer = null;
      positionFloatingToggleWindow();
      scheduleSaveWindowState();
    }, 120);
  });
  win.on('show', () => {
    if (!win) return;
    clearBlurMinimizeTimer();
    normalBounds = win.getBounds();
    syncMainDisplayScaleFactor(normalBounds);
    applyMainAlwaysOnTop();
    syncFloatingToggleOnMainWindowActive();
    positionFloatingToggleWindow();
    sendFloatingToggleState();
    scheduleAutoMinimizeIfUnfocused(180);
  });
  win.on('focus', () => {
    clearBlurMinimizeTimer();
    applyMainAlwaysOnTop();
    syncFloatingToggleOnMainWindowActive();
  });
  win.on('blur', () => {
    scheduleAutoMinimizeIfUnfocused(140);
  });
  win.on('minimize', () => {
    clearBlurMinimizeTimer();
    sendFloatingToggleState();
  });
  win.on('restore', () => {
    clearBlurMinimizeTimer();
    applyMainAlwaysOnTop();
    syncFloatingToggleOnMainWindowActive();
    sendFloatingToggleState();
    scheduleAutoMinimizeIfUnfocused(180);
  });
  win.on('hide', () => {
    clearBlurMinimizeTimer();
    sendFloatingToggleState();
  });
  win.on('close', () => {
    scheduleSaveWindowState();
  });
}

function clampScale(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  // `shell:set-window-scale` now receives a relative ratio between
  // previous/next UI scales, so allow wider one-shot jumps (e.g. 50% -> 150% = 3x).
  return Math.min(4, Math.max(0.25, n));
}

function setInternalMainResizeExpectation(width, height, maxEvents = 2) {
  internalMainResizeExpectation = {
    width: Math.max(1, Math.round(Number(width) || 0)),
    height: Math.max(1, Math.round(Number(height) || 0)),
    remainingEvents: Math.max(1, Math.round(Number(maxEvents) || 1))
  };
}

function consumeInternalMainResizeExpectation(bounds) {
  if (!internalMainResizeExpectation || !bounds || typeof bounds !== 'object') {
    return false;
  }
  const currentWidth = Math.max(1, Math.round(Number(bounds.width) || 0));
  const currentHeight = Math.max(1, Math.round(Number(bounds.height) || 0));
  if (
    currentWidth !== internalMainResizeExpectation.width ||
    currentHeight !== internalMainResizeExpectation.height
  ) {
    internalMainResizeExpectation = null;
    return false;
  }
  internalMainResizeExpectation.remainingEvents -= 1;
  if (internalMainResizeExpectation.remainingEvents <= 0) {
    internalMainResizeExpectation = null;
  }
  return true;
}

function applyMainWindowSizeKeepingPosition(nextWidthInput, nextHeightInput, options = {}) {
  if (!win || win.isDestroyed()) return null;
  const currentBounds = win.getBounds();
  const nextWidth = Math.max(1, Math.round(Number(nextWidthInput) || currentBounds.width || MAIN_WINDOW_DEFAULT_WIDTH));
  const nextHeight = Math.max(1, Math.round(Number(nextHeightInput) || currentBounds.height || MAIN_WINDOW_DEFAULT_HEIGHT));
  if (currentBounds.width === nextWidth && currentBounds.height === nextHeight) {
    return currentBounds;
  }
  setInternalMainResizeExpectation(nextWidth, nextHeight);
  win.setBounds({
    x: currentBounds.x,
    y: currentBounds.y,
    width: nextWidth,
    height: nextHeight
  });
  normalBounds = win.getBounds();
  positionFloatingToggleWindow();
  sendFloatingToggleState();
  if (options && options.saveWindowState) {
    scheduleSaveWindowState();
  }
  return normalBounds;
}

function clearPendingScaledBoundsRequest() {
  pendingScaledBoundsRequest = null;
}

function setPendingScaledBoundsRequest(request = null) {
  if (!request || typeof request !== 'object') {
    pendingScaledBoundsRequest = null;
    return;
  }
  const requestedWidth = Math.max(1, Math.round(Number(request.requestedWidth) || 0));
  const requestedHeight = Math.max(1, Math.round(Number(request.requestedHeight) || 0));
  if (!requestedWidth || !requestedHeight) {
    pendingScaledBoundsRequest = null;
    return;
  }
  pendingScaledBoundsRequest = {
    requestedWidth,
    requestedHeight,
    requestedAt: Date.now()
  };
}

function reconcileMainWindowGeometry(options = {}) {
  if (!win || win.isDestroyed()) {
    return {
      ok: false,
      resized: false,
      bounds: null,
      pendingScaleDeferred: !!pendingScaledBoundsRequest
    };
  }
  const saveWindowState = !!options.saveWindowState;
  const currentBounds = win.getBounds();
  const minW = Math.max(1, Math.round(Number(minBounds?.width) || 1));
  const minH = Math.max(1, Math.round(Number(minBounds?.height) || 1));
  let nextWidth = Math.max(1, Math.round(Number(currentBounds.width) || MAIN_WINDOW_DEFAULT_WIDTH));
  let nextHeight = Math.max(1, Math.round(Number(currentBounds.height) || MAIN_WINDOW_DEFAULT_HEIGHT));
  let hasScaleRequest = false;
  let requestedScaleWidth = null;
  let requestedScaleHeight = null;
  let pendingScaleDeferred = false;

  if (pendingScaledBoundsRequest && typeof pendingScaledBoundsRequest === 'object') {
    requestedScaleWidth = Math.max(
      1,
      Math.round(Number(pendingScaledBoundsRequest.requestedWidth) || 0)
    );
    requestedScaleHeight = Math.max(
      1,
      Math.round(Number(pendingScaledBoundsRequest.requestedHeight) || 0)
    );
    if (requestedScaleWidth > 0 && requestedScaleHeight > 0) {
      hasScaleRequest = true;
      pendingScaleDeferred = requestedScaleWidth < minW || requestedScaleHeight < minH;
      nextWidth = Math.max(requestedScaleWidth, minW);
      nextHeight = Math.max(requestedScaleHeight, minH);
    } else {
      clearPendingScaledBoundsRequest();
    }
  }

  if (!hasScaleRequest) {
    nextWidth = Math.max(nextWidth, minW);
    nextHeight = Math.max(nextHeight, minH);
  }

  const resized =
    currentBounds.width !== nextWidth || currentBounds.height !== nextHeight;
  const bounds = resized
    ? applyMainWindowSizeKeepingPosition(nextWidth, nextHeight, { saveWindowState })
    : currentBounds;

  if (hasScaleRequest && !pendingScaleDeferred) {
    clearPendingScaledBoundsRequest();
  }

  return {
    ok: true,
    resized: !!resized,
    bounds: bounds || win.getBounds(),
    pendingScaleDeferred: !!pendingScaleDeferred,
    requestedScaleWidth: hasScaleRequest ? requestedScaleWidth : null,
    requestedScaleHeight: hasScaleRequest ? requestedScaleHeight : null
  };
}

app.whenReady().then(() => {
  initLogger();
  log('process bootstrap', {
    pid: process.pid,
    ppid: process.ppid,
    version: app.getVersion(),
    exe: process.execPath,
    gotLock: !!gotLock
  });
  loadBridgeConfig();
  ensureUnifiedCacheLayout();
  cleanupPsCacheDirectory();
  scheduleCachePolicyCleanup();
  log('app ready', {
    pid: process.pid,
    ppid: process.ppid,
    port: bridgePort
  });
  startServer();
  createWindow();
  displayTopologyChangeHandler = () => {
    let adaptedByDisplayScale = false;
    if (win && !win.isDestroyed()) {
      const currentBounds = win.getBounds();
      const previousScaleFactor = normalizeDisplayScaleFactor(
        lastMainDisplayScaleFactor,
        getDisplayScaleFactorForBounds(currentBounds)
      );
      const currentScaleFactor = getDisplayScaleFactorForBounds(currentBounds);
      if (Math.abs(previousScaleFactor - currentScaleFactor) > 1e-3) {
        const adaptedBounds = adaptBoundsByDisplayScale(
          currentBounds,
          previousScaleFactor,
          currentScaleFactor
        );
        const normalizedAdaptedBounds = normalizeMainWindowBounds(adaptedBounds, {
          centerIfMissing: true,
          positionPolicy: 'offscreen-only'
        });
        holdMainMoveSyncSuppress(180);
        win.setBounds(normalizedAdaptedBounds, false);
        normalBounds = { ...normalBounds, ...normalizedAdaptedBounds };
        scheduleSaveWindowState();
        adaptedByDisplayScale = true;
        log('main-window-display-scale-adapted', {
          fromScaleFactor: previousScaleFactor,
          toScaleFactor: currentScaleFactor,
          ...normalizedAdaptedBounds
        });
      }
      syncMainDisplayScaleFactor(win.getBounds());
    } else {
      syncMainDisplayScaleFactor(normalBounds);
    }
    const updated = updateNormalBoundsForCurrentDisplays('display-topology-change');
    const corrected = ensureMainWindowOnVisibleDisplay('display-topology-change');
    if (corrected || updated || adaptedByDisplayScale) {
      positionFloatingToggleWindow();
      sendFloatingToggleState();
    }
  };
  screen.on('display-added', displayTopologyChangeHandler);
  screen.on('display-removed', displayTopologyChangeHandler);
  screen.on('display-metrics-changed', displayTopologyChangeHandler);

  // Temporary compatibility: allow known provider hosts with broken TLS chain.
  // Scope is limited to allowlist domains instead of globally disabling cert checks.
  app.on('certificate-error', (event, _webContents, url, error, _certificate, callback) => {
    try {
      const host = String(new URL(String(url || '')).hostname || '').toLowerCase();
      if (INSECURE_TLS_HOST_ALLOWLIST.has(host)) {
        event.preventDefault();
        log('certificate bypass applied', { host, error });
        callback(true);
        return;
      }
    } catch {}
    callback(false);
  });

  ipcMain.handle('shell:set-floating-toggle-enabled', (_evt, value) => {
    return setFloatingToggleEnabledState(!!value);
  });

  ipcMain.handle('shell:get-floating-toggle-state', () => {
    return {
      enabled: !!floatingToggleEnabled,
      visible: isMainWindowShown(),
      status: normalizeFloatingToggleStatus(floatingToggleStatus),
      runnerSource: normalizeFloatingToggleRunnerSource(floatingToggleRunnerSource),
      runnerPhase: normalizeFloatingToggleRunnerPhase(floatingToggleRunnerPhase),
      runnerLen: normalizeFloatingToggleRunnerLen(floatingToggleRunnerLen),
      runnerColorTone: normalizeFloatingToggleRunnerColorTone(floatingToggleRunnerColorTone),
      runnerVisible: normalizeFloatingToggleRunnerFlag(floatingToggleRunnerVisible, false),
      runnerFrozen: normalizeFloatingToggleRunnerFlag(floatingToggleRunnerFrozen, false),
      runnerFading: normalizeFloatingToggleRunnerFlag(floatingToggleRunnerFading, false),
      runnerSpinDurationMs: normalizeFloatingToggleRunnerSpinDurationMs(
        floatingToggleRunnerSpinDurationMs,
      ),
      opacity: floatingToggleOpacity,
      quickButtonsVisible: isMainWindowShown() && hasEnabledFloatingQuickButtons()
    };
  });

  ipcMain.handle('shell:get-floating-toggle-config', () => {
    return { ok: true, ...getFloatingToggleConfig() };
  });

  ipcMain.handle('shell:toggle-main-window-visibility', () => {
    return toggleMainWindowVisibility();
  });

  ipcMain.handle('shell:update-floating-toggle-status', (_evt, level) => {
    const payload = level && typeof level === 'object' ? level : null;
    floatingToggleStatus = normalizeFloatingToggleStatus(payload ? payload.status : level);
    floatingToggleRunnerSource = normalizeFloatingToggleRunnerSource(
      payload ? payload.runnerSource : 'none'
    );
    floatingToggleRunnerPhase = normalizeFloatingToggleRunnerPhase(
      payload ? payload.runnerPhase : 'idle'
    );
    floatingToggleRunnerLen = normalizeFloatingToggleRunnerLen(
      payload ? payload.runnerLen : 'soft-short'
    );
    floatingToggleRunnerColorTone = normalizeFloatingToggleRunnerColorTone(
      payload ? payload.runnerColorTone : 'orange'
    );
    floatingToggleRunnerVisible = normalizeFloatingToggleRunnerFlag(
      payload ? payload.runnerVisible : false,
      false
    );
    floatingToggleRunnerFrozen = normalizeFloatingToggleRunnerFlag(
      payload ? payload.runnerFrozen : false,
      false
    );
    floatingToggleRunnerFading = normalizeFloatingToggleRunnerFlag(
      payload ? payload.runnerFading : false,
      false
    );
    floatingToggleRunnerSpinDurationMs = normalizeFloatingToggleRunnerSpinDurationMs(
      payload ? payload.runnerSpinDurationMs : 2000
    );
    sendFloatingToggleState();
    return {
      ok: true,
      status: normalizeFloatingToggleStatus(floatingToggleStatus),
      runnerSource: normalizeFloatingToggleRunnerSource(floatingToggleRunnerSource),
      runnerPhase: normalizeFloatingToggleRunnerPhase(floatingToggleRunnerPhase),
      runnerLen: normalizeFloatingToggleRunnerLen(floatingToggleRunnerLen),
      runnerColorTone: normalizeFloatingToggleRunnerColorTone(floatingToggleRunnerColorTone),
      runnerVisible: normalizeFloatingToggleRunnerFlag(floatingToggleRunnerVisible, false),
      runnerFrozen: normalizeFloatingToggleRunnerFlag(floatingToggleRunnerFrozen, false),
      runnerFading: normalizeFloatingToggleRunnerFlag(floatingToggleRunnerFading, false),
      runnerSpinDurationMs: normalizeFloatingToggleRunnerSpinDurationMs(
        floatingToggleRunnerSpinDurationMs
      ),
    };
  });

  ipcMain.handle('shell:set-floating-toggle-opacity', (_evt, value) => {
    const opacity = applyFloatingToggleOpacity(value);
    return { ok: true, opacity };
  });

  ipcMain.handle('shell:floating-quick-action', (_evt, payload) => {
    return sendFloatingQuickActionToMain(payload);
  });

  ipcMain.handle('shell:set-on-top', (_evt, value) => {
    if (!win) return { ok: false };
    mainAlwaysOnTop = !!value;
    applyMainAlwaysOnTop();
    return { ok: true, alwaysOnTop: mainAlwaysOnTop };
  });

  ipcMain.handle('shell:ensure-floating-toggle-on-top', () => {
    return ensureFloatingToggleOnTop({ forceShow: false });
  });

  ipcMain.handle('shell:set-auto-minimize-on-blur', (_evt, value) => {
    autoMinimizeOnBlur = !!value;
    if (autoMinimizeOnBlur) {
      scheduleAutoMinimizeIfUnfocused(120);
    } else {
      clearBlurMinimizeTimer();
    }
    return { ok: true, enabled: autoMinimizeOnBlur };
  });

  ipcMain.handle('shell:get-auto-minimize-on-blur', () => {
    return { ok: true, enabled: autoMinimizeOnBlur };
  });

  ipcMain.handle('shell:minimize', () => {
    if (!win) return { ok: false };
    win.minimize();
    return { ok: true };
  });

  ipcMain.handle('shell:close', () => {
    app.quit();
    return { ok: true };
  });

  ipcMain.handle('shell:global-restart', () => {
    return handleGlobalRestartRequest('shell-global-restart');
  });

  ipcMain.handle(SHELL_CHANNELS.serverStatus, async () => {
    const serverStatusSnapshot = getServerStatus();
    const runtimeContractSnapshot = await getBridgeRuntimeContractSnapshotForStatus();
    const responsePayload = {
      ...serverStatusSnapshot,
      runtimeContractReady: !!runtimeContractSnapshot.ready,
      runtimeContractAvailable: !!runtimeContractSnapshot.available,
      runtimeContractErrorCode: String(runtimeContractSnapshot.errorCode || ''),
      runtimeContractMessage: String(runtimeContractSnapshot.message || ''),
      bridgeProtocolVersion: Number(runtimeContractSnapshot.bridgeProtocolVersion) || 0,
      forceLegacyCaptureRelay:
        typeof runtimeContractSnapshot.forceLegacyCaptureRelay === 'boolean'
          ? runtimeContractSnapshot.forceLegacyCaptureRelay
          : null
    };
    return buildShellOkResponse(
      responsePayload,
      responsePayload,
      'server_status_ok'
    );
  });

  ipcMain.handle('shell:memory-sample', () => {
    return {
      ok: true,
      main: snapshotMainMemoryUsage()
    };
  });
  ipcMain.handle('shell:chat-image-cache-get', (_evt, cacheIdOrPayload) => {
    try {
      const cacheLookupPayload =
        cacheIdOrPayload && typeof cacheIdOrPayload === 'object'
          ? cacheIdOrPayload
          : { cacheId: cacheIdOrPayload };
      const result = readChatImageCacheDataUrl(cacheLookupPayload);
      return (
        result || {
          ok: false,
          message: 'not_found',
          cacheId: String(cacheLookupPayload?.cacheId || cacheIdOrPayload || '').trim(),
        }
      );
    } catch (err) {
      log('chat-image-cache-get failed', { message: err.message });
      return {
        ok: false,
        message: err.message,
        cacheId: String(
          (cacheIdOrPayload && typeof cacheIdOrPayload === 'object'
            ? cacheIdOrPayload.cacheId
            : cacheIdOrPayload) || '',
        ).trim(),
      };
    }
  });
  ipcMain.handle('shell:chat-image-cache-get-many', (_evt, payload) => {
    try {
      const ids = Array.isArray(payload?.cacheIds) ? payload.cacheIds : [];
      const items = ids
        .map((id) => readChatImageCacheDataUrl(id))
        .filter(Boolean);
      return { ok: true, items };
    } catch (err) {
      log('chat-image-cache-get-many failed', { message: err.message });
      return { ok: false, message: err.message, items: [] };
    }
  });
  ipcMain.handle('shell:api-image-store-put', (_evt, payload) => {
    try {
      const sourceItems = Array.isArray(payload?.items) ? payload.items : [];
      const usageMeta =
        payload?.usageMeta && typeof payload.usageMeta === 'object'
          ? { ...payload.usageMeta }
          : {};
      const contextBase =
        payload?.context && typeof payload.context === 'object'
          ? { ...payload.context }
          : {};
      const usedCacheIds = new Set();
      const items = persistApiInputImageList(sourceItems, {
        usedCacheIds,
        context: {
          ...contextBase,
          usageMeta
        }
      });
      return { ok: true, items };
    } catch (err) {
      log('api-image-store-put failed', { message: err.message });
      return { ok: false, message: err.message, items: [] };
    }
  });

  ipcMain.handle('shell:server-start', (_evt, payload) => {
    return startServer(payload || {});
  });

  ipcMain.handle('shell:server-stop', () => {
    return stopServer();
  });

  ipcMain.handle('shell:bridge-port-get', () => {
    return { ok: true, port: bridgePort };
  });

  ipcMain.handle('shell:bridge-port-set', (_evt, nextPort) => {
    const parsed = parseBridgePort(nextPort);
    if (!parsed) {
      return { ok: false, message: 'invalid_port', port: bridgePort };
    }
    bridgePort = parsed;
    saveBridgeConfig();
    return { ok: true, port: bridgePort };
  });

  ipcMain.handle(SHELL_CHANNELS.cachePolicyGet, () => {
    try {
      const policy = getCachePolicySnapshot();
      const stats = getManagedCacheStats();
      return buildShellOkResponse(
        { policy, stats },
        { policy, stats },
        'cache_policy_get_ok'
      );
    } catch (err) {
      log('cache-policy-get failed', { message: err.message });
      const fallbackPolicy = getCachePolicySnapshot();
      return buildShellErrorResponse(
        'cache_policy_get_failed',
        err.message,
        { policy: fallbackPolicy, stats: null },
        { policy: fallbackPolicy, stats: null }
      );
    }
  });

  ipcMain.handle(SHELL_CHANNELS.cachePolicySet, (_evt, payload) => {
    try {
      cachePolicy = sanitizeCachePolicy(payload || {});
      saveBridgeConfig();
      const cleanup = cleanupByCachePolicy(cachePolicy, 'policy-set');
      const policy = getCachePolicySnapshot();
      const stats = cleanup?.stats || getManagedCacheStats();
      return buildShellOkResponse(
        { policy, stats },
        { policy, stats },
        'cache_policy_set_ok'
      );
    } catch (err) {
      log('cache-policy-set failed', { message: err.message });
      const fallbackPolicy = getCachePolicySnapshot();
      return buildShellErrorResponse(
        'cache_policy_set_failed',
        err.message,
        { policy: fallbackPolicy, stats: null },
        { policy: fallbackPolicy, stats: null }
      );
    }
  });

  ipcMain.handle('shell:cache-stats-get', () => {
    try {
      return getManagedCacheStats();
    } catch (err) {
      log('cache-stats-get failed', { message: err.message });
      return { ok: false, message: err.message };
    }
  });

  ipcMain.handle('shell:cache-cleanup-now', () => {
    try {
      return cleanupByCachePolicy(cachePolicy, 'manual');
    } catch (err) {
      log('cache-cleanup-now failed', { message: err.message });
      return { ok: false, message: err.message };
    }
  });

  ipcMain.handle('shell:open-temp-folder', () => {
    try {
      ensureUnifiedCacheLayout();
      const dir = getUnifiedCacheRootDir();
      shell.openPath(dir);
      return { ok: true, dir };
    } catch (err) {
      log('open-temp-folder failed', { message: err.message });
      return { ok: false };
    }
  });
  ipcMain.handle('shell:generated-cache-put', async (_evt, payload) => {
    try {
      const dir = getCacheDir();
      fs.mkdirSync(dir, { recursive: true });
      fs.mkdirSync(getGeneratedTargetMetaDir(), { recursive: true });
      const maxFiles = sanitizeGeneratedCacheMaxFiles(payload?.maxFiles);
      const sourceItems = Array.isArray(payload?.items) ? payload.items : [];
      const now = Date.now();
      const savedItems = [];
      for (let index = 0; index < sourceItems.length; index += 1) {
        const item = sourceItems[index];
        const resolved = await resolveGeneratedCacheSource(item);
        if (!resolved?.buffer?.length) continue;
        const ext = getExtByMimeType(item?.type || resolved.mime);
        const stem = sanitizeGeneratedCacheFileStem(item?.name || item?.clientRef || `image-${index + 1}`);
        const fileName = `${now}-${String(index + 1).padStart(2, '0')}-${stem}.${ext}`;
        const filePath = path.join(dir, fileName);
        fs.writeFileSync(filePath, resolved.buffer);
        const targetMeta = sanitizeGeneratedTargetMeta(item?.targetMeta || item);
        let targetMetaFileName = '';
        let targetMetaFilePath = '';
        if (targetMeta) {
          const targetMetaSaved = writeGeneratedTargetMeta(path.parse(fileName).name, targetMeta, now + index);
          targetMetaFileName = targetMetaSaved.fileName;
          targetMetaFilePath = targetMetaSaved.filePath;
        }
        savedItems.push({
          clientRef: String(item?.clientRef || ''),
          fileName,
          filePath,
          byteLength: resolved.buffer.length,
          targetMetaFileName,
          targetMetaFilePath
        });
      }
      pruneGeneratedCacheDir(maxFiles);
      pruneGeneratedTargetMetaDir();
      return {
        ok: true,
        dir,
        targetMetaDir: getGeneratedTargetMetaDir(),
        items: savedItems
      };
    } catch (err) {
      log('generated-cache-put failed', { message: err.message });
      return { ok: false, message: err.message, items: [] };
    }
  });
  ipcMain.handle('shell:generated-cache-read', (_evt, payload) => {
    try {
      return readGeneratedCacheDataUrl(payload || {});
    } catch (err) {
      log('generated-cache-read failed', { message: err.message });
      return { ok: false, message: err.message };
    }
  });
  ipcMain.handle('shell:open-external', (_evt, url) => {
    const ok = openExternalInDefaultBrowser(url);
    return { ok };
  });
  ipcMain.handle('shell:open-image-default', async (_evt, payload) => {
    return openImageInSystemDefaultViewer(payload || {});
  });
  ipcMain.handle('shell:pick-local-images-data', async (_evt, payload) => {
    try {
      const normalizedPayload = payload && typeof payload === 'object' ? payload : {};
      const normalizedTitle = String(normalizedPayload?.title || '').trim() || '选择本地图片';
      const normalizedDefaultDirectoryKey = String(
        normalizedPayload?.defaultDirectory || '',
      ).trim().toLowerCase();
      const shouldIncludeGeneratedTargetMeta =
        normalizedPayload?.includeGeneratedTargetMeta === true;
      let defaultPath = '';
      if (normalizedDefaultDirectoryKey === 'generated-cache') {
        defaultPath = getCacheDir();
        fs.mkdirSync(defaultPath, { recursive: true });
      }
      const pickResult = await dialog.showOpenDialog(win || undefined, {
        title: normalizedTitle,
        defaultPath: defaultPath || undefined,
        properties: ['openFile', 'multiSelections'],
        filters: [
          { name: '图片文件', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg'] },
          { name: 'all-files', extensions: ['*'] }
        ]
      });
      if (pickResult.canceled || !Array.isArray(pickResult.filePaths) || !pickResult.filePaths.length) {
        return { ok: true, canceled: true, files: [] };
      }
      const generatedCacheDir = shouldIncludeGeneratedTargetMeta
        ? path.resolve(getCacheDir())
        : '';
      const generatedCacheDirPrefix = generatedCacheDir ? `${generatedCacheDir}${path.sep}` : '';
      const files = pickResult.filePaths
        .filter((filePath) => typeof filePath === 'string' && filePath)
        .map((filePath) => {
          const normalizedFilePath = path.resolve(String(filePath || '').trim());
          const buf = fs.readFileSync(filePath);
          const mime = getMimeTypeByExt(filePath);
          const hasGeneratedCacheMeta =
            shouldIncludeGeneratedTargetMeta
            && generatedCacheDir
            && (normalizedFilePath === generatedCacheDir
              || normalizedFilePath.startsWith(generatedCacheDirPrefix));
          const generatedTargetMetaResult = hasGeneratedCacheMeta
            ? readGeneratedTargetMetaByCacheFilePath(normalizedFilePath)
            : {
                targetMeta: null,
                targetMetaFileName: '',
                targetMetaFilePath: ''
              };
          return {
            name: path.basename(filePath),
            type: mime,
            filePath: normalizedFilePath,
            dataUrl: `data:${mime};base64,${buf.toString('base64')}`,
            targetMeta: generatedTargetMetaResult.targetMeta || null,
            targetMetaFileName: generatedTargetMetaResult.targetMetaFileName || '',
            targetMetaFilePath: generatedTargetMetaResult.targetMetaFilePath || ''
          };
        });
      return { ok: true, canceled: false, files };
    } catch (err) {
      log('pick-local-images-data failed', { message: err.message });
      return { ok: false, message: err.message, files: [] };
    }
  });
  ipcMain.handle('shell:ps-cache-put', async (_evt, payload) => {
    try {
      prunePsImageCache();
      const ttlMs = sanitizePsCacheTtlMs(payload?.ttlMs);
      const sourceItems = Array.isArray(payload?.items)
        ? payload.items
        : (payload?.item ? [payload.item] : []);
      const now = Date.now();
      const savedItems = [];
      for (let index = 0; index < sourceItems.length; index += 1) {
        const item = sourceItems[index];
        const compressionOptions =
          item?.compression && typeof item.compression === 'object'
            ? item.compression
            : null;
        const sourceFilePath = String(item?.filePath || '').trim();
        const parsed = sourceFilePath ? null : parseImageDataUrl(item?.dataUrl);
        const sourceMimeType = String(
          item?.type || parsed?.mime || getMimeTypeByExt(sourceFilePath) || 'application/octet-stream'
        );
        const occurredAt = Number.isFinite(Number(item?.capturedAt))
          ? Number(item.capturedAt)
          : now;
        const sequenceIndex = Number.isFinite(Number(item?.sequenceIndex))
          ? Math.max(1, Math.round(Number(item.sequenceIndex)))
          : index + 1;
        let cachedResult = null;
        if (
          compressionOptions?.strategy === 'electron-sharp'
          && (
            sourceFilePath
            || (parsed && parsed.buffer && parsed.buffer.length > 0)
          )
        ) {
          const sharpResult = await compressPsCaptureTempFileWithSharp({
            inputFilePath: sourceFilePath,
            inputBuffer: parsed?.buffer,
            inputMimeType: sourceMimeType,
            outputFormat: compressionOptions.format,
            maxSide: compressionOptions.maxSide,
            quality: compressionOptions.quality,
            source: String(item?.source || 'local'),
            occurredAt,
            sequenceIndex,
          });
          const normalizedOutputExt = sharpResult.outputFormat === 'png' ? 'png' : 'jpg';
          const normalizedDisplayName = replaceFileNameExtension(
            item?.name || item?.originName || sharpResult.outputFileName,
            normalizedOutputExt,
          );
          cachedResult = cacheExistingFileToPsImageCache({
            filePath: sharpResult.outputFilePath,
            mimeType: sharpResult.outputMimeType,
            ttlMs,
            name: normalizedDisplayName,
            originName: normalizedDisplayName,
            source: String(item?.source || 'local'),
            role: String(item?.role || ''),
            slotIndex: Number.isFinite(item?.slotIndex) ? Number(item.slotIndex) : undefined,
            clientRef: String(item?.clientRef || `idx-${index}`),
            meta: {
              ...(item?.meta && typeof item.meta === 'object' ? item.meta : {}),
              compressionStrategy: 'electron-sharp',
              sharpOutputFormat: sharpResult.outputFormat,
              sharpOutputQualityPercent: Number(sharpResult.outputQualityPercent) || null,
              sharpPngCompressionLevel: Number(sharpResult.outputPngCompressionLevel) || null,
              sharpInputByteLength: Number(sharpResult.inputByteLength) || 0,
              sharpOutputByteLength: Number(sharpResult.outputByteLength) || 0,
              sharpInputWidth: Number(sharpResult.inputWidth) || 0,
              sharpInputHeight: Number(sharpResult.inputHeight) || 0,
              sharpOutputWidth: Number(sharpResult.outputWidth) || 0,
              sharpOutputHeight: Number(sharpResult.outputHeight) || 0,
            },
            occurredAt,
            sequenceIndex,
          });
        } else {
          if (!parsed || !parsed.buffer || parsed.buffer.length <= 0) continue;
          cachedResult = cacheBufferToPsImageCache({
            buffer: parsed.buffer,
            mimeType: sourceMimeType,
            ttlMs,
            name: String(item?.name || ''),
            originName: String(item?.originName || item?.name || ''),
            source: String(item?.source || 'local'),
            role: String(item?.role || ''),
            slotIndex: Number.isFinite(item?.slotIndex) ? Number(item.slotIndex) : undefined,
            clientRef: String(item?.clientRef || `idx-${index}`),
            meta: item?.meta && typeof item.meta === 'object' ? item.meta : undefined,
            occurredAt,
            sequenceIndex,
          });
        }
        const entry = cachedResult?.entry;
        if (!entry) continue;
        savedItems.push({
          assetId: entry.assetId,
          cacheId: entry.cacheId,
          fileName: entry.fileName,
          filePath: entry.filePath,
          internalCacheId: entry.internalCacheId,
          itemId: entry.itemId,
          sourceRefKey: entry.sourceRefKey,
          inputMethod: entry.inputMethod,
          name: entry.name,
          originName: entry.originName,
          type: entry.type,
          source: entry.source,
          role: entry.role,
          slotIndex: entry.slotIndex,
          clientRef: entry.clientRef,
          cachedAt: entry.cachedAt,
          expiresAt: entry.expiresAt,
          byteLength: entry.byteLength,
          usageMeta: entry.usageMeta,
          legacy: entry.legacy,
          imageTraceId: entry.imageTraceId,
          parentImageTraceIds: entry.parentImageTraceIds,
          imageSourceKind: entry.imageSourceKind,
          imageSourceMethod: entry.imageSourceMethod,
          displayFileName: entry.displayFileName,
          legacyIdConversionTag: entry.legacyIdConversionTag,
          legacyIdConversionRemoveAfter: entry.legacyIdConversionRemoveAfter
        });
      }
      prunePsImageCache();
      return { ok: true, ttlMs, items: savedItems };
    } catch (err) {
      log('ps-cache-put failed', { message: err.message });
      return { ok: false, message: err.message, items: [] };
    }
  });

  ipcMain.handle('shell:ps-cache-get', (_evt, cacheId) => {
    try {
      prunePsImageCache();
      const id = String(cacheId || '').trim();
      if (!id) return { ok: false, reason: 'invalid_id' };
      const psCacheData = readPsImageCacheDataUrl(id, { ignoreExpiry: false });
      if (!psCacheData?.ok || !psCacheData?.entry) {
        return { ok: false, reason: 'not_found' };
      }
      const entry = psCacheData.entry;
      return {
        ok: true,
        item: {
          assetId: entry.assetId,
          cacheId: entry.cacheId,
          fileName: entry.fileName,
          filePath: entry.filePath,
          internalCacheId: entry.internalCacheId,
          itemId: entry.itemId,
          sourceRefKey: entry.sourceRefKey,
          inputMethod: entry.inputMethod,
          name: entry.name,
          originName: entry.originName,
          type: entry.type,
          source: entry.source,
          role: entry.role,
          slotIndex: entry.slotIndex,
          clientRef: entry.clientRef,
          cachedAt: entry.cachedAt,
          expiresAt: entry.expiresAt,
          byteLength: entry.byteLength,
          meta: entry.meta,
          usageMeta: entry.usageMeta,
          legacy: entry.legacy,
          imageTraceId: entry.imageTraceId,
          parentImageTraceIds: entry.parentImageTraceIds,
          imageSourceKind: entry.imageSourceKind,
          imageSourceMethod: entry.imageSourceMethod,
          displayFileName: entry.displayFileName,
          legacyIdConversionTag: entry.legacyIdConversionTag,
          legacyIdConversionRemoveAfter: entry.legacyIdConversionRemoveAfter,
          dataUrl: String(psCacheData.dataUrl || '')
        }
      };
    } catch (err) {
      log('ps-cache-get failed', { message: err.message });
      return { ok: false, reason: 'error', message: err.message };
    }
  });

  ipcMain.handle('shell:ps-cache-list', () => {
    try {
      prunePsImageCache();
      const items = Array.from(psImageCacheMap.values())
        .sort((a, b) => (b.cachedAt || 0) - (a.cachedAt || 0))
        .map((entry) => ({
          cacheId: entry.cacheId,
          name: entry.name,
          originName: entry.originName,
          type: entry.type,
          source: entry.source,
          role: entry.role,
          slotIndex: entry.slotIndex,
          clientRef: entry.clientRef,
          cachedAt: entry.cachedAt,
          expiresAt: entry.expiresAt,
          byteLength: entry.byteLength
        }));
      return { ok: true, items };
    } catch (err) {
      log('ps-cache-list failed', { message: err.message });
      return { ok: false, message: err.message, items: [] };
    }
  });

  ipcMain.handle('shell:ps-cache-clear', () => {
    try {
      clearPsImageCache();
      return { ok: true };
    } catch (err) {
      log('ps-cache-clear failed', { message: err.message });
      return { ok: false, message: err.message };
    }
  });

  ipcMain.handle('shell:export-logs', async (_evt, payload) => {
    try {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const defaultDir = app.getPath('documents');
      const defaultFile = path.join(defaultDir, `小迪助词器日志-${stamp}.log`);
      const saveResult = await dialog.showSaveDialog(win || undefined, {
        title: '导出日志',
        defaultPath: defaultFile,
        filters: [
          { name: '日志文件', extensions: ['log', 'txt'] },
          { name: 'all-files', extensions: ['*'] }
        ]
      });
      if (saveResult.canceled || !saveResult.filePath) {
        return { ok: false, canceled: true, message: '已取消导出日志' };
      }
      const outFile = saveResult.filePath;
      const outDir = path.dirname(outFile);
      fs.mkdirSync(outDir, { recursive: true });
      const runtimeLog = readFileTailUtf8(logFile, 600 * 1024);
      const devLogSections = readDevLogSections();
      const devLogsText = devLogSections.length
        ? devLogSections
          .map((item) => [
            `### ${item.label}`,
            `path: ${item.filePath}`,
            item.text || '(空)',
            ''
          ].join('\n'))
          .join('\n')
        : '';
      const rendererLogs = Array.isArray(payload?.consoleLogs) ? payload.consoleLogs : [];
      const rendererText = rendererLogs
        .map((line) => {
          const ts = line?.ts || '--:--:--';
          const type = line?.typeLabel || line?.type || '系统';
          const level = line?.level || 'info';
          const message = line?.message || '';
          return `[${ts}] [${type}] [${level}] ${message}`;
        })
        .join('\n');
      let pluginLogs = [];
      let pluginLogsFetchError = '';
      const pluginLogUploadEndpoint = `${getBridgeBaseUrl()}/ps/log`;
      const pluginLogReadEndpoint = `${getBridgeBaseUrl()}/ps/logs?since=0`;
      try {
        const pluginLogResponse = await fetchBridgeJson('/ps/logs?since=0', {
          method: 'GET',
          timeoutMs: 3000
        });
        pluginLogs = Array.isArray(pluginLogResponse?.logs) ? pluginLogResponse.logs : [];
      } catch (pluginLogErr) {
        pluginLogsFetchError = String(pluginLogErr?.message || pluginLogErr || '');
      }
      const pluginLogText = pluginLogs
        .map((entry) => {
          const atValue = Number(entry?.at);
          const atText = Number.isFinite(atValue)
            ? new Date(atValue).toLocaleString('zh-CN', { hour12: false })
            : '--';
          const level = String(entry?.level || 'info');
          const scene = String(entry?.scene || '').trim();
          const message = String(entry?.message || '').trim();
          const detail = String(entry?.detail || '').trim();
          return `[${atText}] [${level}]${scene ? ` [${scene}]` : ''} ${message}${detail ? ` | ${detail}` : ''}`;
        })
        .join('\n');
      const pluginLogRawJson = pluginLogs.length ? JSON.stringify(pluginLogs, null, 2) : '';
      const output = [
        '=== 小迪助词器日志 ===',
        `导出时间: ${new Date().toLocaleString('zh-CN', { hour12: false })}`,
        `应用版本: ${app.getVersion()}`,
        `渲染日志条数: ${rendererLogs.length}`,
        `开发日志节数: ${devLogSections.length}`,
        `插件日志条数: ${pluginLogs.length}`,
        `插件日志上传端点: ${pluginLogUploadEndpoint}`,
        `插件日志读取端点: ${pluginLogReadEndpoint}`,
        `插件日志读取状态: ${pluginLogsFetchError ? `failed (${pluginLogsFetchError})` : 'ok'}`,
        '',
        '--- 渲染层日志 ---',
        rendererText || '(空)',
        '',
        '--- 主进程日志(Electron) ---',
        runtimeLog || '(空)',
        '',
        '--- 开发进程日志(节选) ---',
        devLogsText || '(空)',
        '',
        '--- 插件日志（格式化） ---',
        pluginLogText || '(none)',
        '',
        '--- 插件日志（raw json） ---',
        pluginLogRawJson || '(none)',
        ''
      ].join('\n');
      fs.writeFileSync(outFile, output, 'utf-8');
      return { ok: true, path: outFile };
    } catch (err) {
      log('export-logs failed', { message: err.message });
      return { ok: false, message: err.message };
    }
  });

  ipcMain.handle('shell:chat-load', (_evt, payload) => {
    try {
      const summaryOnly = !!payload?.summaryOnly;
      const snapshot = readChatStateData();
      const data = snapshot.data;
      const originalSessions = Array.isArray(data?.sessions) ? data.sessions : [];
      const interruptedCleanup = finalizeInterruptedPendingMessages(originalSessions);
      const sourceSessions = interruptedCleanup.sessions;
      const persisted = persistChatSessionsWithoutInlineImages(sourceSessions);
      let sessions = persisted.sessions;
      pruneChatImageCacheByUsedIds(persisted.usedCacheIds);
      if (
        interruptedCleanup.changed ||
        persisted.changed ||
        hasInlineImageDataInSessions(sourceSessions)
      ) {
        const migrated = {
          ...data,
          updatedAt: Date.now(),
          sessions
        };
        writeChatStateData(migrated, {
          previousData: data,
          reason: 'chat-load-normalize-pending-and-inline-image'
        });
      }
      const responseSessions = summaryOnly
        ? sessions.map((session, idx) => toChatSessionSummary(session, idx))
        : sessions;
      return {
        ok: true,
        sessions: responseSessions,
        activeId: typeof data?.activeId === 'string' ? data.activeId : ""
      };
    } catch (err) {
      log('chat-load failed', { message: err.message });
      return { ok: false, message: err.message, sessions: [], activeId: "" };
    }
  });

  ipcMain.handle('shell:chat-load-session', (_evt, payload) => {
    try {
      const sessionId = String(payload?.sessionId || payload || '').trim();
      if (!sessionId) return { ok: false, message: 'session_id_required', session: null };
      const snapshot = readChatStateData();
      const data = snapshot.data;
      const originalSessions = Array.isArray(data?.sessions) ? data.sessions : [];
      const interruptedCleanup = finalizeInterruptedPendingMessages(originalSessions);
      const sourceSessions = interruptedCleanup.sessions;
      const persisted = persistChatSessionsWithoutInlineImages(sourceSessions);
      let sessions = persisted.sessions;
      pruneChatImageCacheByUsedIds(persisted.usedCacheIds);
      if (
        interruptedCleanup.changed ||
        persisted.changed ||
        hasInlineImageDataInSessions(sourceSessions)
      ) {
        const migrated = {
          ...data,
          updatedAt: Date.now(),
          sessions
        };
        writeChatStateData(migrated, {
          previousData: data,
          reason: 'chat-load-session-normalize-pending-and-inline-image'
        });
      }
      const target = sessions.find((session) => String(session?.id || '').trim() === sessionId);
      if (!target) return { ok: false, message: 'session_not_found', session: null };
      return { ok: true, session: target };
    } catch (err) {
      log('chat-load-session failed', { message: err.message });
      return { ok: false, message: err.message, session: null };
    }
  });

  ipcMain.handle('shell:chat-save', (_evt, payload) => {
    try {
      const normalizedPayload = payload && typeof payload === 'object' ? payload : {};
      const snapshot = readChatStateData();
      const existingSessions = Array.isArray(snapshot?.data?.sessions) ? snapshot.data.sessions : [];
      const incomingSessions = Array.isArray(normalizedPayload?.sessions) ? normalizedPayload.sessions : [];
      const skippedByDeleteGuardCount = incomingSessions.reduce((sum, session) => {
        const sessionId = String(session?.id || '').trim();
        return sum + (sessionId && deletedChatSessionIdGuardSet.has(sessionId) ? 1 : 0);
      }, 0);
      const mergedSessions = mergeIncomingChatSessions(incomingSessions, existingSessions);
      const persisted = persistChatSessionsWithoutInlineImages(
        mergedSessions
      );
      const next = {
        updatedAt: Date.now(),
        activeId: typeof normalizedPayload?.activeId === 'string' ? normalizedPayload.activeId : "",
        sessions: persisted.sessions
      };
      writeChatStateData(next, {
        previousData: snapshot?.data || {},
        reason: 'chat-save'
      });
      pruneChatImageCacheByUsedIds(persisted.usedCacheIds);
      log('chat-save ok', {
        incomingSessionCount: incomingSessions.length,
        existingSessionCount: existingSessions.length,
        mergedSessionCount: mergedSessions.length,
        skippedByDeleteGuardCount: Math.max(0, skippedByDeleteGuardCount),
        incomingMessageCount: countSessionMessages(incomingSessions),
        mergedMessageCount: countSessionMessages(mergedSessions),
        activeId: next.activeId || ''
      });
      return { ok: true };
    } catch (err) {
      log('chat-save failed', {
        message: String(err?.message || 'unknown'),
        code: String(err?.code || ''),
        cause: String(err?.cause?.message || ''),
        context: err?.context && typeof err.context === 'object' ? err.context : null
      });
      return {
        ok: false,
        message: String(err?.message || '保存失败'),
        code: String(err?.code || '')
      };
    }
  });

  ipcMain.handle('shell:chat-delete', (_evt, payload) => {
    try {
      const normalizedPayload = payload && typeof payload === 'object' ? payload : {};
      const deleteIdSet = new Set(
        (Array.isArray(normalizedPayload?.sessionIds) ? normalizedPayload.sessionIds : [])
          .map((sessionId) => String(sessionId || '').trim())
          .filter(Boolean)
      );
      if (!deleteIdSet.size) return { ok: false, message: 'session_ids_required' };
      const snapshot = readChatStateData();
      const existingSessions = Array.isArray(snapshot?.data?.sessions) ? snapshot.data.sessions : [];
      const remainingSessions = existingSessions
        .map((session, idx) => sanitizeChatSessionForPersist(session, idx))
        .filter((session) => !deleteIdSet.has(String(session?.id || '').trim()));
      const deletedCount = existingSessions.length - remainingSessions.length;
      const deletedIds = existingSessions
        .map((session) => String(session?.id || '').trim())
        .filter((sessionId) => !!sessionId && deleteIdSet.has(sessionId));
      if (deletedCount <= 0) {
        return {
          ok: true,
          deletedCount: 0,
          activeId: typeof snapshot?.data?.activeId === 'string' ? snapshot.data.activeId : ''
        };
      }
      const persisted = persistChatSessionsWithoutInlineImages(remainingSessions);
      const requestedActiveId = String(normalizedPayload?.activeId || '').trim();
      const nextActiveId = persisted.sessions.some(
        (sessionItem) => String(sessionItem?.id || '').trim() === requestedActiveId
      )
        ? requestedActiveId
        : String(persisted.sessions[0]?.id || '');
      const next = {
        updatedAt: Date.now(),
        activeId: nextActiveId,
        sessions: persisted.sessions
      };
      writeChatStateData(next, {
        previousData: snapshot?.data || {},
        reason: 'chat-delete'
      });
      deletedIds.forEach((sessionId) => deletedChatSessionIdGuardSet.add(sessionId));
      pruneChatImageCacheByUsedIds(persisted.usedCacheIds);
      log('chat-delete ok', {
        requestedDeleteCount: deleteIdSet.size,
        deletedCount,
        remainingSessionCount: persisted.sessions.length,
        activeId: next.activeId || ''
      });
      return { ok: true, deletedCount, activeId: nextActiveId };
    } catch (err) {
      log('chat-delete failed', { message: err.message });
      return { ok: false, message: err.message };
    }
  });

  ipcMain.handle(SHELL_CHANNELS.reconnect, async () => {
    try {
      if (!serverProc) startServer({ port: bridgePort });
      await ensureBridgeRuntimeContract('reconnect');
      const result = await fetchBridgeJson('/reconnect', {
        method: 'POST',
        body: {},
        timeoutMs: BRIDGE_REQUEST_TIMEOUT_MS
      });
      const reconnectItem = result?.item || null;
      return buildShellOkResponse(
        { item: reconnectItem },
        { item: reconnectItem },
        'reconnect_ok'
      );
    } catch (err) {
      log('reconnect failed', {
        message: err.message,
        serverRunning: !!serverProc,
        serverPid: serverProc ? (serverProc.pid || null) : null,
        port: bridgePort
      });
      return buildShellErrorResponse(
        'reconnect_failed',
        err.message,
        { item: null },
        { item: null }
      );
    }
  });

  ipcMain.handle(SHELL_CHANNELS.setGlobalUploadShortcuts, (_evt, payload) => {
    try {
      return applyGlobalUploadShortcuts(payload || {});
    } catch (err) {
      log('set-global-upload-shortcuts failed', { message: err.message }, 'warn');
      return {
        ok: false,
        message: String(err?.message || 'set_global_upload_shortcuts_failed'),
        shortcuts: getGlobalUploadShortcutBindingsSnapshot()
      };
    }
  });

  ipcMain.handle('shell:handle-upload-slot-tool-action', async (_evt, payload) => {
    const action = String(payload?.action || '').trim().toLowerCase();
    const queueType = action === 'select'
      ? 'capture-selection'
      : action === 'full'
        ? 'capture-canvas'
        : '';
    if (!queueType) {
      return { ok: false, message: 'unsupported_action', files: [] };
    }
    try {
      if (!serverProc) startServer({ port: bridgePort });
      try {
        await ensureBridgeRuntimeContract(`capture:${queueType}`);
      } catch (runtimeContractError) {
        const runtimeContractErrorText = String(
          runtimeContractError?.message || runtimeContractError || ''
        ).trim();
        if (/bridge_runtime_contract_mismatch/i.test(runtimeContractErrorText)) {
          log('capture runtime contract mismatch ignored (non-blocking)', {
            queueType,
            message: runtimeContractErrorText
          }, 'warn');
        } else {
          throw runtimeContractError;
        }
      }
      const requestedCaptureFormat = String(payload?.captureOptions?.format || '').trim().toLowerCase();
      const requestedCaptureMaxSide = Number(payload?.captureOptions?.maxSide);
      const requestedCaptureQuality = Number(payload?.captureOptions?.quality);
      const queued = await enqueueBridgeCommand(queueType, {
        slotIndex: Number.isFinite(payload?.slotIndex) ? Number(payload.slotIndex) : -1,
        role: payload?.image?.role ? String(payload.image.role) : undefined,
        captureOptions: {
          format: requestedCaptureFormat === 'png' ? 'png' : 'jpg',
          maxSide: Number.isFinite(requestedCaptureMaxSide) && requestedCaptureMaxSide > 0
            ? Math.round(requestedCaptureMaxSide)
            : undefined,
          quality: Number.isFinite(requestedCaptureQuality) && requestedCaptureQuality > 0
            ? Math.max(0.01, Math.min(1, requestedCaptureQuality))
            : undefined
        },
        source: 'webui'
      });
      const queueId = queued.queueId;
      const result = await waitBridgeQueueResult(
        queueId,
        BRIDGE_ACTION_TIMEOUT_MS,
        queued.actionType
      );
      const resultStatus = String(result?.status || '').toLowerCase();
      const resultPayload = result?.result?.payload || {};
      if (resultStatus === 'error' || resultPayload?.ok === false) {
        const rawMessage = String(
          resultPayload?.message
          || resultPayload?.error
          || result?.result?.message
          || 'capture_failed'
        );
        const normalized = normalizeCaptureBridgeError(rawMessage, action);
        return {
          ok: false,
          queueId,
          errorCode: normalized.code || '',
          message: normalized.message,
          rawMessage: normalized.rawMessage || rawMessage,
          files: []
        };
      }
      const payloadBody = result?.result?.payload || {};
      const resolved = resolveCaptureFromBridgeResult(payloadBody, action);
      const capture = resolved.capture;
      const captureByteLength = Number(capture?.byteLength) || 0;
      const normalizedBridgeProtocolVersion = normalizeBridgeProtocolVersion(
        capture?.bridgeProtocolVersion || BRIDGE_PROTOCOL_VERSION
      );
      const normalizedLegacyCaptureCommPath = String(capture?.commPath || '').trim();
      const normalizedLegacyCaptureImagePath = String(capture?.imagePath || '').trim();
      const hasLegacyCaptureRelayTrace =
        !!normalizedLegacyCaptureCommPath || !!normalizedLegacyCaptureImagePath;
      if (captureByteLength > CAPTURE_PAYLOAD_HARD_LIMIT_BYTES) {
        throw new Error(`capture_payload_too_large:${captureByteLength}`);
      }
      let outputDataUrl = '';
      let outputPsCacheId = '';
      let outputPsCacheExpiresAt = undefined;
      const captureFilePath = String(capture?.imagePath || '').trim();
      let outputMimeType = String(capture?.mimeType || 'image/png');
      let cacheEntryMeta = null;
      let outputCacheEntry = null;
      if (captureFilePath) {
          const compressedCapture = await enqueuePsCaptureCompressionJob({
            inputFilePath: captureFilePath,
            outputFormat: requestedCaptureFormat === 'png' ? 'png' : 'jpg',
            maxSide: Number.isFinite(requestedCaptureMaxSide) && requestedCaptureMaxSide > 0
              ? Math.round(requestedCaptureMaxSide)
              : 0,
            quality: Number.isFinite(requestedCaptureQuality) && requestedCaptureQuality > 0
              ? Math.max(0.01, Math.min(1, requestedCaptureQuality))
              : 1,
            displayFileName: resolved.fileName,
            name: resolved.fileName,
            originName: resolved.fileName,
          ttlMs: PS_CACHE_TTL_DEFAULT_MS,
          source: resolved.source,
          occurredAt: Number(capture?.capturedAt) || Date.now(),
          sequenceIndex: 1,
          role: capture?.role ? String(capture.role) : '',
          slotIndex: Number.isFinite(capture?.slotIndex) ? Number(capture.slotIndex) : -1,
          clientRef: String(queueId || ''),
          meta: {
            queueId,
            actionType: queued.actionType,
            bridgeProtocolVersion: normalizedBridgeProtocolVersion,
            byteLength: captureByteLength,
            captureRelayMode: 'plugin-temp-file',
            captureCommPath: normalizedLegacyCaptureCommPath || null,
            captureImagePath: normalizedLegacyCaptureImagePath || null,
            tempFileKind: String(capture?.captureMeta?.tempFileKind || ''),
            tempFileCleanupPolicy: String(capture?.captureMeta?.tempFileCleanupPolicy || ''),
            tempFileName: String(capture?.captureMeta?.tempFileName || ''),
          }
        });
        outputPsCacheId = String(compressedCapture?.entry?.cacheId || '');
        outputPsCacheExpiresAt = Number(compressedCapture?.entry?.expiresAt) || undefined;
        outputMimeType = String(compressedCapture?.entry?.type || outputMimeType);
        cacheEntryMeta = compressedCapture?.entry?.meta || null;
        outputCacheEntry = compressedCapture?.entry || null;
      } else {
        throw new Error('capture_temp_file_required');
      }
      const effectiveOutputFormat = outputMimeType.includes('png') ? 'png' : 'jpg';
      const effectiveCaptureMeta = {
        ...(capture?.captureMeta && typeof capture.captureMeta === 'object'
          ? { ...capture.captureMeta }
          : {}),
        outputFormatActual: effectiveOutputFormat,
        outputChannelCount: effectiveOutputFormat === 'png' ? 4 : 3,
        outputPixelDepth: effectiveOutputFormat === 'png' ? 32 : 24,
        alphaPreserved: effectiveOutputFormat === 'png',
        encodeStrategy: 'electron.sharp',
        fallbackReason: '',
        primaryEncodeError: '',
      };
      return {
        ok: true,
        canceled: false,
        files: [
          {
            assetId: String(outputCacheEntry?.assetId || '').trim(),
            fileName: String(outputCacheEntry?.fileName || ''),
            filePath: String(outputCacheEntry?.filePath || ''),
            cacheFileName: String(outputCacheEntry?.fileName || ''),
            cacheFilePath: String(outputCacheEntry?.filePath || ''),
            internalCacheId: String(outputCacheEntry?.internalCacheId || outputCacheEntry?.fileName || '').trim(),
            itemId: String(outputCacheEntry?.itemId || outputCacheEntry?.internalCacheId || outputCacheEntry?.fileName || '').trim(),
            sourceRefKey: String(outputCacheEntry?.sourceRefKey || '').trim(),
            inputMethod: String(outputCacheEntry?.inputMethod || resolved.source || '').trim(),
            usageMeta:
              outputCacheEntry?.usageMeta && typeof outputCacheEntry.usageMeta === 'object'
                ? { ...outputCacheEntry.usageMeta }
                : undefined,
            legacy:
              outputCacheEntry?.legacy && typeof outputCacheEntry.legacy === 'object'
                ? { ...outputCacheEntry.legacy }
                : undefined,
            name: String(outputCacheEntry?.name || resolved.fileName),
            originName: String(outputCacheEntry?.originName || outputCacheEntry?.name || resolved.fileName),
            type: outputMimeType,
            dataUrl: outputDataUrl,
            psCacheId: outputPsCacheId,
            psCacheExpiresAt: outputPsCacheExpiresAt,
            source: resolved.source,
            role: capture?.role ? String(capture.role) : '',
            capturedAt: Number(capture?.capturedAt) || Date.now(),
            width: Number(capture?.width) || undefined,
            height: Number(capture?.height) || undefined,
            targetRect: capture?.targetRect || null,
            targetRectNorm: capture?.targetRectNorm || null,
            targetCanvas: capture?.targetCanvas || null,
            documentId: Number(capture?.documentId) || undefined,
            targetDocumentId: Number(capture?.documentId) || undefined,
            documentName: capture?.documentName ? String(capture.documentName) : undefined,
            targetDocumentName: capture?.documentName ? String(capture.documentName) : undefined,
            documentMode: capture?.documentMode ? String(capture.documentMode) : undefined,
            bridgeProtocolVersion: normalizedBridgeProtocolVersion,
            bitsPerChannel: Number.isFinite(Number(capture?.bitsPerChannel))
              ? Number(capture.bitsPerChannel)
              : undefined,
            captureMeta: effectiveCaptureMeta,
            meta: {
              queueId,
              actionType: queued.actionType,
              bridgeProtocolVersion: normalizedBridgeProtocolVersion,
              documentId: capture?.documentId,
              documentName: capture?.documentName,
              documentMode: capture?.documentMode || null,
              bitsPerChannel: Number.isFinite(Number(capture?.bitsPerChannel))
                ? Number(capture.bitsPerChannel)
                : null,
              compressedType: outputMimeType,
              cacheEntryMeta,
              captureMeta: effectiveCaptureMeta,
              captureByteLength: captureByteLength,
              payloadMode: outputPsCacheId ? 'ps-cache' : 'inline',
              ...(hasLegacyCaptureRelayTrace
                ? {
                    captureCommPath: normalizedLegacyCaptureCommPath || null,
                    captureImagePath: normalizedLegacyCaptureImagePath || null
                  }
                : {})
            }
          }
        ]
      };
    } catch (err) {
      const rawMessage = String(err?.message || err || 'capture_failed');
      const normalized = normalizeCaptureBridgeError(rawMessage, action);
      log('handle-upload-slot-tool-action failed', {
        action,
        message: rawMessage,
        errorCode: normalized.code || ''
      });
      return {
        ok: false,
        errorCode: normalized.code || '',
        message: normalized.message,
        rawMessage: normalized.rawMessage || rawMessage,
        files: []
      };
    }
  });

  ipcMain.handle('shell:import-image-to-ps', async (_evt, payload) => {
    try {
      const dataUrl = String(payload?.dataUrl || '').trim();
      if (!dataUrl) {
        return { ok: false, message: 'data_url_required' };
      }
      if (!serverProc) startServer({ port: bridgePort });
      await ensureBridgeRuntimeContract('import-image');
      const returnIndexRaw = Number(payload?.returnIndex);
      const returnIndex =
        Number.isFinite(returnIndexRaw) && returnIndexRaw >= 0
          ? Math.floor(returnIndexRaw)
          : undefined;
      const queued = await enqueueBridgeCommand('import-image', {
        dataUrl,
        autoGroup: payload?.autoGroup === true,
        autoMask: payload?.autoMask === true,
        targetRect: normalizeTargetRect(payload?.targetRect),
        targetRectNorm: normalizeTargetRectNorm(payload?.targetRectNorm),
        targetCanvas: normalizeTargetCanvas(payload?.targetCanvas),
        targetDocumentId: normalizeTargetDocumentId(payload?.targetDocumentId),
        targetDocumentName: String(payload?.targetDocumentName || '').trim(),
        returnFileName: String(payload?.returnFileName || '').trim(),
        returnIndex,
        returnTargetSignature: String(payload?.returnTargetSignature || '').trim(),
        layerType: normalizeImportLayerType(payload?.layerType),
        source: 'webui'
      });
      const queueId = queued.queueId;
      const result = await waitBridgeQueueResult(
        queueId,
        BRIDGE_ACTION_TIMEOUT_MS,
        queued.actionType
      );
      const payloadBody = result?.result?.payload || {};
      if (String(result?.status || '') === 'error' || payloadBody?.ok === false) {
        return {
          ok: false,
          queueId,
          errorCode: String(payloadBody?.errorCode || ''),
          message: String(payloadBody?.message || payloadBody?.error || 'ps_import_failed'),
          result: payloadBody
        };
      }
      return { ok: true, queueId, result: payloadBody };
    } catch (err) {
      log('import-image-to-ps failed', { message: err.message });
      return { ok: false, message: err.message };
    }
  });

  ipcMain.handle('shell:set-window-scale', (_evt, scale) => {
    if (!win || win.isDestroyed()) return { ok: false };
    const s = clampScale(scale);
    const currentBounds = win.getBounds();
    const currentWidth = Math.max(
      1,
      Math.round(Number(currentBounds.width) || Number(normalBounds.width) || MAIN_WINDOW_DEFAULT_WIDTH)
    );
    const currentHeight = Math.max(
      1,
      Math.round(Number(currentBounds.height) || Number(normalBounds.height) || 880)
    );
    const requestedWidth = Math.max(1, Math.round(currentWidth * s));
    const requestedHeight = Math.max(1, Math.round(currentHeight * s));
    setPendingScaledBoundsRequest({ requestedWidth, requestedHeight });
    const geometryResult = reconcileMainWindowGeometry({ saveWindowState: true });
    const appliedBounds = geometryResult.bounds || win.getBounds();
    let refreshed = false;
    try {
      if (win.webContents && !win.webContents.isDestroyed()) {
        win.webContents.invalidate();
        refreshed = true;
      }
    } catch (err) {
      log('window invalidate failed', { message: err.message });
    }
    return {
      ok: true,
      width: appliedBounds.width,
      height: appliedBounds.height,
      requestedWidth,
      requestedHeight,
      deferred: !!geometryResult.pendingScaleDeferred,
      refreshed
    };
  });

  ipcMain.handle('shell:adjust-window-size', (_evt, deltaW, deltaH) => {
    if (!win) return { ok: false };
    const dw = Number(deltaW) || 0;
    const dh = Number(deltaH) || 0;
    if (!dw && !dh) return { ok: true };
    clearPendingScaledBoundsRequest();
    const bounds = win.getBounds();
    const width = Math.max(minBounds.width, Math.round(bounds.width + dw));
    const height = Math.max(minBounds.height, Math.round(bounds.height + dh));
    const appliedBounds = applyMainWindowSizeKeepingPosition(width, height, {
      saveWindowState: true
    }) || win.getBounds();
    return { ok: true, width: appliedBounds.width, height: appliedBounds.height };
  });

  ipcMain.handle('shell:set-min-size', (_evt, width, height) => {
    if (!win) return { ok: false };
    const requestedW = Math.round(Number(width) || minBounds.width);
    const requestedH = Math.round(Number(height) || minBounds.height);
    const nextMinW = Math.max(1, requestedW);
    const nextMinH = Math.max(1, requestedH);
    const prevMinW = Number(minBounds.width) || 0;
    const prevMinH = Number(minBounds.height) || 0;
    const isUnchanged = prevMinW === nextMinW && prevMinH === nextMinH;
    minBounds = { width: nextMinW, height: nextMinH };
    if (!isUnchanged) {
      win.setMinimumSize(minBounds.width, minBounds.height);
    }
    const geometryResult = reconcileMainWindowGeometry({ saveWindowState: true });
    const fixedBounds = geometryResult.resized ? geometryResult.bounds || null : null;
    return {
      ok: true,
      width: minBounds.width,
      height: minBounds.height,
      requestedWidth: requestedW,
      requestedHeight: requestedH,
      fixed: !!fixedBounds,
      fixedWidth: fixedBounds ? fixedBounds.width : null,
      fixedHeight: fixedBounds ? fixedBounds.height : null,
      pendingScaleDeferred: !!geometryResult.pendingScaleDeferred
    };
  });

  ipcMain.handle('shell:get-window-bounds', () => {
    if (!win) return null;
    return win.getBounds();
  });

  ipcMain.handle('shell:recenter-main-window', () => {
    if (!win || win.isDestroyed()) {
      return { ok: false, message: 'window_not_ready' };
    }
    updateNormalBoundsForCurrentDisplays('manual-recenter');
    if (win.isMinimized()) win.restore();
    if (!win.isVisible()) win.show();
    const corrected = ensureMainWindowOnVisibleDisplay('manual-recenter', {
      positionPolicy: 'strict-visible'
    });
    win.focus();
    applyMainAlwaysOnTop();
    positionFloatingToggleWindow();
    sendFloatingToggleState();
    return { ok: true, corrected, bounds: win.getBounds() };
  });

  ipcMain.handle(SHELL_CHANNELS.appendPerfLog, (_evt, payload) => {
    return appendPerfLog(payload);
  });

app.on('activate', () => {
    if (!win || win.isDestroyed()) {
      createWindow();
      return;
    }
    if (win.isMinimized()) win.restore();
    if (!win.isVisible()) win.show();
    updateNormalBoundsForCurrentDisplays('activate');
    ensureMainWindowOnVisibleDisplay('activate');
    win.focus();
    applyMainAlwaysOnTop();
    syncFloatingToggleOnMainWindowActive();
    sendFloatingToggleState();
  });
});

app.on('second-instance', () => {
  log('second-instance', {
    pid: process.pid,
    ppid: process.ppid,
    hasWindow: !!win
  }, 'warn');
  if (!win) return;
  updateNormalBoundsForCurrentDisplays('second-instance');
  if (win.isMinimized()) win.restore();
  if (!win.isVisible()) win.show();
  ensureMainWindowOnVisibleDisplay('second-instance');
  win.focus();
  applyMainAlwaysOnTop();
  syncFloatingToggleOnMainWindowActive();
  normalBounds = win.getBounds();
  if (floatingToggleEnabled) {
    setFloatingToggleEnabledState(true);
  } else {
    sendFloatingToggleState();
  }
});

process.on('uncaughtException', (err) => {
  log('uncaughtException', { message: err.message, stack: err.stack });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  try {
    clearRegisteredGlobalUploadShortcuts();
    globalShortcut.unregisterAll();
  } catch (err) {
    log('global shortcut cleanup failed', { message: err.message }, 'warn');
  }
  if (displayTopologyChangeHandler) {
    screen.removeListener('display-added', displayTopologyChangeHandler);
    screen.removeListener('display-removed', displayTopologyChangeHandler);
    screen.removeListener('display-metrics-changed', displayTopologyChangeHandler);
    displayTopologyChangeHandler = null;
  }
  if (cachePolicyCleanupTimer) {
    clearInterval(cachePolicyCleanupTimer);
    cachePolicyCleanupTimer = null;
  }
  if (suppressFloatingMoveSyncTimer) {
    clearTimeout(suppressFloatingMoveSyncTimer);
    suppressFloatingMoveSyncTimer = null;
  }
  if (suppressMainMoveSyncTimer) {
    clearTimeout(suppressMainMoveSyncTimer);
    suppressMainMoveSyncTimer = null;
  }
  if (mainMoveSettleTimer) {
    clearTimeout(mainMoveSettleTimer);
    mainMoveSettleTimer = null;
  }
  if (blurMinimizeTimer) {
    clearTimeout(blurMinimizeTimer);
    blurMinimizeTimer = null;
  }
  clearPsImageCache();
  clearPluginIntermediateCaptureFiles();
  stopServer();
  if (floatWin && !floatWin.isDestroyed()) {
    floatWin.close();
    floatWin = null;
  }
});




