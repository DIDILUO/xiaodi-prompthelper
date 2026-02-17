# PS 回传对齐规则（当前实现）

## 1. 目标
- 回传图片时，不依赖用户当前是否保留选区。
- 回传后不打断用户操作：如果用户原本有选区，回传完成后恢复该选区。
- 回传对齐基于结构化元数据，不再使用旧兼容字段。

## 2. 使用的元数据
- `targetRect`: 抓图时在原文档内的像素矩形（left/top/width/height）。
- `targetRectNorm`: 归一化矩形（相对原画布 0~1）。
- `targetCanvas`: 抓图时原画布尺寸（width/height）。
- `targetDocumentId`: 目标文档 ID（可选，存在时优先定位该文档）。

## 3. 回传执行顺序
1. 定位目标文档（优先 `targetDocumentId`，否则当前活动文档）。
2. 读取并缓存“当前文档选区快照”（如果存在）。
3. 清空当前选区（仅回传过程）。
4. 导入图片图层（保持源像素，不做预缩放）。
5. 若是智能对象模式，先转智能对象。
6. 依据 `targetRect/targetRectNorm/targetCanvas` 计算本次文档的目标矩形。
7. 对图层执行缩放+移动，完成对齐。
8. 恢复回传前的选区快照（如果有）。

## 4. 对齐计算规则
- 优先使用 `targetRectNorm + targetCanvas` 映射到当前文档尺寸，适配文档尺寸变化。
- 若归一化信息不可用，则使用 `targetRect` 直接对齐。
- 最终矩形会做画布边界裁剪，避免越界。

## 5. 选区处理规则
- 有选区：回传前清空，回传后恢复。
- 无选区：直接回传，不做恢复步骤。
- 恢复失败不影响回传结果，但会记录日志。

## 6. 已废弃字段
以下字段已从链路移除，不再参与解析与透传：
- `selection`
- `targetSelection`

统一只使用：
- `targetRect`
- `targetRectNorm`
- `targetCanvas`
- `targetDocumentId`
