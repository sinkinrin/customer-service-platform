# AI 配置持久化（中文）

> 该文档是 `docs/AI-CONFIGURATION-PERSISTENCE.md` 的中文概览版，描述 AI（FastGPT）配置在“重启后仍能保留”的真实实现方式。

**最后更新**：2026-01-22

---

## 1) 存储策略（混合持久化）

实现目标：

- 既要持久化（重启后还在）
- 又要保证敏感信息不入库、不进 git

当前实现拆分为两类：

1. **敏感信息**（FastGPT API Key）→ `.env.local`
2. **非敏感配置**（启用开关、模型、温度、提示词、URL、AppId 等）→ `config/ai-settings.json`

实现位置：`src/lib/utils/ai-config.ts`

---

## 2) 文件约定

- `.env.local`：在 `.gitignore` 中，不会提交
- `config/ai-settings.json`：在 `.gitignore` 中，不会提交
- `config/ai-settings.example.json`：模板文件，会提交

---

## 3) 读/写逻辑（真实入口）

### 读取

- 读取 `config/ai-settings.json`
- 读取 `process.env.FASTGPT_API_KEY`（来自 `.env.local`）
- 合并为一个配置对象返回给管理端

### 写入

- 非敏感字段写入 `config/ai-settings.json`
- 若提交了新的 API Key，会更新 `.env.local` 中的 `FASTGPT_API_KEY=...`
- 注意：更新 `.env.local` 通常需要重启服务进程后才能生效（环境变量生效机制）

---

## 4) 相关 API

- `GET /api/admin/settings/ai`：读取当前 AI 配置
- `PUT /api/admin/settings/ai`：更新 AI 配置

（具体字段命名与响应格式以 `docs/API-REFERENCE.md` 与实现代码为准）

