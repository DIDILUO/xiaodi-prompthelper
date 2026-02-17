# PS 插件桥接功能规格（预研版）

## 1. 目标
- 为「从 Photoshop 获取选区/全图」和「把生成图回传 Photoshop」建立稳定桥接链路。
- 增加**短时本地缓存**，避免重复抓图、提高失败重试成功率。
- 与当前 `prompthelper-bridge` 前端上传区和会话逻辑兼容，不破坏现有功能。
- 生成后端按「阿吉 API / 同类第三方生图 API」适配，不绑定 ComfyUI。

## 2. 参考实现调研摘要

### 2.1 37banana（UXP 插件）
- 选区抓取主链路：
  - 复制当前文档到临时文档，展平后裁剪选区。
  - 可选抗截断处理（色相翻转/垂直翻转）。
  - 超过上限边长时按比例缩小（`g_maxResolution`）。
  - 保存临时 PNG，再读二进制转 base64 返回。
  - 参考：`D:\二二二次元\小迪助词器\37banana1.7.0压缩包版\index.js:1032`
- 回传链路：
  - 将返回 base64 落到临时 PNG，打开临时文档。
  - 按原选区宽高 resize，复制图层到目标文档。
  - 按选区 left/top 定位图层，必要时打组和加蒙版。
  - 参考：`D:\二二二次元\小迪助词器\37banana1.7.0压缩包版\index.js:1278`

### 2.2 阿吉 API / 第三方生图 API（目标对接形态）
- 桌面端 -> 第三方 API（提交任务）：
  - 输入以业务字段为主：`prompt`、`negativePrompt`、`size`、`ratio`、`count`、`images[]`。
  - `images[]` 按上传顺序发送，主图优先；图片名保留 `role + 时间 + 来源` 语义。
  - UI 显示值与 API 枚举值分离：例如 UI 的 `2048px` 需映射为 API 可识别的 `2k`（区分大小写）。
- 第三方 API -> 桌面端（任务状态）：
  - 提交后先返回 `taskId/jobId`，再通过轮询或回调获取进度与结果。
  - 结果可为 `url` 或 `base64`；统一转换为前端/回传链路可消费的数据结构。
- 桌面端 -> PS（回传结果）：
  - 继续沿用本规格的选区定位、图层贴回、蒙版策略，不依赖 ComfyUI 节点语义。
- 失败与重试：
  - 优先复用 `psCacheId` 和本地图片缓存，避免重复抓取 PS 画布。
  - 第三方 API 超时/失败时保留任务上下文，允许手动重试和切换服务商。

## 3. 本项目预留实现（已落地）

### 3.1 主进程短时缓存（Electron）
- 新增 IPC：
  - `shell:ps-cache-put`
  - `shell:ps-cache-get`
  - `shell:ps-cache-list`
  - `shell:ps-cache-clear`
- 存储位置：
  - `${app.getPath('userData')}/ps-image-cache`
- 默认策略：
  - 默认 TTL：`2 分钟`
  - 最短 TTL：`15 秒`
  - 最长 TTL：`10 分钟`
  - 最多缓存条目：`24`
  - 超限按 `cachedAt` 淘汰最旧条目
- 生命周期：
  - 启动时清理过期文件
  - 退出时清空缓存目录

### 3.2 前端接入（WebUI）
- 当上传区触发「选区/全图」桥接拿到图片后：
  - 先按现有设置压缩（上传尺寸/质量）
  - 再调用 `window.shell.psCachePut(...)` 写入缓存
  - 写回 `psCacheId`、`psCacheExpiresAt` 到图片对象
- 会话消息中的 `images[]` 已保留这两个字段，后续插件桥接可直接复用。

## 4. 建议的桥接接口约定（供插件开发）

### 4.1 PS -> 桌面端（获取图）
- 建议接口名：`handleUploadSlotToolAction`
- 输入：
  - `action`: `"select" | "full"`
  - `slotIndex`: number
  - `image`: 当前槽位图（可空）
- 输出：
  - `files: Array<{ name, type, dataUrl, source?, role?, capturedAt? }>`

### 4.2 桌面端 -> PS（回传图）
- 建议最小能力：
  - 按 `targetSelection` 定位
  - 支持「新图层贴回」和「智能对象贴回」两种模式
  - 支持一次回传多张（用于批处理）

### 4.3 缓存对象结构
- `cacheId`: string
- `cachedAt`: number(ms)
- `expiresAt`: number(ms)
- `name/originName/type/source/role/slotIndex`
- `dataUrl` 仅在 `ps-cache-get` 返回

## 5. 推荐业务时序

1. 用户点「选区/全图」  
2. PS 插件抓图并返回 base64  
3. 桌面端压缩 -> 写入短时缓存 -> 展示在上传区  
4. 用户发送请求时按顺序组装图片（主图优先）  
5. 生成完成后，按目标槽位/选区信息回传 PS  
6. 失败重试优先走 `psCacheId`（避免重复抓图）

## 6. 异常与回退策略
- PS 未连接：前端提示“桥接接口未就绪”，不中断其他功能。
- 抓图失败：保留当前槽位内容，不覆盖已有图。
- 缓存失效：`ps-cache-get` 返回 `expired/not_found` 时，重新抓图。
- 回传失败：保留生成结果在会话中，允许手动重试回传。

## 7. 下一步开发清单
- 实现真实 `window.shell.handleUploadSlotToolAction`（当前仅前端调用位预留）。
- 定义 PS 端回传协议（含图层命名、位置、蒙版策略）。
- 增加缓存命中率日志与统计（命中/过期/淘汰）。
- 加一个调试面板入口用于查看 `ps-cache-list`（开发模式）。
