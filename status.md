# status.md — claw-webchat

## 读取顺序
1. 先读本文件
2. 再读 `docs/HANDOFF-2026-03-24.md`
3. 需要补背景时再读 `docs/ARCHITECTURE.md`、`docs/ROADMAP.md`、`docs/error.md`

## 项目概览
- 项目名：`claw-webchat`
- 当前版本：`0.1.7`（manifest: `0.1.7`）
- 当前主线：`main`
- 仓库地址：`https://github.com/memphislee09-source/claw-webchat`
- 项目目标：构建独立于默认 WebUI 的 OpenClaw WebChat，强化历史保留、富媒体体验和多会话稳定性
- 当前品牌显示：面向用户与公开页面统一显示为 `Claw WebChat`；仓库 slug 与本地目录统一为 `claw-webchat`；后端技术标识仍保持 `openclaw-webchat`

## 当前基线
- `0.1.6` 已合入当前工作基线，后续统一以主线为开发基点
- 当前运行方式支持用户级 LaunchAgent `ai.openclaw.webchat` 常驻拉起
- 当前主线已包含：
  - slash 命令按钮、本地命令菜单与本地执行语义
  - 跨 agent 会话隔离与迟到回包防串
  - Markdown 图片解析与图文混排顺序修复
  - 视觉媒体等宽气泡方案，以及“长正文图文混排回退常规宽气泡”保护
  - 首屏历史 `15` 条的移动端实验参数
  - 头像持久化修复：保存稳定源路径，读取时动态签发媒体地址
  - 设置页偏好分区支持 1 套深色 + 5 套浅色主题预设切换，并在当前浏览器持久化主题偏好；当前默认浅色方案为 `Dawn Peach`
  - 设置页已扩展为一级手风琴分区：联系人、外观、访问与安全、关于、手动启动服务
  - 设置页外观分区已开放语种选择，当前支持简体中文 / English 界面切换，并在浏览器本地持久化
  - 访问与安全支持本机 / 局域网 / Tailscale 访问模式说明、可选轻认证、设置内重启与手动启动说明
  - 文档访问范围说明已改为与 OpenClaw 当前设定保持一致，不再由 WebChat 单独限制
  - 对话气泡阴影已单独收紧，浅色主题只保留轻微层次，减少“气泡漂浮”分散感
  - 媒体 token secret 保持独立签名；上传源不再向前端暴露绝对路径
  - 文件媒体链接协议白名单与非法 scheme 兜底
  - 迟到回包补偿不再污染正式历史
  - 音频转写改为非阻塞异步执行
  - 自测脚本统一请求超时控制
  - 聊天页自动跟随滚动统一贴底状态管理
  - 历史头像 token 受限兼容迁移
  - 左侧 agent 列表局部刷新：身份信息由设置推送，轮询只刷新状态/摘要/时间
  - 当前 agent 主时间线关键词搜索与命中跳转
  - `/model` 模型弹窗已补完整列表摘要、热缓存秒开、单行选项与“切换成功后保持弹窗打开”交互
  - `/model` 模型弹窗空闲态不再重复显示两份相同的介绍文案；顶部说明保留，底部状态区只在加载、切换结果或异常时显示
  - `T:*` thinking 弹窗已补热缓存秒开与“切换成功后保持弹窗打开”交互
  - 公开安装文档已进一步收紧：bundle / network 两套 agent 指南都明确要求“一步一检查”，保留低能力模型 fallback；network 指南现在也覆盖 OpenClaw 官方 bootstrap、onboard、源码拉取、配置与服务启用闭环
  - 历史搜索交互收口：顶部常驻搜索框、外部点击收起、最新视图命中跳转修正
  - 历史搜索结果点击后保持展开，外部点击才收起；搜索框支持当前 agent 维度的最近搜索回选
  - 命中消息关键词高亮，以及更简洁的最近搜索下拉样式
  - 历史搜索第二阶段首批增强：日期筛选、更大结果集、分词/紧凑匹配排序
  - gateway CLI stdout 混合日志兼容解析，插件诊断日志不会再打断 `/model`、`/think` 等本地 slash 命令
  - `/model` 已支持当前 agent 级模型切换弹窗：显示当前模型与可用模型列表，并可直接切换到 `provider/model` 目标
  - 输入区右侧保留静态 `T` thinking 控件；当前 session 的模型与完整 thinking level 会显示在聊天头部 agent 名称右侧，点击 `T` 后仍可弹出当前模型可用的 thinking 选项并直接切换
  - 前端已接入 `/api/openclaw-webchat/events` SSE 事件流：agent 列表与当前会话现在优先根据服务端真实变化触发刷新，固定轮询已降为低频兜底而非主同步机制
  - 对话栏滚动控制已进一步统一：render、媒体延迟加载、历史补页、当前会话刷新与显式跳转现在共用一套 viewport snapshot / restore 逻辑，默认优先保持当前位置，只有显式 follow-bottom 时才自动贴底
  - 对话区头像尺寸已与左栏头像统一，不再因消息区布局出现大小漂移
  - 用户发送后在 agent 处理中阶段保持对话贴底，不再短暂下沉回上一条可见消息
  - 视频消息在未播放前会显示缩略预览层，至少可见首帧或视频标题/播放提示
  - 输入框“发送”已改为图标按钮；当前 agent 处理中时会切换为停止图标，可直接停止该 agent 当前任务
  - session 级停止接口已接入 gateway `chat.abort`，并同步拦截本地等待态与迟到补回链路
  - 图片查看器右上角缩放读数会跟随真实缩放比例动态刷新，不再固定显示 `1:1`
  - 前端与公开展示文档中的项目名已统一改为 `Claw WebChat`；API、环境变量、namespace 和仓库名保持不变
  - 隐藏 bootstrap 媒体约定已继续收紧并压缩：agent 默认会把本地媒体和直链远程 `http/https` 媒体按 `MEDIA:` / `mediaUrl:` 回传到 Claw WebChat，不再误走不受支持的 `message` / `webchat` 发送路径；本地生成的 `.mp3` / `.wav` TTS 音频也已明确纳入同一回退协议
  - 常规桌面图片 / 视频消息默认宽度上限已从 `420px` 调整为 `70vw`，同时保留原有图文混排等宽气泡判定逻辑
  - 右侧消息区滚动已补稳：历史补页保持原可见区，agent 处理中不再强制把用户拉回底部，消息列表改为直接滚动避免动画叠加乱跳
  - 对话栏滚动模型已进一步收口：中段阅读时后台刷新不再直接重开并打断当前视口，而是先显示“当前会话有更新，按 End 或点这里查看”；当前会话重渲染会保住可见消息锚点，并已补 `Home` / `End` / `PageUp` / `PageDown` 键盘导航
  - 设置面板“关于”已显示当前版本号，直接由 `package.json` 经设置接口返回；thinking 按钮字重也已收轻，避免视觉上压过主发送动作
  - 已补公开发布资料第一套：README 首页重写、公开发布 checklist、GitHub issue/PR 模板增强、截图归档与两套 agent 安装指南
  - 已新增 release bundle 打包脚本，可生成 GitHub Release 用的整合安装包与 SHA256 校验文件
  - 本地 `selftest` 已恢复通过；旧的 `claw-webchat:*` sessionKey 绑定会在服务端自动迁移并继续兼容

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
- 设置面板一级分区：联系人、外观、访问与安全、关于、手动启动服务
- 外观设置：1 套深色 + 5 套浅色主题预设切换、简体中文 / English 语种切换与浏览器本地持久化，当前默认浅色方案为 `Dawn Peach`
- 访问与安全：访问模式切换、可选轻认证、设置内重启、手动启动说明、文档访问范围跟随 OpenClaw
- 对话气泡阴影分层：消息气泡使用更轻的专用阴影，不复用全站大阴影
- agent / 用户头像持久化防过期
- gateway 断连重试与长耗时回复等待增强
- 当前 agent 历史消息关键词搜索、最近搜索回选、命中跳转与关键词高亮
- 历史搜索第二阶段首批增强：日期范围筛选、`20 / 50 / 100` 结果数切换、更强匹配策略
- gateway stdout 混合日志兼容解析，避免插件诊断输出干扰上游 JSON 查询
- 当前 agent 已支持通过 `/model` 弹窗查看当前模型、浏览可用模型列表并直接切换模型
- 当前 agent 已支持通过输入区右侧的静态 `T` thinking 按钮查看并切换当前 session 的 thinking level；当前模型与完整 thinking level 会显示在聊天头部
- 聊天区头像尺寸与左栏保持一致，视频消息支持未播放前预览，处理中阶段的贴底体验已补稳
- 输入框发送按钮已切换为发送/停止双态图标按钮，可在当前 agent 处理中直接停止本轮任务
- 设置面板“关于”已显示当前版本号
- 图片查看器全屏模式已支持随真实缩放动态更新右上角读数
- 公开发布准备资料已落地：截图、README 首页、issue/PR 模板、bundle / network 两套 agent 安装说明
- 隐藏 bootstrap 已明确约定本地文件与远程直链媒体的回传格式，agent 在 Claw WebChat 中无需额外提醒即可按 `MEDIA:` / `mediaUrl:` 正确发送
- 常规桌面媒体默认上限已提升到 `70vw`
- 右侧消息区历史补页与手动滚动已补稳，不再因 busy 贴底或平滑滚动叠加而频繁乱跳
- 当前会话在中段阅读时会延后后台刷新，并在重渲染时保住可见消息锚点；消息列表已支持 `Home` / `End` / `PageUp` / `PageDown`

## 关键文件
- `src/server.js`：服务端适配层、历史存储、媒体代理、设置接口、slash 命令
- `public/app.js`：前端状态、消息渲染、分页、设置、发送与上传
- `public/message-blocks.js`：共享消息 block 解析与顺序分组
- `public/styles.css`：布局、气泡、媒体、移动端与设置页样式
- `scripts/selftest.mjs`：本地回归脚本
- `docs/HANDOFF-2026-03-24.md`：当前交接摘要

## 最近主线变更
- `main` 已补公开安装文档完整性收口：bundle / network 两套 agent 安装说明现在都强调逐步校验、低能力模型 fallback 和最终完成门槛；network 流程也补上了 OpenClaw 官方 bootstrap + onboard 再继续下载 WebChat 的闭环
- `main` 已补一个 `0.1.6` 后续小修：`/model` 弹窗空闲态不再在顶部说明之外重复显示第二份相同介绍文案
- `main` 已补一个 `0.1.6` 后续小修：agent 切换时不再等待 thinking 状态请求才打开会话；输入区右侧 thinking 控件回到静态 `T` 图标，当前模型与完整 thinking level 改为显示在聊天头部标题旁
- `main` 已补一个 `0.1.6` 后续小修：对话栏现在区分“贴底跟随”和“中段阅读”，后台轮询发现当前会话更新时会先显示提示而不是直接打断阅读；同时消息列表已支持 `Home` / `End` / `PageUp` / `PageDown`
- `0.1.6` 已收口准备同步：`/model` 完整列表与响应速度修复、模型弹窗滚动/停留交互收口，以及 `T:*` thinking 菜单的同级提速与停留确认交互都已纳入当前版本
- `0.1.5` 已同步到 GitHub：历史搜索第二阶段首批增强、agent 级 `/model` 切换、发送/停止双态按钮、`chat.abort` 停止链路、公开发布文档与图片查看器缩放读数修复均已纳入当前版本
- `f27a1d4` `feat: add theme preset variants`
- `dcfbe64` `feat: add light theme toggle`
- `932bdcd` `docs: record avatar persistence fix`

## 分支状态
- 当前开发基点：`main`
- 已合流分支：
  - `codex/mobile-history-test`
  - `codex/desktop-media-70vw`
- 仍保留的历史实验分支：
  - `codex/image-bubble-width-experiment`
  - `codex/mobile-history-test`

## 已知重点
- 2026-03-24 `0.1.6` 已补 `/model` 完整 provider 汇总、短缓存提速、模型弹窗底部选项可滚动显示，以及模型/ thinking 切换成功后保留弹窗等待用户自行返回
- 2026-03-24 `0.1.5` 已将历史搜索第二阶段首批增强、agent 级 `/model` 切换、发送/停止双态按钮、`chat.abort` 停止链路、公开发布准备资料和图片查看器缩放读数修复一起并入 `main`
- 2026-03-24 已修复 `sessionKey` 前缀不一致：服务端会把历史 `claw-webchat:*` 绑定自动规范到 `openclaw-webchat:*`，并继续兼容旧 key 请求
- 2026-03-24 已完成显示层品牌改名：用户可见项目名统一为 `Claw WebChat`，但后端技术标识仍保持 `openclaw-webchat`
- 2026-03-24 已修复 Athena 发图时误走 `message` 工具的问题：隐藏 bootstrap 现在更短但更明确，agent 默认知道用 `MEDIA:` / `mediaUrl:` 回传本地媒体与远程直链媒体
- 2026-03-24 常规桌面媒体默认上限调整为 `70vw`，以及右侧消息区滚动乱跳修复，现已并入 `main`，后续继续以当前主线为开发基点
- 2026-03-25 已将输入区右侧 thinking 控件收回为静态 `T` 图标，避免切换 agent 时等待 thinking 标签刷新；当前 session 的模型与完整 thinking level 已改为显示在聊天头部 agent 名称右侧
- 2026-03-25 已重做对话栏滚动模型：阅读历史时后台刷新不再直接把视口打断到旧消息位置；当前会话重渲染会保住可见锚点，并新增 `Home` / `End` / `PageUp` / `PageDown` 键盘支持
- 2026-03-25 已补 Wangyuyan mp3 回传协议收口：隐藏 bootstrap 现在明确要求把已生成的本地 `.mp3` / `.wav` 音频直接按 `MEDIA:` / `mediaUrl:` 返回，而不是声称 Claw WebChat 不能接收该文件；bootstrap 版本也已提升以强制现有 session 重新注入
- 2026-03-25 已在 `codex/sse-event-refresh` 上实现事件驱动刷新第一版：服务端会把 binding/history 变化通过 SSE 推给前端，前端优先按事件刷新 agent 列表与当前会话，固定轮询从 10 秒降为 60 秒兜底
- 2026-03-25 已在 `codex/sse-event-refresh` 上继续重构对话栏滚动模型：引入统一 viewport revision + snapshot/restore 控制器，过期异步回调不会再拿旧锚点回拉视口，当前实现默认优先保持当前位置
- 2026-03-26 已在 `codex/sse-event-refresh` 上补缺消息收口：assistant 最终回复判定不再把带 `toolCall` 的进度消息误收为最终答案；会话打开时会对当前 upstream session 做 history reconcile，把已存在 upstream、但本地 JSONL 漏掉的 user / assistant 行回补回来
- 2026-03-26 当前工作分支版本已提升到 `0.1.7`；公开 GitHub Release bundle 仍停留在 `0.1.6`
- 2026-03-24 已补设置面板“关于”版本号显示，并把 thinking 按钮字重收轻，保证它作为工具控件不抢主发送动作
- 2026-03-22 已完成历史搜索第二阶段首批增强：日期筛选、更大结果集、分词/紧凑匹配排序与结果高亮
- 2026-03-22 已修复 gateway CLI stdout 被插件诊断日志污染时导致 `/model` / `/think` 失败的问题
- 2026-03-22 已补上当前 agent 级模型切换弹窗：无参 `/model` / `/models` 会弹出可用模型列表，点击后直接切换当前 agent 的上游 session 模型
- 2026-03-22 已补头像尺寸一致性、处理中贴底稳定性，以及视频未播放前可见预览层这三项聊天区细节修复
- 2026-03-22 已把输入框发送按钮改成发送/停止双态图标按钮，并接入 gateway `chat.abort` 停止当前 agent 任务
- 2026-03-22 已完成公开发布准备第一批文档：README 首页重写、公开发布 checklist、截图归档、GitHub issue/PR 模板增强，以及 bundle / network 两套 agent 安装指南
- 移动端历史加载体验仍需继续观察，当前只是做了首屏载荷和贴底实现优化，还没有完全证明根因已消失
- 视觉媒体等宽气泡方案仍需继续人工对比，特别是多图文交错与“小图 + 长正文”场景
- 音频转写成功链路仍以人工验收为主
- 历史搜索第二阶段第一批已落地；后续重点从基础筛选切到跳转定位细化、更长结果分页与匹配策略继续打磨

## 下一步
1. 继续验证移动端历史加载稳定性；若仍有问题，进入第二阶段根因修复
2. 继续人工对比视觉媒体等宽方案在不同 agent 内容下的效果
3. 做更完整的多 agent / 迟到回复回归
4. 补音频转写成功链路人工验收
5. 继续增强历史搜索（跳转定位细化 / 更长结果分页 / 匹配策略继续打磨）
6. 如需继续收紧图文混排保障，可补浏览器级 DOM 顺序断言
