# openclaw-webchat

OpenClaw WebChat 项目仓库。

## 当前版本
- 发布版本：`0.1.2`
- 包版本：`0.1.2`

## 项目目标
构建可扩展、可维护的 WebChat 客户端，为 OpenClaw 提供稳定的对话交互体验。

## 当前阶段
- 阶段：`0.1.2` 已合入 `main`，作为后续开发基点继续演进
- 当前重点：移动端历史加载稳定性、视觉媒体气泡方案收口、多 agent / 迟到回包回归、音频转写成功链路验收

## 本地运行
```bash
npm install
npm start
# 默认监听 http://localhost:3770
```

## 常驻运行
已提供 launchd 启动脚本：

```bash
scripts/run-webchat-launchd.sh
```

推荐以用户级 LaunchAgent `ai.openclaw.webchat` 常驻运行，日志写入：
- `~/.openclaw/logs/webchat.log`
- `~/.openclaw/logs/webchat.err.log`

说明：
- WebChat 自身会常驻监听 `3770` 端口；
- 它在每次请求时调用 `openclaw` CLI，因此即使 OpenClaw / gateway 重启，WebChat 进程保持常驻即可继续服务；
- launchd `KeepAlive` 会在 WebChat 异常退出后自动拉起。

## 自测
```bash
npm run selftest
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
- 左侧 agent 列表 + 主聊天区 + 输入区
- 历史渲染与无限上拉分页
- 移动端抽屉布局
- 底部起消息流（最新消息贴近输入框）
- 对话气泡头像（agent / 用户）
- 新消息自动贴底显示，无需手动滚动
- 左栏和右栏独立滚动
- 我的显示名 / 我的头像 URL 快速设置
- 用户图片上传、发送前预览与本地落盘
- 用户音频上传、默认本地 Whisper 自动转写、失败时仍发送原音频
- `+` 按钮统一上传图片/音频
- 图片直接嵌入气泡，支持单击全屏、缩放与平移
- 视频直接嵌入气泡，使用原生播放器控件处理全屏
- 对话气泡支持常用 Markdown 渲染（标题、列表、引用、代码块、链接、粗斜体）
- 当前版本支持图片 / 视频图文气泡等宽显示：气泡宽度跟随媒体实际显示宽度，桌面端最大 `70vw`
- 已收紧视觉媒体气泡启用条件：纯媒体或短图注消息使用等宽气泡，长正文图文混排在桌面端回退为常规宽气泡
- 发送后立即清空输入框；agent 处理期间显示头像 + 动态处理中指示
- 左右聊天头像尺寸统一
- 可视化设置页支持统一联系人管理、头像本地裁剪上传与可收起的展开式设置分区
- gateway 断连重试与长耗时回复等待增强

## 仓库结构
- `status.md`：项目状态与里程碑（开工前先读）
- `docs/PROJECT_CHARTER.md`：项目章程（范围/目标/边界）
- `docs/ARCHITECTURE.md`：架构草案
- `docs/ROADMAP.md`：里程碑与迭代节奏
- `docs/HANDOFF-2026-03-17.md`：最新交接摘要与下一步建议
- `docs/HANDOFF-2026-03-15.md`：上一轮交接记录
- `docs/error.md`：错误与修复记录

## 协作约定
1. 所有变更先更新相关文档，再提交代码。
2. 每次提交保持可回滚、可追踪。
3. 本地与 GitHub 保持同步（提交后立即 push）。
