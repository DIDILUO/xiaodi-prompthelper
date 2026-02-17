import React from "react";

function maskSecretPreview(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.length <= 4) return raw;

  let keep = 4;
  if (raw.length <= 12) keep = 3;
  if (raw.length <= 8) keep = 2;

  const middleCount = raw.length - (keep * 2);
  if (middleCount <= 0) return raw;
  return `${raw.slice(0, keep)}${"·".repeat(middleCount)}${raw.slice(-keep)}`;
}

function SettingsApiKeyField({
  labelText,
  buyLinkText,
  siteLabel,
  siteUrl,
  tipText,
  value,
  visible,
  placeholder,
  hintText,
  inputRef,
  onMaskedWheel,
  onChange,
  onToggleVisible,
  iconPreviewOn,
  iconPreviewOff
}) {
  const finalBuyText = String(buyLinkText || `前往 ${siteLabel || "服务商"} 获取密钥`);
  const finalSiteUrl = String(siteUrl || "").trim();
  const hasWebLink = /^https?:\/\//i.test(finalSiteUrl);

  const rawValue = String(value || "");
  const maskedValue = maskSecretPreview(rawValue);
  const displayValue = visible ? rawValue : maskedValue;

  return (
    <>
      <div className="settings-label-row">
        <div className="settings-label">{labelText}</div>
        {hasWebLink ? (
          <a className="settings-link" href={finalSiteUrl} target="_blank" rel="noreferrer">
            {finalBuyText}
          </a>
        ) : (
          <span className="settings-link settings-link-hint">{finalBuyText}</span>
        )}
      </div>

      <div className="settings-inline-row">
        <input
          ref={inputRef}
          className={`settings-field ${visible ? "" : "is-secret-masked"}`}
          type="text"
          value={displayValue}
          data-tip-text={tipText || ""}
          data-tip-placement="right"
          placeholder={placeholder}
          readOnly={!visible}
          onWheel={(event) => {
            if (!visible && typeof onMaskedWheel === "function") onMaskedWheel(event);
          }}
          onChange={(event) => {
            if (visible && typeof onChange === "function") onChange(event.target.value);
          }}
        />
        <button
          className="settings-fetch-btn settings-eye-btn"
          type="button"
          data-tip-text={visible ? "隐藏密钥" : "显示密钥"}
          data-tip-placement="right"
          onClick={onToggleVisible}
        >
          <img
            className="icon-16"
            src={visible ? iconPreviewOn : iconPreviewOff}
            alt={visible ? "hide-key" : "show-key"}
          />
        </button>
      </div>

      {hintText ? <div className="settings-key-hint">{hintText}</div> : null}
    </>
  );
}

export default SettingsApiKeyField;
