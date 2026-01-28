# 规范：邮件用户欢迎系统

## ADDED Requirements

### Requirement: 邮件用户自动生成临时密码

当用户首次通过邮件创建工单时，系统 SHALL 自动为该用户生成临时密码，并通过 Zammad API 设置密码。

#### Scenario: 首次邮件用户获得自动密码
- **GIVEN** 用户通过邮件发送工单到 Zammad
- **AND** 用户 `note` 不包含 `WelcomeEmailSent:`
- **AND** `EMAIL_USER_AUTO_PASSWORD_ENABLED` 为 `true`
- **WHEN** Webhook 处理该工单 created 事件
- **THEN** 系统生成 12 位安全随机密码
- **AND** 通过 Zammad API 为该用户设置密码
- **AND** 记录操作日志

#### Scenario: 已发送过欢迎邮件的用户不重复处理
- **GIVEN** 用户 `note` 包含 `WelcomeEmailSent:`
- **WHEN** 该用户再次通过邮件创建工单
- **THEN** 系统跳过密码生成与欢迎邮件发送流程
- **AND** 不修改用户现有密码

#### Scenario: 功能开关关闭时跳过处理
- **GIVEN** `EMAIL_USER_AUTO_PASSWORD_ENABLED` 为 `false`
- **WHEN** 首次邮件用户创建工单
- **THEN** 系统跳过密码生成流程

---

### Requirement: 发送欢迎邮件（包含登录信息）

当系统为首次邮件用户设置密码后，系统 SHALL 发送包含登录信息的欢迎邮件。

#### Scenario: 发送欢迎邮件成功
- **GIVEN** 系统已为首次邮件用户设置密码
- **AND** `EMAIL_USER_WELCOME_EMAIL_ENABLED` 为 `true`
- **WHEN** 密码设置成功
- **THEN** 系统通过 Zammad Article API 发送欢迎邮件（HTML）
- **AND** 欢迎邮件包含：登录邮箱、临时密码、登录链接、醒目的安全提示（首次登录后立即改密）
- **AND** 在用户 `note` 中写入 `WelcomeEmailSent:` 标记（含时间戳）

#### Scenario: 欢迎邮件功能开关关闭
- **GIVEN** `EMAIL_USER_WELCOME_EMAIL_ENABLED` 为 `false`
- **AND** `EMAIL_USER_AUTO_PASSWORD_ENABLED` 为 `true`
- **WHEN** 系统为首次邮件用户生成密码
- **THEN** 系统设置密码但不发送欢迎邮件

#### Scenario: 防止重复发送欢迎邮件
- **GIVEN** 用户 `note` 包含 `WelcomeEmailSent:`
- **WHEN** 该用户再次通过邮件创建工单
- **THEN** 系统跳过欢迎邮件发送

---

### Requirement: 不阻塞主流程

欢迎处理 MUST 异步执行，不影响 webhook 响应与工单创建主流程。

#### Scenario: API 调用失败不阻塞 webhook
- **GIVEN** 首次邮件用户创建工单
- **WHEN** Zammad API 调用失败（网络错误、服务不可用等）
- **THEN** Webhook 仍正常返回成功响应
- **AND** 工单创建主流程不受影响
- **AND** 错误被记录到日志

---

### Requirement: 邮件发送失败时允许下次重试

当密码设置成功但欢迎邮件发送失败时，系统 SHALL 允许下次工单触发再次尝试。

#### Scenario: 邮件发送失败时不写入标记
- **GIVEN** 系统已为用户设置密码
- **WHEN** 发送欢迎邮件失败
- **THEN** 系统不应在用户 `note` 写入 `WelcomeEmailSent:` 标记
- **AND** 下次该用户创建工单时会再次尝试发送欢迎邮件

---

### Requirement: 安全密码生成

生成的临时密码 MUST 满足安全要求。

#### Scenario: 密码格式要求
- **WHEN** 系统生成临时密码
- **THEN** 密码长度为 12 位
- **AND** 包含大写字母、小写字母、数字
- **AND** 不包含易混淆字符（0/O、1/l/I）
- **AND** 使用加密安全的随机数生成器

