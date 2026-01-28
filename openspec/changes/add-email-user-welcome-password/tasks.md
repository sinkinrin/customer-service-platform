# 任务清单：邮件用户自动生成欢迎密码

## 1. 配置与常量

- [ ] 在 `.env.example` 添加：
  - `EMAIL_USER_AUTO_PASSWORD_ENABLED=true`
  - `EMAIL_USER_WELCOME_EMAIL_ENABLED=true`
  - `WEB_PLATFORM_URL=`
- [ ] 在 `src/lib/env.ts` 增加上述环境变量读取与校验
- [ ] 新增 `src/lib/constants/email-templates.ts`：欢迎邮件 HTML 模板（首版至少英文）

## 2. 核心逻辑

- [ ] 新增 `src/lib/ticket/email-user-welcome.ts`
- [ ] 实现 `generateSecurePassword()`：12 位安全随机密码（crypto.randomBytes + 排除易混淆字符）
- [ ] 实现去重判定（基于 user.note 标记）
- [ ] 实现 `setUserPassword()`：`zammadClient.updateUser(userId, { password })`（含错误处理与日志）
- [ ] 实现 `sendWelcomeEmail()`：`zammadClient.createArticle(...)`（type=email、content_type=text/html、internal=false）
- [ ] 成功发送后写入 `WelcomeEmailSent:` 标记（含时间戳）

## 3. Webhook 集成

- [ ] 在 `src/app/api/webhooks/zammad/route.ts` 的 created 事件中异步触发（`void ...`，不阻塞）
- [ ] 仅在 `article.type === 'email'` 时触发
- [ ] 增加 requestId 关联日志，便于排障

## 4. 测试与验证

- [ ] 单元测试：密码生成格式/强度
- [ ] 单元测试：模板变量替换
- [ ] 集成测试：首封邮件 -> 设置密码 + 发送欢迎邮件
- [ ] 集成测试：重复邮件 -> 不重复处理
- [ ] 集成测试：API 失败 -> 不阻塞 webhook（记录错误）

## 5. 文档

- [ ] 更新 `docs/ZAMMAD-INTEGRATION.md`：说明欢迎邮件与配置项
- [ ] 在 `.env.example` 增加配置说明

