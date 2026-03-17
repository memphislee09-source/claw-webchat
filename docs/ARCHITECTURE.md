# Architecture Draft — openclaw-webchat

## 1. 总体策略
采用 **独立 Web 应用 + 独立轻后端适配层** 架构：
- 前端借鉴 OpenClaw 官方前端的布局与视觉风格；
- 历史与富媒体链路借鉴 `openclaw-agent-chat-ui` 的成熟实现；
- 与 OpenClaw 的耦合控制在“网关接口适配层”，降低升级风险。

## 2. 核心架构原则
1. **独立命名空间**：使用 `openclaw-webchat` 专属会话命名空间。
2. **独立历史存储**：仅保存可展示消息，不依赖 OpenClaw 原始内部日志结构做直接渲染。
3. **适配层隔离**：所有与 OpenClaw 的 `sessions.* / chat.* / models.*` 交互集中到服务端适配层。
4. **媒体双兼容**：同时兼容现有协议式媒体输出与未来结构化媒体输出。
5. **响应式布局**：桌面/平板/手机三档适配。

## 3. 模块划分
### 前端
- `layout`
  - 左侧 agent 列表
  - 聊天主区域
  - 移动端抽屉
- `agent-list`
  - agent 条目渲染
  - 活跃状态
  - 最后一条摘要
- `chat`
  - 消息列表
  - 无限上拉
  - `/new` 分隔线
  - 文本流式渲染
- `media`
  - 图片/音频/视频/文件消息渲染
  - 失效媒体兜底
- `composer`
  - 文本输入
  - 图片上传
  - 音频上传
  - slash 命令
- `settings`
  - agent 个性化显示设置
  - 全局设置入口（预留扩展）

### 服务端适配层
- `agents service`
  - 获取 agent 列表
  - 聚合 agent 活跃状态与最近消息摘要
- `session binding service`
  - `agentId -> webchat session` 映射
  - 首次点击自动创建
- `history service`
  - 自有 JSONL 历史存储
  - cursor 分页
  - `/new` 标记写入
- `message orchestration service`
  - 发送用户文本/图片/音频
  - 等待 assistant 最终回复
  - 屏蔽工具过程
- `media service`
  - 媒体链接规范化
  - 本地文件代理与安全校验
  - 媒体失效兜底
- `profile settings service`
  - agent 显示名/头像持久化
  - 跨设备一致
- `transcription service`
  - 音频转写
  - 失败降级为“仍发送原始音频 + 转写失败提示”

## 4. 数据模型（草案）
### AgentProfile
- `agentId`
- `displayName?`
- `avatarUrl?`
- `updatedAt`

### UserProfile
- `displayName`
- `avatarUrl?`
- `updatedAt`

### SessionBinding
- `agentId`
- `sessionKey`（本地展示会话）
- `upstreamSessionKey`（OpenClaw 上游会话）
- `namespace = openclaw-webchat`
- `createdAt`
- `updatedAt`

### HistoryMessage
- `id`
- `agentId`
- `sessionKey`
- `role`
- `createdAt`
- `kind`（text | image | audio | video | file | marker）
- `text?`
- `media[]?`
- `markerType?`（如 `context-reset`）

## 5. 接口边界
### 对 OpenClaw 的依赖
- `sessions.list`
- `sessions.reset`
- `sessions.patch`
- `models.list`
- `chat.send`
- `chat.history`（仅用于抓取最终 assistant 可展示回复，不直接作为历史主存储）

### 自有接口（草案）
- `GET /api/openclaw-webchat/agents`
- `POST /api/openclaw-webchat/agents/:agentId/open`
- `GET /api/openclaw-webchat/agents/:agentId/history`
- `POST /api/openclaw-webchat/sessions/:sessionKey/send`
- `POST /api/openclaw-webchat/sessions/:sessionKey/command`
- `POST /api/openclaw-webchat/uploads`
- `GET /api/openclaw-webchat/media`
- `GET /api/openclaw-webchat/settings`
- `PATCH /api/openclaw-webchat/agents/:agentId/profile`

## 6. 升级兼容策略
- 不直接复用 OpenClaw 官方前端内部控制器/状态树。
- 仅借鉴视觉结构、布局关系和交互体验。
- 网关依赖集中在单独模块中，便于 OpenClaw 升级后统一修补。
- 历史渲染基于自有存储格式，避免被上游 JSONL 变更拖垮。
- 将 `openclaw-webchat` 视为“类一等渠道”：通过隐藏 bootstrap 建立渠道契约，而不是依赖用户每次提醒 agent 富媒体发送规则。

## 7. 质量基线
- 当前实现以 Node.js + 原生 ESM JavaScript 为主；如后续引入 TypeScript，再单列迁移计划。
- 关键链路测试：
  - 会话隔离
  - `/new` 分隔与历史保留
  - 无限上拉分页
  - 富媒体渲染
  - 媒体失效兜底
  - 移动端布局
