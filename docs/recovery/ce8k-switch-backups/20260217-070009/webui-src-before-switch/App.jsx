import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import "./App.css";
import ConsolePanel from "./components/ConsolePanel";
import TopbarApiStatusGroup from "./components/TopbarApiStatusGroup";
import SettingsView from "./components/SettingsView";
import {
  encodeConfigApiKey,
  decodeConfigApiKey,
  encodeProfilesApiKeyMap,
  decodeProfilesApiKeyMap
} from "./utils/apiKeyStorage";

import iconLogo from "./assets/icons/logo.svg";
import iconSettings from "./assets/icons/settings.svg";
import iconConnecting from "./assets/icons/status-connected.svg";
import iconConnectingAnim from "./assets/icons/status-connecting.svg";
import iconReconnect from "./assets/icons/status-reconnect.svg";
import iconHome from "./assets/icons/home.svg";
import iconImageEmpty from "./assets/icons/empty-image.svg";
import iconFolder from "./assets/icons/folder.svg";
import iconArrowUp from "./assets/icons/arrow-up.svg";
import iconConsole from "./assets/icons/console.svg";
import iconChatHistory from "./assets/icons/chat-history.svg";
import iconGemini from "./assets/icons/gemini.svg";
import iconCopy from "./assets/icons/copy.svg";
import iconEdit from "./assets/icons/edit.svg";
import iconMessageRerun from "./assets/icons/message-rerun.svg";
import iconMessageBranch from "./assets/icons/message-branch.svg";
import iconRun from "./assets/icons/send.svg";
import iconRunJson from "./assets/icons/run.svg";
import iconRunJsonEdited from "./assets/icons/run-json-edited.svg";
import iconRunUploadZone from "./assets/icons/run-upload-zone.svg";
import iconUploadSel from "./assets/icons/upload-sel.svg";
import iconUploadFull from "./assets/icons/upload-full.svg";
import iconUploadLocal from "./assets/icons/upload-local.svg";
import iconUploadSize from "./assets/icons/upload-size.svg";
import iconExport from "./assets/icons/export.svg";
import iconDropdown from "./assets/icons/dropdown.svg";
import iconPinOn from "./assets/icons/pin-on.svg";
import iconPinOff from "./assets/icons/pin-off.svg";
import iconMinimize from "./assets/icons/minimize.svg";
import iconAutoCollapseWindow from "./assets/icons/auto-collapse-window.svg";
import iconPause from "./assets/icons/pause.svg";
import iconClose from "./assets/icons/close.svg";
import iconPlaceholder from "./assets/icons/placeholder.svg";
import iconPreviewOn from "./assets/icons/preview-on.svg";
import iconPreviewOff from "./assets/icons/preview-off.svg";
import iconIdentity from "./assets/icons/identity.svg";
import iconLogFilter from "./assets/icons/log-filter.svg";
import iconEdited from "./assets/icons/edited.svg";
import iconPreset from "./assets/icons/preset.svg";
import iconInstructionPreset from "./assets/icons/instruction-preset.svg";
import iconSessionMore from "./assets/icons/session-more.svg";
import iconSessionRename from "./assets/icons/session-rename.svg";
import iconSessionPin from "./assets/icons/session-pin.svg";
import iconSessionUnpin from "./assets/icons/session-unpin.svg";
import iconSessionDelete from "./assets/icons/session-delete.svg";
import iconApiImage from "./assets/icons/api-image.svg";
import iconLayerRasterized from "./assets/icons/layer-rasterized.svg";
import iconLayerSmartObject from "./assets/icons/layer-smart-object.svg";
import iconSaveDisk from "./assets/icons/save-disk.svg";

const DEFAULT_BRIDGE_PORT = 17325;
const BRIDGE_PORT_MIN = 1;
const BRIDGE_PORT_MAX = 65535;
const POLL_FAST_VISIBLE_MS = 700;
const POLL_OK_VISIBLE_MS = 1800;
const POLL_BACKGROUND_MS = 5000;
const POLL_BACKOFF_MS = [500, 1000, 2000, 5000];
const BASE_WIDTH = 360;
const BASE_HEIGHT = 880;
const CHAT_HEIGHT_MIN = 400;
const PREVIEW_CARD_H = 160;
const PREVIEW_GAP = 12;
const ACTION_ROW_H = 36;
const CONSOLE_PANEL_H = 200;
const CONSOLE_PANEL_GAP = 8;
const SETTINGS_MIN_H = 320;
const CONTEXT_MIN = 1;
const CONTEXT_MAX = 50;
const TIMEOUT_MIN_SEC = 5;
const TIMEOUT_MAX_SEC = 300;
const MAX_TOKENS_MIN = 1;
const MAX_TOKENS_MAX = 16384;
const MAX_UPLOAD_IMAGES = 5;
const UPLOAD_POINTER_DRAG_STEP_FALLBACK = 84;
const GENERATION_COUNT_SLIDER_MAX = 10;
const GENERATION_COUNT_HARD_MAX = 10;
const FLOATING_TOGGLE_OPACITY_MIN = 0.35;
const FLOATING_TOGGLE_OPACITY_MAX = 1;
const FLOATING_TOGGLE_OPACITY_DEFAULT = 1;
const IMAGE_SIZE_OPTIONS = [
  { value: "1k", label: "1024px", apiValue: "1k" },
  { value: "2k", label: "2048px", apiValue: "2k" },
  { value: "4k", label: "4096px", apiValue: "4k" }
];
const IMAGE_ASPECT_RATIO_OPTIONS = [
  { value: "AUTO", label: "AUTO" },
  { value: "1:1", label: "1:1" },
  { value: "3:2", label: "3:2" },
  { value: "2:3", label: "2:3" },
  { value: "3:4", label: "3:4" },
  { value: "4:3", label: "4:3" },
  { value: "4:5", label: "4:5" },
  { value: "5:4", label: "5:4" },
  { value: "9:16", label: "9:16" },
  { value: "16:9", label: "16:9" },
  { value: "21:9", label: "21:9" }
];
const STORAGE_KEYS = {
  consoleOpen: "ph.consoleOpen",
  previewCollapsed: "ph.previewCollapsed",
  chatHeight: "ph.chatHeight",
  chatHeightLogical: "ph.chatHeightLogical",
  alwaysOnTop: "ph.alwaysOnTop",
  uiScale: "ph.uiScale",
  logFilters: "ph.logFilters",
  chatConfig: "ph.chatConfig",
  imageConfig: "ph.imageConfig",
  systemPromptPresets: "ph.systemPromptPresets",
  chatSessions: "ph.chatSessions",
  activeChatSessionId: "ph.activeChatSessionId",
  chatMessages: "ph.chatMessages",
  jsonPrompt: "ph.jsonPrompt",
  chatProviderKey: "ph.chatProviderKey",
  imageProviderKey: "ph.imageProviderKey",
  chatProviderProfiles: "ph.chatProviderProfiles",
  imageProviderProfiles: "ph.imageProviderProfiles",
  chatQuickPrompts: "ph.chatQuickPrompts",
  imageQuickPrompts: "ph.imageQuickPrompts",
  importLayerType: "ph.importLayerType",
  uploadImageFormat: "ph.uploadImageFormat",
  chatStreamModeHints: "ph.chatStreamModeHints",
  sessionNamingEnabled: "ph.sessionNamingEnabled",
  thinkingTranslateEnabled: "ph.thinkingTranslateEnabled",
  chatApiFoldOpen: "ph.chatApiFoldOpen",
  imageApiFoldOpen: "ph.imageApiFoldOpen",
  settingsToolsFoldOpen: "ph.settingsToolsFoldOpen",
  settingsDisplayFoldOpen: "ph.settingsDisplayFoldOpen",
  floatingToggleEnabled: "ph.floatingToggleEnabled",
  floatingToggleOpacity: "ph.floatingToggleOpacity",
  autoMinimizeOnBlur: "ph.autoMinimizeOnBlur",
  cacheRetentionChatDays: "ph.cacheRetentionChatDays",
  cacheRetentionImageDays: "ph.cacheRetentionImageDays",
  cacheRetentionOtherDays: "ph.cacheRetentionOtherDays"
};

function clampFloatingToggleOpacity(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return FLOATING_TOGGLE_OPACITY_DEFAULT;
  return Math.min(FLOATING_TOGGLE_OPACITY_MAX, Math.max(FLOATING_TOGGLE_OPACITY_MIN, n));
}
const BUILTIN_PROMPT_PRESETS = [
  {
    id: "builtin-general",
    name: "通用助手",
    content: "你是专业中文提示词助手。请先理解用户目标，再输出清晰、可执行、可直接复制使用的结果。"
  },
  {
    id: "builtin-image",
    name: "生图提示词",
    content: "你是提示词编写器。把用户描述重写成结构化生图提示词，保留主体、构图、材质、光线、风格与约束，输出简洁版本和详细版本。"
  }
];

const normalizeBridgeRuntimeStatus = (raw) => ({
  ok: !!raw?.ok,
  psConnected: !!raw?.psConnected,
  queueSize: Math.max(0, Number(raw?.queueSize) || 0)
});

const isBridgeRuntimeStatusEqual = (a, b) => (
  !!a
  && !!b
  && !!a.ok === !!b.ok
  && !!a.psConnected === !!b.psConnected
);

const isServerRuntimeStatusEqual = (a, b) => (
  !!a
  && !!b
  && !!a.running === !!b.running
  && (a.pid ?? null) === (b.pid ?? null)
  && (Number(a.port) || 0) === (Number(b.port) || 0)
  && !!a.available === !!b.available
);

const defaultChatConfig = {
  providerMode: "openai-compat",
  baseUrl: "https://ai.comfly.chat",
  apiKey: "",
  model: "gemini-3-pro-preview-thinking",
  timeoutMs: 120000,
  contextCount: 50,
  maxTokens: 10000,
  systemPrompt: "",
  temperature: 0.5,
  topP: 1,
  presencePenalty: 0,
  frequencyPenalty: 0
};

const defaultImageConfig = {
  providerMode: "openai-compat",
  baseUrl: "https://grsaiapi.com/v1/chat/completions",
  apiKey: "",
  model: "nano-banana-pro",
  timeoutMs: 80000,
  generationImageSize: "1k",
  generationAspectRatio: "AUTO",
  generationCount: 1,
  runBatchStrategy: "auto"
};

const CHAT_PROVIDER_SITES = [
  {
    key: "comfly",
    label: "Comfly",
    baseUrl: "https://ai.comfly.chat",
    providerMode: "openai-compat",
    providerModes: ["openai-compat"],
    defaultModel: "gemini-3-pro-preview-thinking",
    supportsModelFetch: true
  },
  {
    key: "aji",
    label: "阿吉 API",
    baseUrl: "https://ai.ajiai.top",
    providerMode: "openai-compat",
    providerModes: ["openai-compat"],
    presetModels: ["gemini-3-pro-preview-thinking"],
    defaultModel: "gemini-3-pro-preview-thinking",
    supportsModelFetch: true
  }
];

const IMAGE_PROVIDER_SITES = [
  {
    key: "aji",
    label: "阿吉 API",
    baseUrl: "https://ai.ajiai.top",
    providerMode: "openai-compat",
    providerModes: ["openai-compat"],
    presetModels: ["AJbanana3"],
    defaultModel: "AJbanana3",
    supportsModelFetch: true
  },
  {
    key: "grsai",
    label: "Grsai API",
    baseUrl: "https://grsaiapi.com/v1/chat/completions",
    providerMode: "openai-compat",
    providerModes: ["openai-compat", "google-native"],
    presetModels: [
      "nano-banana-fast",
      "nano-banana",
      "nano-banana-pro",
      "nano-banana-pro-vt",
      "nano-banana-pro-cl",
      "nano-banana-pro-vip",
      "nano-banana-pro-4k-vip"
    ],
    defaultModel: "nano-banana-pro",
    supportsModelFetch: true
  },
  {
    key: "google",
    label: "Google",
    baseUrl: "https://generativelanguage.googleapis.com",
    providerMode: "google-native",
    providerModes: ["google-native"],
    presetModels: ["gemini-2.5-flash-image-preview"],
    defaultModel: "gemini-2.5-flash-image-preview",
    supportsModelFetch: true
  }
];
const DEFAULT_CHAT_PROVIDER_KEY = "comfly";
const DEFAULT_IMAGE_PROVIDER_KEY = "grsai";
const PROVIDER_MODE_OPTIONS = [
  { key: "openai-compat", label: "OpenAI 兼容格式" },
  { key: "google-native", label: "Google 兼容格式" }
];
const FREQUENT_MODELS = [
  "gemini-3-pro-preview",
  "gemini-3-pro-preview-thinking",
  "gemini-3-flash",
  "gpt-5.3",
  "gpt-5.3-mini",
  "gpt-5.3-nano"
];
const COMMON_MODEL_OPTIONS = [
  "gemini-3-pro-preview-thinking",
  "gemini-3-pro-preview",
  "gemini-3-flash",
  "gpt-5.3",
  "gpt-5.3-mini"
];
const UI_SCALE_OPTIONS = [0.6, 0.8, 1.0, 1.2, 1.4, 1.6];
const CHAT_QUICK_PROMPT_MAX = 5;
const CHAT_QUICK_PROMPT_PINNED_LIMIT = 5;
const CHAT_QUICK_PROMPT_TITLE_MAX = 18;
const CHAT_QUICK_PROMPT_PREVIEW_LEN = 96;
const COPY_TOAST_MS = 1400;
const UPLOAD_LIMIT_TOAST_MS = 2400;
const PS_UPLOAD_CACHE_TTL_MS = 2 * 60 * 1000;
const RUN_POPOVER_SIZE = 32;
const IMAGE_RUN_CLICK_GUARD_MS = 220;
const CHAT_SESSIONS_LOCAL_SAVE_DEBOUNCE_MS = 400;
const DEV_MEMORY_SAMPLE_INTERVAL_MS = 30000;
const CHAT_IMAGE_HYDRATE_CHUNK_SIZE = 10;
const LOG_MESSAGE_MAX_CHARS = 1600;
const LOG_GUIDE_MAX_CHARS = 280;
const UPLOAD_UI_PREVIEW_MAX_SIDE = 768;
const UPLOAD_UI_PREVIEW_MAX_QUALITY = 0.82;

function parseBridgePort(value) {
  const raw = Number(value);
  if (!Number.isFinite(raw)) return null;
  const port = Math.round(raw);
  if (port < BRIDGE_PORT_MIN || port > BRIDGE_PORT_MAX) return null;
  return port;
}

function normalizeBridgePort(value, fallback = DEFAULT_BRIDGE_PORT) {
  const parsed = parseBridgePort(value);
  return parsed || fallback;
}
const CHAT_HEADER_PANEL_WIDTH = 280;
const CHAT_HISTORY_TOOLS_PANEL_WIDTH = 120;
const TIP_DELAY_DEFAULT_MS = 170;
const TIP_SWITCH_REPLAY_DELAY_MS = 36;
const TIP_DELAY_UNIFIED_MS = 0;
const CUSTOM_MODEL_OPTION_VALUE = "__custom_model__";
const CHAT_INPUT_MIN_HEIGHT = 44;
const CHAT_INPUT_MAX_RATIO = 0.45;
const CHAT_INPUT_MAX_FALLBACK = 168;
const CHAT_INPUT_MAX_CAP = 260;
const IMAGE_COMPRESS_MAX_SIDE_MIN = 512;
const IMAGE_COMPRESS_MAX_SIDE_SLIDER_MAX = 8096;
// API docs primarily constrain image payload size (MB) instead of fixed pixels; keep a local safety cap.
const IMAGE_COMPRESS_MAX_SIDE_HARD_MAX = 8192;
const IMAGE_COMPRESS_MAX_SIDE_DEFAULT = 2048;
const IMAGE_COMPRESS_QUALITY_MIN = 1;
const IMAGE_COMPRESS_QUALITY_SLIDER_MAX = 100;
const IMAGE_COMPRESS_QUALITY_HARD_MAX = 100;
const IMAGE_COMPRESS_QUALITY_DEFAULT = 100;
const IMAGE_COMPRESS_FORMAT_DEFAULT = "jpg";
const CACHE_RETENTION_DAYS_MIN = 0;
const CACHE_RETENTION_DAYS_MAX = 3650;
const DEFAULT_CACHE_POLICY = {
  chatRecords: 30,
  images: 14,
  other: 30
};

function normalizeImageRunBatchStrategy(rawValue) {
  const value = String(rawValue || "").trim().toLowerCase();
  if (value === "single" || value === "multi") return value;
  return "auto";
}

function supportsSingleRequestMultiImage(siteKey, providerMode) {
  const key = String(siteKey || "").trim().toLowerCase();
  const mode = String(providerMode || "").trim().toLowerCase();
  return key === "aji" && mode !== "google-native";
}

function normalizeUploadImageFormat(rawValue, fallback = IMAGE_COMPRESS_FORMAT_DEFAULT) {
  const value = String(rawValue || "").trim().toLowerCase();
  if (value === "png") return "png";
  if (value === "jpg" || value === "jpeg") return "jpg";
  return fallback;
}

function formatMemoryBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value < 0) return "0 B";
  if (value < 1024) return `${Math.round(value)} B`;
  const kb = value / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}

function normalizeCacheRetentionDays(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(CACHE_RETENTION_DAYS_MAX, Math.max(CACHE_RETENTION_DAYS_MIN, Math.round(n)));
}

function sanitizeCachePolicy(raw = {}) {
  const source = raw && typeof raw === "object" ? raw : {};
  return {
    chatRecords: normalizeCacheRetentionDays(source.chatRecords, DEFAULT_CACHE_POLICY.chatRecords),
    images: normalizeCacheRetentionDays(source.images, DEFAULT_CACHE_POLICY.images),
    other: normalizeCacheRetentionDays(source.other, DEFAULT_CACHE_POLICY.other)
  };
}

function isCachePolicyEqual(a, b) {
  return Number(a?.chatRecords || 0) === Number(b?.chatRecords || 0)
    && Number(a?.images || 0) === Number(b?.images || 0)
    && Number(a?.other || 0) === Number(b?.other || 0);
}

function normalizeCacheStats(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const categories = source.categories && typeof source.categories === "object"
    ? source.categories
    : {};
  const chatBytes = Number(categories?.chatRecords?.bytes) || 0;
  const imageBytes = Number(categories?.images?.bytes) || 0;
  const otherBytes = Number(categories?.other?.bytes) || 0;
  const totalBytes = Number(source.totalBytes);
  return {
    chatRecordsBytes: chatBytes,
    imagesBytes: imageBytes,
    otherBytes,
    totalBytes: Number.isFinite(totalBytes) ? totalBytes : (chatBytes + imageBytes + otherBytes),
    rootDir: String(source.rootDir || "")
  };
}
const DEFAULT_CHAT_QUICK_PROMPTS = [
  {
    id: "quick-1",
    title: "飘头发",
    content: "请让人物头发有轻微随风飘动感，保持原有发型结构与光影，不改变人物身份。",
    pinned: true
  },
  {
    id: "quick-2",
    title: "飘裙子",
    content: "请让裙摆出现自然风动效果，强调轻盈层次与边缘细节，不改变人物姿势和构图。",
    pinned: true
  },
  {
    id: "quick-3",
    title: "清空背景杂物",
    content: "请清理背景中的杂物和干扰元素，保留主体位置与光线关系，让背景更干净统一。",
    pinned: true
  },
  {
    id: "quick-4",
    title: "提升质感",
    content: "请在不改变主体和构图前提下整体提升画面质感：增强材质细节、光影层次、边缘清晰度与颜色统一性，避免过度锐化。",
    pinned: true
  },
  {
    id: "quick-5",
    title: "一起找思路",
    content: "请先基于这张图给我 5 个可执行的优化方向，每个方向一句话，并给出你最推荐的下一步操作。",
    pinned: true
  }
];
const DEFAULT_IMAGE_QUICK_PROMPTS = [
  {
    id: "img-quick-1",
    title: "飘头发",
    content: "请让人物头发有轻微随风飘动感，保持原有发型结构与光影，不改变人物身份。",
    pinned: true
  },
  {
    id: "img-quick-2",
    title: "飘裙子",
    content: "请让裙摆出现自然风动效果，强调轻盈层次与边缘细节，不改变人物姿势和构图。",
    pinned: true
  },
  {
    id: "img-quick-3",
    title: "清空背景杂物",
    content: "请清理背景中的杂物和干扰元素，保留主体位置与光线关系，让背景更干净统一。",
    pinned: true
  }
];
const LOG_FILTER_ITEMS = [
  { key: "system", label: "系统" },
  { key: "api", label: "API" },
  { key: "bridge", label: "桥接" },
  { key: "dev", label: "开发" }
];
function stripEmojiForQuickTitle(input) {
  return String(input || "")
    .replace(/\p{Extended_Pictographic}|\p{Emoji_Presentation}/gu, "")
    .replace(/[\uFE0E\uFE0F\u200D]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeBaseForOption(url) {
  const input = String(url || "").trim();
  if (!input) return "";
  const noSlash = input.replace(/\/+$/, "");
  const noLeaf = noSlash
    .replace(/\/chat\/completions$/i, "")
    .replace(/\/models$/i, "");
  return noLeaf
    .replace(/\/v1beta$/i, "")
    .replace(/\/v1$/i, "");
}

function normalizeChatStreamModeHint(raw) {
  const value = String(raw || "").trim().toLowerCase();
  if (value === "stream" || value === "nonstream") return value;
  return "auto";
}

function normalizeChatStreamModeHintMap(rawMap) {
  const source = rawMap && typeof rawMap === "object" ? rawMap : {};
  const next = {};
  Object.keys(source).forEach((key) => {
    const normalized = normalizeChatStreamModeHint(source[key]);
    if (normalized !== "auto") {
      next[String(key)] = normalized;
    }
  });
  return next;
}

function buildChatStreamModeHintKey(siteKey, providerMode, baseUrl) {
  const site = String(siteKey || "custom").trim().toLowerCase() || "custom";
  const mode = normalizeProviderMode(providerMode);
  const base = normalizeBaseForOption(baseUrl).toLowerCase();
  return `${site}|${mode}|${base}`;
}

function normalizeProviderKeyBySites(rawKey, sites, fallback = "custom") {
  const key = String(rawKey || "").trim();
  if (key === "custom") return "custom";
  if (sites.some((item) => item.key === key)) return key;
  return fallback;
}

function normalizeChatProviderKey(rawKey, fallback = "custom") {
  return normalizeProviderKeyBySites(rawKey, CHAT_PROVIDER_SITES, fallback);
}

function normalizeImageProviderKey(rawKey, fallback = "custom") {
  return normalizeProviderKeyBySites(rawKey, IMAGE_PROVIDER_SITES, fallback);
}

function normalizeProviderMode(mode) {
  return String(mode || "").trim().toLowerCase() === "google-native" ? "google-native" : "openai-compat";
}

function getProviderModeOptionsFromMeta(meta) {
  const list = Array.isArray(meta?.providerModes) ? meta.providerModes : [];
  const options = list
    .map((item) => normalizeProviderMode(item))
    .filter((item, index, arr) => arr.indexOf(item) === index);
  return options.length ? options : [normalizeProviderMode(meta?.providerMode)];
}

function normalizeProviderModeByOptions(rawMode, options = [], fallback = "openai-compat") {
  const normalized = normalizeProviderMode(rawMode);
  const list = Array.isArray(options) && options.length ? options : [normalizeProviderMode(fallback)];
  return list.includes(normalized) ? normalized : list[0];
}

function getChatProviderByKey(siteKey) {
  const key = String(siteKey || "");
  return CHAT_PROVIDER_SITES.find((item) => item.key === key) || null;
}

function getImageProviderByKey(siteKey) {
  const key = String(siteKey || "");
  return IMAGE_PROVIDER_SITES.find((item) => item.key === key) || null;
}

function getChatProviderModeOptionsBySiteKey(siteKey) {
  if (String(siteKey || "") === "custom") return PROVIDER_MODE_OPTIONS.map((item) => item.key);
  return getProviderModeOptionsFromMeta(getChatProviderByKey(siteKey));
}

function getImageProviderModeOptionsBySiteKey(siteKey) {
  if (String(siteKey || "") === "custom") return PROVIDER_MODE_OPTIONS.map((item) => item.key);
  return getProviderModeOptionsFromMeta(getImageProviderByKey(siteKey));
}

function normalizeChatProviderModeBySiteKey(siteKey, rawMode) {
  return normalizeProviderModeByOptions(rawMode, getChatProviderModeOptionsBySiteKey(siteKey), "openai-compat");
}

function normalizeImageProviderModeBySiteKey(siteKey, rawMode) {
  return normalizeProviderModeByOptions(rawMode, getImageProviderModeOptionsBySiteKey(siteKey), "openai-compat");
}

function getChatPresetModelsBySiteKey(siteKey) {
  const meta = getChatProviderByKey(siteKey);
  const list = Array.isArray(meta?.presetModels) ? meta.presetModels : [];
  return list.map((item) => String(item || "").trim()).filter(Boolean);
}

function getChatDefaultModelBySiteKey(siteKey, fallback = "") {
  const meta = getChatProviderByKey(siteKey);
  const value = String(meta?.defaultModel || "").trim();
  return value || String(fallback || "").trim();
}

function getImagePresetModelsBySiteKey(siteKey) {
  const meta = getImageProviderByKey(siteKey);
  const list = Array.isArray(meta?.presetModels) ? meta.presetModels : [];
  return list.map((item) => String(item || "").trim()).filter(Boolean);
}

function getImageDefaultModelBySiteKey(siteKey, fallback = "") {
  const meta = getImageProviderByKey(siteKey);
  const value = String(meta?.defaultModel || "").trim();
  return value || String(fallback || "").trim();
}

function canFetchChatModelsBySiteKey(siteKey) {
  if (String(siteKey || "") === "custom") return false;
  const meta = getChatProviderByKey(siteKey);
  return !!meta?.supportsModelFetch;
}

function canFetchImageModelsBySiteKey(siteKey) {
  if (String(siteKey || "") === "custom") return false;
  const meta = getImageProviderByKey(siteKey);
  return !!meta?.supportsModelFetch;
}

function normalizeOpenAIBaseForModels(url) {
  const input = String(url || "").trim().replace(/\/+$/, "");
  if (!input) return "";
  let base = input.replace(/\/chat\/completions$/i, "");
  if (!/\/v1$/i.test(base)) base = `${base}/v1`;
  return base;
}

function normalizeGoogleBaseForModels(url) {
  const input = String(url || "").trim().replace(/\/+$/, "");
  if (!input) return "";
  return input
    .replace(/\/chat\/completions$/i, "")
    .replace(/\/v1beta\/models$/i, "")
    .replace(/\/v1\/models$/i, "")
    .replace(/\/v1beta$/i, "")
    .replace(/\/v1$/i, "");
}

function getModelProvider(model) {
  const id = String(model || "").trim();
  const lower = id.toLowerCase();
  if (!id) return "其他";
  if (id.includes("/")) return id.split("/")[0];
  if (lower.startsWith("gemini")) return "Google";
  if (lower.startsWith("gpt") || lower.startsWith("o3") || lower.startsWith("o4")) return "OpenAI";
  if (lower.startsWith("claude")) return "Anthropic";
  if (lower.startsWith("qwen")) return "Qwen";
  if (lower.startsWith("deepseek")) return "DeepSeek";
  if (lower.startsWith("glm")) return "智谱";
  return "其他";
}

function extractJsonText(input) {
  if (!input || typeof input !== "string") return "";
  const candidates = [];
  const fencedAll = [...input.matchAll(/```json\s*([\s\S]*?)```/gi)];
  fencedAll.forEach((m) => {
    if (m?.[1]) candidates.push(m[1].trim());
  });
  const fencedAny = [...input.matchAll(/```([\s\S]*?)```/g)];
  fencedAny.forEach((m) => {
    if (m?.[1]) candidates.push(m[1].trim());
  });
  for (const c of candidates) {
    try {
      const obj = JSON.parse(c);
      return JSON.stringify(obj, null, 2);
    } catch {
      // keep trying
    }
  }
  return "";
}

function stripExtractedJsonBlock(input) {
  const text = String(input || "");
  if (!text) return "";
  let next = text;
  const fencedJsonRe = /```json\s*[\s\S]*?```/gi;
  if (fencedJsonRe.test(next)) {
    next = next.replace(fencedJsonRe, "").trim();
    return next;
  }
  const fencedAny = [...text.matchAll(/```([\s\S]*?)```/g)];
  for (const match of fencedAny) {
    const body = String(match?.[1] || "").trim();
    if (!body) continue;
    try {
      JSON.parse(body);
      next = text.replace(match[0], "").trim();
      return next;
    } catch {
      // skip non-json code block
    }
  }
  return text.trim();
}

function splitTextByJsonBlock(input) {
  const text = String(input || "");
  if (!text) return { before: "", after: "", found: false };
  const jsonFence = text.match(/```json\s*[\s\S]*?```/i);
  if (jsonFence && typeof jsonFence.index === "number") {
    const start = jsonFence.index;
    const end = start + jsonFence[0].length;
    return {
      before: text.slice(0, start).trim(),
      after: text.slice(end).trim(),
      found: true
    };
  }
  const anyFence = [...text.matchAll(/```([\s\S]*?)```/g)];
  for (const block of anyFence) {
    const body = String(block?.[1] || "").trim();
    try {
      JSON.parse(body);
      const full = String(block?.[0] || "");
      const start = text.indexOf(full);
      if (start >= 0) {
        return {
          before: text.slice(0, start).trim(),
          after: text.slice(start + full.length).trim(),
          found: true
        };
      }
    } catch {
      // not json block
    }
  }
  return { before: text.trim(), after: "", found: false };
}

function getMessageJsonText(msg) {
  if (!msg || typeof msg !== "object") return "";
  const explicit = String(msg.jsonPromptText || "").trim();
  if (explicit) return explicit;
  if (msg.jsonPrompt) {
    try {
      return JSON.stringify(msg.jsonPrompt, null, 2);
    } catch {
      // ignore
    }
  }
  return extractJsonText(String(msg.text || ""));
}

function hasLikelyHtml(text) {
  const s = String(text || "").trimStart().toLowerCase();
  return s.startsWith("<!doctype") || s.startsWith("<html") || s.startsWith("<head") || s.startsWith("<body");
}

function readStorage(key, fallback = "") {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : raw;
  } catch {
    return fallback;
  }
}

function readStorageJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function createChatSession(name = "新对话", seedMessages = []) {
  const messages = Array.isArray(seedMessages) ? seedMessages : [];
  return {
    id: `chat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    pinned: false,
    updatedAt: Date.now(),
    messages,
    messageCount: messages.length,
    messagesLoaded: true
  };
}

function isUntitledSessionName(name) {
  const value = String(name || "").trim();
  if (!value) return true;
  if (value === "新对话" || value === "默认对话") return true;
  return /^新对话\d*$/i.test(value);
}

function buildSessionNameFromUserText(text, maxLen = 14) {
  const clean = String(text || "")
    .replace(/\s+/g, " ")
    .replace(/[`"'“”‘’]/g, "")
    .trim();
  if (!clean) return "新对话";
  return clean.slice(0, Math.max(4, Math.min(30, Number(maxLen) || 14)));
}

function sanitizeSessionTitle(raw, fallbackText = "") {
  const source = String(raw || "")
    .replace(/\r?\n/g, " ")
    .replace(/^["'“”‘’\s]+|["'“”‘’\s]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!source) return buildSessionNameFromUserText(fallbackText);
  const first = source.split(/[。！？!?；;|｜]/)[0].trim() || source;
  const noPrefix = first
    .replace(/^(标题|命名|名称)[:：]\s*/i, "")
    .trim();
  return buildSessionNameFromUserText(noPrefix || first);
}

function normalizeMessage(raw, idx = 0) {
  if (!raw || (raw.role !== "user" && raw.role !== "assistant")) return null;
  return {
    id: String(raw.id || `msg-${Date.now()}-${idx}`),
    role: raw.role,
    model: String(raw.model || ""),
    text: String(raw.text || ""),
    images: Array.isArray(raw.images) ? raw.images : [],
    status: String(raw.status || "done"),
    createdAt: raw.createdAt || new Date().toISOString(),
    error: raw.error ? String(raw.error) : undefined,
    jsonPrompt: raw.jsonPrompt,
    jsonPromptText: raw.jsonPromptText ? String(raw.jsonPromptText) : "",
    thinking: raw.thinking ? String(raw.thinking) : ""
  };
}

function normalizeSession(raw, idx = 0) {
  if (!raw || typeof raw !== "object") return null;
  const hasMessagesArray = Array.isArray(raw.messages);
  const messages = hasMessagesArray
    ? raw.messages.map((m, i) => normalizeMessage(m, i)).filter(Boolean)
    : [];
  const rawMessageCount = Number(raw.messageCount);
  const messageCount = Number.isFinite(rawMessageCount) && rawMessageCount >= 0
    ? Math.max(messages.length, Math.floor(rawMessageCount))
    : messages.length;
  const messagesLoaded = raw.messagesLoaded === false ? false : hasMessagesArray;
  const baseName = String(raw.name || "新对话");
  return {
    id: String(raw.id || `chat-${Date.now()}-${idx}`),
    name: baseName,
    pinned: !!raw.pinned,
    updatedAt: Number(raw.updatedAt) || Date.now(),
    messages,
    messageCount,
    messagesLoaded
  };
}

function sortSessionsByPinAndUpdate(list = []) {
  return [...list].sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    return (b.updatedAt || 0) - (a.updatedAt || 0);
  });
}

function hasEffectiveUserInput(message) {
  if (!message || message.role !== "user") return false;
  const text = String(message.text || "").trim();
  const images = Array.isArray(message.images) ? message.images : [];
  return !!text || images.length > 0;
}

function hasSuccessfulAssistantReply(message) {
  if (!message || message.role !== "assistant") return false;
  return message.status === "done" && !!String(message.text || "").trim();
}

function isValidConversation(session) {
  if (!session || !Array.isArray(session.messages)) return false;
  if (!session.messages.length && Number(session?.messageCount) > 0) return true;
  const hasUser = session.messages.some((msg) => hasEffectiveUserInput(msg));
  const hasAssistant = session.messages.some((msg) => hasSuccessfulAssistantReply(msg));
  return hasUser && hasAssistant;
}

function isDraftSession(session) {
  return !isValidConversation(session);
}

function createQuickPromptId() {
  return `quick-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function normalizeQuickPrompt(item, index = 0) {
  const fallback = DEFAULT_CHAT_QUICK_PROMPTS[index] || {
    id: createQuickPromptId(),
    title: `预设${index + 1}`,
    content: "",
    pinned: index < CHAT_QUICK_PROMPT_PINNED_LIMIT
  };
  const source = item && typeof item === "object" ? item : {};
  const hasPinned = Object.prototype.hasOwnProperty.call(source, "pinned");
  const rawId = String(source.id || fallback.id || createQuickPromptId()).trim();
  const normalizedId = rawId || createQuickPromptId();
  const rawTitle = stripEmojiForQuickTitle(item?.title ?? fallback.title);
  const rawUpdatedAt = Number(source.updatedAt);
  return {
    id: normalizedId,
    title: rawTitle.slice(0, CHAT_QUICK_PROMPT_TITLE_MAX),
    content: String(item?.content ?? fallback.content),
    pinned: hasPinned ? !!source.pinned : !!fallback.pinned,
    updatedAt: Number.isFinite(rawUpdatedAt) ? rawUpdatedAt : Date.now()
  };
}

function normalizeQuickPromptList(rawList) {
  const source = Array.isArray(rawList) && rawList.length ? rawList : DEFAULT_CHAT_QUICK_PROMPTS;
  const seen = new Set();
  const normalized = source
    .map((item, index) => normalizeQuickPrompt(item, index))
    .filter(Boolean)
    .map((item) => {
      let nextId = String(item.id || "").trim();
      while (!nextId || seen.has(nextId)) {
        nextId = createQuickPromptId();
      }
      seen.add(nextId);
      return { ...item, id: nextId };
    });
  return normalized.length ? normalized : DEFAULT_CHAT_QUICK_PROMPTS.map((item, index) => normalizeQuickPrompt(item, index));
}

function sortQuickPromptsByPinAndUpdate(list = []) {
  return [...list].sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    return (b.updatedAt || 0) - (a.updatedAt || 0);
  });
}

function clampQuickPromptPinnedList(list = [], limit = CHAT_QUICK_PROMPT_PINNED_LIMIT) {
  let pinnedCount = 0;
  return list.map((item) => {
    if (!item?.pinned) return item;
    if (pinnedCount < limit) {
      pinnedCount += 1;
      return item;
    }
    return { ...item, pinned: false };
  });
}

function getQuickPromptPreview(content, limit = CHAT_QUICK_PROMPT_PREVIEW_LEN) {
  const clean = String(content || "").replace(/\s+/g, " ").trim();
  if (!clean) return "该预设内容为空";
  const chars = Array.from(clean);
  if (chars.length <= limit) return clean;
  return `${chars.slice(0, limit).join("")}...`;
}

function normalizeQuickPromptContentKey(content) {
  return String(content || "").replace(/\r\n/g, "\n").trim();
}

function stripQuickPromptTitleSequence(title) {
  return String(title || "").replace(/\s*[（(]\d+[)）]\s*$/, "").trim();
}

function addQuickPromptTitleSequence(baseTitle, sequence) {
  const safeSeq = Math.max(2, Number(sequence) || 2);
  const suffix = `（${safeSeq}）`;
  const safeBase = stripQuickPromptTitleSequence(baseTitle) || "预设";
  const suffixLen = Array.from(suffix).length;
  const maxBaseLen = Math.max(1, CHAT_QUICK_PROMPT_TITLE_MAX - suffixLen);
  const baseChars = Array.from(safeBase).slice(0, maxBaseLen).join("");
  return `${baseChars}${suffix}`;
}

function normalizeImageSourceTag(source) {
  const key = String(source || "").trim().toLowerCase();
  if (key === "ps-select") return "ps-select";
  if (key === "ps-full") return "ps-full";
  if (key === "paste") return "paste";
  if (key === "drop") return "drop";
  return "local";
}

function formatImageStamp(ts) {
  const time = Number.isFinite(ts) ? ts : Date.now();
  const d = new Date(time);
  const pad2 = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
}

function getImageExt(name = "", type = "") {
  const fromName = String(name || "").match(/\.([a-zA-Z0-9]{2,5})$/);
  if (fromName?.[1]) return fromName[1].toLowerCase();
  const mime = String(type || "").toLowerCase();
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  return "jpg";
}

function getImageRoleTagByIndex(index, withImageModel = true) {
  if (index === 0) return withImageModel ? "main" : "chat-main";
  if (index === 1) return withImageModel ? "ref" : "chat-ref";
  return withImageModel ? "extra" : "chat-extra";
}

function enrichImagesForSend(images, options = {}) {
  const list = Array.isArray(images) ? images : [];
  const withImageModel = options.withImageModel !== false;
  return list
    .filter((item) => item && typeof item.dataUrl === "string" && item.dataUrl.startsWith("data:image/"))
    .sort((a, b) => {
      const slotA = Number.isFinite(a?.slotIndex) ? a.slotIndex : Number.MAX_SAFE_INTEGER;
      const slotB = Number.isFinite(b?.slotIndex) ? b.slotIndex : Number.MAX_SAFE_INTEGER;
      return slotA - slotB;
    })
    .map((item, index) => {
      const baseIndex = Number.isFinite(item.slotIndex) ? item.slotIndex : index;
      const role = String(item.role || getImageRoleTagByIndex(baseIndex, withImageModel));
      const source = normalizeImageSourceTag(item.source);
      const stamp = formatImageStamp(item.capturedAt);
      const ext = getImageExt(item.name, item.type);
      const generatedName = `${role}_${stamp}_${source}_${index + 1}.${ext}`;
      return {
        ...item,
        slotIndex: baseIndex,
        role,
        source,
        name: generatedName,
        originName: item.originName || item.name || generatedName
      };
    });
}

function buildUserContent(text, images) {
  const safeText = String(text || "").trim();
  const safeImages = Array.isArray(images) ? images : [];
  if (!safeImages.length) return safeText;
  const content = [];
  const imageMetaText = safeImages
    .map((item, idx) => {
      const role = String(item?.role || getImageRoleTagByIndex(idx, true));
      const source = String(item?.source || "local");
      const filename = String(item?.name || `image_${idx + 1}`);
      return `图像${idx + 1}: filename=${filename}; role=${role}; source=${source}`;
    })
    .join("\n");
  const mergedText = safeText
    ? `${safeText}\n\n图像顺序说明（按上传顺序）:\n${imageMetaText}`
    : `图像顺序说明（按上传顺序）:\n${imageMetaText}`;
  content.push({ type: "text", text: mergedText });
  safeImages.forEach((item) => {
    if (item?.dataUrl && typeof item.dataUrl === "string") {
      content.push({
        type: "image_url",
        image_url: { url: item.dataUrl }
      });
    }
  });
  return content;
}

function toGooglePartsFromOpenAIContent(content) {
  if (Array.isArray(content)) {
    const parts = [];
    content.forEach((item) => {
      if (!item || typeof item !== "object") return;
      if (item.type === "text" && typeof item.text === "string" && item.text.trim()) {
        parts.push({ text: item.text.trim() });
        return;
      }
      if (item.type !== "image_url") return;
      const rawUrl = String(item?.image_url?.url || item?.image_url || "").trim();
      const matched = rawUrl.match(/^data:([^;,]+);base64,([\s\S]+)$/i);
      if (!matched?.[2]) return;
      parts.push({
        inlineData: {
          mimeType: matched[1] || "image/png",
          data: matched[2] || ""
        }
      });
    });
    return parts.length ? parts : [{ text: "" }];
  }
  if (typeof content === "string") {
    const text = content.trim();
    return [{ text }];
  }
  return [{ text: "" }];
}

function buildGoogleContentsFromMessages(messages = []) {
  const list = Array.isArray(messages) ? messages : [];
  const contents = [];
  list.forEach((item) => {
    if (!item || typeof item !== "object") return;
    const role = String(item.role || "").toLowerCase();
    if (role !== "assistant" && role !== "user" && role !== "system") return;
    const mappedRole = role === "assistant" ? "model" : "user";
    const parts = toGooglePartsFromOpenAIContent(item.content);
    if (!parts.length) return;
    if (mappedRole === "user" && contents.length && contents[contents.length - 1]?.role === "user") {
      contents[contents.length - 1].parts.push(...parts);
      return;
    }
    contents.push({ role: mappedRole, parts });
  });
  return contents;
}

function extractAssistantTextFromGoogleResponse(data) {
  const candidates = Array.isArray(data?.candidates) ? data.candidates : [];
  const lines = [];
  candidates.forEach((candidate) => {
    const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
    parts.forEach((part) => {
      if (typeof part?.text === "string" && part.text.trim()) lines.push(part.text.trim());
    });
  });
  return lines.join("\n").trim();
}

function extractAssistantThinkingFromGoogleResponse(data) {
  const candidates = Array.isArray(data?.candidates) ? data.candidates : [];
  const lines = [];
  candidates.forEach((candidate) => {
    const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
    parts.forEach((part) => {
      const thought = typeof part?.thought === "string" ? part.thought : "";
      if (thought.trim()) lines.push(thought.trim());
    });
  });
  return lines.join("\n").trim();
}

function extractAssistantText(data) {
  const choice = data?.choices?.[0];
  const msg = choice?.message;
  if (!msg) return "";
  if (typeof msg.content === "string") return msg.content;
  if (Array.isArray(msg.content)) {
    return msg.content
      .map((part) => (typeof part?.text === "string" ? part.text : ""))
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

function extractAssistantThinking(data) {
  const choice = data?.choices?.[0];
  const msg = choice?.message || {};
  const directCandidates = [
    msg.reasoning_content,
    msg.reasoning,
    msg.thinking,
    choice?.reasoning_content,
    choice?.reasoning,
    data?.reasoning_content,
    data?.reasoning
  ];
  for (const item of directCandidates) {
    if (typeof item === "string" && item.trim()) return item.trim();
  }
  if (Array.isArray(msg.content)) {
    const combined = msg.content
      .map((part) => {
        if (!part || typeof part !== "object") return "";
        if (part.type === "thinking" && typeof part.thinking === "string") return part.thinking;
        if (part.type === "reasoning" && typeof part.reasoning === "string") return part.reasoning;
        return "";
      })
      .filter(Boolean)
      .join("\n");
    if (combined.trim()) return combined.trim();
  }
  return "";
}

function mergeStreamSnapshot(prevText, incomingText) {
  const prev = String(prevText || "");
  const incoming = String(incomingText || "");
  if (!incoming) return prev;
  if (!prev) return incoming;
  if (incoming.startsWith(prev)) return incoming;
  if (prev.startsWith(incoming)) return prev;
  return `${prev}${incoming}`;
}

function extractOpenAIStreamDelta(chunk) {
  const choice = chunk?.choices?.[0] || {};
  const delta = choice?.delta || {};
  let textDelta = "";
  let thinkingDelta = "";

  if (typeof delta?.content === "string") textDelta += delta.content;
  if (typeof delta?.reasoning_content === "string") thinkingDelta += delta.reasoning_content;
  if (typeof delta?.reasoning === "string") thinkingDelta += delta.reasoning;
  if (typeof delta?.thinking === "string") thinkingDelta += delta.thinking;

  if (Array.isArray(delta?.content)) {
    delta.content.forEach((part) => {
      if (!part || typeof part !== "object") return;
      const type = String(part?.type || "").toLowerCase();
      const textLike = typeof part?.text === "string" ? part.text : "";
      if (textLike) {
        if (type.includes("reason") || type.includes("think")) thinkingDelta += textLike;
        else textDelta += textLike;
      }
      if (typeof part?.reasoning === "string") thinkingDelta += part.reasoning;
      if (typeof part?.thinking === "string") thinkingDelta += part.thinking;
    });
  }

  const done = !!choice?.finish_reason;
  return { textDelta, thinkingDelta, done };
}

async function consumeSseStream(response, onPayload, options = {}) {
  const reader = response?.body?.getReader?.();
  if (!reader) return;
  const decoder = new TextDecoder("utf-8");
  const jsonLines = !!options?.jsonLines;
  let buffer = "";
  const flushJsonLine = (line) => {
    const payload = String(line || "").trim();
    if (!payload) return;
    onPayload(payload);
  };
  const flushBlock = (block) => {
    const lines = String(block || "").split(/\r?\n/);
    const dataLines = lines
      .map((line) => (line.startsWith("data:") ? line.slice(5).trimStart() : ""))
      .filter(Boolean);
    if (!dataLines.length) return;
    const payload = dataLines.join("\n").trim();
    if (!payload) return;
    onPayload(payload);
  };
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    if (jsonLines) {
      let lineBreak = buffer.indexOf("\n");
      while (lineBreak >= 0) {
        const line = buffer.slice(0, lineBreak);
        buffer = buffer.slice(lineBreak + 1);
        flushJsonLine(line);
        lineBreak = buffer.indexOf("\n");
      }
    } else {
      let splitIndex = buffer.indexOf("\n\n");
      while (splitIndex >= 0) {
        const block = buffer.slice(0, splitIndex);
        buffer = buffer.slice(splitIndex + 2);
        flushBlock(block);
        splitIndex = buffer.indexOf("\n\n");
      }
    }
  }
  buffer += decoder.decode();
  if (buffer.trim()) {
    if (jsonLines) flushJsonLine(buffer);
    else flushBlock(buffer);
  }
}

function buildLiveThinkingPreview(message) {
  const rawThinking = String(message?.thinking || message?.thinkingLive || "").trim();
  if (!rawThinking) return "";
  const lines = rawThinking
    .split(/\r?\n/)
    .map((line) => String(line || "").trim())
    .filter(Boolean);
  const picked = lines[lines.length - 1] || rawThinking;
  return picked.length > 42 ? `${picked.slice(0, 42)}...` : picked;
}

function normalizeOpenAIChatEndpoint(url) {
  const input = String(url || "").trim().replace(/\/+$/, "");
  if (!input) return "";
  if (/\/chat\/completions$/i.test(input)) return input;
  return `${normalizeOpenAIBaseForModels(input)}/chat/completions`;
}

function toBase64ImageDataUrl(base64, mimeType = "image/png") {
  const raw = String(base64 || "").trim();
  if (!raw) return "";
  return `data:${String(mimeType || "image/png").trim() || "image/png"};base64,${raw}`;
}

function extractImageUrlsFromText(text) {
  const source = String(text || "");
  if (!source) return [];
  const result = [];
  const push = (value) => {
    const url = String(value || "").trim();
    if (!url) return;
    if (/^https?:\/\//i.test(url) || /^data:image\//i.test(url)) {
      result.push(url);
    }
  };
  const markdownLinks = [...source.matchAll(/!\[[^\]]*\]\(([^)\s]+)\)/g)];
  markdownLinks.forEach((m) => push(m?.[1]));
  const rawUrls = [...source.matchAll(/https?:\/\/[^\s)"']+/g)];
  rawUrls.forEach((m) => push(m?.[0]));
  return Array.from(new Set(result));
}

function extractImageResultsFromGoogleResponse(data) {
  const images = [];
  const textParts = [];
  const candidates = Array.isArray(data?.candidates) ? data.candidates : [];
  candidates.forEach((candidate) => {
    const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
    parts.forEach((part) => {
      const inlineData = part?.inlineData;
      if (inlineData?.data) {
        const dataUrl = toBase64ImageDataUrl(inlineData.data, inlineData.mimeType || "image/png");
        if (dataUrl) images.push(dataUrl);
        return;
      }
      if (typeof part?.text === "string" && part.text.trim()) {
        textParts.push(part.text.trim());
      }
    });
  });
  return {
    images: Array.from(new Set(images)),
    text: textParts.join("\n").trim()
  };
}

function extractImageResultsFromOpenAIResponse(data) {
  const images = [];
  const textParts = [];
  const pushImageUrl = (value) => {
    const url = String(value || "").trim();
    if (!url) return;
    if (/^https?:\/\//i.test(url) || /^data:image\//i.test(url)) images.push(url);
  };
  const pushImageB64 = (value, mimeType = "image/png") => {
    const dataUrl = toBase64ImageDataUrl(value, mimeType);
    if (dataUrl) images.push(dataUrl);
  };

  const listData = Array.isArray(data?.data) ? data.data : [];
  listData.forEach((item) => {
    if (typeof item?.b64_json === "string" && item.b64_json.trim()) {
      pushImageB64(item.b64_json, "image/png");
      return;
    }
    if (typeof item?.url === "string") pushImageUrl(item.url);
  });

  const msg = data?.choices?.[0]?.message || {};
  if (Array.isArray(msg.images)) {
    msg.images.forEach((item) => {
      if (typeof item?.b64_json === "string" && item.b64_json.trim()) {
        pushImageB64(item.b64_json, item.mime_type || "image/png");
      } else if (typeof item?.url === "string") {
        pushImageUrl(item.url);
      }
    });
  }

  if (Array.isArray(msg.content)) {
    msg.content.forEach((part) => {
      if (!part || typeof part !== "object") return;
      if (typeof part?.text === "string" && part.text.trim()) {
        textParts.push(part.text.trim());
      }
      if (typeof part?.b64_json === "string" && part.b64_json.trim()) {
        pushImageB64(part.b64_json, part?.mime_type || "image/png");
      }
      if (typeof part?.image_base64 === "string" && part.image_base64.trim()) {
        pushImageB64(part.image_base64, part?.mime_type || "image/png");
      }
      const imageUrl = part?.image_url?.url || part?.image_url || part?.url;
      if (typeof imageUrl === "string") pushImageUrl(imageUrl);
      if (typeof part?.inlineData?.data === "string" && part.inlineData.data.trim()) {
        pushImageB64(part.inlineData.data, part?.inlineData?.mimeType || "image/png");
      }
    });
  } else if (typeof msg.content === "string" && msg.content.trim()) {
    textParts.push(msg.content.trim());
    extractImageUrlsFromText(msg.content).forEach((url) => pushImageUrl(url));
  }

  const assistantText = extractAssistantText(data);
  const text = assistantText || textParts.join("\n").trim();
  extractImageUrlsFromText(text).forEach((url) => pushImageUrl(url));

  return {
    images: Array.from(new Set(images)),
    text
  };
}

function toImageUrlOrBase64ForGrsai(item) {
  const raw = String(item?.dataUrl || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  const matched = raw.match(/^data:[^;,]+;base64,([\s\S]+)$/i);
  if (!matched?.[1]) return "";
  return String(matched[1]).trim();
}

function normalizeGrsaiAspectRatio(value) {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw || raw === "AUTO") return "auto";
  return raw;
}

function normalizeGrsaiImageSize(value) {
  const raw = String(value || "").trim().toUpperCase();
  if (raw === "2K" || raw === "4K" || raw === "1K") return raw;
  return "1K";
}

function extractGrsaiDrawPayload(data) {
  const root = (data && typeof data === "object") ? data : {};
  const body = (root.data && typeof root.data === "object") ? root.data : root;
  const results = Array.isArray(body?.results) ? body.results : [];
  const images = results
    .map((item) => String(item?.url || "").trim())
    .filter(Boolean);
  const text = results
    .map((item) => String(item?.content || "").trim())
    .filter(Boolean)
    .join("\n")
    .trim();
  const id = String(body?.id || "").trim();
  const status = String(body?.status || "").trim().toLowerCase();
  const failureReason = String(body?.failure_reason || "").trim();
  const error = String(body?.error || "").trim();
  return {
    id,
    status,
    images: Array.from(new Set(images)),
    text,
    failureReason,
    error,
    raw: body
  };
}

function renderInlineBold(line, keyPrefix) {
  const parts = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  let m;
  while ((m = re.exec(line))) {
    if (m.index > last) {
      parts.push(<span key={`${keyPrefix}-t-${last}`}>{line.slice(last, m.index)}</span>);
    }
    parts.push(<strong key={`${keyPrefix}-b-${m.index}`}>{m[1]}</strong>);
    last = m.index + m[0].length;
  }
  if (last < line.length) {
    parts.push(<span key={`${keyPrefix}-t-end`}>{line.slice(last)}</span>);
  }
  return parts.length ? parts : [<span key={`${keyPrefix}-empty`}>&nbsp;</span>];
}

function renderRichText(text, onCopyCode = null) {
  const source = String(text || "");
  if (!source) return null;
  const blocks = source.split(/```/);
  return blocks.map((block, blockIndex) => {
    const isCode = blockIndex % 2 === 1;
    if (isCode) {
      const normalized = String(block || "").replace(/^\n+/, "");
      const lines = normalized.split("\n");
      const firstLine = String(lines[0] || "").trim();
      const hasLang = /^[a-zA-Z0-9_+#.-]{1,24}$/.test(firstLine);
      const codeText = hasLang ? lines.slice(1).join("\n") : normalized;
      const codeLang = hasLang ? firstLine.toLowerCase() : "code";
      return (
        <div key={`code-${blockIndex}`} className="chat-code-card">
          <div className="chat-code-header">
            <div className="chat-code-title">{codeLang}</div>
            <div className="json-actions">
              <div className="json-action-item">
                <button
                  className="icon-only"
                  aria-label="copy-code-block"
                  onClick={() => {
                    if (typeof onCopyCode === "function") {
                      onCopyCode(codeText);
                      return;
                    }
                    navigator.clipboard?.writeText(codeText);
                  }}
                >
                  <img className="icon-20" src={iconCopy} alt="copy" />
                </button>
              </div>
            </div>
          </div>
          <pre className="chat-code-block">
            <code>{codeText}</code>
          </pre>
        </div>
      );
    }
    const lines = block.split("\n");
    return (
      <React.Fragment key={`text-${blockIndex}`}>
        {lines.map((line, lineIdx) => {
          const isBlankLine = !String(line || "").trim();
          if (isBlankLine) {
            // Keep one paragraph gap, collapse multiple blank lines into one, trim edge blanks.
            if (lineIdx === 0) return null;
            const prevLine = String(lines[lineIdx - 1] || "");
            if (!prevLine.trim()) return null;
            const hasNextNonBlank = lines.slice(lineIdx + 1).some((item) => String(item || "").trim());
            if (!hasNextNonBlank) {
              return null;
            }
            return <span key={`blank-${blockIndex}-${lineIdx}`} className="md-empty-line" />;
          }
          const trimmed = line.trimStart();
          if (/^###\s+/.test(trimmed)) {
            return <div key={`h3-${blockIndex}-${lineIdx}`} className="md-h3">{trimmed.replace(/^###\s+/, "")}</div>;
          }
          if (/^##\s+/.test(trimmed)) {
            return <div key={`h2-${blockIndex}-${lineIdx}`} className="md-h2">{trimmed.replace(/^##\s+/, "")}</div>;
          }
          if (/^#\s+/.test(trimmed)) {
            return <div key={`h1-${blockIndex}-${lineIdx}`} className="md-h1">{trimmed.replace(/^#\s+/, "")}</div>;
          }
          if (/^>\s+/.test(trimmed)) {
            return (
              <div key={`q-${blockIndex}-${lineIdx}`} className="md-quote">
                {renderInlineBold(trimmed.replace(/^>\s+/, ""), `q-${blockIndex}-${lineIdx}`)}
              </div>
            );
          }
          if (/^[-*]\s+/.test(trimmed)) {
            return (
              <div key={`li-${blockIndex}-${lineIdx}`} className="md-li">
                <span className="md-li-dot">•</span>
                <span>{renderInlineBold(trimmed.replace(/^[-*]\s+/, ""), `li-${blockIndex}-${lineIdx}`)}</span>
              </div>
            );
          }
          const nextLine = lineIdx < lines.length - 1 ? String(lines[lineIdx + 1] || "") : "";
          const shouldRenderBreak = !!nextLine.trim();
          return (
            <React.Fragment key={`l-${blockIndex}-${lineIdx}`}>
              {renderInlineBold(line, `k-${blockIndex}-${lineIdx}`)}
              {shouldRenderBreak ? <br /> : null}
            </React.Fragment>
          );
        })}
      </React.Fragment>
    );
  });
}

function autoResizeTextarea(el) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

function App() {
  const [view, setView] = useState("home");
  const [status, setStatus] = useState({ ok: false, psConnected: false, queueSize: 0 });
  const [floatingToggleEnabled, setFloatingToggleEnabled] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.floatingToggleEnabled);
      return raw == null ? true : raw === "1";
    } catch {
      return true;
    }
  });
  const [floatingToggleOpacity, setFloatingToggleOpacity] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.floatingToggleOpacity);
      if (raw == null) return FLOATING_TOGGLE_OPACITY_DEFAULT;
      return clampFloatingToggleOpacity(parseFloat(raw));
    } catch {
      return FLOATING_TOGGLE_OPACITY_DEFAULT;
    }
  });
  const [autoMinimizeOnBlur, setAutoMinimizeOnBlur] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.autoMinimizeOnBlur) === "1";
    } catch {
      return false;
    }
  });
  const [consoleOpen, setConsoleOpen] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.consoleOpen) === "1";
    } catch {
      return false;
    }
  });
  const [consoleOpening, setConsoleOpening] = useState(false);
  const [statusHover, setStatusHover] = useState(false);
  const [chatApiStatus, setChatApiStatus] = useState("warn");
  const [chatApiIssueText, setChatApiIssueText] = useState("");
  const [imageApiStatus, setImageApiStatus] = useState("warn");
  const [imageApiIssueText, setImageApiIssueText] = useState("");
  const [exportHover, setExportHover] = useState(false);
  const [runHover, setRunHover] = useState(false);
  const [jsonEditedPending, setJsonEditedPending] = useState(false);
  const [thinkingOpenMap, setThinkingOpenMap] = useState({});
  const [runPopoverPos, setRunPopoverPos] = useState({ top: 0, left: 0 });
  const [tipState, setTipState] = useState({ text: "", top: 0, left: 0, placement: "bottom", visible: false, variant: "", nonce: 0 });
  const [copyToast, setCopyToast] = useState({
    visible: false,
    text: "",
    mode: "default",
    top: null,
    left: null
  });
  const [bridgePort, setBridgePort] = useState(DEFAULT_BRIDGE_PORT);
  const [bridgePortDraft, setBridgePortDraft] = useState(String(DEFAULT_BRIDGE_PORT));
  const [bridgePortApplying, setBridgePortApplying] = useState(false);
  const [serverStatus, setServerStatus] = useState({ running: false, pid: null, port: DEFAULT_BRIDGE_PORT, available: false });
  const bridgeApiBase = useMemo(() => `http://127.0.0.1:${bridgePort}`, [bridgePort]);
  const [uiScale, setUiScale] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.uiScale);
      const parsed = raw ? parseFloat(raw) : NaN;
      return Number.isFinite(parsed) ? parsed : 1;
    } catch {
      return 1;
    }
  });
  const [scalePending, setScalePending] = useState(null);
  const [scaleCountdown, setScaleCountdown] = useState(0);
  const [alwaysOnTop, setAlwaysOnTop] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.alwaysOnTop) === "1";
    } catch {
      return false;
    }
  });
  const [previewCollapsed, setPreviewCollapsed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.previewCollapsed) === "1";
    } catch {
      return false;
    }
  });
  const [importLayerType, setImportLayerType] = useState(() => {
    try {
      const raw = String(localStorage.getItem(STORAGE_KEYS.importLayerType) || "").trim();
      return raw === "rasterized" ? "rasterized" : "smart-object";
    } catch {
      return "smart-object";
    }
  });
  const [autoExport, setAutoExport] = useState(true);
  const scaleTimerRef = useRef(null);
  const floatingOpacitySyncTimerRef = useRef(null);
  const prevScaleRef = useRef(1);
  const currentScaleRef = useRef(1);
  const timerRef = useRef(null);
  const backoffIndexRef = useRef(0);
  const aliveRef = useRef(true);
  const lastOkRef = useRef(Date.now());
  const chatCardRef = useRef(null);
  const hasScalePrefRef = useRef(false);
  const resizeStateRef = useRef({ previewH: 0, consoleH: 0, measured: false });
  const chatScrollRef = useRef(null);
  const topbarRef = useRef(null);
  const footerRef = useRef(null);
  const previewRef = useRef(null);
  const consoleRef = useRef(null);
  const chatModuleRef = useRef(null);
  const chatHeaderRef = useRef(null);
  const chatHeaderActionsRef = useRef(null);
  const chatInputRef = useRef(null);
  const uploadAreaRef = useRef(null);
  const bottomControlsRef = useRef(null);
  const contentWrapHomeRef = useRef(null);
  const contentWrapSettingsRef = useRef(null);
  const contentScrollHomeRef = useRef(null);
  const contentScrollSettingsRef = useRef(null);
  const rafRef = useRef(null);
  const measureRef = useRef(null);
  const resizingRef = useRef(false);
  const pendingMinSizeRef = useRef(null);
  const lastMinSizeRef = useRef({ minWidth: 0, minHeight: 0 });
  const lastMinSizeNoConsoleRef = useRef({ minWidth: 0, minHeight: 0 });
  const lastHomeMinSizeRef = useRef({ minWidth: 0, minHeight: 0 });
  const adaptiveFreezeCountRef = useRef(0);
  const pendingMeasureAfterFreezeRef = useRef(false);
  const chatLayoutFrozenRef = useRef(false);
  const homeWrapLayoutFrozenRef = useRef(false);
  const homeContentLayoutFrozenRef = useRef(false);
  const settingsWrapLayoutFrozenRef = useRef(false);
  const settingsContentLayoutFrozenRef = useRef(false);
  const previewToggleBusyRef = useRef(false);
  const consoleToggleBusyRef = useRef(false);
  const lastHomeHeightsRef = useRef({ chatFixedH: 0, bottomH: 0 });
  const resizeFreezeSuppressUntilRef = useRef(0);
  const [logs, setLogs] = useState([]);
  const [miniConsoleState, setMiniConsoleState] = useState({
    text: "系统就绪",
    level: "info",
    tip: "系统状态正常。"
  });
  const bootLoggedRef = useRef(false);
  const [logFilters, setLogFilters] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.logFilters);
      const parsed = raw ? JSON.parse(raw) : null;
      return Array.isArray(parsed) && parsed.length ? parsed : ["system"];
    } catch {
      return ["system"];
    }
  });
  const [logFilterOpen, setLogFilterOpen] = useState(false);
  const [consoleFilterPos, setConsoleFilterPos] = useState({ top: 0, left: 0, width: 120 });
  const prevStatusTextRef = useRef("");
  const psPluginLogCursorRef = useRef(0);
  const psPluginLogPrimedRef = useRef(false);
  const psPluginLogRouteDisabledRef = useRef(false);
  const uiScaleDirtyRef = useRef(false);
  const runHoverTimerRef = useRef(null);
  const tipShowTimerRef = useRef(null);
  const tipHideTimerRef = useRef(null);
  const tipRef = useRef(null);
  const tipHoverTargetRef = useRef(null);
  const tipVisibleRef = useRef(false);
  const tipPointerRef = useRef({ x: -1, y: -1 });
  const tipMeasureElRef = useRef(null);
  const tipNonceRef = useRef(0);
  const tipLastShowRef = useRef({ el: null, text: "", placement: "", variant: "" });
  const tipScrollLockUntilRef = useRef(0);
  const copyToastTimerRef = useRef(null);
  const runAnchorRef = useRef(null);
  const runPopoverRef = useRef(null);
  const consoleFilterRef = useRef(null);
  const consoleFilterPanelRef = useRef(null);
  const chatInputTextRef = useRef(null);
  const userMessageEditorRef = useRef(null);
  const sendAbortRef = useRef(null);
  const imageRunQueueRef = useRef([]);
  const imageRunProcessingRef = useRef(false);
  const imageRunActiveTaskRef = useRef(null);
  const imageRunAbortControllerRef = useRef(null);
  const imageRunAbortReasonRef = useRef("");
  const imageRunRemoteCancelContextRef = useRef(null);
  const imageRunTaskSeqRef = useRef(0);
  const imageRunClickGuardUntilRef = useRef(0);
  const uploadSlotsRef = useRef(null);
  const uploadSlotRefs = useRef([]);
  const uploadPointerDragRef = useRef({
    active: false,
    from: -1,
    to: -1,
    deltaX: 0,
    startX: 0,
    startScrollLeft: 0,
    step: UPLOAD_POINTER_DRAG_STEP_FALLBACK,
    pointerId: -1
  });
  const uploadPointerMoveRafRef = useRef(0);
  const uploadPointerMovePendingXRef = useRef(NaN);
  const uploadPointerCleanupRef = useRef(null);
  const uploadAreaDragDepthRef = useRef(0);
  const pendingUploadTargetRef = useRef(-1);
  const pendingUploadSourceRef = useRef("local");
  const exportToCanvasBusyRef = useRef(false);
  const uploadSizeWarnedRef = useRef(false);
  const uploadSizeCapWarnedRef = useRef(false);
  const uploadQualityCapWarnedRef = useRef(false);
  const fileInputRef = useRef(null);
  const historyInputRef = useRef(null);
  const generationCountControlRef = useRef(null);
  const generationCountDropdownRef = useRef(null);
  const generationSizeControlRef = useRef(null);
  const generationRatioControlRef = useRef(null);
  const generationSelectDropdownRef = useRef(null);
  const uploadSizeToggleRef = useRef(null);
  const uploadSizePanelRef = useRef(null);
  const bridgePortInputFocusedRef = useRef(false);
  const [chatConfig, setChatConfig] = useState(() => ({
    ...defaultChatConfig,
    ...decodeConfigApiKey(readStorageJson(STORAGE_KEYS.chatConfig, {}))
  }));
  const [chatProviderKey, setChatProviderKey] = useState(() => (
    normalizeChatProviderKey(readStorage(STORAGE_KEYS.chatProviderKey, ""), DEFAULT_CHAT_PROVIDER_KEY)
  ));
  const [chatProviderProfiles, setChatProviderProfiles] = useState(() => {
    const savedConfig = { ...defaultChatConfig, ...decodeConfigApiKey(readStorageJson(STORAGE_KEYS.chatConfig, {})) };
    const savedProfiles = decodeProfilesApiKeyMap(readStorageJson(STORAGE_KEYS.chatProviderProfiles, {}));
    const activeKey = normalizeChatProviderKey(
      readStorage(STORAGE_KEYS.chatProviderKey, ""),
      DEFAULT_CHAT_PROVIDER_KEY
    );
    const next = {};
    CHAT_PROVIDER_SITES.forEach((site) => {
      next[site.key] = {
        ...defaultChatConfig,
        ...(savedProfiles[site.key] || {}),
        baseUrl: site.baseUrl,
        providerMode: normalizeChatProviderModeBySiteKey(
          site.key,
          savedProfiles[site.key]?.providerMode || site.providerMode || "openai-compat"
        ),
        apiKey: String(savedProfiles[site.key]?.apiKey || ""),
        model: String(savedProfiles[site.key]?.model || getChatDefaultModelBySiteKey(site.key, defaultChatConfig.model))
      };
    });
    next.custom = {
      ...defaultChatConfig,
      ...(savedProfiles.custom || {}),
      baseUrl: String(savedProfiles.custom?.baseUrl || ""),
      providerMode: normalizeChatProviderModeBySiteKey("custom", savedProfiles.custom?.providerMode || "openai-compat"),
      apiKey: String(savedProfiles.custom?.apiKey || ""),
      model: String(savedProfiles.custom?.model || "")
    };
    next[activeKey] = {
      ...(next[activeKey] || next.custom),
      ...savedConfig
    };
    if (activeKey !== "custom") {
      const activeMeta = getChatProviderByKey(activeKey);
      if (activeMeta) {
        next[activeKey].baseUrl = activeMeta.baseUrl;
        next[activeKey].providerMode = normalizeChatProviderModeBySiteKey(activeKey, next[activeKey].providerMode);
      }
    } else {
      next.custom.baseUrl = String(savedConfig.baseUrl || next.custom.baseUrl || "");
      next.custom.providerMode = normalizeChatProviderModeBySiteKey("custom", savedConfig.providerMode || next.custom.providerMode);
    }
    const sharedSystemPrompt = String(savedConfig.systemPrompt || "");
    Object.keys(next).forEach((key) => {
      next[key] = { ...(next[key] || {}), systemPrompt: sharedSystemPrompt };
    });
    return next;
  });
  const [imageConfig, setImageConfig] = useState(() => ({
    ...defaultImageConfig,
    ...decodeConfigApiKey(readStorageJson(STORAGE_KEYS.imageConfig, {}))
  }));
  const [imageProviderKey, setImageProviderKey] = useState(() => (
    normalizeImageProviderKey(readStorage(STORAGE_KEYS.imageProviderKey, ""), DEFAULT_IMAGE_PROVIDER_KEY)
  ));
  const [imageProviderProfiles, setImageProviderProfiles] = useState(() => {
    const savedConfig = { ...defaultImageConfig, ...decodeConfigApiKey(readStorageJson(STORAGE_KEYS.imageConfig, {})) };
    const savedProfiles = decodeProfilesApiKeyMap(readStorageJson(STORAGE_KEYS.imageProviderProfiles, {}));
    const activeKey = normalizeImageProviderKey(
      readStorage(STORAGE_KEYS.imageProviderKey, ""),
      DEFAULT_IMAGE_PROVIDER_KEY
    );
    const next = {};
    IMAGE_PROVIDER_SITES.forEach((site) => {
      next[site.key] = {
        ...defaultImageConfig,
        ...(savedProfiles[site.key] || {}),
        baseUrl: site.baseUrl,
        providerMode: normalizeImageProviderModeBySiteKey(
          site.key,
          savedProfiles[site.key]?.providerMode || site.providerMode || "openai-compat"
        ),
        apiKey: String(savedProfiles[site.key]?.apiKey || ""),
        model: String(savedProfiles[site.key]?.model || getImageDefaultModelBySiteKey(site.key, ""))
      };
    });
    next.custom = {
      ...defaultImageConfig,
      ...(savedProfiles.custom || {}),
      baseUrl: String(savedProfiles.custom?.baseUrl || ""),
      providerMode: normalizeProviderMode(savedProfiles.custom?.providerMode || "openai-compat"),
      apiKey: String(savedProfiles.custom?.apiKey || ""),
      model: String(savedProfiles.custom?.model || "")
    };
    next[activeKey] = {
      ...(next[activeKey] || next.custom),
      ...savedConfig
    };
    if (activeKey !== "custom") {
      const activeMeta = IMAGE_PROVIDER_SITES.find((item) => item.key === activeKey);
      if (activeMeta) {
        next[activeKey].baseUrl = activeMeta.baseUrl;
        next[activeKey].providerMode = normalizeImageProviderModeBySiteKey(activeKey, next[activeKey].providerMode);
      }
    } else {
      next.custom.baseUrl = String(savedConfig.baseUrl || next.custom.baseUrl || "");
      next.custom.providerMode = normalizeImageProviderModeBySiteKey("custom", savedConfig.providerMode || next.custom.providerMode);
    }
    return next;
  });
  const [chatModelOptions, setChatModelOptions] = useState([]);
  const [imageModelOptions, setImageModelOptions] = useState([]);
  const [modelsLoadingBySection, setModelsLoadingBySection] = useState({ chat: false, image: false });
  const [modelDropdown, setModelDropdown] = useState({
    open: false,
    section: "chat",
    search: "",
    manualInputOpen: false,
    manualInputValue: "",
    top: 0,
    left: 0,
    width: 0
  });
  const modelDropdownPanelRef = useRef(null);
  const modelDropdownInputRef = useRef(null);
  const chatModelAnchorRef = useRef(null);
  const imageModelAnchorRef = useRef(null);
  const [modelGroupOpen, setModelGroupOpen] = useState({});
  const [providerDropdown, setProviderDropdown] = useState({
    open: false,
    section: "chat",
    top: 0,
    left: 0,
    width: 0
  });
  const [providerKnownOthersOpen, setProviderKnownOthersOpen] = useState({
    chat: false,
    image: false
  });
  const providerDropdownPanelRef = useRef(null);
  const [uiScaleDropdown, setUiScaleDropdown] = useState({
    open: false,
    top: 0,
    left: 0,
    width: 0
  });
  const uiScaleDropdownPanelRef = useRef(null);
  const uiScaleAnchorRef = useRef(null);
  const chatProviderAnchorRef = useRef(null);
  const imageProviderAnchorRef = useRef(null);
  const chatModeSwitchAnchorRef = useRef(null);
  const imageModeSwitchAnchorRef = useRef(null);
  const chatApiKeyInputRef = useRef(null);
  const imageApiKeyInputRef = useRef(null);
  const [chatConfigExpanded, setChatConfigExpanded] = useState(false);
  const [chatApiFoldOpen, setChatApiFoldOpen] = useState(() => (
    readStorage(STORAGE_KEYS.chatApiFoldOpen, "1") !== "0"
  ));
  const [imageApiFoldOpen, setImageApiFoldOpen] = useState(() => (
    readStorage(STORAGE_KEYS.imageApiFoldOpen, "1") !== "0"
  ));
  const [settingsToolsFoldOpen, setSettingsToolsFoldOpen] = useState(() => (
    readStorage(STORAGE_KEYS.settingsToolsFoldOpen, "1") !== "0"
  ));
  const [settingsDisplayFoldOpen, setSettingsDisplayFoldOpen] = useState(() => (
    readStorage(STORAGE_KEYS.settingsDisplayFoldOpen, "1") !== "0"
  ));
  const [chatKeyVisible, setChatKeyVisible] = useState(false);
  const [imageKeyVisible, setImageKeyVisible] = useState(false);
  const autoApiVerifyKeyRef = useRef({ chat: "", image: "" });
  const autoApiVerifyBootRef = useRef({ chat: false, image: false });
  const apiConfigValidationKeyRef = useRef({ chat: "", image: "" });
  const apiVerifyTimerRef = useRef({ chat: null, image: null });
  const apiVerifySeqRef = useRef({ chat: 0, image: 0 });
  const apiSuccessFlashTimerRef = useRef({ chat: null, image: null });
  const [presetDropdown, setPresetDropdown] = useState({
    open: false,
    top: 0,
    left: 0,
    width: 0
  });
  const presetDropdownPanelRef = useRef(null);
  const presetAnchorRef = useRef(null);
  const [systemPromptPresetId, setSystemPromptPresetId] = useState("");
  const [systemPromptPresets, setSystemPromptPresets] = useState(() => {
    const saved = readStorageJson(STORAGE_KEYS.systemPromptPresets, []);
    return Array.isArray(saved) ? saved.filter((item) => item && item.id && item.name && typeof item.content === "string") : [];
  });
  const [chatQuickPrompts, setChatQuickPrompts] = useState(() => {
    const saved = readStorageJson(STORAGE_KEYS.chatQuickPrompts, DEFAULT_CHAT_QUICK_PROMPTS);
    return clampQuickPromptPinnedList(normalizeQuickPromptList(saved));
  });
  const [imageQuickPrompts, setImageQuickPrompts] = useState(() => {
    const saved = readStorageJson(STORAGE_KEYS.imageQuickPrompts, DEFAULT_IMAGE_QUICK_PROMPTS);
    return clampQuickPromptPinnedList(normalizeQuickPromptList(saved));
  });
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyPanelPos, setHistoryPanelPos] = useState({ top: 0, left: 0, width: CHAT_HEADER_PANEL_WIDTH });
  const historyPanelRef = useRef(null);
  const historyPanelAnchorRef = useRef(null);
  const [historyToolsOpen, setHistoryToolsOpen] = useState(false);
  const [historyToolsPos, setHistoryToolsPos] = useState({ top: 0, left: 0, width: CHAT_HISTORY_TOOLS_PANEL_WIDTH });
  const historyToolsRef = useRef(null);
  const historyToolsAnchorRef = useRef(null);
  const [chatQuickConfigOpen, setChatQuickConfigOpen] = useState(false);
  const [chatQuickConfigPos, setChatQuickConfigPos] = useState({ top: 0, left: 0, width: CHAT_HEADER_PANEL_WIDTH });
  const chatQuickConfigAnchorRef = useRef(null);
  const chatQuickConfigPanelRef = useRef(null);
  const [imageQuickConfigOpen, setImageQuickConfigOpen] = useState(false);
  const [imageQuickConfigPos, setImageQuickConfigPos] = useState({ top: 0, left: 0, width: CHAT_HEADER_PANEL_WIDTH });
  const imageQuickConfigAnchorRef = useRef(null);
  const imageQuickConfigPanelRef = useRef(null);
  const [chatQuickPromptMenuOpenId, setChatQuickPromptMenuOpenId] = useState("");
  const [chatQuickPromptMenuPos, setChatQuickPromptMenuPos] = useState({ top: 0, left: 0 });
  const chatQuickPromptMenuPortalRef = useRef(null);
  const chatQuickPromptActionRefs = useRef({});
  const [imageQuickPromptMenuOpenId, setImageQuickPromptMenuOpenId] = useState("");
  const [imageQuickPromptMenuPos, setImageQuickPromptMenuPos] = useState({ top: 0, left: 0 });
  const imageQuickPromptMenuPortalRef = useRef(null);
  const imageQuickPromptActionRefs = useRef({});
  const [chatQuickPromptEditorOpenId, setChatQuickPromptEditorOpenId] = useState("");
  const [chatQuickPromptEditorDraft, setChatQuickPromptEditorDraft] = useState({ title: "", content: "" });
  const [imageQuickPromptEditorOpenId, setImageQuickPromptEditorOpenId] = useState("");
  const [imageQuickPromptEditorDraft, setImageQuickPromptEditorDraft] = useState({ title: "", content: "" });
  const [chatQuickPromptSelectMode, setChatQuickPromptSelectMode] = useState(false);
  const [chatQuickPromptSelectedIds, setChatQuickPromptSelectedIds] = useState([]);
  const chatQuickImportInputRef = useRef(null);
  const [deletePresetTarget, setDeletePresetTarget] = useState(null);
  const [historySelectMode, setHistorySelectMode] = useState(false);
  const [historySelectedIds, setHistorySelectedIds] = useState([]);
  const [sessionMenuOpenId, setSessionMenuOpenId] = useState("");
  const [sessionMenuPos, setSessionMenuPos] = useState({ top: 0, left: 0 });
  const sessionMenuPortalRef = useRef(null);
  const [deleteSessionTarget, setDeleteSessionTarget] = useState(null);
  const importTargetDialogResolverRef = useRef(null);
  const [importTargetDialog, setImportTargetDialog] = useState({
    open: false,
    errorCode: "",
    message: "",
    requestedDocumentId: null,
    requestedDocumentName: "",
    activeDocumentId: null,
    activeDocumentName: "",
    openDocuments: [],
    selectedDocumentId: null
  });
  useEffect(() => () => {
    if (typeof importTargetDialogResolverRef.current === "function") {
      importTargetDialogResolverRef.current({ confirmed: false, reason: "unmount" });
    }
    importTargetDialogResolverRef.current = null;
  }, []);
  const [identityQuickOpen, setIdentityQuickOpen] = useState(false);
  const identityQuickRef = useRef(null);
  const [identityQuickPos, setIdentityQuickPos] = useState({ top: 0, left: 0, width: CHAT_HEADER_PANEL_WIDTH });
  const identityQuickPanelRef = useRef(null);
  const startupSessionDoneRef = useRef(false);
  const chatLoadedRef = useRef(false);
  const chatNativeLoadSucceededRef = useRef(false);
  const chatSavingRef = useRef(null);
  const chatLocalSavingRef = useRef(null);
  const chatLocalSavedSigRef = useRef("");
  const chatImageHydrationInFlightRef = useRef(new Set());
  const [chatSessions, setChatSessions] = useState(() => {
    const hasNativeChatStore = typeof window !== "undefined"
      && !!window.shell
      && typeof window.shell.chatLoad === "function";
    if (hasNativeChatStore) {
      return [createChatSession("新对话", [])];
    }
    const saved = readStorageJson(STORAGE_KEYS.chatSessions, null);
    if (Array.isArray(saved) && saved.length) return saved.map((s, i) => normalizeSession(s, i)).filter(Boolean);
    const legacy = readStorageJson(STORAGE_KEYS.chatMessages, []);
    return [createChatSession("默认对话", Array.isArray(legacy) ? legacy : [])];
  });
  const [activeChatSessionId, setActiveChatSessionId] = useState(() => {
    const hasNativeChatStore = typeof window !== "undefined"
      && !!window.shell
      && typeof window.shell.chatLoad === "function";
    if (hasNativeChatStore) return "";
    try {
      return localStorage.getItem(STORAGE_KEYS.activeChatSessionId) || "";
    } catch {
      return "";
    }
  });
  const activeSession = useMemo(() => {
    if (!chatSessions.length) return null;
    const found = chatSessions.find((s) => s.id === activeChatSessionId);
    return found || chatSessions[0];
  }, [chatSessions, activeChatSessionId]);
  const chatSessionsRef = useRef(chatSessions);
  const sessionMessagesLoadingRef = useRef(new Set());
  useEffect(() => {
    chatSessionsRef.current = chatSessions;
  }, [chatSessions]);
  const messages = useMemo(
    () => (Array.isArray(activeSession?.messages) ? activeSession.messages : []),
    [activeSession]
  );
  const activeModelName = useMemo(() => String(chatConfig.model || "").trim(), [chatConfig.model]);
  const activeModelProvider = useMemo(() => {
    if (!activeModelName) return "模型服务商";
    return getModelProvider(activeModelName) || "模型服务商";
  }, [activeModelName]);
  const [chatInput, setChatInput] = useState("");
  const [uploadImages, setUploadImages] = useState([]);
  const uploadImagesRef = useRef(uploadImages);
  const [generatedPreviewImages, setGeneratedPreviewImages] = useState([]);
  const generatedPreviewImagesRef = useRef(generatedPreviewImages);
  const generatedPreviewHydrationInFlightRef = useRef(new Set());
  const [previewImageIndex, setPreviewImageIndex] = useState(0);
  const [isImageGenerating, setIsImageGenerating] = useState(false);
  const [imageRunQueueState, setImageRunQueueState] = useState({ running: false, pending: 0 });
  const [uploadImageFormat, setUploadImageFormat] = useState(() => (
    normalizeUploadImageFormat(readStorage(STORAGE_KEYS.uploadImageFormat, ""))
  ));
  const [imageCompressMaxSide, setImageCompressMaxSide] = useState(IMAGE_COMPRESS_MAX_SIDE_DEFAULT);
  const [imageCompressQuality, setImageCompressQuality] = useState(IMAGE_COMPRESS_QUALITY_DEFAULT);
  const [uploadSizeOpen, setUploadSizeOpen] = useState(false);
  const [uploadSizePanelPos, setUploadSizePanelPos] = useState({ top: 0, left: 0, width: CHAT_HEADER_PANEL_WIDTH });
  const [generationCountOpen, setGenerationCountOpen] = useState(false);
  const [generationCountDropdownPos, setGenerationCountDropdownPos] = useState({ top: 0, left: 0, width: 220 });
  const [generationSelectDropdown, setGenerationSelectDropdown] = useState({
    open: false,
    kind: "",
    top: 0,
    left: 0,
    width: 0
  });
  const [uploadDragOver, setUploadDragOver] = useState({ area: false, slot: -1 });
  const [editingUserMessageId, setEditingUserMessageId] = useState("");
  const [editingUserMessageText, setEditingUserMessageText] = useState("");
  const [userMessageActionsHoverId, setUserMessageActionsHoverId] = useState("");
  const userMessageActionsShowTimerRef = useRef(null);
  const userMessageActionsHideTimerRef = useRef(null);
  const [jsonPromptText, setJsonPromptText] = useState(() => {
    try {
      return String(localStorage.getItem(STORAGE_KEYS.jsonPrompt) || "");
    } catch {
      return "";
    }
  });
  const [isSending, setIsSending] = useState(false);
  const [cachePolicy, setCachePolicy] = useState(() => {
    const localPolicy = {
      chatRecords: normalizeCacheRetentionDays(readStorage(STORAGE_KEYS.cacheRetentionChatDays, DEFAULT_CACHE_POLICY.chatRecords), DEFAULT_CACHE_POLICY.chatRecords),
      images: normalizeCacheRetentionDays(readStorage(STORAGE_KEYS.cacheRetentionImageDays, DEFAULT_CACHE_POLICY.images), DEFAULT_CACHE_POLICY.images),
      other: normalizeCacheRetentionDays(readStorage(STORAGE_KEYS.cacheRetentionOtherDays, DEFAULT_CACHE_POLICY.other), DEFAULT_CACHE_POLICY.other)
    };
    return sanitizeCachePolicy(localPolicy);
  });
  const [cacheStats, setCacheStats] = useState(() => normalizeCacheStats(null));
  const cachePolicyApplyTimerRef = useRef(null);
  const cachePolicyApplySeqRef = useRef(0);
  const [sessionNamingEnabled, setSessionNamingEnabled] = useState(() => (
    readStorage(STORAGE_KEYS.sessionNamingEnabled, "1") !== "0"
  ));
  const [thinkingTranslateEnabled, setThinkingTranslateEnabled] = useState(() => (
    readStorage(STORAGE_KEYS.thinkingTranslateEnabled, "1") !== "0"
  ));
  const [thinkingTranslationMap, setThinkingTranslationMap] = useState({});
  const thinkingTranslateInFlightRef = useRef(new Set());
  const sessionNamingInFlightRef = useRef(new Set());
  const [chatStreamModeHints, setChatStreamModeHints] = useState(() => (
    normalizeChatStreamModeHintMap(readStorageJson(STORAGE_KEYS.chatStreamModeHints, {}))
  ));
  const chatStreamModeHintsRef = useRef(chatStreamModeHints);
  useEffect(() => {
    chatStreamModeHintsRef.current = chatStreamModeHints;
  }, [chatStreamModeHints]);
  const uiScaleSelectValue = useMemo(() => {
    let best = UI_SCALE_OPTIONS[0];
    let bestDiff = Math.abs(uiScale - best);
    for (const value of UI_SCALE_OPTIONS) {
      const diff = Math.abs(uiScale - value);
      if (diff < bestDiff) {
        best = value;
        bestDiff = diff;
      }
    }
    return String(best);
  }, [uiScale]);
  const allSystemPromptPresets = [...BUILTIN_PROMPT_PRESETS, ...systemPromptPresets];
  const selectedSystemPromptPreset = allSystemPromptPresets.find((item) => item.id === systemPromptPresetId);
  const sortedSessions = useMemo(() => {
    const currentId = activeSession?.id || "";
    return sortSessionsByPinAndUpdate(
      chatSessions.filter((session) => isValidConversation(session) || session.id === currentId)
    );
  }, [chatSessions, activeSession?.id]);
  const sortedChatQuickPrompts = useMemo(
    () => sortQuickPromptsByPinAndUpdate(chatQuickPrompts),
    [chatQuickPrompts]
  );
  const sortedImageQuickPrompts = useMemo(
    () => sortQuickPromptsByPinAndUpdate(imageQuickPrompts),
    [imageQuickPrompts]
  );
  const topPinnedChatQuickPrompts = useMemo(
    () => sortedChatQuickPrompts.filter((item) => item.pinned).slice(0, CHAT_QUICK_PROMPT_PINNED_LIMIT),
    [sortedChatQuickPrompts]
  );
   
  useEffect(() => {
    uploadImagesRef.current = uploadImages;
  }, [uploadImages]);

  useEffect(() => {
    generatedPreviewImagesRef.current = generatedPreviewImages;
  }, [generatedPreviewImages]);

  useEffect(() => {
    setPreviewImageIndex((prev) => {
      const size = Array.isArray(generatedPreviewImages) ? generatedPreviewImages.length : 0;
      if (size < 1) return 0;
      if (!Number.isFinite(prev) || prev < 0) return 0;
      if (prev >= size) return size - 1;
      return prev;
    });
  }, [generatedPreviewImages]);

  useEffect(() => {
    const size = Array.isArray(generatedPreviewImages) ? generatedPreviewImages.length : 0;
    if (size < 1) return;
    const safeIndex = Number.isFinite(previewImageIndex)
      ? Math.min(Math.max(0, Math.floor(previewImageIndex)), size - 1)
      : 0;
    void hydrateGeneratedPreviewImageAt(safeIndex);
  }, [previewImageIndex, generatedPreviewImages.length]);

  const setActiveMessages = (updater) => {
    const targetId = activeSession?.id;
    if (!targetId) return;
    setChatSessions((prev) =>
      prev.map((session) => {
        if (session.id !== targetId) return session;
        const nextMessages = typeof updater === "function" ? updater(session.messages || []) : updater;
        return {
          ...session,
          messages: Array.isArray(nextMessages) ? nextMessages : [],
          messageCount: Array.isArray(nextMessages) ? nextMessages.length : 0,
          messagesLoaded: true,
          updatedAt: Date.now()
        };
      })
    );
  };
  const releaseInactiveSessionMessages = (activeId) => {
    const keepId = String(activeId || "").trim();
    if (!keepId) return;
    setChatSessions((prev) => {
      let changed = false;
      const next = prev.map((session) => {
        if (!session || session.id === keepId) return session;
        if (!Array.isArray(session.messages) || !session.messages.length) return session;
        const safeCount = Math.max(Number(session.messageCount) || 0, session.messages.length);
        changed = true;
        return {
          ...session,
          messages: [],
          messageCount: safeCount,
          messagesLoaded: false
        };
      });
      return changed ? next : prev;
    });
  };
  const loadSessionMessagesById = async (sessionId, options = {}) => {
    const id = String(sessionId || "").trim();
    if (!id) return false;
    const force = !!options?.force;
    const current = (chatSessionsRef.current || []).find((item) => item.id === id);
    if (!force && current && current.messagesLoaded !== false) return true;
    if (sessionMessagesLoadingRef.current.has(id)) return false;
    const hasNativeLoader = !!window.shell && typeof window.shell.chatLoadSession === "function";
    if (!hasNativeLoader) return false;

    sessionMessagesLoadingRef.current.add(id);
    try {
      const result = await window.shell.chatLoadSession({ sessionId: id });
      if (!result?.ok || !result?.session) return false;
      const normalized = normalizeSession(result.session, 0);
      const nextMessages = Array.isArray(normalized?.messages) ? normalized.messages : [];
      const nextCount = Number.isFinite(Number(normalized?.messageCount))
        ? Math.max(nextMessages.length, Math.floor(Number(normalized.messageCount)))
        : nextMessages.length;
      setChatSessions((prev) => prev.map((session) => (
        session.id === id
          ? {
              ...session,
              messages: nextMessages,
              messageCount: nextCount,
              messagesLoaded: true,
              updatedAt: Number(normalized?.updatedAt) || session.updatedAt
            }
          : session
      )));
      return true;
    } catch {
      return false;
    } finally {
      sessionMessagesLoadingRef.current.delete(id);
    }
  };

  const clearUserMessageActionsShowTimer = () => {
    if (userMessageActionsShowTimerRef.current) {
      clearTimeout(userMessageActionsShowTimerRef.current);
      userMessageActionsShowTimerRef.current = null;
    }
  };

  const clearUserMessageActionsHideTimer = () => {
    if (userMessageActionsHideTimerRef.current) {
      clearTimeout(userMessageActionsHideTimerRef.current);
      userMessageActionsHideTimerRef.current = null;
    }
  };

  const holdUserMessageActions = (messageId, immediate = false) => {
    const id = String(messageId || "");
    clearUserMessageActionsHideTimer();
    clearUserMessageActionsShowTimer();
    if (!id) return;
    if (immediate) {
      setUserMessageActionsHoverId(id);
      return;
    }
    userMessageActionsShowTimerRef.current = setTimeout(() => {
      setUserMessageActionsHoverId(id);
      userMessageActionsShowTimerRef.current = null;
    }, 140);
  };

  const releaseUserMessageActions = (messageId) => {
    const id = String(messageId || "");
    clearUserMessageActionsShowTimer();
    clearUserMessageActionsHideTimer();
    userMessageActionsHideTimerRef.current = setTimeout(() => {
      setUserMessageActionsHoverId((prev) => (prev === id ? "" : prev));
      userMessageActionsHideTimerRef.current = null;
    }, 220);
  };

   
  useEffect(() => {
    setEditingUserMessageId("");
    setEditingUserMessageText("");
    setUserMessageActionsHoverId("");
    clearUserMessageActionsShowTimer();
    clearUserMessageActionsHideTimer();
  }, [activeSession?.id]);

  useEffect(() => () => {
    clearUserMessageActionsShowTimer();
    clearUserMessageActionsHideTimer();
    chatImageHydrationInFlightRef.current.clear();
    generatedPreviewHydrationInFlightRef.current.clear();
    sessionMessagesLoadingRef.current.clear();
  }, []);

  useEffect(() => {
    const activeId = String(activeSession?.id || "").trim();
    if (!activeId) return;
    void loadSessionMessagesById(activeId);
  }, [activeSession?.id]);

  useEffect(() => {
    const activeId = String(activeSession?.id || "").trim();
    if (!activeId) return;
    releaseInactiveSessionImageDataUrls(activeId);
    void hydrateSessionImagesFromCache(activeId);
  }, [activeSession?.id]);

  useEffect(() => {
    const activeId = String(activeSession?.id || "").trim();
    if (!activeId) return;
    const hasMissingCachedImage = (Array.isArray(messages) ? messages : []).some((message) => (
      Array.isArray(message?.images)
      && message.images.some((image) => String(image?.cacheId || "").trim() && !String(image?.dataUrl || "").trim())
    ));
    if (!hasMissingCachedImage) return;
    void hydrateSessionImagesFromCache(activeId);
  }, [activeSession?.id, messages]);

  
  useEffect(() => {
    if (!editingUserMessageId) return;
    const exists = messages.some((m) => m.role === "user" && m.id === editingUserMessageId);
    if (!exists) {
      setEditingUserMessageId("");
      setEditingUserMessageText("");
    }
  }, [messages, editingUserMessageId]);

   
  useEffect(() => {
    if (!userMessageActionsHoverId) return;
    const exists = messages.some((m) => m.role === "user" && m.id === userMessageActionsHoverId);
    if (!exists) setUserMessageActionsHoverId("");
  }, [messages, userMessageActionsHoverId]);

   
  useEffect(() => {
    if (!editingUserMessageId) return;
    const el = userMessageEditorRef.current;
    if (!el) return;
    autoResizeTextarea(el);
    el.focus();
    const cursor = el.value.length;
    el.setSelectionRange(cursor, cursor);
  }, [editingUserMessageId]);

  const sanitizeChatConfig = (cfg) => {
    const next = { ...cfg };
    const toNum = (v, fallback) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : fallback;
    };
    next.timeoutMs = Math.max(5000, toNum(next.timeoutMs, defaultChatConfig.timeoutMs));
    next.contextCount = Math.max(CONTEXT_MIN, Math.min(CONTEXT_MAX, Math.floor(toNum(next.contextCount, defaultChatConfig.contextCount))));
    next.maxTokens = Math.max(MAX_TOKENS_MIN, Math.min(MAX_TOKENS_MAX, Math.floor(toNum(next.maxTokens, defaultChatConfig.maxTokens))));
    next.temperature = Math.max(0, Math.min(2, toNum(next.temperature, defaultChatConfig.temperature)));
    next.topP = Math.max(0, Math.min(1, toNum(next.topP, defaultChatConfig.topP)));
    next.presencePenalty = Math.max(0, Math.min(2, toNum(next.presencePenalty, defaultChatConfig.presencePenalty)));
    next.frequencyPenalty = Math.max(0, Math.min(2, toNum(next.frequencyPenalty, defaultChatConfig.frequencyPenalty)));
    next.baseUrl = String(next.baseUrl || "").trim();
    next.apiKey = String(next.apiKey || "").trim();
    next.model = String(next.model || "").trim();
    next.systemPrompt = String(next.systemPrompt || "");
    return next;
  };

  const validateChatConfig = (cfg, { requireAuth = true } = {}) => {
    const errors = [];
    if (!cfg.baseUrl) errors.push("聊天地址未填写");
    if (requireAuth && !cfg.apiKey) errors.push("聊天 Key 未填写");
    if (!cfg.model) errors.push("聊天模型未填写");
    if (cfg.timeoutMs < 5000) errors.push("超时时间不能小于 5000ms");
    if (cfg.contextCount < CONTEXT_MIN || cfg.contextCount > CONTEXT_MAX) errors.push("上下文条数必须在 1-50");
    if (cfg.maxTokens < MAX_TOKENS_MIN || cfg.maxTokens > MAX_TOKENS_MAX) errors.push("最大回复 tokens 必须在 1-16384");
    if (cfg.temperature < 0 || cfg.temperature > 2) errors.push("temperature 必须在 0-2");
    if (cfg.topP < 0 || cfg.topP > 1) errors.push("top_p 必须在 0-1");
    if (cfg.presencePenalty < 0 || cfg.presencePenalty > 2) errors.push("presence_penalty 必须在 0 到 2");
    if (cfg.frequencyPenalty < 0 || cfg.frequencyPenalty > 2) errors.push("frequency_penalty 必须在 0 到 2");
    return errors;
  };

  const validateImageApiConfig = (cfg, { requireAuth = true } = {}) => {
    const errors = [];
    const baseUrl = String(cfg?.baseUrl || "").trim();
    const apiKey = String(cfg?.apiKey || "").trim();
    const model = String(cfg?.model || "").trim();
    const timeoutMs = Number(cfg?.timeoutMs);
    if (!baseUrl) errors.push("跑图地址未填写");
    if (requireAuth && !apiKey) errors.push("跑图 Key 未填写");
    if (!model) errors.push("跑图模型未填写");
    if (Number.isFinite(timeoutMs) && timeoutMs < 5000) errors.push("跑图超时不能小于 5000ms");
    return errors;
  };

  const formatApiError = (message) => {
    const msg = String(message || "请求失败");
    const requestId = msg.match(/request id[:：]\s*([^\s)]+)/i)?.[1] || "";
    const hasRequestIdInline = /request id[:：]/i.test(msg);
    const requestIdSuffix = requestId && !hasRequestIdInline ? `（request id: ${requestId}）` : "";
    if (msg === "abort" || msg === "aborted" || msg.includes("已停止生成")) return "已停止生成";
    if (msg.includes("chat_config_incomplete")) return "聊天配置不完整，请先填写地址/Key/模型";
    if (msg.includes("chat_busy")) return "当前已有生成任务，请先停止或等待完成";
    if (/target_document_not_found|target_document_required/i.test(msg)) {
      return "记录画布未命中，请在弹窗中选择已打开画布后继续导入。";
    }
    if (msg.includes("Failed to fetch")) return "网络连接失败，请检查地址或代理设置";
    if (/ratio or price not set|倍率或价格未配置/i.test(msg)) {
      return "当前模型计费未开通，请切换到可用模型后重试（服务端返回：ratio or price not set）。";
    }
    if (/无可用渠道|no available channel/i.test(msg)) {
      return `当前模型在服务端分组中无可用渠道，请切换模型或分组后重试。${requestIdSuffix}`.trim();
    }
    if (/service unavailable|http 503/i.test(msg)) {
      return `服务端暂时不可用（503），请稍后重试或切换服务商。${requestIdSuffix}`.trim();
    }
    return msg;
  };

  const extractRequestId = (message) => {
    const raw = String(message || "");
    return raw.match(/request id[:：]\s*([^\s)]+)/i)?.[1] || "";
  };

  const getFixGuideForError = (message, scene = "") => {
    const raw = String(message || "");
    const text = raw.toLowerCase();
    if (/no available channel|无可用渠道|分组中无可用渠道/.test(text)) {
      return "到服务商后台检查当前 Key 的分组与渠道绑定，并确认模型在该分组已开通。";
    }
    if (/ratio or price not set|倍率或价格未配置/.test(text)) {
      return "当前模型计费未开通；请在服务商后台开通计费或切换到可用模型后重试。";
    }
    if (/service unavailable|http 503|internal server error|http 500/.test(text)) {
      return "服务端异常；请稍后重试，或切换服务商/模型进行排查。";
    }
    if (/failed to fetch|network|网络连接失败|network error/.test(text)) {
      return "检查 API 地址、代理与证书；确认目标地址可访问且未被拦截。";
    }
    if (/unauthorized|forbidden|invalid key|鉴权|密钥|token|401|403/.test(text)) {
      return "请核对 API Key、权限与分组；确认 Key 对应服务商和接口格式一致。";
    }
    if (/model|模型|not found|unsupported|invalid/.test(text)) {
      return "请检查模型 ID 与接口兼容格式是否匹配，并确认服务端已提供该模型。";
    }
    if (/timeout|超时/.test(text)) {
      return "请求超时；可适当提高超时时间，或切换更快的模型/服务商。";
    }
    if (/no[\s_-]*active[\s_-]*selection|no[\s_-]*selection|selection[_\s-]*not[_\s-]*found|无选区|没有选区|未选择区域/.test(text)) {
      return "未检测到选区；请先在 Ps 中创建选区，再点击“选区”抓图。";
    }
    if (/no[\s_-]*active[\s_-]*document|document[_\s-]*not[_\s-]*found|未找到活动文档|无活动文档/.test(text)) {
      return "未检测到可用文档；请先在 Ps 中打开并激活文档。";
    }
    if (/target_document_not_found|target_document_required/.test(text)) {
      return "记录画布未命中；请在弹窗中选择已打开画布后继续导入。";
    }
    if (/html 页面|返回内容不是 json|json 解析失败/.test(text)) {
      return "服务地址可能填写错误；请确认 Base URL 指向 API 端点而非网页。";
    }
    if (/encodeimagedata returned empty|empty png payload|image data with alpha cannot be encoded as jpeg/.test(text)) {
      return "Ps 抓图编码失败；请重载插件后重试。若仍失败，先改为全图抓图，并检查 Ps 文档是否可正常读像素。";
    }
    if (/invalid file token used|import_file_token_missing|import_temp_file_path_empty/.test(text)) {
      return "Ps 回传文件令牌无效；请重试回传。若仍失败，请重载 Ps 插件后再试。";
    }
    if (/capture_encode_failed|canvas_png_encode_failed|rgba_payload_|imageData\.getData returned empty|imageData_getData_empty/.test(text)) {
      return "Ps 插件像素编码失败；请检查文档是否可读、重载插件后重试，必要时先用全图抓取。";
    }
    if (/capture_file_missing|capture_file_invalid|capture_file_empty|capture_file_path_required|capture_file_path_empty|capture_file_buffer_empty/.test(text)) {
      return "抓图临时文件不可用；请确认插件有本地文件写入权限，并检查系统临时目录是否可访问。";
    }
    if (/bridge|插件/.test(text) || scene === "bridge") {
      return "请确认桌面端 bridge 与 Ps 插件端口一致，并检查插件是否允许访问 localhost。";
    }
    return "请打开大控制台查看上下文日志，按时间顺序排查配置、网络与服务端状态。";
  };

  const appendTraceLog = ({
    level = "info",
    type = "api",
    domain = "",
    phase = "",
    message = "",
    startedAt = 0,
    endedAt = 0,
    requestId = "",
    guide = ""
  } = {}) => {
    const domainText = String(domain || "").trim();
    const phaseText = String(phase || "").trim();
    const head = [domainText, phaseText].filter(Boolean).join(" ");
    const timeBits = [];
    if (Number.isFinite(startedAt) && Number.isFinite(endedAt) && endedAt >= startedAt && startedAt > 0) {
      timeBits.push(`耗时 ${Math.round(endedAt - startedAt)}ms`);
    }
    const normalizedMessage = String(message || "").trim();
    const compactHead = head.replace(/\s+/g, "");
    const compactMessage = normalizedMessage.replace(/\s+/g, "");
    const mergedLine = head
      ? (normalizedMessage && compactMessage.startsWith(compactHead)
          ? normalizedMessage
          : `${head}${normalizedMessage ? `：${normalizedMessage}` : ""}`)
      : normalizedMessage;
    const bodyLines = [mergedLine];
    if (timeBits.length) bodyLines.push(timeBits.join("，"));
    const normalizedPhase = String(phase || "").trim();
    const normalizedLevel = String(level || "").trim().toLowerCase();
    let state = "info";
    if (normalizedLevel === "error") state = "error";
    else if (normalizedLevel === "warn") state = "warn";
    else if (/发送|开始|处理中|连接中|重连中|验证中/.test(normalizedPhase)) state = "running";
    else if (/返回|成功|完成|通过/.test(normalizedPhase)) state = "success";
    appendLog(level, bodyLines.join("\n"), type, {
      requestId: requestId || extractRequestId(message),
      guide,
      state
    });
  };

  const clearApiVerifyTimer = (section) => {
    const key = section === "image" ? "image" : "chat";
    const timer = apiVerifyTimerRef.current[key];
    if (timer) {
      clearTimeout(timer);
      apiVerifyTimerRef.current[key] = null;
    }
  };

  const clearApiSuccessFlashTimer = (section) => {
    const key = section === "image" ? "image" : "chat";
    const timer = apiSuccessFlashTimerRef.current[key];
    if (timer) {
      clearTimeout(timer);
      apiSuccessFlashTimerRef.current[key] = null;
    }
  };

  const markApiActionSuccess = (section = "chat", issueText = "") => {
    const key = section === "image" ? "image" : "chat";
    clearApiSuccessFlashTimer(key);
    if (key === "chat") {
      setChatApiStatus("ok");
      setChatApiIssueText(issueText);
    } else {
      setImageApiStatus("ok");
      setImageApiIssueText(issueText);
    }
    apiSuccessFlashTimerRef.current[key] = setTimeout(() => {
      if (key === "chat") {
        setChatApiStatus((prev) => (prev === "ok" ? "connected" : prev));
      } else {
        setImageApiStatus((prev) => (prev === "ok" ? "connected" : prev));
      }
      apiSuccessFlashTimerRef.current[key] = null;
    }, 1600);
  };

    const getApiErrorMessage = (payload, fallback = "") => {
    return String(
      payload?.error?.message
      || payload?.error
      || payload?.message
      || payload?.msg
      || fallback
      || "请求失败"
    );
  };

  const fetchWithTimeout = async (url, options = {}, timeoutMs = 8000) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(1500, Number(timeoutMs) || 8000));
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } catch (err) {
      if (err?.name === "AbortError") {
        throw new Error(`请求超时（>${Math.round(Math.max(1500, Number(timeoutMs) || 8000) / 1000)}s）`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  };

  const parseApiResponseLoose = async (response) => {
    const raw = await response.text();
    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    let data = null;
    if (contentType.includes("application/json")) {
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = null;
      }
    }
    return {
      status: Number(response.status) || 0,
      ok: !!response.ok,
      contentType,
      raw,
      data
    };
  };

  const looksLikeAuthError = (text) => /unauthorized|forbidden|invalid[_\s-]*key|api[_\s-]*key|鉴权|密钥|token/i.test(String(text || ""));
  const looksLikeModelError = (text) => /model|模型|not\s+found|unsupported|invalid/i.test(String(text || ""));
  const isReachableNonFatalProbeStatus = (status) => status === 400 || status === 422 || status === 429;

  const verifyApiConnectivity = async (section = "chat", options = {}) => {
    const key = section === "image" ? "image" : "chat";
    const silent = !!options?.silent;
    const logResult = options?.logResult ?? !silent;
    const apiLabel = key === "chat" ? "聊天 API" : "跑图 API";
    const miniTextMap = key === "chat"
      ? {
          busy: "聊天验证中",
          ok: "聊天已连接",
          error: "聊天失败",
          okTip: "聊天服务端连接成功。"
        }
      : {
          busy: "跑图验证中",
          ok: "跑图已连接",
          error: "跑图失败",
          okTip: "跑图服务端连接成功。"
        };
    const logVerifySuccess = () => {
      if (!logResult) return;
      appendLog("info", `${apiLabel} 连通验证成功`, "api", { state: "success" });
    };
    const logVerifyFailure = (issue) => {
      if (!logResult) return;
      appendLog("error", `${apiLabel} 连通验证失败：${issue}`, "api", { state: "error" });
    };
    const seq = (apiVerifySeqRef.current[key] || 0) + 1;
    apiVerifySeqRef.current[key] = seq;
    const isLatest = () => apiVerifySeqRef.current[key] === seq;
    const setPending = () => {
      if (!isLatest()) return;
      clearApiSuccessFlashTimer(key);
      if (key === "chat") {
        setChatApiStatus("warn");
        setChatApiIssueText("");
      } else {
        setImageApiStatus("warn");
        setImageApiIssueText("");
      }
    };
    const setSuccess = (message = "") => {
      if (!isLatest()) return false;
      clearApiSuccessFlashTimer(key);
      if (key === "chat") {
        setChatApiStatus("connected");
        setChatApiIssueText(message);
      } else {
        setImageApiStatus("connected");
        setImageApiIssueText(message);
      }
      return true;
    };
    const setFailure = (message = "") => {
      if (!isLatest()) return false;
      clearApiSuccessFlashTimer(key);
      if (key === "chat") {
        setChatApiStatus("error");
        setChatApiIssueText(message);
      } else {
        setImageApiStatus("error");
        setImageApiIssueText(message);
      }
      return true;
    };

    const runOpenAiCompatProbe = async (cfg, { actionName = "连接验证", hint = "" } = {}) => {
      const openaiBase = normalizeOpenAIBaseForModels(cfg.baseUrl);
      const endpoint = `${openaiBase}/models`;
      const response = await fetchWithTimeout(endpoint, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${cfg.apiKey}`
        }
      }, Math.min(10000, Number(cfg?.timeoutMs) || 8000));
      const parsed = await parseApiResponseLoose(response);
      const issue = getApiErrorMessage(parsed.data, parsed.raw || `HTTP ${parsed.status}`);
      if (parsed.ok) {
        return { ok: true, message: "" };
      }
      if (parsed.status === 401 || parsed.status === 403 || looksLikeAuthError(issue)) {
        throw new Error(`鉴权失败：${issue}`);
      }
      if (parsed.status === 404 || parsed.status === 405) {
        throw new Error(`${actionName}失败：接口不可用（HTTP ${parsed.status}），请检查地址${hint ? `（${hint}）` : ""}`);
      }
      if (isReachableNonFatalProbeStatus(parsed.status)) {
        if (looksLikeModelError(issue) && !/messages|payload|body|request|参数/i.test(issue)) {
          throw new Error(`模型不可用：${issue}`);
        }
        if (parsed.status === 429) {
          return { ok: true, message: "连接可达，但当前触发速率限制（429）" };
        }
        return { ok: true, message: "" };
      }
      if (parsed.status >= 500) {
        throw new Error(`${actionName}失败：服务端异常（HTTP ${parsed.status}）`);
      }
      throw new Error(issue || `${actionName}失败：HTTP ${parsed.status}`);
    };

    const runGoogleModelProbe = async (cfg, { actionName = "连接验证" } = {}) => {
      const googleBase = normalizeGoogleBaseForModels(cfg.baseUrl);
      const timeoutMs = Math.min(10000, Number(cfg?.timeoutMs) || 8000);
      const probeByPath = async (path) => {
        const endpoint = `${googleBase}${path}${path.includes("?") ? "&" : "?"}key=${encodeURIComponent(cfg.apiKey)}`;
        const response = await fetchWithTimeout(endpoint, { method: "GET" }, timeoutMs);
        return parseApiResponseLoose(response);
      };
      const listParsed = await probeByPath("/v1beta/models");
      if (listParsed.ok) {
        return { ok: true, message: "" };
      }
      const listIssue = getApiErrorMessage(listParsed.data, listParsed.raw || `HTTP ${listParsed.status}`);
      if (listParsed.status === 429) {
        return { ok: true, message: "连接可达，但当前触发速率限制（429）" };
      }
      if (listParsed.status === 401 || listParsed.status === 403 || looksLikeAuthError(listIssue)) {
        throw new Error(`鉴权失败：${listIssue}`);
      }
      if ([404, 405].includes(Number(listParsed.status))) {
        const modelParsed = await probeByPath(`/v1beta/models/${encodeURIComponent(cfg.model)}`);
        if (modelParsed.ok) return { ok: true, message: "" };
        const modelIssue = getApiErrorMessage(modelParsed.data, modelParsed.raw || `HTTP ${modelParsed.status}`);
        if (modelParsed.status === 429) {
          return { ok: true, message: "连接可达，但当前触发速率限制（429）" };
        }
        if (modelParsed.status >= 500) {
          throw new Error(`${actionName}失败：服务端异常（HTTP ${modelParsed.status}）`);
        }
        throw new Error(modelIssue);
      }
      if (listParsed.status >= 500) {
        throw new Error(`${actionName}失败：服务端异常（HTTP ${listParsed.status}）`);
      }
      throw new Error(listIssue);
    };

    try {
      setPending();
      setMiniConsole(miniTextMap.busy, "busy", `${apiLabel} 正在验证中。`);
      if (key === "chat") {
        const cfg = sanitizeChatConfig(chatConfig);
        const errs = validateChatConfig(cfg);
        if (errs.length) throw new Error(errs[0]);
        const providerMode = normalizeChatProviderModeBySiteKey(chatProviderKey, cfg.providerMode);
        const result = providerMode === "google-native"
          ? await runGoogleModelProbe(cfg, { actionName: "聊天连通性验证" })
          : await runOpenAiCompatProbe(cfg, { actionName: "聊天连通性验证", hint: "OpenAI 兼容模型端点" });
        const ok = setSuccess(result?.message || "");
        if (ok) {
          logVerifySuccess();
          setMiniConsole(miniTextMap.ok, "connected", miniTextMap.okTip);
        }
        return { ok: !!ok, message: result?.message || "" };
      }

      const cfg = {
        baseUrl: String(imageConfig?.baseUrl || "").trim(),
        apiKey: String(imageConfig?.apiKey || "").trim(),
        model: String(imageConfig?.model || "").trim(),
        timeoutMs: Math.max(5000, Number(imageConfig?.timeoutMs) || defaultImageConfig.timeoutMs),
        providerMode: imageConfig?.providerMode
      };
      const errs = validateImageApiConfig(cfg);
      if (errs.length) throw new Error(errs[0]);
      const imageSiteKeyNow = imageProviderKey;
      const providerMode = normalizeImageProviderModeBySiteKey(imageSiteKeyNow, cfg.providerMode);
      let result = { ok: true, message: "" };
      if (imageSiteKeyNow === "grsai" && providerMode !== "google-native") {
        const grsaiBase = normalizeBaseForOption(cfg.baseUrl);
        const endpoint = `${grsaiBase}/v1/draw/result`;
        const response = await fetchWithTimeout(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${cfg.apiKey}`
          },
          body: JSON.stringify({ id: `probe-${Date.now()}` })
        }, Math.min(10000, Number(cfg?.timeoutMs) || 8000));
        const parsed = await parseApiResponseLoose(response);
        if (!parsed.ok) {
          const issue = getApiErrorMessage(parsed.data, parsed.raw || `HTTP ${parsed.status}`);
          if (parsed.status === 429) {
            result = { ok: true, message: "连接可达，但当前触发速率限制（429）" };
          } else if (parsed.status >= 500) {
            throw new Error(`跑图连通性验证失败：服务端异常（HTTP ${parsed.status}）`);
          } else {
            throw new Error(issue);
          }
        } else {
          const code = Number(parsed?.data?.code);
          if (Number.isFinite(code) && code !== 0 && code !== -22) {
            const issue = getApiErrorMessage(parsed.data, parsed.raw || "连接验证失败");
            throw new Error(issue);
          }
          result = { ok: true, message: "" };
        }
      } else if (providerMode === "google-native") {
        result = await runGoogleModelProbe(cfg, { actionName: "跑图连通性验证" });
      } else {
        result = await runOpenAiCompatProbe(cfg, { actionName: "跑图连通性验证", hint: "OpenAI 兼容模型端点" });
      }
      const ok = setSuccess(result?.message || "");
      if (ok) {
        logVerifySuccess();
        setMiniConsole(miniTextMap.ok, "connected", miniTextMap.okTip);
      }
      return { ok: !!ok, message: result?.message || "" };
    } catch (err) {
      const issue = formatApiError(String(err?.message || err || "连接失败"));
      const failed = setFailure(issue);
      if (failed) {
        logVerifyFailure(issue);
      }
      setMiniConsole(miniTextMap.error, "error", "验证失败。请打开大控制台查看详细修复指引。");
      return { ok: false, message: issue };
    }
  };

  const restartEmbeddedServer = async () => {
    if (!window.shell || typeof window.shell.serverStop !== "function" || typeof window.shell.serverStart !== "function") {
      return false;
    }
    try {
      await window.shell.serverStop();
    } catch {
      // ignore
    }
    try {
      const info = await window.shell.serverStart({ port: bridgePort });
      const nextPort = normalizeBridgePort(info?.port, bridgePort);
      setBridgePort(nextPort);
      setServerStatus({
        running: !!info?.running,
        pid: info?.pid || null,
        port: nextPort,
        available: true
      });
      return true;
    } catch {
      return false;
    }
  };

  const requestJson = async (url, options, actionName, extra = {}) => {
    const { retry404 = true, retryNetwork = true } = extra;
    let res = null;
    try {
      res = await fetch(url, options);
    } catch (err) {
      if (retryNetwork) {
        const restarted = await restartEmbeddedServer();
        if (restarted) {
          appendLog("warn", `${actionName}网络失败，已重启内置服务并重试`, "api");
          await new Promise((resolve) => setTimeout(resolve, 300));
          return requestJson(url, options, actionName, { retry404, retryNetwork: false });
        }
      }
      throw err;
    }
    if (res.status === 404 && retry404) {
      const restarted = await restartEmbeddedServer();
      if (restarted) {
        appendLog("warn", `${actionName}命中 404，已重启内置服务并重试`, "api");
        await new Promise((resolve) => setTimeout(resolve, 250));
        return requestJson(url, options, actionName, { retry404: false });
      }
    }
    const text = await res.text();
    const contentType = String(res.headers.get("content-type") || "").toLowerCase();
    if (!contentType.includes("application/json")) {
      const hint = hasLikelyHtml(text)
        ? `收到 HTML 页面，请确认桥接服务已启动并监听 127.0.0.1:${bridgePort}`
        : "返回内容不是 JSON";
      throw new Error(`${actionName}失败：HTTP ${res.status}，${hint}`);
    }
    let data = null;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`${actionName}失败：返回 JSON 解析失败（HTTP ${res.status}）`);
    }
    if (!res.ok || !data?.ok) {
      throw new Error(data?.message || `${actionName}失败：HTTP ${res.status}`);
    }
    return data;
  };
   
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.consoleOpen, consoleOpen ? "1" : "0");
    } catch {
      // ignore
    }
  }, [consoleOpen]);
   
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.previewCollapsed, previewCollapsed ? "1" : "0");
    } catch {
      // ignore
    }
  }, [previewCollapsed]);
   
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.importLayerType, importLayerType);
    } catch {
      // ignore
    }
  }, [importLayerType]);
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.alwaysOnTop, alwaysOnTop ? "1" : "0");
    } catch {
      // ignore
    }
  }, [alwaysOnTop]);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.floatingToggleEnabled, floatingToggleEnabled ? "1" : "0");
    } catch {
      // ignore
    }
  }, [floatingToggleEnabled]);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.floatingToggleOpacity, String(clampFloatingToggleOpacity(floatingToggleOpacity)));
    } catch {
      // ignore
    }
  }, [floatingToggleOpacity]);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.autoMinimizeOnBlur, autoMinimizeOnBlur ? "1" : "0");
    } catch {
      // ignore
    }
  }, [autoMinimizeOnBlur]);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.logFilters, JSON.stringify(logFilters));
    } catch {
      // ignore
    }
  }, [logFilters]);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.uploadImageFormat, uploadImageFormat);
    } catch {
      // ignore
    }
  }, [uploadImageFormat]);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.chatConfig, JSON.stringify(encodeConfigApiKey(chatConfig)));
      localStorage.setItem(STORAGE_KEYS.imageConfig, JSON.stringify(encodeConfigApiKey(imageConfig)));
      localStorage.setItem(STORAGE_KEYS.chatProviderKey, chatProviderKey);
      localStorage.setItem(STORAGE_KEYS.imageProviderKey, imageProviderKey);
    } catch {
      // ignore
    }
  }, [chatConfig, imageConfig, chatProviderKey, imageProviderKey]);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.chatProviderProfiles, JSON.stringify(encodeProfilesApiKeyMap(chatProviderProfiles)));
    } catch {
      // ignore
    }
  }, [chatProviderProfiles]);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.imageProviderProfiles, JSON.stringify(encodeProfilesApiKeyMap(imageProviderProfiles)));
    } catch {
      // ignore
    }
  }, [imageProviderProfiles]);
  useEffect(() => {
    setChatProviderProfiles((prev) => ({
      ...prev,
      [chatProviderKey]: { ...(prev[chatProviderKey] || {}), ...chatConfig }
    }));
  }, [chatProviderKey, chatConfig]);
  useEffect(() => {
    setImageProviderProfiles((prev) => ({
      ...prev,
      [imageProviderKey]: { ...(prev[imageProviderKey] || {}), ...imageConfig }
    }));
  }, [imageConfig, imageProviderKey]);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.systemPromptPresets, JSON.stringify(systemPromptPresets));
    } catch {
      // ignore
    }
  }, [systemPromptPresets]);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.chatQuickPrompts, JSON.stringify(chatQuickPrompts));
    } catch {
      // ignore
    }
  }, [chatQuickPrompts]);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.imageQuickPrompts, JSON.stringify(imageQuickPrompts));
    } catch {
      // ignore
    }
  }, [imageQuickPrompts]);
  useEffect(() => {
    const hasNativeChatStore = !!window.shell && typeof window.shell.chatSave === "function";
    if (hasNativeChatStore) {
      chatLocalSavedSigRef.current = "";
      return;
    }
    try {
      chatLocalSavedSigRef.current = String(localStorage.getItem(STORAGE_KEYS.chatSessions) || "");
    } catch {
      chatLocalSavedSigRef.current = "";
    }
  }, []);
  useEffect(() => {
    const hasNativeChatStore = !!window.shell && typeof window.shell.chatSave === "function";
    if (hasNativeChatStore) {
      try {
        if (activeSession?.id) {
          localStorage.setItem(STORAGE_KEYS.activeChatSessionId, activeSession.id);
        }
      } catch {
        // ignore
      }
      return undefined;
    }
    if (chatLocalSavingRef.current) {
      clearTimeout(chatLocalSavingRef.current);
      chatLocalSavingRef.current = null;
    }
    chatLocalSavingRef.current = setTimeout(() => {
      chatLocalSavingRef.current = null;
      try {
        const nextSig = JSON.stringify(chatSessions);
        if (nextSig !== chatLocalSavedSigRef.current) {
          localStorage.setItem(STORAGE_KEYS.chatSessions, nextSig);
          chatLocalSavedSigRef.current = nextSig;
        }
        if (activeSession?.id) {
          localStorage.setItem(STORAGE_KEYS.activeChatSessionId, activeSession.id);
        }
      } catch {
        // ignore
      }
    }, CHAT_SESSIONS_LOCAL_SAVE_DEBOUNCE_MS);
    return () => {
      if (chatLocalSavingRef.current) {
        clearTimeout(chatLocalSavingRef.current);
        chatLocalSavingRef.current = null;
      }
    };
  }, [chatSessions, activeSession?.id]);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const readLocalSessionFallback = () => {
        const saved = readStorageJson(STORAGE_KEYS.chatSessions, []);
        if (!Array.isArray(saved) || !saved.length) return [];
        return saved.map((session, idx) => normalizeSession(session, idx)).filter(Boolean);
      };
      const hasAnySessionMessages = (sessions = []) => (
        Array.isArray(sessions)
          && sessions.some((session) => {
            const loaded = Array.isArray(session?.messages) ? session.messages.length : 0;
            const counted = Number(session?.messageCount || 0);
            return loaded > 0 || counted > 0;
          })
      );
      const applySessionBootstrap = (baseSessions = []) => {
        if (startupSessionDoneRef.current) return;
        const normalized = Array.isArray(baseSessions)
          ? baseSessions.map((session, idx) => normalizeSession(session, idx)).filter(Boolean)
          : [];
        if (!normalized.length) {
          const draft = createChatSession("新对话", []);
          setChatSessions([draft]);
          setActiveChatSessionId(draft.id);
          startupSessionDoneRef.current = true;
          return;
        }
        const sorted = sortSessionsByPinAndUpdate(normalized);
        const emptyDraft = sorted.find(
          (session) => Array.isArray(session?.messages)
            && session.messages.length === 0
            && Number(session?.messageCount || 0) <= 0
        )
          || createChatSession("新对话", []);
        const nextSessions = sorted.some((session) => session.id === emptyDraft.id)
          ? [emptyDraft, ...sorted.filter((session) => session.id !== emptyDraft.id)]
          : [emptyDraft, ...sorted];
        setChatSessions(nextSessions);
        setActiveChatSessionId(emptyDraft.id);
        startupSessionDoneRef.current = true;
      };
      if (!window.shell || typeof window.shell.chatLoad !== "function") {
        applySessionBootstrap(chatSessions, activeChatSessionId);
        chatNativeLoadSucceededRef.current = true;
        chatLoadedRef.current = true;
        return;
      }
      try {
        const result = await window.shell.chatLoad({ summaryOnly: true });
        if (!alive || !result?.ok) {
          const localFallback = readLocalSessionFallback();
          applySessionBootstrap(localFallback.length ? localFallback : chatSessions, activeChatSessionId);
          chatNativeLoadSucceededRef.current = false;
          return;
        }
        const loadedSessions = Array.isArray(result.sessions)
          ? result.sessions.map((s, i) => normalizeSession(s, i)).filter(Boolean)
          : [];
        if (Array.isArray(result.sessions)) {
          appendLog("info", `已读取对话列表（${result.sessions.length} 个会话）`, "system");
        }
        const localFallback = readLocalSessionFallback();
        const loadedHasMessages = hasAnySessionMessages(loadedSessions);
        const fallbackHasMessages = hasAnySessionMessages(localFallback);
        if (!loadedHasMessages && fallbackHasMessages) {
          appendLog("warn", "检测到本地缓存仍有历史会话，已尝试恢复。", "system");
          applySessionBootstrap(localFallback, String(result.activeId || ""));
        } else {
          applySessionBootstrap(loadedSessions, String(result.activeId || ""));
        }
        chatNativeLoadSucceededRef.current = true;
      } catch (err) {
        const localFallback = readLocalSessionFallback();
        applySessionBootstrap(localFallback.length ? localFallback : chatSessions, activeChatSessionId);
        chatNativeLoadSucceededRef.current = false;
        appendLog("warn", `读取对话列表失败：${err?.message || "未知错误"}`, "api");
      } finally {
        chatLoadedRef.current = true;
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (!chatLoadedRef.current) return;
    const hasNativeChatStore = !!window.shell && typeof window.shell.chatSave === "function";
    if (!hasNativeChatStore) return;
    if (!chatNativeLoadSucceededRef.current) return;
    if (chatSavingRef.current) {
      clearTimeout(chatSavingRef.current);
    }
    chatSavingRef.current = setTimeout(async () => {
      try {
        const activeId = activeSession?.id || "";
        const saveResult = await window.shell.chatSave({ sessions: chatSessions, activeId });
        if (!saveResult?.ok) {
          if (saveResult?.message === "chat_save_rejected_suspicious_truncation") {
            appendLog("warn", "已阻止可疑写空：对话文件未被覆盖。", "system");
          } else {
            appendLog("warn", `保存对话列表失败：${saveResult?.message || "未知错误"}`, "api");
          }
          return;
        }
        releaseInactiveSessionMessages(activeId);
      } catch (err) {
        appendLog("warn", `保存对话列表失败：${err?.message || "未知错误"}`, "api");
      }
    }, 250);
    return () => {
      if (chatSavingRef.current) {
        clearTimeout(chatSavingRef.current);
      }
    };
  }, [chatSessions, activeSession?.id]);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.jsonPrompt, jsonPromptText || "");
    } catch {
      // ignore
    }
  }, [jsonPromptText]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.uiScale);
      if (raw !== null) {
        hasScalePrefRef.current = true;
      }
    } catch {
      // ignore
    }
  }, []);
  useEffect(() => {
    if (!uiScaleDirtyRef.current) return;
    try {
      localStorage.setItem(STORAGE_KEYS.uiScale, String(uiScale));
      hasScalePrefRef.current = true;
    } catch {
      // ignore
    }
  }, [uiScale]);
  useEffect(() => {
    if (status.ok || status.psConnected) {
      lastOkRef.current = Date.now();
    }
  }, [status.ok, status.psConnected]);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.chatStreamModeHints, JSON.stringify(chatStreamModeHints));
    } catch {
      // ignore
    }
  }, [chatStreamModeHints]);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.sessionNamingEnabled, sessionNamingEnabled ? "1" : "0");
    } catch {
      // ignore
    }
  }, [sessionNamingEnabled]);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.thinkingTranslateEnabled, thinkingTranslateEnabled ? "1" : "0");
    } catch {
      // ignore
    }
  }, [thinkingTranslateEnabled]);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.cacheRetentionChatDays, String(cachePolicy.chatRecords));
      localStorage.setItem(STORAGE_KEYS.cacheRetentionImageDays, String(cachePolicy.images));
      localStorage.setItem(STORAGE_KEYS.cacheRetentionOtherDays, String(cachePolicy.other));
    } catch {
      // ignore
    }
  }, [cachePolicy]);
  useEffect(() => {
    if (thinkingTranslateEnabled) return;
    thinkingTranslateInFlightRef.current.clear();
    setThinkingTranslationMap({});
  }, [thinkingTranslateEnabled]);
  useEffect(() => {
    const validMessageIds = new Set(
      (Array.isArray(messages) ? messages : [])
        .map((item) => String(item?.id || "").trim())
        .filter(Boolean)
    );
    setThinkingOpenMap((prev) => {
      const entries = Object.entries(prev || {});
      if (!entries.length) return prev;
      let changed = false;
      const next = {};
      entries.forEach(([key, value]) => {
        if (validMessageIds.has(key)) {
          next[key] = value;
        } else {
          changed = true;
        }
      });
      return changed ? next : prev;
    });
    setThinkingTranslationMap((prev) => {
      const entries = Object.entries(prev || {});
      if (!entries.length) return prev;
      let changed = false;
      const next = {};
      entries.forEach(([key, value]) => {
        if (validMessageIds.has(key)) {
          next[key] = value;
        } else {
          changed = true;
        }
      });
      return changed ? next : prev;
    });
    const inFlight = thinkingTranslateInFlightRef.current;
    if (inFlight && typeof inFlight.forEach === "function" && inFlight.size > 0) {
      const stale = [];
      inFlight.forEach((id) => {
        if (!validMessageIds.has(String(id || "").trim())) stale.push(id);
      });
      stale.forEach((id) => inFlight.delete(id));
    }
  }, [messages]);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.chatApiFoldOpen, chatApiFoldOpen ? "1" : "0");
    } catch {
      // ignore
    }
  }, [chatApiFoldOpen]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.imageApiFoldOpen, imageApiFoldOpen ? "1" : "0");
    } catch {
      // ignore
    }
  }, [imageApiFoldOpen]);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.settingsToolsFoldOpen, settingsToolsFoldOpen ? "1" : "0");
    } catch {
      // ignore
    }
  }, [settingsToolsFoldOpen]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.settingsDisplayFoldOpen, settingsDisplayFoldOpen ? "1" : "0");
    } catch {
      // ignore
    }
  }, [settingsDisplayFoldOpen]);
  useEffect(() => {
    tipVisibleRef.current = !!tipState.visible;
  }, [tipState.visible]);
  const clampMiniConsoleText = (text) => String(text || "").trim().slice(0, 7) || "系统就绪";
  const setMiniConsole = (text, level = "info", tip = "") => {
    const safeText = clampMiniConsoleText(text);
    const safeTip = String(tip || "").trim() || "点击展开大控制台查看详细日志。";
    setMiniConsoleState((prev) => {
      if (prev.text === safeText && prev.level === level && prev.tip === safeTip) {
        return prev;
      }
      return { text: safeText, level, tip: safeTip };
    });
  };
  const getStatusIcon = (text) => {
    if (!text) return iconConsole;
    if (text.includes("聊天")) return iconChatHistory;
    if (text.includes("跑图")) return iconRunJson;
    if (text.includes("取图") || text.includes("编码") || text.includes("图片")) return iconUploadSel;
    if (text.includes("回传")) return iconExport;
    if (text.includes("连接中")) return iconConnectingAnim;
    if (text.includes("已连接")) return iconConnecting;
    if (text.includes("待连接") || text.includes("插件")) return iconReconnect;
    if (text.includes("发送中")) return iconConnectingAnim;
    if (text.includes("选区")) return iconUploadSel;
    if (text.includes("全图")) return iconUploadFull;
    if (text.includes("本地") || text.includes("上传")) return iconUploadLocal;
    if (text.includes("设置")) return iconSettings;
    if (text.includes("导出")) return iconExport;
    return iconConsole;
  };
  const miniStatus = miniConsoleState.text;
  const miniStatusTip = miniConsoleState.tip;
  const miniStatusLevelClass = miniConsoleState.level === "error"
    ? "is-error"
    : miniConsoleState.level === "connected"
      ? "is-connected"
    : miniConsoleState.level === "ok"
      ? "is-ok"
      : miniConsoleState.level === "busy"
        ? "is-busy"
        : "is-warn";
  const statusIcon = getStatusIcon(miniStatus);
  const formatLogTime = (dateValue = new Date()) => {
    const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
    const pad2 = (n) => String(Math.max(0, Number(n) || 0)).padStart(2, "0");
    return `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
  };
  const appendLog = (level, message, type = "system", extra = {}) => {
    const truncateLogText = (raw, limit = LOG_MESSAGE_MAX_CHARS) => {
      const text = String(raw || "").trim();
      if (!text) return "";
      const cap = Math.max(80, Number(limit) || LOG_MESSAGE_MAX_CHARS);
      return text.length > cap ? `${text.slice(0, cap)}...` : text;
    };
    const ts = formatLogTime(new Date());
    const labelMap = {
      system: "系统",
      api: "API",
      bridge: "桥接",
      dev: "开发"
    };
    const safeMessage = truncateLogText(message, LOG_MESSAGE_MAX_CHARS);
    const lines = [safeMessage];
    const requestId = String(extra?.requestId || "").trim();
    const durationMs = Number(extra?.durationMs);
    const guide = truncateLogText(extra?.guide, LOG_GUIDE_MAX_CHARS);
    if (requestId) lines.push(`request id: ${requestId}`);
    if (Number.isFinite(durationMs) && durationMs >= 0) lines.push(`耗时: ${Math.round(durationMs)}ms`);
    if (guide) lines.push(`修复指引: ${guide}`);
    const finalMessage = lines.filter(Boolean).join("\n");
    const state = String(extra?.state || "").trim();
    setLogs((prev) => {
      const next = [...prev, {
        id: `${Date.now()}-${prev.length}`,
        ts,
        level,
        type,
        typeLabel: labelMap[type] || type,
        message: finalMessage,
        state
      }];
      if (next.length > 200) next.shift();
      return next;
    });
  };

  useEffect(() => {
    if (!import.meta?.env?.DEV) return undefined;
    let alive = true;
    let timerId = 0;
    const sample = async () => {
      if (!alive) return;
      try {
        const perfMem = performance?.memory || null;
        const rendererHeapUsed = Number(perfMem?.usedJSHeapSize || 0);
        const rendererHeapTotal = Number(perfMem?.totalJSHeapSize || 0);
        let mainHeapUsed = 0;
        let mainRss = 0;
        if (typeof window.shell?.memorySample === "function") {
          try {
            const sampleResult = await window.shell.memorySample();
            mainHeapUsed = Number(sampleResult?.main?.heapUsed || 0);
            mainRss = Number(sampleResult?.main?.rss || 0);
          } catch {
            // ignore
          }
        }
        const parts = [];
        if (rendererHeapUsed > 0) {
          parts.push(`renderer=${formatMemoryBytes(rendererHeapUsed)}/${formatMemoryBytes(rendererHeapTotal)}`);
        }
        if (mainHeapUsed > 0 || mainRss > 0) {
          parts.push(`mainHeap=${formatMemoryBytes(mainHeapUsed)}`);
          parts.push(`mainRss=${formatMemoryBytes(mainRss)}`);
        }
        if (parts.length) {
          console.debug(`[memory] ${parts.join(" | ")}`);
        }
      } catch {
        // ignore
      }
    };
    void sample();
    timerId = window.setInterval(() => {
      void sample();
    }, DEV_MEMORY_SAMPLE_INTERVAL_MS);
    return () => {
      alive = false;
      if (timerId) window.clearInterval(timerId);
    };
  }, []);

  useEffect(() => {
    if (!bootLoggedRef.current) {
      appendLog("info", "系统已就绪", "system");
      setMiniConsole("系统就绪", "ok", "系统状态正常。");
      bootLoggedRef.current = true;
    }
    aliveRef.current = true;
    psPluginLogCursorRef.current = 0;
    psPluginLogPrimedRef.current = false;
    psPluginLogRouteDisabledRef.current = false;

    const scheduleNext = (delayMs) => {
      if (!aliveRef.current) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(tick, delayMs);
    };
    const getConnectedDelay = () => (
      document.visibilityState === "visible" ? POLL_FAST_VISIBLE_MS : POLL_BACKGROUND_MS
    );
    const getIdleDelay = () => (
      document.visibilityState === "visible" ? POLL_OK_VISIBLE_MS : POLL_BACKGROUND_MS
    );
    const syncPsPluginLogs = async (latestIdHint) => {
      if (psPluginLogRouteDisabledRef.current) return;
      const latestHint = Number.isFinite(Number(latestIdHint)) ? Math.floor(Number(latestIdHint)) : 0;
      if (!psPluginLogPrimedRef.current) {
        psPluginLogCursorRef.current = Math.max(0, latestHint);
        psPluginLogPrimedRef.current = true;
        return;
      }
      if (latestHint > 0 && latestHint <= psPluginLogCursorRef.current) return;
      const since = Math.max(0, Math.floor(Number(psPluginLogCursorRef.current) || 0));
      const query = since > 0 ? `?since=${since}` : "";
      const result = await requestJson(
        `${bridgeApiBase}/ps/logs${query}`,
        undefined,
        "读取插件日志",
        { retry404: false, retryNetwork: false }
      );
      const list = Array.isArray(result?.logs) ? result.logs : [];
      let nextCursor = Math.max(since, Math.floor(Number(result?.latestId) || 0));
      for (const item of list) {
        const itemId = Math.floor(Number(item?.id) || 0);
        if (itemId > nextCursor) nextCursor = itemId;
        const level = String(item?.level || "info").trim().toLowerCase();
        const normalizedLevel = level === "error" ? "error" : (level === "warn" ? "warn" : "info");
        const scene = String(item?.scene || "").trim();
        const message = String(item?.message || "").trim();
        const detail = String(item?.detail || "").trim();
        const merged = [message, detail].filter(Boolean).join("：");
        appendTraceLog({
          level: normalizedLevel,
          type: "bridge",
          domain: "插件日志",
          phase: scene || "错误",
          message: merged || "插件出现未知错误",
          guide: normalizedLevel === "error" ? getFixGuideForError(merged || message || detail, "bridge") : ""
        });
        if (normalizedLevel === "error") {
          setMiniConsole("插件错误", "error", "插件出现错误。请打开大控制台查看修复指引。");
        }
      }
      psPluginLogCursorRef.current = nextCursor;
    };

    const tick = async () => {
      try {
        const data = await requestJson(`${bridgeApiBase}/status`, undefined, "读取状态", { retry404: false });
        if (!aliveRef.current) return;
        const nextStatus = normalizeBridgeRuntimeStatus(data);
        setStatus((prev) => (isBridgeRuntimeStatusEqual(prev, nextStatus) ? prev : nextStatus));
        const hasPluginLogsField = !!(data && Object.prototype.hasOwnProperty.call(data, "psPluginLogLatestId"));
        if (hasPluginLogsField) {
          try {
            await syncPsPluginLogs(data?.psPluginLogLatestId);
          } catch (err) {
            const raw = String(err?.message || err || "");
            if (raw.includes("404")) {
              psPluginLogRouteDisabledRef.current = true;
            }
          }
        }
        const nextStatusText = data && data.psConnected ? "插件已连接" : data && data.ok ? "插件连接中" : "插件待连接";
        if (nextStatusText !== prevStatusTextRef.current) {
          const isBridgeReachable = !!(data && data.ok);
          const isPluginConnected = !!(data && data.psConnected);
          appendTraceLog({
            level: isPluginConnected ? "info" : (isBridgeReachable ? "info" : "error"),
            type: "bridge",
            domain: "插件连接",
            phase: "状态变更",
            message: nextStatusText,
            guide: isBridgeReachable ? "" : "桥接状态不可达。请检查本地 bridge 服务、插件端口和 localhost 访问权限。"
          });
          prevStatusTextRef.current = nextStatusText;
          if (data && data.psConnected) {
            setMiniConsole("插件已连接", "ok", "插件连接正常。");
          } else if (data && data.ok) {
            setMiniConsole("插件连接中", "busy", "桥接服务可达，等待 Ps 插件握手。");
          } else {
            setMiniConsole("插件待连接", "warn", "插件未连接。点击微型控制台可展开查看桥接日志。");
          }
        }
        if (data && data.psConnected) {
          backoffIndexRef.current = 0;
          scheduleNext(getConnectedDelay());
        } else {
          scheduleNext(getIdleDelay());
        }
      } catch {
        if (!aliveRef.current) return;
        const fallbackStatus = { ok: false, psConnected: false, queueSize: 0 };
        setStatus((prev) => (isBridgeRuntimeStatusEqual(prev, fallbackStatus) ? prev : fallbackStatus));
        const nextStatusText = "插件待连接";
        if (nextStatusText !== prevStatusTextRef.current) {
          appendTraceLog({
            level: "error",
            type: "bridge",
            domain: "插件连接",
            phase: "状态变更",
            message: nextStatusText,
            guide: "桥接状态不可达。请检查本地 bridge 服务、插件端口和 localhost 访问权限。"
          });
          prevStatusTextRef.current = nextStatusText;
          setMiniConsole("插件待连接", "warn", "插件连接中断。请打开大控制台查看桥接修复指引。");
        }
        const index = Math.min(backoffIndexRef.current, POLL_BACKOFF_MS.length - 1);
        const delay = POLL_BACKOFF_MS[index];
        const finalDelay = document.visibilityState === "visible" ? delay : Math.max(delay, POLL_BACKGROUND_MS);
        backoffIndexRef.current = Math.min(index + 1, POLL_BACKOFF_MS.length - 1);
        scheduleNext(finalDelay);
      }
    };
    const onVisibilityChange = () => {
      if (!aliveRef.current) return;
      scheduleNext(0);
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    tick();
    return () => {
      aliveRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [bridgeApiBase]);

  useEffect(() => {
    document.documentElement.style.setProperty("--ui-base-w", `${BASE_WIDTH}px`);
    document.documentElement.style.setProperty("--ui-base-h", `${BASE_HEIGHT}px`);
    document.documentElement.style.setProperty("--chat-min-h", `${CHAT_HEIGHT_MIN}px`);
    document.documentElement.style.setProperty("--ui-scale", String(uiScale));
    if (window.shell && typeof window.shell.setWindowScale === "function") {
      const prevScale = currentScaleRef.current || 1;
      if (typeof window.shell.getWindowBounds === "function") {
        window.shell.getWindowBounds().then((bounds) => {
          const baseW = bounds && bounds.width ? Math.round(bounds.width / prevScale) : BASE_WIDTH;
          const baseH = bounds && bounds.height ? Math.round(bounds.height / prevScale) : BASE_HEIGHT;
          window.shell.setWindowScale(uiScale, baseW, baseH);
        });
      } else {
        window.shell.setWindowScale(uiScale, BASE_WIDTH, BASE_HEIGHT);
      }
    }
    currentScaleRef.current = uiScale;
  }, [uiScale, scalePending]);

  useEffect(() => {
    const applyMinSize = (minWidth, minHeight) => {
      if (window.shell && typeof window.shell.setWindowMinSize === "function") {
        window.shell.setWindowMinSize(minWidth, minHeight);
      }
    };
    const measure = () => {
      if (adaptiveFreezeCountRef.current > 0) {
        pendingMeasureAfterFreezeRef.current = true;
        return;
      }
      if (view !== "home" && lastHomeMinSizeRef.current.minHeight) {
        const cached = lastHomeMinSizeRef.current;
        lastMinSizeRef.current = cached;
        if (resizingRef.current) {
          pendingMinSizeRef.current = cached;
          return;
        }
        applyMinSize(cached.minWidth, cached.minHeight);
        return;
      }
      const getHeight = (ref) => {
        if (!ref.current || typeof ref.current.getBoundingClientRect !== "function") return 0;
        const h = Number(ref.current.getBoundingClientRect().height || 0);
        if (!Number.isFinite(h) || h <= 0) return 0;
        return h;
      };
      const topbarH = getHeight(topbarRef);
      const footerH = getHeight(footerRef);
      const bottomHMeasured = getHeight(bottomControlsRef);
      const bottomH = view === "home" ? bottomHMeasured : lastHomeHeightsRef.current.bottomH;
      document.documentElement.style.setProperty("--topbar-h", `${topbarH}px`);
      document.documentElement.style.setProperty("--footer-h", `${footerH}px`);

      resizeStateRef.current = { measured: true };

      let paddingY = 0;
      let rowGap = 0;
      const contentScrollEl = view === "settings" ? contentScrollSettingsRef.current : contentScrollHomeRef.current;
      if (contentScrollEl) {
        const style = getComputedStyle(contentScrollEl);
        paddingY = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
        rowGap = parseFloat(style.rowGap) || 0;
      }
      const moduleCount = view === "home" ? 3 : 1;
      const gaps = Math.max(0, moduleCount - 1) * rowGap;
      const previewH = previewCollapsed
        ? ACTION_ROW_H
        : (PREVIEW_CARD_H + PREVIEW_GAP + ACTION_ROW_H) * uiScale;
      let mainMinH = (view === "home" ? CHAT_HEIGHT_MIN : SETTINGS_MIN_H) * uiScale;
      let chatFixedH = 0;
      if (view === "home") {
        const getH = (ref) => getHeight(ref);
        const chatHeaderH = getH(chatHeaderRef);
        const chatInputH = getH(chatInputRef);
        const uploadH = getH(uploadAreaRef);
        const chatStyle = chatModuleRef.current ? getComputedStyle(chatModuleRef.current) : null;
        const chatGap = chatStyle ? (parseFloat(chatStyle.rowGap) || 0) : 0;
        const chatGaps = chatGap * 3;
        chatFixedH = chatHeaderH + chatInputH + uploadH + chatGaps;
        mainMinH = (CHAT_HEIGHT_MIN * uiScale) + chatFixedH;
        lastHomeHeightsRef.current = { chatFixedH, bottomH };
      } else {
        chatFixedH = lastHomeHeightsRef.current.chatFixedH;
        mainMinH = (CHAT_HEIGHT_MIN * uiScale) + chatFixedH;
      }
      const minHeight = Math.ceil(topbarH + footerH + bottomH + previewH + mainMinH + paddingY + gaps);
      const minWidth = Math.ceil(320 * uiScale);
      if (view === "home") {
        lastHomeMinSizeRef.current = { minWidth, minHeight };
        if (!consoleOpen) {
          lastMinSizeNoConsoleRef.current = { minWidth, minHeight };
        }
      }
      const finalMin = { minWidth, minHeight };
      lastMinSizeRef.current = finalMin;
      if (resizingRef.current) {
        pendingMinSizeRef.current = finalMin;
        return;
      }
      applyMinSize(finalMin.minWidth, finalMin.minHeight);
    };
    measureRef.current = measure;
    const scheduleMeasure = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(measure);
    };
    let ro;
    if (window.ResizeObserver) {
      ro = new ResizeObserver(scheduleMeasure);
      [
        topbarRef.current,
        footerRef.current,
        previewRef.current,
        consoleRef.current,
        bottomControlsRef.current,
        contentScrollHomeRef.current,
        contentScrollSettingsRef.current
      ].forEach((el) => {
        if (el) ro.observe(el);
      });
    }
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(measure);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      if (ro) ro.disconnect();
    };
  }, [previewCollapsed, consoleOpen, uiScale, view]);

  useEffect(() => {
    if (!scalePending) return;
    if (scaleTimerRef.current) clearInterval(scaleTimerRef.current);
    scaleTimerRef.current = setInterval(() => {
      setScaleCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(scaleTimerRef.current);
          scaleTimerRef.current = null;
          setUiScale(prevScaleRef.current);
          setScalePending(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (scaleTimerRef.current) clearInterval(scaleTimerRef.current);
      scaleTimerRef.current = null;
    };
  }, [scalePending]);

  const handleScaleSelect = (nextScale) => {
    if (scaleTimerRef.current) clearInterval(scaleTimerRef.current);
    uiScaleDirtyRef.current = true;
    prevScaleRef.current = uiScale;
    setUiScale(nextScale);
    setScalePending(nextScale);
    setScaleCountdown(15);
  };

  const handleScaleConfirm = () => {
    if (scaleTimerRef.current) clearInterval(scaleTimerRef.current);
    scaleTimerRef.current = null;
    uiScaleDirtyRef.current = true;
    setScalePending(null);
    setScaleCountdown(0);
  };

  const handleScaleCancel = () => {
    if (scaleTimerRef.current) clearInterval(scaleTimerRef.current);
    scaleTimerRef.current = null;
    setUiScale(prevScaleRef.current);
    setScalePending(null);
    setScaleCountdown(0);
  };

  const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
  const waitFrames = async (count = 1) => {
    for (let i = 0; i < count; i += 1) {
      await nextFrame();
    }
  };
  const suppressResizeFreezeFor = (ms = 520) => {
    resizeFreezeSuppressUntilRef.current = Math.max(resizeFreezeSuppressUntilRef.current, Date.now() + Math.max(0, ms));
  };
  const readElementHeight = (el) => {
    if (!el || typeof el.getBoundingClientRect !== "function") return 0;
    const h = Number(el.getBoundingClientRect().height || 0);
    if (!Number.isFinite(h) || h <= 0) return 0;
    return h;
  };
  const toPx = (value) => `${Math.max(0, Number(value) || 0).toFixed(3)}px`;
  const applyChatLayoutFreeze = () => {
    if (view === "home") {
      if (chatLayoutFrozenRef.current && homeWrapLayoutFrozenRef.current && homeContentLayoutFrozenRef.current) return;
      const homeWrapEl = contentWrapHomeRef.current;
      if (homeWrapEl && !homeWrapLayoutFrozenRef.current) {
        const homeWrapH = readElementHeight(homeWrapEl);
        if (homeWrapH > 0) {
          homeWrapEl.style.height = toPx(homeWrapH);
          homeWrapEl.style.minHeight = toPx(homeWrapH);
          homeWrapEl.style.flex = "0 0 auto";
          homeWrapLayoutFrozenRef.current = true;
        }
      }
      const homeContentEl = contentScrollHomeRef.current;
      if (homeContentEl && !homeContentLayoutFrozenRef.current) {
        const homeContentH = readElementHeight(homeContentEl);
        if (homeContentH > 0) {
          homeContentEl.style.height = toPx(homeContentH);
          homeContentEl.style.minHeight = toPx(homeContentH);
          homeContentEl.style.flex = "0 0 auto";
          homeContentLayoutFrozenRef.current = true;
        }
      }
      const el = chatModuleRef.current;
      if (!el) return;
      const h = readElementHeight(el);
      if (h <= 0) return;
      el.style.height = toPx(h);
      el.style.minHeight = toPx(h);
      el.style.flex = "0 0 auto";
      chatLayoutFrozenRef.current = true;
      return;
    }
    if (view === "settings") {
      if (settingsWrapLayoutFrozenRef.current && settingsContentLayoutFrozenRef.current) return;
      const settingsWrapEl = contentWrapSettingsRef.current;
      if (settingsWrapEl && !settingsWrapLayoutFrozenRef.current) {
        const settingsWrapH = readElementHeight(settingsWrapEl);
        if (settingsWrapH > 0) {
          settingsWrapEl.style.height = toPx(settingsWrapH);
          settingsWrapEl.style.minHeight = toPx(settingsWrapH);
          settingsWrapEl.style.flex = "0 0 auto";
          settingsWrapLayoutFrozenRef.current = true;
        }
      }
      const settingsContentEl = contentScrollSettingsRef.current;
      if (settingsContentEl && !settingsContentLayoutFrozenRef.current) {
        const settingsContentH = readElementHeight(settingsContentEl);
        if (settingsContentH > 0) {
          settingsContentEl.style.height = toPx(settingsContentH);
          settingsContentEl.style.minHeight = toPx(settingsContentH);
          settingsContentEl.style.flex = "0 0 auto";
          settingsContentLayoutFrozenRef.current = true;
        }
      }
    }
  };
  const clearChatLayoutFreeze = () => {
    const homeWrapEl = contentWrapHomeRef.current;
    if (homeWrapEl) {
      homeWrapEl.style.removeProperty("height");
      homeWrapEl.style.removeProperty("min-height");
      homeWrapEl.style.removeProperty("flex");
    }
    homeWrapLayoutFrozenRef.current = false;
    const homeContentEl = contentScrollHomeRef.current;
    if (homeContentEl) {
      homeContentEl.style.removeProperty("height");
      homeContentEl.style.removeProperty("min-height");
      homeContentEl.style.removeProperty("flex");
    }
    homeContentLayoutFrozenRef.current = false;
    const settingsWrapEl = contentWrapSettingsRef.current;
    if (settingsWrapEl) {
      settingsWrapEl.style.removeProperty("height");
      settingsWrapEl.style.removeProperty("min-height");
      settingsWrapEl.style.removeProperty("flex");
    }
    settingsWrapLayoutFrozenRef.current = false;
    const settingsContentEl = contentScrollSettingsRef.current;
    if (settingsContentEl) {
      settingsContentEl.style.removeProperty("height");
      settingsContentEl.style.removeProperty("min-height");
      settingsContentEl.style.removeProperty("flex");
    }
    settingsContentLayoutFrozenRef.current = false;
    const el = chatModuleRef.current;
    if (el) {
      el.style.removeProperty("height");
      el.style.removeProperty("min-height");
      el.style.removeProperty("flex");
    }
    chatLayoutFrozenRef.current = false;
  };
  const freezeAdaptiveLayout = () => {
    if (adaptiveFreezeCountRef.current === 0) {
      applyChatLayoutFreeze();
    }
    adaptiveFreezeCountRef.current += 1;
  };
  const unfreezeAdaptiveLayout = () => {
    adaptiveFreezeCountRef.current = Math.max(0, adaptiveFreezeCountRef.current - 1);
    if (adaptiveFreezeCountRef.current !== 0) return;
    const shouldMeasure = pendingMeasureAfterFreezeRef.current;
    pendingMeasureAfterFreezeRef.current = false;
    requestAnimationFrame(() => {
      clearChatLayoutFreeze();
      if (chatInputTextRef.current) {
        autoResizeChatInput(chatInputTextRef.current);
      }
      if (!shouldMeasure) return;
      if (measureRef.current) measureRef.current();
    });
  };
  const getConsoleResizeDelta = (nextOpen) => {
    const footerEl = footerRef.current;
    const gapRaw = footerEl ? parseFloat(getComputedStyle(footerEl).rowGap || getComputedStyle(footerEl).gap || "0") : NaN;
    const gap = Number.isFinite(gapRaw) && gapRaw > 0
      ? Math.ceil(gapRaw)
      : Math.ceil(CONSOLE_PANEL_GAP * uiScale);
    const currentBodyH = Math.ceil(consoleRef.current?.getBoundingClientRect().height || 0);
    const bodyH = currentBodyH > 0
      ? currentBodyH
      : Math.ceil(CONSOLE_PANEL_H * uiScale);
    const total = Math.max(0, Math.ceil(bodyH + gap));
    return nextOpen ? total : -total;
  };
  const toggleConsole = async () => {
    if (consoleToggleBusyRef.current) return;
    const nextOpen = !consoleOpen;
    consoleToggleBusyRef.current = true;
    setConsoleOpening(true);
    suppressResizeFreezeFor(720);
    freezeAdaptiveLayout();
    try {
      const canResize = !!(window.shell && typeof window.shell.adjustWindowSize === "function");
      const delta = getConsoleResizeDelta(nextOpen);
      if (nextOpen) {
        if (canResize && delta !== 0) {
          try {
            await window.shell.adjustWindowSize(0, delta);
          } catch {
            // keep UI state consistent even if shell resize fails
          }
        }
        await nextFrame();
        setConsoleOpen(true);
      } else {
        setConsoleOpen(false);
        await nextFrame();
        if (canResize && delta !== 0) {
          const currentMin = lastMinSizeRef.current;
          const nextMinH = Math.max(0, Math.ceil((currentMin?.minHeight || 0) + delta));
          if (nextMinH > 0 && window.shell && typeof window.shell.setWindowMinSize === "function") {
            try {
              await window.shell.setWindowMinSize(currentMin?.minWidth || 0, nextMinH);
            } catch {
              // ignore and continue best-effort resize
            }
          }
          try {
            await window.shell.adjustWindowSize(0, delta);
          } catch {
            // keep UI state consistent even if shell resize fails
          }
        }
      }
      pendingMeasureAfterFreezeRef.current = true;
      await waitFrames(2);
    } finally {
      suppressResizeFreezeFor(220);
      unfreezeAdaptiveLayout();
      requestAnimationFrame(() => {
        setConsoleOpening(false);
        consoleToggleBusyRef.current = false;
      });
    }
  };

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      const applyServerStatus = (nextStatus) => {
        if (!alive) return;
        setServerStatus((prev) => {
          const normalized = {
            running: !!nextStatus?.running,
            pid: nextStatus?.pid ?? null,
            port: Number(nextStatus?.port) || Number(prev?.port) || DEFAULT_BRIDGE_PORT,
            available: !!nextStatus?.available
          };
          return isServerRuntimeStatusEqual(prev, normalized) ? prev : normalized;
        });
      };
      if (!window.shell || typeof window.shell.serverStatus !== "function") {
        applyServerStatus({
          running: false,
          pid: null,
          available: false
        });
        return;
      }
      try {
        const info = await window.shell.serverStatus();
        const nextPort = normalizeBridgePort(info?.port, DEFAULT_BRIDGE_PORT);
        if (alive) {
          setBridgePort(nextPort);
          applyServerStatus({
            running: !!info?.running,
            pid: info?.pid || null,
            port: nextPort,
            available: true
          });
        }
      } catch {
        applyServerStatus({
          running: false,
          pid: null,
          available: true
        });
      }
    };
    refresh();
    const timer = setInterval(refresh, 1500);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    if (bridgePortInputFocusedRef.current || bridgePortApplying) return;
    setBridgePortDraft(String(bridgePort));
  }, [bridgePort, bridgePortApplying]);
  useEffect(() => {
    if (view !== "settings") {
      setChatConfigExpanded(false);
    }
  }, [view]);
  useEffect(() => {
    const cfg = sanitizeChatConfig(chatConfig);
    const errors = validateChatConfig(cfg);
    if (errors.length) {
      clearApiSuccessFlashTimer("chat");
      setChatApiStatus("error");
      setChatApiIssueText(errors[0]);
      const marker = `${chatProviderKey}|${errors[0]}`;
      if (apiConfigValidationKeyRef.current.chat !== marker) {
        apiConfigValidationKeyRef.current.chat = marker;
        appendTraceLog({
          level: "warn",
          type: "api",
          domain: "聊天 API",
          phase: "配置校验失败",
          message: errors[0],
          guide: "请先补全地址、模型与密钥，系统会在配置有效后自动执行连通验证。"
        });
      }
      return;
    }
    apiConfigValidationKeyRef.current.chat = "";
    setChatApiIssueText("");
    setChatApiStatus((prev) => (prev === "ok" || prev === "connected" ? prev : "warn"));
  }, [chatConfig.baseUrl, chatConfig.apiKey, chatConfig.model]);
  useEffect(() => {
    const errors = validateImageApiConfig(imageConfig);
    if (errors.length) {
      clearApiSuccessFlashTimer("image");
      setImageApiStatus("error");
      setImageApiIssueText(errors[0]);
      const marker = `${imageProviderKey}|${errors[0]}`;
      if (apiConfigValidationKeyRef.current.image !== marker) {
        apiConfigValidationKeyRef.current.image = marker;
        appendTraceLog({
          level: "warn",
          type: "api",
          domain: "跑图 API",
          phase: "配置校验失败",
          message: errors[0],
          guide: "请先补全地址、模型与密钥，系统会在配置有效后自动执行连通验证。"
        });
      }
      return;
    }
    apiConfigValidationKeyRef.current.image = "";
    setImageApiIssueText("");
    setImageApiStatus((prev) => (prev === "ok" || prev === "connected" ? prev : "warn"));
  }, [imageConfig.baseUrl, imageConfig.apiKey, imageConfig.model, imageConfig.timeoutMs]);
  useEffect(() => () => {
    clearApiVerifyTimer("chat");
    clearApiVerifyTimer("image");
    clearApiSuccessFlashTimer("chat");
    clearApiSuccessFlashTimer("image");
  }, []);
  useEffect(() => {
    const cfg = sanitizeChatConfig(chatConfig);
    const errors = validateChatConfig(cfg);
    if (errors.length) {
      clearApiVerifyTimer("chat");
      autoApiVerifyKeyRef.current.chat = "";
      return;
    }
    const providerMode = normalizeChatProviderModeBySiteKey(chatProviderKey, cfg.providerMode);
    const signature = [
      chatProviderKey,
      providerMode,
      normalizeBaseForOption(cfg.baseUrl),
      cfg.apiKey,
      cfg.model
    ].join("|");
    if (autoApiVerifyKeyRef.current.chat === signature) return;
    clearApiVerifyTimer("chat");
    apiVerifyTimerRef.current.chat = setTimeout(() => {
      autoApiVerifyKeyRef.current.chat = signature;
      const reason = autoApiVerifyBootRef.current.chat ? "地址配置更新验证" : "启动后自动验证";
      autoApiVerifyBootRef.current.chat = true;
      void verifyApiConnectivity("chat", {
        silent: true,
        reason,
        logResult: true
      });
    }, 420);
    return () => {
      clearApiVerifyTimer("chat");
    };
  }, [chatProviderKey, chatConfig.baseUrl, chatConfig.apiKey, chatConfig.model, chatConfig.providerMode]);
  useEffect(() => {
    const cfg = {
      baseUrl: String(imageConfig.baseUrl || "").trim(),
      apiKey: String(imageConfig.apiKey || "").trim(),
      model: String(imageConfig.model || "").trim(),
      timeoutMs: Math.max(5000, Number(imageConfig.timeoutMs) || defaultImageConfig.timeoutMs),
      providerMode: imageConfig.providerMode
    };
    const errors = validateImageApiConfig(cfg);
    if (errors.length) {
      clearApiVerifyTimer("image");
      autoApiVerifyKeyRef.current.image = "";
      return;
    }
    const providerMode = normalizeImageProviderModeBySiteKey(imageProviderKey, cfg.providerMode);
    const signature = [
      imageProviderKey,
      providerMode,
      normalizeBaseForOption(cfg.baseUrl),
      cfg.apiKey,
      cfg.model
    ].join("|");
    if (autoApiVerifyKeyRef.current.image === signature) return;
    clearApiVerifyTimer("image");
    apiVerifyTimerRef.current.image = setTimeout(() => {
      autoApiVerifyKeyRef.current.image = signature;
      const reason = autoApiVerifyBootRef.current.image ? "地址配置更新验证" : "启动后自动验证";
      autoApiVerifyBootRef.current.image = true;
      void verifyApiConnectivity("image", {
        silent: true,
        reason,
        logResult: true
      });
    }, 420);
    return () => {
      clearApiVerifyTimer("image");
    };
  }, [imageProviderKey, imageConfig.baseUrl, imageConfig.apiKey, imageConfig.model, imageConfig.timeoutMs, imageConfig.providerMode]);
  useEffect(() => {
    const inferredMode = normalizeImageProviderModeBySiteKey(imageProviderKey, imageConfig.providerMode);
    const currentMode = normalizeProviderMode(imageConfig.providerMode);
    if (currentMode === inferredMode) return;
    setImageConfig((prev) => ({ ...prev, providerMode: inferredMode }));
  }, [imageProviderKey, imageConfig.providerMode]);
  useEffect(() => {
    const inferredMode = normalizeChatProviderModeBySiteKey(chatProviderKey, chatConfig.providerMode);
    const currentMode = normalizeProviderMode(chatConfig.providerMode);
    if (currentMode === inferredMode) return;
    setChatConfig((prev) => ({ ...prev, providerMode: inferredMode }));
  }, [chatProviderKey, chatConfig.providerMode]);
  useEffect(() => {
    if (imageProviderKey !== "aji") return;
    const currentModel = String(imageConfig.model || "").trim();
    if (currentModel && !/^nano-banana-pro$/i.test(currentModel)) return;
    setImageConfig((prev) => {
      const prevModel = String(prev.model || "").trim();
      if (prevModel && !/^nano-banana-pro$/i.test(prevModel)) return prev;
      return { ...prev, model: "AJbanana3" };
    });
  }, [imageProviderKey, imageConfig.model]);
  useEffect(() => {
    if (chatProviderKey !== "aji") return;
    const currentModel = String(chatConfig.model || "").trim();
    if (currentModel !== "gemini-3-pro-preview-thinking-*") return;
    setChatConfig((prev) => {
      const prevModel = String(prev.model || "").trim();
      if (prevModel !== "gemini-3-pro-preview-thinking-*") return prev;
      return { ...prev, model: "gemini-3-pro-preview-thinking" };
    });
  }, [chatProviderKey, chatConfig.model]);
  useEffect(() => {
    if (!activeChatSessionId && chatSessions.length) {
      setActiveChatSessionId(chatSessions[0].id);
    }
  }, [activeChatSessionId, chatSessions]);
  useEffect(() => {
    setChatSessions((prev) => {
      const next = prev.filter((session) => (
        session
        && typeof session.id === "string"
        && Array.isArray(session.messages)
      ));
      return next.length === prev.length ? prev : next;
    });
  }, [activeSession?.id, activeChatSessionId]);

  const refreshHistory = async () => {
    const latestAssistant = [...messages].reverse().find((m) => m.role === "assistant" && m.text);
    if (latestAssistant) {
      const extracted = latestAssistant.jsonPrompt
        ? JSON.stringify(latestAssistant.jsonPrompt, null, 2)
        : extractJsonText(latestAssistant.text);
      setJsonPromptText(extracted || "");
    } else {
      setJsonPromptText("");
    }
  };

  useEffect(() => {
    appendLog("info", "已载入本地聊天配置", "system");
    refreshHistory();
  }, []);
  useEffect(() => {
    refreshHistory();
  }, [activeSession?.id, messages.length]);

  const isConnected = status.psConnected;
  const imageRunQueueTotal = imageRunQueueState.pending + (imageRunQueueState.running ? 1 : 0);
  const pluginConnectionState = status.psConnected ? "已连接" : status.ok ? "连接中" : "未连接";
  const pluginConnectionTipText = `插件连接状态：${pluginConnectionState}`;
  const getApiStatusClassName = (value) => {
    if (value === "connected") return "is-connected";
    if (value === "ok") return "is-ok";
    if (value === "error") return "is-error";
    return "is-warn";
  };
  const getApiStatusTip = (apiName, state, issueText) => {
    if (state === "ok") return issueText ? `${apiName} 请求成功：${issueText}` : `${apiName} 请求成功`;
    if (state === "connected") return issueText ? `${apiName} 服务器连接成功：${issueText}` : `${apiName} 服务器连接成功`;
    if (state === "error") return `${apiName} 连接失败：${issueText || "请检查配置或网络"}`;
    return `${apiName} 验证中或待验证`;
  };
  useEffect(() => {
    if (!window.shell || typeof window.shell.setFloatingToggleEnabled !== "function") return;
    window.shell.setFloatingToggleEnabled(floatingToggleEnabled).catch(() => {});
  }, [floatingToggleEnabled]);
  useEffect(() => {
    if (!window.shell || typeof window.shell.setAutoMinimizeOnBlur !== "function") return;
    window.shell.setAutoMinimizeOnBlur(autoMinimizeOnBlur).catch(() => {});
  }, [autoMinimizeOnBlur]);
  useEffect(() => {
    if (!window.shell || typeof window.shell.setFloatingToggleOpacity !== "function") return undefined;
    if (floatingOpacitySyncTimerRef.current) {
      clearTimeout(floatingOpacitySyncTimerRef.current);
      floatingOpacitySyncTimerRef.current = null;
    }
    const nextOpacity = clampFloatingToggleOpacity(floatingToggleOpacity);
    floatingOpacitySyncTimerRef.current = setTimeout(() => {
      window.shell.setFloatingToggleOpacity(nextOpacity).catch(() => {});
      floatingOpacitySyncTimerRef.current = null;
    }, 28);
    return () => {
      if (floatingOpacitySyncTimerRef.current) {
        clearTimeout(floatingOpacitySyncTimerRef.current);
        floatingOpacitySyncTimerRef.current = null;
      }
    };
  }, [floatingToggleOpacity]);
  useEffect(() => {
    if (!window.shell) return undefined;
    let alive = true;
    const applyRemoteState = (payload) => {
      if (!alive || !payload || typeof payload !== "object") return;
      if (typeof payload.opacity === "number") {
        const nextOpacity = clampFloatingToggleOpacity(payload.opacity);
        setFloatingToggleOpacity((prev) => (Math.abs(prev - nextOpacity) < 0.0001 ? prev : nextOpacity));
      }
    };
    if (typeof window.shell.getFloatingToggleState === "function") {
      window.shell.getFloatingToggleState().then(applyRemoteState).catch(() => {});
    }
    if (typeof window.shell.onFloatingToggleState !== "function") return () => {
      alive = false;
    };
    const off = window.shell.onFloatingToggleState(applyRemoteState);
    return () => {
      alive = false;
      if (typeof off === "function") off();
    };
  }, []);
  useEffect(() => {
    if (!window.shell || typeof window.shell.updateFloatingToggleStatus !== "function") return;
    window.shell.updateFloatingToggleStatus(miniConsoleState.level || "warn").catch(() => {});
  }, [miniConsoleState.level]);
  useEffect(() => {
    let alive = true;
    const loadCachePolicy = async () => {
      if (!window.shell || typeof window.shell.cachePolicyGet !== "function") return;
      try {
        const result = await window.shell.cachePolicyGet();
        if (!alive || !result?.ok) return;
        const policy = sanitizeCachePolicy(result?.policy || DEFAULT_CACHE_POLICY);
        setCachePolicy((prev) => (isCachePolicyEqual(prev, policy) ? prev : policy));
        if (result?.stats?.ok) {
          setCacheStats(normalizeCacheStats(result.stats));
        }
      } catch {
        // ignore
      }
    };
    loadCachePolicy();
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (view !== "settings") return undefined;
    let alive = true;
    const pullStats = async () => {
      if (!window.shell || typeof window.shell.cacheStatsGet !== "function") return;
      try {
        const result = await window.shell.cacheStatsGet();
        if (!alive || !result?.ok) return;
        setCacheStats(normalizeCacheStats(result));
      } catch {
        // ignore
      }
    };
    pullStats();
    const timer = setInterval(() => {
      pullStats();
    }, 30000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [view]);
  useEffect(() => () => {
    if (cachePolicyApplyTimerRef.current) {
      clearTimeout(cachePolicyApplyTimerRef.current);
      cachePolicyApplyTimerRef.current = null;
    }
  }, []);
  const handleApiStatusClick = async (type) => {
    const isChatApi = type === "chat";
    const apiName = isChatApi ? "聊天 API" : "跑图 API";
    const result = await verifyApiConnectivity(isChatApi ? "chat" : "image", {
      silent: false,
      reason: "手动点击验证",
      logResult: true
    });
    if (result?.ok) return;
    window.alert(`${apiName} 连接失败：${result?.message || "请检查配置或网络"}`);
  };

  const handleMinimize = () => {
    if (window.shell && typeof window.shell.minimize === "function") {
      window.shell.minimize();
    }
  };

  const handleToggleAutoMinimizeOnBlur = () => {
    setAutoMinimizeOnBlur((prev) => !prev);
  };

  const handleClose = () => {
    if (window.shell && typeof window.shell.close === "function") {
      window.shell.close();
    }
  };

  const handlePin = () => {
    const next = !alwaysOnTop;
    setAlwaysOnTop(next);
  };
  useEffect(() => {
    if (window.shell && typeof window.shell.setAlwaysOnTop === "function") {
      window.shell.setAlwaysOnTop(alwaysOnTop);
    }
  }, [alwaysOnTop]);

  const handleTogglePreview = async () => {
    if (previewToggleBusyRef.current) return;
    previewToggleBusyRef.current = true;
    const nextCollapsed = !previewCollapsed;
    suppressResizeFreezeFor(720);
    freezeAdaptiveLayout();
    try {
      const canResize = !!(window.shell && typeof window.shell.adjustWindowSize === "function");
      const deltaAbs = Math.round((PREVIEW_CARD_H + PREVIEW_GAP) * uiScale);
      const delta = nextCollapsed ? -deltaAbs : deltaAbs;
      if (!nextCollapsed) {
        if (canResize && delta !== 0) {
          try {
            await window.shell.adjustWindowSize(0, delta);
          } catch {
            // continue; fallback to state switch
          }
        }
        await nextFrame();
        setPreviewCollapsed(false);
      } else {
        setPreviewCollapsed(true);
        await nextFrame();
        if (canResize && delta !== 0) {
          const currentMin = lastMinSizeRef.current;
          const nextMinH = Math.max(0, Math.round((currentMin?.minHeight || 0) + delta));
          if (nextMinH > 0 && typeof window.shell.setWindowMinSize === "function") {
            try {
              await window.shell.setWindowMinSize(currentMin?.minWidth || 0, nextMinH);
            } catch {
              // ignore and continue best-effort resize
            }
          }
          try {
            await window.shell.adjustWindowSize(0, delta);
          } catch {
            // continue; fallback to state switch
          }
        }
      }
      pendingMeasureAfterFreezeRef.current = true;
      await waitFrames(2);
    } finally {
      suppressResizeFreezeFor(220);
      unfreezeAdaptiveLayout();
      previewToggleBusyRef.current = false;
    }
  };

  const calcFloatingPanelPosition = (anchorRect, panelWidth, panelHeight, options = {}) => {
    const viewportPadding = Number.isFinite(options.viewportPadding) ? options.viewportPadding : 8;
    const gap = Number.isFinite(options.gap) ? options.gap : 6;
    const viewportWidth = Math.round(window.visualViewport?.width || window.innerWidth || document.documentElement.clientWidth || 360);
    const viewportHeight = Math.round(window.visualViewport?.height || window.innerHeight || document.documentElement.clientHeight || 640);
    const minWidth = Number.isFinite(options.minWidth) ? options.minWidth : 24;
    const minHeight = Number.isFinite(options.minHeight) ? options.minHeight : 24;
    const viewportMaxWidth = Math.max(minWidth, viewportWidth - (viewportPadding * 2));
    const viewportMaxHeight = Math.max(minHeight, viewportHeight - (viewportPadding * 2));
    const configuredMaxWidth = Number.isFinite(options.maxWidth) ? Math.round(options.maxWidth) : viewportMaxWidth;
    const configuredMaxHeight = Number.isFinite(options.maxHeight) ? Math.round(options.maxHeight) : viewportMaxHeight;
    const maxWidth = Math.max(minWidth, Math.min(viewportMaxWidth, configuredMaxWidth));
    const maxHeight = Math.max(minHeight, Math.min(viewportMaxHeight, configuredMaxHeight));
    const width = Math.min(maxWidth, Math.max(minWidth, Math.round(panelWidth || 0)));
    const height = Math.min(maxHeight, Math.max(minHeight, Math.round(panelHeight || 0)));
    const mode = options.mode || "auto";
    const preferY = options.preferY || "bottom";
    const anchorLeft = Math.round(anchorRect?.left || 0);
    const anchorWidth = Math.max(0, Math.round(anchorRect?.width || 0));
    const anchorRight = Math.round(Number(anchorRect?.right) || (anchorLeft + anchorWidth));
    const anchorCenter = anchorLeft + (anchorWidth / 2);
    let left = anchorLeft;
    if (mode === "auto") {
      left = anchorCenter >= (viewportWidth / 2)
        ? Math.round(anchorRight - width)
        : anchorLeft;
    } else if (mode === "edge") {
      const center = anchorCenter;
      left = center < viewportWidth / 2
        ? viewportPadding
        : viewportWidth - viewportPadding - width;
    } else if (mode === "center") {
      left = Math.round(anchorLeft + ((anchorWidth - width) / 2));
    } else if (mode === "end") {
      left = Math.round(anchorRight - width);
    } else {
      left = anchorLeft;
    }
    left = Math.max(viewportPadding, Math.min(viewportWidth - viewportPadding - width, left));
    const roomBottom = (viewportHeight - viewportPadding) - ((anchorRect?.bottom || 0) + gap);
    const roomTop = ((anchorRect?.top || 0) - gap) - viewportPadding;
    const preferTop = preferY === "top";
    const placeTop = preferTop
      ? !(roomTop < height && roomBottom > roomTop)
      : (roomBottom < height && roomTop > roomBottom);
    let top = placeTop
      ? Math.round((anchorRect?.top || 0) - height - gap)
      : Math.round((anchorRect?.bottom || 0) + gap);
    top = Math.max(viewportPadding, Math.min(viewportHeight - viewportPadding - height, top));
    return { top, left, width, height, placement: placeTop ? "top" : "bottom" };
  };

  const resolveFloatingPanelPosition = (anchorEl, panelEl, options = {}) => {
    if (!anchorEl || typeof anchorEl.getBoundingClientRect !== "function") return null;
    const anchorRect = anchorEl.getBoundingClientRect();
    const panelRect = panelEl?.getBoundingClientRect?.() || null;
    const fallbackWidth = Number.isFinite(options.fallbackWidth)
      ? options.fallbackWidth
      : (anchorRect?.width || 0);
    const fallbackHeight = Number.isFinite(options.fallbackHeight)
      ? options.fallbackHeight
      : 48;
    const desiredWidth = Math.max(1, Math.round(panelRect?.width || fallbackWidth || 0));
    const desiredHeight = Math.max(1, Math.round(panelRect?.height || fallbackHeight || 0));
    return calcFloatingPanelPosition(anchorRect, desiredWidth, desiredHeight, options);
  };

  const sameFloatingValue = (left, right) => {
    if (typeof left === "number" || typeof right === "number") {
      const a = Number(left);
      const b = Number(right);
      if (Number.isFinite(a) && Number.isFinite(b)) return Math.round(a) === Math.round(b);
    }
    return left === right;
  };

  const isFloatingPatchEqual = (prev, patch, keys) => (
    Array.isArray(keys) && keys.length
      ? keys.every((key) => sameFloatingValue(prev?.[key], patch?.[key]))
      : false
  );

  const mergeFloatingPatch = (prev, patch, keys) => (
    isFloatingPatchEqual(prev, patch, keys) ? prev : { ...prev, ...patch }
  );

  const replaceFloatingIfChanged = (prev, next, keys) => (
    isFloatingPatchEqual(prev, next, keys) ? prev : next
  );

  const normalizeGenerationImageSize = (rawValue) => {
    const value = String(rawValue || "").trim().toLowerCase();
    if (!value) return defaultImageConfig.generationImageSize;
    if (IMAGE_SIZE_OPTIONS.some((item) => item.value === value)) return value;
    if (value.includes("1024") || value === "1k") return "1k";
    if (value.includes("2048") || value === "2k") return "2k";
    if (value.includes("4096") || value === "4k") return "4k";
    return defaultImageConfig.generationImageSize;
  };

  const toGenerationImageSizeApiValue = (normalizedValue) => {
    const matched = IMAGE_SIZE_OPTIONS.find((item) => item.value === normalizedValue);
    return matched?.apiValue || IMAGE_SIZE_OPTIONS[0].apiValue;
  };

  const normalizeTargetSelection = (input) => {
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
  };

  const normalizeTargetRect = (input) => normalizeTargetSelection(input);

  const normalizeTargetCanvas = (input) => {
    if (!input || typeof input !== "object") return null;
    const width = Number(input.width);
    const height = Number(input.height);
    if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
    return {
      width: Math.max(1, Math.round(width)),
      height: Math.max(1, Math.round(height))
    };
  };

  const normalizeTargetRectNorm = (input) => {
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
  };

  const deriveTargetRectNorm = (targetRect, targetCanvas) => {
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
  };

  const normalizeTargetDocumentId = (input) => {
    const value = Number(input);
    if (!Number.isFinite(value)) return null;
    const safeValue = Math.round(value);
    return safeValue > 0 ? safeValue : null;
  };

  const resolveImageTarget = (imageItem) => {
    const targetRect = normalizeTargetRect(
      imageItem?.targetRect
      || imageItem?.meta?.targetRect
    );
    const targetCanvas = normalizeTargetCanvas(
      imageItem?.targetCanvas
      || imageItem?.meta?.targetCanvas
    );
    const targetRectNorm = normalizeTargetRectNorm(
      imageItem?.targetRectNorm
      || imageItem?.meta?.targetRectNorm
      || deriveTargetRectNorm(targetRect, targetCanvas)
    );
    const targetDocumentId = normalizeTargetDocumentId(
      imageItem?.targetDocumentId ?? imageItem?.documentId ?? imageItem?.meta?.documentId
    );
    const targetDocumentName = String(
      imageItem?.targetDocumentName
      || imageItem?.documentName
      || imageItem?.meta?.documentName
      || ""
    ).trim();
    return {
      targetRect,
      targetRectNorm,
      targetCanvas,
      targetDocumentId,
      targetDocumentName
    };
  };

  const pickTargetFromImages = (images) => {
    const list = Array.isArray(images) ? images : [];
    for (const item of list) {
      const hit = resolveImageTarget(item);
      if (hit.targetRect || hit.targetDocumentId) return hit;
    }
    return {
      targetRect: null,
      targetRectNorm: null,
      targetCanvas: null,
      targetDocumentId: null,
      targetDocumentName: ""
    };
  };

  const normalizeImportOpenDocument = (item, index = 0) => {
    const id = normalizeTargetDocumentId(item?.id);
    if (!id) return null;
    const name = String(item?.name || "").trim() || `画布 ${index + 1}`;
    return {
      id,
      name,
      isActive: !!item?.isActive
    };
  };

  const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("图片读取失败"));
      reader.readAsDataURL(blob);
    } catch (err) {
      reject(err);
    }
  });

  const ensureImageDataUrl = async (input) => {
    const raw = String(input || "").trim();
    if (!raw) return "";
    if (/^data:image\//i.test(raw)) return raw;
    if (!/^https?:\/\//i.test(raw)) return "";
    const res = await fetch(raw);
    if (!res.ok) throw new Error(`下载图片失败：HTTP ${res.status}`);
    const blob = await res.blob();
    const dataUrl = await blobToDataUrl(blob);
    return /^data:image\//i.test(dataUrl) ? dataUrl : "";
  };

  function compactGeneratedPreviewInlineData(list, keepIndex = 0) {
    const source = Array.isArray(list) ? list : [];
    const keep = Number.isFinite(keepIndex) ? Math.max(0, Math.floor(keepIndex)) : 0;
    let changed = false;
    const next = source.map((item, idx) => {
      if (!item || typeof item !== "object") return item;
      const hasCacheRef = !!String(item.cacheFilePath || item.cacheFileName || "").trim();
      const hasInline = /^data:image\//i.test(String(item.dataUrl || "").trim());
      if (!hasCacheRef || !hasInline || idx === keep) return item;
      changed = true;
      return { ...item, dataUrl: "" };
    });
    return changed ? next : source;
  }

  async function readGeneratedPreviewDataUrlFromCache(item) {
    if (!item || typeof item !== "object") return "";
    const inline = String(item.dataUrl || "").trim();
    if (/^data:image\//i.test(inline)) return inline;
    if (typeof window.shell?.generatedCacheRead !== "function") return "";
    try {
      const result = await window.shell.generatedCacheRead({
        filePath: String(item.cacheFilePath || "").trim(),
        fileName: String(item.cacheFileName || "").trim()
      });
      const dataUrl = String(result?.dataUrl || "").trim();
      return /^data:image\//i.test(dataUrl) ? dataUrl : "";
    } catch {
      return "";
    }
  }

  async function hydrateGeneratedPreviewImageAt(index) {
    const idx = Number.isFinite(index) ? Math.max(0, Math.floor(index)) : 0;
    const list = generatedPreviewImagesRef.current;
    if (!Array.isArray(list) || !list[idx]) return "";
    const item = list[idx];
    const inline = String(item?.dataUrl || "").trim();
    if (/^data:image\//i.test(inline)) {
      setGeneratedPreviewImages((prev) => compactGeneratedPreviewInlineData(prev, idx));
      return inline;
    }
    const inFlightKey = String(item?.cacheFilePath || item?.cacheFileName || item?.id || idx);
    if (!inFlightKey || generatedPreviewHydrationInFlightRef.current.has(inFlightKey)) return "";
    generatedPreviewHydrationInFlightRef.current.add(inFlightKey);
    try {
      const dataUrl = await readGeneratedPreviewDataUrlFromCache(item);
      if (!/^data:image\//i.test(dataUrl)) return "";
      setGeneratedPreviewImages((prev) => {
        if (!Array.isArray(prev) || !prev[idx]) return prev;
        const current = String(prev[idx]?.dataUrl || "").trim();
        const changed = current !== dataUrl;
        const next = prev.map((entry, entryIdx) => {
          if (!entry || typeof entry !== "object") return entry;
          if (entryIdx === idx) {
            return changed
              ? {
                  ...entry,
                  dataUrl,
                  type: String(entry.type || item?.type || "image/png")
                }
              : entry;
          }
          const hasCacheRef = !!String(entry.cacheFilePath || entry.cacheFileName || "").trim();
          const hasInline = /^data:image\//i.test(String(entry.dataUrl || "").trim());
          if (!hasCacheRef || !hasInline) return entry;
          return { ...entry, dataUrl: "" };
        });
        return next;
      });
      return dataUrl;
    } finally {
      generatedPreviewHydrationInFlightRef.current.delete(inFlightKey);
    }
  }

  const cacheGeneratedPreviewImages = async (images) => {
    const list = Array.isArray(images) ? images : [];
    if (!list.length) return list;
    const putGeneratedCache = window.shell?.generatedCachePut;
    if (typeof putGeneratedCache !== "function") return list;
    try {
      const payload = list
        .map((item, idx) => {
          const source = String(item?.dataUrl || "").trim();
          if (!source) return null;
          const targetMeta = resolveImageTarget(item);
          return {
            clientRef: item.id || `gen-${idx + 1}`,
            name: item.name || `生成图_${idx + 1}`,
            type: item.type || "",
            dataUrl: source,
            targetMeta: {
              targetRect: targetMeta.targetRect || null,
              targetRectNorm: targetMeta.targetRectNorm || null,
              targetCanvas: targetMeta.targetCanvas || null,
              targetDocumentId: targetMeta.targetDocumentId || null,
              targetDocumentName: targetMeta.targetDocumentName || ""
            }
          };
        })
        .filter(Boolean);
      if (!payload.length) return list;
      const result = await putGeneratedCache({
        maxFiles: 120,
        items: payload
      });
      if (!result?.ok) return list;
      const mapped = new Map(
        Array.isArray(result?.items)
          ? result.items
              .map((item) => [String(item?.clientRef || ""), item])
              .filter(([key]) => !!key)
          : []
      );
      return list.map((item, idx) => {
        const key = String(item?.id || `gen-${idx + 1}`);
        const hit = mapped.get(key);
        if (!hit) return item;
        return {
          ...item,
          cacheFilePath: String(hit.filePath || ""),
          cacheFileName: String(hit.fileName || ""),
          targetMetaFilePath: String(hit.targetMetaFilePath || ""),
          targetMetaFileName: String(hit.targetMetaFileName || "")
        };
      });
    } catch {
      return list;
    }
  };

  const stepPreviewImage = (delta) => {
    const total = Array.isArray(generatedPreviewImages) ? generatedPreviewImages.length : 0;
    if (total < 2) return;
    const step = Number.isFinite(delta) ? Math.trunc(delta) : 0;
    if (!step) return;
    setPreviewImageIndex((prev) => {
      const base = Number.isFinite(prev) ? prev : 0;
      return (base + step + total) % total;
    });
  };

  const resolveImportTargetDialog = (result = { confirmed: false }) => {
    const resolver = importTargetDialogResolverRef.current;
    importTargetDialogResolverRef.current = null;
    setImportTargetDialog((prev) => ({ ...prev, open: false }));
    if (typeof resolver === "function") resolver(result);
  };

  const requestImportTargetDialog = (payload = {}) => {
    const requestedDocumentId = normalizeTargetDocumentId(
      payload?.requestedDocumentId ?? payload?.targetDocumentId
    );
    const requestedDocumentName = String(
      payload?.requestedDocumentName
      || payload?.targetDocumentName
      || ""
    ).trim();
    const activeDocumentId = normalizeTargetDocumentId(payload?.activeDocumentId);
    const activeDocumentName = String(payload?.activeDocumentName || "").trim();
    const openDocuments = Array.isArray(payload?.openDocuments)
      ? payload.openDocuments
          .map((item, index) => normalizeImportOpenDocument(item, index))
          .filter(Boolean)
      : [];
    const selectedDocumentId = (
      (requestedDocumentId && openDocuments.some((doc) => doc.id === requestedDocumentId) && requestedDocumentId)
      || (activeDocumentId && openDocuments.some((doc) => doc.id === activeDocumentId) && activeDocumentId)
      || (openDocuments[0]?.id || null)
    );
    const errorCode = String(payload?.errorCode || "").trim();
    const message = String(payload?.message || "").trim();
    const defaultText = errorCode === "target_document_required"
      ? "未检测到记录画布，且当前已打开多个画布。请选择导入目标。"
      : "没有找到记录的画布。是否继续导入到已打开画布？";
    return new Promise((resolve) => {
      if (typeof importTargetDialogResolverRef.current === "function") {
        importTargetDialogResolverRef.current({ confirmed: false, reason: "overridden" });
      }
      importTargetDialogResolverRef.current = resolve;
      setImportTargetDialog({
        open: true,
        errorCode,
        message: message || defaultText,
        requestedDocumentId: requestedDocumentId || null,
        requestedDocumentName,
        activeDocumentId: activeDocumentId || null,
        activeDocumentName,
        openDocuments,
        selectedDocumentId
      });
    });
  };

  const handleImportTargetDialogCancel = () => {
    resolveImportTargetDialog({ confirmed: false, reason: "cancel" });
  };

  const handleImportTargetDialogConfirm = () => {
    const selected = importTargetDialog.openDocuments.find(
      (doc) => doc.id === importTargetDialog.selectedDocumentId
    );
    resolveImportTargetDialog({
      confirmed: true,
      documentId: selected?.id || null,
      documentName: selected?.name || ""
    });
  };

  const handleImportTargetDialogSelect = (documentId) => {
    const nextId = normalizeTargetDocumentId(documentId);
    if (!nextId) return;
    setImportTargetDialog((prev) => ({ ...prev, selectedDocumentId: nextId }));
  };

  const handleOverflowWheelScroll = (event) => {
    const el = event?.currentTarget;
    if (!el) return;
    const max = Math.max(0, (Number(el.scrollWidth) || 0) - (Number(el.clientWidth) || 0));
    if (max < 2) return;
    const deltaX = Number(event?.deltaX) || 0;
    const deltaY = Number(event?.deltaY) || 0;
    const delta = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY;
    if (!delta) return;
    event.preventDefault();
    const next = Math.max(0, Math.min(max, (Number(el.scrollLeft) || 0) + delta));
    el.scrollLeft = next;
  };

  const exportImageToCanvas = async (imageItem, options = {}) => {
    const exportStartedAt = Date.now();
    const bridge = window.shell?.importImageToPs;
    if (typeof bridge !== "function") {
      appendLog("warn", "导出到画布接口未就绪", "bridge");
      setMiniConsole("回传失败", "error", "导出接口未就绪。请打开大控制台查看修复指引。");
      return { ok: false, message: "bridge_unavailable" };
    }
    if (exportToCanvasBusyRef.current) {
      if (options?.trigger === "manual") {
        appendLog("warn", "导出进行中，请稍候", "bridge");
      }
      return { ok: false, message: "busy" };
    }
    let sourceUrl = String(imageItem?.dataUrl || "").trim();
    if (!sourceUrl) {
      sourceUrl = await readGeneratedPreviewDataUrlFromCache(imageItem);
    }
    if (!sourceUrl) {
      appendLog("warn", "没有可导出的预览图", "bridge");
      return { ok: false, message: "empty_image" };
    }
    appendTraceLog({
      level: "info",
      type: "bridge",
      domain: "回传画布",
      phase: "发送",
      message: `开始回传图片到 Ps（触发 ${options?.trigger === "auto" ? "自动" : "手动"}）。`,
      startedAt: exportStartedAt
    });
    setMiniConsole("回传发送中", "busy", "正在回传图片到 Ps。");
    exportToCanvasBusyRef.current = true;
    try {
      const dataUrl = await ensureImageDataUrl(sourceUrl);
      if (!dataUrl) {
        appendLog("warn", "当前图片不是可回传的 base64 图像", "bridge");
        setMiniConsole("回传失败", "error", "图片格式不可回传。请查看大控制台修复指引。");
        return { ok: false, message: "unsupported_image_format" };
      }
      const layerType = importLayerType === "rasterized" ? "rasterized" : "smart-object";
      const layerTypeLabel = layerType === "rasterized" ? "栅格化" : "智能对象";
      const imageTarget = resolveImageTarget(imageItem);
      const targetRect = normalizeTargetRect(options?.targetRect) || imageTarget.targetRect;
      const targetCanvas = normalizeTargetCanvas(options?.targetCanvas) || imageTarget.targetCanvas;
      const targetRectNorm = normalizeTargetRectNorm(options?.targetRectNorm)
        || imageTarget.targetRectNorm
        || deriveTargetRectNorm(targetRect, targetCanvas);
      const targetDocumentId = normalizeTargetDocumentId(options?.targetDocumentId) || imageTarget.targetDocumentId;
      const targetDocumentName = String(
        options?.targetDocumentName
        || imageTarget.targetDocumentName
        || ""
      ).trim();
      let bridgePayload = {
        dataUrl,
        targetRect,
        targetRectNorm,
        targetCanvas,
        targetDocumentId,
        targetDocumentName,
        layerType
      };
      let result = await bridge(bridgePayload);
      let resolvedByDialog = false;
      while (!result?.ok) {
        const resultPayload = result?.result && typeof result.result === "object" ? result.result : {};
        const errorCode = String(result?.errorCode || resultPayload?.errorCode || "").trim();
        const canResolveByDialog = errorCode === "target_document_not_found" || errorCode === "target_document_required";
        if (!canResolveByDialog || resolvedByDialog) break;
        const nextTarget = await requestImportTargetDialog({
          errorCode,
          message: resultPayload?.message || result?.message || "",
          requestedDocumentId: resultPayload?.requestedDocumentId ?? targetDocumentId,
          requestedDocumentName: resultPayload?.requestedDocumentName || targetDocumentName,
          activeDocumentId: resultPayload?.activeDocumentId,
          activeDocumentName: resultPayload?.activeDocumentName,
          openDocuments: resultPayload?.openDocuments
        });
        if (!nextTarget?.confirmed) {
          appendTraceLog({
            level: "warn",
            type: "bridge",
            domain: "回传画布",
            phase: "取消",
            message: "导入已取消（未选择目标画布）",
            startedAt: exportStartedAt,
            endedAt: Date.now()
          });
          setMiniConsole("回传已取消", "warn", "已取消导入到画布。");
          return { ok: false, message: "import_target_selection_cancelled" };
        }
        bridgePayload = {
          ...bridgePayload,
          targetDocumentId: normalizeTargetDocumentId(nextTarget.documentId),
          targetDocumentName: String(nextTarget.documentName || "").trim()
        };
        resolvedByDialog = true;
        result = await bridge(bridgePayload);
      }
      if (!result?.ok) {
        const msg = String(result?.message || "导出失败");
        appendTraceLog({
          level: "warn",
          type: "bridge",
          domain: "回传画布",
          phase: "错误",
          message: `导出到画布失败：${msg}`,
          startedAt: exportStartedAt,
          endedAt: Date.now(),
          requestId: extractRequestId(msg),
          guide: getFixGuideForError(msg, "bridge")
        });
        setMiniConsole("回传失败", "error", "回传失败。请打开大控制台查看修复指引。");
        return { ok: false, message: msg };
      }
      const prefix = options?.trigger === "auto" ? "已自动导出到画布" : "已导出到画布";
      appendTraceLog({
        level: "info",
        type: "bridge",
        domain: "回传画布",
        phase: "完成",
        message: `${prefix}（${layerTypeLabel}）`,
        startedAt: exportStartedAt,
        endedAt: Date.now()
      });
      setMiniConsole("回传已完成", "ok", "已回传到 Ps 画布。");
      return { ok: true };
    } catch (err) {
      const raw = String(err?.message || err || "回传失败");
      appendTraceLog({
        level: "warn",
        type: "bridge",
        domain: "回传画布",
        phase: "错误",
        message: `导出到画布失败：${raw}`,
        startedAt: exportStartedAt,
        endedAt: Date.now(),
        requestId: extractRequestId(raw),
        guide: getFixGuideForError(raw, "bridge")
      });
      setMiniConsole("回传失败", "error", "回传失败。请打开大控制台查看修复指引。");
      return { ok: false, message: raw };
    } finally {
      exportToCanvasBusyRef.current = false;
    }
  };

  const handleExportPreviewToCanvas = async (options = {}) => {
    const list = Array.isArray(generatedPreviewImages) ? generatedPreviewImages : [];
    const safeIndex = Number.isFinite(previewImageIndex) ? Math.max(0, Math.floor(previewImageIndex)) : 0;
    const primary = list[safeIndex] || list[0];
    if (!primary?.dataUrl) {
      appendLog("warn", "当前没有可导出的预览图", "bridge");
      return;
    }
    const previewTarget = resolveImageTarget(primary);
    const fallbackTarget = pickTargetFromImages(uploadImagesRef.current);
    await exportImageToCanvas(primary, {
      trigger: options?.trigger || "manual",
      targetRect: options?.targetRect
        ?? previewTarget.targetRect
        ?? fallbackTarget.targetRect,
      targetRectNorm: options?.targetRectNorm
        ?? previewTarget.targetRectNorm
        ?? fallbackTarget.targetRectNorm,
      targetCanvas: options?.targetCanvas
        ?? previewTarget.targetCanvas
        ?? fallbackTarget.targetCanvas,
      targetDocumentId: options?.targetDocumentId ?? previewTarget.targetDocumentId ?? fallbackTarget.targetDocumentId
    });
  };

  const getPrevUserImagesForAssistant = (assistantMessageId) => {
    const targetId = String(assistantMessageId || "").trim();
    if (!targetId) return [];
    const list = Array.isArray(messages) ? messages : [];
    const assistantIndex = list.findIndex((item) => item?.id === targetId && item?.role === "assistant");
    if (assistantIndex < 1) return [];
    for (let i = assistantIndex - 1; i >= 0; i -= 1) {
      const item = list[i];
      if (item?.role !== "user") continue;
      const images = Array.isArray(item.images) ? item.images : [];
      return images;
    }
    return [];
  };

  const hydrateRunTaskImagesFromPsCache = async (images) => {
    const list = Array.isArray(images) ? images : [];
    if (!list.length) return list;
    const getPsCache = window.shell?.psCacheGet;
    if (typeof getPsCache !== "function") return list;

    let changed = false;
    const hydrated = [...list];
    for (let idx = 0; idx < hydrated.length; idx += 1) {
      const item = hydrated[idx];
      if (!item || typeof item !== "object") continue;
      const inlineDataUrl = String(item?.dataUrl || "").trim();
      if (inlineDataUrl.startsWith("data:image/")) continue;
      const cacheId = String(item?.psCacheId || item?.cacheId || "").trim();
      if (!cacheId) continue;
      try {
        const result = await getPsCache(cacheId);
        const cached = result?.item && typeof result.item === "object" ? result.item : null;
        const cachedDataUrl = String(cached?.dataUrl || "").trim();
        if (!cachedDataUrl.startsWith("data:image/")) continue;
        changed = true;
        hydrated[idx] = {
          ...item,
          dataUrl: cachedDataUrl,
          type: String(item?.type || cached?.type || ""),
          name: String(item?.name || cached?.name || item?.originName || "image"),
          originName: String(item?.originName || cached?.originName || cached?.name || item?.name || "image"),
          source: String(item?.source || cached?.source || "local"),
          role: String(item?.role || cached?.role || ""),
          slotIndex: Number.isFinite(item?.slotIndex)
            ? Number(item.slotIndex)
            : (Number.isFinite(cached?.slotIndex) ? Number(cached.slotIndex) : undefined)
        };
      } catch {
        // Ignore single cache read failures and continue best-effort hydration.
      }
    }
    return changed ? hydrated : list;
  };

  const executeImageRunTask = async (options = {}) => {
    const promptText = String(options?.promptText ?? jsonPromptText ?? "").trim();
    if (!promptText) {
      appendLog("warn", "当前没有可跑图的 JSON 提示词", "api");
      setMiniConsole("跑图失败", "error", "缺少 JSON 提示词，无法跑图。");
      return;
    }

    const cfg = {
      baseUrl: String(imageConfig?.baseUrl || "").trim(),
      apiKey: String(imageConfig?.apiKey || "").trim(),
      model: String(imageConfig?.model || "").trim(),
      timeoutMs: Math.max(5000, Number(imageConfig?.timeoutMs) || defaultImageConfig.timeoutMs),
      providerMode: imageConfig?.providerMode
    };
    const imageCfgErrors = validateImageApiConfig(cfg);
    if (imageCfgErrors.length) {
      const issue = imageCfgErrors[0];
      setImageApiStatus("error");
      setImageApiIssueText(issue);
      appendLog("warn", `跑图前校验失败：${issue}`, "api");
      setMiniConsole("跑图失败", "error", "跑图前校验失败。请打开大控制台查看修复指引。");
      return;
    }

    const imageSiteKeyNow = imageProviderKey;
    const providerMode = normalizeImageProviderModeBySiteKey(imageSiteKeyNow, cfg.providerMode);
    const imageSource = String(options?.imageSource || "upload");
    let sourceImages = Array.isArray(options?.images) ? options.images : uploadImagesRef.current;
    if (imageSource === "assistant-prev-user") {
      sourceImages = getPrevUserImagesForAssistant(options?.assistantMessageId);
      if (!Array.isArray(sourceImages) || !sourceImages.length) {
        appendLog("warn", "未找到该条回复前一条用户图片，将仅用提示词跑图", "api");
      }
    }
    if (Array.isArray(sourceImages) && sourceImages.length) {
      sourceImages = await hydrateRunTaskImagesFromPsCache(sourceImages);
    }
    let sendImages = enrichImagesForSend(sourceImages, { withImageModel: true });
    let runTargets = sendImages.map((item) => resolveImageTarget(item));
    const getRunTargetByIndex = (index = 0) => {
      if (!runTargets.length) return {
        targetRect: null,
        targetRectNorm: null,
        targetCanvas: null,
        targetDocumentId: null,
        targetDocumentName: ""
      };
      const safeIndex = Number.isFinite(index) ? Math.max(0, Math.floor(index)) : 0;
      return runTargets[safeIndex % runTargets.length] || runTargets[0];
    };
    const registerRemoteCancelContext = (taskId) => {
      const normalizedId = String(taskId || "").trim();
      if (!normalizedId) return;
      imageRunRemoteCancelContextRef.current = {
        providerKey: imageSiteKeyNow,
        providerMode,
        baseUrl: cfg.baseUrl,
        apiKey: cfg.apiKey,
        taskId: normalizedId
      };
    };
    const promptWithRunHints = [
      promptText,
      `生成参数：分辨率=${generationImageSizeApiValue}，比例=${generationAspectRatio}，数量=x${generationCount}`
    ].filter(Boolean).join("\n\n");
    let sharedGrsaiUrls = sendImages
      .map((item) => toImageUrlOrBase64ForGrsai(item))
      .filter(Boolean);
    let sharedGoogleParts = (() => {
      const parts = [{ text: promptWithRunHints }];
      sendImages.forEach((item) => {
        const matched = String(item?.dataUrl || "").match(/^data:([^;,]+);base64,([\s\S]+)$/i);
        if (!matched) return;
        parts.push({
          inlineData: {
            mimeType: matched[1] || "image/png",
            data: matched[2] || ""
          }
        });
      });
      return parts;
    })();
    let sharedOpenAIUserContent = buildUserContent(promptWithRunHints, sendImages);
    const imageSourceLabel = imageSource === "assistant-prev-user" ? "对话图片" : "上传区图片";
    const runRequestStartedAt = Date.now();

    setIsImageGenerating(true);
    setImageApiIssueText("");
    setImageApiStatus((prev) => {
      if (prev === "ok" || prev === "connected") return prev;
      return "warn";
    });
    appendTraceLog({
      level: "info",
      type: "api",
      domain: "跑图请求",
      phase: "发送",
      message: `来源 ${imageSourceLabel}，模型 ${cfg.model}，分辨率 ${generationImageSizeLabel} -> ${generationImageSizeApiValue}，比例 ${generationAspectRatio}，数量 x${generationCount}，参考图 ${sendImages.length} 张。`,
      startedAt: runRequestStartedAt
    });
    setMiniConsole("跑图发送中", "busy", "跑图任务已发送，等待服务端返回。");

    const controller = new AbortController();
    imageRunAbortControllerRef.current = controller;
    imageRunAbortReasonRef.current = "";
    imageRunRemoteCancelContextRef.current = null;
    const timeoutId = setTimeout(() => {
      imageRunAbortReasonRef.current = "timeout";
      controller.abort();
    }, cfg.timeoutMs);
    try {
      const requestRunOnce = async (requestCount = 1) => {
        const effectiveCount = Math.max(1, Number(requestCount) || 1);
        let parsed = { images: [], text: "" };
        if (imageSiteKeyNow === "grsai" && providerMode !== "google-native") {
          const grsaiBase = normalizeBaseForOption(cfg.baseUrl);
          const drawEndpoint = `${grsaiBase}/v1/draw/nano-banana`;
          const resultEndpoint = `${grsaiBase}/v1/draw/result`;
          const drawPayload = {
            model: cfg.model,
            prompt: promptText,
            aspectRatio: normalizeGrsaiAspectRatio(generationAspectRatio),
            imageSize: normalizeGrsaiImageSize(generationImageSizeApiValue),
            webHook: "-1",
            shutProgress: true,
            ...(sharedGrsaiUrls.length ? { urls: sharedGrsaiUrls } : {})
          };
          const drawRes = await fetch(drawEndpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${cfg.apiKey}`
            },
            body: JSON.stringify(drawPayload),
            signal: controller.signal
          });
          const drawRaw = await drawRes.text();
          const drawCt = String(drawRes.headers.get("content-type") || "").toLowerCase();
          if (!drawCt.includes("application/json")) {
            const hint = hasLikelyHtml(drawRaw)
              ? "收到 HTML 页面，请检查 Grsai 地址是否填写正确"
              : "返回内容不是 JSON";
            throw new Error(`跑图请求失败：HTTP ${drawRes.status}，${hint}`);
          }
          let drawData = null;
          try {
            drawData = drawRaw ? JSON.parse(drawRaw) : {};
          } catch {
            throw new Error(`跑图请求失败：返回 JSON 解析失败（HTTP ${drawRes.status}）`);
          }
          if (!drawRes.ok) {
            throw new Error(drawData?.error || drawData?.msg || drawData?.message || `HTTP ${drawRes.status}`);
          }
          const drawCode = Number(drawData?.code);
          if (Number.isFinite(drawCode) && drawCode !== 0) {
            throw new Error(drawData?.msg || drawData?.error || `Grsai 请求失败（code=${drawCode}）`);
          }
          let current = extractGrsaiDrawPayload(drawData);
          registerRemoteCancelContext(current.id);
          const deadlineAt = Date.now() + cfg.timeoutMs;
          while (!current.images.length && current.id && current.status !== "succeeded") {
            if (controller.signal.aborted) throw new DOMException("aborted", "AbortError");
            if (Date.now() >= deadlineAt) {
              throw new Error("跑图结果轮询超时");
            }
            await new Promise((resolve) => setTimeout(resolve, 900));
            const pollRes = await fetch(resultEndpoint, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${cfg.apiKey}`
              },
              body: JSON.stringify({ id: current.id }),
              signal: controller.signal
            });
            const pollRaw = await pollRes.text();
            const pollCt = String(pollRes.headers.get("content-type") || "").toLowerCase();
            if (!pollCt.includes("application/json")) {
              const hint = hasLikelyHtml(pollRaw)
                ? "收到 HTML 页面，请检查 Grsai 地址是否填写正确"
                : "返回内容不是 JSON";
              throw new Error(`获取跑图结果失败：HTTP ${pollRes.status}，${hint}`);
            }
            let pollData = null;
            try {
              pollData = pollRaw ? JSON.parse(pollRaw) : {};
            } catch {
              throw new Error(`获取跑图结果失败：返回 JSON 解析失败（HTTP ${pollRes.status}）`);
            }
            if (!pollRes.ok) {
              throw new Error(pollData?.error || pollData?.msg || pollData?.message || `HTTP ${pollRes.status}`);
            }
            const pollCode = Number(pollData?.code);
            if (Number.isFinite(pollCode) && pollCode !== 0) {
              throw new Error(pollData?.msg || pollData?.error || `获取跑图结果失败（code=${pollCode}）`);
            }
            current = extractGrsaiDrawPayload(pollData);
            registerRemoteCancelContext(current.id);
            if (current.status === "failed") {
              throw new Error(current.error || current.failureReason || "跑图失败");
            }
          }
          if (!current.images.length && current.status === "failed") {
            throw new Error(current.error || current.failureReason || "跑图失败");
          }
          parsed = {
            images: Array.isArray(current.images) ? current.images : [],
            text: String(current.text || "").trim()
          };
        } else if (providerMode === "google-native") {
          let data = null;
          const googleBase = normalizeGoogleBaseForModels(cfg.baseUrl);
          const requestModelName = (() => {
            if (imageSiteKeyNow !== "aji") return cfg.model;
            const rawModel = String(cfg.model || "").trim();
            const normalizedBase = (/^nano-banana-pro$/i.test(rawModel) || !rawModel)
              ? "AJbanana3"
              : rawModel.replace(/-(1k|2k|4k)$/i, "");
            const sizeTag = String(generationImageSizeApiValue || "").trim().toLowerCase();
            if (!sizeTag || sizeTag === "auto") return normalizedBase;
            return `${normalizedBase}-${sizeTag}`;
          })();
          if (imageSiteKeyNow === "aji" && requestModelName !== cfg.model) {
            appendLog("info", `阿吉模型映射：${cfg.model || "空"} -> ${requestModelName}`, "api");
          }
          const endpoint = `${googleBase}/v1beta/models/${encodeURIComponent(requestModelName)}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`;
          const imageSizeUpper = String(generationImageSizeApiValue || "").toUpperCase();
          const aspectRatioForGoogle = (() => {
            const raw = String(generationAspectRatio || "").toUpperCase();
            return raw === "AUTO" || !raw ? "1:1" : raw;
          })();
          const bodyPayload = {
            contents: [{ role: "user", parts: sharedGoogleParts }],
            generationConfig: {
              temperature: 0.8,
              topP: 0.95,
              maxOutputTokens: 8192,
              imageConfig: {
                imageSize: imageSizeUpper || "1K",
                aspectRatio: aspectRatioForGoogle
              }
            }
          };
          const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(bodyPayload),
            signal: controller.signal
          });
          const raw = await res.text();
          const ct = String(res.headers.get("content-type") || "").toLowerCase();
          if (!ct.includes("application/json")) {
            const hint = hasLikelyHtml(raw)
              ? "收到 HTML 页面，请检查生图地址是否填写正确"
              : "返回内容不是 JSON";
            throw new Error(`跑图请求失败：HTTP ${res.status}，${hint}`);
          }
          try {
            data = raw ? JSON.parse(raw) : {};
          } catch {
            throw new Error(`跑图请求失败：返回 JSON 解析失败（HTTP ${res.status}）`);
          }
          if (!res.ok) {
            throw new Error(data?.error?.message || data?.message || `HTTP ${res.status}`);
          }
          parsed = extractImageResultsFromGoogleResponse(data);
        } else {
          let data = null;
          const endpoint = normalizeOpenAIChatEndpoint(cfg.baseUrl);
          const bodyPayload = {
            model: cfg.model,
            stream: false,
            messages: [{
              role: "user",
              content: sharedOpenAIUserContent
            }]
          };
          if (imageSiteKeyNow === "aji") {
            const aspectRatioRaw = String(generationAspectRatio || "").toUpperCase();
            const aspectRatioValue = aspectRatioRaw === "AUTO" ? "" : String(generationAspectRatio || "");
            const imageSizeValue = String(generationImageSizeApiValue || "1k").toUpperCase();
            const imageConfigPayload = {
              image_size: imageSizeValue,
              number_of_images: effectiveCount
            };
            if (aspectRatioValue) {
              imageConfigPayload.aspect_ratio = aspectRatioValue;
            }
            bodyPayload.extra_body = {
              google: {
                image_config: imageConfigPayload
              }
            };
          }
          const res = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${cfg.apiKey}`
            },
            body: JSON.stringify(bodyPayload),
            signal: controller.signal
          });
          const raw = await res.text();
          const ct = String(res.headers.get("content-type") || "").toLowerCase();
          if (!ct.includes("application/json")) {
            const hint = hasLikelyHtml(raw)
              ? "收到 HTML 页面，请检查生图地址是否填写正确"
              : "返回内容不是 JSON";
            throw new Error(`跑图请求失败：HTTP ${res.status}，${hint}`);
          }
          try {
            data = raw ? JSON.parse(raw) : {};
          } catch {
            throw new Error(`跑图请求失败：返回 JSON 解析失败（HTTP ${res.status}）`);
          }
          if (!res.ok) {
            throw new Error(data?.error?.message || data?.message || `HTTP ${res.status}`);
          }
          parsed = extractImageResultsFromOpenAIResponse(data);
        }
        return parsed;
      };

      const expectedCount = Math.max(1, Number(generationCount) || 1);
      const configuredBatchStrategy = normalizeImageRunBatchStrategy(imageConfig?.runBatchStrategy);
      const singleRequestSupported = supportsSingleRequestMultiImage(imageSiteKeyNow, providerMode);
      let resolvedBatchStrategy = configuredBatchStrategy;
      if (resolvedBatchStrategy === "auto") {
        resolvedBatchStrategy = singleRequestSupported ? "single" : "multi";
      }
      if (resolvedBatchStrategy === "single" && !singleRequestSupported && expectedCount > 1) {
        resolvedBatchStrategy = "multi";
        appendLog("warn", "当前服务商/兼容格式不支持单请求多图，已自动切换为多请求。", "api");
      }
      const imageUrls = [];
      const textChunks = [];
      const useSingleRequestWithCountParam =
        expectedCount > 1
        && resolvedBatchStrategy === "single"
        && singleRequestSupported;
      const actualRequestCount = useSingleRequestWithCountParam ? 1 : expectedCount;
      const settled = useSingleRequestWithCountParam
        ? await Promise.allSettled([requestRunOnce(expectedCount)])
        : await Promise.allSettled(
            Array.from({ length: expectedCount }, () => requestRunOnce(1))
          );
      let failedRequests = 0;
      let firstRequestError = "";
      settled.forEach((item) => {
        if (item.status === "rejected") {
          failedRequests += 1;
          if (!firstRequestError) {
            firstRequestError = String(item.reason?.message || item.reason || "跑图请求失败");
          }
          return;
        }
        const parsed = item.value;
        const parsedText = String(parsed?.text || "").trim();
        if (parsedText) textChunks.push(parsedText);
        const batch = Array.isArray(parsed?.images) ? parsed.images : [];
        batch.forEach((value) => {
          const url = String(value || "").trim();
          if (!url) return;
          imageUrls.push(url);
        });
      });
      const parsedText = Array.from(new Set(textChunks.filter(Boolean))).join("\n").trim();

      if (!imageUrls.length && !parsedText) {
        throw new Error(firstRequestError || "跑图成功，但未返回可用图片或文本");
      }

      if (failedRequests > 0) {
        appendLog("warn", `跑图请求发送 ${actualRequestCount} 次，其中失败 ${failedRequests} 次`, "api");
      }
      if (imageUrls.length < expectedCount) {
        appendLog("warn", `跑图请求数量 x${expectedCount}，收到图片 ${imageUrls.length} 张`, "api");
      }

      if (imageUrls.length) {
        const stamp = Date.now();
        const normalized = imageUrls.slice(0, expectedCount).map((dataUrl, idx) => {
          const target = getRunTargetByIndex(idx);
          return {
            id: `gen-${stamp}-${idx + 1}`,
            dataUrl,
            name: `生成图_${idx + 1}`,
            targetRect: target.targetRect || null,
            targetRectNorm: target.targetRectNorm || null,
            targetCanvas: target.targetCanvas || null,
            targetDocumentId: target.targetDocumentId || undefined,
            targetDocumentName: target.targetDocumentName || ""
          };
        });
        const cached = await cacheGeneratedPreviewImages(normalized);
        const compacted = compactGeneratedPreviewInlineData(cached, 0);
        setGeneratedPreviewImages(compacted);
        setPreviewImageIndex(0);
        if (autoExport && compacted[0]) {
          const firstTarget = getRunTargetByIndex(0);
          void exportImageToCanvas(compacted[0], {
            trigger: "auto",
            targetRect: firstTarget.targetRect || null,
            targetRectNorm: firstTarget.targetRectNorm || null,
            targetCanvas: firstTarget.targetCanvas || null,
            targetDocumentId: firstTarget.targetDocumentId
          });
        }
      }

      if (parsedText) {
        const summary = parsedText.length > 120 ? `${parsedText.slice(0, 120)}...` : parsedText;
        appendLog("info", `跑图返回：${summary}`, "api");
      }
      appendTraceLog({
        level: "info",
        type: "api",
        domain: "跑图请求",
        phase: "返回",
        message: `跑图完成，返回图片 ${imageUrls.length}/${expectedCount} 张。`,
        startedAt: runRequestStartedAt,
        endedAt: Date.now()
      });
      setMiniConsole("跑图已返回", "ok", "跑图成功。可在大控制台查看完整返回信息。");
      markApiActionSuccess("image", "");
    } catch (err) {
      const raw = String(err?.message || "请求失败");
      const abortReason = err?.name === "AbortError" ? imageRunAbortReasonRef.current : "";
      const msg = err?.name === "AbortError"
        ? (abortReason === "manual" ? "跑图任务已中止" : `跑图请求超时（>${Math.round(cfg.timeoutMs / 1000)}s）`)
        : formatApiError(raw);
      appendTraceLog({
        level: err?.name === "AbortError" ? "warn" : "error",
        type: "api",
        domain: "跑图请求",
        phase: err?.name === "AbortError" && abortReason === "manual" ? "中止" : "错误",
        message: msg,
        startedAt: runRequestStartedAt,
        endedAt: Date.now(),
        requestId: extractRequestId(raw),
        guide: err?.name === "AbortError" && abortReason === "manual" ? "" : getFixGuideForError(raw, "image")
      });
      if (err?.name === "AbortError" && abortReason === "manual") {
        setMiniConsole("跑图已停", "warn", "跑图任务已中止。");
      } else {
        setImageApiStatus("error");
        setImageApiIssueText(msg);
        setMiniConsole("跑图失败", "error", "跑图失败。请打开大控制台查看修复指引。");
      }
    } finally {
      clearTimeout(timeoutId);
      if (imageRunAbortControllerRef.current === controller) {
        imageRunAbortControllerRef.current = null;
      }
      imageRunAbortReasonRef.current = "";
      imageRunRemoteCancelContextRef.current = null;
      setIsImageGenerating(false);
      sourceImages = [];
      runTargets = [];
      sendImages = [];
      sharedGrsaiUrls = [];
      sharedGoogleParts = [];
      sharedOpenAIUserContent = "";
    }
  };

  const updateImageRunQueueState = () => {
    setImageRunQueueState({
      running: !!imageRunActiveTaskRef.current,
      pending: Math.max(0, imageRunQueueRef.current.length)
    });
  };

  const snapshotImageForRunTask = (item) => {
    if (!item || typeof item !== "object") return null;
    const psCacheId = String(item?.psCacheId || item?.cacheId || "").trim();
    const inlineDataUrl = String(item?.dataUrl || "").trim();
    if (!psCacheId && !inlineDataUrl.startsWith("data:image/")) return null;
    const dataUrl = psCacheId ? "" : inlineDataUrl;
    const target = resolveImageTarget(item);
    const width = Number(item?.width);
    const height = Number(item?.height);
    return {
      id: String(item.id || ""),
      dataUrl,
      name: String(item.name || item.originName || "image"),
      originName: String(item.originName || item.name || "image"),
      type: String(item.type || "image/*"),
      source: normalizeImageSourceTag(item.source),
      role: String(item.role || ""),
      slotIndex: Number.isFinite(item.slotIndex) ? Number(item.slotIndex) : undefined,
      psCacheId,
      psCacheExpiresAt: Number.isFinite(item.psCacheExpiresAt) ? Number(item.psCacheExpiresAt) : undefined,
      width: Number.isFinite(width) && width > 0 ? width : undefined,
      height: Number.isFinite(height) && height > 0 ? height : undefined,
      targetRect: target.targetRect || null,
      targetRectNorm: target.targetRectNorm || undefined,
      targetCanvas: target.targetCanvas || undefined,
      targetDocumentId: target.targetDocumentId || undefined,
      targetDocumentName: target.targetDocumentName || undefined
    };
  };

  const releaseImageRunTaskPayload = (task) => {
    if (!task || typeof task !== "object") return;
    const options = task.options && typeof task.options === "object" ? task.options : null;
    if (!options) {
      task.options = null;
      return;
    }
    if (Array.isArray(options.images)) {
      options.images.forEach((item) => {
        if (item && typeof item === "object" && typeof item.dataUrl === "string") {
          item.dataUrl = "";
        }
      });
      options.images.length = 0;
    }
    options.promptText = "";
    task.options = null;
  };

  const buildImageRunQueueTask = (options = {}) => {
    const promptText = String(options?.promptText ?? jsonPromptText ?? "").trim();
    if (!promptText) {
      appendLog("warn", "当前没有可跑图的 JSON 提示词", "api");
      setMiniConsole("跑图失败", "error", "缺少 JSON 提示词，无法跑图。");
      return null;
    }
    const imageSource = String(options?.imageSource || "upload");
    let sourceImages = [];
    if (Array.isArray(options?.images)) {
      sourceImages = options.images;
    } else if (imageSource === "assistant-prev-user") {
      sourceImages = getPrevUserImagesForAssistant(options?.assistantMessageId);
    } else {
      sourceImages = uploadImagesRef.current;
    }
    const snapshotImages = Array.isArray(sourceImages)
      ? sourceImages.map(snapshotImageForRunTask).filter(Boolean)
      : [];
    imageRunTaskSeqRef.current += 1;
    return {
      id: `imgq-${Date.now()}-${imageRunTaskSeqRef.current}`,
      options: {
        ...options,
        promptText,
        imageSource,
        images: snapshotImages
      }
    };
  };

  const tryAbortRemoteImageTask = async (context) => {
    const ctx = context && typeof context === "object" ? context : null;
    if (!ctx) return { ok: false, message: "缺少服务端任务上下文" };
    if (ctx.providerKey !== "grsai") {
      return { ok: false, message: "当前服务商暂未提供可用的服务端中止接口" };
    }
    const taskId = String(ctx.taskId || "").trim();
    if (!taskId) return { ok: false, message: "服务端未返回任务 ID，无法中止" };
    const base = normalizeBaseForOption(ctx.baseUrl);
    const candidates = [
      `${base}/v1/draw/cancel`,
      `${base}/v1/draw/stop`,
      `${base}/v1/draw/abort`
    ];
    let lastError = "服务端中止接口不可用";
    for (const endpoint of candidates) {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${ctx.apiKey || ""}`
          },
          body: JSON.stringify({ id: taskId })
        });
        const raw = await res.text();
        const ct = String(res.headers.get("content-type") || "").toLowerCase();
        if (!res.ok) {
          if (ct.includes("application/json")) {
            try {
              const data = raw ? JSON.parse(raw) : {};
              lastError = data?.msg || data?.message || data?.error || `HTTP ${res.status}`;
              continue;
            } catch {
              // ignore parse error
            }
          }
          lastError = `HTTP ${res.status}`;
          continue;
        }
        if (ct.includes("application/json")) {
          try {
            const data = raw ? JSON.parse(raw) : {};
            const code = Number(data?.code);
            if (Number.isFinite(code) && code !== 0) {
              lastError = data?.msg || data?.message || data?.error || `code=${code}`;
              continue;
            }
          } catch {
            // ignore parse error for successful status
          }
        }
        return { ok: true, endpoint };
      } catch (err) {
        lastError = String(err?.message || err || "服务端中止请求失败");
      }
    }
    return { ok: false, message: lastError };
  };

  const processImageRunQueue = async () => {
    if (imageRunProcessingRef.current) return;
    imageRunProcessingRef.current = true;
    try {
      while (imageRunQueueRef.current.length > 0) {
        const task = imageRunQueueRef.current.shift();
        updateImageRunQueueState();
        if (!task) continue;
        imageRunActiveTaskRef.current = task;
        updateImageRunQueueState();
        try {
          await executeImageRunTask(task.options);
        } finally {
          releaseImageRunTaskPayload(task);
        }
        if (imageRunActiveTaskRef.current?.id === task.id) {
          imageRunActiveTaskRef.current = null;
        }
        updateImageRunQueueState();
      }
    } finally {
      imageRunProcessingRef.current = false;
      imageRunActiveTaskRef.current = null;
      imageRunAbortControllerRef.current = null;
      imageRunAbortReasonRef.current = "";
      imageRunRemoteCancelContextRef.current = null;
      updateImageRunQueueState();
    }
  };

  const handleStopImageRunQueue = async () => {
    const active = !!imageRunActiveTaskRef.current;
    const pending = imageRunQueueRef.current.length;
    if (!active && pending < 1) return;
    const remoteContext = imageRunRemoteCancelContextRef.current
      ? { ...imageRunRemoteCancelContextRef.current }
      : null;
    if (pending > 0) {
      imageRunQueueRef.current.forEach((task) => releaseImageRunTaskPayload(task));
      imageRunQueueRef.current = [];
    }
    if (imageRunAbortControllerRef.current) {
      imageRunAbortReasonRef.current = "manual";
      try {
        imageRunAbortControllerRef.current.abort();
      } catch {
        // ignore abort errors
      }
    }
    updateImageRunQueueState();
    appendLog("warn", `已请求中止跑图${pending > 0 ? `，并清空 ${pending} 个排队任务` : ""}`, "api");
    setMiniConsole("跑图已停", "warn", "跑图任务已中止。");
    if (!remoteContext) return;
    const remoteResult = await tryAbortRemoteImageTask(remoteContext);
    if (remoteResult.ok) {
      appendLog("info", "已尝试向服务端发送中止请求", "api");
      return;
    }
    appendTraceLog({
      level: "warn",
      type: "api",
      domain: "跑图请求",
      phase: "中止",
      message: `服务端中止失败：${remoteResult.message || "未知错误"}（任务可能继续执行）`
    });
    setMiniConsole("中止失败", "warn", "本地已中止，服务端中止失败，任务可能继续执行。");
  };

  const handleRunLatest = async (options = {}) => {
    const now = Date.now();
    if (now < imageRunClickGuardUntilRef.current) return;
    imageRunClickGuardUntilRef.current = now + IMAGE_RUN_CLICK_GUARD_MS;
    const task = buildImageRunQueueTask(options);
    if (!task) return;
    imageRunQueueRef.current.push(task);
    updateImageRunQueueState();
    const running = !!imageRunActiveTaskRef.current;
    if (running || imageRunQueueRef.current.length > 1) {
      appendLog("info", `跑图任务已加入队列（待执行 ${imageRunQueueRef.current.length}）`, "api");
      setMiniConsole("跑图排队中", "busy", `当前排队 ${imageRunQueueRef.current.length} 个任务。`);
    }
    void processImageRunQueue();
  };

  const sanitizeGenerationCount = (rawCount) => {
    const parsed = Number.parseInt(String(rawCount), 10);
    if (!Number.isFinite(parsed)) return null;
    return Math.max(1, Math.min(GENERATION_COUNT_HARD_MAX, parsed));
  };

  const handleGenerationCountChange = (nextCount) => {
    const safeCount = sanitizeGenerationCount(nextCount);
    if (!Number.isFinite(safeCount) || safeCount < 1) return;
    handleConfigField("image", "generationCount", Math.floor(safeCount));
  };

  const handleGenerationCountSlider = (value) => {
    const parsed = Number.parseInt(String(value), 10);
    if (!Number.isFinite(parsed)) return;
    handleGenerationCountChange(parsed);
  };

  const handleGenerationCountManualInput = (value) => {
    const parsed = Number.parseInt(String(value), 10);
    if (!Number.isFinite(parsed)) return;
    handleGenerationCountChange(parsed);
  };

  const sanitizeUploadMaxSide = (rawValue, mode = "manual") => {
    const parsed = Number.parseInt(String(rawValue), 10);
    if (!Number.isFinite(parsed)) return null;
    if (parsed < IMAGE_COMPRESS_MAX_SIDE_MIN) return IMAGE_COMPRESS_MAX_SIDE_MIN;
    if (parsed <= IMAGE_COMPRESS_MAX_SIDE_SLIDER_MAX) {
      uploadSizeWarnedRef.current = false;
      uploadSizeCapWarnedRef.current = false;
      return parsed;
    }
    if (parsed > IMAGE_COMPRESS_MAX_SIDE_HARD_MAX) {
      if (mode === "manual" && !uploadSizeCapWarnedRef.current) {
        uploadSizeCapWarnedRef.current = true;
        window.alert(`上传尺寸最大支持 ${IMAGE_COMPRESS_MAX_SIDE_HARD_MAX}px，已自动按上限处理。`);
      }
      return IMAGE_COMPRESS_MAX_SIDE_HARD_MAX;
    }
    if (mode === "manual" && !uploadSizeWarnedRef.current) {
      uploadSizeWarnedRef.current = true;
      window.alert(`上传尺寸滑条范围是 ${IMAGE_COMPRESS_MAX_SIDE_MIN}-${IMAGE_COMPRESS_MAX_SIDE_SLIDER_MAX}px。你已手动输入超过 ${IMAGE_COMPRESS_MAX_SIDE_SLIDER_MAX}px，将按你的输入值继续。`);
    }
    uploadSizeCapWarnedRef.current = false;
    return parsed;
  };

  const normalizeUploadQualityPercent = (rawValue) => {
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) return null;
    const legacyPercent = parsed > 0 && parsed <= 1 ? parsed * 100 : parsed;
    return Math.round(legacyPercent);
  };

  const sanitizeUploadQualityPercent = (rawValue, mode = "manual") => {
    const normalized = normalizeUploadQualityPercent(rawValue);
    if (!Number.isFinite(normalized)) return null;
    if (normalized < IMAGE_COMPRESS_QUALITY_MIN) return IMAGE_COMPRESS_QUALITY_MIN;
    if (normalized <= IMAGE_COMPRESS_QUALITY_HARD_MAX) {
      uploadQualityCapWarnedRef.current = false;
      return normalized;
    }
    if (mode === "manual" && !uploadQualityCapWarnedRef.current) {
      uploadQualityCapWarnedRef.current = true;
      window.alert(`上传品质最大支持 ${IMAGE_COMPRESS_QUALITY_HARD_MAX}% ，已自动按上限处理。`);
    }
    return IMAGE_COMPRESS_QUALITY_HARD_MAX;
  };

  const handleUploadMaxSideSlider = (value) => {
    const safe = sanitizeUploadMaxSide(value, "slider");
    if (!Number.isFinite(safe)) return;
    setImageCompressMaxSide(safe);
  };

  const handleUploadMaxSideManualInput = (value) => {
    const safe = sanitizeUploadMaxSide(value, "manual");
    if (!Number.isFinite(safe)) return;
    setImageCompressMaxSide(safe);
  };

  const handleUploadImageFormatChange = (nextFormat) => {
    const safeFormat = normalizeUploadImageFormat(nextFormat, IMAGE_COMPRESS_FORMAT_DEFAULT);
    setUploadImageFormat(safeFormat);
    if (safeFormat === "png") {
      setImageCompressQuality(IMAGE_COMPRESS_QUALITY_DEFAULT);
      uploadQualityCapWarnedRef.current = false;
    }
  };

  const handleUploadQualitySlider = (value) => {
    if (normalizeUploadImageFormat(uploadImageFormat, IMAGE_COMPRESS_FORMAT_DEFAULT) === "png") return;
    const safe = sanitizeUploadQualityPercent(value, "slider");
    if (!Number.isFinite(safe)) return;
    setImageCompressQuality(safe);
  };

  const handleUploadQualityManualInput = (value) => {
    if (normalizeUploadImageFormat(uploadImageFormat, IMAGE_COMPRESS_FORMAT_DEFAULT) === "png") return;
    const safe = sanitizeUploadQualityPercent(value, "manual");
    if (!Number.isFinite(safe)) return;
    setImageCompressQuality(safe);
  };
  const updateUploadSizePanelPosition = (fallback = {}) => {
    const anchorEl = uploadSizeToggleRef.current;
    if (!anchorEl) return;
    const panelEl = uploadSizePanelRef.current;
    const fallbackWidth = Number.isFinite(fallback.width) ? fallback.width : CHAT_HEADER_PANEL_WIDTH;
    const fallbackHeight = Number.isFinite(fallback.height) ? fallback.height : 188;
    const pos = resolveFloatingPanelPosition(anchorEl, panelEl, {
      mode: "end",
      minWidth: CHAT_HEADER_PANEL_WIDTH,
      maxWidth: CHAT_HEADER_PANEL_WIDTH,
      fallbackWidth,
      fallbackHeight
    });
    if (!pos) return;
    const nextPos = { top: pos.top, left: pos.left, width: pos.width };
    setUploadSizePanelPos((prev) => replaceFloatingIfChanged(prev, nextPos, ["top", "left", "width"]));
  };
  const toggleUploadSizePanel = () => {
    if (uploadSizeOpen) {
      setUploadSizeOpen(false);
      return;
    }
    updateUploadSizePanelPosition({ width: CHAT_HEADER_PANEL_WIDTH, height: 248 });
    setUploadSizeOpen(true);
    setHistoryOpen(false);
    setHistoryToolsOpen(false);
    setIdentityQuickOpen(false);
    setChatQuickConfigOpen(false);
    setImageQuickConfigOpen(false);
    closeImageQuickPromptMenu();
    closeImageQuickPromptEditor();
  };
  const updateGenerationCountDropdownPosition = () => {
    const anchorEl = generationCountControlRef.current;
    if (!anchorEl) return;
    const panelEl = generationCountDropdownRef.current;
    const anchorRect = anchorEl.getBoundingClientRect();
    const pos = resolveFloatingPanelPosition(anchorEl, panelEl, {
      mode: "auto",
      minWidth: 220,
      fallbackWidth: Math.max(220, Math.round(anchorRect.width || 0)),
      fallbackHeight: 112
    });
    if (!pos) return;
    setGenerationCountDropdownPos((prev) => replaceFloatingIfChanged(prev, pos, ["top", "left", "width"]));
  };
  const openGenerationCountDropdown = () => {
    if (!generationCountControlRef.current) return;
    setGenerationCountOpen(true);
    closeGenerationSelectDropdown();
  };
  const closeGenerationCountDropdown = () => {
    setGenerationCountOpen(false);
  };
  const toggleGenerationCountDropdown = () => {
    if (generationCountOpen) {
      closeGenerationCountDropdown();
      return;
    }
    openGenerationCountDropdown();
  };
  const closeGenerationSelectDropdown = () => {
    setGenerationSelectDropdown((prev) => (prev.open ? { ...prev, open: false, kind: "" } : prev));
  };
  const updateGenerationSelectDropdownPosition = (kind = generationSelectDropdown.kind) => {
    const anchorEl = kind === "size" ? generationSizeControlRef.current : generationRatioControlRef.current;
    if (!anchorEl) return;
    const panelEl = generationSelectDropdownRef.current;
    const options = kind === "size" ? IMAGE_SIZE_OPTIONS : IMAGE_ASPECT_RATIO_OPTIONS;
    const fallbackHeight = options.length * 30 + 10;
    const pos = resolveFloatingPanelPosition(anchorEl, panelEl, {
      mode: "auto",
      fallbackHeight
    });
    if (!pos) return null;
    const nextPos = { top: pos.top, left: pos.left, width: pos.width };
    setGenerationSelectDropdown((prev) => mergeFloatingPatch(prev, { kind, ...nextPos }, ["kind", "top", "left", "width"]));
    return nextPos;
  };
  const openGenerationSelectDropdown = (kind) => {
    const nextPos = updateGenerationSelectDropdownPosition(kind);
    setGenerationSelectDropdown((prev) => ({
      ...prev,
      open: true,
      kind,
      ...(nextPos || {})
    }));
    closeGenerationCountDropdown();
  };
  const toggleGenerationSelectDropdown = (kind) => {
    if (generationSelectDropdown.open && generationSelectDropdown.kind === kind) {
      closeGenerationSelectDropdown();
      return;
    }
    openGenerationSelectDropdown(kind);
  };
  const handlePickGenerationSelectOption = (kind, value) => {
    if (kind === "size") {
      handleConfigField("image", "generationImageSize", value);
    } else if (kind === "ratio") {
      handleConfigField("image", "generationAspectRatio", value);
    }
    closeGenerationSelectDropdown();
  };

  const handleConfigField = (section, key, value) => {
    if (section === "chat") {
      if (key === "baseUrl") setChatModelOptions([]);
      if (key === "systemPrompt") {
        const nextPrompt = String(value || "");
        setChatConfig((prev) => ({ ...prev, systemPrompt: nextPrompt }));
        setChatProviderProfiles((prev) => {
          if (!prev || typeof prev !== "object") return prev;
          let changed = false;
          const next = { ...prev };
          Object.keys(next).forEach((providerKey) => {
            const item = next[providerKey] && typeof next[providerKey] === "object" ? next[providerKey] : {};
            if (String(item.systemPrompt || "") === nextPrompt) return;
            next[providerKey] = { ...item, systemPrompt: nextPrompt };
            changed = true;
          });
          return changed ? next : prev;
        });
        return;
      }
      setChatConfig((prev) => ({ ...prev, [key]: value }));
    } else {
      if (key === "baseUrl") {
        setImageModelOptions([]);
        setImageConfig((prev) => ({ ...prev, baseUrl: value }));
        return;
      }
      setImageConfig((prev) => ({ ...prev, [key]: value }));
    }
  };
  const handleSitePresetChange = (section, siteKey, options = {}) => {
    const customProviderMode = normalizeProviderMode(options.customProviderMode);
    if (section === "chat") {
      setChatModelOptions([]);
      const currentKey = chatProviderKey;
      const sharedSystemPrompt = String(chatConfig.systemPrompt || "");
      const currentSnapshot = sanitizeChatConfig(chatConfig);
      const nextProfiles = {
        ...chatProviderProfiles,
        [currentKey]: { ...(chatProviderProfiles[currentKey] || {}), ...currentSnapshot }
      };
      CHAT_PROVIDER_SITES.forEach((site) => {
        if (nextProfiles[site.key]) return;
        nextProfiles[site.key] = {
          ...defaultChatConfig,
          baseUrl: site.baseUrl,
          providerMode: normalizeChatProviderModeBySiteKey(site.key, site.providerMode || "openai-compat"),
          apiKey: "",
          model: getChatDefaultModelBySiteKey(site.key, defaultChatConfig.model)
        };
      });
      if (!nextProfiles.custom) {
        nextProfiles.custom = {
          ...defaultChatConfig,
          baseUrl: "",
          providerMode: normalizeChatProviderModeBySiteKey("custom", "openai-compat"),
          apiKey: "",
          model: ""
        };
      }
      Object.keys(nextProfiles).forEach((key) => {
        const item = nextProfiles[key] && typeof nextProfiles[key] === "object" ? nextProfiles[key] : {};
        nextProfiles[key] = { ...item, systemPrompt: sharedSystemPrompt };
      });
      setChatProviderProfiles(nextProfiles);
      const preset = CHAT_PROVIDER_SITES.find((item) => item.key === siteKey);
      const fallbackMode = siteKey === "custom"
        ? normalizeChatProviderModeBySiteKey("custom", customProviderMode)
        : normalizeChatProviderModeBySiteKey(siteKey, preset?.providerMode || "openai-compat");
      const fallback = siteKey === "custom"
        ? { ...defaultChatConfig, baseUrl: "", providerMode: fallbackMode, apiKey: "", model: "" }
        : {
          ...defaultChatConfig,
          baseUrl: preset?.baseUrl || defaultChatConfig.baseUrl,
          providerMode: fallbackMode,
          apiKey: "",
          model: getChatDefaultModelBySiteKey(siteKey, defaultChatConfig.model)
        };
      const target = nextProfiles[siteKey] ? { ...fallback, ...nextProfiles[siteKey] } : fallback;
      if (siteKey !== "custom") {
        target.baseUrl = preset?.baseUrl || target.baseUrl;
        target.providerMode = normalizeChatProviderModeBySiteKey(siteKey, target.providerMode);
        target.model = String(target.model || getChatDefaultModelBySiteKey(siteKey, defaultChatConfig.model));
      } else {
        target.providerMode = normalizeChatProviderModeBySiteKey("custom", customProviderMode);
      }
      target.apiKey = String(target.apiKey || "");
      target.model = String(target.model || "");
      target.systemPrompt = sharedSystemPrompt;
      setChatProviderKey(siteKey);
      setChatConfig(sanitizeChatConfig(target));
      return;
    }
    setImageModelOptions([]);
    const currentImageKey = imageProviderKey;
    const currentImageSnapshot = { ...imageConfig };
    const nextImageProfiles = {
      ...imageProviderProfiles,
      [currentImageKey]: { ...(imageProviderProfiles[currentImageKey] || {}), ...currentImageSnapshot }
    };
    if (!nextImageProfiles.custom) {
      nextImageProfiles.custom = {
        ...defaultImageConfig,
        baseUrl: "",
        providerMode: "openai-compat",
        apiKey: "",
        model: ""
      };
    }
    setImageProviderProfiles(nextImageProfiles);
    if (siteKey === "custom") {
      const fallback = {
        ...defaultImageConfig,
        baseUrl: "",
        providerMode: normalizeImageProviderModeBySiteKey("custom", customProviderMode),
        apiKey: "",
        model: ""
      };
      const target = nextImageProfiles.custom ? { ...fallback, ...nextImageProfiles.custom } : fallback;
      target.baseUrl = String(target.baseUrl || "");
      target.providerMode = normalizeImageProviderModeBySiteKey("custom", customProviderMode);
      target.apiKey = String(target.apiKey || "");
      target.model = String(target.model || "");
      setImageProviderKey("custom");
      setImageConfig(target);
      return;
    }
    const preset = IMAGE_PROVIDER_SITES.find((item) => item.key === siteKey);
    if (!preset) return;
    const providerMode = normalizeImageProviderModeBySiteKey(siteKey, preset.providerMode || "openai-compat");
    const fallback = {
      ...defaultImageConfig,
      baseUrl: preset.baseUrl,
      providerMode,
      apiKey: "",
      model: getImageDefaultModelBySiteKey(siteKey, "")
    };
    const target = nextImageProfiles[siteKey] ? { ...fallback, ...nextImageProfiles[siteKey] } : fallback;
    target.baseUrl = preset.baseUrl;
    target.providerMode = normalizeImageProviderModeBySiteKey(siteKey, target.providerMode);
    target.apiKey = String(target.apiKey || "");
    target.model = String(target.model || getImageDefaultModelBySiteKey(siteKey, ""));
    setImageProviderKey(siteKey);
    setImageConfig(target);
  };
  const applySystemPromptPreset = (preset) => {
    if (!preset) return;
    handleConfigField("chat", "systemPrompt", preset.content);
    setSystemPromptPresetId(preset.id);
    closePresetDropdown();
    appendLog("info", `已应用身份预设：${preset.name}`, "system");
  };

  const handleAddSystemPromptPreset = () => {
    const content = String(chatConfig.systemPrompt || "").trim();
    if (!content) {
      appendLog("warn", "当前身份设定为空，无法保存为预设", "system");
      return;
    }
    const name = window.prompt("输入预设名称");
    if (!name) return;
    const trimmed = String(name).trim();
    if (!trimmed) return;
    const id = `custom-${Date.now()}`;
    const next = { id, name: trimmed, content };
    setSystemPromptPresets((prev) => [...prev, next]);
    setSystemPromptPresetId(id);
    closePresetDropdown();
    appendLog("info", `已新增身份预设：${trimmed}`, "system");
  };

  const handleDeleteSystemPromptPreset = () => {
    const selectedCustom = systemPromptPresets.find((item) => item.id === systemPromptPresetId);
    if (!selectedCustom) {
      appendLog("warn", "仅支持删除自定义预设", "system");
      return;
    }
    setSystemPromptPresets((prev) => prev.filter((item) => item.id !== selectedCustom.id));
    setSystemPromptPresetId("");
    closePresetDropdown();
    appendLog("info", `已删除身份预设：${selectedCustom.name}`, "system");
  };

  const handleExportLogs = async () => {
    try {
      const payload = {
        consoleLogs: logs.map((line) => ({
          ts: line.ts,
          level: line.level,
          type: line.type,
          typeLabel: line.typeLabel,
          message: line.message
        }))
      };
      if (!window.shell || typeof window.shell.exportLogs !== "function") {
        appendLog("warn", "当前环境不支持导出日志", "system");
        return;
      }
      const result = await window.shell.exportLogs(payload);
      if (result?.canceled) {
        appendLog("info", "已取消导出日志", "system");
        return;
      }
      if (result?.ok) {
        appendLog("info", `日志已导出：${result.path || "成功"}`, "system");
      } else {
        appendLog("error", `导出日志失败：${result?.message || "未知错误"}`, "api");
      }
    } catch (err) {
      appendLog("error", `导出日志失败：${err?.message || "未知错误"}`, "api");
    }
  };

  const handleFetchModels = async (section = "chat", options = {}) => {
    const { silent = false } = options;
    const key = section === "image" ? "image" : "chat";
    const siteKey = section === "image" ? imageProviderKey : chatProviderKey;
    const allowFetch = section === "image"
      ? canFetchImageModelsBySiteKey(siteKey)
      : canFetchChatModelsBySiteKey(siteKey);
    if (!allowFetch) {
      if (!silent) appendLog("info", "当前服务商不支持自动获取模型，请手动填写", "api");
      return false;
    }
    if (modelsLoadingBySection[key]) return;
    setModelsLoadingBySection((prev) => ({ ...prev, [key]: true }));
    try {
      if (section === "chat") {
        const cfg = sanitizeChatConfig(chatConfig);
        if (!cfg.baseUrl || !cfg.apiKey) {
          appendLog("warn", "获取模型前请先填写地址与 Key", "api");
          return;
        }
        const providerMode = normalizeChatProviderModeBySiteKey(siteKey, cfg.providerMode);
        const presetModels = getChatPresetModelsBySiteKey(siteKey);
        let models = [];
        if (providerMode === "google-native") {
          const googleBase = normalizeGoogleBaseForModels(cfg.baseUrl);
          const endpoint = `${googleBase}/v1beta/models?key=${encodeURIComponent(cfg.apiKey)}`;
          const response = await fetch(endpoint, { method: "GET" });
          const raw = await response.text();
          let data = null;
          try {
            data = raw ? JSON.parse(raw) : {};
          } catch {
            throw new Error(hasLikelyHtml(raw) ? "返回 HTML 页面，请检查聊天地址" : "模型列表返回不是 JSON");
          }
          if (!response.ok) {
            throw new Error(data?.error?.message || data?.message || `HTTP ${response.status}`);
          }
          models = Array.isArray(data?.models)
            ? data.models.map((m) => String(m?.name || "").replace(/^models\//i, "").trim()).filter(Boolean)
            : [];
        } else {
          const openaiBase = normalizeOpenAIBaseForModels(cfg.baseUrl);
          const response = await fetch(`${openaiBase}/models`, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${cfg.apiKey}`
            }
          });
          const raw = await response.text();
          let data = null;
          try {
            data = raw ? JSON.parse(raw) : {};
          } catch {
            throw new Error(hasLikelyHtml(raw) ? "返回 HTML 页面，请检查聊天地址" : "模型列表返回不是 JSON");
          }
          if (!response.ok) {
            throw new Error(data?.error?.message || data?.message || `HTTP ${response.status}`);
          }
          models = Array.isArray(data?.data)
            ? data.data.map((m) => String(m?.id || "").trim()).filter(Boolean)
            : [];
        }
        const nextModels = Array.from(new Set([...presetModels, ...models].filter(Boolean)));
        setChatModelOptions(nextModels);
        appendLog("info", `聊天模型列表已更新（${nextModels.length}）`, "api");
        return true;
      }

      const baseUrl = String(imageConfig.baseUrl || "").trim();
      const apiKey = String(imageConfig.apiKey || "").trim();
      if (!baseUrl || !apiKey) {
        appendLog("warn", "获取模型前请先填写地址与 Key", "api");
        return;
      }

      const imageSiteKeyNow = imageProviderKey;
      const providerMode = normalizeImageProviderModeBySiteKey(imageSiteKeyNow, imageConfig.providerMode);
      let models = [];

      if (providerMode === "google-native") {
        const googleBase = normalizeGoogleBaseForModels(baseUrl);
        const endpoint = `${googleBase}/v1beta/models?key=${encodeURIComponent(apiKey)}`;
        const response = await fetch(endpoint, { method: "GET" });
        const raw = await response.text();
        let data = null;
        try {
          data = raw ? JSON.parse(raw) : {};
        } catch {
          throw new Error(hasLikelyHtml(raw) ? "返回 HTML 页面，请检查 Google 地址" : "模型列表返回不是 JSON");
        }
        if (!response.ok) {
          throw new Error(data?.error?.message || data?.message || `HTTP ${response.status}`);
        }
        models = Array.isArray(data?.models)
          ? data.models.map((m) => String(m?.name || "").replace(/^models\//i, "").trim()).filter(Boolean)
          : [];
      } else {
        const openaiBase = normalizeOpenAIBaseForModels(baseUrl);
        const response = await fetch(`${openaiBase}/models`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${apiKey}`
          }
        });
        const raw = await response.text();
        let data = null;
        try {
          data = raw ? JSON.parse(raw) : {};
        } catch {
          throw new Error(hasLikelyHtml(raw) ? "返回 HTML 页面，请检查生图地址" : "模型列表返回不是 JSON");
        }
        if (!response.ok) {
          throw new Error(data?.error?.message || data?.message || `HTTP ${response.status}`);
        }
        models = Array.isArray(data?.data)
          ? data.data.map((m) => String(m?.id || "").trim()).filter(Boolean)
          : [];
      }

      const presetModels = getImagePresetModelsBySiteKey(imageSiteKeyNow);
      const nextModels = Array.from(new Set([...presetModels, ...models].filter(Boolean)));
      setImageModelOptions(nextModels);
      appendLog("info", `生图模型列表已更新（${nextModels.length}）`, "api");
      return true;
    } catch (err) {
      const msg = String(err?.message || "未知错误");
      const unsupported = msg.includes("HTTP 404") || msg.includes("HTTP 405");
      if (section === "chat") {
        if (unsupported) {
          const fallbackChatModels = getChatPresetModelsBySiteKey(chatProviderKey);
          if (fallbackChatModels.length) {
            setChatModelOptions((prev) => Array.from(new Set([...fallbackChatModels, ...prev].filter(Boolean))));
          }
        }
      } else {
        if (unsupported) {
          const fallbackImageModels = getImagePresetModelsBySiteKey(imageProviderKey);
          if (fallbackImageModels.length) {
            setImageModelOptions((prev) => Array.from(new Set([...fallbackImageModels, ...prev].filter(Boolean))));
          }
        }
      }
      if (unsupported) {
        if (!silent) appendLog("warn", "当前服务暂不支持模型列表，请手动输入模型", "api");
      } else if (!silent) {
        appendLog("error", `获取模型列表失败: ${msg}`, "api");
      }
      return false;
    } finally {
      setModelsLoadingBySection((prev) => ({ ...prev, [key]: false }));
    }
  };
  const updateModelDropdownPosition = (section = modelDropdown.section) => {
    const anchorRef = section === "chat" ? chatModelAnchorRef : imageModelAnchorRef;
    const anchorEl = anchorRef.current;
    if (!anchorEl) return;
    const rect = anchorEl.getBoundingClientRect();
    const pos = resolveFloatingPanelPosition(anchorEl, modelDropdownPanelRef.current, {
      mode: "auto",
      minWidth: 180,
      maxWidth: CHAT_HEADER_PANEL_WIDTH,
      fallbackWidth: Math.max(180, Math.round(rect.width || 0)),
      fallbackHeight: 340
    });
    if (!pos) return;
    setModelDropdown((prev) => mergeFloatingPatch(prev, {
      section,
      top: pos.top,
      left: pos.left,
      width: pos.width
    }, ["section", "top", "left", "width"]));
  };

  const openModelDropdown = (section) => {
    updateModelDropdownPosition(section);
    const currentModel = String(
      section === "chat" ? chatConfig.model : imageConfig.model
    ).trim();
    const customOnly = section === "chat"
      ? String(chatProviderKey || "") === "custom"
      : String(imageProviderKey || "") === "custom";
    setModelDropdown((prev) => ({
      ...prev,
      open: true,
      section,
      search: "",
      manualInputOpen: customOnly,
      manualInputValue: currentModel
    }));
    setModelGroupOpen({});
  };

  const closeModelDropdown = () => {
    setModelDropdown((prev) => ({ ...prev, open: false }));
  };

  const handlePickModel = (section, model) => {
    if (model === CUSTOM_MODEL_OPTION_VALUE) {
      const currentModel = String(
        section === "chat" ? chatConfig.model : imageConfig.model
      ).trim();
      setModelDropdown((prev) => ({
        ...prev,
        section,
        manualInputOpen: true,
        manualInputValue: currentModel || prev.search || ""
      }));
      return;
    }
    handleConfigField(section, "model", model);
    closeModelDropdown();
  };
  const handleApplyModelFromDropdownInput = () => {
    const value = String(modelDropdown.manualInputValue || "").trim();
    if (!value) return;
    handleConfigField(modelDropdown.section, "model", value);
    closeModelDropdown();
  };

  const updateProviderDropdownPosition = (section = providerDropdown.section) => {
    const anchorRef = section === "chat" ? chatProviderAnchorRef : imageProviderAnchorRef;
    const anchorEl = anchorRef.current;
    if (!anchorEl) return;
    const rect = anchorEl.getBoundingClientRect();
    const pos = resolveFloatingPanelPosition(anchorEl, providerDropdownPanelRef.current, {
      mode: "auto",
      minWidth: 180,
      maxWidth: CHAT_HEADER_PANEL_WIDTH,
      fallbackWidth: Math.max(180, Math.round(rect.width || 0)),
      fallbackHeight: 170
    });
    if (!pos) return;
    setProviderDropdown((prev) => mergeFloatingPatch(prev, {
      section,
      top: pos.top,
      left: pos.left,
      width: pos.width
    }, ["section", "top", "left", "width"]));
  };

  const openProviderDropdown = (section) => {
    updateProviderDropdownPosition(section);
    setProviderDropdown((prev) => ({ ...prev, open: true, section }));
    setProviderKnownOthersOpen((prev) => ({ ...prev, [section]: false }));
  };

  const closeProviderDropdown = () => {
    setProviderDropdown((prev) => ({ ...prev, open: false }));
  };

  const toggleKnownProvidersMore = (section) => {
    setProviderKnownOthersOpen((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const updateUiScaleDropdownPosition = () => {
    const anchorEl = uiScaleAnchorRef.current;
    if (!anchorEl) return;
    const rect = anchorEl.getBoundingClientRect();
    const pos = resolveFloatingPanelPosition(anchorEl, uiScaleDropdownPanelRef.current, {
      mode: "auto",
      minWidth: 96,
      maxWidth: CHAT_HEADER_PANEL_WIDTH,
      fallbackWidth: Math.max(Math.round(rect.width || 0), 96),
      fallbackHeight: (UI_SCALE_OPTIONS.length * 32 + 12)
    });
    if (!pos) return;
    setUiScaleDropdown((prev) => mergeFloatingPatch(prev, {
      top: pos.top,
      left: pos.left,
      width: pos.width
    }, ["top", "left", "width"]));
  };

  const closeUiScaleDropdown = () => {
    setUiScaleDropdown((prev) => (prev.open ? { ...prev, open: false } : prev));
  };

  const toggleUiScaleDropdown = () => {
    if (uiScaleDropdown.open) {
      closeUiScaleDropdown();
      return;
    }
    updateUiScaleDropdownPosition();
    setUiScaleDropdown((prev) => ({ ...prev, open: true }));
  };

  const handlePickUiScale = (value) => {
    handleScaleSelect(parseFloat(String(value)));
    closeUiScaleDropdown();
  };

  const updatePresetDropdownPosition = () => {
    const anchorEl = presetAnchorRef.current;
    if (!anchorEl) return;
    const rect = anchorEl.getBoundingClientRect();
    const pos = resolveFloatingPanelPosition(anchorEl, presetDropdownPanelRef.current, {
      mode: "auto",
      minWidth: 180,
      maxWidth: CHAT_HEADER_PANEL_WIDTH,
      fallbackWidth: Math.max(Math.round(rect.width || 0), 180),
      fallbackHeight: 220
    });
    if (!pos) return;
    setPresetDropdown((prev) => mergeFloatingPatch(prev, {
      top: pos.top,
      left: pos.left,
      width: pos.width
    }, ["top", "left", "width"]));
  };

  const openPresetDropdown = () => {
    updatePresetDropdownPosition();
    setPresetDropdown((prev) => ({ ...prev, open: true }));
  };

  const closePresetDropdown = () => {
    setPresetDropdown((prev) => ({ ...prev, open: false }));
  };

  const updateIdentityQuickPosition = () => {
    const anchorEl = identityQuickRef.current;
    if (!anchorEl) return;
    const pos = resolveFloatingPanelPosition(anchorEl, identityQuickPanelRef.current, {
      mode: "edge",
      minWidth: CHAT_HEADER_PANEL_WIDTH,
      maxWidth: CHAT_HEADER_PANEL_WIDTH,
      fallbackWidth: CHAT_HEADER_PANEL_WIDTH,
      fallbackHeight: 240
    });
    if (!pos) return;
    const nextPos = { top: pos.top, left: pos.left, width: pos.width };
    setIdentityQuickPos((prev) => replaceFloatingIfChanged(prev, nextPos, ["top", "left", "width"]));
  };

  const updateChatQuickConfigPosition = () => {
    const anchorEl = chatQuickConfigAnchorRef.current;
    if (!anchorEl) return;
    const pos = resolveFloatingPanelPosition(anchorEl, chatQuickConfigPanelRef.current, {
      mode: "edge",
      minWidth: CHAT_HEADER_PANEL_WIDTH,
      maxWidth: CHAT_HEADER_PANEL_WIDTH,
      fallbackWidth: CHAT_HEADER_PANEL_WIDTH,
      fallbackHeight: 560
    });
    if (!pos) return;
    const nextPos = { top: pos.top, left: pos.left, width: pos.width };
    setChatQuickConfigPos((prev) => replaceFloatingIfChanged(prev, nextPos, ["top", "left", "width"]));
  };

  const updateImageQuickConfigPosition = () => {
    const anchorEl = imageQuickConfigAnchorRef.current;
    if (!anchorEl) return;
    const pos = resolveFloatingPanelPosition(anchorEl, imageQuickConfigPanelRef.current, {
      mode: "edge",
      minWidth: CHAT_HEADER_PANEL_WIDTH,
      maxWidth: CHAT_HEADER_PANEL_WIDTH,
      fallbackWidth: CHAT_HEADER_PANEL_WIDTH,
      fallbackHeight: 520
    });
    if (!pos) return;
    const nextPos = { top: pos.top, left: pos.left, width: pos.width };
    setImageQuickConfigPos((prev) => replaceFloatingIfChanged(prev, nextPos, ["top", "left", "width"]));
  };

  const getChatQuickPromptActionAnchor = (id) => {
    const key = String(id || "");
    if (!key) return null;
    return chatQuickPromptActionRefs.current[key] || null;
  };

  const getImageQuickPromptActionAnchor = (id) => {
    const key = String(id || "");
    if (!key) return null;
    return imageQuickPromptActionRefs.current[key] || null;
  };

  const updateChatQuickPromptMenuPosition = (id) => {
    const anchorEl = getChatQuickPromptActionAnchor(id);
    if (!anchorEl) return;
    const rect = anchorEl.getBoundingClientRect();
    const pos = calcFloatingPanelPosition(rect, 132, 110, { mode: "end", gap: 4 });
    const nextPos = { top: pos.top, left: pos.left };
    setChatQuickPromptMenuPos((prev) => replaceFloatingIfChanged(prev, nextPos, ["top", "left"]));
  };

  const updateImageQuickPromptMenuPosition = (id) => {
    const anchorEl = getImageQuickPromptActionAnchor(id);
    if (!anchorEl) return;
    const rect = anchorEl.getBoundingClientRect();
    const pos = calcFloatingPanelPosition(rect, 132, 110, { mode: "end", gap: 4 });
    const nextPos = { top: pos.top, left: pos.left };
    setImageQuickPromptMenuPos((prev) => replaceFloatingIfChanged(prev, nextPos, ["top", "left"]));
  };

  const closeChatQuickPromptMenu = () => {
    setChatQuickPromptMenuOpenId("");
  };

  const closeImageQuickPromptMenu = () => {
    setImageQuickPromptMenuOpenId("");
  };

  const handleToggleChatQuickPromptMenu = (id, anchorEl) => {
    if (chatQuickPromptSelectMode) return;
    const key = String(id || "");
    if (!key) return;
    if (chatQuickPromptMenuOpenId === key) {
      closeChatQuickPromptMenu();
      return;
    }
    const targetAnchor = anchorEl || getChatQuickPromptActionAnchor(key);
    if (!targetAnchor) return;
    const rect = targetAnchor.getBoundingClientRect();
    const pos = calcFloatingPanelPosition(rect, 132, 110, { mode: "end", gap: 4 });
    const nextPos = { top: pos.top, left: pos.left };
    setChatQuickPromptMenuPos((prev) => replaceFloatingIfChanged(prev, nextPos, ["top", "left"]));
    setChatQuickPromptMenuOpenId(key);
  };

  const handleToggleImageQuickPromptMenu = (id, anchorEl) => {
    const key = String(id || "");
    if (!key) return;
    if (imageQuickPromptMenuOpenId === key) {
      closeImageQuickPromptMenu();
      return;
    }
    const targetAnchor = anchorEl || getImageQuickPromptActionAnchor(key);
    if (!targetAnchor) return;
    const rect = targetAnchor.getBoundingClientRect();
    const pos = calcFloatingPanelPosition(rect, 132, 110, { mode: "end", gap: 4 });
    const nextPos = { top: pos.top, left: pos.left };
    setImageQuickPromptMenuPos((prev) => replaceFloatingIfChanged(prev, nextPos, ["top", "left"]));
    setImageQuickPromptMenuOpenId(key);
  };

  const closeChatQuickPromptEditor = () => {
    setChatQuickPromptEditorOpenId("");
  };

  const closeImageQuickPromptEditor = () => {
    setImageQuickPromptEditorOpenId("");
  };

  const closeChatQuickPromptSelection = () => {
    setChatQuickPromptSelectMode(false);
    setChatQuickPromptSelectedIds([]);
  };

  const handleOpenChatQuickPromptEditor = (id) => {
    const key = String(id || "");
    const item = chatQuickPrompts.find((entry) => entry.id === key);
    if (!item) return;
    setChatQuickPromptEditorDraft({
      title: String(item.title || ""),
      content: String(item.content || "")
    });
    setChatQuickPromptEditorOpenId(key);
    setChatQuickPromptSelectMode(false);
    setChatQuickPromptSelectedIds([]);
    closeChatQuickPromptMenu();
  };

  const handleOpenImageQuickPromptEditor = (id) => {
    const key = String(id || "");
    const item = imageQuickPrompts.find((entry) => entry.id === key);
    if (!item) return;
    setImageQuickPromptEditorDraft({
      title: String(item.title || ""),
      content: String(item.content || "")
    });
    setImageQuickPromptEditorOpenId(key);
    closeImageQuickPromptMenu();
  };

  const handleSaveChatQuickPromptEditor = () => {
    if (!chatQuickPromptEditorOpenId) return;
    const nextTitle = stripEmojiForQuickTitle(chatQuickPromptEditorDraft.title).slice(0, CHAT_QUICK_PROMPT_TITLE_MAX);
    const nextContent = String(chatQuickPromptEditorDraft.content || "");
    setChatQuickPrompts((prev) => prev.map((item) => (
      item.id === chatQuickPromptEditorOpenId
        ? { ...item, title: nextTitle, content: nextContent, updatedAt: Date.now() }
        : item
    )));
    appendLog("info", "已更新对话预设", "system");
    closeChatQuickPromptEditor();
  };

  const handleSaveImageQuickPromptEditor = () => {
    if (!imageQuickPromptEditorOpenId) return;
    const nextTitle = stripEmojiForQuickTitle(imageQuickPromptEditorDraft.title).slice(0, CHAT_QUICK_PROMPT_TITLE_MAX);
    const nextContent = String(imageQuickPromptEditorDraft.content || "");
    setImageQuickPrompts((prev) => prev.map((item) => (
      item.id === imageQuickPromptEditorOpenId
        ? { ...item, title: nextTitle, content: nextContent, updatedAt: Date.now() }
        : item
    )));
    appendLog("info", "已更新指令预设", "system");
    closeImageQuickPromptEditor();
  };

  const handleCreateChatQuickPrompt = () => {
    const nextIndex = chatQuickPrompts.length + 1;
    const nextId = createQuickPromptId();
    const nextPrompt = {
      id: nextId,
      title: `预设${nextIndex}`,
      content: "",
      pinned: false,
      updatedAt: Date.now()
    };
    setChatQuickPrompts((prev) => [...prev, nextPrompt]);
    setChatQuickPromptEditorDraft({ title: nextPrompt.title, content: "" });
    setChatQuickPromptEditorOpenId(nextId);
    setChatQuickPromptSelectMode(false);
    setChatQuickPromptSelectedIds([]);
    closeChatQuickPromptMenu();
  };

  const handleCreateImageQuickPrompt = () => {
    const nextIndex = imageQuickPrompts.length + 1;
    const nextId = createQuickPromptId();
    const nextPrompt = {
      id: nextId,
      title: `指令${nextIndex}`,
      content: "",
      pinned: false,
      updatedAt: Date.now()
    };
    setImageQuickPrompts((prev) => [...prev, nextPrompt]);
    setImageQuickPromptEditorDraft({ title: nextPrompt.title, content: "" });
    setImageQuickPromptEditorOpenId(nextId);
    closeImageQuickPromptMenu();
  };

  const handleTogglePinChatQuickPrompt = (id) => {
    const key = String(id || "");
    if (!key) return;
    const target = chatQuickPrompts.find((item) => item.id === key);
    if (!target) return;
    if (!target.pinned) {
      const pinnedCount = chatQuickPrompts.filter((item) => item.pinned).length;
      if (pinnedCount >= CHAT_QUICK_PROMPT_PINNED_LIMIT) {
        appendLog("warn", `最多仅支持置顶 ${CHAT_QUICK_PROMPT_PINNED_LIMIT} 个预设`, "system");
        return;
      }
    }
    setChatQuickPrompts((prev) => prev.map((item) => (
      item.id === key
        ? { ...item, pinned: !item.pinned, updatedAt: Date.now() }
        : item
    )));
    closeChatQuickPromptMenu();
  };

  const handleTogglePinImageQuickPrompt = (id) => {
    const key = String(id || "");
    if (!key) return;
    const target = imageQuickPrompts.find((item) => item.id === key);
    if (!target) return;
    if (!target.pinned) {
      const pinnedCount = imageQuickPrompts.filter((item) => item.pinned).length;
      if (pinnedCount >= CHAT_QUICK_PROMPT_PINNED_LIMIT) {
        appendLog("warn", `最多仅支持置顶 ${CHAT_QUICK_PROMPT_PINNED_LIMIT} 个指令预设`, "system");
        return;
      }
    }
    setImageQuickPrompts((prev) => prev.map((item) => (
      item.id === key
        ? { ...item, pinned: !item.pinned, updatedAt: Date.now() }
        : item
    )));
    closeImageQuickPromptMenu();
  };

  const handleDeleteImageQuickPrompt = (id) => {
    const key = String(id || "");
    if (!key) return;
    const target = imageQuickPrompts.find((item) => item.id === key);
    if (!target) return;
    const ok = window.confirm(`确认删除指令预设“${target.title || "未命名"}”？`);
    if (!ok) return;
    setImageQuickPrompts((prev) => prev.filter((item) => item.id !== key));
    if (imageQuickPromptEditorOpenId === key) {
      closeImageQuickPromptEditor();
    }
    closeImageQuickPromptMenu();
    appendLog("warn", "已删除指令预设", "system");
  };

  const handleRequestDeletePreset = (ids) => {
    const list = Array.isArray(ids) ? ids : [ids];
    const normalizedIds = Array.from(new Set(list.map((item) => String(item || "").trim()).filter(Boolean)));
    if (!normalizedIds.length) return;
    const names = chatQuickPrompts
      .filter((item) => normalizedIds.includes(item.id))
      .map((item) => item.title || "未命名预设");
    setDeletePresetTarget({
      ids: normalizedIds,
      count: normalizedIds.length,
      name: names[0] || "未命名预设"
    });
    closeChatQuickPromptMenu();
  };

  const handleCancelDeletePreset = () => {
    setDeletePresetTarget(null);
  };

  const handleConfirmDeletePreset = () => {
    const ids = Array.isArray(deletePresetTarget?.ids) ? deletePresetTarget.ids : [];
    if (!ids.length) return;
    const idSet = new Set(ids);
    setChatQuickPrompts((prev) => prev.filter((item) => !idSet.has(item.id)));
    setChatQuickPromptSelectedIds((prev) => prev.filter((id) => !idSet.has(id)));
    closeChatQuickPromptMenu();
    if (ids.includes(chatQuickPromptEditorOpenId)) {
      closeChatQuickPromptEditor();
    }
    setDeletePresetTarget(null);
    appendLog("warn", `已删除预设 ${ids.length} 条`, "system");
  };

  const toggleChatQuickPromptSelectMode = () => {
    setChatQuickPromptSelectMode((prev) => {
      const next = !prev;
      if (!next) {
        setChatQuickPromptSelectedIds([]);
      } else {
        closeChatQuickPromptMenu();
        closeChatQuickPromptEditor();
      }
      return next;
    });
  };

  const handleToggleChatQuickPromptSelected = (id) => {
    const key = String(id || "");
    if (!key) return;
    setChatQuickPromptSelectedIds((prev) => (
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    ));
  };

  const handleToggleSelectAllChatQuickPrompts = () => {
    const ids = sortedChatQuickPrompts.map((item) => item.id);
    if (!ids.length) return;
    setChatQuickPromptSelectedIds((prev) => (prev.length === ids.length ? [] : ids));
  };

  const handleDeleteSelectedChatQuickPrompts = () => {
    if (!chatQuickPromptSelectedIds.length) return;
    handleRequestDeletePreset(chatQuickPromptSelectedIds);
  };

  const handleExportChatQuickPrompts = (ids = null) => {
    try {
      const idSet = Array.isArray(ids) && ids.length
        ? new Set(ids.map((item) => String(item || "").trim()).filter(Boolean))
        : null;
      const exporting = idSet
        ? chatQuickPrompts.filter((item) => idSet.has(item.id))
        : chatQuickPrompts;
      if (!exporting.length) {
        appendLog("warn", "没有可导出的预设", "system");
        return;
      }
      const payload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        prompts: exporting.map((item) => ({
          id: item.id,
          title: item.title,
          content: item.content,
          pinned: !!item.pinned,
          updatedAt: Number(item.updatedAt) || Date.now()
        }))
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
      const stamp = formatImageStamp(Date.now());
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `chat-quick-prompts-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
      appendLog("info", `预设已导出 ${exporting.length} 条`, "system");
    } catch (err) {
      appendLog("error", `导出预设失败: ${err?.message || "未知错误"}`, "api");
    }
  };

  const handleImportChatQuickPrompts = async (file) => {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const source = Array.isArray(parsed)
        ? parsed
        : (Array.isArray(parsed?.prompts) ? parsed.prompts : null);
      if (!source) throw new Error("文件格式不正确");
      const importedNormalized = source
        .map((item, index) => normalizeQuickPrompt(item, index))
        .filter(Boolean);
      if (!importedNormalized.length) {
        appendLog("warn", "导入文件中没有可用预设", "system");
        return;
      }

      const existing = Array.isArray(chatQuickPrompts) ? [...chatQuickPrompts] : [];
      const nextList = [...existing];
      const existingIds = new Set(existing.map((item) => String(item.id || "").trim()).filter(Boolean));
      let sequenceAdjustedCount = 0;

      importedNormalized.forEach((entry, index) => {
        let nextId = String(entry.id || "").trim();
        while (!nextId || existingIds.has(nextId)) {
          nextId = createQuickPromptId();
        }
        existingIds.add(nextId);

        const contentKey = normalizeQuickPromptContentKey(entry.content);
        const sameContentList = nextList.filter((item) => normalizeQuickPromptContentKey(item.content) === contentKey);
        let nextTitle = stripEmojiForQuickTitle(entry.title).slice(0, CHAT_QUICK_PROMPT_TITLE_MAX) || `预设${nextList.length + 1}`;
        if (sameContentList.length > 0) {
          nextTitle = addQuickPromptTitleSequence(nextTitle, sameContentList.length + 1);
          sequenceAdjustedCount += 1;
        }

        nextList.push({
          ...entry,
          id: nextId,
          title: nextTitle,
          pinned: false,
          updatedAt: Date.now() + index
        });
      });

      const merged = clampQuickPromptPinnedList(nextList);
      setChatQuickPrompts(merged);
      closeChatQuickPromptSelection();
      closeChatQuickPromptEditor();
      closeChatQuickPromptMenu();
      appendLog(
        "info",
        sequenceAdjustedCount > 0
          ? `已导入预设 ${importedNormalized.length} 条（${sequenceAdjustedCount} 条同内容已自动加序号）`
          : `已导入预设 ${importedNormalized.length} 条`,
        "system"
      );
    } catch (err) {
      appendLog("error", `导入预设失败: ${err?.message || "未知错误"}`, "api");
    }
  };

  const toggleIdentityQuickPanel = () => {
    if (identityQuickOpen) {
      setIdentityQuickOpen(false);
      closePresetDropdown();
      return;
    }
    updateIdentityQuickPosition();
    setIdentityQuickOpen(true);
    setHistoryOpen(false);
    setHistoryToolsOpen(false);
    setChatQuickConfigOpen(false);
    setImageQuickConfigOpen(false);
    closeImageQuickPromptMenu();
    closeImageQuickPromptEditor();
    closeChatQuickPromptMenu();
    closeChatQuickPromptEditor();
    closeChatQuickPromptSelection();
  };

  const toggleChatQuickConfigPanel = () => {
    if (chatQuickConfigOpen) {
      setChatQuickConfigOpen(false);
      closeChatQuickPromptMenu();
      closeChatQuickPromptEditor();
      closeChatQuickPromptSelection();
      closeImageQuickPromptMenu();
      return;
    }
    updateChatQuickConfigPosition();
    setChatQuickConfigOpen(true);
    setHistoryOpen(false);
    setHistoryToolsOpen(false);
    setIdentityQuickOpen(false);
    setImageQuickConfigOpen(false);
    closeImageQuickPromptMenu();
    closeImageQuickPromptEditor();
    closePresetDropdown();
  };

  const toggleImageQuickConfigPanel = () => {
    if (imageQuickConfigOpen) {
      setImageQuickConfigOpen(false);
      closeImageQuickPromptMenu();
      closeImageQuickPromptEditor();
      return;
    }
    updateImageQuickConfigPosition();
    setImageQuickConfigOpen(true);
    setHistoryOpen(false);
    setHistoryToolsOpen(false);
    setIdentityQuickOpen(false);
    setChatQuickConfigOpen(false);
    closeChatQuickPromptMenu();
    closeChatQuickPromptEditor();
    closeChatQuickPromptSelection();
    closePresetDropdown();
  };

  const handleApplyChatQuickPrompt = (item) => {
    const title = String(item?.title || "").trim() || "预设";
    const content = String(item?.content || "").trim();
    if (!content) {
      appendLog("warn", `预设“${title}”内容为空，请先在更多菜单中配置`, "system");
      return;
    }
    setChatInput(content);
    requestAnimationFrame(() => {
      if (!chatInputTextRef.current) return;
      chatInputTextRef.current.focus();
      autoResizeChatInput(chatInputTextRef.current);
      const cursor = chatInputTextRef.current.value.length;
      chatInputTextRef.current.setSelectionRange(cursor, cursor);
    });
  };

  const handleRunImageQuickPrompt = (item) => {
    const title = String(item?.title || "").trim() || "指令预设";
    const content = String(item?.content || "").trim();
    if (!content) {
      appendLog("warn", `指令预设“${title}”内容为空，请先编辑`, "system");
      return;
    }
    void handleRunLatest({
      promptText: content,
      imageSource: "upload"
    });
  };

  const setChatInputExpandedState = (expanded) => {
    const nextExpanded = !!expanded;
    if (chatInputRef.current) {
      chatInputRef.current.classList.toggle("is-expanded", nextExpanded);
    }
    if (chatCardRef.current) {
      chatCardRef.current.classList.toggle("is-input-expanded", nextExpanded);
    }
    if (chatModuleRef.current) {
      chatModuleRef.current.classList.toggle("is-input-expanded", nextExpanded);
    }
  };

  const collapseChatInput = (targetEl = chatInputTextRef.current) => {
    const el = targetEl;
    if (!el) return;
    el.style.height = `${CHAT_INPUT_MIN_HEIGHT}px`;
    el.style.overflowY = "hidden";
    el.classList.remove("is-scroll-active");
    el.classList.remove("is-expanded");
    setChatInputExpandedState(false);
  };

  const autoResizeChatInput = (targetEl = chatInputTextRef.current, options = {}) => {
    const el = targetEl;
    if (!el) return;
    const forceCollapse = !!options.forceCollapse;
    const isActive = forceCollapse
      ? false
      : (
        options.active === true
        || (typeof document !== "undefined" && document.activeElement === el)
      );
    if (!isActive) {
      collapseChatInput(el);
      return;
    }
    const chatCardHeight = Math.round(chatCardRef.current?.clientHeight || 0);
    const dynamicMax = chatCardHeight > 0
      ? Math.round(chatCardHeight * CHAT_INPUT_MAX_RATIO)
      : CHAT_INPUT_MAX_FALLBACK;
    const maxHeight = Math.max(CHAT_INPUT_MIN_HEIGHT, Math.min(CHAT_INPUT_MAX_CAP, dynamicMax));
    el.style.height = "auto";
    const nextHeight = Math.max(CHAT_INPUT_MIN_HEIGHT, Math.min(el.scrollHeight, maxHeight));
    el.style.height = `${nextHeight}px`;
    const overflow = el.scrollHeight > maxHeight;
    const expanded = nextHeight > (CHAT_INPUT_MIN_HEIGHT + 1);
    el.style.overflowY = overflow ? "auto" : "hidden";
    el.classList.toggle("is-scroll-active", overflow);
    el.classList.toggle("is-expanded", expanded);
    setChatInputExpandedState(expanded);
  };

  useEffect(() => {
    if (view !== "home") return;
    autoResizeChatInput();
  }, [chatInput, view]);

  useEffect(() => {
    if (view !== "home") return undefined;
    const onResize = () => autoResizeChatInput();
    window.addEventListener("resize", onResize);
    let observer = null;
    if (typeof ResizeObserver !== "undefined" && chatCardRef.current) {
      observer = new ResizeObserver(() => autoResizeChatInput());
      observer.observe(chatCardRef.current);
    }
    return () => {
      window.removeEventListener("resize", onResize);
      observer?.disconnect();
    };
  }, [view, uiScale]);

  useEffect(() => {
    const watchPointerDown = (
      modelDropdown.open
      || providerDropdown.open
      || uiScaleDropdown.open
      || presetDropdown.open
      || historyOpen
      || runHover
      || logFilterOpen
      || uploadSizeOpen
      || historyToolsOpen
      || chatQuickConfigOpen
      || imageQuickConfigOpen
      || !!chatQuickPromptMenuOpenId
      || !!imageQuickPromptMenuOpenId
      || !!chatQuickPromptEditorOpenId
      || !!imageQuickPromptEditorOpenId
      || identityQuickOpen
    );
    const watchWindowChange = (
      modelDropdown.open
      || providerDropdown.open
      || uiScaleDropdown.open
      || presetDropdown.open
      || historyOpen
      || logFilterOpen
      || runHover
      || generationCountOpen
      || generationSelectDropdown.open
      || uploadSizeOpen
      || historyToolsOpen
      || chatQuickConfigOpen
      || imageQuickConfigOpen
      || !!chatQuickPromptMenuOpenId
      || !!imageQuickPromptMenuOpenId
      || !!chatQuickPromptEditorOpenId
      || !!imageQuickPromptEditorOpenId
      || identityQuickOpen
      || !!sessionMenuOpenId
    );
    if (!watchPointerDown && !watchWindowChange) return undefined;

    const onPointerDown = (e) => {
      const target = e.target;

      if (modelDropdown.open) {
        const anchorRef = modelDropdown.section === "chat" ? chatModelAnchorRef : imageModelAnchorRef;
        const insideAnchor = anchorRef.current?.contains(target);
        const insidePanel = modelDropdownPanelRef.current?.contains(target);
        if (!insideAnchor && !insidePanel) closeModelDropdown();
      }

      if (providerDropdown.open) {
        const anchorRef = providerDropdown.section === "chat" ? chatProviderAnchorRef : imageProviderAnchorRef;
        const insideAnchor = anchorRef.current?.contains(target);
        const insidePanel = providerDropdownPanelRef.current?.contains(target);
        if (!insideAnchor && !insidePanel) closeProviderDropdown();
      }

      if (uiScaleDropdown.open) {
        const insideAnchor = uiScaleAnchorRef.current?.contains(target);
        const insidePanel = uiScaleDropdownPanelRef.current?.contains(target);
        if (!insideAnchor && !insidePanel) closeUiScaleDropdown();
      }

      if (presetDropdown.open) {
        const insideAnchor = presetAnchorRef.current?.contains(target);
        const insidePanel = presetDropdownPanelRef.current?.contains(target);
        if (!insideAnchor && !insidePanel) closePresetDropdown();
      }

      if (historyOpen) {
        const inSessionMenu = sessionMenuPortalRef.current?.contains(target);
        const inPanel = historyPanelRef.current?.contains(target);
        const inAnchor = historyPanelAnchorRef.current?.contains(target);
        if (inPanel && !target?.closest?.("[data-session-menu='1']")) {
          setSessionMenuOpenId("");
        }
        if (!inSessionMenu && !inPanel && !inAnchor) {
          setHistoryOpen(false);
          setSessionMenuOpenId("");
          setHistorySelectMode(false);
          setHistorySelectedIds([]);
        }
      }

      if (runHover) {
        const insideAnchor = runAnchorRef.current?.contains(target);
        const insidePopover = runPopoverRef.current?.contains(target);
        if (!insideAnchor && !insidePopover) {
          if (runHoverTimerRef.current) {
            clearTimeout(runHoverTimerRef.current);
            runHoverTimerRef.current = null;
          }
          setRunHover(false);
        }
      }

      if (logFilterOpen) {
        const insideAnchor = consoleFilterRef.current?.contains(target);
        const insidePanel = consoleFilterPanelRef.current?.contains(target);
        if (!insideAnchor && !insidePanel) {
          setLogFilterOpen(false);
        }
      }

      if (uploadSizeOpen) {
        const insideAnchor = uploadSizeToggleRef.current?.contains(target);
        const insidePanel = uploadSizePanelRef.current?.contains(target);
        if (!insideAnchor && !insidePanel) {
          setUploadSizeOpen(false);
        }
      }

      if (historyToolsOpen) {
        const insideAnchor = historyToolsAnchorRef.current?.contains(target);
        const insidePanel = historyToolsRef.current?.contains(target);
        if (!insideAnchor && !insidePanel) {
          setHistoryToolsOpen(false);
        }
      }

      if (chatQuickPromptMenuOpenId) {
        const insideMenu = chatQuickPromptMenuPortalRef.current?.contains(target);
        const anchorEl = getChatQuickPromptActionAnchor(chatQuickPromptMenuOpenId);
        const insideAnchor = anchorEl?.contains(target);
        if (!insideMenu && !insideAnchor) {
          closeChatQuickPromptMenu();
        }
      }

      if (imageQuickPromptMenuOpenId) {
        const insideMenu = imageQuickPromptMenuPortalRef.current?.contains(target);
        const anchorEl = getImageQuickPromptActionAnchor(imageQuickPromptMenuOpenId);
        const insideAnchor = anchorEl?.contains(target);
        if (!insideMenu && !insideAnchor) {
          closeImageQuickPromptMenu();
        }
      }

      if (chatQuickConfigOpen) {
        const insideAnchor = chatQuickConfigAnchorRef.current?.contains(target);
        const insidePanel = chatQuickConfigPanelRef.current?.contains(target);
        const insideQuickMenu = chatQuickPromptMenuPortalRef.current?.contains(target);
        if (!insideAnchor && !insidePanel && !insideQuickMenu) {
          setChatQuickConfigOpen(false);
          closeChatQuickPromptMenu();
          closeChatQuickPromptEditor();
          closeChatQuickPromptSelection();
        }
      }

      if (imageQuickConfigOpen) {
        const insideAnchor = imageQuickConfigAnchorRef.current?.contains(target);
        const insidePanel = imageQuickConfigPanelRef.current?.contains(target);
        const insideQuickMenu = imageQuickPromptMenuPortalRef.current?.contains(target);
        if (!insideAnchor && !insidePanel && !insideQuickMenu) {
          setImageQuickConfigOpen(false);
          closeImageQuickPromptMenu();
          closeImageQuickPromptEditor();
        }
      }

      if (identityQuickOpen) {
        const insideAnchor = identityQuickRef.current?.contains(target);
        const insidePanel = identityQuickPanelRef.current?.contains(target);
        const insidePresetPanel = presetDropdownPanelRef.current?.contains(target);
        if (!insideAnchor && !insidePanel && !insidePresetPanel) {
          setIdentityQuickOpen(false);
          closePresetDropdown();
        }
      }
    };

    let windowChangeRaf = 0;
    let lastWindowChangeSignature = "";
      const applyWindowChange = () => {
        if (modelDropdown.open) updateModelDropdownPosition(modelDropdown.section);
        if (providerDropdown.open) updateProviderDropdownPosition(providerDropdown.section);
        if (uiScaleDropdown.open) updateUiScaleDropdownPosition();
      if (presetDropdown.open) updatePresetDropdownPosition();
      if (historyOpen) updateHistoryPanelPosition();
      if (logFilterOpen) updateConsoleFilterPosition();
      if (runHover && runAnchorRef.current) {
        const rect = runAnchorRef.current.getBoundingClientRect();
        const pos = calcFloatingPanelPosition(rect, RUN_POPOVER_SIZE, RUN_POPOVER_SIZE, { mode: "center", preferY: "top", gap: 8 });
        const nextPos = { top: pos.top, left: pos.left };
        setRunPopoverPos((prev) => replaceFloatingIfChanged(prev, nextPos, ["top", "left"]));
      }
      if (generationCountOpen) updateGenerationCountDropdownPosition();
      if (generationSelectDropdown.open && generationSelectDropdown.kind) {
        updateGenerationSelectDropdownPosition(generationSelectDropdown.kind);
      }
      if (uploadSizeOpen) updateUploadSizePanelPosition();
      if (historyToolsOpen) updateHistoryToolsPosition();
      if (chatQuickConfigOpen) updateChatQuickConfigPosition();
      if (imageQuickConfigOpen) updateImageQuickConfigPosition();
      if (chatQuickPromptMenuOpenId) updateChatQuickPromptMenuPosition(chatQuickPromptMenuOpenId);
      if (imageQuickPromptMenuOpenId) updateImageQuickPromptMenuPosition(imageQuickPromptMenuOpenId);
      if (identityQuickOpen) updateIdentityQuickPosition();
      if (sessionMenuOpenId) setSessionMenuOpenId("");
    };
    const getWindowChangeSignature = () => {
      const viewportWidth = Math.round(window.visualViewport?.width || window.innerWidth || document.documentElement.clientWidth || 0);
      const viewportHeight = Math.round(window.visualViewport?.height || window.innerHeight || document.documentElement.clientHeight || 0);
      const viewportLeft = Math.round(window.visualViewport?.offsetLeft || 0);
      const viewportTop = Math.round(window.visualViewport?.offsetTop || 0);
      return `${viewportWidth}x${viewportHeight}@${viewportLeft},${viewportTop}`;
    };
    const onWindowChange = () => {
      if (windowChangeRaf) return;
      windowChangeRaf = requestAnimationFrame(() => {
        windowChangeRaf = 0;
        const signature = getWindowChangeSignature();
        if (signature === lastWindowChangeSignature) return;
        lastWindowChangeSignature = signature;
        applyWindowChange();
      });
    };

    if (watchPointerDown) {
      document.addEventListener("mousedown", onPointerDown);
    }
    if (watchWindowChange) {
      window.addEventListener("resize", onWindowChange);
      window.addEventListener("scroll", onWindowChange);
      lastWindowChangeSignature = "";
      onWindowChange();
    }
    return () => {
      if (watchPointerDown) {
        document.removeEventListener("mousedown", onPointerDown);
      }
      if (watchWindowChange) {
        window.removeEventListener("resize", onWindowChange);
        window.removeEventListener("scroll", onWindowChange);
      }
      if (windowChangeRaf) cancelAnimationFrame(windowChangeRaf);
    };
  }, [
    chatQuickConfigOpen,
    imageQuickConfigOpen,
    chatQuickPromptEditorOpenId,
    imageQuickPromptEditorOpenId,
    chatQuickPromptMenuOpenId,
    imageQuickPromptMenuOpenId,
    generationCountOpen,
    generationSelectDropdown.kind,
    generationSelectDropdown.open,
    historyOpen,
    identityQuickOpen,
    logFilterOpen,
    modelDropdown.open,
    modelDropdown.section,
    presetDropdown.open,
    providerDropdown.open,
    providerDropdown.section,
    uiScaleDropdown.open,
    runHover,
    sessionMenuOpenId,
    uploadSizeOpen,
    historyToolsOpen
  ]);
  useEffect(() => {
    if (!historyOpen) {
      setSessionMenuOpenId("");
      setHistorySelectMode(false);
      setHistorySelectedIds([]);
    }
  }, [historyOpen]);
  useEffect(() => {
    const idSet = new Set(sortedSessions.map((session) => session.id));
    setHistorySelectedIds((prev) => prev.filter((id) => idSet.has(id)));
    if (sessionMenuOpenId && !idSet.has(sessionMenuOpenId)) {
      setSessionMenuOpenId("");
    }
  }, [sortedSessions, sessionMenuOpenId]);
  useLayoutEffect(() => {
    if (!historyOpen) return undefined;
    updateHistoryPanelPosition();
    return undefined;
  }, [historyOpen, sortedSessions.length, sessionMenuOpenId]);
  useLayoutEffect(() => {
    if (!historyToolsOpen) return undefined;
    updateHistoryToolsPosition();
    return undefined;
  }, [historyToolsOpen]);
  useLayoutEffect(() => {
    if (!logFilterOpen) return undefined;
    updateConsoleFilterPosition();
    return undefined;
  }, [logFilterOpen, logFilters.length]);
  useLayoutEffect(() => {
    if (!chatQuickConfigOpen) return undefined;
    updateChatQuickConfigPosition();
    return undefined;
  }, [chatQuickConfigOpen, chatQuickPrompts]);
  useLayoutEffect(() => {
    if (!imageQuickConfigOpen) return undefined;
    updateImageQuickConfigPosition();
    return undefined;
  }, [imageQuickConfigOpen, imageQuickPrompts]);
  useEffect(() => {
    const idSet = new Set(chatQuickPrompts.map((item) => item.id));
    setChatQuickPromptSelectedIds((prev) => prev.filter((id) => idSet.has(id)));
    if (chatQuickPromptMenuOpenId && !idSet.has(chatQuickPromptMenuOpenId)) {
      closeChatQuickPromptMenu();
    }
    if (chatQuickPromptEditorOpenId && !idSet.has(chatQuickPromptEditorOpenId)) {
      closeChatQuickPromptEditor();
    }
  }, [chatQuickPrompts, chatQuickPromptEditorOpenId, chatQuickPromptMenuOpenId]);
  useEffect(() => {
    const idSet = new Set(imageQuickPrompts.map((item) => item.id));
    if (imageQuickPromptMenuOpenId && !idSet.has(imageQuickPromptMenuOpenId)) {
      closeImageQuickPromptMenu();
    }
    if (imageQuickPromptEditorOpenId && !idSet.has(imageQuickPromptEditorOpenId)) {
      closeImageQuickPromptEditor();
    }
  }, [imageQuickPrompts, imageQuickPromptEditorOpenId, imageQuickPromptMenuOpenId]);
  useEffect(() => {
    if (chatQuickConfigOpen) return;
    closeChatQuickPromptMenu();
    closeChatQuickPromptEditor();
    closeChatQuickPromptSelection();
  }, [chatQuickConfigOpen]);
  useEffect(() => {
    if (imageQuickConfigOpen) return;
    closeImageQuickPromptMenu();
    closeImageQuickPromptEditor();
  }, [imageQuickConfigOpen]);
  useLayoutEffect(() => {
    if (!chatQuickPromptMenuOpenId) return undefined;
    updateChatQuickPromptMenuPosition(chatQuickPromptMenuOpenId);
    return undefined;
  }, [chatQuickPromptMenuOpenId, chatQuickConfigOpen]);
  useLayoutEffect(() => {
    if (!imageQuickPromptMenuOpenId) return undefined;
    updateImageQuickPromptMenuPosition(imageQuickPromptMenuOpenId);
    return undefined;
  }, [imageQuickPromptMenuOpenId, imageQuickConfigOpen]);
  useLayoutEffect(() => {
    if (!identityQuickOpen) return undefined;
    updateIdentityQuickPosition();
    return undefined;
  }, [identityQuickOpen, chatConfig.systemPrompt, presetDropdown.open]);

  useEffect(() => {
    if (view !== "settings") {
      closeModelDropdown();
      closeProviderDropdown();
      closeUiScaleDropdown();
      closePresetDropdown();
      setIdentityQuickOpen(false);
      setChatQuickConfigOpen(false);
      setImageQuickConfigOpen(false);
      setHistoryToolsOpen(false);
    }
    if (view !== "home") {
      setHistoryOpen(false);
      setHistoryToolsOpen(false);
      setSessionMenuOpenId("");
      setIdentityQuickOpen(false);
      setChatQuickConfigOpen(false);
      setImageQuickConfigOpen(false);
      setLogFilterOpen(false);
      setUploadSizeOpen(false);
      closePresetDropdown();
      closeGenerationCountDropdown();
      closeGenerationSelectDropdown();
    }
  }, [view]);
  useEffect(() => {
    if (!generationCountOpen) return undefined;
    const onPointerDown = (event) => {
      const target = event.target;
      if (generationCountDropdownRef.current?.contains(target)) return;
      if (generationCountControlRef.current?.contains(target)) return;
      closeGenerationCountDropdown();
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") closeGenerationCountDropdown();
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [generationCountOpen]);
  useLayoutEffect(() => {
    if (!generationCountOpen) return undefined;
    updateGenerationCountDropdownPosition();
    return undefined;
  }, [generationCountOpen]);
  useLayoutEffect(() => {
    if (!modelDropdown.open) return undefined;
    updateModelDropdownPosition(modelDropdown.section);
    return undefined;
  }, [
    modelDropdown.open,
    modelDropdown.section,
    modelDropdown.search,
    modelDropdown.manualInputOpen,
    chatModelOptions.length,
    imageModelOptions.length,
    modelGroupOpen
  ]);
  useEffect(() => {
    if (!modelDropdown.open) return;
    requestAnimationFrame(() => {
      const el = modelDropdownInputRef.current;
      if (!el) return;
      el.focus();
      const cursor = el.value.length;
      el.setSelectionRange(cursor, cursor);
    });
  }, [modelDropdown.open, modelDropdown.section, modelDropdown.manualInputOpen]);
  useLayoutEffect(() => {
    if (!providerDropdown.open) return undefined;
    updateProviderDropdownPosition(providerDropdown.section);
    return undefined;
  }, [
    providerDropdown.open,
    providerDropdown.section,
    providerKnownOthersOpen.chat,
    providerKnownOthersOpen.image
  ]);
  useLayoutEffect(() => {
    if (!uiScaleDropdown.open) return undefined;
    updateUiScaleDropdownPosition();
    return undefined;
  }, [uiScaleDropdown.open]);
  useLayoutEffect(() => {
    if (!presetDropdown.open) return undefined;
    updatePresetDropdownPosition();
    return undefined;
  }, [presetDropdown.open]);
  useLayoutEffect(() => {
    if (!generationSelectDropdown.open || !generationSelectDropdown.kind) return undefined;
    updateGenerationSelectDropdownPosition(generationSelectDropdown.kind);
    return undefined;
  }, [generationSelectDropdown.open, generationSelectDropdown.kind]);
  useLayoutEffect(() => {
    if (!uploadSizeOpen) return undefined;
    updateUploadSizePanelPosition();
    return undefined;
  }, [uploadSizeOpen, imageCompressMaxSide, imageCompressQuality, uploadImageFormat]);
  useEffect(() => {
  /* eslint-enable react-hooks/exhaustive-deps */
    if (!generationSelectDropdown.open) return undefined;
    const onPointerDown = (event) => {
      const target = event.target;
      if (generationSelectDropdownRef.current?.contains(target)) return;
      if (generationSizeControlRef.current?.contains(target)) return;
      if (generationRatioControlRef.current?.contains(target)) return;
      closeGenerationSelectDropdown();
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") closeGenerationSelectDropdown();
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [generationSelectDropdown.open, generationSelectDropdown.kind]);
  const chatSiteKey = chatProviderKey;
  const imageSiteKey = imageProviderKey;
  const chatSiteLabel = CHAT_PROVIDER_SITES.find((item) => item.key === chatSiteKey)?.label || "自定义";
  const imageSiteLabel = IMAGE_PROVIDER_SITES.find((item) => item.key === imageSiteKey)?.label || "服务商";
  const chatProviderMode = normalizeChatProviderModeBySiteKey(chatSiteKey, chatConfig.providerMode);
  const imageProviderMode = normalizeImageProviderModeBySiteKey(imageSiteKey, imageConfig.providerMode);
  const chatApiFormatLabel = chatProviderMode === "google-native" ? "Google 兼容格式" : "OpenAI 兼容格式";
  const imageApiFormatLabel = imageProviderMode === "google-native" ? "Google 兼容格式" : "OpenAI 兼容格式";
  const chatModeSwitchEnabled = getChatProviderModeOptionsBySiteKey(chatSiteKey).length > 1;
  const imageModeSwitchEnabled = getImageProviderModeOptionsBySiteKey(imageSiteKey).length > 1;
  const canFetchChatModels = canFetchChatModelsBySiteKey(chatSiteKey);
  const canFetchImageModels = canFetchImageModelsBySiteKey(imageSiteKey);
  const chatProviderBaseUrl = getChatProviderByKey(chatSiteKey)?.baseUrl || "";
  const imageProviderBaseUrl = getImageProviderByKey(imageSiteKey)?.baseUrl || "";
  const chatModelHelpUrl = String(
    chatConfig.baseUrl || (chatSiteKey === "custom" ? "" : chatProviderBaseUrl)
  ).trim();
  const imageModelHelpUrl = String(
    imageConfig.baseUrl || (imageSiteKey === "custom" ? "" : imageProviderBaseUrl)
  ).trim();
  const chatPresetModels = useMemo(
    () => getChatPresetModelsBySiteKey(chatSiteKey),
    [chatSiteKey]
  );
  const chatCommonModels = useMemo(
    () => ((chatSiteKey === "aji") ? [] : FREQUENT_MODELS),
    [chatSiteKey]
  );
  const chatModelListSource = useMemo(
    () => {
      if (chatSiteKey === "aji") {
        return Array.from(new Set([...chatPresetModels, chatConfig.model].filter(Boolean)));
      }
      return Array.from(new Set([...chatPresetModels, ...chatCommonModels, chatConfig.model, ...chatModelOptions].filter(Boolean)));
    },
    [chatSiteKey, chatPresetModels, chatCommonModels, chatConfig.model, chatModelOptions]
  );
  const imagePresetModels = useMemo(
    () => getImagePresetModelsBySiteKey(imageSiteKey),
    [imageSiteKey]
  );
  const imageModelListSource = useMemo(
    () => Array.from(new Set([...imagePresetModels, imageConfig.model, ...imageModelOptions].filter(Boolean))),
    [imagePresetModels, imageConfig.model, imageModelOptions]
  );
  const allModelList = useMemo(
    () => (modelDropdown.section === "image" ? imageModelListSource : chatModelListSource),
    [modelDropdown.section, imageModelListSource, chatModelListSource]
  );
  const generationImageSize = useMemo(
    () => normalizeGenerationImageSize(imageConfig.generationImageSize),
    [imageConfig.generationImageSize]
  );
  const generationImageSizeApiValue = useMemo(
    () => toGenerationImageSizeApiValue(generationImageSize),
    [generationImageSize]
  );
  useEffect(() => {
    if (imageConfig.generationImageSize === generationImageSize) return;
    setImageConfig((prev) => ({ ...prev, generationImageSize }));
  }, [generationImageSize, imageConfig.generationImageSize]);
  const generationAspectRatio = useMemo(() => {
    const value = String(imageConfig.generationAspectRatio || "").toUpperCase();
    return IMAGE_ASPECT_RATIO_OPTIONS.some((item) => item.value === value) ? value : defaultImageConfig.generationAspectRatio;
  }, [imageConfig.generationAspectRatio]);
  const generationImageSizeLabel = useMemo(
    () => IMAGE_SIZE_OPTIONS.find((item) => item.value === generationImageSize)?.label || generationImageSize,
    [generationImageSize]
  );
  const generationAspectRatioLabel = useMemo(
    () => IMAGE_ASPECT_RATIO_OPTIONS.find((item) => item.value === generationAspectRatio)?.label || generationAspectRatio,
    [generationAspectRatio]
  );
  const generationCount = useMemo(() => {
    const parsed = Number.parseInt(String(imageConfig.generationCount), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultImageConfig.generationCount;
  }, [imageConfig.generationCount]);
  const generationCountSliderValue = Math.max(1, Math.min(GENERATION_COUNT_SLIDER_MAX, generationCount));
  const uploadMaxSideValue = useMemo(() => {
    const normalized = sanitizeUploadMaxSide(imageCompressMaxSide, "slider");
    return Number.isFinite(normalized) ? normalized : IMAGE_COMPRESS_MAX_SIDE_DEFAULT;
  }, [imageCompressMaxSide]);
  const uploadMaxSideSliderValue = Math.max(
    IMAGE_COMPRESS_MAX_SIDE_MIN,
    Math.min(IMAGE_COMPRESS_MAX_SIDE_SLIDER_MAX, uploadMaxSideValue)
  );
  const uploadImageFormatValue = normalizeUploadImageFormat(uploadImageFormat, IMAGE_COMPRESS_FORMAT_DEFAULT);
  const uploadQualityLocked = uploadImageFormatValue === "png";

  const uploadQualityPercentValue = (() => {
    if (uploadQualityLocked) return IMAGE_COMPRESS_QUALITY_DEFAULT;
    const normalized = sanitizeUploadQualityPercent(imageCompressQuality, "slider");
    return Number.isFinite(normalized) ? normalized : IMAGE_COMPRESS_QUALITY_DEFAULT;
  })();
  const uploadQualitySliderValue = Math.max(
    IMAGE_COMPRESS_QUALITY_MIN,
    Math.min(IMAGE_COMPRESS_QUALITY_SLIDER_MAX, uploadQualityPercentValue)
  );
  const modelGroups = useMemo(() => {
    const groups = {};
    allModelList.forEach((item) => {
      const provider = getModelProvider(item);
      if (!groups[provider]) groups[provider] = [];
      groups[provider].push(item);
    });
    Object.keys(groups).forEach((k) => {
      groups[k] = Array.from(new Set(groups[k])).sort((a, b) => a.localeCompare(b));
    });
    return groups;
  }, [allModelList]);
  const dropdownSearch = String(modelDropdown.search || "").trim().toLowerCase();
  const dropdownCommonModels = useMemo(() => {
    const source = modelDropdown.section === "image"
      ? imageModelListSource
      : (chatSiteKey === "aji"
        ? chatModelListSource
        : Array.from(new Set([...COMMON_MODEL_OPTIONS, ...chatModelListSource].filter(Boolean))));
    return source.filter((item) => !dropdownSearch || item.toLowerCase().includes(dropdownSearch));
  }, [modelDropdown.section, chatSiteKey, imageModelListSource, chatModelListSource, dropdownSearch]);
  const dropdownGroupedModels = useMemo(() => {
    if (modelDropdown.section === "chat" && chatSiteKey === "aji") return {};
    const groups = {};
    Object.entries(modelGroups).forEach(([provider, list]) => {
      const filtered = list.filter((item) => !dropdownSearch || item.toLowerCase().includes(dropdownSearch));
      if (filtered.length) groups[provider] = filtered;
    });
    return groups;
  }, [modelDropdown.section, chatSiteKey, modelGroups, dropdownSearch]);
  const handleExportHistory = () => {
    try {
      const sessionName = String(activeSession?.name || "对话记录").trim() || "对话记录";
      const sessionMessages = Array.isArray(messages) ? messages : [];
      if (!sessionMessages.length) {
        appendLog("warn", "当前对话没有可导出的记录", "system");
        return;
      }
      const payload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        session: {
          id: String(activeSession?.id || ""),
          name: sessionName
        },
        messages: sessionMessages.map((m, idx) => ({
          id: String(m?.id || `export-${Date.now()}-${idx}`),
          role: m?.role === "assistant" ? "assistant" : "user",
          text: String(m?.text || ""),
          images: Array.isArray(m?.images) ? m.images : [],
          status: String(m?.status || "done"),
          createdAt: m?.createdAt || new Date().toISOString(),
          error: m?.error ? String(m.error) : undefined,
          jsonPrompt: m?.jsonPrompt
        }))
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
      const stamp = formatImageStamp(Date.now());
      const safeSessionName = sessionName.replace(/[\\/:*?"<>|]/g, "_").slice(0, 32) || "dialog";
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `chat-history-${safeSessionName}-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
      appendLog("info", `已导出对话记录 ${payload.messages.length} 条`, "system");
    } catch (err) {
      appendLog("error", `导出对话记录失败: ${err?.message || "未知错误"}`, "api");
    }
  };

  const handleImportHistory = async (file) => {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const importedMessages = Array.isArray(parsed)
        ? parsed
        : (Array.isArray(parsed?.messages) ? parsed.messages : null);
      if (!importedMessages) throw new Error("文件格式不正确");
      const normalized = importedMessages
        .filter((m) => m && (m.role === "user" || m.role === "assistant"))
        .map((m, idx) => ({
          id: String(m.id || `import-${Date.now()}-${idx}`),
          role: m.role,
          text: String(m.text || ""),
          images: Array.isArray(m.images) ? m.images : [],
          status: String(m.status || "done"),
          createdAt: m.createdAt || new Date().toISOString(),
          error: m.error ? String(m.error) : undefined,
          jsonPrompt: m.jsonPrompt
        }));
      setActiveMessages(normalized);
      const latestAssistant = [...normalized].reverse().find((m) => m.role === "assistant" && m.text);
      if (latestAssistant) {
        const extracted = latestAssistant.jsonPrompt
          ? JSON.stringify(latestAssistant.jsonPrompt, null, 2)
          : extractJsonText(latestAssistant.text);
        setJsonPromptText(extracted || "");
      } else {
        setJsonPromptText("");
      }
      appendLog("info", `已导入对话内容 ${normalized.length} 条（仅本地显示）`, "system");
    } catch (err) {
      appendLog("error", `导入对话内容失败: ${err?.message || "未知错误"}`, "api");
    }
  };

  const handleCreateSession = () => {
    if (activeSession && isDraftSession(activeSession)) {
      setHistoryOpen(false);
      setSessionMenuOpenId("");
      return;
    }
    const session = createChatSession("新对话", []);
    setChatSessions((prev) => [session, ...prev]);
    setActiveChatSessionId(session.id);
    setHistoryOpen(false);
    setHistorySelectMode(false);
    setHistorySelectedIds([]);
    setSessionMenuOpenId("");
  };

  const handleRenameSession = (id) => {
    const current = chatSessions.find((s) => s.id === id);
    if (!current) return;
    const nextName = window.prompt("修改对话名称", current.name || "新对话");
    if (!nextName) return;
    const trimmed = String(nextName).trim();
    if (!trimmed) return;
    setChatSessions((prev) => prev.map((s) => (s.id === id
      ? {
          ...s,
          name: trimmed,
          updatedAt: Date.now()
        }
      : s)));
    setSessionMenuOpenId("");
  };

  const handleTogglePinSession = (id) => {
    const current = chatSessions.find((session) => session.id === id);
    if (!current || isDraftSession(current)) return;
    setChatSessions((prev) => prev.map((s) => (s.id === id ? { ...s, pinned: !s.pinned, updatedAt: Date.now() } : s)));
    setSessionMenuOpenId("");
  };

  const toggleHistorySelectMode = () => {
    setHistorySelectMode((prev) => {
      const next = !prev;
      if (!next) {
        setHistorySelectedIds([]);
      } else {
        setSessionMenuOpenId("");
      }
      return next;
    });
  };

  const handleToggleHistorySelected = (id) => {
    const key = String(id || "");
    if (!key) return;
    setHistorySelectedIds((prev) => (
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    ));
  };

  const handleToggleSelectAllHistory = () => {
    const ids = sortedSessions.map((session) => session.id);
    if (!ids.length) return;
    setHistorySelectedIds((prev) => (prev.length === ids.length ? [] : ids));
  };

  const handleDeleteSelectedSessions = () => {
    if (!historySelectedIds.length) return;
    handleRequestDeleteSession(historySelectedIds);
  };

  const updateConsoleFilterPosition = () => {
    const anchorEl = consoleFilterRef.current;
    if (!anchorEl) return;
    const pos = resolveFloatingPanelPosition(anchorEl, consoleFilterPanelRef.current, {
      mode: "auto",
      minWidth: 120,
      fallbackWidth: 120,
      fallbackHeight: 132
    });
    if (!pos) return;
    const nextPos = { top: pos.top, left: pos.left, width: pos.width };
    setConsoleFilterPos((prev) => replaceFloatingIfChanged(prev, nextPos, ["top", "left", "width"]));
  };

  const toggleLogFilterPanel = () => {
    setLogFilterOpen((prev) => {
      const next = !prev;
      if (next) {
        updateConsoleFilterPosition();
      }
      return next;
    });
  };

  const updateHistoryPanelPosition = () => {
    const anchorEl = chatHeaderActionsRef.current || historyPanelAnchorRef.current;
    if (!anchorEl) return;
    const pos = resolveFloatingPanelPosition(anchorEl, historyPanelRef.current, {
      mode: "auto",
      minWidth: CHAT_HEADER_PANEL_WIDTH,
      maxWidth: CHAT_HEADER_PANEL_WIDTH,
      fallbackWidth: CHAT_HEADER_PANEL_WIDTH,
      fallbackHeight: 300
    });
    if (!pos) return;
    const nextPos = { top: pos.top, left: pos.left, width: pos.width };
    setHistoryPanelPos((prev) => replaceFloatingIfChanged(prev, nextPos, ["top", "left", "width"]));
  };

  const updateHistoryToolsPosition = () => {
    const anchorEl = historyToolsAnchorRef.current;
    if (!anchorEl) return;
    const pos = resolveFloatingPanelPosition(anchorEl, historyToolsRef.current, {
      mode: "auto",
      minWidth: CHAT_HISTORY_TOOLS_PANEL_WIDTH,
      maxWidth: CHAT_HISTORY_TOOLS_PANEL_WIDTH,
      fallbackWidth: CHAT_HISTORY_TOOLS_PANEL_WIDTH,
      fallbackHeight: 110
    });
    if (!pos) return;
    const nextPos = { top: pos.top, left: pos.left, width: pos.width };
    setHistoryToolsPos((prev) => replaceFloatingIfChanged(prev, nextPos, ["top", "left", "width"]));
  };

  const toggleHistoryToolsPanel = () => {
    setHistoryToolsOpen((prev) => {
      const next = !prev;
      if (next) {
        updateHistoryToolsPosition();
      }
      return next;
    });
    setSessionMenuOpenId("");
    setHistorySelectMode(false);
    setHistorySelectedIds([]);
    setIdentityQuickOpen(false);
    setChatQuickConfigOpen(false);
    setImageQuickConfigOpen(false);
    closeImageQuickPromptMenu();
    closeImageQuickPromptEditor();
  };

  const handleToggleSessionMenu = (id, anchorEl) => {
    if (historySelectMode) return;
    if (!anchorEl) {
      setSessionMenuOpenId((prev) => (prev === id ? "" : id));
      return;
    }
    if (sessionMenuOpenId === id) {
      setSessionMenuOpenId("");
      return;
    }
    const rect = anchorEl.getBoundingClientRect();
    const menuWidth = 136;
    const menuHeight = 96;
    const pos = calcFloatingPanelPosition(rect, menuWidth, menuHeight, { mode: "end", gap: 4 });
    const nextPos = { top: pos.top, left: pos.left };
    setSessionMenuPos((prev) => replaceFloatingIfChanged(prev, nextPos, ["top", "left"]));
    setSessionMenuOpenId(id);
  };

  const handleRequestDeleteSession = (ids) => {
    const list = Array.isArray(ids) ? ids : [ids];
    const normalizedIds = Array.from(new Set(list.map((item) => String(item || "").trim()).filter(Boolean)));
    if (!normalizedIds.length) return;
    const current = chatSessions.find((s) => s.id === normalizedIds[0]);
    if (!current) return;
    setDeleteSessionTarget({
      ids: normalizedIds,
      count: normalizedIds.length,
      name: current.name || "未命名对话"
    });
    setSessionMenuOpenId("");
  };

  const handleCancelDeleteSession = () => {
    setDeleteSessionTarget(null);
  };

  const handleConfirmDeleteSession = () => {
    const targetIds = Array.isArray(deleteSessionTarget?.ids)
      ? deleteSessionTarget.ids
      : (deleteSessionTarget?.id ? [deleteSessionTarget.id] : []);
    if (!targetIds.length) return;
    const targetIdSet = new Set(targetIds);
    const removedName = deleteSessionTarget?.name || "未命名对话";
    let remaining = chatSessions.filter((s) => !targetIdSet.has(s.id));
    remaining = remaining.filter((s) => isValidConversation(s) || s.id === activeChatSessionId);
    let nextActiveId = activeChatSessionId;
    if (!remaining.length) {
      const fallback = createChatSession("新对话", []);
      remaining = [fallback];
      nextActiveId = fallback.id;
    } else if (targetIdSet.has(activeChatSessionId)) {
      nextActiveId = sortSessionsByPinAndUpdate(remaining)[0]?.id || remaining[0].id;
    } else if (!remaining.some((session) => session.id === nextActiveId)) {
      nextActiveId = sortSessionsByPinAndUpdate(remaining)[0]?.id || remaining[0].id;
    }
    setChatSessions(remaining);
    setActiveChatSessionId(nextActiveId);
    setHistorySelectedIds((prev) => prev.filter((id) => !targetIdSet.has(id)));
    setHistorySelectMode(false);
    setDeleteSessionTarget(null);
    setSessionMenuOpenId("");
    if (targetIds.length > 1) {
      appendLog("warn", `已删除对话 ${targetIds.length} 个`, "system");
    } else {
      appendLog("warn", `已删除对话：${removedName}`, "system");
    }
  };

  const handleToggleSessionPanel = () => {
    setHistoryOpen((prev) => {
      const next = !prev;
      if (next) {
        updateHistoryPanelPosition();
      } else {
        setSessionMenuOpenId("");
        setHistorySelectMode(false);
        setHistorySelectedIds([]);
      }
      return next;
    });
    setHistoryToolsOpen(false);
    setIdentityQuickOpen(false);
    setChatQuickConfigOpen(false);
    setImageQuickConfigOpen(false);
    closeImageQuickPromptMenu();
    closeImageQuickPromptEditor();
  };

  const handleSwitchSession = (id) => {
    if (historySelectMode) {
      handleToggleHistorySelected(id);
      return;
    }
    const currentId = activeSession?.id;
    if (currentId && currentId !== id) {
      setChatSessions((prev) => prev.filter((session) => !(session.id === currentId && isDraftSession(session))));
    }
    setActiveChatSessionId(id);
    setHistoryOpen(false);
    setSessionMenuOpenId("");
    setChatQuickConfigOpen(false);
    setImageQuickConfigOpen(false);
    closeImageQuickPromptMenu();
    closeImageQuickPromptEditor();
  };

  const getImageCompressionOptions = () => {
    const maxSideSafe = sanitizeUploadMaxSide(imageCompressMaxSide, "slider");
    const qualityPercentSafe = sanitizeUploadQualityPercent(imageCompressQuality, "slider");
    const format = normalizeUploadImageFormat(uploadImageFormat, IMAGE_COMPRESS_FORMAT_DEFAULT);
    const maxSide = Number.isFinite(maxSideSafe) ? maxSideSafe : IMAGE_COMPRESS_MAX_SIDE_DEFAULT;
    const qualityPercent = format === "png"
      ? IMAGE_COMPRESS_QUALITY_DEFAULT
      : (Number.isFinite(qualityPercentSafe) ? qualityPercentSafe : IMAGE_COMPRESS_QUALITY_DEFAULT);
    const quality = Math.max(0.01, Math.min(1, qualityPercent / 100));
    return { maxSide, quality, format };
  };

  const compressImageDataUrl = async (dataUrl, mimeType, options = {}) => {
    const sourceUrl = String(dataUrl || "");
    if (!sourceUrl.startsWith("data:image/")) return sourceUrl;
    const maxSide = Math.max(IMAGE_COMPRESS_MAX_SIDE_MIN, Math.min(IMAGE_COMPRESS_MAX_SIDE_HARD_MAX, Number(options.maxSide) || IMAGE_COMPRESS_MAX_SIDE_DEFAULT));
    const format = normalizeUploadImageFormat(options.format, IMAGE_COMPRESS_FORMAT_DEFAULT);
    const quality = format === "png"
      ? 1
      : Math.max(0.01, Math.min(1, Number(options.quality) || (IMAGE_COMPRESS_QUALITY_DEFAULT / 100)));
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("image-load-failed"));
      image.src = sourceUrl;
    });
    const width = Number(img.width) || 0;
    const height = Number(img.height) || 0;
    if (!width || !height) return sourceUrl;
    const longest = Math.max(width, height);
    const scale = longest > maxSide ? (maxSide / longest) : 1;
    const targetW = Math.max(1, Math.round(width * scale));
    const targetH = Math.max(1, Math.round(height * scale));
    const sourceMime = String(
      mimeType
      || sourceUrl.match(/^data:([^;,]+)/i)?.[1]
      || "image/jpeg"
    ).toLowerCase();
    const outputType = format === "png" ? "image/png" : "image/jpeg";
    const sourceIsPng = sourceMime.includes("png");
    const sourceIsJpeg = sourceMime.includes("jpeg") || sourceMime.includes("jpg");
    const formatChanged = (outputType === "image/png" && !sourceIsPng)
      || (outputType === "image/jpeg" && !sourceIsJpeg);
    const shouldReencode = scale < 1 || formatChanged || (outputType !== "image/png" && quality < 0.995);
    if (!shouldReencode) return sourceUrl;
    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return sourceUrl;
    ctx.drawImage(img, 0, 0, targetW, targetH);
    const result = canvas.toDataURL(outputType, outputType === "image/png" ? undefined : quality);
    return result || sourceUrl;
  };

  const filterImageFiles = (files) => Array.from(files || []).filter((f) => f?.type && f.type.startsWith("image/"));
  const hasFileDragType = (dataTransfer) => Array.from(dataTransfer?.types || []).includes("Files");
  const isUploadFileDragEvent = (dataTransfer) => hasFileDragType(dataTransfer);
  const readSingleImageFileAsDataUrl = (file) => new Promise((resolve) => {
    try {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => resolve("");
      reader.readAsDataURL(file);
    } catch {
      resolve("");
    }
  });
  const normalizeLoadedImages = (list) => (
    Array.from(list || [])
      .filter((item) => item && typeof item.dataUrl === "string" && item.dataUrl.startsWith("data:image/"))
      .map((item) => {
        const target = resolveImageTarget(item);
        const width = Number(item?.width);
        const height = Number(item?.height);
        const rawMeta = item?.meta && typeof item.meta === "object" ? { ...item.meta } : {};
        if (target.targetDocumentId && !Number.isFinite(Number(rawMeta.documentId))) {
          rawMeta.documentId = target.targetDocumentId;
        }
        if (target.targetDocumentName && !String(rawMeta.documentName || "").trim()) {
          rawMeta.documentName = target.targetDocumentName;
        }
        const meta = Object.keys(rawMeta).length ? rawMeta : undefined;
        return {
          id: item.id || `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: String(item.name || "image"),
          originName: String(item.originName || item.name || "image"),
          type: String(item.type || "image/*"),
          source: normalizeImageSourceTag(item.source),
          capturedAt: Number.isFinite(item.capturedAt) ? item.capturedAt : Date.now(),
          slotIndex: Number.isFinite(item.slotIndex) ? item.slotIndex : undefined,
          psCacheId: typeof item.psCacheId === "string" ? item.psCacheId : "",
          psCacheExpiresAt: Number.isFinite(item.psCacheExpiresAt) ? Number(item.psCacheExpiresAt) : undefined,
          width: Number.isFinite(width) && width > 0 ? width : undefined,
          height: Number.isFinite(height) && height > 0 ? height : undefined,
          targetRect: target.targetRect || null,
          targetRectNorm: target.targetRectNorm || undefined,
          targetCanvas: target.targetCanvas || undefined,
          targetDocumentId: target.targetDocumentId || undefined,
          targetDocumentName: target.targetDocumentName || undefined,
          meta,
          dataUrl: String(item.dataUrl)
        };
      })
  );
  const getUploadSlotLabel = (slotIndex, hasImage = true) => (hasImage ? `图片 ${slotIndex + 1}` : "本地上传");
  const insertLoadedImagesAtIndex = (prev, loaded, toIndex = -1) => {
    const next = [...(Array.isArray(prev) ? prev : [])];
    const safeLoaded = normalizeLoadedImages(loaded);
    if (!safeLoaded.length) return next;
    if (!Number.isFinite(toIndex) || toIndex < 0) {
      const merged = [...next];
      safeLoaded.forEach((item) => {
        if (merged.length >= MAX_UPLOAD_IMAGES) return;
        const slotIndex = merged.length;
        merged.push({ ...item, slotIndex });
      });
      return merged.slice(0, MAX_UPLOAD_IMAGES);
    }
    let writeIndex = Math.max(0, Math.min(Number(toIndex), MAX_UPLOAD_IMAGES - 1));
    const replaced = [...next];
    safeLoaded.forEach((item) => {
      if (writeIndex >= MAX_UPLOAD_IMAGES) return;
      replaced[writeIndex] = { ...item, slotIndex: writeIndex };
      writeIndex += 1;
    });
    return replaced.slice(0, MAX_UPLOAD_IMAGES);
  };
  const commitUploadImages = (nextImages) => {
    const safeNext = Array.isArray(nextImages) ? nextImages : [];
    uploadImagesRef.current = safeNext;
    setUploadImages(safeNext);
  };
  const pushLoadedImages = (loaded, options = {}) => {
    const safeLoaded = normalizeLoadedImages(loaded);
    if (!safeLoaded.length) return 0;
    const rawToIndex = Number.isInteger(options.toIndex) ? options.toIndex : -1;
    const toIndex = rawToIndex >= 0 ? Math.max(0, Math.min(rawToIndex, MAX_UPLOAD_IMAGES - 1)) : -1;
    const current = Array.isArray(uploadImagesRef.current) ? uploadImagesRef.current : [];
    const acceptedCount = toIndex >= 0
      ? Math.max(0, Math.min(safeLoaded.length, MAX_UPLOAD_IMAGES - toIndex))
      : Math.max(0, Math.min(safeLoaded.length, MAX_UPLOAD_IMAGES - current.length));
    const overflowCount = Math.max(0, safeLoaded.length - acceptedCount);
    if (acceptedCount <= 0) {
      showCopyToast(`最多可添加 ${MAX_UPLOAD_IMAGES} 张图片`, {
        mode: "upload-limit",
        durationMs: UPLOAD_LIMIT_TOAST_MS
      });
      appendLog("warn", `图片最多支持 ${MAX_UPLOAD_IMAGES} 张，超出部分未添加`, "system");
      return 0;
    }
    const next = insertLoadedImagesAtIndex(current, safeLoaded, toIndex);
    commitUploadImages(next);
    if (options.logText) {
      appendLog("info", `${String(options.logText).trim()}（${acceptedCount} 张）`, "system");
    }
    if (overflowCount > 0) {
      showCopyToast(`最多可添加 ${MAX_UPLOAD_IMAGES} 张图片`, {
        mode: "upload-limit",
        durationMs: UPLOAD_LIMIT_TOAST_MS
      });
      appendLog("warn", `超出上限，已忽略 ${overflowCount} 张图片`, "system");
    }
    return acceptedCount;
  };
  const readImageFiles = async (files, options = {}) => {
    const list = filterImageFiles(files);
    if (!list.length) return [];
    const source = normalizeImageSourceTag(options.source);
    const startedAt = Date.now();
    setMiniConsole("取图处理中", "busy", "正在读取图片数据。");
    try {
      const compression = getImageCompressionOptions();
      setMiniConsole("编码处理中", "busy", "正在执行图片编解码与压缩。");
      const normalized = [];
      for (let index = 0; index < list.length; index += 1) {
        const file = list[index];
        let rawDataUrl = await readSingleImageFileAsDataUrl(file);
        if (!rawDataUrl.startsWith("data:image/")) continue;
        const loadedItem = normalizeLoadedImages([{
          id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: file.name,
          originName: file.name,
          type: file.type,
          source,
          capturedAt: Date.now(),
          dataUrl: rawDataUrl
        }])[0];
        rawDataUrl = "";
        if (!loadedItem) continue;
        const compressedDataUrl = await compressImageDataUrl(loadedItem.dataUrl, loadedItem.type, compression);
        if (!String(compressedDataUrl).startsWith("data:image/")) continue;
        normalized.push({
          ...loadedItem,
          dataUrl: compressedDataUrl
        });
      }
      const cachedImages = await cachePsBridgeImages(normalized, { action: source, slotIndex: -1 });
      const compactedImages = await compactUploadInlinePreview(cachedImages, compression);
      appendTraceLog({
        level: "info",
        type: "system",
        domain: "图片处理",
        phase: "完成",
        message: `来源 ${source || "local"}，读取 ${list.length} 张，编解码完成 ${compactedImages.length} 张。`,
        startedAt,
        endedAt: Date.now()
      });
      setMiniConsole("图片已就绪", "ok", "图片处理完成。");
      return compactedImages;
    } catch (err) {
      const raw = String(err?.message || err || "图片处理失败");
      appendTraceLog({
        level: "error",
        type: "system",
        domain: "图片处理",
        phase: "错误",
        message: raw,
        startedAt,
        endedAt: Date.now(),
        guide: "请检查源图片格式与内存占用；必要时降低上传尺寸/质量后重试。"
      });
      setMiniConsole("取图失败", "error", "图片处理失败。请打开大控制台查看修复指引。");
      return [];
    }
  };
  const cachePsBridgeImages = async (images, context = {}) => {
    const safeImages = normalizeLoadedImages(images);
    if (!safeImages.length) return safeImages;
    const putPsCache = window.shell?.psCachePut;
    if (typeof putPsCache !== "function") return safeImages;
    try {
      const items = safeImages.map((item, idx) => ({
        clientRef: item.id || `ps-img-${idx + 1}`,
        name: item.name,
        originName: item.originName,
        type: item.type,
        source: item.source,
        role: item.role,
        slotIndex: item.slotIndex,
        dataUrl: item.dataUrl,
        meta: {
          action: String(context.action || ""),
          slotIndex: Number.isFinite(context.slotIndex) ? Number(context.slotIndex) : -1
        }
      }));
      const result = await putPsCache({
        ttlMs: PS_UPLOAD_CACHE_TTL_MS,
        items
      });
      const mapped = new Map(
        Array.isArray(result?.items)
          ? result.items
              .map((item) => [String(item?.clientRef || ""), item])
              .filter(([key]) => !!key)
          : []
      );
      return safeImages.map((item, idx) => {
        const key = String(item.id || `ps-img-${idx + 1}`);
        const hit = mapped.get(key);
        if (!hit) return item;
        return {
          ...item,
          psCacheId: String(hit.cacheId || ""),
          psCacheExpiresAt: Number.isFinite(hit.expiresAt) ? Number(hit.expiresAt) : undefined
        };
      });
    } catch {
      return safeImages;
    }
  };
  const compactUploadInlinePreview = async (images, compression = null) => {
    const list = Array.isArray(images) ? images : [];
    if (!list.length) return [];
    const baseMaxSide = Number(compression?.maxSide);
    const baseQuality = Number(compression?.quality);
    const format = normalizeUploadImageFormat(compression?.format, IMAGE_COMPRESS_FORMAT_DEFAULT);
    const previewMaxSide = Math.max(
      IMAGE_COMPRESS_MAX_SIDE_MIN,
      Math.min(
        UPLOAD_UI_PREVIEW_MAX_SIDE,
        Number.isFinite(baseMaxSide) && baseMaxSide > 0 ? baseMaxSide : UPLOAD_UI_PREVIEW_MAX_SIDE
      )
    );
    const previewQuality = Math.max(
      0.01,
      Math.min(
        UPLOAD_UI_PREVIEW_MAX_QUALITY,
        Number.isFinite(baseQuality) && baseQuality > 0 ? baseQuality : UPLOAD_UI_PREVIEW_MAX_QUALITY
      )
    );
    const next = [];
    for (const item of list) {
      if (!item || typeof item !== "object") {
        next.push(item);
        continue;
      }
      const hasPsCache = !!String(item.psCacheId || item.cacheId || "").trim();
      const inline = String(item.dataUrl || "").trim();
      if (!hasPsCache || !inline.startsWith("data:image/")) {
        next.push(item);
        continue;
      }
      try {
        const compactedDataUrl = await compressImageDataUrl(inline, item.type, {
          maxSide: previewMaxSide,
          quality: previewQuality,
          format
        });
        next.push({
          ...item,
          dataUrl: String(compactedDataUrl || inline)
        });
      } catch {
        next.push(item);
      }
    }
    return next;
  };
  const commitUploadReorder = (fromIndex, rawToIndex) => {
    const current = Array.isArray(uploadImagesRef.current) ? uploadImagesRef.current : [];
    if (!Number.isInteger(fromIndex) || !Number.isInteger(rawToIndex)) return false;
    if (fromIndex < 0 || rawToIndex < 0 || fromIndex >= current.length || rawToIndex >= current.length) return false;
    if (fromIndex === rawToIndex) return false;
    const next = [...current];
    const [moved] = next.splice(fromIndex, 1);
    const safeToIndex = Math.max(0, Math.min(rawToIndex, next.length));
    next.splice(safeToIndex, 0, moved);
    commitUploadImages(next.map((item, idx) => (item ? { ...item, slotIndex: idx } : item)));
    appendLog("info", `已调整图片顺序：${fromIndex + 1} -> ${safeToIndex + 1}`, "system");
    return true;
  };
  const calcUploadPointerDragStep = (slotIndex) => {
    const host = uploadSlotsRef.current;
    const slotEl = uploadSlotRefs.current?.[slotIndex] || host?.querySelector?.(".upload-slot.has-image");
    const slotWidth = Number(slotEl?.getBoundingClientRect?.().width) || 72;
    const hostStyles = host ? window.getComputedStyle(host) : null;
    const gap = Number.parseFloat(
      hostStyles?.columnGap
      || hostStyles?.gap
      || "12"
    );
    const safeGap = Number.isFinite(gap) ? gap : 12;
    const step = slotWidth + safeGap;
    return step > 0 ? step : UPLOAD_POINTER_DRAG_STEP_FALLBACK;
  };
  const renderUploadPointerDragVisual = (drag) => {
    const slots = uploadSlotRefs.current || [];
    const images = Array.isArray(uploadImagesRef.current) ? uploadImagesRef.current : [];
    const fromIndex = Number(drag?.from);
    const toIndex = Number(drag?.to);
    const step = Number(drag?.step) > 0 ? Number(drag.step) : UPLOAD_POINTER_DRAG_STEP_FALLBACK;
    const deltaX = Number.isFinite(Number(drag?.deltaX)) ? Number(drag.deltaX) : 0;
    slots.forEach((slotEl, idx) => {
      if (!slotEl) return;
      const hasImage = !!images[idx]?.dataUrl;
      if (!hasImage || !drag?.active) {
        slotEl.style.removeProperty("transform");
        slotEl.classList.remove("is-pointer-dragging");
        return;
      }
      let translateX = 0;
      if (idx === fromIndex) {
        translateX = deltaX;
        slotEl.classList.add("is-pointer-dragging");
      } else {
        slotEl.classList.remove("is-pointer-dragging");
        if (fromIndex < toIndex && idx > fromIndex && idx <= toIndex) {
          translateX = -step;
        } else if (fromIndex > toIndex && idx >= toIndex && idx < fromIndex) {
          translateX = step;
        }
      }
      if (translateX) {
        slotEl.style.transform = `translate3d(${translateX}px, 0, 0)`;
      } else {
        slotEl.style.removeProperty("transform");
      }
    });
  };
  const clearUploadPointerDragVisual = () => {
    (uploadSlotRefs.current || []).forEach((slotEl) => {
      if (!slotEl) return;
      slotEl.style.removeProperty("transform");
      slotEl.classList.remove("is-pointer-dragging");
    });
  };
  const flushUploadPointerDragMove = () => {
    uploadPointerMoveRafRef.current = 0;
    const pointerX = Number(uploadPointerMovePendingXRef.current);
    if (!Number.isFinite(pointerX)) return;
    const drag = uploadPointerDragRef.current;
    if (!drag.active) return;
    const images = Array.isArray(uploadImagesRef.current) ? uploadImagesRef.current : [];
    const maxIndex = Math.max(0, images.length - 1);
    if (maxIndex <= 0) {
      uploadPointerDragRef.current = {
        ...drag,
        to: drag.from,
        deltaX: 0
      };
      renderUploadPointerDragVisual(uploadPointerDragRef.current);
      return;
    }
    const host = uploadSlotsRef.current;
    let scrollLeft = Number(host?.scrollLeft) || 0;
    if (host) {
      const rect = host.getBoundingClientRect();
      const edgeThreshold = 34;
      const maxScroll = Math.max(0, (Number(host.scrollWidth) || 0) - (Number(host.clientWidth) || 0));
      if (pointerX < rect.left + edgeThreshold) {
        const speed = Math.max(4, (rect.left + edgeThreshold - pointerX) * 0.34);
        scrollLeft = Math.max(0, scrollLeft - speed);
      } else if (pointerX > rect.right - edgeThreshold) {
        const speed = Math.max(4, (pointerX - (rect.right - edgeThreshold)) * 0.34);
        scrollLeft = Math.min(maxScroll, scrollLeft + speed);
      }
      if (host.scrollLeft !== scrollLeft) {
        host.scrollLeft = scrollLeft;
      }
    }
    const step = drag.step > 0 ? drag.step : UPLOAD_POINTER_DRAG_STEP_FALLBACK;
    const rawDelta = (pointerX - drag.startX) + (scrollLeft - drag.startScrollLeft);
    const minDelta = (0 - drag.from) * step;
    const maxDelta = (maxIndex - drag.from) * step;
    const clampedDelta = Math.max(minDelta, Math.min(maxDelta, rawDelta));
    const slotsOffset = clampedDelta / step;
    const roundedOffset = slotsOffset >= 0
      ? Math.floor(slotsOffset + 0.5)
      : Math.ceil(slotsOffset - 0.5);
    const nextTo = Math.max(0, Math.min(maxIndex, drag.from + roundedOffset));
    uploadPointerDragRef.current = {
      ...drag,
      to: nextTo,
      deltaX: clampedDelta
    };
    renderUploadPointerDragVisual(uploadPointerDragRef.current);
  };
  const stopUploadPointerDrag = (commit = true) => {
    const drag = uploadPointerDragRef.current;
    if (!drag.active) return;
    if (typeof uploadPointerCleanupRef.current === "function") {
      uploadPointerCleanupRef.current();
      uploadPointerCleanupRef.current = null;
    }
    if (uploadPointerMoveRafRef.current) {
      cancelAnimationFrame(uploadPointerMoveRafRef.current);
      uploadPointerMoveRafRef.current = 0;
    }
    uploadPointerMovePendingXRef.current = NaN;
    const host = uploadSlotsRef.current;
    host?.classList?.add("is-pointer-drop-commit");
    document.body.classList.remove("upload-pointer-dragging");
    const fromIndex = Number(drag.from);
    const toIndex = Number(drag.to);
    const shouldCommit = commit && Number.isInteger(fromIndex) && Number.isInteger(toIndex) && fromIndex !== toIndex;
    if (shouldCommit) {
      flushSync(() => {
        commitUploadReorder(fromIndex, toIndex);
      });
    }
    clearUploadPointerDragVisual();
    host?.classList?.remove("is-pointer-drag-active");
    uploadPointerDragRef.current = {
      active: false,
      from: -1,
      to: -1,
      deltaX: 0,
      startX: 0,
      startScrollLeft: 0,
      step: UPLOAD_POINTER_DRAG_STEP_FALLBACK,
      pointerId: -1
    };
    if (host) {
      requestAnimationFrame(() => {
        host.classList.remove("is-pointer-drop-commit");
      });
    }
  };
  const handleUploadSlotPointerDown = (slotIndex, event) => {
    if (!Number.isInteger(slotIndex) || slotIndex < 0) return;
    if ((event.button ?? 0) !== 0) return;
    const current = Array.isArray(uploadImagesRef.current) ? uploadImagesRef.current : [];
    if (!current[slotIndex]?.dataUrl) return;
    const host = uploadSlotsRef.current;
    if (!host) return;
    const startX = Number(event.clientX);
    if (!Number.isFinite(startX)) return;
    event.preventDefault();
    event.stopPropagation();
    stopUploadPointerDrag(false);
    const pointerId = Number.isFinite(event.pointerId) ? Number(event.pointerId) : -1;
    const dragStart = {
      active: true,
      from: slotIndex,
      to: slotIndex,
      deltaX: 0,
      startX,
      startScrollLeft: Number(host.scrollLeft) || 0,
      step: calcUploadPointerDragStep(slotIndex),
      pointerId
    };
    uploadPointerDragRef.current = dragStart;
    host.classList.add("is-pointer-drag-active");
    document.body.classList.add("upload-pointer-dragging");
    renderUploadPointerDragVisual(dragStart);
    const onMove = (e) => {
      if (pointerId !== -1 && Number(e.pointerId) !== pointerId) return;
      if (typeof e.preventDefault === "function") e.preventDefault();
      uploadPointerMovePendingXRef.current = Number(e.clientX);
      if (!uploadPointerMoveRafRef.current) {
        uploadPointerMoveRafRef.current = requestAnimationFrame(flushUploadPointerDragMove);
      }
    };
    const onStop = (e) => {
      if (pointerId !== -1 && Number(e?.pointerId) !== pointerId) return;
      stopUploadPointerDrag(true);
    };
    const onBlur = () => stopUploadPointerDrag(true);
    window.addEventListener("pointermove", onMove, { capture: true, passive: false });
    window.addEventListener("pointerup", onStop, { capture: true });
    window.addEventListener("pointercancel", onStop, { capture: true });
    window.addEventListener("blur", onBlur);
    uploadPointerCleanupRef.current = () => {
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerup", onStop, true);
      window.removeEventListener("pointercancel", onStop, true);
      window.removeEventListener("blur", onBlur);
    };
  };
  const resetUploadDragState = () => {
    uploadAreaDragDepthRef.current = 0;
    setUploadDragOver({ area: false, slot: -1 });
  };
  const handleImageFiles = async (files, options = {}) => {
    const logText = options.logText || "添加图片";
    const loaded = await readImageFiles(files, { source: options.source || "local" });
    if (!loaded.length) return;
    pushLoadedImages(loaded, { logText });
  };
  const handleImageFilesAtSlot = async (files, slotIndex, logTextPrefix = "已添加图片到槽位", options = {}) => {
    const loaded = await readImageFiles(files, { source: options.source || "local" });
    if (!loaded.length) return;
    const label = getUploadSlotLabel(slotIndex, true);
    pushLoadedImages(loaded, { toIndex: slotIndex, logText: `${logTextPrefix.replace("槽位", label)}` });
  };
  const handleChatInputPaste = async (event) => {
    const list = filterImageFiles(event.clipboardData?.files || []);
    if (!list.length) return;
    event.preventDefault();
    await handleImageFiles(list, { logText: "粘贴图片", source: "paste" });
  };
  const handleUploadAreaDragEnter = (e) => {
    if (!isUploadFileDragEvent(e.dataTransfer)) return;
    e.preventDefault();
    uploadAreaDragDepthRef.current += 1;
    setUploadDragOver((prev) => (prev.area ? prev : { ...prev, area: true }));
  };
  const handleUploadAreaDragOver = (e) => {
    if (!isUploadFileDragEvent(e.dataTransfer)) return;
    e.preventDefault();
    setUploadDragOver((prev) => (prev.area ? prev : { ...prev, area: true }));
  };
  const handleUploadAreaDragLeave = (e) => {
    if (!isUploadFileDragEvent(e.dataTransfer)) return;
    e.preventDefault();
    uploadAreaDragDepthRef.current = Math.max(0, uploadAreaDragDepthRef.current - 1);
    if (uploadAreaDragDepthRef.current === 0) {
      setUploadDragOver({ area: false, slot: -1 });
    }
  };
  const handleUploadAreaDrop = async (e) => {
    if (!isUploadFileDragEvent(e.dataTransfer)) return;
    e.preventDefault();
    e.stopPropagation();
    const list = filterImageFiles(e.dataTransfer?.files || []);
    if (list.length) await handleImageFiles(list, { source: "drop" });
    resetUploadDragState();
  };
  const handleUploadSlotDragEnter = (slotIndex, e) => {
    if (!isUploadFileDragEvent(e.dataTransfer)) return;
    e.preventDefault();
    e.stopPropagation();
    setUploadDragOver((prev) => (
      prev.area && prev.slot === slotIndex ? prev : { area: true, slot: slotIndex }
    ));
  };
  const handleUploadSlotDragOver = (slotIndex, e) => {
    if (!isUploadFileDragEvent(e.dataTransfer)) return;
    e.preventDefault();
    e.stopPropagation();
    setUploadDragOver((prev) => (
      prev.area && prev.slot === slotIndex ? prev : { area: true, slot: slotIndex }
    ));
  };
  const handleUploadSlotDragLeave = (slotIndex, e) => {
    if (!isUploadFileDragEvent(e.dataTransfer)) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setUploadDragOver((prev) => (prev.slot === slotIndex ? { ...prev, slot: -1 } : prev));
  };
  const handleUploadDrop = async (toIndex, e) => {
    if (!isUploadFileDragEvent(e.dataTransfer)) return;
    e.preventDefault();
    e.stopPropagation();
    const droppedFiles = filterImageFiles(e.dataTransfer?.files || []);
    if (droppedFiles.length) {
      await handleImageFilesAtSlot(droppedFiles, toIndex, "已添加图片到槽位", { source: "drop" });
      resetUploadDragState();
      return;
    }
    resetUploadDragState();
  };
  const handleUploadSlotsWheel = (event, slotsEl = null) => {
    const nativeEvent = event?.nativeEvent || event;
    const el = slotsEl || event?.currentTarget || uploadSlotsRef.current;
    if (!nativeEvent || !el) return;
    let deltaY = Number(nativeEvent.deltaY) || 0;
    let deltaX = Number(nativeEvent.deltaX) || 0;
    const deltaMode = Number(nativeEvent.deltaMode) || 0;
    if (deltaMode === 1) {
      // line mode -> pixel mode
      deltaY *= 16;
      deltaX *= 16;
    } else if (deltaMode === 2) {
      // page mode -> pixel mode
      const pagePx = Math.max(1, Number(el.clientWidth) || 1);
      deltaY *= pagePx;
      deltaX *= pagePx;
    }
    const useHorizontal = Math.abs(deltaX) > Math.abs(deltaY) * 0.9;
    const rawDelta = useHorizontal ? deltaX : deltaY;
    if (!Number.isFinite(rawDelta) || Math.abs(rawDelta) < 0.1) return;
    const maxStep = Math.max(96, Math.min(220, Math.round((Number(el.clientWidth) || 0) * 0.55)));
    const scale = useHorizontal ? 1 : 1.12;
    const scrollDelta = Math.max(-maxStep, Math.min(maxStep, rawDelta * scale));
    if (Math.abs(scrollDelta) < 0.1) return;
    const maxScroll = Math.max(0, (Number(el.scrollWidth) || 0) - (Number(el.clientWidth) || 0));
    if (maxScroll <= 0) return;
    const current = Number(el.scrollLeft) || 0;
    const next = Math.max(
      0,
      Math.min(maxScroll, current + scrollDelta)
    );
    if (next !== current) {
      el.scrollLeft = next;
    }
    tipScrollLockUntilRef.current = Date.now() + 120;
    if (typeof nativeEvent.preventDefault === "function" && nativeEvent.cancelable) {
      nativeEvent.preventDefault();
    }
  };

   
  useEffect(() => {
    if (view !== "home") return undefined;
    const el = uploadSlotsRef.current;
    if (!el) return undefined;
    const onWheel = (event) => handleUploadSlotsWheel(event, el);
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
    };
  }, [view]);
  useEffect(() => {
    if (view === "home") return;
    stopUploadPointerDrag(false);
    // stopUploadPointerDrag is intentionally stable enough for this one-shot guard.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);
  useEffect(() => () => {
    stopUploadPointerDrag(false);
    // stopUploadPointerDrag is intentionally invoked only on unmount cleanup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const handleUploadSlotClick = (slotIndex) => {
    const current = Array.isArray(uploadImagesRef.current) ? uploadImagesRef.current : [];
    if (current[slotIndex]?.dataUrl) return;
    pendingUploadSourceRef.current = "local";
    pendingUploadTargetRef.current = Number.isInteger(slotIndex)
      ? Math.max(0, Math.min(slotIndex, MAX_UPLOAD_IMAGES - 1))
      : -1;
    fileInputRef.current?.click();
  };
  const handleUploadSlotKeyDown = (slotIndex, e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    handleUploadSlotClick(slotIndex);
  };
  const handleRemoveUploadImage = (slotIndex, e) => {
    e.preventDefault();
    e.stopPropagation();
    const current = Array.isArray(uploadImagesRef.current) ? uploadImagesRef.current : [];
    const target = current[slotIndex];
    if (!target?.dataUrl) return;
    commitUploadImages(current
      .filter((_, idx) => idx !== slotIndex)
      .map((item, idx) => (item ? { ...item, slotIndex: idx } : item)));
    appendLog("info", `已删除${getUploadSlotLabel(slotIndex, true)}`, "system");
  };
  const handleUploadSlotToolAction = async (action, slotIndex = -1, e) => {
    e.preventDefault();
    e.stopPropagation();
    const noSelectionPattern = /no[\s_-]*active[\s_-]*selection|no[\s_-]*selection|selection[_\s-]*not[_\s-]*found|无选区|没有选区|未选择区域/i;
    const emitNoSelectionNotice = () => {
      showCopyToast("未检测到选区，请先在 PS 中创建选区", {
        mode: "upload-limit",
        durationMs: 1800
      });
      setMiniConsole("无选区", "warn", "未检测到选区，请先在 PS 中创建选区。");
    };
    if (action === "local") {
      pendingUploadSourceRef.current = "local";
      pendingUploadTargetRef.current = Number.isInteger(slotIndex) && slotIndex >= 0
        ? Math.min(slotIndex, MAX_UPLOAD_IMAGES - 1)
        : -1;
      fileInputRef.current?.click();
      return;
    }
    const actionLabel = action === "select" ? "选区" : action === "full" ? "全图" : "动作";
    const bridgeActionStartedAt = Date.now();
    const bridge = window.shell?.handleUploadSlotToolAction;
    if (typeof bridge !== "function") {
      appendLog("warn", `${actionLabel}仅用于获取 PS 图像，当前桥接接口未就绪`, "bridge");
      setMiniConsole("取图失败", "error", "桥接接口未就绪。请打开大控制台查看修复指引。");
      return;
    }
    appendTraceLog({
      level: "info",
      type: "bridge",
      domain: "取图桥接",
      phase: "发送",
      message: `${actionLabel}取图请求已发送（槽位 ${slotIndex >= 0 ? slotIndex + 1 : "自动"}）。`,
      startedAt: bridgeActionStartedAt
    });
    setMiniConsole("取图处理中", "busy", `${actionLabel}取图中，等待 Ps 插件返回。`);
    try {
      const currentUploads = Array.isArray(uploadImagesRef.current) ? uploadImagesRef.current : [];
      const result = await bridge({
        action,
        slotIndex,
        image: slotIndex >= 0 ? (currentUploads[slotIndex] || null) : null
      });
      if (!result?.ok) {
        const message = String(result?.rawMessage || result?.message || `${actionLabel}取图失败`);
        const errorCode = String(result?.errorCode || "").trim().toLowerCase();
        if (errorCode === "no_selection" || noSelectionPattern.test(message)) {
          appendTraceLog({
            level: "warn",
            type: "bridge",
            domain: "取图桥接",
            phase: "错误",
            message: `${actionLabel}取图失败：未检测到选区。`,
            startedAt: bridgeActionStartedAt,
            endedAt: Date.now(),
            guide: "请先在 Ps 中创建选区，再点击“选区”抓图。"
          });
          emitNoSelectionNotice();
          return;
        }
        throw new Error(message);
      }
      const maybeFiles = normalizeLoadedImages(result?.files || []);
      if (!maybeFiles.length) {
        const fallbackMessage = String(result?.message || "");
        appendTraceLog({
          level: "warn",
          type: "bridge",
          domain: "取图桥接",
          phase: "返回",
          message: fallbackMessage
            ? `${actionLabel}未返回可用图像：${fallbackMessage}`
            : `${actionLabel}未返回可用图像。`,
          startedAt: bridgeActionStartedAt,
          endedAt: Date.now(),
          guide: getFixGuideForError(fallbackMessage || `${actionLabel}未返回可用图像`, "bridge")
        });
        setMiniConsole("取图失败", "error", "未返回图像。请打开大控制台查看修复指引。");
        return;
      }
      setMiniConsole("编码处理中", "busy", "图片编解码处理中。");
      const compression = getImageCompressionOptions();
      const compressed = [];
      for (let idx = 0; idx < maybeFiles.length; idx += 1) {
        const item = maybeFiles[idx];
        const dataUrl = await compressImageDataUrl(item.dataUrl, item.type, compression);
        compressed.push({
          ...item,
          source: action === "select" ? "ps-select" : "ps-full",
          capturedAt: Date.now(),
          dataUrl
        });
      }
      const cached = await cachePsBridgeImages(compressed, { action, slotIndex });
      const compacted = await compactUploadInlinePreview(cached, compression);
      pushLoadedImages(compacted, {
        toIndex: slotIndex >= 0 ? slotIndex : -1,
        logText: slotIndex >= 0
          ? `已向${getUploadSlotLabel(slotIndex, true)}添加${actionLabel}图片`
          : `已添加${actionLabel}图片`
      });
      appendTraceLog({
        level: "info",
        type: "bridge",
        domain: "取图桥接",
        phase: "完成",
        message: `${actionLabel}取图完成，返回 ${compacted.length} 张并已写入上传区。`,
        startedAt: bridgeActionStartedAt,
        endedAt: Date.now()
      });
      setMiniConsole("取图已完成", "ok", "取图完成。可在大控制台查看桥接收发详情。");
    } catch (err) {
      const raw = String(err?.message || err || "桥接调用失败");
      if (noSelectionPattern.test(raw)) {
        appendTraceLog({
          level: "warn",
          type: "bridge",
          domain: "取图桥接",
          phase: "错误",
          message: `${actionLabel}取图失败：未检测到选区。`,
          startedAt: bridgeActionStartedAt,
          endedAt: Date.now(),
          guide: "请先在 Ps 中创建选区，再点击“选区”抓图。"
        });
        emitNoSelectionNotice();
        return;
      }
      appendTraceLog({
        level: "error",
        type: "bridge",
        domain: "取图桥接",
        phase: "错误",
        message: `上传工具桥接调用失败：${raw}`,
        startedAt: bridgeActionStartedAt,
        endedAt: Date.now(),
        requestId: extractRequestId(raw),
        guide: getFixGuideForError(raw, "bridge")
      });
      setMiniConsole("取图失败", "error", "取图失败。请打开大控制台查看修复指引。");
    }
  };

  const setMessagesBySessionId = (sessionId, nextMessages) => {
    if (!sessionId) return;
    setChatSessions((prev) => prev.map((session) => (
      session.id === sessionId
        ? { ...session, messages: Array.isArray(nextMessages) ? nextMessages : [], updatedAt: Date.now() }
        : session
    )));
  };

  const releaseInactiveSessionImageDataUrls = (activeSessionId) => {
    const activeId = String(activeSessionId || "").trim();
    if (!activeId) return;
    setChatSessions((prev) => {
      let changed = false;
      const next = prev.map((session) => {
        if (session.id === activeId) return session;
        if (!Array.isArray(session?.messages) || !session.messages.length) return session;
        let sessionChanged = false;
        const messages = session.messages.map((message) => {
          if (!Array.isArray(message?.images) || !message.images.length) return message;
          let messageChanged = false;
          const images = message.images.map((image) => {
            if (!image || typeof image !== "object") return image;
            const hasInline = String(image.dataUrl || "").trim().startsWith("data:image/");
            const cacheId = String(image.cacheId || "").trim();
            if (!hasInline || !cacheId) return image;
            messageChanged = true;
            return { ...image, dataUrl: "" };
          });
          if (!messageChanged) return message;
          sessionChanged = true;
          return { ...message, images };
        });
        if (!sessionChanged) return session;
        changed = true;
        return { ...session, messages };
      });
      return changed ? next : prev;
    });
  };

  const hydrateSessionImagesFromCache = async (sessionId) => {
    const id = String(sessionId || "").trim();
    if (!id || chatImageHydrationInFlightRef.current.has(id)) return;
    const session = (chatSessionsRef.current || []).find((item) => item.id === id);
    if (!session || !Array.isArray(session.messages) || !session.messages.length) return;
    const missingIds = [];
    session.messages.forEach((message) => {
      if (!Array.isArray(message?.images)) return;
      message.images.forEach((image) => {
        const cacheId = String(image?.cacheId || "").trim();
        const dataUrl = String(image?.dataUrl || "").trim();
        if (cacheId && !dataUrl) missingIds.push(cacheId);
      });
    });
    const uniqueIds = Array.from(new Set(missingIds.filter(Boolean)));
    if (!uniqueIds.length) return;
    const targetIds = uniqueIds.slice(0, CHAT_IMAGE_HYDRATE_CHUNK_SIZE);
    if (!targetIds.length) return;

    chatImageHydrationInFlightRef.current.add(id);
    try {
      const fetchedItems = [];
      if (typeof window.shell?.chatImageCacheGetMany === "function") {
        const result = await window.shell.chatImageCacheGetMany({ cacheIds: targetIds });
        if (result?.ok && Array.isArray(result.items)) {
          fetchedItems.push(...result.items);
        }
      } else if (typeof window.shell?.chatImageCacheGet === "function") {
        for (const cacheId of targetIds) {
          try {
            const one = await window.shell.chatImageCacheGet(cacheId);
            if (one?.ok) fetchedItems.push(one);
          } catch {
            // ignore single cache read error
          }
        }
      }
      const cachedMap = new Map(
        fetchedItems
          .map((item) => [String(item?.cacheId || "").trim(), item])
          .filter(([cacheId, item]) => cacheId && String(item?.dataUrl || "").startsWith("data:image/"))
      );
      if (!cachedMap.size) return;

      setChatSessions((prev) => {
        let changed = false;
        const next = prev.map((sessionItem) => {
          if (sessionItem.id !== id || !Array.isArray(sessionItem.messages) || !sessionItem.messages.length) {
            return sessionItem;
          }
          let sessionChanged = false;
          const messages = sessionItem.messages.map((message) => {
            if (!Array.isArray(message?.images) || !message.images.length) return message;
            let messageChanged = false;
            const images = message.images.map((image) => {
              const cacheId = String(image?.cacheId || "").trim();
              const currentDataUrl = String(image?.dataUrl || "").trim();
              if (!cacheId || currentDataUrl) return image;
              const cached = cachedMap.get(cacheId);
              const cachedDataUrl = String(cached?.dataUrl || "").trim();
              if (!cachedDataUrl.startsWith("data:image/")) return image;
              messageChanged = true;
              return {
                ...image,
                dataUrl: cachedDataUrl,
                type: String(image?.type || cached?.mimeType || image?.cacheMimeType || "")
              };
            });
            if (!messageChanged) return message;
            sessionChanged = true;
            return { ...message, images };
          });
          if (!sessionChanged) return sessionItem;
          changed = true;
          return { ...sessionItem, messages };
        });
        return changed ? next : prev;
      });
    } finally {
      chatImageHydrationInFlightRef.current.delete(id);
    }
  };

  const submitChatTurn = async ({
    sessionId,
    baseMessages,
    userText,
    userImages = [],
    startLogText = "聊天请求已发送",
    onAccepted = null
  }) => {
    if (isSending) return false;
    const text = String(userText || "").trim();
    const images = Array.isArray(userImages) ? userImages : [];
    const cfg = sanitizeChatConfig(chatConfig);
    const chatSiteKeyNow = chatProviderKey;
    const chatProviderMode = normalizeChatProviderModeBySiteKey(chatSiteKeyNow, cfg.providerMode);
    const streamModeHintKey = buildChatStreamModeHintKey(chatSiteKeyNow, chatProviderMode, cfg.baseUrl);
    const streamModeHint = normalizeChatStreamModeHint(chatStreamModeHintsRef.current?.[streamModeHintKey]);
    const setStreamModeHint = (nextMode, reasonText = "") => {
      const normalized = normalizeChatStreamModeHint(nextMode);
      if (normalized === "auto") return;
      setChatStreamModeHints((prev) => {
        const current = normalizeChatStreamModeHint(prev?.[streamModeHintKey]);
        if (current === normalized) return prev;
        const next = { ...(prev || {}), [streamModeHintKey]: normalized };
        if (reasonText) {
          appendTraceLog({
            level: "info",
            type: "api",
            domain: "聊天请求",
            phase: "流式策略",
            message: reasonText
          });
        }
        return next;
      });
    };
    const sendImages = enrichImagesForSend(images, {
      withImageModel: !!String(imageConfig.model || "").trim()
    });
    const cfgErrors = validateChatConfig(cfg);
    if (cfgErrors.length) {
      appendLog("warn", `发送前校验失败：${cfgErrors[0]}`, "api");
      setChatApiStatus("error");
      setChatApiIssueText(cfgErrors[0]);
      setMiniConsole("聊天失败", "error", "聊天前校验失败。请打开大控制台查看修复指引。");
      return false;
    }
    if (!text && sendImages.length === 0) {
      appendLog("warn", "发送失败：文本和图片都为空", "api");
      setMiniConsole("聊天失败", "error", "发送失败：文本和图片为空。");
      return false;
    }
    const historyMessages = Array.isArray(baseMessages) ? baseMessages : [];
    const now = Date.now();
    const userDraft = {
      id: `local-user-${now}`,
      role: "user",
      text,
      images: sendImages.map((img) => {
        const imageTarget = resolveImageTarget(img);
        const width = Number(img?.width);
        const height = Number(img?.height);
        return {
          id: img.id || `img-${now}`,
          dataUrl: img.dataUrl,
          name: img.name,
          originName: img.originName || img.name,
          source: img.source,
          role: img.role,
          psCacheId: img.psCacheId || "",
          psCacheExpiresAt: Number.isFinite(img.psCacheExpiresAt) ? Number(img.psCacheExpiresAt) : undefined,
          width: Number.isFinite(width) && width > 0 ? width : undefined,
          height: Number.isFinite(height) && height > 0 ? height : undefined,
          targetRect: imageTarget.targetRect || null,
          targetRectNorm: imageTarget.targetRectNorm || undefined,
          targetCanvas: imageTarget.targetCanvas || undefined,
          targetDocumentId: imageTarget.targetDocumentId || undefined,
          targetDocumentName: imageTarget.targetDocumentName || undefined
        };
      }),
      createdAt: new Date().toISOString(),
      status: "done"
    };
    const assistantDraft = {
      id: `local-assistant-${now}`,
      role: "assistant",
      model: cfg.model,
      text: "",
      createdAt: new Date().toISOString(),
      status: "pending"
    };
    const chatRequestStartedAt = Date.now();

    setIsSending(true);
    appendTraceLog({
      level: "info",
      type: "api",
      domain: "聊天请求",
      phase: "发送",
      message: `${startLogText}；模型 ${cfg.model}，文本 ${text.length} 字，图片 ${sendImages.length} 张。`,
      startedAt: chatRequestStartedAt
    });
    setMiniConsole("聊天等待中", "busy", "聊天请求已发送，等待服务端返回。");
    const optimisticMessages = [...historyMessages, userDraft, assistantDraft];
    setMessagesBySessionId(sessionId, optimisticMessages);
    if (typeof onAccepted === "function") {
      try {
        onAccepted({
          text,
          images: sendImages
        });
      } catch {
        // ignore callback errors
      }
    }

    const controller = new AbortController();
    sendAbortRef.current = controller;
    let flushRafId = 0;
    try {
      const contextMessages = historyMessages
        .filter((m) => m?.status !== "pending" && (m?.role === "user" || m?.role === "assistant"))
        .slice(-Math.max(0, Number(cfg.contextCount) || 20));

      const payloadMessages = [];
      if (cfg.systemPrompt && String(cfg.systemPrompt).trim()) {
        payloadMessages.push({ role: "system", content: String(cfg.systemPrompt).trim() });
      }
      contextMessages.forEach((m) => {
        if (m.role === "assistant") {
          const assistantJson = getMessageJsonText(m);
          const assistantText = stripExtractedJsonBlock(String(m.text || ""));
          const assistantContent = assistantJson
            ? `${assistantText ? `${assistantText}\n\n` : ""}\`\`\`json\n${assistantJson}\n\`\`\``
            : String(m.text || "");
          payloadMessages.push({ role: "assistant", content: assistantContent });
          return;
        }
        payloadMessages.push({
          role: "user",
          content: buildUserContent(String(m.text || ""), Array.isArray(m.images) ? m.images : [])
        });
      });
      payloadMessages.push({
        role: "user",
        content: buildUserContent(text, sendImages)
      });

      let data = null;
      let assistantText = "";
      let assistantThinking = "";
      let streamUsed = false;
      const preferNonStream = streamModeHint === "nonstream";
      const isLikelyStreamUnsupported = (statusCode, errorText) => (
        /stream|sse|event-stream|not support|unsupported|alt=sse|ndjson/i.test(String(errorText || ""))
        || [400, 404, 405, 406, 409, 415, 422, 501].includes(Number(statusCode))
      );
      let streamFlushAt = 0;
      let lastFlushedText = "";
      let lastFlushedThinking = "";
      const flushAssistantStream = (force = false) => {
        const nowTs = Date.now();
        if (!force && (nowTs - streamFlushAt) < 140) return;
        if (!force && assistantText === lastFlushedText && assistantThinking === lastFlushedThinking) return;
        streamFlushAt = nowTs;
        lastFlushedText = assistantText;
        lastFlushedThinking = assistantThinking;
        setMessagesBySessionId(sessionId, [
          ...historyMessages,
          userDraft,
          {
            ...assistantDraft,
            status: "pending",
            text: assistantText,
            thinking: assistantThinking
          }
        ]);
      };
      const scheduleAssistantStreamFlush = (force = false) => {
        if (force) {
          if (flushRafId) {
            cancelAnimationFrame(flushRafId);
            flushRafId = 0;
          }
          flushAssistantStream(true);
          return;
        }
        if (flushRafId) return;
        flushRafId = requestAnimationFrame(() => {
          flushRafId = 0;
          flushAssistantStream(false);
        });
      };

      if (chatProviderMode === "google-native") {
        const googleBase = normalizeGoogleBaseForModels(cfg.baseUrl);
        const streamEndpoint = `${googleBase}/v1beta/models/${encodeURIComponent(cfg.model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(cfg.apiKey)}`;
        const fallbackEndpoint = `${googleBase}/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`;
        const bodyPayload = {
          contents: buildGoogleContentsFromMessages(payloadMessages),
          generationConfig: {
            temperature: Number(cfg.temperature),
            topP: Number(cfg.topP),
            maxOutputTokens: Number(cfg.maxTokens) || 4096
          }
        };
        const requestGoogleNonStream = async () => {
          const fallbackRes = await fetch(fallbackEndpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(bodyPayload),
            signal: controller.signal
          });
          const fallbackText = await fallbackRes.text();
          const fallbackCt = String(fallbackRes.headers.get("content-type") || "").toLowerCase();
          if (!fallbackCt.includes("application/json")) {
            const hint = hasLikelyHtml(fallbackText)
              ? "收到 HTML 页面，请检查聊天地址是否填写正确"
              : "返回内容不是 JSON";
            throw new Error(`聊天请求失败：HTTP ${fallbackRes.status}，${hint}`);
          }
          let parsed = {};
          try {
            parsed = fallbackText ? JSON.parse(fallbackText) : {};
          } catch {
            throw new Error(`聊天请求失败：返回 JSON 解析失败（HTTP ${fallbackRes.status}）`);
          }
          if (!fallbackRes.ok) throw new Error(parsed?.error?.message || parsed?.message || `HTTP ${fallbackRes.status}`);
          return parsed;
        };

        let parsedFromStreamEndpoint = null;
        if (!preferNonStream) {
          const streamRes = await fetch(streamEndpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(bodyPayload),
            signal: controller.signal
          });
          const streamCt = String(streamRes.headers.get("content-type") || "").toLowerCase();
          if (streamRes.ok && streamRes.body && streamCt.includes("text/event-stream")) {
            streamUsed = true;
            await consumeSseStream(streamRes, (payload) => {
              if (!payload || payload === "[DONE]") return;
              let chunk = null;
              try {
                chunk = JSON.parse(payload);
              } catch {
                return;
              }
              const errMsg = String(chunk?.error?.message || chunk?.message || "").trim();
              if (errMsg) throw new Error(errMsg);
              const textSnapshot = extractAssistantTextFromGoogleResponse(chunk) || extractAssistantText(chunk);
              const thinkingSnapshot = extractAssistantThinkingFromGoogleResponse(chunk) || extractAssistantThinking(chunk);
              assistantText = mergeStreamSnapshot(assistantText, textSnapshot);
              assistantThinking = mergeStreamSnapshot(assistantThinking, thinkingSnapshot);
              scheduleAssistantStreamFlush(false);
            });
            scheduleAssistantStreamFlush(true);
            data = {
              candidates: [
                {
                  content: {
                    parts: [
                      assistantThinking ? { thought: assistantThinking } : null,
                      assistantText ? { text: assistantText } : null
                    ].filter(Boolean)
                  }
                }
              ]
            };
            setStreamModeHint("stream");
          } else {
            const streamText = await streamRes.text();
            if (!streamCt.includes("application/json")) {
              const hint = hasLikelyHtml(streamText)
                ? "收到 HTML 页面，请检查聊天地址是否填写正确"
                : "返回内容不是 JSON";
              throw new Error(`聊天请求失败：HTTP ${streamRes.status}，${hint}`);
            }
            let parsed = {};
            try {
              parsed = streamText ? JSON.parse(streamText) : {};
            } catch {
              throw new Error(`聊天请求失败：返回 JSON 解析失败（HTTP ${streamRes.status}）`);
            }
            if (!streamRes.ok) {
              const errMsg = String(parsed?.error?.message || parsed?.message || `HTTP ${streamRes.status}`);
              if (!isLikelyStreamUnsupported(streamRes.status, errMsg)) throw new Error(errMsg);
              setStreamModeHint("nonstream", "检测到该服务端不支持聊天流式，已切换为非流式。");
            } else {
              parsedFromStreamEndpoint = parsed;
              setStreamModeHint("nonstream", "服务端未返回流式通道，已切换为非流式。");
            }
          }
        }
        if (!streamUsed) {
          data = parsedFromStreamEndpoint || await requestGoogleNonStream();
        }
      } else {
        const endpoint = normalizeOpenAIChatEndpoint(cfg.baseUrl);
        const streamPayload = {
          model: cfg.model,
          stream: true,
          messages: payloadMessages,
          max_tokens: Number(cfg.maxTokens) || 4096,
          temperature: Number(cfg.temperature),
          top_p: Number(cfg.topP),
          presence_penalty: Number(cfg.presencePenalty),
          frequency_penalty: Number(cfg.frequencyPenalty)
        };
        const requestOpenAiNonStream = async () => {
          const fallbackPayload = { ...streamPayload, stream: false };
          const fallbackRes = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${cfg.apiKey}`
            },
            body: JSON.stringify(fallbackPayload),
            signal: controller.signal
          });
          const fallbackText = await fallbackRes.text();
          const fallbackCt = String(fallbackRes.headers.get("content-type") || "").toLowerCase();
          if (!fallbackCt.includes("application/json")) {
            const hint = hasLikelyHtml(fallbackText)
              ? "收到 HTML 页面，请检查聊天地址是否填写正确"
              : "返回内容不是 JSON";
            throw new Error(`聊天请求失败：HTTP ${fallbackRes.status}，${hint}`);
          }
          let parsed = {};
          try {
            parsed = fallbackText ? JSON.parse(fallbackText) : {};
          } catch {
            throw new Error(`聊天请求失败：返回 JSON 解析失败（HTTP ${fallbackRes.status}）`);
          }
          if (!fallbackRes.ok) throw new Error(parsed?.error?.message || parsed?.message || `HTTP ${fallbackRes.status}`);
          return parsed;
        };

        let parsedFromStreamEndpoint = null;
        if (!preferNonStream) {
          const streamRes = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${cfg.apiKey}`
            },
            body: JSON.stringify(streamPayload),
            signal: controller.signal
          });
          const streamCt = String(streamRes.headers.get("content-type") || "").toLowerCase();
          const isNdjson = streamCt.includes("application/x-ndjson");
          const isSse = streamCt.includes("text/event-stream");
          if (streamRes.ok && streamRes.body && (isSse || isNdjson)) {
            streamUsed = true;
            await consumeSseStream(
              streamRes,
              (payload) => {
                if (!payload || payload === "[DONE]") return;
                let chunk = null;
                try {
                  chunk = JSON.parse(payload);
                } catch {
                  return;
                }
                const errMsg = String(chunk?.error?.message || chunk?.message || "").trim();
                if (errMsg) throw new Error(errMsg);
                const delta = extractOpenAIStreamDelta(chunk);
                const deltaText = delta.textDelta;
                const deltaThinking = delta.thinkingDelta;
                if (!deltaText && !deltaThinking) {
                  const snapshotText = extractAssistantText(chunk);
                  const snapshotThinking = extractAssistantThinking(chunk);
                  if (snapshotText) assistantText = mergeStreamSnapshot(assistantText, snapshotText);
                  if (snapshotThinking) assistantThinking = mergeStreamSnapshot(assistantThinking, snapshotThinking);
                } else {
                  if (deltaText) assistantText += deltaText;
                  if (deltaThinking) assistantThinking += deltaThinking;
                }
                scheduleAssistantStreamFlush(false);
              },
              isNdjson ? { jsonLines: true } : undefined
            );
            scheduleAssistantStreamFlush(true);
            data = {
              choices: [
                {
                  message: {
                    content: assistantText,
                    thinking: assistantThinking,
                    reasoning_content: assistantThinking
                  }
                }
              ]
            };
            setStreamModeHint("stream");
          } else {
            const streamText = await streamRes.text();
            if (!streamCt.includes("application/json")) {
              const hint = hasLikelyHtml(streamText)
                ? "收到 HTML 页面，请检查聊天地址是否填写正确"
                : "返回内容不是 JSON";
              throw new Error(`聊天请求失败：HTTP ${streamRes.status}，${hint}`);
            }
            let parsed = {};
            try {
              parsed = streamText ? JSON.parse(streamText) : {};
            } catch {
              throw new Error(`聊天请求失败：返回 JSON 解析失败（HTTP ${streamRes.status}）`);
            }
            if (!streamRes.ok) {
              const errMsg = String(parsed?.error?.message || parsed?.message || `HTTP ${streamRes.status}`);
              if (!isLikelyStreamUnsupported(streamRes.status, errMsg)) throw new Error(errMsg);
              setStreamModeHint("nonstream", "检测到该服务端不支持聊天流式，已切换为非流式。");
            } else {
              parsedFromStreamEndpoint = parsed;
              setStreamModeHint("nonstream", "服务端未返回流式通道，已切换为非流式。");
            }
          }
        }
        if (!streamUsed) {
          data = parsedFromStreamEndpoint || await requestOpenAiNonStream();
        }
      }
      if (!streamUsed) {
        assistantText = chatProviderMode === "google-native"
          ? (extractAssistantTextFromGoogleResponse(data) || extractAssistantText(data))
          : extractAssistantText(data);
        assistantThinking = chatProviderMode === "google-native"
          ? (extractAssistantThinkingFromGoogleResponse(data) || extractAssistantThinking(data))
          : extractAssistantThinking(data);
      }
      const extracted = extractJsonText(assistantText);
      const assistantDone = {
        ...assistantDraft,
        status: "done",
        text: assistantText,
        error: undefined,
        jsonPrompt: extracted ? JSON.parse(extracted) : null,
        jsonPromptText: extracted || "",
        thinking: assistantThinking
      };
      const nextMessages = [...historyMessages, userDraft, assistantDone];
      setMessagesBySessionId(sessionId, nextMessages);
      if (sessionId === activeSession?.id) {
        setJsonPromptText(extracted || "");
      }
      appendTraceLog({
        level: "info",
        type: "api",
        domain: "聊天请求",
        phase: "返回",
        message: `聊天响应成功，返回 ${String(assistantText || "").length} 字。`,
        startedAt: chatRequestStartedAt,
        endedAt: Date.now()
      });
      setMiniConsole("聊天已返回", "ok", "聊天响应成功。可在大控制台查看完整请求链路。");
      markApiActionSuccess("chat", "");
      void maybeAutoNameSession({
        sessionId,
        userText: text,
        assistantText,
        providerMode: chatProviderMode,
        config: cfg,
        historyMessages
      });
      requestAnimationFrame(() => {
        if (chatScrollRef.current) {
          chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
        }
      });
    } catch (err) {
      const rawMessage = String(err?.message || "请求失败");
      const msg = err?.name === "AbortError" ? "已停止生成" : formatApiError(rawMessage);
      appendTraceLog({
        level: err?.name === "AbortError" ? "warn" : "error",
        type: "api",
        domain: "聊天请求",
        phase: err?.name === "AbortError" ? "中断" : "错误",
        message: msg,
        startedAt: chatRequestStartedAt,
        endedAt: Date.now(),
        requestId: extractRequestId(rawMessage),
        guide: err?.name === "AbortError" ? "" : getFixGuideForError(rawMessage, "chat")
      });
      if (err?.name !== "AbortError") {
        setChatApiStatus("error");
        setChatApiIssueText(msg);
        setMiniConsole("聊天失败", "error", "聊天失败。请打开大控制台查看修复指引。");
      } else {
        setMiniConsole("聊天已停", "warn", "聊天已停止。可在大控制台查看本次请求记录。");
      }
      if (/ratio or price not set|倍率或价格未配置/i.test(rawMessage)) {
        appendLog("warn", `请手动切换聊天模型后重试，当前模型：${cfg.model}`, "api");
        appendLog("error", `服务端错误详情：${rawMessage}`, "api");
      }
      setMessagesBySessionId(sessionId, [...historyMessages, userDraft, { ...assistantDraft, status: "error", text: msg, error: msg }]);
    } finally {
      if (typeof flushRafId === "number" && flushRafId) {
        cancelAnimationFrame(flushRafId);
        flushRafId = 0;
      }
      sendAbortRef.current = null;
      setIsSending(false);
    }
    return true;
  };

  const handleSendChat = async () => {
    const text = chatInput.trim();
    const sessionId = activeSession?.id || "";
    if (!sessionId) return;
    const uploadImagesSnapshot = Array.isArray(uploadImages) ? [...uploadImages] : [];
    const sent = await submitChatTurn({
      sessionId,
      baseMessages: messages,
      userText: text,
      userImages: uploadImagesSnapshot,
      startLogText: "聊天请求已发送",
      onAccepted: () => {
        setChatInput("");
        setJsonEditedPending(false);
      }
    });
    if (!sent) return;
  };

  const handleChatInputKeyDown = (e) => {
    if (e.key !== "Enter") return;
    if (e.shiftKey) return;
    if (e.nativeEvent?.isComposing || e.isComposing || e.keyCode === 229) return;
    e.preventDefault();
    if (isSending) return;
    handleSendChat();
  };

  const handleStopChat = async () => {
    if (sendAbortRef.current) {
      try {
        sendAbortRef.current.abort();
      } catch {
        // ignore
      }
    }
    setActiveMessages((prev) => {
      const next = [...prev];
      for (let i = next.length - 1; i >= 0; i -= 1) {
        const item = next[i];
        if (item.role === "assistant" && item.status === "pending") {
          next[i] = { ...item, status: "error", text: "已停止生成", error: "abort" };
          break;
        }
      }
      return next;
    });
    appendLog("warn", "已请求停止生成", "api");
    setMiniConsole("聊天已停", "warn", "已请求停止当前聊天生成。");
  };

  const showCopyToast = (text = "复制成功", options = {}) => {
    const durationMs = Number.isFinite(options.durationMs)
      ? Math.max(300, Math.round(options.durationMs))
      : COPY_TOAST_MS;
    let mode = String(options.mode || "default");
    let top = null;
    let left = null;
    if (mode === "upload-limit") {
      const displayRect = uploadAreaRef.current?.querySelector?.(".upload-area-main")?.getBoundingClientRect?.();
      const rect = displayRect || uploadAreaRef.current?.getBoundingClientRect?.();
      if (rect && Number.isFinite(rect.width) && Number.isFinite(rect.height)) {
        top = Math.round(rect.top + (rect.height / 2));
        left = Math.round(rect.left + (rect.width / 2));
      } else {
        mode = "default";
      }
    }
    if (copyToastTimerRef.current) {
      clearTimeout(copyToastTimerRef.current);
      copyToastTimerRef.current = null;
    }
    setCopyToast({
      visible: true,
      text: String(text || "复制成功"),
      mode,
      top,
      left
    });
    copyToastTimerRef.current = setTimeout(() => {
      setCopyToast((prev) => (prev.visible ? { ...prev, visible: false } : prev));
      copyToastTimerRef.current = null;
    }, durationMs);
  };

  const copyTextWithFeedback = async (text, options = {}) => {
    const {
      source = "system",
      emptyWarn = "",
      successLog = "",
      successToast = "复制成功",
      failWarn = "复制失败"
    } = options;
    const value = String(text || "").trim();
    if (!value) {
      if (emptyWarn) appendLog("warn", emptyWarn, source);
      return false;
    }
    try {
      await navigator.clipboard.writeText(value);
      if (successLog) appendLog("info", successLog, source);
      showCopyToast(successToast);
      return true;
    } catch {
      appendLog("warn", failWarn, source);
      return false;
    }
  };

  const handleCopyCodeText = async (text) => {
    await copyTextWithFeedback(text, { source: "system", failWarn: "复制失败", successToast: "复制成功" });
  };

  const copyMessageText = async (msg, source = "system") => {
    await copyTextWithFeedback(msg?.text, {
      source,
      emptyWarn: "当前消息没有可复制的文本",
      successLog: "消息已复制",
      successToast: "复制成功",
      failWarn: "复制失败"
    });
  };
  const openMessageImage = (image) => {
    const url = String(image?.dataUrl || "").trim();
    if (!url) return;
    try {
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      // ignore
    }
  };

  const handleEditUserMessage = (messageId) => {
    if (isSending) {
      appendLog("warn", "正在生成中，请先停止再编辑消息", "api");
      return;
    }
    const target = messages.find((m) => m.id === messageId && m.role === "user");
    if (!target) return;
    setEditingUserMessageId(messageId);
    setEditingUserMessageText(String(target.text || ""));
  };

  const handleCancelEditUserMessage = () => {
    if (!editingUserMessageId) return;
    setEditingUserMessageId("");
    setEditingUserMessageText("");
    appendLog("info", "已取消编辑消息", "system");
  };

  const handleUpdateUserMessage = () => {
    if (!editingUserMessageId) return;
    const current = messages.find((m) => m.id === editingUserMessageId && m.role === "user");
    if (!current) {
      setEditingUserMessageId("");
      setEditingUserMessageText("");
      return;
    }
    const nextText = String(editingUserMessageText || "");
    if (nextText === String(current.text || "")) return;
    const hasImages = Array.isArray(current.images) && current.images.length > 0;
    if (!nextText.trim() && !hasImages) {
      appendLog("warn", "消息不能为空", "system");
      return;
    }
    setActiveMessages((prev) => prev.map((item) => (
      item.id === editingUserMessageId
        ? { ...item, text: nextText, updatedAt: Date.now() }
        : item
    )));
    setEditingUserMessageId("");
    setEditingUserMessageText("");
    appendLog("info", "消息已更新", "system");
  };

  const handleRegenerateFromAssistant = async (assistantId) => {
    if (isSending) {
      appendLog("warn", "正在生成中，请先停止当前任务", "api");
      return;
    }
    const assistantIndex = messages.findIndex((m) => m.id === assistantId && m.role === "assistant");
    if (assistantIndex < 0) return;
    let userIndex = -1;
    for (let i = assistantIndex - 1; i >= 0; i -= 1) {
      if (messages[i]?.role === "user") {
        userIndex = i;
        break;
      }
    }
    if (userIndex < 0) {
      appendLog("warn", "未找到可重试的用户消息", "api");
      return;
    }
    const targetUser = messages[userIndex];
    const sessionId = activeSession?.id || "";
    if (!sessionId) return;
    await submitChatTurn({
      sessionId,
      baseMessages: messages.slice(0, userIndex),
      userText: targetUser.text || "",
      userImages: Array.isArray(targetUser.images) ? targetUser.images : [],
      startLogText: "已发起重新回复"
    });
  };

  const handleBranchFromMessage = (messageId) => {
    const idx = messages.findIndex((m) => m.id === messageId);
    if (idx < 0) return;
    const baseName = String(activeSession?.name || "新对话").trim() || "新对话";
    const clonedMessages = messages.slice(0, idx + 1).map((m) => ({
      ...m,
      images: Array.isArray(m.images) ? m.images.map((img) => ({ ...img })) : []
    }));
    const session = createChatSession(`${baseName}-分支`, clonedMessages);
    setChatSessions((prev) => [session, ...prev]);
    setActiveChatSessionId(session.id);
    setHistoryOpen(false);
    appendLog("info", `已创建对话分支：${session.name}`, "system");
  };

  const handleRunHoverEnter = (anchorEl = runAnchorRef.current) => {
    if (runHoverTimerRef.current) clearTimeout(runHoverTimerRef.current);
    runHoverTimerRef.current = setTimeout(() => {
      const el = anchorEl || runAnchorRef.current;
      if (el) {
        runAnchorRef.current = el;
        const rect = el.getBoundingClientRect();
        const pos = calcFloatingPanelPosition(rect, RUN_POPOVER_SIZE, RUN_POPOVER_SIZE, { mode: "center", preferY: "top", gap: 8 });
        const nextPos = { top: pos.top, left: pos.left };
        setRunPopoverPos((prev) => replaceFloatingIfChanged(prev, nextPos, ["top", "left"]));
      }
      setRunHover(true);
    }, 150);
  };

  const handleRunHoverLeave = () => {
    if (runHoverTimerRef.current) clearTimeout(runHoverTimerRef.current);
    runHoverTimerRef.current = setTimeout(() => {
      runHoverTimerRef.current = null;
      setRunHover(false);
    }, 300);
  };

  const getTipMeasureSize = (text, variant = "") => {
    const rawText = String(text || "");
    const fallbackWidth = Math.min(280, Math.max(96, Math.round(rawText.length * 10)));
    const fallbackHeight = variant === "preset" ? 44 : 24;
    if (typeof document === "undefined" || !document.body) {
      return { width: fallbackWidth, height: fallbackHeight };
    }
    let measureEl = tipMeasureElRef.current;
    if (!measureEl || !document.body.contains(measureEl)) {
      measureEl = document.createElement("div");
      measureEl.style.position = "fixed";
      measureEl.style.left = "-100000px";
      measureEl.style.top = "-100000px";
      measureEl.style.visibility = "hidden";
      measureEl.style.pointerEvents = "none";
      measureEl.className = "global-tip";
      document.body.appendChild(measureEl);
      tipMeasureElRef.current = measureEl;
    }
    measureEl.className = `global-tip ${variant ? `is-${variant}` : ""}`;
    measureEl.textContent = rawText;
    const rect = measureEl.getBoundingClientRect();
    const width = Math.max(24, Math.round(rect.width || fallbackWidth));
    const height = Math.max(20, Math.round(rect.height || fallbackHeight));
    return { width, height };
  };

  const showTipByElement = (el, text, placement = "bottom", variant = "") => {
    if (!el || !text) return;
    const viewportWidth = Math.round(window.visualViewport?.width || window.innerWidth || document.documentElement.clientWidth || 0);
    const viewportHeight = Math.round(window.visualViewport?.height || window.innerHeight || document.documentElement.clientHeight || 0);
    const rect = el.getBoundingClientRect();
    const padding = 8;
    const gap = 6;
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const measured = getTipMeasureSize(text, variant);
    const textLength = String(text || "").trim().length;
    const minReadableWidth = variant === "preset"
      ? 180
      : (textLength >= 14 ? 132 : 0);
    const tipWidth = Math.min(
      Math.max(24, minReadableWidth, measured.width),
      Math.max(24, viewportWidth - (padding * 2))
    );
    const tipHeight = Math.min(Math.max(20, measured.height), Math.max(20, viewportHeight - (padding * 2)));
    const tipHalfWidth = Math.max(12, Math.round(tipWidth / 2));
    const tipHalfHeight = Math.max(10, Math.round(tipHeight / 2));
    let nextPlacement = placement;
    const applyTipState = (resolvedPlacement, nextTop, nextLeft) => {
      const roundedTop = Math.round(nextTop);
      const roundedLeft = Math.round(nextLeft);
      setTipState((prev) => {
        const prevMeta = tipLastShowRef.current;
        const shouldReplay = !prev.visible
          || prevMeta.el !== el
          || prevMeta.text !== text
          || prevMeta.placement !== resolvedPlacement
          || prevMeta.variant !== variant;
        const nonce = shouldReplay ? (tipNonceRef.current + 1) : tipNonceRef.current;
        if (shouldReplay) tipNonceRef.current = nonce;
        const positionStable = Math.abs((Number(prev.top) || 0) - roundedTop) <= 0.5
          && Math.abs((Number(prev.left) || 0) - roundedLeft) <= 0.5;
        if (
          prev.visible
          && prev.text === text
          && prev.placement === resolvedPlacement
          && prev.variant === variant
          && prev.nonce === nonce
          && positionStable
        ) {
          return prev;
        }
        tipLastShowRef.current = { el, text, placement: resolvedPlacement, variant };
        return {
          text,
          top: roundedTop,
          left: roundedLeft,
          placement: resolvedPlacement,
          visible: true,
          variant,
          nonce
        };
      });
    };

    if (nextPlacement === "left" || nextPlacement === "right") {
      const canPlaceLeft = (rect.left - gap - tipWidth) >= padding;
      const canPlaceRight = (rect.right + gap + tipWidth) <= (viewportWidth - padding);
      if (nextPlacement === "left" && !canPlaceLeft && canPlaceRight) {
        nextPlacement = "right";
      } else if (nextPlacement === "right" && !canPlaceRight && canPlaceLeft) {
        nextPlacement = "left";
      }
      let left = nextPlacement === "left"
        ? Math.round(rect.left - gap)
        : Math.round(rect.right + gap);
      let top = Math.round(rect.top + (rect.height / 2));
      const minTop = padding + tipHalfHeight;
      const maxTop = viewportHeight - padding - tipHalfHeight;
      const minLeft = nextPlacement === "left" ? (padding + tipWidth) : padding;
      const maxLeft = nextPlacement === "left" ? (viewportWidth - padding) : (viewportWidth - padding - tipWidth);
      top = clamp(top, minTop, maxTop);
      left = clamp(left, minLeft, maxLeft);
      applyTipState(nextPlacement, top, left);
      return;
    }

    const canPlaceTop = (rect.top - gap - tipHeight) >= padding;
    const canPlaceBottom = (rect.bottom + gap + tipHeight) <= (viewportHeight - padding);
    if (nextPlacement === "top" && !canPlaceTop && canPlaceBottom) {
      nextPlacement = "bottom";
    } else if (nextPlacement === "bottom" && !canPlaceBottom && canPlaceTop) {
      nextPlacement = "top";
    }

    const minLeft = padding + tipHalfWidth;
    const maxLeft = viewportWidth - padding - tipHalfWidth;
    const left = clamp(Math.round(rect.left + (rect.width / 2)), minLeft, maxLeft);
    const minTop = nextPlacement === "top" ? (padding + tipHeight) : padding;
    const maxTop = nextPlacement === "top" ? (viewportHeight - padding) : (viewportHeight - padding - tipHeight);
    const preferredTop = nextPlacement === "top"
      ? Math.round(rect.top - gap)
      : Math.round(rect.bottom + gap);
    const top = clamp(preferredTop, minTop, maxTop);
    applyTipState(nextPlacement, top, left);
  };

  const hideTip = (delayMs = 0) => {
    if (tipShowTimerRef.current) {
      clearTimeout(tipShowTimerRef.current);
      tipShowTimerRef.current = null;
    }
    if (tipHideTimerRef.current) {
      clearTimeout(tipHideTimerRef.current);
      tipHideTimerRef.current = null;
    }
    if (delayMs > 0) {
      tipHideTimerRef.current = setTimeout(() => {
        setTipState((prev) => (prev.visible ? { ...prev, visible: false } : prev));
        tipLastShowRef.current = { el: null, text: "", placement: "", variant: "" };
        tipHideTimerRef.current = null;
      }, delayMs);
      return;
    }
    setTipState((prev) => (prev.visible ? { ...prev, visible: false } : prev));
    tipLastShowRef.current = { el: null, text: "", placement: "", variant: "" };
  };

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    const ariaLabelMap = {
      "minimize": "最小化",
      "pin": "置顶",
      "auto-minimize-on-blur": "失焦自动最小化",
      "close": "关闭",
      "toggle-auto-export": "切换导出模式",
      "open-cache-folder": "打开缓存目录",
      "run-with-chat-image": "跑图",
      "run-with-latest-image": "使用新图片跑图",
      "undo": "撤回",
      "copy": "复制",
      "send": isSending ? "停止生成" : "发送消息"
    };
    const selector = [
      "button",
      "[data-tip-text]",
      ".settings-link",
      ".model-bubble",
      ".settings-model-group-head",
      ".settings-model-option"
    ].join(",");
    const getTipText = (el) => {
      if (String(el.getAttribute("data-tip-skip") || "").trim() === "true") return "";
      const explicit = el.getAttribute("data-tip-text");
      if (explicit) return explicit;
      const title = el.getAttribute("title");
      if (title) {
        // avoid browser native tooltip style conflicting with our global tip
        el.setAttribute("data-tip-text", title);
        el.removeAttribute("title");
        return title;
      }
      const aria = el.getAttribute("aria-label");
      if (aria && ariaLabelMap[aria]) return ariaLabelMap[aria];
      const text = String(el.textContent || "").replace(/\s+/g, " ").trim();
      if (text) return text;
      return "";
    };
    const isUploadAreaTipTarget = (el) => !!el?.closest?.(".upload-area");
    const getPlacement = (el) => {
      const explicit = String(el.getAttribute("data-tip-placement") || "").trim().toLowerCase();
      const rect = typeof el?.getBoundingClientRect === "function" ? el.getBoundingClientRect() : null;
      const viewportHeight = Math.round(window.visualViewport?.height || window.innerHeight || document.documentElement.clientHeight || 640);
      const pickVerticalPlacement = () => {
        if (!rect) return "bottom";
        const spaceTop = Math.max(0, rect.top);
        const spaceBottom = Math.max(0, viewportHeight - rect.bottom);
        return spaceTop >= spaceBottom ? "top" : "bottom";
      };
      const targetWidth = Number(rect?.width) || 0;
      if (explicit === "top" || explicit === "bottom") return explicit;
      if (explicit === "left" || explicit === "right") {
        // Wide controls are easier to read with vertical tips (avoid overlap).
        return targetWidth > 32 ? pickVerticalPlacement() : explicit;
      }
      if (el.classList.contains("run-pop-btn")) return "top";
      if (targetWidth > 32) return pickVerticalPlacement();
      return pickVerticalPlacement();
    };
    const getVariant = (el) => {
      const raw = String(el.getAttribute("data-tip-variant") || "").trim();
      if (raw) return raw;
      if (el?.closest?.(".settings")) return "settings";
      return "";
    };
    const scheduleTip = (targetEl, text, placement = "bottom", delayMs = TIP_DELAY_DEFAULT_MS, variant = "") => {
      if (tipHideTimerRef.current) clearTimeout(tipHideTimerRef.current);
      if (tipShowTimerRef.current) clearTimeout(tipShowTimerRef.current);
      const el = targetEl;
      const safeDelay = Math.max(0, delayMs);
      if (safeDelay <= 0) {
        showTipByElement(el, text, placement, variant);
        tipShowTimerRef.current = null;
        return;
      }
      tipShowTimerRef.current = setTimeout(() => {
        showTipByElement(el, text, placement, variant);
        tipShowTimerRef.current = null;
      }, safeDelay);
    };
    const setPointerByEvent = (event) => {
      const x = Number(event?.clientX);
      const y = Number(event?.clientY);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      tipPointerRef.current = { x, y };
    };
    const refreshTipFromPointer = () => {
      if (!tipHoverTargetRef.current) return;
      const { x, y } = tipPointerRef.current || {};
      if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0) return;
      const pointed = document.elementFromPoint(Math.round(x), Math.round(y));
      const target = pointed?.closest?.(selector);
      if (!target || target.disabled) {
        tipHoverTargetRef.current = null;
        hideTip(0);
        return;
      }
      const text = getTipText(target);
      if (!text) {
        tipHoverTargetRef.current = null;
        hideTip(0);
        return;
      }
      tipHoverTargetRef.current = target;
      scheduleTip(target, text, getPlacement(target), 0, getVariant(target));
    };
    const onMouseOver = (event) => {
      setPointerByEvent(event);
      const target = event.target?.closest?.(selector);
      if (!target || target.disabled) return;
      if (target.contains(event.relatedTarget)) return;
      const text = getTipText(target);
      if (!text) return;
      const previousTarget = tipHoverTargetRef.current;
      tipHoverTargetRef.current = target;
      if (isUploadAreaTipTarget(target)) {
        scheduleTip(target, text, getPlacement(target), 0, getVariant(target));
        return;
      }
      const baseDelay = TIP_DELAY_UNIFIED_MS;
      const delay = previousTarget && previousTarget !== target ? TIP_SWITCH_REPLAY_DELAY_MS : baseDelay;
      scheduleTip(target, text, getPlacement(target), delay, getVariant(target));
    };
    const onMouseOut = (event) => {
      setPointerByEvent(event);
      const target = event.target?.closest?.(selector);
      if (!target) return;
      if (target.contains(event.relatedTarget)) return;
      if (tipHoverTargetRef.current === target) {
        tipHoverTargetRef.current = null;
      }
      hideTip(300);
    };
    const onPointerMove = (event) => {
      setPointerByEvent(event);
    };
    let scrollRaf = 0;
    const onTrackedScroll = (event) => {
      if (!tipHoverTargetRef.current && !tipVisibleRef.current) return;
      if (Date.now() < tipScrollLockUntilRef.current) return;
      const scrollTarget = event?.target;
      // Settings panel scroll is high-frequency; hiding tip here avoids repeated
      // elementFromPoint/reposition work that can introduce visible scroll jank.
      if (scrollTarget?.closest?.(".settings")) {
        tipHoverTargetRef.current = null;
        hideTip(0);
        return;
      }
      if (scrollTarget?.closest?.(".upload-slots") && tipHoverTargetRef.current?.closest?.(".upload-area")) {
        return;
      }
      if (scrollRaf) return;
      scrollRaf = requestAnimationFrame(() => {
        scrollRaf = 0;
        refreshTipFromPointer();
      });
    };
    const onPointerDown = (event) => {
      setPointerByEvent(event);
      tipHoverTargetRef.current = null;
      hideTip(0);
    };
    document.addEventListener("mouseover", onMouseOver, true);
    document.addEventListener("mouseout", onMouseOut, true);
    document.addEventListener("pointermove", onPointerMove, true);
    document.addEventListener("scroll", onTrackedScroll, true);
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("mouseover", onMouseOver, true);
      document.removeEventListener("mouseout", onMouseOut, true);
      document.removeEventListener("pointermove", onPointerMove, true);
      document.removeEventListener("scroll", onTrackedScroll, true);
      document.removeEventListener("pointerdown", onPointerDown, true);
      if (scrollRaf) cancelAnimationFrame(scrollRaf);
    };
  }, [isSending]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const handleOpenCacheFolder = async () => {
    try {
      if (window.shell && typeof window.shell.openTempFolder === "function") {
        await window.shell.openTempFolder();
        return;
      }
      await fetch(`${bridgeApiBase}/open-cache`, { method: "POST" });
    } catch {
      // ignore: optional helper
    }
  };

  const handleCopyJsonText = async (text) => {
    await copyTextWithFeedback(text, {
      source: "system",
      emptyWarn: "当前没有可复制的 JSON 提示词",
      successLog: "JSON 提示词已复制",
      successToast: "复制成功",
      failWarn: "复制失败"
    });
  };

  const handleActivateJsonPrompt = (text, options = {}) => {
    const value = String(text || "").trim();
    if (!value) return;
    const { autoRun = false, runOptions = {} } = options;
    setJsonPromptText(value);
    appendLog("info", "已接管该条 JSON 提示词", "system");
    if (autoRun) {
      void handleRunLatest({ promptText: value, ...runOptions });
    }
  };

  const handleEditJsonPrompt = (messageId, value) => {
    const nextText = String(value || "");
    let parsed = null;
    try {
      parsed = nextText.trim() ? JSON.parse(nextText) : null;
    } catch {
      parsed = null;
    }
    setActiveMessages((prev) => prev.map((item) => (
      item.id === messageId
        ? {
            ...item,
            jsonPromptText: nextText,
            jsonPrompt: parsed || item.jsonPrompt
          }
        : item
    )));
    setJsonPromptText(nextText);
    setJsonEditedPending(true);
  };

  const toggleThinkingVisible = (messageId) => {
    if (!messageId) return;
    setThinkingOpenMap((prev) => ({ ...prev, [messageId]: !prev[messageId] }));
  };

  const runThinkingTranslation = async (text, options = {}) => {
    const source = String(text || "").trim();
    if (!source) return { text: "", provider: "" };
    const normalizedSource = source.slice(0, 10000);
    const timeoutMs = Math.max(3000, Math.min(20000, Number(options?.timeoutMs) || 9000));

    const translateByGoogleFree = async () => {
      const endpoint = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh-CN&dt=t&q=${encodeURIComponent(normalizedSource)}`;
      const res = await fetchWithTimeout(endpoint, { method: "GET" }, timeoutMs);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = await res.json();
      const segments = Array.isArray(payload?.[0]) ? payload[0] : [];
      const translated = segments
        .map((item) => (Array.isArray(item) ? String(item[0] || "") : ""))
        .join("")
        .trim();
      if (!translated) throw new Error("翻译结果为空");
      return translated;
    };
    const translated = await translateByGoogleFree();
    return { text: translated, provider: "Google 免费" };
  };

  const handleTranslateThinking = async (messageId, thinkingText, options = {}) => {
    const id = String(messageId || "").trim();
    const source = String(thinkingText || "").trim();
    if (!id || !source || !thinkingTranslateEnabled) return;
    if (thinkingTranslateInFlightRef.current.has(id)) return;
    const sourceSig = `${source.length}:${source.slice(0, 24)}:${source.slice(-24)}`;
    const cached = thinkingTranslationMap[id];
    if (cached?.status === "done" && cached?.sourceSig === sourceSig && String(cached?.text || "").trim()) return;

    thinkingTranslateInFlightRef.current.add(id);
    setThinkingTranslationMap((prev) => ({
      ...prev,
      [id]: { status: "loading", text: "", error: "", sourceSig, provider: "" }
    }));
    try {
      const translatedResult = await runThinkingTranslation(source);
      const translated = String(translatedResult?.text || "").trim();
      const provider = String(translatedResult?.provider || "").trim();
      setThinkingTranslationMap((prev) => ({
        ...prev,
        [id]: { status: "done", text: translated, error: "", sourceSig, provider }
      }));
      if (!options?.silent) {
        appendLog("info", `思考流翻译成功（${provider || "免费接口"}）`, "api");
      }
    } catch (err) {
      const msg = String(err?.message || err || "翻译失败");
      setThinkingTranslationMap((prev) => ({
        ...prev,
        [id]: { status: "error", text: "", error: msg, sourceSig, provider: "" }
      }));
      if (!options?.silent) {
        appendLog("warn", `思考流翻译失败：${msg}`, "api");
      }
    } finally {
      thinkingTranslateInFlightRef.current.delete(id);
    }
  };

  useEffect(() => {
    if (!thinkingTranslateEnabled) return;
    const assistantMessages = Array.isArray(messages) ? messages : [];
    assistantMessages.forEach((message) => {
      if (!message || message.role !== "assistant" || message.status === "pending") return;
      const thinkingText = String(message.thinking || "").trim();
      if (!thinkingText) return;
      const id = String(message.id || "").trim();
      if (!id) return;
      const sourceSig = `${thinkingText.length}:${thinkingText.slice(0, 24)}:${thinkingText.slice(-24)}`;
      const cached = thinkingTranslationMap[id];
      if (cached?.status === "loading" && cached?.sourceSig === sourceSig) return;
      if (cached?.status === "done" && cached?.sourceSig === sourceSig && String(cached?.text || "").trim()) return;
      if (cached?.status === "error" && cached?.sourceSig === sourceSig) return;
      void handleTranslateThinking(id, thinkingText, { silent: true });
    });
  }, [thinkingTranslateEnabled, messages, thinkingTranslationMap]);

  const requestAutoSessionName = async ({ providerMode, config, userText, assistantText, signal }) => {
    const cfg = sanitizeChatConfig(config || chatConfig);
    const userSnippet = String(userText || "").trim().slice(0, 320);
    const assistantSnippet = String(assistantText || "").trim().slice(0, 420);
    const namingMessages = [
      {
        role: "system",
        content: "你是对话命名器。请根据用户与助手首轮内容，输出一个简短中文标题。只输出标题本身，不要解释，不要引号，不超过14字。"
      },
      {
        role: "user",
        content: `用户：${userSnippet}\n助手：${assistantSnippet || "（无）"}`
      }
    ];
    if (providerMode === "google-native") {
      const googleBase = normalizeGoogleBaseForModels(cfg.baseUrl);
      const endpoint = `${googleBase}/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`;
      const bodyPayload = {
        contents: buildGoogleContentsFromMessages(namingMessages),
        generationConfig: {
          temperature: 0.2,
          topP: 0.9,
          maxOutputTokens: 32
        }
      };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
        signal
      });
      const textResp = await res.text();
      if (!String(res.headers.get("content-type") || "").toLowerCase().includes("application/json")) {
        throw new Error(`命名请求失败：HTTP ${res.status}`);
      }
      const data = textResp ? JSON.parse(textResp) : {};
      if (!res.ok) throw new Error(String(data?.error?.message || data?.message || `HTTP ${res.status}`));
      return sanitizeSessionTitle(extractAssistantTextFromGoogleResponse(data), userText);
    }
    const endpoint = normalizeOpenAIChatEndpoint(cfg.baseUrl);
    const bodyPayload = {
      model: cfg.model,
      stream: false,
      messages: namingMessages,
      max_tokens: 32,
      temperature: 0.2,
      top_p: 0.9
    };
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`
      },
      body: JSON.stringify(bodyPayload),
      signal
    });
    const textResp = await res.text();
    if (!String(res.headers.get("content-type") || "").toLowerCase().includes("application/json")) {
      throw new Error(`命名请求失败：HTTP ${res.status}`);
    }
    const data = textResp ? JSON.parse(textResp) : {};
    if (!res.ok) throw new Error(String(data?.error?.message || data?.message || `HTTP ${res.status}`));
    return sanitizeSessionTitle(extractAssistantText(data), userText);
  };

  const maybeAutoNameSession = async ({ sessionId, userText, assistantText, providerMode, config, historyMessages }) => {
    const id = String(sessionId || "").trim();
    const firstUserText = String(userText || "").trim();
    if (!id || !firstUserText) return;
    const hasAssistantBefore = (Array.isArray(historyMessages) ? historyMessages : []).some(
      (item) => item?.role === "assistant" && String(item?.status || "") === "done" && String(item?.text || "").trim()
    );
    if (hasAssistantBefore) return;
    const exists = (chatSessionsRef.current || []).find((item) => item.id === id);
    if (!exists || !isUntitledSessionName(exists.name)) return;

    if (!sessionNamingEnabled) {
      const fallback = buildSessionNameFromUserText(firstUserText);
      setChatSessions((prev) => prev.map((session) => (
        session.id === id && isUntitledSessionName(session.name)
          ? { ...session, name: fallback, updatedAt: Date.now() }
          : session
      )));
      appendLog("info", `对话已按首句命名：${fallback}`, "system");
      return;
    }

    if (sessionNamingInFlightRef.current.has(id)) return;
    sessionNamingInFlightRef.current.add(id);
    appendLog("info", "对话自动命名中…", "system");
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      let nextName = "";
      try {
        nextName = await requestAutoSessionName({
          providerMode,
          config,
          userText: firstUserText,
          assistantText,
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeout);
      }
      const safeName = sanitizeSessionTitle(nextName, firstUserText);
      setChatSessions((prev) => prev.map((session) => (
        session.id === id && isUntitledSessionName(session.name)
          ? { ...session, name: safeName, updatedAt: Date.now() }
          : session
      )));
      appendLog("info", `对话自动命名完成：${safeName}`, "system");
    } catch {
      const fallback = buildSessionNameFromUserText(firstUserText);
      setChatSessions((prev) => prev.map((session) => (
        session.id === id && isUntitledSessionName(session.name)
          ? { ...session, name: fallback, updatedAt: Date.now() }
          : session
      )));
      appendLog("warn", `对话自动命名失败，已回退首句命名：${fallback}`, "system");
    } finally {
      sessionNamingInFlightRef.current.delete(id);
    }
  };

  const updateServerStatusFromInfo = (info, available = true, fallbackPort = bridgePort) => {
    const nextPort = normalizeBridgePort(info?.port, fallbackPort);
    setBridgePort(nextPort);
    setServerStatus({
      running: !!info?.running,
      pid: info?.pid || null,
      port: nextPort,
      available
    });
    return nextPort;
  };

  const handleApplyBridgePort = async () => {
    if (!window.shell || !serverStatus.available || bridgePortApplying) return;
    const nextPort = parseBridgePort(String(bridgePortDraft || "").trim());
    if (!nextPort) {
      appendLog("warn", "桥接端口必须为 1-65535 的整数", "bridge");
      setBridgePortDraft(String(bridgePort));
      return;
    }
    if (nextPort === bridgePort) {
      setBridgePortDraft(String(bridgePort));
      return;
    }
    setBridgePortApplying(true);
    try {
      if (typeof window.shell.bridgePortSet === "function") {
        const result = await window.shell.bridgePortSet(nextPort);
        if (!result?.ok) {
          throw new Error(result?.message || "端口保存失败");
        }
      }
      setBridgePort(nextPort);
      setBridgePortDraft(String(nextPort));
      const shouldRestart = !!serverStatus.running
        && typeof window.shell.serverStop === "function"
        && typeof window.shell.serverStart === "function";
      if (shouldRestart) {
        await window.shell.serverStop();
        const info = await window.shell.serverStart({ port: nextPort });
        const appliedPort = updateServerStatusFromInfo(info, true, nextPort);
        appendLog("info", `桥接端口已切换到 ${appliedPort}`, "bridge");
      } else {
        setServerStatus((prev) => ({ ...prev, port: nextPort }));
        appendLog("info", `桥接端口已保存为 ${nextPort}（启动后生效）`, "bridge");
      }
    } catch (err) {
      appendLog("warn", `桥接端口更新失败：${String(err?.message || err)}`, "bridge");
      setBridgePortDraft(String(bridgePort));
    } finally {
      setBridgePortApplying(false);
    }
  };

  const handleBridgePortDraftKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleApplyBridgePort();
    }
  };

  const refreshCacheStats = async () => {
    if (!window.shell || typeof window.shell.cacheStatsGet !== "function") return;
    try {
      const result = await window.shell.cacheStatsGet();
      if (result?.ok) {
        setCacheStats(normalizeCacheStats(result));
      }
    } catch {
      // ignore
    }
  };

  const handleCachePolicyChange = (field, rawValue) => {
    const key = String(field || "").trim();
    if (!["chatRecords", "images", "other"].includes(key)) return;
    setCachePolicy((prev) => {
      const next = sanitizeCachePolicy({
        ...prev,
        [key]: rawValue
      });
      if (isCachePolicyEqual(prev, next)) return prev;
      if (cachePolicyApplyTimerRef.current) {
        clearTimeout(cachePolicyApplyTimerRef.current);
        cachePolicyApplyTimerRef.current = null;
      }
      cachePolicyApplyTimerRef.current = setTimeout(async () => {
        const seq = cachePolicyApplySeqRef.current + 1;
        cachePolicyApplySeqRef.current = seq;
        try {
          if (!window.shell || typeof window.shell.cachePolicySet !== "function") return;
          const result = await window.shell.cachePolicySet(next);
          if (seq !== cachePolicyApplySeqRef.current) return;
          if (!result?.ok) return;
          const normalizedPolicy = sanitizeCachePolicy(result?.policy || next);
          setCachePolicy((current) => (isCachePolicyEqual(current, normalizedPolicy) ? current : normalizedPolicy));
          if (result?.stats?.ok) {
            setCacheStats(normalizeCacheStats(result.stats));
          } else {
            void refreshCacheStats();
          }
        } catch {
          // ignore
        } finally {
          if (cachePolicyApplyTimerRef.current) {
            clearTimeout(cachePolicyApplyTimerRef.current);
            cachePolicyApplyTimerRef.current = null;
          }
        }
      }, 260);
      return next;
    });
  };

    const handleReconnect = async () => {
    if (status.psConnected) return;
    const reconnectStartedAt = Date.now();
    try {
      appendTraceLog({
        level: "info",
        type: "bridge",
        domain: "插件连接",
        phase: "重连发送",
        message: "发起重连。",
        startedAt: reconnectStartedAt
      });
      setMiniConsole("插件重连中", "busy", "正在发起桥接重连。");
      if (window.shell && typeof window.shell.serverStart === "function" && !serverStatus.running) {
        const info = await window.shell.serverStart({ port: bridgePort });
        updateServerStatusFromInfo(info, true);
        appendLog("info", "桥接服务已启动", "bridge");
      }
      if (window.shell && typeof window.shell.reconnect === "function") {
        await window.shell.reconnect();
      } else {
        await fetch(`${bridgeApiBase}/reconnect`, { method: "POST" });
      }
      appendTraceLog({
        level: "info",
        type: "bridge",
        domain: "插件连接",
        phase: "重连发送",
        message: "重连命令已发送。",
        startedAt: reconnectStartedAt,
        endedAt: Date.now()
      });
      setMiniConsole("插件重连中", "busy", "重连命令已发送，等待插件握手。");
    } catch (err) {
      const raw = String(err?.message || err || "重连失败");
      appendTraceLog({
        level: "warn",
        type: "bridge",
        domain: "插件连接",
        phase: "重连失败",
        message: raw,
        startedAt: reconnectStartedAt,
        endedAt: Date.now(),
        guide: getFixGuideForError(raw, "bridge")
      });
      setMiniConsole("插件重连错", "error", "重连失败。请打开大控制台查看修复指引。");
    }
  };

  useEffect(() => {
    requestAnimationFrame(() => {
      if (!chatScrollRef.current) return;
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    });
  }, [messages.length]);

  useEffect(() => {
    const rafId = requestAnimationFrame(() => {
      const logBox = consoleRef.current?.querySelector?.(".log-box");
      if (!logBox) return;
      logBox.scrollTop = logBox.scrollHeight;
    });
    return () => cancelAnimationFrame(rafId);
  }, [logs.length, consoleOpen, logFilters]);

  useEffect(() => {
    return () => {
      if (runHoverTimerRef.current) clearTimeout(runHoverTimerRef.current);
      runHoverTimerRef.current = null;
      if (tipShowTimerRef.current) clearTimeout(tipShowTimerRef.current);
      tipShowTimerRef.current = null;
      if (tipHideTimerRef.current) clearTimeout(tipHideTimerRef.current);
      tipHideTimerRef.current = null;
      if (tipMeasureElRef.current && document.body?.contains?.(tipMeasureElRef.current)) {
        tipMeasureElRef.current.remove();
      }
      tipMeasureElRef.current = null;
      if (copyToastTimerRef.current) clearTimeout(copyToastTimerRef.current);
      copyToastTimerRef.current = null;
      imageRunQueueRef.current = [];
      imageRunActiveTaskRef.current = null;
      imageRunProcessingRef.current = false;
      if (imageRunAbortControllerRef.current) {
        imageRunAbortReasonRef.current = "manual";
        try {
          imageRunAbortControllerRef.current.abort();
        } catch {
          // ignore abort errors
        }
      }
      imageRunAbortControllerRef.current = null;
      imageRunAbortReasonRef.current = "";
      imageRunRemoteCancelContextRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!window.shell || typeof window.shell.onResizing !== "function") return;
    const handler = (payload) => {
      const nextResizing = !!(payload && payload.resizing);
      const wasResizing = resizingRef.current;
      resizingRef.current = nextResizing;
      if (nextResizing && !wasResizing) {
        const { minWidth, minHeight } = lastMinSizeRef.current;
        if (window.shell && typeof window.shell.setWindowMinSize === "function" && minWidth && minHeight) {
          window.shell.setWindowMinSize(minWidth, minHeight);
        }
      }
      if (!nextResizing) {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
          if (measureRef.current) measureRef.current();
        });
        if (pendingMinSizeRef.current) {
          const { minWidth, minHeight } = pendingMinSizeRef.current;
          if (window.shell && typeof window.shell.setWindowMinSize === "function") {
            window.shell.setWindowMinSize(minWidth, minHeight);
          }
          pendingMinSizeRef.current = null;
        }
      }
    };
    const unsubscribe = window.shell.onResizing(handler);
    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, []);

  const runPopoverPortal = runHover
    ? createPortal(
        <div
          ref={runPopoverRef}
          className="run-popover is-visible floating-layer"
          style={{ top: runPopoverPos.top, left: runPopoverPos.left }}
          onMouseEnter={handleRunHoverEnter}
          onMouseLeave={handleRunHoverLeave}
        >
          <button
            className="run-pop-btn"
            onClick={(e) => { handleRunLatest({ imageSource: "upload" }); e.currentTarget.blur(); }}
            aria-label="run-with-latest-image"
          >
            <img className="icon-20" src={iconRunUploadZone} alt="run-upload-zone" />
          </button>
        </div>,
        document.body
      )
    : null;
  const generationSelectDropdownPortal = generationSelectDropdown.open
    ? createPortal(
        <div
          ref={generationSelectDropdownRef}
          className="control-select-dropdown floating-layer"
          style={{
            top: generationSelectDropdown.top,
            left: generationSelectDropdown.left,
            width: generationSelectDropdown.width
          }}
        >
          {(generationSelectDropdown.kind === "size" ? IMAGE_SIZE_OPTIONS : IMAGE_ASPECT_RATIO_OPTIONS).map((item) => {
            const active = generationSelectDropdown.kind === "size"
              ? item.value === generationImageSize
              : item.value === generationAspectRatio;
            return (
              <button
                key={`${generationSelectDropdown.kind}-${item.value}`}
                type="button"
                className={`control-select-option ${active ? "is-active" : ""}`}
                onClick={() => handlePickGenerationSelectOption(generationSelectDropdown.kind, item.value)}
              >
                {item.label}
              </button>
            );
          })}
        </div>,
        document.body
      )
    : null;
  const generationCountDropdownPortal = generationCountOpen
    ? createPortal(
        <div
          ref={generationCountDropdownRef}
          className="control-dropdown count-dropdown count-dropdown-portal"
          style={{
            top: generationCountDropdownPos.top,
            left: generationCountDropdownPos.left,
            width: generationCountDropdownPos.width || 220
          }}
        >
          <div className="count-range-block">
            <div className="count-range-head">
              <span className="count-input-label">生成数量</span>
              <div className="count-input-wrap">
                <span className="count-input-prefix">x</span>
                <input
                  className="count-input"
                  type="number"
                  min={1}
                  max={GENERATION_COUNT_HARD_MAX}
                  step={1}
                  value={generationCount}
                  onChange={(e) => handleGenerationCountManualInput(e.target.value)}
                />
              </div>
            </div>
            <input
              className="count-slider"
              type="range"
              min={1}
              max={GENERATION_COUNT_SLIDER_MAX}
              step={1}
              value={generationCountSliderValue}
              onChange={(e) => handleGenerationCountSlider(e.target.value)}
            />
          </div>
        </div>,
        document.body
      )
    : null;
  const uploadCompressPanelPortal = uploadSizeOpen
    ? createPortal(
        <div
          ref={uploadSizePanelRef}
          className="upload-compress-panel upload-compress-panel-portal floating-layer"
          style={{
            top: uploadSizePanelPos.top,
            left: uploadSizePanelPos.left,
            width: uploadSizePanelPos.width
          }}
        >
          <div className="upload-range-block">
            <div className="upload-range-head">
              <span className="upload-range-title">上传尺寸</span>
              <div className="upload-range-input-wrap">
                <input
                  className="upload-range-input"
                  type="number"
                  min={IMAGE_COMPRESS_MAX_SIDE_MIN}
                  max={IMAGE_COMPRESS_MAX_SIDE_HARD_MAX}
                  step={16}
                  value={uploadMaxSideValue}
                  onChange={(e) => handleUploadMaxSideManualInput(e.target.value)}
                />
                <span className="upload-range-suffix">px</span>
              </div>
            </div>
            <input
              className="upload-range-slider"
              type="range"
              min={IMAGE_COMPRESS_MAX_SIDE_MIN}
              max={IMAGE_COMPRESS_MAX_SIDE_SLIDER_MAX}
              step={16}
              value={uploadMaxSideSliderValue}
              onChange={(e) => handleUploadMaxSideSlider(e.target.value)}
            />
            <span className="upload-range-hint">说明：用于压缩上传尺寸，推荐 2048-4096px。</span>
          </div>

          <div className="upload-range-block">
            <div className="upload-range-head">
              <span className="upload-range-title">上传格式</span>
              <span className="upload-range-suffix">{uploadImageFormatValue.toUpperCase()}</span>
            </div>
            <div className="upload-format-toggle" role="group" aria-label="上传格式">
              <button
                type="button"
                className={`upload-format-btn ${uploadImageFormatValue === "jpg" ? "is-active" : ""}`}
                onClick={() => handleUploadImageFormatChange("jpg")}
              >
                JPG
              </button>
              <button
                type="button"
                className={`upload-format-btn ${uploadImageFormatValue === "png" ? "is-active" : ""}`}
                onClick={() => handleUploadImageFormatChange("png")}
              >
                PNG
              </button>
            </div>
            <span className="upload-range-hint">说明：默认 JPG（体积更小）；需要透明通道时切到 PNG。</span>
          </div>

          <div className="upload-range-block">
            <div className="upload-range-head">
              <span className="upload-range-title">上传品质</span>
              <div className="upload-range-input-wrap">
                <input
                  className="upload-range-input"
                  type="number"
                  min={IMAGE_COMPRESS_QUALITY_MIN}
                  max={IMAGE_COMPRESS_QUALITY_HARD_MAX}
                  step={1}
                  value={uploadQualityPercentValue}
                  disabled={uploadQualityLocked}
                  onChange={(e) => handleUploadQualityManualInput(e.target.value)}
                />
                <span className="upload-range-suffix">%</span>
              </div>
            </div>
            <input
              className="upload-range-slider"
              type="range"
              min={IMAGE_COMPRESS_QUALITY_MIN}
              max={IMAGE_COMPRESS_QUALITY_SLIDER_MAX}
              step={1}
              value={uploadQualitySliderValue}
              disabled={uploadQualityLocked}
              onChange={(e) => handleUploadQualitySlider(e.target.value)}
            />
            <span className="upload-range-hint">
              {uploadQualityLocked
                ? "说明：PNG 为无损格式，上传品质固定 100%。"
                : "说明：用于调整上传品质，数值越高细节保留越多。"}
            </span>
          </div>
        </div>,
        document.body
      )
    : null;

  const tipPortal = tipState.visible
    ? createPortal(
        <div
          key={`tip-${tipState.nonce || 0}`}
          ref={tipRef}
          className={`global-tip is-${tipState.placement} ${tipState.variant ? `is-${tipState.variant}` : ""}`}
          style={{ top: tipState.top, left: tipState.left }}
        >
          {tipState.text}
        </div>,
        document.body
      )
    : null;
  const copyToastPortal = copyToast.visible
    ? createPortal(
        <div
          className={`copy-toast ${copyToast.mode === "upload-limit" ? "is-upload-limit" : ""}`}
          style={
            copyToast.mode === "upload-limit" && Number.isFinite(copyToast.top) && Number.isFinite(copyToast.left)
              ? { top: copyToast.top, left: copyToast.left }
              : undefined
          }
        >
          {copyToast.text}
        </div>,
        document.body
      )
    : null;
  const modelDropdownPortal = modelDropdown.open
    ? createPortal(
        <div
          ref={modelDropdownPanelRef}
          className="settings-model-dropdown floating-layer"
          style={{ top: modelDropdown.top, left: modelDropdown.left, width: modelDropdown.width }}
        >
          <div className="settings-model-dropdown-card">
            {(() => {
              const customOnly = modelDropdown.section === "chat"
                ? String(chatSiteKey || "") === "custom"
                : String(imageSiteKey || "") === "custom";
              return (
                <>
            {modelDropdown.manualInputOpen ? (
              <div className="settings-model-search-row">
                <input
                  ref={modelDropdownInputRef}
                  className="settings-model-search"
                  value={modelDropdown.manualInputValue}
                  placeholder="输入模型 ID"
                  onChange={(e) => setModelDropdown((prev) => ({ ...prev, manualInputValue: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleApplyModelFromDropdownInput();
                    }
                  }}
                />
                <button
                  type="button"
                  className="settings-fetch-btn settings-model-apply-btn"
                  onClick={handleApplyModelFromDropdownInput}
                >
                  应用
                </button>
              </div>
            ) : (
              <>
                <input
                  ref={modelDropdownInputRef}
                  className="settings-model-search"
                  value={modelDropdown.search}
                  placeholder="搜索模型"
                  onChange={(e) => setModelDropdown((prev) => ({ ...prev, search: e.target.value }))}
                />
                <button
                  type="button"
                  className="settings-model-option settings-model-manual-option"
                  onClick={() => handlePickModel(modelDropdown.section, CUSTOM_MODEL_OPTION_VALUE)}
                >
                  自定义模型
                </button>
              </>
            )}
            {!customOnly ? (
              <>
                <div className="settings-model-common">
                  {dropdownCommonModels.slice(0, 8).map((item) => (
                    <button
                      key={`model-common-${item}`}
                      type="button"
                      className={`model-bubble ${item === (modelDropdown.section === "chat" ? chatConfig.model : imageConfig.model) ? "is-active" : ""}`}
                      onClick={() => handlePickModel(modelDropdown.section, item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>
                <div className="settings-model-list">
                  {Object.values(dropdownGroupedModels).some((list) => list.length > 0) && (
                    <div className="settings-model-empty">其他模型按服务商折叠，点击标题展开</div>
                  )}
                  {Object.values(dropdownGroupedModels).every((list) => list.length === 0) && (
                    <div className="settings-model-empty">没有匹配到模型</div>
                  )}
                  {Object.entries(dropdownGroupedModels).map(([provider, list]) => {
                    if (!list.length) return null;
                    return (
                    <div key={`provider-${provider}`} className="settings-model-group">
                      <button
                        type="button"
                        className="settings-model-group-head"
                        onClick={() => setModelGroupOpen((prev) => ({ ...prev, [provider]: !prev[provider] }))}
                      >
                        <span className="settings-model-group-title">{provider}</span>
                        <span className="settings-model-group-arrow">{modelGroupOpen[provider] || dropdownSearch ? "▾" : "▸"}</span>
                      </button>
                      <div className={`settings-model-group-body ${(modelGroupOpen[provider] || dropdownSearch) ? "is-open" : ""}`}>
                        {list.map((item) => (
                            <button
                              key={`model-item-${provider}-${item}`}
                              type="button"
                              className={`settings-model-option ${item === (modelDropdown.section === "chat" ? chatConfig.model : imageConfig.model) ? "is-active" : ""}`}
                              onClick={() => handlePickModel(modelDropdown.section, item)}
                            >
                              {item}
                            </button>
                          ))}
                      </div>
                    </div>
                  )})}
                </div>
              </>
            ) : (
              <div className="settings-model-empty">自定义服务商仅支持手动输入模型 ID</div>
            )}
                </>
              );
            })()}
          </div>
        </div>,
        document.body
      )
    : null;
  const providerDropdownPortal = providerDropdown.open
    ? createPortal(
        <div
          ref={providerDropdownPanelRef}
          className="settings-model-dropdown floating-layer"
          style={{ top: providerDropdown.top, left: providerDropdown.left, width: providerDropdown.width }}
        >
          <div className="settings-model-dropdown-card settings-simple-dropdown-card">
            {(() => {
              const section = providerDropdown.section;
              const selectedKey = section === "chat" ? chatSiteKey : imageSiteKey;
              const knownSites = section === "chat" ? CHAT_PROVIDER_SITES : IMAGE_PROVIDER_SITES;
              const primarySite = knownSites.find((item) => item.key === "aji") || knownSites[0] || null;
              const otherKnownSites = knownSites.filter((item) => !primarySite || item.key !== primarySite.key);
              const knownVisibleLimit = 5;
              const expanded = !!providerKnownOthersOpen[section]
                || otherKnownSites.slice(knownVisibleLimit).some((item) => item.key === selectedKey);
              const visibleKnownSites = expanded ? otherKnownSites : otherKnownSites.slice(0, knownVisibleLimit);
              const showMoreButton = otherKnownSites.length > knownVisibleLimit;
              const handlePickProviderSite = (item) => {
                if (item.key === "custom") {
                  const mode = section === "chat"
                    ? normalizeChatProviderModeBySiteKey(
                      "custom",
                      chatProviderProfiles.custom?.providerMode || chatConfig.providerMode || "openai-compat"
                    )
                    : normalizeImageProviderModeBySiteKey(
                      "custom",
                      imageProviderProfiles.custom?.providerMode || imageConfig.providerMode || "openai-compat"
                    );
                  handleSitePresetChange(section, "custom", { customProviderMode: mode });
                  closeProviderDropdown();
                  return;
                }
                handleSitePresetChange(section, item.key);
                closeProviderDropdown();
              };
              return (
                <>
                  {primarySite ? (
                    <button
                      key={`provider-${section}-${primarySite.key}`}
                      type="button"
                      className={`settings-model-option ${primarySite.key === selectedKey ? "is-active" : ""}`}
                      onClick={() => handlePickProviderSite(primarySite)}
                    >
                      {primarySite.label}
                    </button>
                  ) : null}
                  {otherKnownSites.length ? (
                    <div className="settings-provider-group">
                      <div className="settings-provider-group-title">已知其他服务商</div>
                      {visibleKnownSites.map((item) => (
                        <button
                          key={`provider-${section}-${item.key}`}
                          type="button"
                          className={`settings-model-option ${item.key === selectedKey ? "is-active" : ""}`}
                          onClick={() => handlePickProviderSite(item)}
                        >
                          {item.label}
                        </button>
                      ))}
                      {showMoreButton ? (
                        <button
                          type="button"
                          className="settings-provider-more-btn"
                          onClick={() => toggleKnownProvidersMore(section)}
                        >
                          {expanded ? "收起" : "展开更多"}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="settings-provider-divider" />
                  <button
                    type="button"
                    className={`settings-model-option ${selectedKey === "custom" ? "is-active" : ""}`}
                    onClick={() => handlePickProviderSite({ key: "custom", label: "自定义" })}
                  >
                    自定义
                  </button>
                </>
              );
            })()}
          </div>
        </div>,
        document.body
      )
    : null;
  const uiScaleDropdownPortal = uiScaleDropdown.open
    ? createPortal(
        <div
          ref={uiScaleDropdownPanelRef}
          className="settings-model-dropdown floating-layer"
          style={{ top: uiScaleDropdown.top, left: uiScaleDropdown.left, width: uiScaleDropdown.width }}
        >
          <div className="settings-model-dropdown-card settings-simple-dropdown-card">
            {UI_SCALE_OPTIONS.map((value) => {
              const valueKey = String(value);
              const active = valueKey === uiScaleSelectValue;
              return (
                <button
                  key={`ui-scale-option-${valueKey}`}
                  type="button"
                  className={`settings-model-option ${active ? "is-active" : ""}`}
                  onClick={() => handlePickUiScale(valueKey)}
                >
                  {`${Math.round(value * 100)}%`}
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )
    : null;
  const presetDropdownPortal = presetDropdown.open
    ? createPortal(
        <div
          ref={presetDropdownPanelRef}
          className="settings-model-dropdown floating-layer"
          style={{ top: presetDropdown.top, left: presetDropdown.left, width: presetDropdown.width }}
        >
          <div className="settings-model-dropdown-card settings-simple-dropdown-card settings-preset-dropdown-card">
            {allSystemPromptPresets.map((item) => (
              <button
                key={`preset-option-${item.id}`}
                type="button"
                className={`settings-model-option ${systemPromptPresetId === item.id ? "is-active" : ""}`}
                onClick={() => applySystemPromptPreset(item)}
              >
                {item.name}
              </button>
            ))}
            <div className="settings-preset-actions">
              <button className="settings-fetch-btn" type="button" onClick={handleAddSystemPromptPreset}>新增</button>
              <button className="settings-fetch-btn" type="button" onClick={handleDeleteSystemPromptPreset}>删除</button>
            </div>
          </div>
        </div>,
        document.body
      )
    : null;
  const identityQuickPortal = identityQuickOpen
    ? createPortal(
        <div
          ref={identityQuickPanelRef}
          className="identity-quick-panel identity-quick-panel-portal floating-layer"
          style={{ top: identityQuickPos.top, left: identityQuickPos.left, width: identityQuickPos.width }}
        >
          <div className="identity-quick-head">
            <span>身份设定</span>
            <div className="settings-preset-wrap" ref={presetAnchorRef}>
              <button
                className="dropdown-btn primary"
                type="button"
                onClick={() => {
                  if (presetDropdown.open) closePresetDropdown();
                  else openPresetDropdown();
                }}
              >
                {selectedSystemPromptPreset?.name || "选择预设"} <img className="icon-12" src={iconDropdown} alt="drop" />
              </button>
            </div>
          </div>
          <textarea
            className="identity-quick-textarea"
            value={chatConfig.systemPrompt}
            placeholder="给 AI 设置一个角色背景"
            onChange={(e) => handleConfigField("chat", "systemPrompt", e.target.value)}
          />
        </div>,
        document.body
      )
    : null;
  const chatQuickConfigPortal = chatQuickConfigOpen
    ? createPortal(
        <div
          ref={chatQuickConfigPanelRef}
          className="chat-quick-config-panel chat-quick-config-panel-portal floating-layer"
          style={{ top: chatQuickConfigPos.top, left: chatQuickConfigPos.left, width: chatQuickConfigPos.width }}
        >
          <div className="chat-quick-config-head">
            <span>对话预设</span>
            <div className="chat-quick-config-head-actions">
              {chatQuickPromptSelectMode ? (
                <>
                  <button className="settings-fetch-btn" type="button" onClick={handleToggleSelectAllChatQuickPrompts}>
                    {chatQuickPromptSelectedIds.length === sortedChatQuickPrompts.length ? "取消全选" : "全选"}
                  </button>
                  <button
                    className="settings-fetch-btn"
                    type="button"
                    disabled={!chatQuickPromptSelectedIds.length}
                    onClick={() => handleExportChatQuickPrompts(chatQuickPromptSelectedIds)}
                  >
                    {`导出(${chatQuickPromptSelectedIds.length})`}
                  </button>
                  <button
                    className="settings-fetch-btn chat-quick-delete-btn"
                    type="button"
                    disabled={!chatQuickPromptSelectedIds.length}
                    onClick={handleDeleteSelectedChatQuickPrompts}
                  >
                    {`删除(${chatQuickPromptSelectedIds.length})`}
                  </button>
                  <button className="settings-fetch-btn" type="button" onClick={toggleChatQuickPromptSelectMode}>完成</button>
                </>
              ) : (
                <>
                  <button className="settings-fetch-btn" type="button" onClick={handleCreateChatQuickPrompt}>新建</button>
                  <button className="settings-fetch-btn" type="button" onClick={() => chatQuickImportInputRef.current?.click()}>导入</button>
                  <button className="settings-fetch-btn" type="button" onClick={handleExportChatQuickPrompts}>导出</button>
                  <button className="settings-fetch-btn" type="button" onClick={toggleChatQuickPromptSelectMode}>批量</button>
                </>
              )}
            </div>
          </div>
          <div className="chat-quick-config-note">可置顶五个预设用于快捷输入</div>
          <div className="chat-quick-config-list">
            {sortedChatQuickPrompts.map((item, index) => (
              <div className="chat-quick-item-wrap" key={item?.id || `quick-config-${index + 1}`}>
                <div
                  className={`chat-history-item chat-quick-history-item ${item.pinned ? "is-pinned" : ""} ${chatQuickPromptMenuOpenId === item.id ? "is-menu-open" : ""} ${chatQuickPromptEditorOpenId === item.id ? "is-active" : ""} ${chatQuickPromptSelectMode ? "is-select-mode" : ""}`}
                >
                  {chatQuickPromptSelectMode && (
                    <label className="list-select-check" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={chatQuickPromptSelectedIds.includes(item.id)}
                        onChange={() => handleToggleChatQuickPromptSelected(item.id)}
                      />
                      <span className="list-select-indicator" />
                    </label>
                  )}
                  <button
                    className="chat-history-main chat-quick-history-main wheel-scroll-x"
                    type="button"
                    onClick={() => {
                      if (chatQuickPromptSelectMode) {
                        handleToggleChatQuickPromptSelected(item.id);
                        return;
                      }
                      handleApplyChatQuickPrompt(item);
                    }}
                    onWheel={handleOverflowWheelScroll}
                    data-tip-text={getQuickPromptPreview(item?.content)}
                    data-tip-variant="preset"
                  >
                    <span className="chat-quick-history-title">{String(item?.title || "").trim() || `预设${index + 1}`}</span>
                  </button>
                  <div className="chat-history-actions" data-chat-quick-menu="1">
                    <span className="chat-history-pin-icon" aria-hidden="true">
                      <img className="icon-16" src={iconSessionPin} alt="" />
                    </span>
                    {!chatQuickPromptSelectMode && (
                      <button
                        className="chat-history-more-btn"
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleChatQuickPromptMenu(item.id, e.currentTarget);
                        }}
                        title="更多"
                        data-chat-quick-menu="1"
                        ref={(el) => {
                          chatQuickPromptActionRefs.current[item.id] = el;
                        }}
                      >
                        <img className="icon-16" src={iconSessionMore} alt="quick-prompt-more" />
                      </button>
                    )}
                  </div>
                </div>
                {!chatQuickPromptSelectMode && chatQuickPromptEditorOpenId === item.id && (
                  <div className="chat-quick-inline-editor">
                    <label className="chat-quick-editor-label" htmlFor={`chat-quick-editor-title-${item.id}`}>标题</label>
                    <input
                      id={`chat-quick-editor-title-${item.id}`}
                      className="chat-quick-editor-input"
                      type="text"
                      maxLength={CHAT_QUICK_PROMPT_TITLE_MAX}
                      value={chatQuickPromptEditorDraft.title}
                      placeholder={item?.title || "预设标题"}
                      onChange={(e) => {
                        const value = stripEmojiForQuickTitle(e.target.value).slice(0, CHAT_QUICK_PROMPT_TITLE_MAX);
                        setChatQuickPromptEditorDraft((prev) => ({ ...prev, title: value }));
                      }}
                    />
                    <label className="chat-quick-editor-label" htmlFor={`chat-quick-editor-content-${item.id}`}>内容</label>
                    <textarea
                      id={`chat-quick-editor-content-${item.id}`}
                      className="chat-quick-editor-textarea"
                      value={chatQuickPromptEditorDraft.content}
                      placeholder="填写点击按钮后自动填入输入框的具体内容"
                      onChange={(e) => {
                        setChatQuickPromptEditorDraft((prev) => ({ ...prev, content: String(e.target.value || "") }));
                      }}
                    />
                    <div className="chat-quick-editor-actions">
                      <button className="settings-fetch-btn" type="button" onClick={closeChatQuickPromptEditor}>取消</button>
                      <button className="settings-fetch-btn chat-quick-editor-save-btn" type="button" onClick={handleSaveChatQuickPromptEditor}>保存</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {sortedChatQuickPrompts.length === 0 && (
              <div className="chat-quick-empty">暂无预设，点击“新建”添加。</div>
            )}
          </div>
          <input
            ref={chatQuickImportInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden-file-input"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              await handleImportChatQuickPrompts(file);
              e.target.value = "";
            }}
          />
        </div>,
        document.body
      )
    : null;
  const imageQuickConfigPortal = imageQuickConfigOpen
    ? createPortal(
        <div
          ref={imageQuickConfigPanelRef}
          className="chat-quick-config-panel chat-quick-config-panel-portal floating-layer"
          style={{ top: imageQuickConfigPos.top, left: imageQuickConfigPos.left, width: imageQuickConfigPos.width }}
        >
          <div className="chat-quick-config-head">
            <span>指令预设</span>
            <div className="chat-quick-config-head-actions">
              <button className="settings-fetch-btn" type="button" onClick={handleCreateImageQuickPrompt}>新建</button>
            </div>
          </div>
          <div className="chat-quick-config-note">点击预设可直接跑图（仅使用上传区图片）</div>
          <div className="chat-quick-config-list">
            {sortedImageQuickPrompts.map((item, index) => (
              <div className="chat-quick-item-wrap" key={item?.id || `img-quick-config-${index + 1}`}>
                <div
                  className={`chat-history-item chat-quick-history-item chat-instruction-history-item ${item.pinned ? "is-pinned" : ""} ${imageQuickPromptMenuOpenId === item.id ? "is-menu-open" : ""} ${imageQuickPromptEditorOpenId === item.id ? "is-active" : ""}`}
                >
                  <button
                    className="chat-history-main chat-quick-history-main wheel-scroll-x"
                    type="button"
                    onClick={() => handleRunImageQuickPrompt(item)}
                    onWheel={handleOverflowWheelScroll}
                    data-tip-text={getQuickPromptPreview(item?.content)}
                    data-tip-variant="preset"
                  >
                    <span className="chat-quick-history-title">{String(item?.title || "").trim() || `指令${index + 1}`}</span>
                  </button>
                  <div className="chat-history-actions chat-instruction-actions" data-image-quick-menu="1">
                    <span className="chat-history-pin-icon" aria-hidden="true">
                      <img className="icon-16" src={iconSessionPin} alt="" />
                    </span>
                    <button
                      className="chat-history-run-btn"
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRunImageQuickPrompt(item);
                      }}
                      data-tip-text="使用上传区图片跑图"
                      data-image-quick-menu="1"
                      aria-label="run-image-quick-prompt"
                    >
                      <img className="icon-16" src={iconRunUploadZone} alt="run-with-upload-images" />
                    </button>
                    <button
                      className="chat-history-more-btn"
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleImageQuickPromptMenu(item.id, e.currentTarget);
                      }}
                      title="更多"
                      data-image-quick-menu="1"
                      ref={(el) => {
                        imageQuickPromptActionRefs.current[item.id] = el;
                      }}
                    >
                      <img className="icon-16" src={iconSessionMore} alt="image-quick-prompt-more" />
                    </button>
                  </div>
                </div>
                {imageQuickPromptEditorOpenId === item.id && (
                  <div className="chat-quick-inline-editor">
                    <label className="chat-quick-editor-label" htmlFor={`image-quick-editor-title-${item.id}`}>标题</label>
                    <input
                      id={`image-quick-editor-title-${item.id}`}
                      className="chat-quick-editor-input"
                      type="text"
                      maxLength={CHAT_QUICK_PROMPT_TITLE_MAX}
                      value={imageQuickPromptEditorDraft.title}
                      placeholder={item?.title || "指令标题"}
                      onChange={(e) => {
                        const value = stripEmojiForQuickTitle(e.target.value).slice(0, CHAT_QUICK_PROMPT_TITLE_MAX);
                        setImageQuickPromptEditorDraft((prev) => ({ ...prev, title: value }));
                      }}
                    />
                    <label className="chat-quick-editor-label" htmlFor={`image-quick-editor-content-${item.id}`}>指令</label>
                    <textarea
                      id={`image-quick-editor-content-${item.id}`}
                      className="chat-quick-editor-textarea"
                      value={imageQuickPromptEditorDraft.content}
                      placeholder="填写点击后直接跑图的指令内容"
                      onChange={(e) => {
                        setImageQuickPromptEditorDraft((prev) => ({ ...prev, content: String(e.target.value || "") }));
                      }}
                    />
                    <div className="chat-quick-editor-actions">
                      <button className="settings-fetch-btn" type="button" onClick={closeImageQuickPromptEditor}>取消</button>
                      <button className="settings-fetch-btn chat-quick-editor-save-btn" type="button" onClick={handleSaveImageQuickPromptEditor}>保存</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {sortedImageQuickPrompts.length === 0 && (
              <div className="chat-quick-empty">暂无指令预设，点击“新建”添加。</div>
            )}
          </div>
        </div>,
        document.body
      )
    : null;
  const chatQuickPromptMenuItem = chatQuickPromptMenuOpenId
    ? chatQuickPrompts.find((item) => item.id === chatQuickPromptMenuOpenId)
    : null;
  const chatQuickPromptMenuPortal = chatQuickPromptMenuItem
    ? createPortal(
        <div
          ref={chatQuickPromptMenuPortalRef}
          className="chat-history-menu chat-history-menu-portal floating-layer"
          style={{ top: chatQuickPromptMenuPos.top, left: chatQuickPromptMenuPos.left }}
          data-chat-quick-menu="1"
        >
          <button
            className="chat-history-menu-item"
            type="button"
            onClick={() => handleOpenChatQuickPromptEditor(chatQuickPromptMenuItem.id)}
          >
            <img className="icon-16" src={iconSessionRename} alt="quick-prompt-edit" />
            <span>编辑</span>
          </button>
          <button
            className="chat-history-menu-item"
            type="button"
            onClick={() => handleTogglePinChatQuickPrompt(chatQuickPromptMenuItem.id)}
          >
            <img className="icon-16" src={chatQuickPromptMenuItem.pinned ? iconSessionUnpin : iconSessionPin} alt="quick-prompt-pin" />
            <span>{chatQuickPromptMenuItem.pinned ? "取消置顶" : "置顶"}</span>
          </button>
          <button
            className="chat-history-menu-item is-danger"
            type="button"
            onClick={() => handleRequestDeletePreset(chatQuickPromptMenuItem.id)}
          >
            <img className="icon-16" src={iconSessionDelete} alt="quick-prompt-delete" />
            <span>删除</span>
          </button>
        </div>,
        document.body
      )
    : null;
  const imageQuickPromptMenuItem = imageQuickPromptMenuOpenId
    ? imageQuickPrompts.find((item) => item.id === imageQuickPromptMenuOpenId)
    : null;
  const imageQuickPromptMenuPortal = imageQuickPromptMenuItem
    ? createPortal(
        <div
          ref={imageQuickPromptMenuPortalRef}
          className="chat-history-menu chat-history-menu-portal floating-layer"
          style={{ top: imageQuickPromptMenuPos.top, left: imageQuickPromptMenuPos.left }}
          data-image-quick-menu="1"
        >
          <button
            className="chat-history-menu-item"
            type="button"
            onClick={() => handleOpenImageQuickPromptEditor(imageQuickPromptMenuItem.id)}
          >
            <img className="icon-16" src={iconSessionRename} alt="image-quick-prompt-edit" />
            <span>编辑</span>
          </button>
          <button
            className="chat-history-menu-item"
            type="button"
            onClick={() => handleTogglePinImageQuickPrompt(imageQuickPromptMenuItem.id)}
          >
            <img className="icon-16" src={imageQuickPromptMenuItem.pinned ? iconSessionUnpin : iconSessionPin} alt="image-quick-prompt-pin" />
            <span>{imageQuickPromptMenuItem.pinned ? "取消置顶" : "置顶"}</span>
          </button>
          <button
            className="chat-history-menu-item is-danger"
            type="button"
            onClick={() => handleDeleteImageQuickPrompt(imageQuickPromptMenuItem.id)}
          >
            <img className="icon-16" src={iconSessionDelete} alt="image-quick-prompt-delete" />
            <span>删除</span>
          </button>
        </div>,
        document.body
      )
    : null;
  const sessionMenuSession = sessionMenuOpenId
    ? chatSessions.find((session) => session.id === sessionMenuOpenId)
    : null;
  const sessionMenuIsDraft = !!sessionMenuSession && isDraftSession(sessionMenuSession);
  const sessionMenuPortal = (sessionMenuSession && !historySelectMode)
    ? createPortal(
        <div
          ref={sessionMenuPortalRef}
          className="chat-history-menu chat-history-menu-portal floating-layer"
          style={{ top: sessionMenuPos.top, left: sessionMenuPos.left }}
          data-session-menu="1"
        >
          <button className="chat-history-menu-item" type="button" onClick={() => handleRenameSession(sessionMenuSession.id)}>
            <img className="icon-16" src={iconSessionRename} alt="rename" />
            <span>重命名</span>
          </button>
          {!sessionMenuIsDraft && (
            <button className="chat-history-menu-item" type="button" onClick={() => handleTogglePinSession(sessionMenuSession.id)}>
              <img className="icon-16" src={sessionMenuSession.pinned ? iconSessionUnpin : iconSessionPin} alt="pin-toggle" />
              <span>{sessionMenuSession.pinned ? "取消置顶" : "置顶"}</span>
            </button>
          )}
          <button className="chat-history-menu-item is-danger" type="button" onClick={() => handleRequestDeleteSession(sessionMenuSession.id)}>
            <img className="icon-16" src={iconSessionDelete} alt="delete" />
            <span>删除</span>
          </button>
        </div>,
        document.body
      )
    : null;
  const historyPanelPortal = historyOpen
    ? createPortal(
        <div
          ref={historyPanelRef}
          className="chat-history-panel chat-history-panel-portal floating-layer"
          style={{ top: historyPanelPos.top, left: historyPanelPos.left, width: historyPanelPos.width }}
        >
          <div className="chat-history-head">
            <span>对话列表</span>
            <div className="chat-history-head-actions">
              {historySelectMode ? (
                <>
                  <button className="settings-fetch-btn" type="button" onClick={handleToggleSelectAllHistory}>
                    {historySelectedIds.length === sortedSessions.length ? "取消全选" : "全选"}
                  </button>
                  <button
                    className="settings-fetch-btn chat-quick-delete-btn"
                    type="button"
                    disabled={!historySelectedIds.length}
                    onClick={handleDeleteSelectedSessions}
                  >
                    {`删除(${historySelectedIds.length})`}
                  </button>
                  <button className="settings-fetch-btn" type="button" onClick={toggleHistorySelectMode}>完成</button>
                </>
              ) : (
                <>
                  <button className="settings-fetch-btn" type="button" onClick={handleCreateSession}>新建</button>
                  <button className="settings-fetch-btn" type="button" onClick={toggleHistorySelectMode}>批量</button>
                  <button
                    ref={historyToolsAnchorRef}
                    className={`square-btn gray square-btn-sm chat-history-tools-trigger ${historyToolsOpen ? "is-active" : ""}`}
                    type="button"
                    onClick={toggleHistoryToolsPanel}
                    title="更多"
                    aria-label="更多"
                  >
                    <img className="icon-16" src={iconSessionMore} alt="chat-history-tools" />
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="chat-history-list">
            {sortedSessions.map((session) => (
              <div
                key={session.id}
                className={`chat-history-item ${activeSession?.id === session.id ? "is-active" : ""} ${session.pinned ? "is-pinned" : ""} ${sessionMenuOpenId === session.id ? "is-menu-open" : ""} ${isDraftSession(session) ? "is-draft" : ""} ${historySelectMode ? "is-select-mode" : ""}`}
              >
                {historySelectMode && (
                  <label className="list-select-check" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={historySelectedIds.includes(session.id)}
                      onChange={() => handleToggleHistorySelected(session.id)}
                    />
                    <span className="list-select-indicator" />
                  </label>
                )}
                <button
                  className="chat-history-main wheel-scroll-x"
                  onClick={() => handleSwitchSession(session.id)}
                  onWheel={handleOverflowWheelScroll}
                  type="button"
                >
                  {session.name || "未命名对话"}
                </button>
                <div className="chat-history-actions" data-session-menu="1">
                  {session.pinned && (
                    <span className="chat-history-pin-icon" aria-hidden="true">
                      <img className="icon-16" src={iconSessionPin} alt="" />
                    </span>
                  )}
                  {!historySelectMode && (
                    <button
                      className="chat-history-more-btn"
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleSessionMenu(session.id, e.currentTarget);
                      }}
                      title="更多"
                      data-session-menu="1"
                    >
                      <img className="icon-16" src={iconSessionMore} alt="session-more" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>,
        document.body
      )
    : null;
  const historyToolsPortal = historyToolsOpen
    ? createPortal(
        <div
          ref={historyToolsRef}
          className="chat-history-tools-panel chat-history-tools-panel-portal floating-layer"
          style={{ top: historyToolsPos.top, left: historyToolsPos.left, width: historyToolsPos.width }}
        >
          <button
            className="settings-fetch-btn"
            type="button"
            onClick={() => {
              setHistoryToolsOpen(false);
              historyInputRef.current?.click();
            }}
          >
            导入记录
          </button>
          <button
            className="settings-fetch-btn"
            type="button"
            onClick={() => {
              setHistoryToolsOpen(false);
              handleExportHistory();
            }}
          >
            导出记录
          </button>
        </div>,
        document.body
      )
    : null;
  const consoleFilterPortal = logFilterOpen
    ? createPortal(
        <div
          ref={consoleFilterPanelRef}
          className="console-filter-panel console-filter-panel-portal floating-layer"
          style={{ top: consoleFilterPos.top, left: consoleFilterPos.left, minWidth: consoleFilterPos.width }}
        >
          {LOG_FILTER_ITEMS.map((item) => {
            const checked = logFilters.includes(item.key);
            return (
              <label key={item.key} className="console-filter-item">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    setLogFilters((prev) => {
                      if (e.target.checked) {
                        return prev.includes(item.key) ? prev : [...prev, item.key];
                      }
                      return prev.filter((v) => v !== item.key);
                    });
                  }}
                />
                <span>{item.label}</span>
              </label>
            );
          })}
        </div>,
        document.body
      )
    : null;
  const visibleUploadSlotCount = Math.min(
    MAX_UPLOAD_IMAGES,
    Math.max(1, uploadImages.length + (uploadImages.length < MAX_UPLOAD_IMAGES ? 1 : 0))
  );
  const previewGeneratedCount = generatedPreviewImages.length;
  const previewSafeIndex = previewGeneratedCount > 0
    ? Math.min(Math.max(0, previewImageIndex), previewGeneratedCount - 1)
    : 0;
  const previewPrimaryImage = generatedPreviewImages[previewSafeIndex] || null;
  const filteredLogs = useMemo(
    () => logs.filter((line) => logFilters.includes(line.type)),
    [logs, logFilters]
  );
  const scaleModalPortal = scalePending
    ? createPortal(
        <div className="modal-mask">
          <div className="modal">
            <div className="modal-title">确认缩放</div>
            <div className="modal-text">
              将在 {scaleCountdown} 秒后恢复原样，请确认是否保留当前缩放。
            </div>
            <div className="modal-actions">
              <button className="modal-btn" onClick={handleScaleCancel}>恢复</button>
              <button className="modal-btn primary" onClick={handleScaleConfirm}>保留</button>
            </div>
          </div>
        </div>,
        document.body
      )
    : null;
  const deleteSessionModalPortal = deleteSessionTarget
    ? createPortal(
        <div className="modal-mask">
          <div className="modal">
            <div className="modal-title">确认删除对话</div>
            <div className="modal-text">
              {deleteSessionTarget.count > 1
                ? `将删除 ${deleteSessionTarget.count} 个对话，此操作无法撤销。`
                : `将删除“${deleteSessionTarget.name}”，此操作无法撤销。`}
            </div>
            <div className="modal-actions">
              <button className="modal-btn" onClick={handleCancelDeleteSession}>取消</button>
              <button className="modal-btn danger" onClick={handleConfirmDeleteSession}>删除</button>
            </div>
          </div>
        </div>,
        document.body
      )
    : null;
  const deletePresetModalPortal = deletePresetTarget
    ? createPortal(
        <div className="modal-mask">
          <div className="modal">
            <div className="modal-title">确认删除预设</div>
            <div className="modal-text">
              {deletePresetTarget.count > 1
                ? `将删除 ${deletePresetTarget.count} 条预设，此操作无法撤销。`
                : `将删除“${deletePresetTarget.name}”，此操作无法撤销。`}
            </div>
            <div className="modal-actions">
              <button className="modal-btn" onClick={handleCancelDeletePreset}>取消</button>
              <button className="modal-btn danger" onClick={handleConfirmDeletePreset}>删除</button>
            </div>
          </div>
        </div>,
        document.body
      )
    : null;
  const importTargetModalPortal = importTargetDialog.open
    ? createPortal(
        <div className="modal-mask">
          <div className="modal modal-import-target">
            <div className="modal-title">未找到对应画布</div>
            <div className="modal-text">
              {importTargetDialog.message || "未找到记录的画布，请选择导入目标。"}
            </div>
            <div className="import-target-recorded">
              <div className="import-target-label">记录画布</div>
              <div
                className="import-target-recorded-name"
                onWheel={handleOverflowWheelScroll}
              >
                {importTargetDialog.requestedDocumentName
                  || (importTargetDialog.requestedDocumentId ? `ID ${importTargetDialog.requestedDocumentId}` : "未记录")}
              </div>
            </div>
            <div className="import-target-open-list-wrap">
              <div className="import-target-label">已打开画布</div>
              {importTargetDialog.openDocuments.length ? (
                <div className="import-target-open-list">
                  {importTargetDialog.openDocuments.map((doc) => {
                    const selected = doc.id === importTargetDialog.selectedDocumentId;
                    return (
                      <button
                        key={`import-target-doc-${doc.id}`}
                        className={`import-target-open-item ${selected ? "is-selected" : ""}`}
                        type="button"
                        onClick={() => handleImportTargetDialogSelect(doc.id)}
                      >
                        <span
                          className="import-target-open-item-name"
                          onWheel={handleOverflowWheelScroll}
                        >
                          {doc.name}
                        </span>
                        {doc.isActive ? <span className="import-target-open-item-tag">当前</span> : null}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="import-target-empty">当前没有已打开画布。</div>
              )}
            </div>
            <div className="modal-actions">
              <button className="modal-btn" onClick={handleImportTargetDialogCancel}>取消</button>
              <button
                className="modal-btn primary"
                onClick={handleImportTargetDialogConfirm}
                disabled={!importTargetDialog.selectedDocumentId}
              >
                继续导入
              </button>
            </div>
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <div className="app">
      <div className="viewport">
        <div className="scale-root">
          <div
            className="panel"
          >
        <header className="topbar" ref={topbarRef}>
          <div className="topbar-row topbar-row-1">
            <div className="brand">
              <img className="brand-icon" src={iconLogo} alt="logo" />
              <div className="brand-text">
                <div className="brand-title">小迪助词器</div>
                <div className="brand-version">v0.0.1</div>
              </div>
            </div>
            <div className="window-controls">
              <button className="win-btn" onClick={handleMinimize} aria-label="minimize">
                <img className="icon-14" src={iconMinimize} alt="minimize" />
              </button>
              <button className={`win-btn ${alwaysOnTop ? "is-active" : ""}`} onClick={handlePin} aria-label="pin">
                <img className="icon-16 pin-icon" src={alwaysOnTop ? iconPinOn : iconPinOff} alt="pin" />
              </button>
              <button
                className={`win-btn ${autoMinimizeOnBlur ? "is-active" : ""}`}
                onClick={handleToggleAutoMinimizeOnBlur}
                aria-label="auto-minimize-on-blur"
                data-tip-text={autoMinimizeOnBlur ? "失焦自动最小化：已开启" : "失焦自动最小化：已关闭"}
              >
                <img className="icon-14" src={iconAutoCollapseWindow} alt="auto-minimize-on-blur" />
              </button>
              <button className="win-btn win-close" onClick={handleClose} aria-label="close">
                <img className="icon-14" src={iconClose} alt="close" />
              </button>
            </div>
          </div>
          <div className="topbar-row topbar-row-2">
            <TopbarApiStatusGroup
              chatStatusClass={getApiStatusClassName(chatApiStatus)}
              chatTipText={getApiStatusTip("聊天 API", chatApiStatus, chatApiIssueText)}
              imageStatusClass={getApiStatusClassName(imageApiStatus)}
              imageTipText={getApiStatusTip("跑图 API", imageApiStatus, imageApiIssueText)}
              onStatusClick={handleApiStatusClick}
              chatIcon={iconChatHistory}
              imageIcon={iconApiImage}
            />
            <div className="top-actions">
              <button
                className={`status-btn ${isConnected ? "status-ok" : "status-warn"}`}
                type="button"
                onMouseEnter={() => setStatusHover(true)}
                onMouseLeave={() => setStatusHover(false)}
                onClick={handleReconnect}
                data-tip-text={pluginConnectionTipText}
              >
                <img className="status-icon" src={isConnected ? iconConnecting : iconReconnect} alt="status" />
                <span>{isConnected ? "连接中" : statusHover ? "重新连接" : "未连接"}</span>
              </button>
              {view === "home" ? (
                <button className="icon-btn" onClick={() => setView("settings")}>
                  <span className="icon-btn-inner">
                    <span className="icon-text">设置</span>
                    <img className="icon-16" src={iconSettings} alt="settings" />
                  </span>
                </button>
              ) : (
                <button className="icon-btn" onClick={() => setView("home")}>
                  <span className="icon-btn-inner">
                    <span className="icon-text">首页</span>
                    <img className="icon-16" src={iconHome} alt="home" />
                  </span>
                </button>
              )}
            </div>
          </div>
        </header>

        {view === "home" ? (
          <main className="content-wrap" ref={contentWrapHomeRef}>
            <div className="content-scroll home-content-scroll" ref={contentScrollHomeRef}>
            <section className={`module preview-module ${previewCollapsed ? "is-collapsed" : ""}`} ref={previewRef}>
              <div className={`preview-card ${previewCollapsed ? "is-collapsed" : ""}`}>
                {previewPrimaryImage ? (
                  <button
                    type="button"
                    className="preview-body preview-image-btn"
                    onClick={() => openMessageImage(previewPrimaryImage)}
                    data-tip-text={previewPrimaryImage.name || "查看生成图"}
                  >
                    <img className="preview-image" src={previewPrimaryImage.dataUrl} alt={previewPrimaryImage.name || "preview-image"} />
                    <div className="preview-text">
                      {previewGeneratedCount > 1
                        ? `第 ${previewSafeIndex + 1}/${previewGeneratedCount} 张，点击查看大图`
                        : "已生成，点击查看大图"}
                    </div>
                    {previewGeneratedCount > 1 ? (
                      <div className="preview-switch-bar" onClick={(e) => e.stopPropagation()}>
                        <span
                          className="preview-switch-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            stepPreviewImage(-1);
                          }}
                          onKeyDown={(e) => {
                            if (e.key !== "Enter" && e.key !== " ") return;
                            e.preventDefault();
                            e.stopPropagation();
                            stepPreviewImage(-1);
                          }}
                          data-tip-text="上一张"
                          role="button"
                          tabIndex={0}
                          aria-label="preview-prev"
                        >
                          ‹
                        </span>
                        <span className="preview-switch-index">{`${previewSafeIndex + 1}/${previewGeneratedCount}`}</span>
                        <span
                          className="preview-switch-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            stepPreviewImage(1);
                          }}
                          onKeyDown={(e) => {
                            if (e.key !== "Enter" && e.key !== " ") return;
                            e.preventDefault();
                            e.stopPropagation();
                            stepPreviewImage(1);
                          }}
                          data-tip-text="下一张"
                          role="button"
                          tabIndex={0}
                          aria-label="preview-next"
                        >
                          ›
                        </span>
                      </div>
                    ) : null}
                  </button>
                ) : (
                  <div className="preview-body">
                    <img className="preview-icon" src={iconImageEmpty} alt="preview" />
                    <div className="preview-text">{isImageGenerating ? "跑图中..." : "等待 API 生成图片"}</div>
                  </div>
                )}
              </div>
              <div className="action-row">
                <div className="action-row-left">
                  <button
                    className="square-btn square-btn-sm"
                    onClick={handleTogglePreview}
                    aria-label="collapse"
                    data-tip-text={previewCollapsed ? "展开预览区" : "折叠预览区"}
                  >
                    <img className="icon-16 collapse-icon" src={iconArrowUp} alt="collapse" />
                  </button>
                  <button
                    ref={uploadSizeToggleRef}
                    className={`square-btn square-btn-sm ${uploadSizeOpen ? "is-active" : ""}`}
                    onClick={toggleUploadSizePanel}
                    data-tip-text="上传尺寸"
                  >
                    <img className="icon-16" src={iconUploadSize} alt="upload-size" />
                  </button>
                </div>
                <div className={`export-toggle ${autoExport ? "is-auto" : "is-manual"} ${exportHover ? "is-hover" : ""}`}>
                  <div
                    className="export-track"
                    role="group"
                    aria-label="export-action"
                    onMouseEnter={() => setExportHover(true)}
                    onMouseLeave={() => setExportHover(false)}
                    onClick={() => { void handleExportPreviewToCanvas({ trigger: "manual" }); }}
                    data-tip-text={autoExport ? "自动导出已开启，点击可立即导出当前预览图" : "手动导出当前预览图到画布"}
                  >
                    <button
                      className="export-circle"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAutoExport((v) => !v);
                      }}
                      aria-label="toggle-auto-export"
                    >
                      {autoExport ? "A" : "M"}
                    </button>
                    <span className="export-title">
                      {autoExport
                        ? (exportHover ? "手动导出" : "自动导出")
                        : "手动导出"}
                    </span>
                  </div>
                </div>
                <div className="action-row-tools">
                  <button
                    className="square-btn square-btn-sm"
                    onClick={() => {
                      setImportLayerType((prev) => (prev === "smart-object" ? "rasterized" : "smart-object"));
                    }}
                    data-tip-text={importLayerType === "smart-object" ? "回传图层：智能对象（点击切换为栅格化）" : "回传图层：栅格化（点击切换为智能对象）"}
                    aria-label="switch-import-layer-type"
                  >
                    <img
                      className="icon-16"
                      src={importLayerType === "smart-object" ? iconLayerSmartObject : iconLayerRasterized}
                      alt={importLayerType === "smart-object" ? "smart-object" : "rasterized"}
                    />
                  </button>
                  <button className="square-btn square-btn-sm" onClick={handleOpenCacheFolder} aria-label="open-cache-folder">
                    <img className="icon-16" src={iconFolder} alt="folder" />
                  </button>
                </div>
              </div>
            </section>

            <section className="module chat-module" ref={chatModuleRef}>
              <div className="module-header" ref={chatHeaderRef}>
                <div className="module-title">与 AI 对话</div>
                <div className="chat-header-actions" ref={chatHeaderActionsRef}>
                  <div className="chat-history-anchor" ref={historyPanelAnchorRef}>
                    <button
                      className="square-btn gray square-btn-sm"
                      onClick={handleToggleSessionPanel}
                      title="对话列表"
                    >
                      <img className="icon-16" src={iconChatHistory} alt="chat-history" />
                    </button>
                  </div>
                  <div className="top-identity-wrap" ref={identityQuickRef}>
                    <button
                      className={`square-btn gray square-btn-sm ${identityQuickOpen ? "is-active" : ""}`}
                      onClick={toggleIdentityQuickPanel}
                      title="身份设定"
                    >
                      <img className="icon-16" src={iconIdentity} alt="identity" />
                    </button>
                  </div>
                  <div className="chat-quick-config-wrap" ref={chatQuickConfigAnchorRef}>
                    <button
                      className={`square-btn gray square-btn-sm ${chatQuickConfigOpen ? "is-active" : ""}`}
                      onClick={toggleChatQuickConfigPanel}
                      title="对话预设"
                    >
                      <img className="icon-16" src={iconPreset} alt="chat-preset-config" />
                    </button>
                  </div>
                  <div className="chat-quick-config-wrap" ref={imageQuickConfigAnchorRef}>
                    <button
                      className={`square-btn gray square-btn-sm ${imageQuickConfigOpen ? "is-active" : ""}`}
                      onClick={toggleImageQuickConfigPanel}
                      title="指令预设"
                    >
                      <img className="icon-16" src={iconInstructionPreset} alt="image-preset-config" />
                    </button>
                  </div>
                  <div className="chat-header-divider" />
                  {imageRunQueueTotal > 0 && (
                    <button
                      className="square-btn square-btn-sm run-queue-stop-btn"
                      onClick={handleStopImageRunQueue}
                      title="中止跑图队列"
                      data-tip-text={`中止跑图任务（当前 ${imageRunQueueTotal} 个）`}
                    >
                      <img className="icon-12" src={iconPause} alt="stop-run-queue" />
                      {imageRunQueueTotal > 1 ? (
                        <span className="run-queue-stop-badge">{imageRunQueueTotal}</span>
                      ) : null}
                    </button>
                  )}
                  <button
                    className="square-btn square-btn-sm"
                    onClick={handleCreateSession}
                    title="发起新对话"
                  >
                    <img className="icon-16" src={iconEdited} alt="new-chat" />
                  </button>
                </div>
              </div>

              <div className="chat-card" ref={chatCardRef}>
                <div
                  className={`chat-scroll ${messages.length === 0 ? "is-empty" : ""}`}
                  ref={chatScrollRef}
                  onWheel={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {messages.length === 0 && (
                    <div className="chat-empty-state" role="status" aria-live="polite">
                      <div className="chat-empty-model">
                        <img
                          className="chat-empty-logo chat-gemini-animated"
                          src={iconGemini}
                          alt="gemini"
                          data-tip-text={activeModelName || "未配置模型"}
                        />
                        <div className="chat-empty-model-meta">
                          <div className="chat-empty-model-name" data-tip-text={activeModelName || "未配置模型"}>
                            {activeModelProvider}
                          </div>
                          <div className="chat-empty-model-time">{activeModelName || "未配置模型"}</div>
                        </div>
                      </div>
                      <div className="chat-empty-hello">你好，</div>
                      <div className="chat-empty-title">需要我为你做些什么？</div>
                      <div className="chat-empty-presets">
                        {topPinnedChatQuickPrompts.map((item, index) => {
                          const title = String(item?.title || "").trim() || `预设${index + 1}`;
                          return (
                            <button
                              key={item?.id || `quick-${index + 1}`}
                              type="button"
                              className="chat-empty-preset-btn"
                              onClick={() => handleApplyChatQuickPrompt(item)}
                              data-tip-text={getQuickPromptPreview(item?.content)}
                              data-tip-variant="preset"
                            >
                              {title}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {messages.map((msg) => (
                    msg.role === "user" ? (
                      <div
                        key={msg.id}
                        className="chat-message-block is-user"
                        onMouseEnter={() => holdUserMessageActions(msg.id)}
                        onMouseLeave={() => releaseUserMessageActions(msg.id)}
                      >
                        <div className="chat-bubble">
                          {Array.isArray(msg.images) && msg.images.length > 0 && (
                            <div className="chat-image-list user-chat-image-list">
                              {msg.images.slice(0, 6).map((img, idx) => (
                                <button
                                  key={img.id || img.dataUrl || `msg-img-${msg.id}-${idx}`}
                                  type="button"
                                  className="chat-image-item-btn"
                                  data-tip-text={img?.name || `图片 ${idx + 1}`}
                                  onClick={() => openMessageImage(img)}
                                >
                                  <img className="chat-image-item" src={img.dataUrl} alt={img.name || "image"} />
                                </button>
                              ))}
                            </div>
                          )}
                          <div className={`chat-msg ${editingUserMessageId === msg.id ? "is-editing" : ""}`}>
                            {editingUserMessageId === msg.id ? (
                              <textarea
                                ref={userMessageEditorRef}
                                className="chat-msg-editor"
                                rows={1}
                                value={editingUserMessageText}
                                onInput={(e) => autoResizeTextarea(e.currentTarget)}
                                onChange={(e) => setEditingUserMessageText(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Escape") {
                                    e.preventDefault();
                                    handleCancelEditUserMessage();
                                  }
                                  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                                    e.preventDefault();
                                    handleUpdateUserMessage();
                                  }
                                }}
                              />
                            ) : renderRichText(msg.text || "（仅图片）", handleCopyCodeText)}
                          </div>
                        </div>
                        <div
                          className={`chat-message-actions user-actions ${editingUserMessageId === msg.id ? "is-editing" : ""} ${userMessageActionsHoverId === msg.id ? "is-hover" : ""}`}
                          onMouseEnter={() => holdUserMessageActions(msg.id, true)}
                          onMouseLeave={() => releaseUserMessageActions(msg.id)}
                        >
                          {editingUserMessageId === msg.id ? (
                            (() => {
                              const userMessageChanged = editingUserMessageText !== String(msg.text || "");
                              return (
                                <>
                                  <button
                                    className={`message-inline-btn primary ${userMessageChanged ? "is-active" : ""}`}
                                    type="button"
                                    aria-label="update-user-message"
                                    onClick={handleUpdateUserMessage}
                                    disabled={!userMessageChanged}
                                  >
                                    更新
                                  </button>
                                  <button
                                    className="message-inline-btn cancel"
                                    type="button"
                                    aria-label="cancel-edit-user-message"
                                    onClick={handleCancelEditUserMessage}
                                  >
                                    取消
                                  </button>
                                </>
                              );
                            })()
                          ) : (
                            <>
                              <button
                                className="message-action-btn icon-only"
                                aria-label="edit-user-message"
                                onClick={() => handleEditUserMessage(msg.id)}
                                data-tip-text="编辑消息"
                              >
                                <img className="icon-16" src={iconEdit} alt="edit" />
                              </button>
                              <button
                                className="message-action-btn icon-only"
                                aria-label="copy-user-message"
                                onClick={() => copyMessageText(msg, "system")}
                                data-tip-text="复制消息"
                              >
                                <img className="icon-16" src={iconCopy} alt="copy" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ) : (
                      (() => {
                        const messageModelName = String(msg.model || activeModelName || "").trim();
                        const messageModelTip = messageModelName || "未配置模型";
                        const messageExtractedJson = getMessageJsonText(msg);
                        const messageDisplayText = String(msg.text || "");
                        const messageThinkingText = String(msg.thinking || "").trim();
                        const messageThinkingOpen = !!thinkingOpenMap[msg.id];
                        const thinkingTranslationState = thinkingTranslationMap[msg.id] || null;
                        const translatedThinkingText = String(thinkingTranslationState?.text || "").trim();
                        const thinkingTranslating = thinkingTranslationState?.status === "loading";
                        const thinkingTranslateError = String(thinkingTranslationState?.error || "").trim();
                        const thinkingDisplayText = thinkingTranslateEnabled ? translatedThinkingText : messageThinkingText;
                        const pendingThinkingText = msg.status === "pending"
                          ? buildLiveThinkingPreview(msg)
                          : "";
                        const messageSplit = messageExtractedJson
                          ? splitTextByJsonBlock(messageDisplayText)
                          : { before: messageDisplayText, after: "", found: false };
                        const messageJsonRows = Math.max(10, String(messageExtractedJson || "").split(/\r?\n/).length + 1);
                        return (
                          <div key={msg.id} className="chat-message-block is-assistant">
                            <div className="chat-meta">
                              <div className={`chat-model-indicator ${msg.status === "pending" ? "is-loading" : ""}`} data-tip-text={messageModelTip}>
                                {msg.status === "pending" ? (
                                  <svg className="chat-model-indicator-ring" viewBox="0 0 24 24" aria-hidden="true">
                                    <circle className="chat-model-indicator-ring-circle" cx="12" cy="12" r="9" pathLength="100" />
                                  </svg>
                                ) : null}
                                <img className="chat-model-indicator-logo" src={iconGemini} alt="gemini" />
                              </div>
                              {msg.status === "pending" && pendingThinkingText ? (
                                <div className="chat-meta-thinking-live is-reveal" aria-live="polite">
                                  {pendingThinkingText}
                                </div>
                              ) : null}
                              {msg.status !== "pending" && messageThinkingText ? (
                                <div className="chat-meta-thinking-actions">
                                  <button
                                    type="button"
                                    className="chat-thinking-toggle"
                                    data-tip-skip="true"
                                    onClick={() => toggleThinkingVisible(msg.id)}
                                  >
                                    <span>{messageThinkingOpen ? "隐藏思考过程" : "显示思考过程"}</span>
                                    <span className="chat-thinking-arrow">{messageThinkingOpen ? "▴" : "▾"}</span>
                                  </button>
                                </div>
                              ) : null}
                            </div>
                            <div className={`chat-desc ${msg.status === "error" ? "is-error" : msg.status === "pending" ? "is-pending" : ""}`}>
                              {msg.status === "pending"
                                ? null
                                : msg.status === "error"
                                  ? `错误：${formatApiError(msg.error || msg.text || "请求失败")}`
                                  : (
                                      <>
                                        {messageThinkingText && messageThinkingOpen && (
                                          <div className="chat-thinking-wrap">
                                            <div className="chat-thinking-body">
                                              {thinkingTranslateEnabled
                                                ? (
                                                    thinkingDisplayText
                                                      ? renderRichText(thinkingDisplayText, handleCopyCodeText)
                                                      : (
                                                          <div className="chat-thinking-translation-placeholder">
                                                            {thinkingTranslating
                                                              ? "正在翻译思考内容…"
                                                              : (thinkingTranslateError ? "思考翻译失败，请稍后重试。" : "正在准备思考翻译…")}
                                                          </div>
                                                        )
                                                  )
                                                : renderRichText(messageThinkingText, handleCopyCodeText)}
                                            </div>
                                          </div>
                                        )}
                                        {messageSplit.before ? (
                                          <div className="chat-content-text">{renderRichText(messageSplit.before, handleCopyCodeText)}</div>
                                        ) : null}
                                        {messageExtractedJson && (
                                          <div className="json-card inline-json-card">
                                            <div className="json-header">
                                              <div className="json-title">JSON 提示词</div>
                                              <div className="json-actions">
                                                <div className="json-action-item">
                                                  <button
                                                    className="icon-only"
                                                    aria-label="copy-inline-json"
                                                    onClick={() => handleCopyJsonText(messageExtractedJson)}
                                                  >
                                                    <img className="icon-20" src={iconCopy} alt="copy" />
                                                  </button>
                                                </div>
                                                <div
                                                  className="json-action-item run-action"
                                                  onMouseEnter={(e) => handleRunHoverEnter(e.currentTarget)}
                                                  onMouseLeave={handleRunHoverLeave}
                                                >
                                                  <button
                                                    className="run-btn icon-only"
                                                    onClick={() => handleActivateJsonPrompt(messageExtractedJson, {
                                                      autoRun: true,
                                                      runOptions: {
                                                        imageSource: "assistant-prev-user",
                                                        assistantMessageId: msg.id
                                                      }
                                                    })}
                                                    aria-label="run-with-chat-image"
                                                  >
                                                    <img className="icon-20" src={jsonEditedPending ? iconRunJsonEdited : iconRunJson} alt="run" />
                                                  </button>
                                                </div>
                                              </div>
                                            </div>
                                            <textarea
                                              className="json-body json-body-editor"
                                              rows={messageJsonRows}
                                              value={messageExtractedJson}
                                              ref={autoResizeTextarea}
                                              onInput={(e) => autoResizeTextarea(e.currentTarget)}
                                              onChange={(e) => handleEditJsonPrompt(msg.id, e.target.value)}
                                            />
                                          </div>
                                        )}
                                        {messageSplit.after ? (
                                          <div className="chat-content-text">{renderRichText(messageSplit.after, handleCopyCodeText)}</div>
                                        ) : null}
                                        {!messageSplit.before && !messageSplit.after && !messageExtractedJson
                                          ? renderRichText(messageDisplayText || "（空响应）", handleCopyCodeText)
                                          : null}
                                      </>
                                    )
                              }
                            </div>
                            {msg.status !== "pending" && (
                              <div className="chat-message-actions assistant-actions">
                                <button
                                  className="message-action-btn icon-only"
                                  aria-label="regenerate-assistant-message"
                                  onClick={() => handleRegenerateFromAssistant(msg.id)}
                                  data-tip-text="重新回复"
                                >
                                  <img className="icon-16" src={iconMessageRerun} alt="rerun" />
                                </button>
                                <button
                                  className="message-action-btn icon-only"
                                  aria-label="branch-chat-from-message"
                                  onClick={() => handleBranchFromMessage(msg.id)}
                                  data-tip-text="对话分支"
                                >
                                  <img className="icon-16" src={iconMessageBranch} alt="branch" />
                                </button>
                                <button
                                  className="message-action-btn icon-only"
                                  aria-label="copy-assistant-message"
                                  onClick={() => copyMessageText(msg, "system")}
                                  data-tip-text="复制消息"
                                >
                                  <img className="icon-16" src={iconCopy} alt="copy" />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })()
                    )
                  ))}

                </div>
              </div>

              <div className="chat-input-row" ref={chatInputRef}>
                <textarea
                  ref={chatInputTextRef}
                  className={`chat-input ${chatInput ? "has-content" : ""}`}
                  rows={1}
                  placeholder="你想做什么调整？"
                  value={chatInput}
                  onChange={(e) => {
                    setChatInput(e.target.value);
                    autoResizeChatInput(e.currentTarget);
                  }}
                  onFocus={(e) => {
                    autoResizeChatInput(e.currentTarget, { active: true });
                  }}
                  onBlur={(e) => {
                    autoResizeChatInput(e.currentTarget, { forceCollapse: true });
                  }}
                  onKeyDown={handleChatInputKeyDown}
                  onPaste={handleChatInputPaste}
                />
                <button
                  className={`send-btn ${isSending ? "is-stop" : ""}`}
                  data-tip-text={isSending ? "停止生成" : (jsonEditedPending ? "根据已编辑提示词继续修改" : "发送消息")}
                  onClick={isSending ? handleStopChat : handleSendChat}
                >
                  <img className="icon-20" src={isSending ? iconClose : (jsonEditedPending ? iconEdited : iconRun)} alt={isSending ? "stop" : "send"} />
                </button>
              </div>

              <div
                className={`upload-area ${uploadDragOver.area ? "is-drag-over" : ""}`}
                ref={uploadAreaRef}
                onDragEnter={handleUploadAreaDragEnter}
                onDragOver={handleUploadAreaDragOver}
                onDragLeave={handleUploadAreaDragLeave}
                onDrop={handleUploadAreaDrop}
              >
                <div className="upload-area-main">
                  <div className="upload-slots" ref={uploadSlotsRef}>
                    {Array.from({ length: visibleUploadSlotCount }, (_, slotIndex) => {
                      const item = uploadImages[slotIndex];
                      const hasImage = !!item?.dataUrl;
                      const label = getUploadSlotLabel(slotIndex, hasImage);
                      return (
                        <div
                          key={`slot-${slotIndex}`}
                          ref={(el) => {
                            uploadSlotRefs.current[slotIndex] = el;
                          }}
                          className={`upload-slot ${hasImage ? "has-image" : "upload-add"} ${uploadDragOver.slot === slotIndex ? "is-drag-over" : ""}`}
                          role="button"
                          tabIndex={hasImage ? -1 : 0}
                          data-upload-slot-index={slotIndex}
                          data-upload-has-image={hasImage ? "1" : "0"}
                          aria-label={label}
                          data-tip-text={item?.originName || item?.name || label}
                          onDragEnter={(e) => handleUploadSlotDragEnter(slotIndex, e)}
                          onDragOver={(e) => handleUploadSlotDragOver(slotIndex, e)}
                          onDragLeave={(e) => handleUploadSlotDragLeave(slotIndex, e)}
                          onDrop={(e) => handleUploadDrop(slotIndex, e)}
                          onDragStart={hasImage ? (e) => e.preventDefault() : undefined}
                          onPointerDown={hasImage ? (e) => handleUploadSlotPointerDown(slotIndex, e) : undefined}
                          onClick={() => handleUploadSlotClick(slotIndex)}
                          onKeyDown={(e) => handleUploadSlotKeyDown(slotIndex, e)}
                        >
                          {hasImage && (
                            <button
                              type="button"
                              className="upload-slot-delete"
                              aria-label={`删除${label}`}
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={(e) => handleRemoveUploadImage(slotIndex, e)}
                            >
                              <img className="icon-12" src={iconClose} alt="delete" />
                            </button>
                          )}
                          {hasImage && (
                            <img className="upload-slot-thumb" src={item.dataUrl} alt={item.name || label} draggable={false} />
                          )}
                          <span className="upload-slot-plus">
                            {hasImage
                              ? null
                              : <img className="icon-16" src={iconPlaceholder} alt="add" />
                            }
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="upload-tool-row">
                  <button
                    className="upload-slot-tool-btn"
                    type="button"
                    onClick={(e) => handleUploadSlotToolAction("select", -1, e)}
                    aria-label="上传选区"
                    data-tip-text="上传选区"
                    data-tip-placement="left"
                  >
                    <img className="icon-16" src={iconUploadSel} alt="" />
                  </button>
                  <button
                    className="upload-slot-tool-btn"
                    type="button"
                    onClick={(e) => handleUploadSlotToolAction("full", -1, e)}
                    aria-label="上传全图"
                    data-tip-text="上传全图"
                    data-tip-placement="left"
                  >
                    <img className="icon-16" src={iconUploadFull} alt="" />
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden-file-input"
                  onChange={async (e) => {
                    const files = e.target.files || [];
                    const targetIndex = pendingUploadTargetRef.current;
                    const source = pendingUploadSourceRef.current || "local";
                    pendingUploadTargetRef.current = -1;
                    pendingUploadSourceRef.current = "local";
                    if (Number.isInteger(targetIndex) && targetIndex >= 0) {
                      await handleImageFilesAtSlot(files, targetIndex, "已添加图片到槽位", { source });
                    } else {
                      await handleImageFiles(files, { source });
                    }
                    e.target.value = "";
                  }}
                />
              </div>
            </section>
            <section className="bottom-controls" ref={bottomControlsRef}>
              <div className="control">
                <div className="control-label">生成分辨率</div>
                <button
                  type="button"
                  ref={generationSizeControlRef}
                  className="control-field control-field-btn control-select-trigger"
                  data-tip-text="设置生成分辨率（像素）"
                  onClick={() => toggleGenerationSelectDropdown("size")}
                >
                  <span className="control-select-trigger-text">{generationImageSizeLabel}</span>
                  <img className="icon-12" src={iconDropdown} alt="drop" />
                </button>
              </div>
              <div className="control">
                <div className="control-label">生成比例</div>
                <button
                  type="button"
                  ref={generationRatioControlRef}
                  className="control-field control-field-btn control-select-trigger"
                  data-tip-text="设置生成比例（宽高比）"
                  onClick={() => toggleGenerationSelectDropdown("ratio")}
                >
                  <span className="control-select-trigger-text">{generationAspectRatioLabel}</span>
                  <img className="icon-12" src={iconDropdown} alt="drop" />
                </button>
              </div>
              <div className="control control-count">
                <div className="control-label">生成数量</div>
                <button
                  type="button"
                  ref={generationCountControlRef}
                  className="control-field control-field-btn"
                  data-tip-text="设置单次生成数量（1-10）"
                  onClick={toggleGenerationCountDropdown}
                >
                  {`x${generationCount}`}
                  <img className="icon-12" src={iconDropdown} alt="drop" />
                </button>
              </div>
            </section>
            </div>
          </main>
                ) : (
                  <SettingsView
                    contentWrapSettingsRef={contentWrapSettingsRef}
                    contentScrollSettingsRef={contentScrollSettingsRef}
                    chatProviderAnchorRef={chatProviderAnchorRef}
                    chatModeSwitchAnchorRef={chatModeSwitchAnchorRef}
                    chatModelAnchorRef={chatModelAnchorRef}
                    chatApiKeyInputRef={chatApiKeyInputRef}
                    imageProviderAnchorRef={imageProviderAnchorRef}
                    imageModeSwitchAnchorRef={imageModeSwitchAnchorRef}
                    imageModelAnchorRef={imageModelAnchorRef}
                    imageApiKeyInputRef={imageApiKeyInputRef}
                    bridgePortInputFocusedRef={bridgePortInputFocusedRef}
                    providerDropdown={providerDropdown}
                    modelDropdown={modelDropdown}
                    chatProviderKey={chatProviderKey}
                    imageProviderKey={imageProviderKey}
                    chatSiteLabel={chatSiteLabel}
                    chatApiFormatLabel={chatApiFormatLabel}
                    chatModeSwitchEnabled={chatModeSwitchEnabled}
                    chatConfig={chatConfig}
                    sessionNamingEnabled={sessionNamingEnabled}
                    thinkingTranslateEnabled={thinkingTranslateEnabled}
                    floatingToggleEnabled={floatingToggleEnabled}
                    floatingToggleOpacity={floatingToggleOpacity}
                    cachePolicy={cachePolicy}
                    cacheStats={cacheStats}
                    chatApiFoldOpen={chatApiFoldOpen}
                    imageApiFoldOpen={imageApiFoldOpen}
                    settingsToolsFoldOpen={settingsToolsFoldOpen}
                    settingsDisplayFoldOpen={settingsDisplayFoldOpen}
                    chatKeyVisible={chatKeyVisible}
                    chatConfigExpanded={chatConfigExpanded}
                    imageApiFormatLabel={imageApiFormatLabel}
                    imageModeSwitchEnabled={imageModeSwitchEnabled}
                    imageSiteLabel={imageSiteLabel}
                    imageConfig={imageConfig}
                    imageKeyVisible={imageKeyVisible}
                    chatModelHelpUrl={chatModelHelpUrl}
                    imageModelHelpUrl={imageModelHelpUrl}
                    canFetchChatModels={canFetchChatModels}
                    canFetchImageModels={canFetchImageModels}
                    bridgePortDraft={bridgePortDraft}
                    bridgePort={bridgePort}
                    bridgePortApplying={bridgePortApplying}
                    bridgePortAvailable={serverStatus.available}
                    uiScaleSelectValue={uiScaleSelectValue}
                    uiScaleAnchorRef={uiScaleAnchorRef}
                    uiScaleDropdownOpen={uiScaleDropdown.open}
                    closeProviderDropdown={closeProviderDropdown}
                    openProviderDropdown={openProviderDropdown}
                    closeModelDropdown={closeModelDropdown}
                    openModelDropdown={openModelDropdown}
                    toggleUiScaleDropdown={toggleUiScaleDropdown}
                    setChatKeyVisible={setChatKeyVisible}
                    setSessionNamingEnabled={setSessionNamingEnabled}
                    setThinkingTranslateEnabled={setThinkingTranslateEnabled}
                    setFloatingToggleEnabled={setFloatingToggleEnabled}
                    setFloatingToggleOpacity={setFloatingToggleOpacity}
                    handleCachePolicyChange={handleCachePolicyChange}
                    setChatApiFoldOpen={setChatApiFoldOpen}
                    setImageApiFoldOpen={setImageApiFoldOpen}
                    setSettingsToolsFoldOpen={setSettingsToolsFoldOpen}
                    setSettingsDisplayFoldOpen={setSettingsDisplayFoldOpen}
                    setChatConfigExpanded={setChatConfigExpanded}
                    setImageKeyVisible={setImageKeyVisible}
                    handleConfigField={handleConfigField}
                    handleFetchModels={handleFetchModels}
                    setBridgePortDraft={setBridgePortDraft}
                    normalizeBridgePort={normalizeBridgePort}
                    handleBridgePortDraftKeyDown={handleBridgePortDraftKeyDown}
                    handleApplyBridgePort={handleApplyBridgePort}
                    iconDropdown={iconDropdown}
                    iconReconnect={iconReconnect}
                    iconPreviewOn={iconPreviewOn}
                    iconPreviewOff={iconPreviewOff}
                    iconSaveDisk={iconSaveDisk}
                    CONTEXT_MIN={CONTEXT_MIN}
                    CONTEXT_MAX={CONTEXT_MAX}
                    MAX_TOKENS_MIN={MAX_TOKENS_MIN}
                    MAX_TOKENS_MAX={MAX_TOKENS_MAX}
                    TIMEOUT_MIN_SEC={TIMEOUT_MIN_SEC}
                    TIMEOUT_MAX_SEC={TIMEOUT_MAX_SEC}
                    defaultChatConfig={defaultChatConfig}
                    defaultImageConfig={defaultImageConfig}
                    BRIDGE_PORT_MIN={BRIDGE_PORT_MIN}
                    BRIDGE_PORT_MAX={BRIDGE_PORT_MAX}
                    DEFAULT_BRIDGE_PORT={DEFAULT_BRIDGE_PORT}
                    FLOATING_TOGGLE_OPACITY_MIN={FLOATING_TOGGLE_OPACITY_MIN}
                    FLOATING_TOGGLE_OPACITY_MAX={FLOATING_TOGGLE_OPACITY_MAX}
                    CACHE_RETENTION_DAYS_MIN={CACHE_RETENTION_DAYS_MIN}
                    CACHE_RETENTION_DAYS_MAX={CACHE_RETENTION_DAYS_MAX}
                    formatMemoryBytes={formatMemoryBytes}
                  />
                )}
          <ConsolePanel
            footerRef={footerRef}
            consoleFilterRef={consoleFilterRef}
            logFilterOpen={logFilterOpen}
            onToggleLogFilter={toggleLogFilterPanel}
            handleExportLogs={handleExportLogs}
            toggleConsole={toggleConsole}
            statusIcon={statusIcon}
            miniStatus={miniStatus}
            miniStatusLevelClass={miniStatusLevelClass}
            miniStatusTip={miniStatusTip}
            consoleOpen={consoleOpen}
            consoleOpening={consoleOpening}
            consoleRef={consoleRef}
            filteredLogs={filteredLogs}
            iconLogFilter={iconLogFilter}
            iconConsole={iconConsole}
          />
          </div>
        </div>
      </div>
      <input
        ref={historyInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden-file-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          handleImportHistory(file);
          e.target.value = "";
        }}
      />
      {runPopoverPortal}
      {generationSelectDropdownPortal}
      {generationCountDropdownPortal}
      {uploadCompressPanelPortal}
      {tipPortal}
      {copyToastPortal}
      {modelDropdownPortal}
      {providerDropdownPortal}
      {uiScaleDropdownPortal}
      {presetDropdownPortal}
      {identityQuickPortal}
      {chatQuickConfigPortal}
      {chatQuickPromptMenuPortal}
      {imageQuickConfigPortal}
      {imageQuickPromptMenuPortal}
      {historyPanelPortal}
      {historyToolsPortal}
      {consoleFilterPortal}
      {sessionMenuPortal}
      {scaleModalPortal}
      {deleteSessionModalPortal}
      {deletePresetModalPortal}
      {importTargetModalPortal}
    </div>
  );
}

export default App;
