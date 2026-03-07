# 插件链路规范（Starter 版）

## 目标

将 Photoshop UXP 插件作为“取图/回图执行端”，与桌面端 `prompthelper-bridge` 的本地服务解耦通信。

## 服务端（本地 bridge）接口

- `POST /ps/heartbeat`
  - 用途：插件在线状态心跳
- `POST /ps/selection`
  - 用途：上报选区抓图结果
- `POST /ps/canvas`
  - 用途：上报全图抓图结果
- `POST /ps/import`
  - 用途：回传完成上报
- `GET /queue/next`
  - 用途：拉取待执行命令

## 插件侧命令处理

- `reconnect`：立即心跳一次
- `capture-selection` / `ps.capture.selection`
  - 执行抓取选区 -> 上报 `/ps/selection`
- `capture-canvas` / `ps.capture.canvas`
  - 执行抓取全图 -> 上报 `/ps/canvas`
- `import-image` / `ps.import.image` / `ps.import`
  - 执行 dataUrl 回传到当前文档 -> 上报 `/ps/import`

## 图像对象（建议字段）

```json
{
  "dataUrl": "data:image/png;base64,...",
  "mimeType": "image/png",
  "width": 1024,
  "height": 1024,
  "selection": {
    "left": 100,
    "top": 200,
    "right": 1124,
    "bottom": 1224,
    "width": 1024,
    "height": 1024
  },
  "documentId": 123,
  "documentName": "xxx.psd"
}
```

## 与业务端约束

- 本项目不是 ComfyUI 方案，不依赖节点图协议。
- 生成模型链路面向第三方 API（阿吉 API / Grsai / Google）。
- 上传顺序必须可控（主图优先），后续按 `role + 时间 + 来源` 命名策略统一。
