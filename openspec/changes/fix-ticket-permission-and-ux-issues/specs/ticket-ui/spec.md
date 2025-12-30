# 工单界面规范

## ADDED Requirements

### Requirement: 消息对齐逻辑

消息列表 SHALL 根据查看者角色正确对齐消息。

#### Scenario: Staff 视角消息对齐
- **GIVEN** 查看者角色为 Staff
- **WHEN** 查看对话消息列表
- **THEN** 客户发送的消息 SHALL 左对齐
- **AND** Staff/Admin 发送的消息 SHALL 右对齐

#### Scenario: Customer 视角消息对齐
- **GIVEN** 查看者角色为 Customer
- **WHEN** 查看对话消息列表
- **THEN** 自己发送的消息 SHALL 右对齐
- **AND** Staff/Admin 发送的消息 SHALL 左对齐

### Requirement: 工单时间格式

工单列表和详情页 SHALL 使用完整的日期时间格式。

#### Scenario: 工单列表显示完整时间
- **GIVEN** 用户查看工单列表
- **WHEN** 查看创建时间和更新时间列
- **THEN** 时间 SHALL 以 `YYYY-MM-DD HH:mm` 格式显示
- **AND** 时间 SHALL 使用用户本地时区

#### Scenario: 工单详情显示完整时间
- **GIVEN** 用户查看工单详情
- **WHEN** 查看创建时间和更新时间
- **THEN** 时间 SHALL 以 `YYYY-MM-DD HH:mm` 格式显示

### Requirement: 工单标题悬浮提示

工单列表 SHALL 为过长的标题提供悬浮提示。

#### Scenario: 长标题显示 Tooltip
- **GIVEN** 工单标题超过显示宽度被截断
- **WHEN** 用户将鼠标悬停在标题上
- **THEN** 系统 SHALL 显示包含完整标题的 Tooltip

### Requirement: NEW 状态标签样式

新工单状态标签 SHALL 使用醒目的亮色样式。

#### Scenario: NEW 标签亮色显示
- **GIVEN** 工单状态为 new
- **WHEN** 在工单列表中显示
- **THEN** 状态标签 SHALL 使用亮蓝色或亮绿色背景
- **AND** 标签 SHALL 具有足够的对比度便于识别

### Requirement: 输入框自适应高度

工单回复输入框 SHALL 根据内容自动调整高度。

#### Scenario: 输入内容自动扩展
- **GIVEN** 用户在回复输入框中输入内容
- **WHEN** 内容超过一行
- **THEN** 输入框 SHALL 自动扩展高度以显示全部内容
- **AND** 输入框 SHALL 设置最大高度限制

### Requirement: 表单验证翻译

表单验证消息 SHALL 根据用户语言显示对应翻译。

#### Scenario: 必填项提示翻译
- **GIVEN** 用户语言设置为英文
- **WHEN** 提交表单时必填项为空
- **THEN** 系统 SHALL 显示英文错误提示
- **AND** 提示 SHALL 不包含中文字符

#### Scenario: 附件按钮翻译
- **GIVEN** 用户语言设置为英文
- **WHEN** 查看附件上传按钮
- **THEN** 按钮文本 SHALL 以英文显示

### Requirement: 发送者名称本地化

消息发送者名称 SHALL 根据用户语言显示对应名称。

#### Scenario: Staff 名称本地化
- **GIVEN** 用户语言设置为英文
- **WHEN** 查看 Staff 发送的消息
- **THEN** 发送者名称 SHALL 显示为 "Support Staff" 或实际英文名
- **AND** 发送者名称 SHALL 不显示中文 "客服"

### Requirement: 工单数量统计准确

工单列表的数量统计 SHALL 与实际显示的工单数量一致。

#### Scenario: 统计数量准确
- **GIVEN** 用户查看工单列表
- **WHEN** 列表显示 N 个工单
- **THEN** 统计数字 SHALL 显示为 N
- **AND** 统计 SHALL 不包含用户无权查看的工单
