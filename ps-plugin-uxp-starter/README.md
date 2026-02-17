# 小迪 PS 桥接插件（Starter）

此目录是第一版可运行骨架，目标是把 Photoshop 与 `prompthelper-bridge` 本地服务打通，不依赖 ComfyUI。

## 当前能力

- 端口配置（默认 `17325`）
- 自动心跳：`POST /ps/heartbeat`
- 手动抓图并上报：
  - 上传选区：`POST /ps/selection`
  - 上传全图：`POST /ps/canvas`
- 轮询队列：`GET /queue/next`
  - 已实现命令处理：
    - `reconnect`
    - `capture-selection` / `ps.capture.selection`
    - `capture-canvas` / `ps.capture.canvas`
    - `import-image` / `ps.import.image` / `ps.import`
- 回传测试：粘贴 `dataUrl/base64`，贴回当前文档并上报 `POST /ps/import`

## 目录结构

- `manifest.json`：UXP 插件清单
- `index.html`：面板 UI
- `styles.css`：面板样式
- `index.js`：桥接逻辑、抓图逻辑、回传逻辑、队列处理

## 抓图/回传设计来源

- 抓图与回传底层流程参考：`37banana1.7.0压缩包版/index.js`
- UXP 结构与 API 使用方式参考：`adobe-docs-ref/uxp-photoshop-plugin-samples`
- 未采用 ComfyUI 语义：本项目面向第三方生图 API（阿吉 API / Grsai / Google）链路

## 安装与调试（UXP Developer Tool）

1. 打开 UXP Developer Tool
2. `Add Plugin` -> 选择本目录 `prompthelper-bridge/ps-plugin-uxp-starter`
3. 启动 Photoshop，打开插件面板 `小迪桥接`
4. 确保桌面端 bridge 服务已启动（默认 `http://127.0.0.1:17325`）

## 后续待接

- 完整回传策略（选区定位 + 蒙版 + 图层类型）
- 与桌面端 `window.shell.handleUploadSlotToolAction` 的最终协议打通
- 图像压缩参数与命名规范（`role + 时间 + 来源`）一致化
