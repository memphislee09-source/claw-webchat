# Error Log

> 记录格式：日期 / 场景 / 原因 / 修复 / 预防措施

## 2026-03-15
- 前端脚本拼接错误 / 原因：多次局部编辑后 `public/app.js` 出现重复片段，触发 JS 语法错误 / 修复：重写 `public/app.js`，恢复单一入口与完整函数结构 / 预防措施：前端大改优先整文件覆盖，改后立即 `node --check public/app.js`
- 发图轮次过早超时 / 原因：等待 assistant 最终回复窗口仅 25s，长耗时图片生成场景会先返回占位文案 / 修复：增加 `OPENCLAW_WEBCHAT_ASSISTANT_WAIT_TIMEOUT_MS`，默认提升到 120s / 预防措施：把长耗时媒体生成纳入自测与专项回归
- gateway 临时断连 / 原因：`openclaw gateway call` 遇到 normal closure / connect failed 时会直接失败 / 修复：服务端增加 gateway 调用重试 / 预防措施：保留重试，并在验收时覆盖多 agent / 多轮发送场景

