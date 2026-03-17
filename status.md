# status.md — openclaw-webchat

## 读取顺序
1. 先读本文件
2. 再读 `docs/HANDOFF-2026-03-17.md`
3. 需要补背景时再读 `docs/ARCHITECTURE.md`、`docs/ROADMAP.md`、`docs/error.md`

## 项目概览
- 项目名：`openclaw-webchat`
- 当前版本：`0.1.2`（manifest: `0.1.2`）
- 当前主线：`main`
- 仓库地址：`https://github.com/memphislee09-source/openclaw-webchat`
- 项目目标：构建独立于默认 WebUI 的 OpenClaw WebChat，强化历史保留、富媒体体验和多会话稳定性

## 当前基线
- `0.1.2` 已合入 `main`，后续统一以主线为开发基点
- 当前运行方式支持用户级 LaunchAgent `ai.openclaw.webchat` 常驻拉起
- 当前主线已包含：
  - slash 命令按钮、本地命令菜单与本地执行语义
  - 跨 agent 会话隔离与迟到回包防串
  - Markdown 图片解析与图文混排顺序修复
  - 视觉媒体等宽气泡方案，以及“长正文图文混排回退常规宽气泡”保护
  - 首屏历史 `15` 条的移动端实验参数
  - 头像持久化修复：保存稳定源路径，读取时动态签发媒体地址
  - 设置页偏好分区支持 1 套深色 + 4 套浅色主题预设切换，并在当前浏览器持久化主题偏好；当前默认浅色方案为 `Dawn Peach`
  - 对话气泡阴影已单独收紧，浅色主题只保留轻微层次，减少“气泡漂浮”分散感

## 已完成能力
- 独立命名空间与 API：`/api/openclaw-webchat/*`
- `agentId -> session` 长期绑定
- 自有 JSONL 历史存储，仅保留可展示消息
- `/new` 仅重置上游上下文，本地历史保留并写入 `已重置上下文`
- assistant 最终回复提取，不展示工具过程
- assistant 富媒体渲染：图片、音频、视频、文件
- 用户图片上传、音频上传、默认本地 Whisper 转写
- 统一 `+` 上传入口
- 图片查看器：全屏、缩放、平移
- 视频原生播放器展示
- Markdown 渲染与图文交错顺序保持
- 左侧 agent 列表、主聊天区、移动端抽屉布局
- 消息贴底显示、新消息自动滚到最新位置
- 左右栏独立滚动
- 设置面板：统一联系人管理、显示名/头像编辑、头像本地裁剪上传
- 偏好设置：1 套深色 + 4 套浅色主题预设切换与浏览器本地持久化，当前默认浅色方案为 `Dawn Peach`
- 对话气泡阴影分层：消息气泡使用更轻的专用阴影，不复用全站大阴影
- agent / 用户头像持久化防过期
- gateway 断连重试与长耗时回复等待增强

## 关键文件
- `src/server.js`：服务端适配层、历史存储、媒体代理、设置接口、slash 命令
- `public/app.js`：前端状态、消息渲染、分页、设置、发送与上传
- `public/message-blocks.js`：共享消息 block 解析与顺序分组
- `public/styles.css`：布局、气泡、媒体、移动端与设置页样式
- `scripts/selftest.mjs`：本地回归脚本
- `docs/HANDOFF-2026-03-17.md`：当前交接摘要

## 最近主线变更
- `f27a1d4` `feat: add theme preset variants`
- `dcfbe64` `feat: add light theme toggle`
- `932bdcd` `docs: record avatar persistence fix`

## 分支状态
- 当前开发基点：`main`
- 已合流分支：`codex/mobile-history-test`
- 仍保留的历史实验分支：
  - `codex/image-bubble-width-experiment`
  - `codex/mobile-history-test`

## 已知重点
- 移动端历史加载体验仍需继续观察，当前只是做了首屏载荷和贴底实现优化，还没有完全证明根因已消失
- 视觉媒体等宽气泡方案仍需继续人工对比，特别是多图文交错与“小图 + 长正文”场景
- 音频转写成功链路仍以人工验收为主

## 下一步
1. 继续验证移动端历史加载稳定性；若仍有问题，进入第二阶段根因修复
2. 继续人工对比视觉媒体等宽方案在不同 agent 内容下的效果
3. 做更完整的多 agent / 迟到回复回归
4. 补音频转写成功链路人工验收
5. 如需继续收紧图文混排保障，可补浏览器级 DOM 顺序断言
