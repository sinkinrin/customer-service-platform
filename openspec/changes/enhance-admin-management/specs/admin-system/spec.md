## ADDED Requirements

### Requirement: Admin 看板数据展示
系统 SHALL 为管理员提供可视化的看板界面，展示工单统计、员工绩效和系统状态。

#### Scenario: 查看工单趋势统计
- **WHEN** 管理员访问 Dashboard 页面
- **THEN** 系统 SHALL 显示最近7天/30天的工单趋势图表
- **AND** 图表 SHALL 包含新建、处理中、已关闭工单数量

#### Scenario: 查看员工绩效排名
- **WHEN** 管理员查看员工绩效模块
- **THEN** 系统 SHALL 显示员工处理工单数量排名
- **AND** 显示平均响应时间和解决时间

#### Scenario: 选择统计时间范围
- **WHEN** 管理员选择不同的时间范围（今天/本周/本月）
- **THEN** 系统 SHALL 刷新所有统计图表显示对应时间范围的数据

---

### Requirement: 批量用户导入
系统 SHALL 支持管理员通过上传文件批量创建用户账号。

#### Scenario: 上传用户导入文件
- **WHEN** 管理员上传 CSV 或 Excel 格式的用户数据文件
- **THEN** 系统 SHALL 解析文件并显示预览列表
- **AND** 对于格式错误的数据 SHALL 显示错误提示

#### Scenario: 确认批量导入
- **WHEN** 管理员确认导入预览正确
- **THEN** 系统 SHALL 批量创建用户账号
- **AND** 显示导入结果（成功数/失败数/失败原因）

#### Scenario: 邮箱重复检测
- **WHEN** 导入文件中存在已使用的邮箱地址
- **THEN** 系统 SHALL 标记这些记录为错误
- **AND** 跳过重复记录继续处理其他用户

---

### Requirement: 用户导出
系统 SHALL 支持管理员导出用户列表数据。

#### Scenario: 导出用户列表
- **WHEN** 管理员点击导出按钮
- **THEN** 系统 SHALL 生成包含所有用户信息的 CSV 文件
- **AND** 触发文件下载

#### Scenario: 筛选后导出
- **WHEN** 管理员应用筛选条件后点击导出
- **THEN** 系统 SHALL 仅导出符合筛选条件的用户数据

---

### Requirement: 用户状态管理
系统 SHALL 支持管理员激活或禁用用户账号。

#### Scenario: 禁用用户账号
- **WHEN** 管理员将用户状态设为禁用
- **THEN** 系统 SHALL 更新用户状态为禁用
- **AND** 该用户后续登录尝试 SHALL 被拒绝

#### Scenario: 激活用户账号
- **WHEN** 管理员将用户状态设为激活
- **THEN** 系统 SHALL 更新用户状态为激活
- **AND** 用户可以正常登录系统

---

### Requirement: 管理员重置用户密码
系统 SHALL 支持管理员为用户重置密码。

#### Scenario: 重置用户密码
- **WHEN** 管理员对指定用户执行密码重置操作
- **THEN** 系统 SHALL 生成新的临时密码
- **AND** 向用户邮箱发送包含新密码的通知邮件

---

### Requirement: 用户详情查看
系统 SHALL 提供用户详情页面展示完整的用户信息和活动历史。

#### Scenario: 查看用户详情
- **WHEN** 管理员点击用户列表中的某个用户
- **THEN** 系统 SHALL 显示用户详情页面
- **AND** 页面 SHALL 包含基本信息、创建时间、最后登录时间

#### Scenario: 查看用户关联工单
- **WHEN** 管理员在用户详情页查看工单标签
- **THEN** 系统 SHALL 显示该用户创建或处理的所有工单列表

---

### Requirement: 用户区域管理
系统 SHALL 支持展示、筛选和修改用户的区域信息。

#### Scenario: 用户列表展示区域
- **WHEN** 管理员查看用户列表
- **THEN** 系统 SHALL 在表格中显示用户的区域列
- **AND** 区域名称 SHALL 使用本地化标签展示

#### Scenario: 按区域筛选用户
- **WHEN** 管理员选择区域筛选条件
- **THEN** 系统 SHALL 仅显示属于该区域的用户
- **AND** 可以与角色筛选组合使用

#### Scenario: Admin 修改用户区域
- **WHEN** 管理员编辑用户信息并修改区域
- **THEN** 系统 SHALL 更新用户的区域字段
- **AND** 对于 Staff 用户 SHALL 同步更新 Zammad Group 权限
- **AND** 对于 Customer 用户 SHALL 更新 Zammad note 字段

