# status.md — openclaw-webchat

## 项目概览
- 项目名：openclaw-webchat
- 目标：构建独立于默认 WebUI 的 OpenClaw WebChat 项目，强化历史保留与富媒体体验。
- 当前状态：已完成 Phase 1 服务端最小闭环，下一步进入前端 MVP

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
1. 输出最终技术实施方案
2. 确定项目脚手架与模块边界
3. 开始第一阶段实现（服务端最小闭环）
�最小闭环）
拉历史与消息列表渲染
3. 左侧摘要与活跃状态联动
4. 用户图片/音频上传链路
5. 设置页与 agent 个性化显示
