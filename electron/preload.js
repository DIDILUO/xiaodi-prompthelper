/*
 * @phb-version-tag: recovered-ce8k-r17
 * @phb-version: 0.0.1-recovered-r17
 * @phb-version-note: CE8K reverse-recovered baseline; naming refactor batch17 complete.
 * @phb-updated-at: 2026-02-18
 */
const { contextBridge, ipcRenderer } = require('electron');
let SHELL_CHANNELS = null;
let SHELL_EVENT_CHANNELS = null;
try {
  const shellIpcContract = require('./shell-ipc-contract');
  SHELL_CHANNELS = shellIpcContract.SHELL_CHANNELS || null;
  SHELL_EVENT_CHANNELS = shellIpcContract.SHELL_EVENT_CHANNELS || null;
} catch (error) {
  SHELL_CHANNELS = {
    setFloatingToggleEnabled: 'shell:set-floating-toggle-enabled',
    getFloatingToggleState: 'shell:get-floating-toggle-state',
    getFloatingToggleConfig: 'shell:get-floating-toggle-config',
    toggleMainWindowVisibility: 'shell:toggle-main-window-visibility',
    updateFloatingToggleStatus: 'shell:update-floating-toggle-status',
    setFloatingToggleOpacity: 'shell:set-floating-toggle-opacity',
    floatingQuickAction: 'shell:floating-quick-action',
    setAlwaysOnTop: 'shell:set-on-top',
    ensureFloatingToggleOnTop: 'shell:ensure-floating-toggle-on-top',
    setAutoMinimizeOnBlur: 'shell:set-auto-minimize-on-blur',
    getAutoMinimizeOnBlur: 'shell:get-auto-minimize-on-blur',
    minimize: 'shell:minimize',
    close: 'shell:close',
    globalRestart: 'shell:global-restart',
    serverStatus: 'shell:server-status',
    memorySample: 'shell:memory-sample',
    chatImageCacheGet: 'shell:chat-image-cache-get',
    chatImageCacheGetMany: 'shell:chat-image-cache-get-many',
    serverStart: 'shell:server-start',
    serverStop: 'shell:server-stop',
    bridgePortGet: 'shell:bridge-port-get',
    bridgePortSet: 'shell:bridge-port-set',
    cachePolicyGet: 'shell:cache-policy-get',
    cachePolicySet: 'shell:cache-policy-set',
    cacheStatsGet: 'shell:cache-stats-get',
    cacheCleanupNow: 'shell:cache-cleanup-now',
    exportLogs: 'shell:export-logs',
    openExternal: 'shell:open-external',
    openImageDefault: 'shell:open-image-default',
    chatLoad: 'shell:chat-load',
    chatLoadSession: 'shell:chat-load-session',
    chatSave: 'shell:chat-save',
    chatDelete: 'shell:chat-delete',
    openTempFolder: 'shell:open-temp-folder',
    generatedCachePut: 'shell:generated-cache-put',
    generatedCacheRead: 'shell:generated-cache-read',
    pickLocalImagesData: 'shell:pick-local-images-data',
    handleUploadSlotToolAction: 'shell:handle-upload-slot-tool-action',
    setGlobalUploadShortcuts: 'shell:set-global-upload-shortcuts',
    importImageToPs: 'shell:import-image-to-ps',
    psCachePut: 'shell:ps-cache-put',
    psCacheGet: 'shell:ps-cache-get',
    psCacheList: 'shell:ps-cache-list',
    psCacheClear: 'shell:ps-cache-clear',
    reconnect: 'shell:reconnect',
    setWindowScale: 'shell:set-window-scale',
    adjustWindowSize: 'shell:adjust-window-size',
    setWindowMinSize: 'shell:set-min-size',
    getWindowBounds: 'shell:get-window-bounds',
    recenterMainWindow: 'shell:recenter-main-window'
  };
  SHELL_EVENT_CHANNELS = {
    resizing: 'shell:resizing',
    floatingToggleState: 'shell:floating-toggle-state',
    floatingQuickAction: 'shell:floating-quick-action',
    globalUploadShortcutAction: 'shell:global-upload-shortcut-action'
  };
}

const invokeShell = (contractKey, ...args) =>
  ipcRenderer.invoke(SHELL_CHANNELS[contractKey], ...args);

contextBridge.exposeInMainWorld('shell', {
  setFloatingToggleEnabled: (value) => invokeShell('setFloatingToggleEnabled', value),
  getFloatingToggleState: () => invokeShell('getFloatingToggleState'),
  getFloatingToggleConfig: () => invokeShell('getFloatingToggleConfig'),
  toggleMainWindowVisibility: () => invokeShell('toggleMainWindowVisibility'),
  updateFloatingToggleStatus: (level) => invokeShell('updateFloatingToggleStatus', level),
  setFloatingToggleOpacity: (value) => invokeShell('setFloatingToggleOpacity', value),
  floatingQuickAction: (payload) => invokeShell('floatingQuickAction', payload),
  setAlwaysOnTop: (value) => invokeShell('setAlwaysOnTop', value),
  ensureFloatingToggleOnTop: () => invokeShell('ensureFloatingToggleOnTop'),
  setAutoMinimizeOnBlur: (value) => invokeShell('setAutoMinimizeOnBlur', value),
  getAutoMinimizeOnBlur: () => invokeShell('getAutoMinimizeOnBlur'),
  minimize: () => invokeShell('minimize'),
  close: () => invokeShell('close'),
  globalRestart: () => invokeShell('globalRestart'),
  serverStatus: () => invokeShell('serverStatus'),
  memorySample: () => invokeShell('memorySample'),
  chatImageCacheGet: (cacheId) => invokeShell('chatImageCacheGet', cacheId),
  chatImageCacheGetMany: (payload) => invokeShell('chatImageCacheGetMany', payload),
  serverStart: (payload) => invokeShell('serverStart', payload),
  serverStop: () => invokeShell('serverStop'),
  bridgePortGet: () => invokeShell('bridgePortGet'),
  bridgePortSet: (port) => invokeShell('bridgePortSet', port),
  cachePolicyGet: () => invokeShell('cachePolicyGet'),
  cachePolicySet: (payload) => invokeShell('cachePolicySet', payload),
  cacheStatsGet: () => invokeShell('cacheStatsGet'),
  cacheCleanupNow: () => invokeShell('cacheCleanupNow'),
  exportLogs: (payload) => invokeShell('exportLogs', payload),
  openExternal: (url) => invokeShell('openExternal', url),
  openImageDefault: (payload) => invokeShell('openImageDefault', payload),
  chatLoad: (payload) => invokeShell('chatLoad', payload),
  chatLoadSession: (payload) => invokeShell('chatLoadSession', payload),
  chatSave: (payload) => invokeShell('chatSave', payload),
  chatDelete: (payload) => invokeShell('chatDelete', payload),
  openTempFolder: () => invokeShell('openTempFolder'),
  generatedCachePut: (payload) => invokeShell('generatedCachePut', payload),
  generatedCacheRead: (payload) => invokeShell('generatedCacheRead', payload),
  pickLocalImagesData: (payload) => invokeShell('pickLocalImagesData', payload),
  handleUploadSlotToolAction: (payload) => invokeShell('handleUploadSlotToolAction', payload),
  setGlobalUploadShortcuts: (payload) => invokeShell('setGlobalUploadShortcuts', payload),
  importImageToPs: (payload) => invokeShell('importImageToPs', payload),
  psCachePut: (payload) => invokeShell('psCachePut', payload),
  psCacheGet: (cacheId) => invokeShell('psCacheGet', cacheId),
  psCacheList: () => invokeShell('psCacheList'),
  psCacheClear: () => invokeShell('psCacheClear'),
  reconnect: () => invokeShell('reconnect'),
  setWindowScale: (scale) =>
    invokeShell('setWindowScale', scale),
  adjustWindowSize: (deltaW, deltaH) => invokeShell('adjustWindowSize', deltaW, deltaH),
  setWindowMinSize: (width, height) => invokeShell('setWindowMinSize', width, height),
  getWindowBounds: () => invokeShell('getWindowBounds'),
  recenterMainWindow: () => invokeShell('recenterMainWindow'),
  onResizing: (handler) => {
    const wrapped = (_evt, payload) => handler(payload);
    ipcRenderer.on(SHELL_EVENT_CHANNELS.resizing, wrapped);
    return () => {
      ipcRenderer.off(SHELL_EVENT_CHANNELS.resizing, wrapped);
    };
  },
  onFloatingToggleState: (handler) => {
    const wrapped = (_evt, payload) => handler(payload);
    ipcRenderer.on(SHELL_EVENT_CHANNELS.floatingToggleState, wrapped);
    return () => {
      ipcRenderer.off(SHELL_EVENT_CHANNELS.floatingToggleState, wrapped);
    };
  },
  onFloatingQuickAction: (handler) => {
    const wrapped = (_evt, payload) => handler(payload);
    ipcRenderer.on(SHELL_EVENT_CHANNELS.floatingQuickAction, wrapped);
    return () => {
      ipcRenderer.off(SHELL_EVENT_CHANNELS.floatingQuickAction, wrapped);
    };
  },
  onGlobalUploadShortcutAction: (handler) => {
    const wrapped = (_evt, payload) => handler(payload);
    ipcRenderer.on(SHELL_EVENT_CHANNELS.globalUploadShortcutAction, wrapped);
    return () => {
      ipcRenderer.off(SHELL_EVENT_CHANNELS.globalUploadShortcutAction, wrapped);
    };
  }
});
