# AI 配置持久化

> 当前 AI 设置的持久化方式与管理端配置行为说明。

**最后更新**：2026-04-20
**状态**：✅ 当前

---

## 1. 总览

AI 配置现在采用混合持久化：

1. **非敏感配置** 写入 `config/ai-settings.json`
2. **敏感凭据** 主要从环境变量读取；对 FastGPT 的旧兼容路径仍可通过管理端写入 `.env.local`

一个关键现实是：当前 AI 系统已经**不是 FastGPT-only**。

代码层现在支持的 provider 有：

- `fastgpt`
- `openai`（OpenAI-compatible）
- `yuxi-legacy`

关键文件：

- `src/lib/utils/ai-config.ts`
- `src/lib/ai/providers/index.ts`
- `src/app/api/admin/settings/ai/route.ts`

---

## 2. 存储模型

### 配置文件

非敏感设置写入：

- `config/ai-settings.json`

当前会保存的典型字段包括：

- `enabled`
- `provider`
- `fastgptUrl`
- `fastgptAppId`
- `fastgptProAppId`
- `openaiUrl`
- `openaiModel`
- `yuxiUrl`
- `yuxiAgentId`
- `model`
- `temperature`
- `systemPrompt`
- `qaRetestAppId`
- `qaApps`

### 环境变量中的敏感字段

敏感字段不会被写回 JSON 文件。当前敏感字段包括：

- `fastgptApiKey`
- `fastgptProApiKey`
- `openaiApiKey`
- `yuxiUsername`
- `yuxiPassword`

这些值在读取设置时主要从环境变量叠加进来。

---

## 3. 当前 Provider 支持

### `fastgpt`

字段：

- `fastgptUrl`
- `fastgptAppId` / `fastgptApiKey`：客户 AI 对话 Flash 应用
- `fastgptProAppId` / `fastgptProApiKey`：客户 AI 对话 Pro 应用

客户对话调用 FastGPT chat completions 时由应用专属 API key 选择应用；`appId` 会被保存并随模式映射保留，供需要 `appId` 的非 chat 接口使用。

### `openai`

字段：

- `openaiUrl`
- `openaiApiKey`
- `openaiModel`

这里的 `openai` 指 OpenAI-compatible 路径，不等于只能接 OpenAI 官方服务。

### `yuxi-legacy`

字段：

- `yuxiUrl`
- `yuxiUsername`
- `yuxiPassword`
- `yuxiAgentId`

### 共享字段

- `enabled`
- `provider`
- `model`
- `temperature`
- `systemPrompt`
- `qaRetestAppId`
- `qaApps`

---

## 4. 读取流程

`src/lib/utils/ai-config.ts` 中的 `readAISettings()` 当前会：

1. 读取 `config/ai-settings.json`（若存在）
2. 与默认设置合并
3. 再叠加来自环境变量的敏感字段
4. 返回统一的 `AISettings` 对象

当前环境变量覆盖示例：

- `FASTGPT_API_KEY` / `AI_FASTGPT_API_KEY`
- `FASTGPT_PRO_APP_ID` / `AI_FASTGPT_PRO_APP_ID`
- `FASTGPT_PRO_API_KEY` / `AI_FASTGPT_PRO_API_KEY`
- `AI_OPENAI_API_KEY`
- `AI_YUXI_USERNAME`
- `AI_YUXI_PASSWORD`

---

## 5. 写入流程

`writeAISettings()` 当前会：

1. 确保 `config/` 目录存在
2. 把传入值与当前设置合并
3. 在写文件前剥离敏感字段
4. 把安全配置写入 `config/ai-settings.json`

这意味着 JSON 文件天然就是“去敏感信息”的，不是完整明文快照。

---

## 6. `.env.local` 更新路径

仓库里仍保留一个兼容辅助：

- `updateEnvFile(apiKey)`

当前行为：

- 更新或插入 `.env.local` 里的 `FASTGPT_API_KEY=...`
- 由管理端 AI 设置路由用于 FastGPT API Key 更新

当前行为：

- `updateEnvFile(apiKey)` 仍兼容更新 `FASTGPT_API_KEY`
- `updateEnvFileValues(values)` 可更新多个 `.env.local` 键
- 管理端保存 FastGPT Pro、OpenAI、Yuxi 等敏感凭据时，会同步写入 `.env.local`
- 环境变量变更是否立即生效仍取决于运行进程，通常可能需要重启

---

## 7. 管理端 API

AI 设置管理路由：

- `GET /api/admin/settings/ai`
- `PUT /api/admin/settings/ai`

实现位置：

- `src/app/api/admin/settings/ai/route.ts`

### GET

当前会：

- 要求已登录 admin 权限
- 调用 `readAISettings()` 读取配置
- 以 snake_case 结构返回
- 对敏感字段返回 `********` 掩码

### PUT

当前会：

- 要求已登录 admin 权限
- 用 Zod 校验请求体
- 把 snake_case 字段映射为内部 camelCase 设置结构
- 通过 `writeAISettings()` 写入非敏感配置
- 对 FastGPT API key 仍调用 `updateEnvFile()`

---

## 8. Provider Registry

运行时 provider 注册位于：

- `src/lib/ai/providers/index.ts`

当前注册的 provider：

- `fastgpt`
- `openai`
- `yuxi-legacy`

所以凡是只把 AI 持久化文档写成“FastGPT 配置持久化”的，都已经不完整了。

---

## 9. QA Review 相关设置

当前 AI 设置模型里还包含 QA review 相关字段：

- `qaRetestAppId`
- `qaApps`

它们用于 AI QA 重测和未来多 app/provider 的映射能力。

---

## 10. 运维注意点

- `config/ai-settings.json` 可能在首次写入前不存在
- 写入时会故意剥离敏感字段
- FastGPT API key 仍可通过管理端写入 `.env.local`
- 其他 provider 的敏感凭据更偏向 env 输入而非 JSON 明文存储
- env 变更是否立即被进程读取，通常仍需要按部署方式决定是否重启

---

## 11. 文档边界

这份文档描述的是**持久化和管理端配置行为**，不是完整 AI 架构说明。

如需看运行时 provider 接线和整体架构，还应同时参考：

- `docs/ARCHITECTURE.md`
- `src/lib/ai/providers/index.ts`
- `src/app/api/conversations/route.ts`
- `src/app/api/staff/ai-qa/review/route.ts`

---

## 相关文档

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [API-REFERENCE.md](./API-REFERENCE.md)
- [README.md](../README.md)
