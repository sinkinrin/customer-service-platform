## ADDED Requirements

### Requirement: 工单评价系统
系统 SHALL 允许客户在工单关闭后对服务进行评价，包括好评/差评及理由。

#### Scenario: 客户提交工单评价
- **GIVEN** 工单已关闭
- **WHEN** 客户查看已关闭工单详情
- **THEN** 系统 SHALL 显示评价入口，允许选择好评/差评并填写理由

#### Scenario: Admin查看评价统计
- **GIVEN** Admin用户登录
- **WHEN** 查看评价统计面板
- **THEN** 系统 SHALL 显示总体好评率和差评详情列表

---

### Requirement: 工单重新激活
系统 SHALL 允许客户重新打开已关闭的工单。

#### Scenario: 客户重开工单
- **GIVEN** 客户查看自己的已关闭工单
- **WHEN** 点击"重新打开"按钮并确认
- **THEN** 工单状态 SHALL 变为open，并通知相关Staff

---

### Requirement: 回复模板管理
系统 SHALL 提供回复模板功能，允许Staff快速插入预定义的回复内容。

#### Scenario: Staff使用回复模板
- **GIVEN** Staff在工单回复界面
- **WHEN** 点击"插入模板"并选择一个模板
- **THEN** 模板内容 SHALL 插入到回复框，变量自动替换为实际值

#### Scenario: Admin管理回复模板
- **GIVEN** Admin在模板管理界面
- **WHEN** 创建新模板，填写名称、分类和内容
- **THEN** 模板 SHALL 保存成功，Staff可在回复时使用

---

### Requirement: 工单高级排序筛选
系统 SHALL 支持按优先级对工单进行排序和筛选。

#### Scenario: Staff按优先级筛选工单
- **GIVEN** Staff在工单列表页面
- **WHEN** 选择筛选条件为"高优先级"
- **THEN** 列表 SHALL 只显示高优先级的工单

#### Scenario: Staff按优先级排序工单
- **GIVEN** Staff在工单列表页面
- **WHEN** 选择排序方式为"优先级：高→低"
- **THEN** 列表 SHALL 按优先级从高到低排列

---

### Requirement: 工单导出功能
系统 SHALL 支持导出工单数据为CSV或Excel格式。

#### Scenario: Admin导出全部工单
- **GIVEN** Admin用户登录
- **WHEN** 在工单列表点击"导出"并选择格式
- **THEN** 系统 SHALL 下载包含所有工单信息的文件

#### Scenario: Staff导出自己的工单
- **GIVEN** Staff用户登录
- **WHEN** 在工单列表点击"导出"
- **THEN** 系统 SHALL 下载仅包含自己负责工单的文件

---

### Requirement: AI工单摘要
系统 SHALL 提供AI生成的工单对话摘要功能。

#### Scenario: 查看AI摘要
- **GIVEN** 用户查看工单详情
- **WHEN** 页面加载完成
- **THEN** 工单顶部 SHALL 显示AI生成的对话摘要和解决状态

---

### Requirement: SLA时效管理
系统 SHALL 支持SLA时效规则配置和超时提醒。

#### Scenario: 配置SLA规则
- **GIVEN** Admin在系统设置
- **WHEN** 配置SLA规则（如：高优先级24小时内响应）
- **THEN** 规则 SHALL 保存并对新工单生效

#### Scenario: 超时提醒
- **GIVEN** 一个高优先级工单超过24小时未响应
- **WHEN** 系统检查SLA状态
- **THEN** 系统 SHALL 向负责的Staff发送提醒通知

---

### Requirement: 工单状态邮件通知
系统 SHALL 在工单状态变更时自动发送邮件通知客户。

#### Scenario: 状态变更通知
- **GIVEN** 客户有一个open状态的工单
- **WHEN** Staff将工单状态改为pending close
- **THEN** 客户 SHALL 收到邮件通知，告知工单状态变更

---

## MODIFIED Requirements

### Requirement: 工单详情页布局
工单详情页 SHALL 采用优化布局，对话内容居中，状态信息靠右，AI摘要置顶。

#### Scenario: 查看工单详情
- **GIVEN** 用户打开工单详情页
- **WHEN** 页面加载完成
- **THEN** 系统 SHALL 显示三栏布局：顶部AI摘要、中间对话区域、右侧状态信息面板

### Requirement: 工单消息样式
工单对话中的消息 SHALL 根据发送者角色使用不同的视觉样式。

#### Scenario: 查看工单对话
- **GIVEN** 用户查看工单详情
- **WHEN** 对话区域显示消息列表
- **THEN** 客户消息 SHALL 左对齐浅灰背景，员工消息 SHALL 右对齐蓝色背景
