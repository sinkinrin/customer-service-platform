# 变更：邮件用户自动生成欢迎密码

## Why

当用户第一次通过邮件向 Zammad 发送工单时，Zammad 会自动创建 Customer 账号，但通常**不会设置可用于登录的密码**。这会导致：

1. 用户无法直接登录 Web 平台查看工单详情，只能通过邮件往返沟通
2. 用户需要额外走“忘记密码/重置密码”流程才能开始使用 Web 平台
3. 邮件创建用户与 Web 注册用户的体验不一致

## What Changes

在处理 Zammad Webhook（工单 created、且来源为 email）的流程中：

- 识别“首次由邮件触发的新用户”（见设计：去重机制）
- 为该用户生成一个安全的临时密码
- 通过 Zammad API 为用户设置密码
- 通过 Zammad Article API 发送一封欢迎邮件（包含登录信息与安全提示）

> 说明：现有由 Zammad Trigger 发送的“工单确认邮件”保持不变；欢迎邮件为新增的一封独立邮件。

## 影响范围

### 受影响的代码（实现阶段）

- `src/app/api/webhooks/zammad/route.ts`：在 created 事件中触发欢迎逻辑（异步，不阻塞响应）
- `src/lib/ticket/email-user-welcome.ts`：欢迎逻辑入口与实现
- `src/lib/constants/email-templates.ts`：欢迎邮件模板（新增）

### 配置

- `EMAIL_USER_AUTO_PASSWORD_ENABLED`：是否启用自动生成密码（默认 `true`）
- `EMAIL_USER_WELCOME_EMAIL_ENABLED`：是否启用发送欢迎邮件（默认 `true`）
- `WEB_PLATFORM_URL`：用于欢迎邮件中的登录链接（例如 `https://support.example.com`）

## 已知风险

欢迎邮件会作为外部 Article 写入 Zammad 工单历史中，因此临时密码**可能被 Staff/Admin 通过工单历史查看**。欢迎邮件中必须包含醒目的安全提示：用户首次登录后立刻修改密码。

## 优先级

P1（重要）：统一用户体验，降低首次使用 Web 平台的摩擦成本。

