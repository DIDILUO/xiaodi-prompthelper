# 控制台日志规格与优化方案（v5）

更新时间：2026-02-17  
适用范围：`webui` 大控制台与微型控制台、`electron/main.js` 导出链路、`server/index.js` 插件日志通道

## 1. 本版目标

1. 文档严格对齐当前运行代码，避免“文档与实现漂移”。
2. 以“功能性事件”为日志主体，不记录纯面板交互。
3. 统一“快任务/慢任务”输出规则，兼顾可读性与排障效率。

## 2. 当前真实实现入口

### 2.1 渲染层日志（权威入口）

来源文件：`webui/src/ce8k/index-CE8kT8gA.js`

1. `Z(level, message, type, extra)`：基础日志写入。
2. `Ot({ level, type, domain, phase, message, startedAt, endedAt, requestId, guide })`：结构化轨迹日志。
3. `__phLogFunctionalEvent(domain, phase, message, cooldownMs)`：功能性日志节流写入。

日志结构（当前）：

```ts
type ConsoleViewLog = {
  id: string;
  ts: string; // HH:mm:ss
  level: "info" | "warn" | "error";
  type: "system" | "api" | "bridge" | "dev";
  typeLabel: "系统" | "API" | "桥接" | "开发";
  message: string;
  state?: "info" | "running" | "success" | "warn" | "error";
};
```

约束：

1. 渲染层日志最多 200 条，超出即丢弃最旧。
2. 微型控制台状态词仍限制短文本展示。
3. Bridge 状态日志仅在“状态变化”时写入。

### 2.2 Bridge 服务日志通道

来源文件：`server/index.js`

1. `POST /ps/log` 插件主动上报。
2. `GET /ps/logs?since=...` 前端增量拉取。
3. `GET /status` 附带 `psPluginLogLatestId`。

已落地防护：

1. `level` 归一化（`warning -> warn`，异常值回落 `info`）。
2. `message/detail/scene/source` 长度裁剪，避免污染 UI 与导出。

### 2.3 主进程导出链路

来源文件：`electron/main.js`

1. 主进程日志统一写入。
2. `shell:export-logs` 导出渲染层、主进程、开发期 stdout/stderr 节选。

## 3. 日志边界（本版关键）

### 3.1 明确不记录

纯面板交互，不作为业务日志：

1. 折叠/展开面板
2. hover、仅视觉切换
3. 不改变业务数据的短暂 UI 态

### 3.2 必须记录（功能性）

1. 配置更新与保存（聊天/跑图配置、服务商配置）
2. 身份设定（身份预设）保存
3. 会话读写关键链路（加载结果、保存失败、保存成功）
4. 两类预设（对话预设、指令预设）保存

## 4. 快慢任务规则（已改为语义判定）

当前策略不再依赖“2 秒延迟触发”判断快慢。

1. 慢任务域：`聊天请求 | 跑图请求 | 回传画布`
2. 快任务/状态域：`插件连接 | 插件日志 | 回传测试 | 取图桥接 | 图片处理 | 聊天 API | 跑图 API`
3. 状态类 phase：`状态变更 | 配置校验失败`

输出规则：

1. 慢任务：输出 `任务开始` + `任务结束`
2. 快任务与状态类：只输出结果日志

## 5. 去刷屏策略

### 5.1 已启用

1. 渲染层总量上限 200 条。
2. Bridge 状态变更去重。
3. 功能性日志节流：`__phFunctionalLogGuard`（按 `domain|phase|message` 限流）。
4. 开发日志导出仅保留尾部窗口，并清理 ANSI 转义。

### 5.2 暂未启用

1. 按 `requestId` 分组导出。
2. 同 fingerprint 多次重复折叠计数显示。

## 6. 当前覆盖清单（v5）

### 6.1 已覆盖

1. 配置保存：聊天/跑图配置、聊天服务商、跑图服务商
2. 身份设定保存：身份预设数量变更
3. 预设保存：对话预设、指令预设数量变更
4. 会话链路：读取成功/失败、保存失败、保存成功

### 6.2 仍可扩展（非必需）

1. 会话新增/重命名/删除/导入/导出动作级日志
2. 预设导入/导出动作级日志

## 7. 导出规范（当前实现）

单文件导出内容：

1. 渲染层日志（`consoleLogs`）
2. 主进程日志尾部
3. 开发日志节选（stdout/stderr 分节）

导出头部信息：

1. 导出时间
2. 应用版本
3. 渲染日志条数
4. 开发日志节数

## 8. 验收清单（v5）

1. 不记录纯 UI 交互日志。
2. 功能性四类（配置/身份/会话/双预设）均可在控制台检索到。
3. 慢任务具备开始/结束双日志，快任务仅结果。
4. 构建与运行不受日志策略调整影响。