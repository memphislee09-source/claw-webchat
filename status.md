# status.md — openclaw-webchat

## 项目概览
- 项目名：openclaw-webchat
- 目标：构建独立于默认 WebUI 的 OpenClaw WebChat 项目，强化历史保留与富媒体体验。
- 当前状态：已完成 Phase 2 前端 MVP，并通过本地自测；下一步进入富媒体上传与设置能力完善

## 本次会话进展
- [x] 创建项目目录
- [x] 创建 `status.md`
- [x] 建立基础文档结构
- [x] 初始化 Git 仓库并完成首个提交
- [x] 创建 GitHub 仓库并推送同步
- [x] 建立 Node/Express 项目脚手架（`package.json`、`src/server.js`、`public/`）
- [x] 建立 `openclaw-webchat` 独立 API 路由与健康检查
- [x] 完成 `agentId -> session` 长期绑定与独立 upstream session key
- [x] 建立自有 JSONL 历史存储（仅保留可展示消息 + marker）
- [x] 支持 `/new` 重置上游上下文并写入本地 marker `已重置上下文`
- [x] 完成首次进入 / `/new` 后隐藏 bootstrap 注入
- [x] 完成 assistant 最终回复抓取与本地媒体块归一化
- [x] 完成本地媒体代理与“文件丢失”兜底
- [x] 完成 Phase 2 前端 MVP：左侧 agent 列表、聊天主区域、输入区、消息渲染、移动端抽屉
- [x] 完成前端历史分页接入（无限上拉游标）
- [x] 新增 `npm run selftest`，覆盖页面骨架、API 打通、发送消息、`/new` 与历史校验
- [x] 按验收反馈调整右侧消息流：最新消息贴近输入框，旧消息向上堆叠
- [x] 对话气泡增加头像：agent 左侧头像、用户右侧头像
- [x] 左下角设置入口已接入“我的显示名 / 我的头像 URL”快速保存
- [x] 左栏 agent 条目调整为“左侧独立头像 + 右侧上下两栏（名字 / 最新消息）”
- [x] 增强 gateway 调用稳定性：增加断连重试与长耗时回复等待窗口
- [x] 实测打通 `baichai` 发图链路，webchat 已可收到图片 block

## 仓库信息
- 本地路径：`/Users/memphis/.openclaw/workspace-mira/openclaw-webchat`
- GitHub：`https://github.com/memphislee09-source/openclaw-webchat`
- 可见性：`private`
- 默认分支：`main`

## 本轮已确认需求
- 独立项目 + 独立端口 + 独立命名空间 `openclaw-webchat`
- 每个 agent 保留一条长期主时间线；`/new` 仅重置上游上下文，并在历史中显示分隔标记
- 历史只保留 `openclaw-webchat` 渠道消息，不混默认 WebUI 和其他渠道
- 支持 assistant 富媒体渲染（图片/音频/视频/文件）
- 富媒体内部协议优先采用结构化 attachment / media block，兼容 `mediaUrl:` / `MEDIA:` fallback
- 支持用户上传图片、音频；音频默认转写后发送，同时保留原始文件引用
- 左侧 agent 列表：头像跨两行 + 名字 + 最后一条摘要 + 活跃状态
- 提供 agent 个性化显示设置（仅影响本项目页面显示）
- 手机端抽屉布局，平板保留左右布局

## 下一步
1. Phase 3：assistant 图片/音频/视频/文件渲染细化与上传能力补齐
2. 用户图片上传与音频上传 + 自动转写
3. 左侧 agent 摘要与活跃状态的细节打磨
4. Phase 4：设置页与 agent 个性化显示（显示名/头像）
5. 更完整的前端交互回归与移动端适配验证
