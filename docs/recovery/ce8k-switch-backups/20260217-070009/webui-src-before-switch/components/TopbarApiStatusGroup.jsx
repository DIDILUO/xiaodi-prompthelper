import React from "react";

function TopbarApiStatusGroup({
  chatStatusClass,
  chatTipText,
  imageStatusClass,
  imageTipText,
  onStatusClick,
  chatIcon,
  imageIcon
}) {
  const handleStatusClick = (type) => {
    if (typeof onStatusClick === "function") onStatusClick(type);
  };

  return (
    <div className="topbar-api-status-group">
      <button
        type="button"
        className={`topbar-api-status-btn ${chatStatusClass}`}
        data-tip-text={chatTipText}
        data-tip-placement="bottom"
        onClick={() => handleStatusClick("chat")}
        aria-label="chat-api-status"
      >
        <img src={chatIcon} alt="chat-api" />
      </button>
      <button
        type="button"
        className={`topbar-api-status-btn ${imageStatusClass}`}
        data-tip-text={imageTipText}
        data-tip-placement="bottom"
        onClick={() => handleStatusClick("image")}
        aria-label="image-api-status"
      >
        <img src={imageIcon} alt="image-api" />
      </button>
    </div>
  );
}

export default TopbarApiStatusGroup;
