# 站内通知系统 - 任务清单

## 1. 数据库模型

### 1.1 Prisma Schema
- [x] 1.1.1 在 `prisma/schema.prisma` 添加 Notification 模型
  ```prisma
  model Notification {
    id        String   @id @default(cuid())
    userId    String
    type      String
    title     String
    body      String
    data      String?
    read      Boolean  @default(false)
    readAt    DateTime?
    createdAt DateTime @default(now())
    expiresAt DateTime?

    @@index([userId, read])
    @@index([userId, createdAt])
    @@index([type])
    @@map("notifications")
  }
  ```
- [x] 1.1.2 执行数据库迁移
  ```bash
  npx prisma migrate dev --name add_notifications
  ```
- [x] 1.1.3 生成 Prisma Client

## 2. 核心服务层

### 2.1 类型定义
- [x] 2.1.1 创建 `src/lib/notification/types.ts`
  - NotificationType 类型
  - NotificationData 接口
  - CreateNotificationInput 接口

### 2.2 通知服务
- [x] 2.2.1 创建 `src/lib/notification/service.ts`
  - create() 方法
  - createBulk() 方法
  - getUserNotifications() 方法
  - getUnreadCount() 方法
  - markAsRead() 方法
  - markAllAsRead() 方法
  - delete() 方法
  - cleanupExpired() 方法
- [x] 2.2.2 实现通知去重逻辑
  - 5分钟内相同 (userId, type, data) 的通知不重复创建
  - 防止 Webhook 重试或快速连续事件产生重复通知
- [x] 2.2.3 导出 notificationService 单例

### 2.3 通知触发器
- [x] 2.3.1 创建 `src/lib/notification/triggers.ts`
  - notifyTicketReply()
  - notifyTicketAssigned()
  - notifyTicketUnassigned()
  - notifyTicketStatusChange()
  - notifyTicketCreated()
  - notifyTicketClosed()
  - notifyTicketReopened()
  - notifyTicketRated()
  - notifyAccountRoleChanged()
  - notifyAccountStatusChanged()

### 2.4 辅助工具函数
- [x] 2.4.1 创建 `src/lib/notification/utils.ts`
  - resolveLocalUserId(zammadUserId: number): Promise<string | null>
    - 使用 UserZammadMapping 表解析 Zammad 用户 ID 到本地用户 ID
  - getNotificationLink(data: NotificationData, userRole: string): string | null
    - 根据用户角色生成正确的跳转链接

### 2.5 模块导出
- [x] 2.5.1 创建 `src/lib/notification/index.ts`

## 3. API 端点

### 3.1 通知列表
- [x] 3.1.1 创建 `src/app/api/notifications/route.ts`
  - GET: 获取当前用户通知列表
  - 支持 limit, offset, unread 查询参数

### 3.2 未读数量
- [x] 3.2.1 创建 `src/app/api/notifications/unread-count/route.ts`
  - GET: 获取未读数量

### 3.3 标记已读
- [x] 3.3.1 创建 `src/app/api/notifications/[id]/read/route.ts`
  - PUT: 标记单个为已读
- [x] 3.3.2 创建 `src/app/api/notifications/read-all/route.ts`
  - PUT: 标记全部已读

### 3.4 删除通知
- [x] 3.4.1 在 `src/app/api/notifications/[id]/route.ts`
  - DELETE: 删除单个通知

## 4. 策略配置

### 4.1 通知策略
- [x] 4.1.1 创建 `config/policies/notification.yaml`
  - user-own-notifications: 只能访问自己的通知

## 5. Webhook 集成

### 5.1 修改现有 Webhook 处理
- [x] 5.1.1 修改 `src/app/api/webhooks/zammad/route.ts`
  - 在处理 article_created 事件时调用 notifyTicketReply()
  - 在处理 assigned 事件时调用 notifyTicketAssigned()
  - 在处理 status_changed 事件时调用 notifyTicketStatusChange()

### 5.2 修改工单创建流程
- [x] 5.2.1 修改 `src/app/api/tickets/route.ts` POST
  - 工单创建成功后调用 notifyTicketCreated()

### 5.3 修改工单分配流程
- [x] 5.3.1 修改 `src/app/api/tickets/[id]/assign/route.ts`
  - 分配成功后调用 notifyTicketAssigned()
  - 发生改派/取消分配时调用 notifyTicketUnassigned()

### 5.4 修改工单重新打开流程
- [x] 5.4.1 修改 `src/app/api/tickets/[id]/reopen/route.ts`
  - 重新打开成功后调用 notifyTicketReopened()

### 5.5 修改工单评分流程
- [x] 5.5.1 修改 `src/app/api/tickets/[id]/rating/route.ts` POST
  - 评分保存成功后调用 notifyTicketRated()

### 5.6 修改账号变更流程
- [x] 5.6.1 修改 `src/app/api/admin/users/[id]/role/route.ts`
  - 角色更新成功后调用 notifyAccountRoleChanged()
- [x] 5.6.2 修改 `src/app/api/admin/users/[id]/status/route.ts`
  - 状态更新成功后调用 notifyAccountStatusChanged()

### 5.7 自动分配失败告警
- [x] 5.7.1 修改 `src/app/api/tickets/auto-assign/route.ts`
  - 自动分配失败时创建 system_alert 通知给所有 Admin

## 6. 前端组件

### 6.1 通知 Hook
- [x] 6.1.1 创建 `src/lib/hooks/use-notifications.ts`
  - 获取通知列表
  - 获取未读数量
  - 标记已读方法
  - 标记全部已读方法
  - 轮询更新逻辑

### 6.2 通知中心组件
- [x] 6.2.1 创建 `src/components/notification/notification-center.tsx`
  - 铃铛图标 + Badge
  - 下拉面板
- [x] 6.2.2 创建 `src/components/notification/notification-item.tsx`
  - 单条通知展示
  - 已读/未读样式
  - 点击跳转
- [x] 6.2.3 创建 `src/components/notification/notification-list.tsx`
  - 通知列表渲染
  - 空状态处理
  - 加载更多

### 6.3 通知 Provider
- [x] 6.3.1 创建 `src/components/providers/notification-provider.tsx`
  - 轮询通知更新
  - 新通知 Toast 提示

### 6.4 Layout 集成
- [x] 6.4.1 修改 `src/components/layouts/admin-layout.tsx`
  - 在导航栏添加 NotificationCenter
- [x] 6.4.2 修改 `src/components/layouts/staff-layout.tsx`
  - 在导航栏添加 NotificationCenter
- [x] 6.4.3 修改 `src/components/layouts/customer-layout.tsx`
  - 在导航栏添加 NotificationCenter

## 7. 未读状态迁移

### 7.1 过渡期 (双写)
- [x] 7.1.1 修改 `src/components/providers/ticket-updates-provider.tsx`
  - 收到更新时同时刷新通知
  - 保留 unread-store 调用
- [x] 7.1.2 修改工单详情页
  - 进入时标记相关通知为已读

### 7.2 完成迁移
- [x] 7.2.1 修改 Layout 中的未读 Badge
  - 从 Notification API 读取未读数量
  - 替换 unread-store.getTotalUnread()
- [x] 7.2.2 标记 unread-store 为 deprecated

### 7.3 清理 (后续)
- [ ] 7.3.1 移除 `src/lib/stores/unread-store.ts`
- [ ] 7.3.2 移除相关 localStorage 数据

## 8. 国际化

### 8.1 翻译文件
- [x] 8.1.1 更新 `messages/en.json`
  - 添加 notifications 相关文案
- [x] 8.1.2 更新 `messages/zh-CN.json`
- [x] 8.1.3 更新其他语言文件

## 9. 测试

### 9.1 单元测试
- [x] 9.1.1 创建 `__tests__/unit/notification-service.test.ts`
  - 测试 create, markAsRead, getUnreadCount 等方法

### 9.2 API 测试
- [x] 9.2.1 创建 `__tests__/api/notifications.test.ts`
  - GET /api/notifications
  - PUT /api/notifications/[id]/read
  - PUT /api/notifications/read-all
  - DELETE /api/notifications/[id]
  - 权限测试 (不能访问他人通知)

### 9.3 集成测试
- [x] 9.3.1 测试 Webhook 触发通知创建
- [x] 9.3.2 测试前端通知中心显示

## 10. 文档

### 10.1 更新文档
- [x] 10.1.1 更新 CLAUDE.md
  - 添加通知系统说明
- [x] 10.1.2 更新 API 文档
  - 添加通知相关端点说明

---

## 进度跟踪

| 阶段 | 状态 | 备注 |
|------|------|------|
| 1. 数据库模型 | 完成 | |
| 2. 核心服务层 | 完成 | |
| 3. API 端点 | 完成 | |
| 4. 策略配置 | 完成 | |
| 5. Webhook 集成 | 完成 | |
| 6. 前端组件 | 完成 | |
| 7. 未读状态迁移 | 完成(待清理) | 7.3 清理阶段留待后续 |
| 8. 国际化 | 完成 | |
| 9. 测试 | 完成 | |
| 10. 文档 | 完成 | |

---

## 依赖关系

```
1. 数据库模型
   ↓
2. 核心服务层 ──────────────┐
   ↓                        ↓
3. API 端点              4. 策略配置
   ↓                        ↓
5. Webhook 集成 ←───────────┘
   ↓
6. 前端组件
   ↓
7. 未读状态迁移
   ↓
8. 国际化 + 9. 测试 + 10. 文档 (可并行)
```

## 优先级

| 优先级 | 任务 |
|--------|------|
| P0 | 1.1, 2.1-2.4, 3.1-3.4, 6.1-6.4 |
| P1 | 4.1, 5.1-5.3, 7.1-7.2 |
| P2 | 8.1, 9.1-9.3, 10.1 |
| P3 | 7.3 (清理阶段) |
