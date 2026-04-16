## MODIFIED Requirements

### Requirement: 邮件用户自动生成临时密码

当用户首次通过邮件创建工单时，系统 SHALL 自动为该用户生成临时密码，但首次判定 SHALL 不依赖 `note.Region`。

#### Scenario: 首次邮件用户获得自动密码

- **GIVEN** 用户通过邮件发送工单到 Zammad
- **AND** 用户不存在欢迎流程完成标记
- **AND** `EMAIL_USER_AUTO_PASSWORD_ENABLED` 为 `true`
- **WHEN** Webhook 处理该工单 created 事件
- **THEN** 系统 SHALL 生成安全临时密码
- **AND** 通过 Zammad API 为该用户设置密码

#### Scenario: 已有欢迎标记的用户不重复生成密码

- **GIVEN** 用户 `note` 包含欢迎流程已完成标记
- **WHEN** 该用户再次通过邮件创建工单
- **THEN** 系统 SHALL 跳过密码生成
- **AND** 系统 SHALL NOT 依赖是否存在 `Region:` 判断该用户是否为已有用户

### Requirement: 发送欢迎邮件（包含登录信息）

当系统为首次邮件用户设置密码后，系统 SHALL 发送欢迎邮件，但欢迎流程识别 SHALL 与客户分组解耦。

#### Scenario: 用户已被分配服务分组但欢迎流程未完成

- **GIVEN** 用户已经存在 `CustomerGroupAssignment`
- **AND** 用户尚未完成欢迎流程标记
- **WHEN** 用户首次通过邮件创建工单并触发欢迎逻辑
- **THEN** 系统 SHALL 仍可继续执行欢迎密码和欢迎邮件流程
- **AND** 系统 SHALL NOT 因已有服务分组而跳过欢迎逻辑
