# Error Log

> 记录格式：日期 / 场景 / 原因 / 修复 / 预防措施

## 2026-03-15
- 前端脚本拼接错误 / 原因：多次局部编辑后 `public/app.js` 出现重复片段，触发 JS 语法错误 / 修复：重写 `public/app.js`，恢复单一入口与完整函数结构 / 预防措施：前端大改优先整文件覆盖，改后立即 `node --check public/app.js`
- 发图轮次过早超时 / 原因：等待 assistant 最终回复窗口仅 25s，长耗时图片生成场景会先返回占位文案 / 修复：增加 `OPENCLAW_WEBCHAT_ASSISTANT_WAIT_TIMEOUT_MS`，默认提升到 120s / 预防措施：把长耗时媒体生成纳入自测与专项回归
- gateway 临时断连 / 原因：`openclaw gateway call` 遇到 normal closure / connect failed 时会直接失败 / 修复：服务端增加 gateway 调用重试 / 预防措施：保留重试，并在验收时覆盖多 agent / 多轮发送场景
- `/new` 后旧异步结果串入新会话 / 原因：上游 session key 固定为 `agent:<id>:openclaw-webchat:main`，reset 后晚到 completion 仍会落入当前 key；同时旧代次回包没有在接入层被丢弃 / 修复：`/new` 时轮换 upstream session key，并在服务端按代次忽略旧 key 的迟到回包 / 预防措施：自测新增断言，要求 `/new` 后 `upstreamSessionKey` 必须变化，避免再次把 reset 做成“同 key 清空”

## 2026-03-16
- slash 菜单新增 DOM 但未形成可用交互 / 原因：只补了 `public/index.html` 与 `public/app.js` 的命令菜单骨架，没有同步 `.hidden` 与菜单样式，菜单显示/隐藏状态不可靠 / 修复：在 `public/styles.css` 增加 `.hidden`、`command-picker`、`command-menu`、`command-item` 等样式，并补按钮展开态 / 预防措施：页面级改动必须同时校验 DOM、交互 JS、样式三件套，自测里增加菜单存在性与样式断言
- 本地 slash 命令的非法参数被当成接口错误 / 原因：`runSlashCommand(...)` 在 `/think`、`/fast`、`/verbose` 参数无效时直接抛错，前端只能收到 HTTP 500，而不是原生 WebUI 风格的本地提示 / 修复：服务端改为本地生成 assistant 提示消息，并补齐查询/设置分支与 `sessions.list`、`models.list`、`sessions.patch`、`sessions.compact` 语义 / 预防措施：把 slash 参数校验视为正常用户路径，优先返回本地提示消息；自测覆盖 `/model`、`/think`、`/new`
- 跨 agent 会话串 processing 状态与最新回复 / 原因：前端把 `sending` 和 `messages` 作为全局当前视图状态使用，异步发送回包、slash 回包、历史加载都没有绑定发起时的 `sessionKey`；切换会话后，旧请求结果会写入当前打开的会话 / 修复：改为按 `sessionKey` 维护发送中状态，并为发送、slash、历史加载、会话打开都增加上下文校验，只在请求仍属于当前会话时才更新 UI / 预防措施：前端所有异步 UI 写入都必须携带会话上下文；手工回归必须覆盖“处理中切换 agent”的竞态场景
