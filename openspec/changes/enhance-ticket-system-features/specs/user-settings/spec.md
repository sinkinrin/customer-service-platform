## ADDED Requirements

### Requirement: 用户头像上传
系统 SHALL 允许用户上传和更换个人头像。

#### Scenario: 用户上传头像
- **GIVEN** 用户在Profile设置页面
- **WHEN** 点击头像区域并选择图片文件
- **THEN** 系统 SHALL 显示图片预览，支持裁剪，保存后头像更新

---

## MODIFIED Requirements

### Requirement: 用户资料设置
用户 SHALL 能在Profile设置中管理个人信息，包括头像、语言偏好等。

#### Scenario: 完整资料设置
- **GIVEN** 用户在Settings页面
- **WHEN** 查看Profile设置
- **THEN** 用户 SHALL 能编辑：头像、姓名、邮箱、语言偏好、时区
