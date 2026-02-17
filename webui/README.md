# PromptHelper Bridge WebUI

这个目录是前端 UI（Vite + React）。

## 开发方式（推荐）
在 `prompthelper-bridge` 根目录运行：

```bash
npm run dev
```

会同时启动：
- `server`：本地桥接服务（`127.0.0.1:17325`）
- `webui`：前端构建监听（`vite build --watch`）
- `electron`：桌面外壳窗口

## 单独命令
在本目录可运行：

```bash
npm run build
npm run build:watch
npm run preview
```

## 说明
- Electron 实际加载的是 `webui/dist/index.html`。
- 开发时 UI 修改后会重新构建，Electron 自动重载。
- 若看到 `ERR_CONNECTION_REFUSED`，优先检查 `server` 是否启动。
