# Claw WebChat

https://github.com/user-attachments/assets/53a40759-4889-41bf-9399-a3f3daf5bdaf

Language / 语言: [简体中文](#zh-cn) | [English](#en)

- Download the repository copy: [claw-webchat-promo-v4.mp4](docs/media/claw-webchat-promo-v4.mp4)
- Latest release: [github.com/memphislee09-source/claw-webchat/releases/latest](https://github.com/memphislee09-source/claw-webchat/releases/latest)
- Latest published bundle: [claw-webchat-v0.1.6-bundle.tar.gz](https://github.com/memphislee09-source/claw-webchat/releases/download/v0.1.6/claw-webchat-v0.1.6-bundle.tar.gz)
- Latest published checksum: [claw-webchat-v0.1.6-bundle.sha256](https://github.com/memphislee09-source/claw-webchat/releases/download/v0.1.6/claw-webchat-v0.1.6-bundle.sha256)

<a id="zh-cn"></a>
## 简体中文

[Switch to English](#en)

### 项目简介
`Claw WebChat` 是一个独立于 OpenClaw 默认 WebUI 的 WebChat 项目，面向长期使用的 agent 对话场景。它强调长期历史保留、富媒体体验、多 agent 隔离，以及更直接的模型与 Think 切换体验。

### 项目状态
- 当前版本：`0.1.7`
- 默认开发分支：`main`
- 当前稳定性：`alpha`
- 推荐部署方式：本机或带访问控制的私有网络
- 适合人群：希望拥有独立、长期可用的 OpenClaw 聊天界面的用户

### 为什么做这个项目
- 为每个 OpenClaw agent 保留长期主时间线
- 本地用 JSONL 保存可显示历史，而不是依赖上游内部日志格式
- `/new` 只重置上游上下文，不清空本地可回看的历史
- 原生支持图片、音频、视频、Markdown 文件和普通文件展示
- 支持用户图片上传、音频上传，以及可选的本地 Whisper 转写
- 支持常用本地 slash 命令与 agent 级模型切换
- 支持当前 agent 历史搜索、命中跳转和关键词高亮
- 支持发送/停止双态按钮，直接中止当前 agent 任务

### 安装方式
#### 方式 1：下载 Release Bundle
- 面向希望直接下载整合包的用户
- OpenClaw agent 安装说明：[`docs/AGENT_INSTALL_BUNDLE.md`](docs/AGENT_INSTALL_BUNDLE.md)
- bundle 说明按“一步一检查”组织，也包含低能力 agent fallback

#### 方式 2：通过网络安装
- 面向希望直接拉取最新仓库状态并联网安装依赖的用户
- OpenClaw agent 安装说明：[`docs/AGENT_INSTALL_NETWORK.md`](docs/AGENT_INSTALL_NETWORK.md)
- network 说明包含 OpenClaw / Node 缺失时的 bootstrap 流程

#### 发布前检查
- 对外推荐前请先过一遍 [`docs/PUBLIC_RELEASE_CHECKLIST.md`](docs/PUBLIC_RELEASE_CHECKLIST.md)

### 快速开始
#### 前置要求
- Node.js `20+`
- `PATH` 上可用的 `openclaw` CLI
- 一个能正常响应 CLI 请求的本地 OpenClaw 环境

#### 本地启动
```bash
npm install
npm start
```

默认监听地址：

```bash
http://127.0.0.1:3770
```

基础健康检查：

```bash
curl http://127.0.0.1:3770/healthz
```

### 核心能力
- API 命名空间固定为 `/api/openclaw-webchat/*`
- 稳定的 `agentId -> session` 绑定
- 本地 JSONL 历史与可见消息时间线
- 富媒体解析，兼容结构化 block 与 `MEDIA:` / `mediaUrl:` fallback
- 当前 agent 历史搜索，支持跳转和高亮
- `/model` / `/models` 模型选择器，完整 provider 分组、暖启动更快
- `T:*` Think 快捷切换，按模型感知可用等级
- 发送/停止双态按钮，接通当前会话的 `chat.abort`
- 富媒体消息预览、视频预览、稳定的滚动与响应式布局
- 用户与 agent 头像配置、主题预设、中英文界面切换

### 兼容性与假设
- 默认假设 OpenClaw 已可用；如果没有，network guide 会先引导 bootstrap
- 当前后台服务说明以 macOS `launchd` 为主
- 即使不使用 `launchd`，手动 `npm start` 也可运行
- 当前不面向公网多租户托管
- 文档访问范围遵循当前 OpenClaw 配置

### 运行配置
常用环境变量：

| 变量 | 默认值 | 作用 |
| --- | --- | --- |
| `OPENCLAW_WEBCHAT_PORT` | `3770` | HTTP 端口 |
| `OPENCLAW_WEBCHAT_HOST` | `127.0.0.1` | 绑定地址；如需局域网访问可改为 `0.0.0.0` |
| `OPENCLAW_BIN` | `openclaw` | OpenClaw CLI 路径 |
| `OPENCLAW_WEBCHAT_DATA_DIR` | `./data` | 运行时数据目录 |
| `OPENCLAW_WEBCHAT_MEDIA_SECRET` | 自动生成 | 媒体 token 签名密钥 |
| `OPENCLAW_WEBCHAT_LAUNCHD_LABEL` | `ai.openclaw.webchat` | macOS `launchd` label |
| `OPENCLAW_WEBCHAT_GITHUB_URL` | 项目仓库地址 | 设置页 About 面板显示的 GitHub 链接 |

### 访问方式
- 本机浏览器：默认可直接访问
- 局域网访问：在设置页切换为 LAN 模式后重启服务
- Tailscale 访问：只要 Tailnet 已能访问本机即可，不需要单独的 Tailscale 集成层

设置页当前包含：
- 外观主题
- 中英文界面切换
- Local / LAN / Tailscale 友好的访问模式切换
- 轻量认证
- 当前 agent 的模型切换
- 当前 agent 的 Think 水平切换
- 发送中自动变为停止按钮
- About / 版本 / GitHub 链接
- 手动启动与重启提示

### 安全与部署说明
- 本项目优先面向本机或私有网络使用
- 不自带适合公网直接暴露的完整认证层
- 轻量认证适合共享局域网式场景，但不能替代真正的公网安全边界
- 切换监听地址仍然需要服务重启
- 对外暴露前请阅读 [`docs/SECURITY_MODEL.md`](docs/SECURITY_MODEL.md) 和 [`SECURITY.md`](SECURITY.md)

### 文档导航
公开文档：
- [`CHANGELOG.md`](CHANGELOG.md)
- [`CONTRIBUTING.md`](CONTRIBUTING.md)
- [`SECURITY.md`](SECURITY.md)
- [`docs/SECURITY_MODEL.md`](docs/SECURITY_MODEL.md)
- [`docs/PUBLIC_RELEASE_CHECKLIST.md`](docs/PUBLIC_RELEASE_CHECKLIST.md)
- [`docs/AGENT_INSTALL_BUNDLE.md`](docs/AGENT_INSTALL_BUNDLE.md)
- [`docs/AGENT_INSTALL_NETWORK.md`](docs/AGENT_INSTALL_NETWORK.md)

工程文档：
- [`status.md`](status.md)
- [`docs/PROJECT_CHARTER.md`](docs/PROJECT_CHARTER.md)
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- [`docs/ROADMAP.md`](docs/ROADMAP.md)
- [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md)
- [`docs/error.md`](docs/error.md)
- [`docs/HANDOFF-2026-03-24.md`](docs/HANDOFF-2026-03-24.md)

### 开发检查
```bash
npm run check
```

可选集成冒烟测试：

```bash
npm run selftest
```

构建 GitHub Release bundle：

```bash
npm run bundle
```

### 贡献约定
- 文档更新应与代码改动同步
- 保持改动小、可审阅、易回滚
- 提交前先跑文档中列出的检查
- `main` 作为发布基线，实验分支保持隔离

### 许可证
项目按 [`LICENSE`](LICENSE) 发布。

<a id="en"></a>
## English

[切换到简体中文](#zh-cn)

### Overview
`Claw WebChat` is a standalone WebChat for long-lived OpenClaw agent workflows. It focuses on durable local history, rich media support, multi-agent isolation, and more direct model / Think switching than the default OpenClaw Web UI.

### Project Status
- Current version: `0.1.7`
- Default branch: `main`
- Stability: `alpha`
- Recommended deployment: local machine or private network with access control
- Best fit: users who want a dedicated, long-lived OpenClaw chat surface

### Why This Project Exists
- Keep a long-lived primary timeline for each OpenClaw agent
- Store renderable history locally in JSONL instead of depending on upstream internal logs
- Preserve local history across `/new` while resetting only upstream context
- Support images, audio, video, Markdown files, and regular files inside chat
- Support user image upload, audio upload, and optional local Whisper transcription
- Support local slash commands and agent-scoped model switching
- Support timeline search, jump-to-hit, and keyword highlighting
- Support a send/stop dual-state composer button for aborting the current run

### Installation Paths
#### Option 1: Download a Release Bundle
- Best when you want the easiest packaged public-install path
- OpenClaw agent guide: [`docs/AGENT_INSTALL_BUNDLE.md`](docs/AGENT_INSTALL_BUNDLE.md)
- The guide is written as a step-by-step, check-before-next-step flow

#### Option 2: Install Over the Network
- Best when you want the latest repository state and can fetch dependencies online
- OpenClaw agent guide: [`docs/AGENT_INSTALL_NETWORK.md`](docs/AGENT_INSTALL_NETWORK.md)
- The guide includes prerequisite bootstrap if OpenClaw or Node.js is missing

#### Public Release Checklist
- Before recommending the project publicly, run through [`docs/PUBLIC_RELEASE_CHECKLIST.md`](docs/PUBLIC_RELEASE_CHECKLIST.md)

### Quick Start
#### Prerequisites
- Node.js `20+`
- A working `openclaw` CLI on `PATH`
- A local OpenClaw environment that can answer CLI requests

#### Run Locally
```bash
npm install
npm start
```

Default address:

```bash
http://127.0.0.1:3770
```

Basic health check:

```bash
curl http://127.0.0.1:3770/healthz
```

### Core Capabilities
- Fixed API namespace: `/api/openclaw-webchat/*`
- Stable `agentId -> session` binding
- Local JSONL history and visible-message timeline
- Rich media parsing with structured blocks plus `MEDIA:` / `mediaUrl:` fallbacks
- Timeline search with jump-to-hit and highlight
- `/model` / `/models` picker with complete provider-grouped lists and faster warm reopen
- `T:*` Think quick switch with model-aware options
- Send/stop dual-state composer wired to `chat.abort`
- Media previews, steadier scrolling, and responsive layouts
- User / agent avatar customization, theme presets, and Simplified Chinese / English UI

### Compatibility and Assumptions
- OpenClaw is assumed to be available already; if not, the network guide bootstraps it first
- Background-service guidance is currently macOS `launchd` oriented
- Manual `npm start` still works without `launchd`
- The project is not currently targeting public-internet multi-tenant hosting
- Document access scope follows the current OpenClaw configuration

### Runtime Configuration
Useful environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `OPENCLAW_WEBCHAT_PORT` | `3770` | HTTP port |
| `OPENCLAW_WEBCHAT_HOST` | `127.0.0.1` | Bind address; switch to `0.0.0.0` for LAN access if you understand the trust boundary |
| `OPENCLAW_BIN` | `openclaw` | Path to the OpenClaw CLI |
| `OPENCLAW_WEBCHAT_DATA_DIR` | `./data` | Runtime data directory |
| `OPENCLAW_WEBCHAT_MEDIA_SECRET` | auto-generated | Media token signing secret |
| `OPENCLAW_WEBCHAT_LAUNCHD_LABEL` | `ai.openclaw.webchat` | macOS `launchd` label |
| `OPENCLAW_WEBCHAT_GITHUB_URL` | project repo URL | GitHub link shown in the settings About panel |

### Access Modes
- Local browser access works out of the box
- LAN access is supported by switching the access mode in settings and restarting the service
- Tailscale access works as long as your Tailnet already reaches the machine

The settings UI currently includes:
- appearance presets
- Simplified Chinese / English interface switching
- local-only vs LAN / Tailscale-friendly access mode switching
- lightweight auth
- agent-scoped model switching
- agent-scoped Think switching
- send-to-stop composer state
- About / version / GitHub information
- manual start and restart hints

### Security and Deployment Notes
- This project is designed first for local or private-network usage
- It does not ship with a full auth layer for direct public exposure
- Lightweight auth helps for shared-LAN usage but is not a public-internet security boundary
- Listener rebinding still requires a service restart
- Read [`docs/SECURITY_MODEL.md`](docs/SECURITY_MODEL.md) and [`SECURITY.md`](SECURITY.md) before wider exposure

### Docs Guide
Public docs:
- [`CHANGELOG.md`](CHANGELOG.md)
- [`CONTRIBUTING.md`](CONTRIBUTING.md)
- [`SECURITY.md`](SECURITY.md)
- [`docs/SECURITY_MODEL.md`](docs/SECURITY_MODEL.md)
- [`docs/PUBLIC_RELEASE_CHECKLIST.md`](docs/PUBLIC_RELEASE_CHECKLIST.md)
- [`docs/AGENT_INSTALL_BUNDLE.md`](docs/AGENT_INSTALL_BUNDLE.md)
- [`docs/AGENT_INSTALL_NETWORK.md`](docs/AGENT_INSTALL_NETWORK.md)

Engineering docs:
- [`status.md`](status.md)
- [`docs/PROJECT_CHARTER.md`](docs/PROJECT_CHARTER.md)
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- [`docs/ROADMAP.md`](docs/ROADMAP.md)
- [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md)
- [`docs/error.md`](docs/error.md)
- [`docs/HANDOFF-2026-03-24.md`](docs/HANDOFF-2026-03-24.md)

### Development Checks
```bash
npm run check
```

Optional local integration smoke test:

```bash
npm run selftest
```

Build the GitHub Release bundle:

```bash
npm run bundle
```

### Contribution Expectations
- Update docs before or alongside code changes
- Keep changes small, reviewable, and easy to roll back
- Run the documented checks before opening a pull request
- Treat `main` as the release baseline and keep experiment branches isolated

### License
Released under the terms of [`LICENSE`](LICENSE).
