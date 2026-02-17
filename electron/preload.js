const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('shell', {
  setFloatingToggleEnabled: (value) => ipcRenderer.invoke('shell:set-floating-toggle-enabled', value),
  getFloatingToggleState: () => ipcRenderer.invoke('shell:get-floating-toggle-state'),
  getFloatingToggleConfig: () => ipcRenderer.invoke('shell:get-floating-toggle-config'),
  toggleMainWindowVisibility: () => ipcRenderer.invoke('shell:toggle-main-window-visibility'),
  updateFloatingToggleStatus: (level) => ipcRenderer.invoke('shell:update-floating-toggle-status', level),
  setFloatingToggleOpacity: (value) => ipcRenderer.invoke('shell:set-floating-toggle-opacity', value),
  floatingQuickAction: (payload) => ipcRenderer.invoke('shell:floating-quick-action', payload),
  setAlwaysOnTop: (value) => ipcRenderer.invoke('shell:set-on-top', value),
  setAutoMinimizeOnBlur: (value) => ipcRenderer.invoke('shell:set-auto-minimize-on-blur', value),
  getAutoMinimizeOnBlur: () => ipcRenderer.invoke('shell:get-auto-minimize-on-blur'),
  minimize: () => ipcRenderer.invoke('shell:minimize'),
  close: () => ipcRenderer.invoke('shell:close'),
  globalRestart: () => ipcRenderer.invoke('shell:global-restart'),
  serverStatus: () => ipcRenderer.invoke('shell:server-status'),
  memorySample: () => ipcRenderer.invoke('shell:memory-sample'),
  chatImageCacheGet: (cacheId) => ipcRenderer.invoke('shell:chat-image-cache-get', cacheId),
  chatImageCacheGetMany: (payload) => ipcRenderer.invoke('shell:chat-image-cache-get-many', payload),
  serverStart: (payload) => ipcRenderer.invoke('shell:server-start', payload),
  serverStop: () => ipcRenderer.invoke('shell:server-stop'),
  bridgePortGet: () => ipcRenderer.invoke('shell:bridge-port-get'),
  bridgePortSet: (port) => ipcRenderer.invoke('shell:bridge-port-set', port),
  cachePolicyGet: () => ipcRenderer.invoke('shell:cache-policy-get'),
  cachePolicySet: (payload) => ipcRenderer.invoke('shell:cache-policy-set', payload),
  cacheStatsGet: () => ipcRenderer.invoke('shell:cache-stats-get'),
  cacheCleanupNow: () => ipcRenderer.invoke('shell:cache-cleanup-now'),
  exportLogs: (payload) => ipcRenderer.invoke('shell:export-logs', payload),
  openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),
  chatLoad: (payload) => ipcRenderer.invoke('shell:chat-load', payload),
  chatLoadSession: (payload) => ipcRenderer.invoke('shell:chat-load-session', payload),
  chatSave: (payload) => ipcRenderer.invoke('shell:chat-save', payload),
  openTempFolder: () => ipcRenderer.invoke('shell:open-temp-folder'),
  generatedCachePut: (payload) => ipcRenderer.invoke('shell:generated-cache-put', payload),
  generatedCacheRead: (payload) => ipcRenderer.invoke('shell:generated-cache-read', payload),
  pickLocalImagesData: () => ipcRenderer.invoke('shell:pick-local-images-data'),
  handleUploadSlotToolAction: (payload) => ipcRenderer.invoke('shell:handle-upload-slot-tool-action', payload),
  importImageToPs: (payload) => ipcRenderer.invoke('shell:import-image-to-ps', payload),
  psCachePut: (payload) => ipcRenderer.invoke('shell:ps-cache-put', payload),
  psCacheGet: (cacheId) => ipcRenderer.invoke('shell:ps-cache-get', cacheId),
  psCacheList: () => ipcRenderer.invoke('shell:ps-cache-list'),
  psCacheClear: () => ipcRenderer.invoke('shell:ps-cache-clear'),
  reconnect: () => ipcRenderer.invoke('shell:reconnect'),
  setWindowScale: (scale, baseW, baseH) => ipcRenderer.invoke('shell:set-window-scale', scale, baseW, baseH),
  adjustWindowSize: (deltaW, deltaH) => ipcRenderer.invoke('shell:adjust-window-size', deltaW, deltaH),
  setWindowMinSize: (width, height) => ipcRenderer.invoke('shell:set-min-size', width, height),
  getWindowBounds: () => ipcRenderer.invoke('shell:get-window-bounds'),
  onResizing: (handler) => {
    const wrapped = (_evt, payload) => handler(payload);
    ipcRenderer.on('shell:resizing', wrapped);
    return () => {
      ipcRenderer.off('shell:resizing', wrapped);
    };
  },
  onFloatingToggleState: (handler) => {
    const wrapped = (_evt, payload) => handler(payload);
    ipcRenderer.on('shell:floating-toggle-state', wrapped);
    return () => {
      ipcRenderer.off('shell:floating-toggle-state', wrapped);
    };
  },
  onFloatingQuickAction: (handler) => {
    const wrapped = (_evt, payload) => handler(payload);
    ipcRenderer.on('shell:floating-quick-action', wrapped);
    return () => {
      ipcRenderer.off('shell:floating-quick-action', wrapped);
    };
  }
});
