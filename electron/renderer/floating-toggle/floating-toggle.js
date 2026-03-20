/*
 * @phb-version-tag: recovered-ce8k-r17
 * @phb-version: 0.0.1-recovered-r17
 * @phb-version-note: CE8K reverse-recovered baseline; naming refactor batch17 complete.
 * @phb-updated-at: 2026-02-18
 */
(function initFloatingToggle() {
  const root = document.getElementById("root");
  const toggleButton = document.getElementById("toggle");
  const toggleRunner = toggleButton?.querySelector(".toggle-runner") || null;
  const quickDivider = document.getElementById("quick-divider");
  const quickGroup = document.getElementById("quick-group");
  const toggleSourceBadge = document.getElementById("toggle-source-badge");
  const toggleSourceBadgeIcon = document.getElementById("toggle-source-badge-icon");
  const quickButtons = Array.from(document.querySelectorAll(".quick-btn"));

  if (!root || !toggleButton || !quickGroup || !quickDivider) return;

  const floatingStatusMetaByKey = {
    idle: { color: "#5e6674", tone: "idle", zhName: "待命", enName: "Idle" },
    connected: { color: "#5e6674", tone: "idle", zhName: "已连接", enName: "Connected" },
    busy: { color: "#3d77ff", tone: "running", zhName: "处理中", enName: "Busy" },
    "task-running": { color: "#3d77ff", tone: "running", zhName: "任务进行中", enName: "Task Running" },
    "chat-running": { color: "#3d77ff", tone: "running", zhName: "聊天进行中", enName: "Chat Running" },
    ok: { color: "#32cc65", tone: "success", zhName: "可用", enName: "OK" },
    "task-success": { color: "#32cc65", tone: "success", zhName: "任务成功", enName: "Task Success" },
    "chat-success": { color: "#32cc65", tone: "success", zhName: "聊天成功", enName: "Chat Success" },
    warn: { color: "#ff3d3d", tone: "failed", zhName: "警告", enName: "Warn" },
    error: { color: "#ff3d3d", tone: "failed", zhName: "错误", enName: "Error" },
    "task-failed": { color: "#ff3d3d", tone: "failed", zhName: "任务失败", enName: "Task Failed" },
    "chat-failed": { color: "#ff3d3d", tone: "failed", zhName: "聊天失败", enName: "Chat Failed" }
  };
  const floatingQuickActionMetaByKey = {
    history: {
      zhName: "对话列表",
      enName: "History",
      iconPath: "./icons/history.svg"
    },
    identity: {
      zhName: "身份预设",
      enName: "Identity Preset",
      iconPath: "./icons/identity.svg"
    },
    "chat-preset": {
      zhName: "聊天预设",
      enName: "Chat Preset",
      iconPath: "./icons/chat-preset.svg"
    },
    "image-preset": {
      zhName: "跑图预设",
      enName: "Image Preset",
      iconPath: "./icons/image-preset.svg"
    },
    "instruction-mode": {
      zhName: "指令模式",
      enName: "Instruction Mode",
      iconPath: "./icons/image-preset.svg"
    },
    // Internal-only quick actions; hidden by default in packaged release.
    "global-restart": {
      zhName: "全局重启",
      enName: "Global Restart",
      iconPath: "./icons/global-restart.svg"
    }
  };
  const floatingSourceIconByKey = {
    run: "./icons/source-run.svg",
    chat: "./icons/source-chat.svg",
    mixed: "./icons/history.svg",
    none: ""
  };

  const state = {
    visible: true,
    status: "idle",
    opacity: 1,
    quickButtonsVisible: true,
    runnerSource: "none",
    runnerPhase: "idle",
    runnerLen: "soft-short",
    runnerColorTone: "orange",
    runnerVisible: false,
    runnerFrozen: false,
    runnerFading: false,
    runnerSpinDurationMs: 2000
  };
  let enabledQuickActionSet = new Set(
    quickButtons
      .map((button) => String(button.getAttribute("data-action") || "").trim().toLowerCase())
      .filter(Boolean)
  );

  const cfg = {
    outerGap: 6,
    dragStripHeight: 20,
    toggleHeight: 40,
    quickButtonSize: 40,
    quickButtonGap: 8,
    quickGroupTopGap: 10,
    quickButtonCount: 0,
    quickMainButtonCount: 0,
    quickPaddingY: 8,
    dividerHeight: 1,
    dividerMarginY: 8,
    opacityMin: 0.35,
    opacityMax: 1,
    opacityDefault: 1
  };

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const normalizeRunnerSource = (rawSource) => {
    const normalizedSource = String(rawSource || "").trim().toLowerCase();
    return normalizedSource === "run"
      || normalizedSource === "chat"
      || normalizedSource === "mixed"
      || normalizedSource === "none"
      ? normalizedSource
      : "none";
  };
  const normalizeRunnerPhase = (rawPhase) => {
    const normalizedPhase = String(rawPhase || "").trim().toLowerCase();
    return normalizedPhase === "running"
      || normalizedPhase === "filling"
      || normalizedPhase === "frozen"
      || normalizedPhase === "shrinking"
      || normalizedPhase === "fading"
      || normalizedPhase === "idle"
      ? normalizedPhase
      : "idle";
  };
  const normalizeRunnerLen = (rawLen) => {
    const normalizedLen = String(rawLen || "").trim().toLowerCase();
    return normalizedLen === "full"
      || normalizedLen === "sharp-short"
      || normalizedLen === "sharp-medium"
      || normalizedLen === "sharp-long"
      || normalizedLen === "soft-short"
      || normalizedLen === "soft-medium"
      || normalizedLen === "soft-long"
      ? normalizedLen
      : "soft-short";
  };
  const normalizeRunnerColorTone = (rawTone) => {
    const normalizedTone = String(rawTone || "").trim().toLowerCase();
    return normalizedTone === "success" || normalizedTone === "error"
      ? normalizedTone
      : "orange";
  };
  const resolveRunnerSpinDurationMs = (rawDurationMs) => {
    const normalizedDurationMs = Number(rawDurationMs);
    if (!Number.isFinite(normalizedDurationMs) || normalizedDurationMs <= 0) {
      return 2000;
    }
    return Math.max(600, Math.min(6000, Math.round(normalizedDurationMs)));
  };
  const getVisibleQuickButtonCount = () =>
    quickButtons.reduce(
      (count, button) => (button && button.hidden ? count : count + 1),
      0,
    );
  const syncQuickButtonsAvailability = () => {
    const hasActionWhitelist = enabledQuickActionSet instanceof Set && enabledQuickActionSet.size > 0;
    quickButtons.forEach((button) => {
      const action = String(button.getAttribute("data-action") || "").trim().toLowerCase();
      if (!action) {
        button.hidden = true;
        return;
      }
      const isEnabled = !hasActionWhitelist || enabledQuickActionSet.has(action);
      button.hidden = !isEnabled;
    });
  };

  const applyLayout = () => {
    const rootStyle = document.documentElement.style;
    const outerGap = Math.max(0, Math.round(Number(cfg.outerGap) || 6));
    const dragStripHeight = Math.max(12, Math.round(Number(cfg.dragStripHeight) || 20));
    const toggleHeight = Math.max(40, Math.round(Number(cfg.toggleHeight) || 40));
    const quickButtonSize = Math.max(28, Math.round(Number(cfg.quickButtonSize) || 40));
    const quickButtonGap = Math.max(4, Math.round(Number(cfg.quickButtonGap) || 8));
    const quickGroupTopGap = Math.max(0, Math.round(Number(cfg.quickGroupTopGap) || 10));
    const quickPaddingY = Math.max(0, Math.round(Number(cfg.quickPaddingY) || 8));
    const dividerHeight = Math.max(1, Math.round(Number(cfg.dividerHeight) || 1));
    const dividerMarginY = Math.max(0, Math.round(Number(cfg.dividerMarginY) || 8));
    const configuredQuickButtonCount = Math.max(0, Math.round(Number(cfg.quickButtonCount) || 0));
    const visibleQuickButtonCount = getVisibleQuickButtonCount();
    const quickButtonCount = Math.max(
      0,
      Math.min(
        visibleQuickButtonCount,
        configuredQuickButtonCount > 0 ? configuredQuickButtonCount : visibleQuickButtonCount
      )
    );
    const quickMainButtonCount = Math.max(
      0,
      Math.min(quickButtonCount, Math.round(Number(cfg.quickMainButtonCount) || 0))
    );
    const quickDevButtonCount = Math.max(0, quickButtonCount - quickMainButtonCount);
    const quickGapCount = Math.max(0, quickMainButtonCount - 1) + Math.max(0, quickDevButtonCount - 1);
    const quickDividerBlockHeight = quickDevButtonCount > 0 ? dividerHeight + (dividerMarginY * 2) : 0;
    const quickGroupMaxHeight = (quickButtonSize * quickButtonCount)
      + (quickButtonGap * quickGapCount)
      + quickDividerBlockHeight
      + quickPaddingY
      + 2;
    rootStyle.setProperty("--outer-gap", `${outerGap}px`);
    rootStyle.setProperty("--drag-strip-height", `${dragStripHeight}px`);
    rootStyle.setProperty("--toggle-height", `${toggleHeight}px`);
    rootStyle.setProperty("--quick-button-size", `${quickButtonSize}px`);
    rootStyle.setProperty("--quick-button-gap", `${quickButtonGap}px`);
    rootStyle.setProperty("--quick-group-top-gap", `${quickGroupTopGap}px`);
    rootStyle.setProperty("--quick-padding-y", `${quickPaddingY}px`);
    rootStyle.setProperty("--quick-group-max-height", `${quickGroupMaxHeight}px`);
    rootStyle.setProperty("--divider-height", `${dividerHeight}px`);
    rootStyle.setProperty("--divider-margin-y", `${dividerMarginY}px`);
  };

  const applyVisual = () => {
    const statusKeyRaw = String(state.status || "").toLowerCase();
    const statusKey = Object.prototype.hasOwnProperty.call(
      floatingStatusMetaByKey,
      statusKeyRaw
    )
      ? statusKeyRaw
      : "idle";
    const statusMeta = floatingStatusMetaByKey[statusKey] || floatingStatusMetaByKey.idle;
    const color = statusMeta.color;
    const resolvedRunnerSource = normalizeRunnerSource(state.runnerSource);
    const resolvedRunnerPhase = normalizeRunnerPhase(state.runnerPhase);
    let resolvedRunnerLen = normalizeRunnerLen(state.runnerLen);
    let resolvedRunnerColorTone = normalizeRunnerColorTone(state.runnerColorTone);
    let resolvedRunnerVisible = !!state.runnerVisible;
    let resolvedRunnerFrozen = !!state.runnerFrozen;
    let resolvedRunnerFading = !!state.runnerFading;
    const resolvedRunnerSpinDurationMs = resolveRunnerSpinDurationMs(
      state.runnerSpinDurationMs,
    );
    toggleButton.style.color = "#ffffff";
    toggleButton.style.setProperty("--toggle-status-color", color);
    Array.from(toggleButton.classList).forEach((className) => {
      if (
        className.startsWith("status-")
        || className.startsWith("tone-")
        || className.startsWith("source-")
        || className === "show-source-badge"
      ) {
        toggleButton.classList.remove(className);
      }
    });
    toggleRunner && Array.from(toggleRunner.classList).forEach((className) => {
      if (
        className.startsWith("len-")
        || className.startsWith("color-")
        || className === "is-visible"
        || className === "is-frozen"
        || className === "is-fading"
      ) {
        toggleRunner.classList.remove(className);
      }
    });
    toggleButton.classList.add(`status-${statusKey}`);
    toggleButton.classList.add(`source-${resolvedRunnerSource}`);
    if (toggleRunner) {
      toggleRunner.style.setProperty(
        "--toggle-runner-spin-duration",
        `${resolvedRunnerSpinDurationMs}ms`,
      );
      toggleRunner.style.setProperty("--toggle-runner-fill-duration", "850ms");
      toggleRunner.style.setProperty("--toggle-runner-fade-duration", "1500ms");
      toggleRunner.classList.add(`len-${resolvedRunnerLen}`);
      toggleRunner.classList.add(`color-${resolvedRunnerColorTone}`);
      resolvedRunnerVisible && toggleRunner.classList.add("is-visible");
      resolvedRunnerFrozen && toggleRunner.classList.add("is-frozen");
      resolvedRunnerFading && toggleRunner.classList.add("is-fading");
    }
    if (
      toggleSourceBadge &&
      toggleSourceBadgeIcon &&
      resolvedRunnerSource !== "none" &&
      resolvedRunnerVisible &&
      resolvedRunnerPhase !== "idle"
    ) {
      const badgeIconPath =
        floatingSourceIconByKey[resolvedRunnerSource] || floatingSourceIconByKey.none;
      if (badgeIconPath) {
        toggleSourceBadgeIcon.setAttribute("src", badgeIconPath);
        toggleButton.classList.add("show-source-badge");
      }
    }
    toggleButton.classList.toggle("is-collapsed", !state.visible);
    const opacity = clamp(Number(state.opacity) || cfg.opacityDefault, cfg.opacityMin, cfg.opacityMax);
    root.style.opacity = String(opacity);
    const percent = Math.round(opacity * 100);
    const statusLabel = `${state.visible ? "Hide main window" : "Show main window"} (${percent}%)`;
    const statusTitle = `${statusMeta.zhName} / ${statusMeta.enName}`;
    toggleButton.setAttribute("aria-label", statusLabel);
    toggleButton.setAttribute("title", `${statusTitle} | ${statusLabel}`);
    toggleButton.setAttribute("data-status-label", statusTitle);
    root.setAttribute("data-status-label", statusTitle);
    const hideQuickButtons = !state.quickButtonsVisible || getVisibleQuickButtonCount() <= 0;
    quickGroup.classList.toggle("is-hidden", hideQuickButtons);
    quickDivider.classList.toggle("is-hidden", hideQuickButtons);
  };

  const applyPayload = (payload) => {
    if (!payload || typeof payload !== "object") return;
    if (typeof payload.visible === "boolean") state.visible = !!payload.visible;
    if (typeof payload.status === "string") state.status = String(payload.status);
    if (typeof payload.runnerSource === "string") {
      state.runnerSource = normalizeRunnerSource(payload.runnerSource);
    }
    if (typeof payload.runnerPhase === "string") {
      state.runnerPhase = normalizeRunnerPhase(payload.runnerPhase);
    }
    if (typeof payload.runnerLen === "string") {
      state.runnerLen = normalizeRunnerLen(payload.runnerLen);
    }
    if (typeof payload.runnerColorTone === "string") {
      state.runnerColorTone = normalizeRunnerColorTone(payload.runnerColorTone);
    }
    if (typeof payload.runnerVisible === "boolean") {
      state.runnerVisible = !!payload.runnerVisible;
    }
    if (typeof payload.runnerFrozen === "boolean") {
      state.runnerFrozen = !!payload.runnerFrozen;
    }
    if (typeof payload.runnerFading === "boolean") {
      state.runnerFading = !!payload.runnerFading;
    }
    if (payload.runnerSpinDurationMs != null) {
      state.runnerSpinDurationMs = resolveRunnerSpinDurationMs(
        payload.runnerSpinDurationMs,
      );
    }
    if (typeof payload.opacity === "number") {
      state.opacity = clamp(Number(payload.opacity) || cfg.opacityDefault, cfg.opacityMin, cfg.opacityMax);
    }
    if (typeof payload.quickButtonsVisible === "boolean") {
      state.quickButtonsVisible = !!payload.quickButtonsVisible;
    } else if (typeof payload.visible === "boolean") {
      state.quickButtonsVisible = !!payload.visible;
    }
  };

  const loadConfig = async () => {
    if (!window.shell || typeof window.shell.getFloatingToggleConfig !== "function") return;
    try {
      const payload = await window.shell.getFloatingToggleConfig();
      if (!payload || payload.ok === false) return;
      if (typeof payload.outerGap === "number") cfg.outerGap = payload.outerGap;
      if (typeof payload.dragStripHeight === "number") cfg.dragStripHeight = payload.dragStripHeight;
      if (typeof payload.toggleHeight === "number") cfg.toggleHeight = payload.toggleHeight;
      if (typeof payload.opacityMin === "number") cfg.opacityMin = payload.opacityMin;
      if (typeof payload.opacityMax === "number") cfg.opacityMax = payload.opacityMax;
      if (typeof payload.opacityDefault === "number") cfg.opacityDefault = payload.opacityDefault;
      if (typeof payload.quickButtonSize === "number") cfg.quickButtonSize = payload.quickButtonSize;
      if (typeof payload.quickButtonGap === "number") cfg.quickButtonGap = payload.quickButtonGap;
      if (typeof payload.quickGroupTopGap === "number") cfg.quickGroupTopGap = payload.quickGroupTopGap;
      if (typeof payload.quickButtonCount === "number") cfg.quickButtonCount = payload.quickButtonCount;
      if (typeof payload.quickMainButtonCount === "number") cfg.quickMainButtonCount = payload.quickMainButtonCount;
      if (typeof payload.quickPaddingY === "number") cfg.quickPaddingY = payload.quickPaddingY;
      if (typeof payload.dividerHeight === "number") cfg.dividerHeight = payload.dividerHeight;
      if (typeof payload.dividerMarginY === "number") cfg.dividerMarginY = payload.dividerMarginY;
      if (Array.isArray(payload.enabledQuickActions)) {
        enabledQuickActionSet = new Set(
          payload.enabledQuickActions
            .map((actionItem) => String(actionItem || "").trim().toLowerCase())
            .filter(Boolean)
        );
      }
      syncQuickButtonsAvailability();
      state.opacity = clamp(Number(state.opacity) || cfg.opacityDefault, cfg.opacityMin, cfg.opacityMax);
      applyLayout();
      applyVisual();
    } catch {}
  };

  const loadState = async () => {
    if (!window.shell || typeof window.shell.getFloatingToggleState !== "function") return;
    try {
      const payload = await window.shell.getFloatingToggleState();
      applyPayload(payload);
      applyVisual();
    } catch {}
  };

  const toggleVisibility = async () => {
    if (!window.shell || typeof window.shell.toggleMainWindowVisibility !== "function") return;
    try {
      const result = await window.shell.toggleMainWindowVisibility();
      if (result && typeof result.visible === "boolean") {
        state.visible = !!result.visible;
      } else {
        state.visible = !state.visible;
      }
      applyVisual();
    } catch {}
  };

  const emitQuickAction = async (action, trigger) => {
    if (!action || !window.shell || typeof window.shell.floatingQuickAction !== "function") return;
    try {
      await window.shell.floatingQuickAction({ action, trigger });
    } catch {}
  };

  toggleButton.addEventListener("click", (ev) => {
    ev.preventDefault();
    void toggleVisibility();
  });

  quickButtons.forEach((button) => {
    const action = String(button.getAttribute("data-action") || "").trim().toLowerCase();
    if (!action) return;
    const quickActionMeta = floatingQuickActionMetaByKey[action] || null;
    if (quickActionMeta) {
      const quickActionLabel = `${quickActionMeta.zhName} / ${quickActionMeta.enName}`;
      button.setAttribute("title", quickActionLabel);
      button.setAttribute("aria-label", quickActionLabel);
      button.setAttribute("data-action-label", quickActionLabel);
      const quickIconImage = button.querySelector(".quick-icon-image");
      if (quickIconImage) {
        quickIconImage.setAttribute("src", quickActionMeta.iconPath);
        quickIconImage.setAttribute("alt", quickActionLabel);
      }
    }
    button.addEventListener("pointerenter", () => {
      button.classList.add("is-active");
      void emitQuickAction(action, "hover-enter");
    });
    button.addEventListener("pointerleave", () => {
      button.classList.remove("is-active");
      void emitQuickAction(action, "hover-leave");
    });
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      void emitQuickAction(action, "click");
    });
  });

  toggleButton.addEventListener(
    "wheel",
    async (ev) => {
      ev.preventDefault();
      const step = ev.deltaY < 0 ? 0.05 : -0.05;
      state.opacity = clamp((Number(state.opacity) || 1) + step, cfg.opacityMin, cfg.opacityMax);
      applyVisual();
      if (window.shell && typeof window.shell.setFloatingToggleOpacity === "function") {
        try {
          const result = await window.shell.setFloatingToggleOpacity(state.opacity);
          if (result && typeof result.opacity === "number") {
            state.opacity = clamp(Number(result.opacity) || cfg.opacityDefault, cfg.opacityMin, cfg.opacityMax);
            applyVisual();
          }
        } catch {}
      }
    },
    { passive: false }
  );

  if (window.shell && typeof window.shell.onFloatingToggleState === "function") {
    window.shell.onFloatingToggleState((payload) => {
      applyPayload(payload);
      applyVisual();
    });
  }

  syncQuickButtonsAvailability();
  applyLayout();
  applyVisual();
  void loadConfig();
  void loadState();
})();

