import React from "react";
import SettingsApiKeyField from "./SettingsApiKeyField";

function maskSecretPreview(value) {
  const raw = String(value || "").trim();
  if (!raw) return "未配置密钥";
  if (raw.length <= 4) return raw;
  let keep = 4;
  if (raw.length <= 12) keep = 3;
  if (raw.length <= 8) keep = 2;
  const middleCount = raw.length - (keep * 2);
  if (middleCount <= 0) return raw;
  return `${raw.slice(0, keep)}${"·".repeat(middleCount)}${raw.slice(-keep)}`;
}

function renderSummaryModelText(text, forceMarquee = false) {
  const content = String(text || "").trim() || "未配置模型";
  const marquee = forceMarquee && content.length > 24;
  if (!marquee) return <span className="settings-summary-model-track">{content}</span>;
  return <span className="settings-summary-model-track">{content}</span>;
}

function SettingsView({
  contentWrapSettingsRef,
  contentScrollSettingsRef,
  chatProviderAnchorRef,
  chatModeSwitchAnchorRef,
  chatModelAnchorRef,
  chatApiKeyInputRef,
  imageProviderAnchorRef,
  imageModeSwitchAnchorRef,
  imageModelAnchorRef,
  imageApiKeyInputRef,
  bridgePortInputFocusedRef,
  providerDropdown,
  modelDropdown,
  chatProviderKey,
  imageProviderKey,
  chatSiteLabel,
  chatApiFormatLabel,
  chatModeSwitchEnabled,
  chatConfig,
  chatApiFoldOpen,
  imageApiFoldOpen,
  sessionNamingEnabled,
  thinkingTranslateEnabled,
  floatingToggleEnabled,
  floatingToggleOpacity,
  chatKeyVisible,
  chatConfigExpanded,
  settingsToolsFoldOpen,
  settingsDisplayFoldOpen,
  imageApiFormatLabel,
  imageModeSwitchEnabled,
  imageSiteLabel,
  imageConfig,
  imageKeyVisible,
  chatModelHelpUrl,
  imageModelHelpUrl,
  canFetchChatModels,
  canFetchImageModels,
  bridgePortDraft,
  bridgePort,
  bridgePortApplying,
  bridgePortAvailable,
  uiScaleSelectValue,
  uiScaleAnchorRef,
  uiScaleDropdownOpen,
  closeProviderDropdown,
  openProviderDropdown,
  closeModelDropdown,
  openModelDropdown,
  toggleUiScaleDropdown,
  setChatApiFoldOpen,
  setImageApiFoldOpen,
  setChatKeyVisible,
  setSessionNamingEnabled,
  setThinkingTranslateEnabled,
  setFloatingToggleEnabled,
  setFloatingToggleOpacity,
  setChatConfigExpanded,
  setSettingsToolsFoldOpen,
  setSettingsDisplayFoldOpen,
  setImageKeyVisible,
  handleConfigField,
  handleFetchModels,
  setBridgePortDraft,
  normalizeBridgePort,
  handleBridgePortDraftKeyDown,
  handleApplyBridgePort,
  iconDropdown,
  iconReconnect,
  iconPreviewOn,
  iconPreviewOff,
  iconSaveDisk,
  CONTEXT_MIN,
  CONTEXT_MAX,
  MAX_TOKENS_MIN,
  MAX_TOKENS_MAX,
  TIMEOUT_MIN_SEC,
  TIMEOUT_MAX_SEC,
  defaultChatConfig,
  defaultImageConfig,
  BRIDGE_PORT_MIN,
  BRIDGE_PORT_MAX,
  DEFAULT_BRIDGE_PORT,
  FLOATING_TOGGLE_OPACITY_MIN,
  FLOATING_TOGGLE_OPACITY_MAX
}) {
  const isChatCustomProvider = String(chatProviderKey || "") === "custom";
  const isImageCustomProvider = String(imageProviderKey || "") === "custom";
  const chatAdvancedTip = {
    temperature: "控制输出随机性：越高越发散，越低越稳定。",
    topP: "控制候选词采样范围：越低越保守，越高越灵活。",
    presencePenalty: "控制新话题倾向：越高越鼓励提出未出现过的内容。",
    frequencyPenalty: "控制重复惩罚：越高越减少重复词句。"
  };
  const settingsTip = {
    chatProvider: "选择聊天服务商；切换后会使用对应接口配置。",
    chatBaseUrl: "聊天 API 地址（Base URL），通常保持默认即可。",
    chatModel: "选择或手动填写对话模型 ID。",
    chatApiKey: "点击可显示或隐藏密钥内容。",
    contextCount: "控制携带历史消息条数；越大越连贯，但消耗更多 token。",
    maxTokens: "限制单次回复长度上限；过低可能导致回复被截断。",
    imageProvider: "选择生图服务商；切换后会使用对应接口配置。",
    imageBaseUrl: "生图 API 地址（Base URL），通常保持默认即可。",
    imageModel: "选择或手动填写生图模型 ID。",
    imageApiKey: "点击可显示或隐藏密钥内容。",
    timeout: "设置生图请求超时时间（秒）。",
    runBatchStrategyAuto: "自动选择最稳妥策略：支持单请求多图时走单发，否则自动切换多发。",
    runBatchStrategySingle: "单发：单请求多图（仅部分服务商/兼容格式支持）。",
    runBatchStrategyMulti: "多发：按数量拆分为多次请求，兼容性最高。",
    sessionNaming: "后台会自动生成会话标题，会消耗少量聊天额度；关闭后使用首句截断命名。",
    thinkingTranslate: "使用 Google 免费翻译接口（translate.googleapis.com）翻译思考流，受网络环境影响可能失败。",
    floatingToggle: "启用后右侧显示悬浮按钮，可快速隐藏/显示主窗口。",
    floatingOpacity: "调整悬浮按钮透明度（35%-100%），仅作用于悬浮按钮本体。",
    bridgePort: "用于连接桌面端与 Ps 插件的本地端口（默认 17325），通常保持默认即可。",
    uiScale: "调整当前面板整体显示比例。"
  };
  const floatingOpacityMinPercent = Math.round(Number(FLOATING_TOGGLE_OPACITY_MIN || 0.35) * 100);
  const floatingOpacityMaxPercent = Math.round(Number(FLOATING_TOGGLE_OPACITY_MAX || 1) * 100);
  const floatingOpacityPercent = Math.round(Number(floatingToggleOpacity || 1) * 100);
  const chatModelSummary = String(chatConfig?.model || "").trim() || "未配置模型";
  const imageModelSummary = String(imageConfig?.model || "").trim() || "未配置模型";
  const chatKeySummary = maskSecretPreview(chatConfig?.apiKey);
  const imageKeySummary = maskSecretPreview(imageConfig?.apiKey);
  const chatKeyInputValue = chatKeyVisible ? String(chatConfig?.apiKey || "") : chatKeySummary;
  const imageKeyInputValue = imageKeyVisible ? String(imageConfig?.apiKey || "") : imageKeySummary;
  const imageRunBatchStrategyValue = String(imageConfig?.runBatchStrategy || "auto").trim().toLowerCase() || "auto";
  const chatProviderSummaryTip = `聊天服务商：${chatSiteLabel}`;
  const chatModelSummaryTip = `对话模型：${chatModelSummary}`;
  const chatKeySummaryTip = chatKeyVisible
    ? "聊天 API 密钥：当前为明文显示。"
    : "聊天 API 密钥：当前为隐藏显示，点击右侧眼睛可切换。";
  const imageProviderSummaryTip = `生图服务商：${imageSiteLabel}`;
  const imageModelSummaryTip = `生图模型：${imageModelSummary}`;
  const imageKeySummaryTip = imageKeyVisible
    ? "生图 API 密钥：当前为明文显示。"
    : "生图 API 密钥：当前为隐藏显示，点击右侧眼睛可切换。";
  const bridgePortDirty = Number(normalizeBridgePort(bridgePortDraft, bridgePort)) !== Number(bridgePort);
  const chatMoreWrapRef = React.useRef(null);
  const sectionRefs = React.useRef({ chat: null, image: null, tools: null, display: null });
  const focusAnimTimerRef = React.useRef(null);
  const [focusScrollKey, setFocusScrollKey] = React.useState("");
  const [focusAnimKey, setFocusAnimKey] = React.useState("");
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
  const openProviderBySummary = (section) => {
    closeModelDropdown();
    openProviderDropdown(section);
  };

  const openModelBySummary = (section) => {
    closeProviderDropdown();
    openModelDropdown(section);
  };

  const markSectionFocus = (sectionKey) => {
    setFocusAnimKey(sectionKey);
    if (focusAnimTimerRef.current) {
      clearTimeout(focusAnimTimerRef.current);
      focusAnimTimerRef.current = null;
    }
    focusAnimTimerRef.current = setTimeout(() => {
      setFocusAnimKey((prev) => (prev === sectionKey ? "" : prev));
      focusAnimTimerRef.current = null;
    }, 320);
  };

  const scrollSectionIntoView = (sectionKey) => {
    const scroller = contentScrollSettingsRef?.current;
    const sectionEl = sectionRefs.current?.[sectionKey];
    if (!scroller || !sectionEl) return;
    const scrollerRect = scroller.getBoundingClientRect();
    const sectionRect = sectionEl.getBoundingClientRect();
    const padding = 12;
    const minTop = scrollerRect.top + padding;
    const maxBottom = scrollerRect.bottom - padding;
    const currentTop = Number(scroller.scrollTop) || 0;
    let nextTop = currentTop;
    if (sectionRect.top < minTop) {
      nextTop = Math.max(0, currentTop - (minTop - sectionRect.top));
    } else if (sectionRect.bottom > maxBottom) {
      nextTop = Math.max(0, currentTop + (sectionRect.bottom - maxBottom));
    }
    if (Math.abs(nextTop - currentTop) > 0.5) {
      scroller.scrollTo({ top: nextTop, behavior: "smooth" });
    }
    markSectionFocus(sectionKey);
  };

  const openExclusiveFold = (sectionKey) => {
    setChatApiFoldOpen(sectionKey === "chat");
    setImageApiFoldOpen(sectionKey === "image");
    setSettingsToolsFoldOpen(sectionKey === "tools");
    setSettingsDisplayFoldOpen(sectionKey === "display");
    setFocusScrollKey(sectionKey);
  };

  const getModeOptionsForSection = (section) => {
    if (section === "chat") {
      if (chatProviderKey === "custom") {
        return ["openai-compat", "google-native"];
      }
      return ["openai-compat"];
    }
    if (imageProviderKey === "google") return ["google-native"];
    if (imageProviderKey === "grsai" || imageProviderKey === "custom") {
      return ["openai-compat", "google-native"];
    }
    return ["openai-compat"];
  };

  const toggleModeBySection = (section) => {
    const options = getModeOptionsForSection(section);
    if (!options.length) return;
    const current = String(section === "chat" ? chatConfig?.providerMode : imageConfig?.providerMode).trim().toLowerCase();
    const currentIndex = options.indexOf(current);
    const nextIndex = currentIndex < 0 ? 0 : ((currentIndex + 1) % options.length);
    handleConfigField(section, "providerMode", options[nextIndex]);
  };

  const handleToggleChatApiFold = () => {
    if (chatApiFoldOpen) {
      setChatApiFoldOpen(false);
      return;
    }
    openExclusiveFold("chat");
  };

  const handleToggleImageApiFold = () => {
    if (imageApiFoldOpen) {
      setImageApiFoldOpen(false);
      return;
    }
    openExclusiveFold("image");
  };

  const handleToggleSettingsToolsFold = () => {
    if (settingsToolsFoldOpen) {
      setSettingsToolsFoldOpen(false);
      return;
    }
    openExclusiveFold("tools");
  };

  const handleToggleSettingsDisplayFold = () => {
    if (settingsDisplayFoldOpen) {
      setSettingsDisplayFoldOpen(false);
      return;
    }
    openExclusiveFold("display");
  };

  React.useEffect(() => {
    if (!chatConfigExpanded) return undefined;
    const onPointerDown = (event) => {
      const target = event?.target;
      if (chatMoreWrapRef.current?.contains(target)) return;
      setChatConfigExpanded(false);
    };
    document.addEventListener("mousedown", onPointerDown, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown, true);
    };
  }, [chatConfigExpanded, setChatConfigExpanded]);

  React.useEffect(() => {
    if (!focusScrollKey) return undefined;
    const isOpened = (
      (focusScrollKey === "chat" && chatApiFoldOpen)
      || (focusScrollKey === "image" && imageApiFoldOpen)
      || (focusScrollKey === "tools" && settingsToolsFoldOpen)
      || (focusScrollKey === "display" && settingsDisplayFoldOpen)
    );
    if (!isOpened) return undefined;
    let rafA = 0;
    let rafB = 0;
    rafA = requestAnimationFrame(() => {
      rafB = requestAnimationFrame(() => {
        scrollSectionIntoView(focusScrollKey);
        setFocusScrollKey("");
      });
    });
    return () => {
      if (rafA) cancelAnimationFrame(rafA);
      if (rafB) cancelAnimationFrame(rafB);
    };
  }, [
    focusScrollKey,
    chatApiFoldOpen,
    imageApiFoldOpen,
    settingsToolsFoldOpen,
    settingsDisplayFoldOpen
  ]);

  React.useEffect(() => (
    () => {
      if (focusAnimTimerRef.current) {
        clearTimeout(focusAnimTimerRef.current);
        focusAnimTimerRef.current = null;
      }
    }
  ), []);

  return (
    <main className="content-wrap" ref={contentWrapSettingsRef}>
      <div className="content-scroll settings" ref={contentScrollSettingsRef}>
        <section
          ref={(node) => { sectionRefs.current.chat = node; }}
          className={`settings-section settings-card ${focusAnimKey === "chat" ? "is-focus-scroll" : ""}`}
        >
          <div className="settings-title-row">
            <div className="settings-title">对话 API 配置</div>
            <button
              ref={chatModeSwitchAnchorRef}
              className="settings-mode-switch"
              type="button"
              data-tip-text="点击切换兼容格式"
              data-tip-placement="right"
              onClick={() => {
                if (!chatModeSwitchEnabled) return;
                toggleModeBySection("chat");
              }}
            >
              {chatApiFormatLabel}
            </button>
          </div>

          {!chatApiFoldOpen ? (
            <div className="settings-summary-card">
              <div className="settings-summary-row">
                <button
                  ref={chatProviderAnchorRef}
                  type="button"
                  className="settings-summary-item is-provider"
                  data-tip-text={chatProviderSummaryTip}
                  data-tip-placement="right"
                  onClick={() => openProviderBySummary("chat")}
                >
                  {chatSiteLabel}
                </button>
                <button
                  ref={chatModelAnchorRef}
                  type="button"
                  className="settings-summary-item is-model"
                  data-tip-text={chatModelSummaryTip}
                  data-tip-placement="right"
                  onClick={() => openModelBySummary("chat")}
                >
                  {renderSummaryModelText(chatModelSummary)}
                </button>
              </div>
              <div className="settings-inline-row settings-summary-key-row">
                <input
                  ref={chatApiKeyInputRef}
                  className={`settings-field settings-summary-key-input wheel-scroll-x ${chatKeyVisible ? "" : "is-secret-masked"}`}
                  type="text"
                  value={chatKeyInputValue}
                  readOnly={!chatKeyVisible}
                  data-tip-text={chatKeySummaryTip}
                  data-tip-placement="right"
                  placeholder="请输入聊天 API Key"
                  onWheel={(e) => {
                    if (chatKeyVisible) return;
                    handleOverflowWheelScroll(e);
                  }}
                  onFocus={() => {
                    if (!chatKeyVisible) setChatKeyVisible(true);
                  }}
                  onChange={(e) => {
                    if (!chatKeyVisible) return;
                    handleConfigField("chat", "apiKey", e.target.value);
                  }}
                />
                <button
                  className="settings-fetch-btn settings-eye-btn"
                  type="button"
                  data-tip-text={chatKeyVisible ? "隐藏密钥" : "显示密钥"}
                  data-tip-placement="right"
                  onClick={() => setChatKeyVisible((v) => !v)}
                >
                  <img className="icon-16" src={chatKeyVisible ? iconPreviewOn : iconPreviewOff} alt={chatKeyVisible ? "hide-key" : "show-key"} />
                </button>
              </div>
            </div>
          ) : (
            <>

          <div className="settings-label">服务商</div>
          <div className="settings-inline-row settings-provider-row">
            <div className="settings-select-wrap settings-provider-select" ref={chatProviderAnchorRef}>
              <button
                className="settings-model-trigger"
                type="button"
                data-tip-text={settingsTip.chatProvider}
                data-tip-placement="right"
                onClick={() => {
                  if (providerDropdown.open && providerDropdown.section === "chat") {
                    closeProviderDropdown();
                  } else {
                    openProviderDropdown("chat");
                  }
                }}
              >
                <span className="settings-model-trigger-text">{chatSiteLabel}</span>
                <img className="icon-12 settings-select-arrow" src={iconDropdown} alt="drop" />
              </button>
            </div>
            <input
              className="settings-field"
              value={chatConfig.baseUrl}
              placeholder="https://api.example.com"
              data-tip-text={settingsTip.chatBaseUrl}
              data-tip-placement="right"
              onChange={(e) => handleConfigField("chat", "baseUrl", e.target.value)}
            />
          </div>

          <div className="settings-label-row">
            <div className="settings-label">对话模型</div>
            {isChatCustomProvider ? (
              <span className="settings-link settings-link-hint">自定义服务商请自行获取模型</span>
            ) : (canFetchChatModels && !!chatModelHelpUrl ? (
              <a className="settings-link" href={chatModelHelpUrl} target="_blank" rel="noreferrer">
                前往获取模型
              </a>
            ) : null)}
          </div>
          <div className="settings-inline-row">
            <div className="settings-select-wrap" ref={chatModelAnchorRef}>
              <button
                className="settings-model-trigger"
                type="button"
                data-tip-text={settingsTip.chatModel}
                data-tip-placement="right"
                onClick={() => {
                  if (modelDropdown.open && modelDropdown.section === "chat") {
                    closeModelDropdown();
                  } else {
                    openModelDropdown("chat");
                  }
                }}
              >
                <span className="settings-model-trigger-text">{chatConfig.model || "请选择模型"}</span>
                <img className="icon-12 settings-select-arrow" src={iconDropdown} alt="drop" />
              </button>
            </div>
            {canFetchChatModels ? (
              <button
                className="settings-fetch-btn settings-fetch-icon"
                type="button"
                data-tip-text="刷新聊天模型列表"
                data-tip-placement="right"
                onClick={() => handleFetchModels("chat")}
              >
                <img className="icon-16" src={iconReconnect} alt="refresh-models" />
              </button>
            ) : null}
          </div>

          <SettingsApiKeyField
            labelText="API Key（密钥）"
            buyLinkText={isChatCustomProvider ? "自定义服务商请自行获取密钥" : `前往 ${chatSiteLabel} 获取密钥`}
            siteLabel={chatSiteLabel}
            siteUrl={isChatCustomProvider ? "" : chatModelHelpUrl}
            tipText={settingsTip.chatApiKey}
            value={chatConfig.apiKey}
            visible={chatKeyVisible}
            placeholder="请输入聊天 API Key"
            hintText=""
            inputRef={chatApiKeyInputRef}
            onMaskedWheel={handleOverflowWheelScroll}
            onChange={(nextValue) => handleConfigField("chat", "apiKey", nextValue)}
            onToggleVisible={() => setChatKeyVisible((v) => !v)}
            iconPreviewOn={iconPreviewOn}
            iconPreviewOff={iconPreviewOff}
          />

          <div className="settings-range-block">
            <div className="settings-range-head">
              <span>上下文条数</span>
              <input
                type="number"
                min={CONTEXT_MIN}
                max={CONTEXT_MAX}
                className="settings-range-input"
                value={Number(chatConfig.contextCount) || defaultChatConfig.contextCount}
                data-tip-text={settingsTip.contextCount}
                data-tip-placement="right"
                onChange={(e) => handleConfigField("chat", "contextCount", Number(e.target.value))}
              />
            </div>
            <input
              type="range"
              min={CONTEXT_MIN}
              max={CONTEXT_MAX}
              step={1}
              value={Math.max(CONTEXT_MIN, Math.min(CONTEXT_MAX, Number(chatConfig.contextCount) || defaultChatConfig.contextCount))}
              data-tip-text={settingsTip.contextCount}
              data-tip-placement="right"
              onChange={(e) => handleConfigField("chat", "contextCount", Number(e.target.value))}
            />
          </div>

          <div className="settings-range-block">
            <div className="settings-range-head">
              <span>最大回复 tokens</span>
              <input
                type="number"
                min={MAX_TOKENS_MIN}
                max={MAX_TOKENS_MAX}
                className="settings-range-input"
                value={Number(chatConfig.maxTokens) || defaultChatConfig.maxTokens}
                data-tip-text={settingsTip.maxTokens}
                data-tip-placement="right"
                onChange={(e) => handleConfigField("chat", "maxTokens", Number(e.target.value))}
              />
            </div>
            <input
              type="range"
              min={MAX_TOKENS_MIN}
              max={MAX_TOKENS_MAX}
              step={1}
              value={Math.max(MAX_TOKENS_MIN, Math.min(MAX_TOKENS_MAX, Number(chatConfig.maxTokens) || defaultChatConfig.maxTokens))}
              data-tip-text={settingsTip.maxTokens}
              data-tip-placement="right"
              onChange={(e) => handleConfigField("chat", "maxTokens", Number(e.target.value))}
            />
          </div>

          <div className="settings-more-wrap" ref={chatMoreWrapRef}>
            <button
              className={`settings-more-row ${chatConfigExpanded ? "is-open" : ""}`}
              type="button"
              onClick={() => setChatConfigExpanded((v) => !v)}
              data-tip-text={chatConfigExpanded ? "点击收起更多配置" : "点击展开更多配置"}
              data-tip-placement="right"
            >
              <span className="settings-more-title">更多配置</span>
              <span className="settings-more-state">{chatConfigExpanded ? "收起" : "展开"}</span>
            </button>

            {chatConfigExpanded && (
              <div className="settings-more-panel settings-more-popover floating-layer">
              <div className="settings-range-block">
                <div className="settings-range-head">
                  <span>随机性</span>
                  <input
                    type="number"
                    min={0}
                    max={2}
                    step={0.1}
                    className="settings-range-input"
                    value={Number(chatConfig.temperature)}
                    data-tip-text={chatAdvancedTip.temperature}
                    data-tip-placement="right"
                    onChange={(e) => handleConfigField("chat", "temperature", Number(e.target.value))}
                  />
                </div>
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={0.1}
                  value={Number(chatConfig.temperature)}
                  data-tip-text={chatAdvancedTip.temperature}
                  data-tip-placement="right"
                  onChange={(e) => handleConfigField("chat", "temperature", Number(e.target.value))}
                />
              </div>
              <div className="settings-range-block">
                <div className="settings-range-head">
                  <span>核采样</span>
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.01}
                    className="settings-range-input"
                    value={Number(chatConfig.topP)}
                    data-tip-text={chatAdvancedTip.topP}
                    data-tip-placement="right"
                    onChange={(e) => handleConfigField("chat", "topP", Number(e.target.value))}
                  />
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={Number(chatConfig.topP)}
                  data-tip-text={chatAdvancedTip.topP}
                  data-tip-placement="right"
                  onChange={(e) => handleConfigField("chat", "topP", Number(e.target.value))}
                />
              </div>
              <div className="settings-range-block">
                <div className="settings-range-head">
                  <span>话题新鲜度</span>
                  <input
                    type="number"
                    min={0}
                    max={2}
                    step={0.1}
                    className="settings-range-input"
                    value={Number(chatConfig.presencePenalty)}
                    data-tip-text={chatAdvancedTip.presencePenalty}
                    data-tip-placement="right"
                    onChange={(e) => handleConfigField("chat", "presencePenalty", Number(e.target.value))}
                  />
                </div>
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={0.1}
                  value={Number(chatConfig.presencePenalty)}
                  data-tip-text={chatAdvancedTip.presencePenalty}
                  data-tip-placement="right"
                  onChange={(e) => handleConfigField("chat", "presencePenalty", Number(e.target.value))}
                />
              </div>
              <div className="settings-range-block">
                <div className="settings-range-head">
                  <span>频率惩罚</span>
                  <input
                    type="number"
                    min={0}
                    max={2}
                    step={0.1}
                    className="settings-range-input"
                    value={Number(chatConfig.frequencyPenalty)}
                    data-tip-text={chatAdvancedTip.frequencyPenalty}
                    data-tip-placement="right"
                    onChange={(e) => handleConfigField("chat", "frequencyPenalty", Number(e.target.value))}
                  />
                </div>
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={0.1}
                  value={Number(chatConfig.frequencyPenalty)}
                  data-tip-text={chatAdvancedTip.frequencyPenalty}
                  data-tip-placement="right"
                  onChange={(e) => handleConfigField("chat", "frequencyPenalty", Number(e.target.value))}
                />
              </div>
              </div>
            )}
          </div>
            </>
          )}
          <div className="settings-collapse-foot">
            <button
              className={`settings-collapse-row settings-collapse-row-full ${chatApiFoldOpen ? "is-open" : ""}`}
              type="button"
              aria-label={chatApiFoldOpen ? "收起对话 API 配置" : "展开对话 API 配置"}
              onClick={handleToggleChatApiFold}
            >
              <span className="settings-collapse-pill">
                <span className="settings-collapse-arrow" />
              </span>
            </button>
          </div>
        </section>

        <section
          ref={(node) => { sectionRefs.current.image = node; }}
          className={`settings-section settings-card ${focusAnimKey === "image" ? "is-focus-scroll" : ""}`}
        >
          <div className="settings-title-row">
            <div className="settings-title">生成图片 API 配置</div>
            <button
              ref={imageModeSwitchAnchorRef}
              className="settings-mode-switch"
              type="button"
              data-tip-text="点击切换兼容格式"
              data-tip-placement="right"
              onClick={() => {
                if (!imageModeSwitchEnabled) return;
                toggleModeBySection("image");
              }}
            >
              {imageApiFormatLabel}
            </button>
          </div>

          {!imageApiFoldOpen ? (
            <div className="settings-summary-card">
              <div className="settings-summary-row">
                <button
                  ref={imageProviderAnchorRef}
                  type="button"
                  className="settings-summary-item is-provider"
                  data-tip-text={imageProviderSummaryTip}
                  data-tip-placement="right"
                  onClick={() => openProviderBySummary("image")}
                >
                  {imageSiteLabel}
                </button>
                <button
                  ref={imageModelAnchorRef}
                  type="button"
                  className="settings-summary-item is-model"
                  data-tip-text={imageModelSummaryTip}
                  data-tip-placement="right"
                  onClick={() => openModelBySummary("image")}
                >
                  {renderSummaryModelText(imageModelSummary)}
                </button>
              </div>
              <div className="settings-inline-row settings-summary-key-row">
                <input
                  ref={imageApiKeyInputRef}
                  className={`settings-field settings-summary-key-input wheel-scroll-x ${imageKeyVisible ? "" : "is-secret-masked"}`}
                  type="text"
                  value={imageKeyInputValue}
                  readOnly={!imageKeyVisible}
                  data-tip-text={imageKeySummaryTip}
                  data-tip-placement="right"
                  placeholder="请输入生图 API Key"
                  onWheel={(e) => {
                    if (imageKeyVisible) return;
                    handleOverflowWheelScroll(e);
                  }}
                  onFocus={() => {
                    if (!imageKeyVisible) setImageKeyVisible(true);
                  }}
                  onChange={(e) => {
                    if (!imageKeyVisible) return;
                    handleConfigField("image", "apiKey", e.target.value);
                  }}
                />
                <button
                  className="settings-fetch-btn settings-eye-btn"
                  type="button"
                  data-tip-text={imageKeyVisible ? "隐藏密钥" : "显示密钥"}
                  data-tip-placement="right"
                  onClick={() => setImageKeyVisible((v) => !v)}
                >
                  <img className="icon-16" src={imageKeyVisible ? iconPreviewOn : iconPreviewOff} alt={imageKeyVisible ? "hide-key" : "show-key"} />
                </button>
              </div>
            </div>
          ) : (
            <>

          <div className="settings-label">服务商</div>
          <div className="settings-inline-row settings-provider-row">
            <div className="settings-select-wrap settings-provider-select" ref={imageProviderAnchorRef}>
              <button
                className="settings-model-trigger"
                type="button"
                data-tip-text={settingsTip.imageProvider}
                data-tip-placement="right"
                onClick={() => {
                  if (providerDropdown.open && providerDropdown.section === "image") {
                    closeProviderDropdown();
                  } else {
                    openProviderDropdown("image");
                  }
                }}
              >
                <span className="settings-model-trigger-text">{imageSiteLabel}</span>
                <img className="icon-12 settings-select-arrow" src={iconDropdown} alt="drop" />
              </button>
            </div>
            <input
              className="settings-field"
              value={imageConfig.baseUrl}
              placeholder="https://api.example.com"
              data-tip-text={settingsTip.imageBaseUrl}
              data-tip-placement="right"
              onChange={(e) => handleConfigField("image", "baseUrl", e.target.value)}
            />
          </div>

          <div className="settings-label-row">
            <div className="settings-label">生成模型</div>
            {isImageCustomProvider ? (
              <span className="settings-link settings-link-hint">自定义服务商请自行获取模型</span>
            ) : (canFetchImageModels && !!imageModelHelpUrl ? (
              <a className="settings-link" href={imageModelHelpUrl} target="_blank" rel="noreferrer">
                前往获取模型
              </a>
            ) : null)}
          </div>
          <div className="settings-inline-row">
            <div className="settings-select-wrap" ref={imageModelAnchorRef}>
              <button
                className="settings-model-trigger"
                type="button"
                data-tip-text={settingsTip.imageModel}
                data-tip-placement="right"
                onClick={() => {
                  if (modelDropdown.open && modelDropdown.section === "image") {
                    closeModelDropdown();
                  } else {
                    openModelDropdown("image");
                  }
                }}
              >
                <span className="settings-model-trigger-text">{imageConfig.model || "请选择模型"}</span>
                <img className="icon-12 settings-select-arrow" src={iconDropdown} alt="drop" />
              </button>
            </div>
            {canFetchImageModels ? (
              <button
                className="settings-fetch-btn settings-fetch-icon"
                type="button"
                data-tip-text="刷新生图模型列表"
                data-tip-placement="right"
                onClick={() => handleFetchModels("image")}
              >
                <img className="icon-16" src={iconReconnect} alt="refresh-models" />
              </button>
            ) : null}
          </div>

          <SettingsApiKeyField
            labelText="API Key（密钥）"
            buyLinkText={isImageCustomProvider ? "自定义服务商请自行获取密钥" : `前往 ${imageSiteLabel} 获取密钥`}
            siteLabel={imageSiteLabel}
            siteUrl={isImageCustomProvider ? "" : imageModelHelpUrl}
            tipText={settingsTip.imageApiKey}
            value={imageConfig.apiKey}
            visible={imageKeyVisible}
            placeholder="请输入生图 API Key"
            hintText=""
            inputRef={imageApiKeyInputRef}
            onMaskedWheel={handleOverflowWheelScroll}
            onChange={(nextValue) => handleConfigField("image", "apiKey", nextValue)}
            onToggleVisible={() => setImageKeyVisible((v) => !v)}
            iconPreviewOn={iconPreviewOn}
            iconPreviewOff={iconPreviewOff}
          />

          <div className="settings-range-block">
            <div className="settings-range-head">
              <span>超时时间</span>
              <div className="settings-range-input-wrap">
                <input
                  type="number"
                  min={TIMEOUT_MIN_SEC}
                  max={TIMEOUT_MAX_SEC}
                  className="settings-range-input"
                  value={Math.round((Number(imageConfig.timeoutMs) || defaultImageConfig.timeoutMs) / 1000)}
                  data-tip-text={settingsTip.timeout}
                  data-tip-placement="right"
                  onChange={(e) => handleConfigField("image", "timeoutMs", Number(e.target.value) * 1000)}
                />
                <span className="settings-range-suffix">s</span>
              </div>
            </div>
            <input
              type="range"
              min={TIMEOUT_MIN_SEC}
              max={TIMEOUT_MAX_SEC}
              step={1}
              value={Math.max(
                TIMEOUT_MIN_SEC,
                Math.min(TIMEOUT_MAX_SEC, Math.round((Number(imageConfig.timeoutMs) || defaultImageConfig.timeoutMs) / 1000))
              )}
              data-tip-text={settingsTip.timeout}
              data-tip-placement="right"
              onChange={(e) => handleConfigField("image", "timeoutMs", Number(e.target.value) * 1000)}
            />
          </div>
          <div className="settings-label-row">
            <div className="settings-label">多图请求策略</div>
          </div>
          <div className="settings-run-batch-row">
            <button
              className={`settings-fetch-btn settings-run-batch-btn ${imageRunBatchStrategyValue === "auto" ? "is-active" : ""}`}
              type="button"
              data-tip-text={settingsTip.runBatchStrategyAuto}
              data-tip-placement="right"
              onClick={() => handleConfigField("image", "runBatchStrategy", "auto")}
            >
              自动
            </button>
            <button
              className={`settings-fetch-btn settings-run-batch-btn ${imageRunBatchStrategyValue === "single" ? "is-active" : ""}`}
              type="button"
              data-tip-text={settingsTip.runBatchStrategySingle}
              data-tip-placement="right"
              onClick={() => handleConfigField("image", "runBatchStrategy", "single")}
            >
              单发
            </button>
            <button
              className={`settings-fetch-btn settings-run-batch-btn ${imageRunBatchStrategyValue === "multi" ? "is-active" : ""}`}
              type="button"
              data-tip-text={settingsTip.runBatchStrategyMulti}
              data-tip-placement="right"
              onClick={() => handleConfigField("image", "runBatchStrategy", "multi")}
            >
              多发
            </button>
          </div>
            </>
          )}
          <div className="settings-collapse-foot">
            <button
              className={`settings-collapse-row settings-collapse-row-full ${imageApiFoldOpen ? "is-open" : ""}`}
              type="button"
              aria-label={imageApiFoldOpen ? "收起生成图片 API 配置" : "展开生成图片 API 配置"}
              onClick={handleToggleImageApiFold}
            >
              <span className="settings-collapse-pill">
                <span className="settings-collapse-arrow" />
              </span>
            </button>
          </div>
        </section>

        <section
          ref={(node) => { sectionRefs.current.tools = node; }}
          className={`settings-section settings-card settings-compact-title-card settings-addon-pair-card ${focusAnimKey === "tools" ? "is-focus-scroll" : ""}`}
        >
          <div className="settings-title-row">
            <div className="settings-title">对话辅助功能</div>
          </div>
          {settingsToolsFoldOpen ? (
            <>
              <div className="settings-addon-item">
                <div className="settings-addon-meta">
                  <div className="settings-title">对话自动命名</div>
                  <div className="settings-process-desc">自动生成当前会话标题。</div>
                </div>
                <div className="settings-addon-control">
                  <button
                    className={`settings-fetch-btn settings-toggle-btn ${sessionNamingEnabled ? "is-active" : ""}`}
                    type="button"
                    data-tip-text={settingsTip.sessionNaming}
                    data-tip-placement="right"
                    onClick={() => setSessionNamingEnabled((prev) => !prev)}
                  >
                    {sessionNamingEnabled ? "已开启" : "已关闭"}
                  </button>
                </div>
              </div>
              <div className="settings-addon-item">
                <div className="settings-addon-meta">
                  <div className="settings-title">思考流翻译</div>
                  <div className="settings-process-desc">将思考内容翻译为中文。</div>
                </div>
                <div className="settings-addon-control">
                  <button
                    className={`settings-fetch-btn settings-toggle-btn ${thinkingTranslateEnabled ? "is-active" : ""}`}
                    type="button"
                    data-tip-text={settingsTip.thinkingTranslate}
                    data-tip-placement="right"
                    onClick={() => setThinkingTranslateEnabled((prev) => !prev)}
                  >
                    {thinkingTranslateEnabled ? "已开启" : "已关闭"}
                  </button>
                </div>
              </div>
            </>
          ) : null}
          <div className="settings-collapse-foot">
            <button
              className={`settings-collapse-row settings-collapse-row-full ${settingsToolsFoldOpen ? "is-open" : ""}`}
              type="button"
              aria-label={settingsToolsFoldOpen ? "收起对话辅助功能" : "展开对话辅助功能"}
              onClick={handleToggleSettingsToolsFold}
            >
              <span className="settings-collapse-pill">
                <span className="settings-collapse-arrow" />
              </span>
            </button>
          </div>
        </section>

        <section
          ref={(node) => { sectionRefs.current.display = node; }}
          className={`settings-section settings-card settings-compact-title-card settings-addon-pair-card ${focusAnimKey === "display" ? "is-focus-scroll" : ""}`}
        >
          <div className="settings-title-row">
            <div className="settings-title">界面与悬浮窗</div>
          </div>
          {settingsDisplayFoldOpen ? (
            <>
              <div className="settings-addon-item">
                <div className="settings-addon-meta">
                  <div className="settings-title">显示缩放</div>
                  <div className="settings-process-desc">调整界面整体显示比例。</div>
                </div>
                <div className="settings-addon-control">
                  <div className="settings-select-wrap settings-ui-scale-inline" ref={uiScaleAnchorRef}>
                    <button
                      className={`settings-model-trigger ${uiScaleDropdownOpen ? "is-open" : ""}`}
                      type="button"
                      data-tip-text={settingsTip.uiScale}
                      data-tip-placement="right"
                      onClick={toggleUiScaleDropdown}
                    >
                      <span className="settings-model-trigger-text">
                        {`${Math.round((parseFloat(uiScaleSelectValue) || 1) * 100)}%`}
                      </span>
                      <img className="icon-12 settings-select-arrow" src={iconDropdown} alt="drop" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="settings-addon-item">
                <div className="settings-addon-meta">
                  <div className="settings-title">窗口悬浮开关</div>
                  <div className="settings-process-desc">右侧浮窗控制主窗显隐。</div>
                </div>
                <div className="settings-addon-control">
                  <button
                    className={`settings-fetch-btn settings-toggle-btn ${floatingToggleEnabled ? "is-active" : ""}`}
                    type="button"
                    data-tip-text={settingsTip.floatingToggle}
                    data-tip-placement="right"
                    onClick={() => setFloatingToggleEnabled((prev) => !prev)}
                  >
                    {floatingToggleEnabled ? "已开启" : "已关闭"}
                  </button>
                </div>
              </div>
              <div className="settings-range-block">
                <div className="settings-range-head">
                  <span>悬浮窗透明度</span>
                  <div className="settings-range-input-wrap">
                    <input
                      className="settings-range-input"
                      type="number"
                      min={floatingOpacityMinPercent}
                      max={floatingOpacityMaxPercent}
                      value={floatingOpacityPercent}
                      data-tip-text={settingsTip.floatingOpacity}
                      data-tip-placement="right"
                      onChange={(event) => {
                        const parsed = Number(event.target.value);
                        const nextPercent = Number.isFinite(parsed)
                          ? Math.max(floatingOpacityMinPercent, Math.min(floatingOpacityMaxPercent, Math.round(parsed)))
                          : floatingOpacityMaxPercent;
                        setFloatingToggleOpacity(nextPercent / 100);
                      }}
                    />
                    <span className="settings-range-suffix">%</span>
                  </div>
                </div>
                <input
                  type="range"
                  min={floatingOpacityMinPercent}
                  max={floatingOpacityMaxPercent}
                  step={1}
                  value={floatingOpacityPercent}
                  data-tip-text={settingsTip.floatingOpacity}
                  data-tip-placement="right"
                  onChange={(event) => {
                    const parsed = Number(event.target.value);
                    const nextPercent = Number.isFinite(parsed)
                      ? Math.max(floatingOpacityMinPercent, Math.min(floatingOpacityMaxPercent, Math.round(parsed)))
                      : floatingOpacityMaxPercent;
                    setFloatingToggleOpacity(nextPercent / 100);
                  }}
                />
              </div>
              <div className="settings-process-desc">仅作用于悬浮按钮透明度。</div>
            </>
          ) : null}
          <div className="settings-collapse-foot">
            <button
              className={`settings-collapse-row settings-collapse-row-full ${settingsDisplayFoldOpen ? "is-open" : ""}`}
              type="button"
              aria-label={settingsDisplayFoldOpen ? "收起界面与悬浮窗" : "展开界面与悬浮窗"}
              onClick={handleToggleSettingsDisplayFold}
            >
              <span className="settings-collapse-pill">
                <span className="settings-collapse-arrow" />
              </span>
            </button>
          </div>
        </section>

        <section className="settings-section settings-card settings-compact-title-card">
          <div className="settings-addon-meta">
            <div className="settings-title">插件端口配置</div>
            <div className="settings-process-desc">用于连接 Ps 插件通信端口。</div>
          </div>
          <div className="settings-inline-row settings-inline-row-tight settings-bridge-port-inline settings-bridge-port-input-row">
            <input
              className="settings-field settings-bridge-port-field"
              type="number"
              min={BRIDGE_PORT_MIN}
              max={BRIDGE_PORT_MAX}
              value={bridgePortDraft}
              data-tip-text={settingsTip.bridgePort}
              data-tip-placement="right"
              onFocus={() => {
                bridgePortInputFocusedRef.current = true;
              }}
              onBlur={() => {
                bridgePortInputFocusedRef.current = false;
                setBridgePortDraft(String(normalizeBridgePort(bridgePortDraft, bridgePort)));
              }}
              onKeyDown={handleBridgePortDraftKeyDown}
              onChange={(event) => setBridgePortDraft(event.target.value)}
              placeholder={String(DEFAULT_BRIDGE_PORT)}
            />
            <button
              className={`settings-fetch-btn settings-bridge-port-save-btn ${bridgePortDirty ? "is-active" : ""}`}
              type="button"
              data-tip-text="保存端口并重连插件服务"
              data-tip-placement="right"
              onClick={handleApplyBridgePort}
              disabled={!bridgePortAvailable || bridgePortApplying}
            >
              {bridgePortApplying ? "..." : <img className="icon-14" src={iconSaveDisk} alt="save" />}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

export default SettingsView;
