# Group Chat Docs

## 目的
本目录专门存放 `openclaw-webchat` 群聊功能的专题文档。

以后继续开发群聊时，默认先读本目录，而不是只依赖主线交接文档。

## 建议读取顺序
1. 先读本文件
2. 再读 `REQUIREMENTS.md`
3. 最后读 `PROGRESS.md`
4. 如需补全项目背景，再回到仓库根部的 `status.md`、`docs/ARCHITECTURE.md`、`docs/ROADMAP.md`

## 文档清单
- `HANDOFF-2026-03-19.md`
  记录群聊分支暂停时的交接摘要，以及切回主线后的建议动作。
- `REQUIREMENTS.md`
  记录当前已确认的群聊产品需求、交互规则和实现边界。
- `PROGRESS.md`
  记录当前群聊分支的开发进度、已实现能力、验证结果和后续缺口。

## 维护约定
- 后续所有群聊相关的需求确认、阶段交接、回归记录，优先补充到本目录。
- 如果群聊需求有重大变更，先更新 `REQUIREMENTS.md`，再继续改代码。
- 如果群聊阶段状态有明显推进，更新 `PROGRESS.md`，避免后续重新拼上下文。
