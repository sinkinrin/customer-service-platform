# AI智能服务反馈 - Ticket系统测试问题汇总

> 测试日期：2025/12/19
> 整理日期：2025/12/22

---

## 问题状态说明

- **已知解决**: 问题已通过代码修改解决
- **已确认原因**: 已定位问题根因，待修复
- **待开发**: 需要新增功能
- **待调研**: 需要进一步分析

---

## 一、BUG类问题（需修复）

### 1.1 文件上传/下载问题

| # | 角色 | 问题描述 | 反馈人 | 状态 | 相关代码 |
|---|------|---------|--------|------|----------|
| 2 | 客户 | 附件图片无法上传 | Edward | 待调研 | `src/app/api/files/upload/route.ts` |
| 19 | 客户 | 客户提交工单上传的附件，无法送到技术支持界面 | Luca | 待调研 | `src/lib/file-storage.ts` |
| 27 | 客户 | 发送的文件无法下载 | Kevin | 待调研 | `src/app/api/files/[id]/download/route.ts` |

**分析**：
- 文件上传API已实现 (`src/app/api/files/upload/route.ts:88`)
- 文件下载API已实现 (`src/app/api/files/[id]/download/route.ts`)
- 需检查前端调用是否正确、文件存储路径配置是否正确

### 1.2 工单权限分配问题

| # | 角色 | 问题描述 | 反馈人 | 状态 | 相关代码 |
|---|------|---------|--------|------|----------|
| 5 | 客户 | 客户上传的工单信息所属的角色为Staff | Edward | 已确认原因 | 用户导入时region分配 |
| 10 | 技术支持 | 非洲区提交工单，技术支持无法显示对话框，回复用户 | Cody | 已确认原因 | `src/lib/constants/regions.ts` |
| 11 | 技术支持 | 点击查看工单历史时，查看到其他区域或者客户提交的工单 | Cody | 已确认原因 | `src/lib/utils/region-auth.ts` |
| 28 | 技术支持 | support邮箱接收工单，未分配技术人员，美国技术支持可以直接预览，但是无法回复操作 | Cody | 待调研 | `src/app/api/tickets/[id]/articles/route.ts` |
| 34 | 技术支持 | 客户发送support邮箱，admin分配给美国客户技术支持，技术支持无法在线回复 | Cody | 待调研 | 同上 |

**分析**：
- **根本原因**：自动导入账号时区域分配出错
- 区域分配逻辑在 `src/app/api/admin/users/import/route.ts:203`
- 权限过滤逻辑在 `src/lib/utils/region-auth.ts:132` (`filterTicketsByRegion`)
- Staff group_ids 映射可能不正确

### 1.3 消息/聊天相关问题

| # | 角色 | 问题描述 | 反馈人 | 状态 | 相关代码 |
|---|------|---------|--------|------|----------|
| 3 | 技术支持 | 员工发送信息对话框在左侧 | Archer | 待调研 | `src/components/conversation/message-list.tsx` |
| 8 | 客户 | 退出Live聊天后，重新进入会出现消息互串问题 | Edward | 待调研 | `src/lib/stores/conversation-store.ts` |
| 20 | 技术支持 | 不小心点了close后无法恢复聊天了，重启对话后聊天记录丢失 | Dover | 待调研 | `src/lib/local-conversation-storage.ts` |

### 1.4 转人工/对话相关问题（已删除功能）

| # | 角色 | 问题描述 | 反馈人 | 状态 |
|---|------|---------|--------|------|
| 6 | 技术支持 | 客户转人工对话，但是技术无法回复 | Cody | **已删除该功能** |
| 9 | 客户 | 切换人工，再切换AI，然后切换人工后，无法进入人工对话 | Jason | **已删除该功能** |
| 22 | 技术支持 | 客户发来对话，技术支持点击认领对话 | Cody | **已删除该功能** |

> 注意：转人工对话功能已从系统中移除，相关文件已删除

### 1.5 设置/配置问题

| # | 角色 | 问题描述 | 反馈人 | 状态 | 相关代码 |
|---|------|---------|--------|------|----------|
| 23 | 技术支持 | Profile information的language选项无效 | Dover | 待调研 | `src/app/staff/settings/page.tsx:204-222` |
| 25 | 技术支持 | 无法改头像，希望1.0能完善此功能 | Dover | 待开发 | 头像上传功能暂禁用 (line:152 `disabled`) |
| 43 | Admin | SYSTEM CONFIG 点击无效 | SHAMY | 待调研 | Admin系统配置页面 |

**分析**：
- 语言选择UI存在 (`src/app/staff/settings/page.tsx:204-222`)，但可能没有实际保存逻辑
- 头像上传按钮已禁用 (`src/app/staff/settings/page.tsx:152`)

### 1.6 工单状态/筛选问题

| # | 角色 | 问题描述 | 反馈人 | 状态 | 相关代码 |
|---|------|---------|--------|------|----------|
| 4 | 技术支持 | 点击选择未关闭工单，跳转页面返回后未记录操作，返回初始所有工单 | Cody | 待调研 | `src/app/staff/tickets/page.tsx` |
| 21 | 客户 | 工单状态未显示，右上角待关闭状态需要显示 | Cody | 待调研 | 工单详情页面 |

---

## 二、新功能需求

### 2.1 高优先级（P0）

| # | 角色 | 功能需求 | 反馈人 | 涉及模块 |
|---|------|---------|--------|---------|
| 24 | 客户 | 消息对话框的提示红点，需要仅在有新消息时显示 | Luca | 通知系统 |
| 26 | 技术支持 | 支持工单按优先级排序/筛选 | Jason | `src/app/staff/tickets/page.tsx` |
| 29 | 技术支持 | 增加时效管理，超过规定时间还没处理完，需要邮件/工单页面弹窗定时提醒 | Jason | 新功能 |
| 33 | 客户 | 工单处理进度变更时，自动发送邮件提醒客户 | Jason | 邮件通知系统 |

### 2.2 中优先级（P1）

| # | 角色 | 功能需求 | 反馈人 | 涉及模块 |
|---|------|---------|--------|---------|
| 7 | 技术支持 | 需要添加允许建立快捷话术的功能 | Archer | 回复模板 |
| 12 | 技术支持 | 对于工单、对话增加AI概要的功能，总结内容，解决状态 | Archer | AI摘要 |
| 13 | 客户 | 对于机型，需要有个模糊匹配。AT5属于MDT，答案属于MDVR的 | Kevin | FAQ匹配算法 |
| 14 | 客户 | 需要添加好评和差评，以及好评原因或差评理由 | Jason | 评价系统 |
| 15 | 客户 | 需要添加客户重新激活工单的开关 | Jason | 工单状态 |
| 16 | 技术支持 | 增加回复模板；邮箱发送到support邮箱，admin分配给区域，技术支持在首次与客户对接时，发送模板 | Cody | 邮件模板 |
| 17 | 客户 | 可以参考禅道，让客户提交问题时，引导客户填写设备安装环境、设备安装日期，出现问题日期，出现问题数量 | Jason | 工单表单 |

### 2.3 低优先级（P2）

| # | 角色 | 功能需求 | 反馈人 | 涉及模块 |
|---|------|---------|--------|---------|
| 18 | 技术支持 | 客户管理界面点击查看工单目前会直接跳转，希望用小窗展示历史工单记录 | Archer | 客户管理UI |
| 35 | Admin | admin账号下需要可以下载全部的TICKET，各个STAFF账号下可以下载各自的TICKET | SHAMY | 数据导出 |
| 36 | Admin | TICKET状态等基本信息放右边，把中间留给对话，上面有AI SUMMARY | SHAMY | 工单UI布局 |
| 37 | Admin | 员工和客户的对接，用不同底色，一目了然 | SHAMY | 消息UI样式 |

### 2.4 用户注册/管理相关

| # | 角色 | 功能需求 | 反馈人 | 涉及模块 |
|---|------|---------|--------|---------|
| 32 | 客户 | 未注册用户发了邮件到SUPPORT，收到邮件，找到TICKET SYSTEM，申请注册，由ADMIN审核是否通过账户申请 | SHAMY | 注册审核流程 |
| 38 | Admin | 看到新的工单，需要可以识别该用户是否已注册用户，还是未注册用户，ADMIN可以给未注册用户注册 | SHAMY | 用户识别 |
| 39 | Admin | 工单REASSIGN统一入口 | SHAMY | 分配管理 |

### 2.5 邮件模板相关

| # | 角色 | 功能需求 | 反馈人 | 涉及模块 |
|---|------|---------|--------|---------|
| 30 | 技术支持 | 邮件自动恢复，签名需要修改，需要修改Ticket系统URL，增加各区域技术的联系方式Whatsapp | Cody | Zammad配置 |
| 31 | 客户 | 客户收到的自动回复邮件模版需要修改，工单入口，签名要修改 | SHAMY | Zammad配置 |

### 2.6 FAQ系统

| # | 角色 | 功能需求 | 反馈人 | 涉及模块 |
|---|------|---------|--------|---------|
| 40 | Admin | FAQ由技术支持部提供初稿，经过AI优化，放到工单系统在线页面，ADMIN可以用EXCEL表格导入/导出，可以按照产品类别搜索 | SHAMY | FAQ管理 |

### 2.7 暂时屏蔽的功能

| # | 角色 | 功能需求 | 反馈人 | 状态 |
|---|------|---------|--------|------|
| 42 | Admin | BUSINESS TYPE暂时没有这个功能，先屏蔽 | SHAMY | 暂不开发 |

---

## 三、相关代码位置汇总

### 文件上传/下载
- `src/app/api/files/upload/route.ts` - 文件上传API
- `src/app/api/files/[id]/route.ts` - 文件获取API
- `src/app/api/files/[id]/download/route.ts` - 文件下载API
- `src/lib/file-storage.ts` - 文件存储工具函数

### 区域权限
- `src/lib/utils/region-auth.ts` - 区域权限校验逻辑
- `src/lib/constants/regions.ts` - 区域常量定义
- `src/app/api/admin/users/import/route.ts` - 用户批量导入（区域分配）

### 工单系统
- `src/app/api/tickets/route.ts` - 工单列表API
- `src/app/api/tickets/[id]/route.ts` - 工单详情API
- `src/app/api/tickets/[id]/articles/route.ts` - 工单回复API
- `src/app/staff/tickets/page.tsx` - Staff工单页面
- `src/app/admin/tickets/page.tsx` - Admin工单页面

### 用户设置
- `src/app/staff/settings/page.tsx` - Staff设置页面
- `src/app/customer/settings/page.tsx` - 客户设置页面

### 消息/对话
- `src/components/conversation/message-list.tsx` - 消息列表组件
- `src/lib/stores/conversation-store.ts` - 对话状态管理
- `src/lib/local-conversation-storage.ts` - 本地对话存储

### 用户映射
- `src/lib/zammad/user-mapping.ts` - Zammad用户映射
- `src/lib/zammad/client.ts` - Zammad API客户端

---

## 四、修复优先级建议

### 第一优先级（影响核心功能）
1. 文件上传/下载问题 - 影响附件功能
2. 工单权限分配问题 - 影响多区域使用
3. 语言设置无效 - 影响国际化用户

### 第二优先级（用户体验）
1. 消息红点提示
2. 工单状态显示
3. 工单筛选/排序

### 第三优先级（新功能）
1. 快捷回复模板
2. AI摘要功能
3. 时效管理提醒
