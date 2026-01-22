# 文档索引（中文）

> Customer Service Platform 文档（中文入口）。当前仓库的详细技术文档多为英文，本文件提供中文导航与关键实现位置索引。

**最后更新**：2026-01-22

---

## 快速导航

### 中文（概览）

- 架构概览：`docs/ARCHITECTURE.zh-CN.md`
- 认证概览：`docs/AUTHENTICATION.zh-CN.md`
- 数据库概览：`docs/DATABASE.zh-CN.md`
- API 导读：`docs/API-REFERENCE.zh-CN.md`
- Zammad 集成：`docs/ZAMMAD-INTEGRATION.zh-CN.md`
- 数据结构与接口约定：`docs/数据结构与接口约定.zh-CN.md`
- AI 配置持久化：`docs/AI-CONFIGURATION-PERSISTENCE.zh-CN.md`
- 文档与编码规范：`docs/文档编写与编码规范.md`

### 英文（细节更完整）

- 文档目录（英文）：`docs/README.md`
- 架构（英文）：`docs/ARCHITECTURE.md`
- API 参考（英文）：`docs/API-REFERENCE.md`
- 认证（英文）：`docs/AUTHENTICATION.md`
- 数据库（英文）：`docs/DATABASE.md`
- Zammad 集成（英文）：`docs/ZAMMAD-INTEGRATION.md`
- 测试（英文）：`docs/TESTING.md`

---

## 中文写作与乱码排查（推荐做法）

### 1) 统一使用 UTF-8

- 仓库已提供 `.editorconfig`（根目录），建议编辑器开启 EditorConfig 支持。
- Windows 下不要用默认重定向输出写入中文（可能写成 UTF-16 或产生乱码）。

### 2) PowerShell 写入中文的安全方式

```powershell
# UTF-8 写入（推荐）
'中文内容' | Out-File -FilePath docs\\_tmp-utf8-check.md -Encoding utf8

# UTF-8 追加
'追加内容' | Out-File -FilePath docs\\_tmp-utf8-check.md -Encoding utf8 -Append
```

### 3) 快速验证文件是否为可解码的 UTF-8

```powershell
python -c "open('docs/ARCHITECTURE.zh-CN.md','r',encoding='utf-8').read(); print('OK')"
```

---

## 项目总览（面向文档读者）

- 前端/服务端：Next.js App Router（同仓库内同构 + API Routes）
- 认证：NextAuth v5（JWT session）+ Zammad 认证优先 + Mock/Env 回退
- 工单：Zammad REST API（支持 X-On-Behalf-Of 代办）
- 实时：SSE（`/api/tickets/updates/stream`）+ 轮询兜底
- 本地数据：Prisma + SQLite（FAQ、通知、评分、模板、更新追踪等）
- i18n：next-intl（6 语言）
