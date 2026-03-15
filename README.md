# openclaw-webchat

OpenClaw WebChat 项目仓库。

## 项目目标
构建可扩展、可维护的 WebChat 客户端，为 OpenClaw 提供稳定的对话交互体验。

## 当前阶段
- 阶段：Phase 1 已完成（服务端最小闭环）
- 当前重点：前端 MVP（agent 列表、聊天主区、无限上拉、移动端抽屉）

## 本地运行
```bash
npm install
npm start
# 默认监听 http://localhost:3770
```

## 当前已完成能力
- 独立命名空间与 API：`/api/openclaw-webchat/*`
- `agentId -> session` 绑定
- 自有 JSONL 历史存储
- `/new` 上游重置 + 本地 marker 保留
- 隐藏 bootstrap 注入
- assistant 最终回复提取
- 结构化媒体块 + `MEDIA:` / `mediaUrl:` fallback 解析
- 本地媒体代理与“文件丢失”兜底

## 仓库结构
- `status.md`：项目状态与里程碑（开工前先读）
- `docs/PROJECT_CHARTER.md`：项目章程（范围/目标/边界）
- `docs/ARCHITECTURE.md`：架构草案
- `docs/ROADMAP.md`：里程碑与迭代节奏
- `docs/error.md`：错误与修复记录

## 协作约定
1. 所有变更先更新相关文档，再提交代码。
2. 每次提交保持可回滚、可追踪。
3. 本地与 GitHub 保持同步（提交后立即 push）。

