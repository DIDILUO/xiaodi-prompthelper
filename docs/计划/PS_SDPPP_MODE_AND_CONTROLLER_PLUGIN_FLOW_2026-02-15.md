# PS 抓图链路文档（sdppp 方式 vs 当前主控+插件执行）

更新时间：2026-02-15  
适用范围：`prompthelper-bridge` 当前代码基线

## 1. 目标

本文档先澄清两件事：

1. `sdppp` 的稳定抓图/回传思路到底是什么。  
2. 我们当前“桌面主控 + PS 插件执行”链路实际怎么跑（按真实生效代码）。

并给出后续统一方案，供下一步改造时作为单一依据。

---

## 2. sdppp 方式（参考实现）

参考源码：

- `_repo_inspect/sd-ppp-monorepo/capabilities/resourcing/src/ps-adapter/tools/get-image.ts`
- `_repo_inspect/sd-ppp-monorepo/capabilities/resourcing/README.md`

### 2.1 核心抓图路径

sdppp 不是直接依赖 `imaging.encodeImageData(...) -> base64` 作为主链路，而是：

1. `imaging.getPixels(...)` 取像素  
2. `imageData.getData(...)` 取原始 RGBA  
3. 像素修正/裁剪/补边/透明处理  
4. 用 Jimp 构建图像并输出二进制  
5. 最终输出 `jpegData + alphaData`（颜色与透明通道分离）

这个链路的关键是：数据面以像素/二进制为主，不以内联 base64 编码 API 成败作为唯一成功条件。

### 2.2 资源与通信思路

sdppp 通过资源层抽象（`uxp://file/...`, `uxp://boundary/...`）组织输入输出，强调：

- 内容对象化（resource handle）
- 边界对象化（boundary uri）
- 数据与控制分离（命令和资源分离）

---

## 3. 我们当前真实生效链路（主控+插件执行）

注意：桌面进程实际启动的是 `prompthelper-bridge/server/index.js`，不是 `electron/server/index.js`。

### 3.1 组件职责

- 桌面主控（Electron 主进程）  
  文件：`prompthelper-bridge/electron/main.js`  
  职责：发命令、等结果、拼装返回给 WebUI、触发导入回传。

- 桥接服务（本地 HTTP）  
  文件：`prompthelper-bridge/server/index.js`  
  职责：队列、结果、心跳、插件日志、聊天/设置接口。

- PS 插件执行端（UXP）  
  文件：`prompthelper-bridge/ps-plugin-uxp-starter/index.js`  
  职责：轮询命令、抓图、回传图片、上报日志与心跳。

### 3.2 当前抓图执行流程（实际）

1. WebUI 触发上传槽位工具动作  
2. `electron/main.js` -> `shell:handle-upload-slot-tool-action`  
3. 主进程向桥接服务入队：`capture-selection` 或 `capture-canvas`  
4. 插件轮询 `/queue/next` 取命令  
5. 插件调用：
   - `captureSelectionData()` 或
   - `captureCanvasData()`
6. 插件内部抓图目前走：
   - `imaging.getPixels(...)`
   - `encodeImageDataToDataUrl(...)`（依赖 `imaging.encodeImageData`）
7. 插件上报 `/ps/selection` 或 `/ps/canvas`，携带 `image.dataUrl`
8. 主进程轮询 `/queue/result/:id`，拿 payload，回给 WebUI

相关接口（生效服务）：

- `GET /queue/next`
- `GET /queue/result/:id`
- `POST /ps/selection`
- `POST /ps/canvas`
- `POST /ps/import`
- `POST /ps/heartbeat`
- `POST /ps/log`
- `GET /ps/logs`

### 3.3 当前回传执行流程（实际）

1. 主进程入队 `import-image`
2. 插件取队列后执行 `importDataUrlToCurrentDocument(...)`
3. 插件将结果上报 `POST /ps/import`
4. 主进程轮询结果并返回 WebUI

### 3.4 当前实现中的关键事实

1. `electron/main.js` 已支持“优先读取 comm 文件”的逻辑（`readCaptureFromCommFile` / `resolveCaptureFromBridgeResult`）。  
2. 但当前生效的 `server/index.js` 在 `/ps/selection`、`/ps/canvas` 并未写 comm 文件，仍是直接回传 payload。  
3. 所以当前线上链路本质仍是“插件内联 dataUrl 上报”。

---

## 4. 当前问题为何出现

现象：抓图时报 `encodeImageData returned empty png payload` 或此前的 alpha/jpeg 编码错误。

本质：

- 不是队列不通，也不是心跳不通。  
- 是插件抓图的数据面过度依赖 `imaging.encodeImageData(...)` 的返回格式与稳定性。  
- 抓图失败后又被上层日志归并成“桥接问题”，体感像“连了又断”。

---

## 5. 对齐 sdppp 的统一方案（主控不变，执行端改数据面）

目标：保留“桌面主控 + 插件执行”的架构，不改职责边界，只替换抓图数据通道。

### 5.1 统一原则

1. 控制面：继续走队列命令（现有 `/queue` 体系）  
2. 数据面：从“内联 dataUrl”改为“二进制文件 + 通讯元数据”  
3. 日志面：抓图错误只归类为抓图错误，不再冒充桥接断连

### 5.2 建议数据通道

方案 A（推荐，最贴近你要求）：

- 插件抓图后写临时文件（PNG/JPEG）  
- 插件写一份 comm JSON（包含文档 ID、选区、文件路径、尺寸、时间、命令 ID）  
- 插件只上报 comm 路径/ID 到桥接  
- 主控按 comm 读取文件，再转 WebUI 需要的 URL/base64

方案 B（过渡）：

- 插件直接上报二进制 chunk 或短时文件句柄  
- 桥接服务落地缓存并回传统一 comm 路径  
- 主控只认 comm 路径

### 5.3 选区映射要求（后续必须）

每张图要绑定：

- `documentId`
- `documentName`
- `selection`（left/top/right/bottom）
- `captureMode`（selection/canvas）
- `slotIndex`、`role`

回传时按这些字段恢复目标文档和目标位置。

---

## 6. 建议落地顺序

P1（先稳定）：

1. 抓图错误和桥接错误分层  
2. 保持现有命令协议不变，先加 comm 文件通道  
3. 主控优先 comm，失败再回退 dataUrl（短期兼容）

P2（切换主通道）：

1. 插件抓图主路径改为像素原始数据 -> 本地文件  
2. dataUrl 仅作为兼容兜底，不再主用

P3（完成对齐）：

1. 选区/文档映射完整闭环  
2. 回传策略（智能对象/栅格化）与映射字段联动  
3. 清理旧内联编码路径与重复日志分支

---

## 7. 结论

`sdppp` 稳定点不在“它更会连网”，而在“它的数据面不是内联编码单点依赖”。  
我们当前架构已经具备主控+执行分层和队列体系，下一步只需把抓图数据通道切到 sdppp 风格，即可解决目前这类空 payload/编码抖动问题。

