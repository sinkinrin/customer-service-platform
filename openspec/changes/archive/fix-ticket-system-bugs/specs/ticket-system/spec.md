## MODIFIED Requirements

### Requirement: 工单列表筛选状态持久化
系统 SHALL 在用户导航离开工单列表页后返回时保持之前的筛选状态。

#### Scenario: 用户筛选后查看详情再返回
- **GIVEN** 用户在工单列表页面筛选了"未关闭"状态的工单
- **WHEN** 用户点击某个工单查看详情，然后返回列表页
- **THEN** 列表 SHALL 保持"未关闭"状态的筛选，而不是重置为显示所有工单

### Requirement: 工单创建者角色正确显示
系统 SHALL 正确显示工单创建者的角色，客户创建的工单 MUST 显示为Customer而非Staff。

#### Scenario: 客户创建工单
- **GIVEN** 一个角色为Customer的用户
- **WHEN** 该用户创建新工单
- **THEN** 工单的创建者角色 SHALL 显示为"Customer"

### Requirement: 工单附件跨角色可见
客户上传的工单附件 SHALL 在技术支持界面正确显示和可下载。

#### Scenario: Staff查看客户上传的附件
- **GIVEN** 客户在创建工单时上传了附件
- **WHEN** 技术支持人员查看该工单详情
- **THEN** Staff SHALL 能看到附件列表并可以下载这些附件

### Requirement: 工单状态明确显示
系统 SHALL 在工单详情页明显位置（如右上角）显示当前工单状态。

#### Scenario: 查看工单状态
- **GIVEN** 用户打开一个状态为"pending close"的工单
- **WHEN** 查看工单详情页
- **THEN** 右上角 SHALL 显示状态徽章，标明"待关闭"状态

### Requirement: 用户语言偏好设置
用户 SHALL 能在Profile设置中更改语言偏好，且设置 MUST 生效。

#### Scenario: 用户更改语言设置
- **GIVEN** 用户在Settings页面
- **WHEN** 用户选择不同的语言（如从英文切换到中文）并保存
- **THEN** 页面 SHALL 刷新并显示所选语言的界面文本

### Requirement: System Config页面可访问
Admin用户 SHALL 能通过侧边栏访问System Config页面。

#### Scenario: Admin访问系统配置
- **GIVEN** Admin用户登录后台
- **WHEN** 点击侧边栏的"System Config"菜单
- **THEN** 系统 SHALL 正确导航到系统配置页面，而非无响应
