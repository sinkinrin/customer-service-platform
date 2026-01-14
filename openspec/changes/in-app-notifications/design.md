# 站内通知系统 - 架构设计

## 1. 现有架构分析

### 1.1 当前通知相关组件

```
┌─────────────────────────────────────────────────────────────────┐
│                       现有架构                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Zammad Webhook ──► TicketUpdate (DB) ──► /api/tickets/updates  │
│                                                │                │
│                                                ▼                │
│                                   useTicketUpdates (轮询 Hook)   │
│                                                │                │
│                                                ▼                │
│                               TicketUpdatesProvider             │
│                                    │         │                  │
│                                    ▼         ▼                  │
│                            Toast通知    unread-store            │
│                          (即时, 无持久化)  (localStorage)        │
│                                                │                │
│                                                ▼                │
│                                   Layout Badge (未读数)          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 问题分析

| 问题 | 现状 | 影响 |
|------|------|------|
| 存储分散 | localStorage + DB 混用 | 数据不一致风险 |
| 无历史记录 | Toast 即时消失 | 用户无法回顾 |
| 仅工单通知 | 硬编码工单事件 | 难以扩展 |
| 无统一 UI | 分散在各页面 | 体验碎片化 |

## 2. 新架构设计

### 2.1 整体架构

```
┌───────────────────────────────────────────────────────────────────────┐
│                         新架构                                         │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐               │
│  │   Zammad    │    │  系统事件   │    │   管理操作   │               │
│  │  Webhook    │    │  (分配等)   │    │   (审批等)   │               │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘               │
│         │                  │                  │                       │
│         └──────────────────┼──────────────────┘                       │
│                            ▼                                          │
│              ┌─────────────────────────────┐                          │
│              │    NotificationService      │                          │
│              │    (src/lib/notification)   │                          │
│              │                             │                          │
│              │  - createNotification()     │                          │
│              │  - createBulk()             │                          │
│              │  - getUserNotifications()   │                          │
│              │  - markAsRead()             │                          │
│              │  - markAllAsRead()          │                          │
│              └─────────────┬───────────────┘                          │
│                            │                                          │
│                            ▼                                          │
│              ┌─────────────────────────────┐                          │
│              │    Notification (Prisma)    │                          │
│              │    - id, userId, type       │                          │
│              │    - title, body, data      │                          │
│              │    - read, readAt           │                          │
│              │    - createdAt              │                          │
│              └─────────────┬───────────────┘                          │
│                            │                                          │
│              ┌─────────────┴───────────────┐                          │
│              │                             │                          │
│              ▼                             ▼                          │
│  ┌─────────────────────┐      ┌─────────────────────┐                │
│  │ /api/notifications  │      │ useNotifications    │                │
│  │ GET: 获取列表        │      │ (前端 Hook)         │                │
│  │ PUT: 标记已读        │      │ + 轮询/SSE          │                │
│  │ DELETE: 删除         │      └──────────┬──────────┘                │
│  └─────────────────────┘                  │                          │
│                                           ▼                          │
│                           ┌─────────────────────────────┐            │
│                           │   NotificationCenter (UI)    │            │
│                           │   - 导航栏铃铛图标           │            │
│                           │   - 下拉通知列表             │            │
│                           │   - 未读 Badge              │            │
│                           │   - 一键已读                 │            │
│                           └─────────────────────────────┘            │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

### 2.2 数据模型

```prisma
// prisma/schema.prisma

model Notification {
  id        String   @id @default(cuid())
  userId    String   // 接收者用户 ID

  // 通知类型 (用于前端图标/颜色/路由)
  type      String   // 'ticket_reply' | 'ticket_assigned' | 'ticket_status' | 'ticket_closed' | 'ticket_reopened' | 'ticket_rated' | 'system_alert' | 'mention'

  // 通知内容
  title     String   // 短标题: "新工单回复"
  body      String   // 详细内容: "客户 xxx 回复了工单 #10001"

  // 关联数据 (JSON)
  data      String?  // { ticketId, articleId, ... }

  // 状态
  read      Boolean  @default(false)
  readAt    DateTime?

  // 时间戳
  createdAt DateTime @default(now())
  expiresAt DateTime? // 可选: 通知过期时间

  @@index([userId, read])
  @@index([userId, createdAt])
  @@index([type])
  @@map("notifications")
}
```

### 2.3 通知类型定义

```typescript
// src/lib/notification/types.ts

export type NotificationType =
  | 'ticket_reply'      // 工单有新回复
  | 'ticket_assigned'   // 工单被分配给你
  | 'ticket_unassigned' // 工单不再由你负责（被改派/取消分配）
  | 'ticket_status'     // 工单状态变更
  | 'ticket_created'    // 新工单创建
  | 'ticket_closed'     // 工单被关闭
  | 'ticket_reopened'   // 工单被重新打开
  | 'ticket_rated'      // 工单收到评分
  | 'system_alert'      // 系统警告
  | 'mention'           // 被 @ 提及
  | 'account_role_changed'   // 用户角色变更
  | 'account_status_changed' // 用户状态变更
  | 'task_reminder'     // 任务提醒

export interface NotificationData {
  // 通用
  link?: string         // 点击跳转链接

  // 工单相关
  ticketId?: number
  ticketNumber?: string
  ticketTitle?: string
  articleId?: number
  senderEmail?: string

  // 评分相关
  rating?: 'positive' | 'negative'
  reason?: string

  // 账号相关
  previousRole?: 'customer' | 'staff' | 'admin'
  newRole?: 'customer' | 'staff' | 'admin'
  active?: boolean

  // 系统相关
  severity?: 'info' | 'warning' | 'error'
}

export interface CreateNotificationInput {
  userId: string
  type: NotificationType
  title: string
  body: string
  data?: NotificationData
}
```

## 3. 核心服务设计

### 3.1 NotificationService

```typescript
// src/lib/notification/service.ts

import { prisma } from '@/lib/prisma'
import type { CreateNotificationInput, NotificationType } from './types'

export class NotificationService {
  /**
   * 创建单个通知
   * 包含去重逻辑：5分钟内相同 (userId, type, data) 的通知将被忽略
   */
  async create(input: CreateNotificationInput): Promise<void> {
    const dataJson = input.data ? JSON.stringify(input.data) : null

    // 去重检查：5分钟内相同通知不重复创建
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
    const recentDuplicate = await prisma.notification.findFirst({
      where: {
        userId: input.userId,
        type: input.type,
        data: dataJson,
        createdAt: { gte: fiveMinutesAgo }
      }
    })

    if (recentDuplicate) {
      // 跳过重复通知
      return
    }

    await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        data: dataJson,
      }
    })
  }

  /**
   * 批量创建通知 (同一事件通知多人)
   */
  async createBulk(inputs: CreateNotificationInput[]): Promise<void> {
    await prisma.notification.createMany({
      data: inputs.map(input => ({
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        data: input.data ? JSON.stringify(input.data) : null,
      }))
    })
  }

  /**
   * 获取用户通知列表
   */
  async getUserNotifications(
    userId: string,
    options: { limit?: number; offset?: number; unreadOnly?: boolean } = {}
  ) {
    const { limit = 50, offset = 0, unreadOnly = false } = options

    return prisma.notification.findMany({
      where: {
        userId,
        ...(unreadOnly ? { read: false } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    })
  }

  /**
   * 获取未读数量
   */
  async getUnreadCount(userId: string): Promise<number> {
    return prisma.notification.count({
      where: { userId, read: false }
    })
  }

  /**
   * 标记为已读
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { read: true, readAt: new Date() }
    })
  }

  /**
   * 标记全部已读
   */
  async markAllAsRead(userId: string): Promise<void> {
    await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true, readAt: new Date() }
    })
  }

  /**
   * 删除通知
   */
  async delete(notificationId: string, userId: string): Promise<void> {
    await prisma.notification.deleteMany({
      where: { id: notificationId, userId }
    })
  }

  /**
   * 清理过期通知 (可由 cron 调用)
   */
  async cleanupExpired(): Promise<number> {
    const result = await prisma.notification.deleteMany({
      where: {
        expiresAt: { lt: new Date() }
      }
    })
    return result.count
  }
}

export const notificationService = new NotificationService()
```

### 3.2 通知触发点集成

```typescript
// src/lib/notification/triggers.ts

import { notificationService } from './service'
import type { NotificationData } from './types'

/**
 * 工单新回复通知
 */
export async function notifyTicketReply(
  recipientUserId: string,
  ticketId: number,
  ticketNumber: string,
  senderEmail: string
): Promise<void> {
  await notificationService.create({
    userId: recipientUserId,
    type: 'ticket_reply',
    title: `工单 #${ticketNumber} 有新回复`,
    body: `${senderEmail} 回复了您的工单`,
    data: {
      ticketId,
      ticketNumber,
      senderEmail,
      link: `/tickets/${ticketId}`,
    }
  })
}

/**
 * 工单分配通知
 */
export async function notifyTicketAssigned(
  staffUserId: string,
  ticketId: number,
  ticketNumber: string,
  ticketTitle: string
): Promise<void> {
  await notificationService.create({
    userId: staffUserId,
    type: 'ticket_assigned',
    title: '新工单已分配给您',
    body: `#${ticketNumber} - ${ticketTitle}`,
    data: {
      ticketId,
      ticketNumber,
      ticketTitle,
      link: `/staff/tickets/${ticketId}`,
    }
  })
}

/**
 * 工单状态变更通知
 */
export async function notifyTicketStatusChange(
  recipientUserId: string,
  ticketId: number,
  ticketNumber: string,
  newStatus: string
): Promise<void> {
  await notificationService.create({
    userId: recipientUserId,
    type: 'ticket_status',
    title: `工单 #${ticketNumber} 状态已更新`,
    body: `状态变更为: ${newStatus}`,
    data: {
      ticketId,
      ticketNumber,
      link: `/tickets/${ticketId}`,
    }
  })
}
```

## 4. API 设计

### 4.1 端点列表

| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| GET | /api/notifications | 获取当前用户通知列表 | authenticated |
| GET | /api/notifications/unread-count | 获取未读数量 | authenticated |
| PUT | /api/notifications/[id]/read | 标记单个为已读 | owner |
| PUT | /api/notifications/read-all | 标记全部已读 | authenticated |
| DELETE | /api/notifications/[id] | 删除单个通知 | owner |

### 4.2 响应格式

```typescript
// GET /api/notifications?limit=20&offset=0&unread=true

{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": "clxxx...",
        "type": "ticket_reply",
        "title": "工单 #10001 有新回复",
        "body": "customer@example.com 回复了您的工单",
        "data": {
          "ticketId": 10001,
          "ticketNumber": "10001",
          "link": "/staff/tickets/10001"
        },
        "read": false,
        "createdAt": "2025-01-09T10:00:00Z"
      }
    ],
    "unreadCount": 5,
    "total": 100
  }
}
```

## 5. 前端组件设计

### 5.1 组件层次

```
NotificationProvider (Context)
├── useNotifications (Hook)
│   ├── 获取通知列表
│   ├── 轮询/SSE 更新
│   └── 操作方法 (markAsRead, etc.)
│
└── NotificationCenter (UI)
    ├── NotificationBell (铃铛图标 + Badge)
    ├── NotificationDropdown (下拉面板)
    │   ├── NotificationList
    │   │   └── NotificationItem
    │   └── MarkAllReadButton
    └── NotificationToast (新通知 Toast)
```

### 5.2 角色感知链接解析

通知数据中的 `link` 字段存储通用格式，前端根据用户角色解析为正确路径：

```typescript
// src/lib/notification/utils.ts

/**
 * 根据用户角色解析通知跳转链接
 *
 * 通知 data.ticketId 存储工单 ID，前端根据角色生成正确路径：
 * - Customer: /customer/my-tickets/{ticketId}
 * - Staff: /staff/tickets/{ticketId}
 * - Admin: /admin/tickets/{ticketId}
 */
export function getNotificationLink(
  data: NotificationData,
  userRole: 'customer' | 'staff' | 'admin'
): string | null {
  if (!data.ticketId) {
    return data.link || null
  }

  const basePaths: Record<string, string> = {
    customer: '/customer/my-tickets',
    staff: '/staff/tickets',
    admin: '/admin/tickets'
  }

  const basePath = basePaths[userRole] || basePaths.customer
  return `${basePath}/${data.ticketId}`
}
```

**设计决策**：
- 后端创建通知时只存储 `ticketId`，不存储完整路径
- 前端渲染时根据当前用户角色动态生成链接
- 这样同一通知可以被不同角色用户正确跳转（如 Admin 查看 Staff 的通知时）

### 5.3 通知中心 UI

```tsx
// src/components/notification/notification-center.tsx

export function NotificationCenter() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications()

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center">
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h4 className="font-semibold">通知</h4>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllAsRead}>
              全部已读
            </Button>
          )}
        </div>

        <ScrollArea className="h-[400px]">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              暂无通知
            </div>
          ) : (
            notifications.map(notification => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onRead={() => markAsRead(notification.id)}
              />
            ))
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
```

## 6. 与现有系统集成

### 6.1 TicketUpdatesProvider 改造

```typescript
// 现有: ticket-updates-provider.tsx 中的 handleUpdate

// 改造后:
const handleUpdate = useCallback((updates: TicketUpdate[]) => {
  updates.forEach((update) => {
    // 1. 触发通知创建 (后端已处理, 前端通过轮询获取)

    // 2. 刷新通知列表
    mutate('/api/notifications')

    // 3. 可选: 仍显示 Toast 作为即时提醒
    if (update.event === 'article_created') {
      toast.info(...)
    }
  })
}, [mutate])
```

### 6.2 未读状态迁移

**Phase 1: 双写**
- 新通知同时写入 Notification 表
- 保留 unread-store 兼容现有代码

**Phase 2: 读取迁移**
- 未读 Badge 从 Notification 表读取
- unread-store 标记为 deprecated

**Phase 3: 清理**
- 移除 unread-store
- 移除 localStorage 持久化

## 7. 权限设计

通知遵循现有授权系统：

```yaml
# config/policies/notification.yaml

policies:
  - id: user-own-notifications
    description: Users can only access their own notifications
    resource: notification
    action: [view, edit, delete]
    effect: allow
    priority: 10
    conditions:
      - type: is_owner
```

## 8. 性能考虑

### 8.1 数据库索引

```sql
CREATE INDEX idx_notifications_user_read ON notifications(userId, read);
CREATE INDEX idx_notifications_user_created ON notifications(userId, createdAt DESC);
```

### 8.2 查询优化

- 默认只返回最近 30 天通知
- 分页加载，默认 limit=20
- 未读数量使用 count 而非全量查询

### 8.3 清理策略

- 90 天后自动删除已读通知
- 可配置保留策略 (env: NOTIFICATION_RETENTION_DAYS)

## 9. 国际化

```json
// messages/en.json
{
  "notifications": {
    "title": "Notifications",
    "markAllRead": "Mark all as read",
    "noNotifications": "No notifications",
    "ticketReply": "New reply on ticket #{number}",
    "ticketAssigned": "Ticket assigned to you",
    "ticketStatus": "Ticket status updated"
  }
}
```
