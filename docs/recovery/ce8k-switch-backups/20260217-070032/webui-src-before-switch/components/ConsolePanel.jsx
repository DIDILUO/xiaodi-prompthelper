import React from "react";

function getLogMessageClass(logLine) {
  const state = String(logLine?.state || "").toLowerCase();
  if (state === "error") return "log-msg-error";
  if (state === "warn") return "log-msg-warn";

  const level = String(logLine?.level || "").toLowerCase();
  if (level === "error") return "log-msg-error";
  if (level === "warn") return "log-msg-warn";

  const message = String(logLine?.message || "");
  if (/失败|错误|异常|超时|不可用|中断/i.test(message)) return "log-msg-error";
  return "log-msg-info";
}

function ConsolePanel({
  footerRef,
  onFooterMouseEnter,
  consoleFilterRef,
  logFilterOpen,
  onToggleLogFilter,
  handleExportLogs,
  toggleConsole,
  statusIcon,
  miniStatus,
  miniStatusLevelClass,
  miniStatusTip,
  consoleOpen,
  consoleOpening,
  consoleRef,
  filteredLogs,
  iconLogFilter,
  iconConsole
}) {
  return (
    <footer
      className="panel-footer console-footer"
      ref={footerRef}
      onMouseEnter={(event) => {
        if (typeof onFooterMouseEnter === "function") onFooterMouseEnter(event);
      }}
    >
      <div className="console-header-row">
        <div className="console-title">控制台</div>
        <div className="console-header-right">
          <div className="console-filter-dropdown" ref={consoleFilterRef}>
            <button
              className={`console-pill console-pill-filter ${logFilterOpen ? "is-open" : ""}`}
              onClick={onToggleLogFilter}
              data-tip-text="日志类型筛选"
              type="button"
            >
              <img className="icon-16" src={iconLogFilter} alt="log-filter" />
            </button>
          </div>

          <button
            className="console-icon-btn"
            onClick={handleExportLogs}
            data-tip-text="导出日志"
            type="button"
          >
            <img className="icon-16" src={iconConsole} alt="export-logs" />
          </button>

          <button
            className="console-pill console-pill-right"
            onClick={toggleConsole}
            data-tip-text={miniStatusTip || "微型控制台：点击查看详细日志"}
            type="button"
          >
            <img className="icon-16" src={statusIcon} alt="console" />
            <span className={`console-pill-text ${miniStatusLevelClass || "is-warn"}`}>{miniStatus}</span>
          </button>
        </div>
      </div>

      <section
        className={`console-full ${consoleOpen ? "is-open" : "is-collapsed"} ${consoleOpening ? "is-opening" : ""}`}
        ref={consoleRef}
        aria-hidden={!consoleOpen}
      >
        <div className="log-box">
          {filteredLogs.length === 0 ? (
            <div className="log-empty">暂无日志</div>
          ) : (
            filteredLogs.map((line) => (
              <div className={`log-line log-${line.level}`} key={line.id}>
                <span className="log-ts">[{line.ts}]</span>{" "}
                <span className={`log-type log-type-${line.type}`}>[{line.typeLabel || line.type}]</span>{" "}
                <span className={`log-msg ${getLogMessageClass(line)}`}>{line.message}</span>
              </div>
            ))
          )}
        </div>
      </section>
    </footer>
  );
}

export default ConsolePanel;
