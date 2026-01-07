# 变更：授权系统 V3 重构

## 原因

### 背景

基于 2026-01-06 的深度架构调研，发现当前权限系统存在以下根本性问题：

1. **安全漏洞（P0）** - 多个 API 端点缺乏适当的权限检查
2. **架构分散** - 权限逻辑分布在 `permission.ts`、`region-auth.ts` 和各 API 文件中
3. **代码不一致** - `permission.ts` 允许 staff assign，但实际 API 只允许 admin
4. **缺乏审计** - 敏感操作（如跨区域分配）没有审计日志

### 已确认的 P0 安全漏洞

| 漏洞 | 文件位置 | 风险等级 |
|-----|---------|---------|
| AI Chat 无认证 | `api/ai/chat/route.ts` | **严重** - 任何人可调用 AI 接口 |
| File GET/Download 无权限 | `api/files/[id]/*` | **严重** - 任何登录用户可下载任何文件 |
| Attachment 下载无区域验证 | `api/tickets/[id]/articles/.../attachments/...` | **严重** - 任何 Staff 可下载任意工单附件 |
| Rating 无 ticket 验证 | `api/tickets/[id]/rating/route.ts` | **高** - 可为他人工单评分 |
| Updates 泄露全部 | `api/tickets/updates/route.ts` | **高** - 泄露所有工单动态 |
| Webhook 签名可选 | `api/webhooks/zammad/route.ts` | **高** - 可伪造 webhook 请求 |
| Export 使用旧过滤 | `api/tickets/export/route.ts` | **中** - 可能导出未授权工单 |
| Templates 无区域隔离 | `api/templates/[id]/route.ts` | **中** - Staff 可修改他区模板 |
| Reopen 权限过宽 | `api/tickets/[id]/reopen/route.ts` | **中** - 任何 Staff 可重开任意工单 |

### 现有设计文档

`docs/architecture/authorization-system-v3-complete.md` 提供了完整的 V3 架构设计，但：
- 核心组件尚未实现
- AuditLog Prisma 模型缺失
- 依赖项（js-yaml）未安装

## 变更内容

### 阶段 1：P0 安全漏洞即时修复

无需等待 V3 完整实现，立即修复安全漏洞：

1. **AI Chat 认证** - 添加 `requireAuth()`
2. **File 权限检查** - 验证所有权或 ticket 关联
3. **Rating ticket 验证** - 验证 ticket 所有权
4. **Updates 权限过滤** - 按可访问工单过滤
5. **Webhook 强制签名** - 生产环境必须验证签名
6. **permission.ts 修复** - 移除 staff assign 权限

### 阶段 2：V3 核心架构实现

1. **创建 authorization 模块**
   - `src/lib/authorization/types.ts` - 领域类型定义
   - `src/lib/authorization/scope-registry.ts` - 区域/范围管理
   - `src/lib/authorization/principal-resolver.ts` - 用户身份解析
   - `src/lib/authorization/resource-resolver.ts` - 资源解析
   - `src/lib/authorization/policy-engine.ts` - 策略评估引擎
   - `src/lib/authorization/policy-loader.ts` - YAML 策略加载
   - `src/lib/authorization/with-authorization.ts` - API 包装器
   - `src/lib/authorization/audit-logger.ts` - 审计日志

2. **创建策略定义文件**
   - `config/policies/ticket.yaml`
   - `config/policies/file.yaml`
   - `config/policies/rating.yaml`
   - `config/policies/update.yaml`
   - `config/policies/template.yaml`
   - `config/policies/conversation.yaml`
   - `config/policies/user.yaml`
   - `config/policies/ai-chat.yaml`
   - `config/policies/session.yaml`
   - `config/policies/vacation.yaml`
   - `config/policies/faq.yaml`

3. **添加 AuditLog 模型**
   - 更新 `prisma/schema.prisma`
   - 执行数据库迁移

### 阶段 3：API 迁移

将所有 API 端点迁移到统一的 `withAuthorization` 包装器。

### 阶段 4：清理遗留代码

- 移除 `permission.ts` 中的重复逻辑
- 移除 `region-auth.ts` 中的分散检查
- 统一权限错误响应格式

## 影响

### 受影响的规范

- `authorization-system`（新建）
- `audit-logging`（新建）

### 受影响的代码

| 模块 | 文件 | 变更类型 |
|------|------|----------|
| 安全 | `src/app/api/ai/chat/route.ts` | 添加认证 |
| 安全 | `src/app/api/files/[id]/route.ts` | 添加权限检查 |
| 安全 | `src/app/api/files/[id]/download/route.ts` | 添加权限检查 |
| 安全 | `src/app/api/tickets/[id]/rating/route.ts` | 添加 ticket 验证 |
| 安全 | `src/app/api/tickets/updates/route.ts` | 添加权限过滤 |
| 安全 | `src/app/api/webhooks/zammad/route.ts` | 强制签名验证 |
| 权限 | `src/lib/utils/permission.ts` | 修复 staff assign |
| 架构 | `src/lib/authorization/*` | 新增模块 |
| 配置 | `config/policies/*.yaml` | 新增策略文件 |
| 数据 | `prisma/schema.prisma` | 添加 AuditLog 模型 |
| 依赖 | `package.json` | 添加 js-yaml |

### 风险

- **BREAKING**：部分 API 可能返回 403/404 而非之前的数据
- 需要全面回归测试
- 生产环境需配置 `ZAMMAD_WEBHOOK_SECRET`

## 验收标准

### P0 安全修复验收

1. 未登录用户无法调用 `/api/ai/chat`
2. 用户无法下载非自己上传且非关联工单的文件
3. 客户只能为自己的工单评分
4. `/api/tickets/updates` 只返回用户可访问工单的更新
5. 生产环境无有效签名的 webhook 请求被拒绝
6. `canAssignTicket()` 只对 admin 返回 true

### V3 架构验收

1. 所有 API 端点使用 `withAuthorization` 包装
2. 策略通过 YAML 文件配置，支持热更新
3. 敏感操作有审计日志
4. 跨区域分配有详细审计记录
5. 单元测试覆盖率 > 90%

## 参考文档

- `docs/architecture/authorization-system-v3-complete.md` - 完整架构设计
- `docs/architecture/architecture-review-zh.md` - 架构评审记录
