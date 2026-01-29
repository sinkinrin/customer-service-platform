# 任务清单：邮件用户自动生成欢迎密码

## 1. 配置与常量

- [x] 在 `.env.example` 添加：
  - `EMAIL_USER_AUTO_PASSWORD_ENABLED=true`
  - `EMAIL_USER_WELCOME_EMAIL_ENABLED=true`
  - `WEB_PLATFORM_URL=`
- [x] 在 `src/lib/env.ts` 增加上述环境变量读取与校验
- [x] 新增 `src/lib/constants/email-templates.ts`：欢迎邮件 HTML 模板（首版至少英文）

## 2. 核心逻辑

- [x] 新增 `src/lib/ticket/email-user-welcome.ts`
- [x] 实现 `generateSecurePassword()`：12 位安全随机密码（crypto.randomBytes + 排除易混淆字符）
- [x] 实现首次用户判定（基于 Region 标记：无 Region = 邮件新用户）
- [x] 实现两步幂等标记：`WelcomePasswordSet:` + `WelcomeEmailSent:`
- [x] 实现 `setUserPassword()`：`zammadClient.updateUser(userId, { password })`（含错误处理与日志）
- [x] 实现 `sendWelcomeEmail()`：`zammadClient.createArticle(...)`（type=email、content_type=text/html、internal=false）

## 3. Webhook 集成

- [x] 在 `src/app/api/webhooks/zammad/route.ts` 的 created 事件中异步触发（`void ...`，不阻塞）
- [x] 仅在 `article.type === 'email'` 时触发
- [x] 增加 requestId 关联日志，便于排障

## 4. 测试与验证

- [x] 单元测试：密码生成格式/强度
- [x] 单元测试：模板变量替换
- [x] 单元测试：首封邮件 -> 设置密码 + 发送欢迎邮件
- [x] 单元测试：重复邮件 -> 不重复处理
- [x] 单元测试：现有用户（有 Region）-> 跳过处理
- [x] 单元测试：API 失败 -> 不阻塞 webhook（记录错误）

## 5. 文档

- [x] 更新 `docs/ZAMMAD-INTEGRATION.md`：说明欢迎邮件与配置项
- [x] 在 `.env.example` 增加配置说明

## 6. 代码清理

- [x] 修复 lint 错误（移除未使用的变量）
- [x] 更新文档日期
