# 小迪 PS 桥接插件（Starter）

此目录是 Photoshop UXP 插件端，负责和本地 `prompthelper-bridge` 服务通信，执行抓图与回传。

## 当前状态（已按代码对齐）

- 插件版本：`0.1.1`（`manifest.json`）
- 宿主兼容：Photoshop 正式版 / Photoshop (Beta)（`manifest.host.app = "PS"`）
- 桥接协议：`bridgeProtocolVersion = 2`
- 默认端口：`17325`
- 自动心跳间隔：`1600ms`
- 队列长轮询窗口：`25000ms`
- 当前面板以“端口配置 + 插件日志”为主，核心工作模式是后台心跳 + 队列驱动
- 不依赖 ComfyUI 协议

## 对接接口（插件 -> 本地 bridge）

- `POST /ps/heartbeat`：插件在线心跳
- `POST /ps/log`：插件日志上报
- `GET /queue/next?waitMs=...`：拉取待执行命令
- `POST /queue/result`：回传队列命令执行结果（v2 主链路）
- `POST /ps/selection`：上报选区抓图（兼容链路）
- `POST /ps/canvas`：上报全图抓图（兼容链路）
- `POST /ps/import`：上报手动回传结果

## 已支持命令

- `reconnect`
- `capture-selection` / `ps.capture.selection`
- `capture-canvas` / `ps.capture.canvas`
- `import-image` / `ps.import.image` / `ps.import`

## 队列命令参数（常用）

- 抓图命令可带 `payload.captureOptions`
  - `format`: `jpg | png`
  - `quality`: `0.01 ~ 1`
  - `maxSide`: `> 0` 时按最长边限制缩放
- 回传命令可带：
  - `dataUrl`
  - `targetRect` / `targetRectNorm` / `targetCanvas`
  - `targetDocumentId` / `targetDocumentName`
  - `layerType`: `smart-object | rasterized`

## 结果结构要点（与旧版差异）

- 抓图结果默认回传 `image.filePath`（临时文件路径），不是内联 `dataUrl`
- 抓图结果包含 `captureMeta`（输出格式、质量、尺寸、色彩信息等）
- 回传命令会在 `/queue/result` 写入成功/失败结果（包括 `target_document_required` 等错误）

## 安装与调试（UXP Developer Tool）

1. 打开 UXP Developer Tool
2. `Add Plugin`，选择目录：`prompthelper-bridge-recovered/ps-plugin-uxp-starter`
3. 启动 Photoshop，打开面板：`小迪桥接`
4. 确保桌面端 bridge 已启动（默认 `http://127.0.0.1:17325`）

## 常见问题

- `Permission denied to the url ... Manifest entry not found`
  - 检查 `manifest.json -> requiredPermissions.network.domains`
- `target_document_required`
  - 多文档场景下未指定 `targetDocumentId`
- `no_selection`
  - 执行选区抓图时当前无有效选区
- 连接失败
  - 检查本地 bridge 是否运行、端口是否一致

## 目录结构

- `manifest.json`：UXP 插件清单与权限声明
- `index.html`：插件面板
- `styles.css`：面板样式
- `index.js`：桥接通信、抓图、回传、队列处理
- `assets/`、`icons/`：面板与插件图标资源
