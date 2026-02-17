# 逆向恢复变量命名说明（CE8k 基线）

## 目标
- 以 `docs/recovery/dist-snapshots/20260217-054954/pre-repair-backup_webui-dist/assets/index-CE8kT8gA.js` 为功能基线。
- 在无 source map 的情况下，优先恢复可维护性与功能联动，而非强求原始短变量名。

## 命名策略
- 保持与现有源码语义一致，优先沿用备份文件中的命名风格。
- 对 `dist` 中无法可靠反推的短变量名，按“行为含义”重命名。
- 组件对外 props 与导出函数名保持稳定，避免打断现有调用链。

## 已采用的语义命名（重点文件）
1. `webui/src/components/ConsolePanel.jsx`
- `getLogMessageClass`: 根据日志状态/级别/文案判断展示样式。
- `miniStatusTip`: 微型状态提示文案，保持与主界面交互一致。
- `filteredLogs`: 渲染后的日志集合，保持与 `App.jsx` 传参联动。

2. `webui/src/components/SettingsApiKeyField.jsx`
- `maskSecretPreview`: API Key 隐藏态显示规则（前后保留，中间掩码）。
- `finalBuyText` / `finalSiteUrl`: 购买链接与站点地址的最终展示值。
- `displayValue`: 根据 `visible` 切换明文/掩码显示。

3. `webui/src/components/TopbarApiStatusGroup.jsx`
- `handleStatusClick`: 顶栏 API 状态按钮统一点击分发器。
- `chatStatusClass` / `imageStatusClass`: 聊天与跑图 API 状态样式。

## 无法 100% 还原项
- `CE8k` 压缩产物中的内部临时变量（例如 `g/v/w` 级别短名）无法可靠回溯到原名。
- 这类变量已按功能命名，不影响运行逻辑与模块联动。

## 验收原则
- 构建可通过。
- `App.jsx` 到三个逆向组件的 props 链路完整。
- API Key 显隐、顶部状态按钮、控制台渲染与导出入口行为正常。
