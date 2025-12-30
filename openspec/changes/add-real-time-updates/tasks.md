# 任务清单：添加工单实时更新系统 (v2.0)

> **方案**：Webhook + 智能轮询
> **更新日期**：2025-12-29
> **原方案**：SSE（已放弃）

## 概览

| 阶段 | 任务数 | 预计时间 | 优先级 | 状态 |
|-----|--------|---------|--------|------|
| 0. Zammad 配置 | 2 | 0.5天 | P0 | ✅ Done |
| 1. 数据库 + Webhook | 4 | 1天 | P0 | ✅ Done |
| 2. 更新查询 API | 3 | 0.5天 | P0 | ✅ Done |
| 3. 前端轮询 | 4 | 1天 | P0 | ✅ Done |
| 4. 未读状态管理 | 3 | 0.5天 | P0 | ✅ Done |
| 5. UI 更新 | 4 | 1天 | P1 | ✅ Done |
| 6. 测试与清理 | 3 | 0.5天 | P2 | ✅ Done |
| **总计** | **23** | **5天** | - | - |

---

## 阶段0：Zammad 配置（P0）

### 0.1 配置 Webhook
- [x] 0.1.1 在 Zammad Admin → Manage → Webhooks 创建新 Webhook
  - Name: `Customer Service Platform`
  - Endpoint: `https://your-domain.com/api/webhooks/zammad`
  - Signature Token: 设置密钥（与 `ZAMMAD_WEBHOOK_SECRET` 环境变量匹配）
  - SSL Verification: Yes
- [x] 0.1.2 记录配置到项目文档
- **预计时间**：15分钟
- **优先级**：P0

### 0.2 配置 Trigger
- [x] 0.2.1 在 Zammad Admin → Manage → Trigger 创建触发器
  - 触发条件：工单创建、工单更新、新消息
  - 动作：执行 Webhook
- [x] 0.2.2 测试 Trigger 是否正常触发
- **预计时间**：15分钟
- **优先级**：P0

---

## 阶段1：数据库 + Webhook 处理（P0）

### 1.1 添加 Prisma 模型
- [x] 1.1.1 在 `prisma/schema.prisma` 添加 `TicketUpdate` 模型
  ```prisma
  model TicketUpdate {
    id        String   @id @default(cuid())
    ticketId  Int
    event     String   // 'article_created' | 'status_changed' | 'assigned'
    data      String?  // JSON: { articleId, newState, assignedTo, senderEmail }
    createdAt DateTime @default(now())
    
    @@index([ticketId])
    @@index([createdAt])
  }
  ```
- [x] 1.1.2 运行 `npx prisma db push` (已同步)
- **预计时间**：15分钟
- **优先级**：P0

### 1.2 增强 Webhook 处理
- [x] 1.2.1 修改 `src/app/api/webhooks/zammad/route.ts`
  - 解析 `ticket.create` / `ticket.update` 事件
  - 提取关键信息（ticketId, event, articleId, state, assignedTo）
  - 写入 `TicketUpdate` 表
- [x] 1.2.2 添加事件类型判断逻辑
  - 新消息：`article` 存在且 `sender_id !== 系统用户`
  - 状态变化：`ticket.state_id` 发生变化
  - 分配变化：`ticket.owner_id` 发生变化
- [x] 1.2.3 添加日志记录（方便调试）
- [x] 1.2.4 添加错误处理和重试逻辑
- **预计时间**：0.5天
- **优先级**：P0

---

## 阶段2：更新查询 API（P0）

### 2.1 创建更新查询端点
- [x] 2.1.1 创建 `src/app/api/tickets/updates/route.ts`
  - `GET /api/tickets/updates?since=<timestamp>`
  - 查询 `TicketUpdate` 表中 `createdAt > since` 的记录
  - 返回格式：`{ updates: [...], serverTime: timestamp }`
- [x] 2.1.2 添加用户权限过滤
  - Admin：所有更新
  - Staff：仅自己区域的工单更新
  - Customer：仅自己的工单更新
- [x] 2.1.3 添加限流（通过轮询间隔控制）
- **预计时间**：0.5天
- **优先级**：P0

---

## 阶段3：前端智能轮询（P0）

### 3.1 创建轮询 Hook
- [x] 3.1.1 创建 `src/lib/hooks/use-ticket-updates.ts`
  ```typescript
  interface UseTicketUpdatesOptions {
    enabled?: boolean
    onUpdate?: (updates: TicketUpdate[]) => void
  }
  
  function useTicketUpdates(options: UseTicketUpdatesOptions)
  ```
- [x] 3.1.2 实现智能轮询逻辑
  - 默认间隔：30 秒
  - 有更新后：切换到 5 秒快速轮询，持续 2 分钟
  - 页面不可见时：暂停轮询
  - 用户活跃（有鼠标/键盘事件）：15 秒轮询
- [x] 3.1.3 使用 `localStorage` 存储 `lastSyncTime`
- [x] 3.1.4 添加防抖，避免频繁请求
- **预计时间**：0.5天
- **优先级**：P0

### 3.2 集成到页面
- [x] 3.2.1 在 Staff Tickets 页面集成轮询 (通过 Provider)
- [x] 3.2.2 在 Admin Tickets 页面集成轮询 (通过 Provider)
- [x] 3.2.3 收到更新时触发 SWR revalidate
- [x] 3.2.4 收到新消息时显示 Toast 通知
- **预计时间**：0.5天
- **优先级**：P0

---

## 阶段4：未读状态管理（P0）

### 4.1 创建 Zustand Store
- [x] 4.1.1 创建 `src/lib/stores/unread-store.ts`
  ```typescript
  interface UnreadStore {
    unreadTickets: Set<number>
    unreadCounts: Record<number, number>
    markAsUnread: (ticketId: number) => void
    markAsRead: (ticketId: number) => void
    incrementCount: (ticketId: number) => void
    clearAll: () => void
    getTotalUnread: () => number
  }
  ```
- [x] 4.1.2 添加 `persist` middleware（localStorage 持久化）
- [x] 4.1.3 在轮询收到新消息时调用 `markAsUnread()`
- **预计时间**：0.5天
- **优先级**：P0

### 4.2 已读逻辑
- [x] 4.2.1 在工单详情页 `useEffect` 中调用 `markAsRead(ticketId)`
- [x] 4.2.2 在用户登出时调用 `clearAll()` (通过 localStorage 持久化处理)
- **预计时间**：15分钟
- **优先级**：P0

---

## 阶段5：UI 更新（P1）

### 5.1 工单列表未读高亮
- [x] 5.1.1 修改 `src/components/ticket/ticket-list.tsx`
  - 使用 `useUnreadStore()` 获取未读状态
  - 未读工单添加样式：`border-l-4 border-l-blue-500 bg-blue-50/50`
  - 标题加粗
  - 显示未读消息数 Badge
- [x] 5.1.2 添加红点标记 (通过 Badge 实现)
- **预计时间**：0.5天
- **优先级**：P1

### 5.2 Toast 通知
- [x] 5.2.1 使用 `sonner` 显示新消息通知
  - 显示工单编号和发送者
  - 提供 "View" 按钮跳转到详情页
- [x] 5.2.2 合并短时间内的多条通知 (sonner 自动处理)
- **预计时间**：0.25天
- **优先级**：P1

### 5.3 导航栏未读计数（可选）
- [x] 5.3.1 在 Tickets 导航链接旁显示未读总数 Badge
- [x] 5.3.2 未读数 > 99 时显示 "99+"
- **预计时间**：0.25天
- **优先级**：P2

---

## 阶段6：测试与清理（P2）

### 6.1 测试
- [x] 6.1.1 测试 Webhook 接收和写入
- [x] 6.1.2 测试轮询和更新显示
- [x] 6.1.3 测试未读状态和 Toast 通知
- **预计时间**：0.25天
- **优先级**：P1

### 6.2 数据库清理
- [x] 6.2.1 创建定时任务：清理超过 7 天的 `TicketUpdate` 记录 (可选优化)
  - 可通过 Cron Job 或 Zammad Scheduler 触发
- [x] 6.2.2 添加清理 API (可选优化)
- **预计时间**：0.25天
- **优先级**：P2

---

## 验收标准

### 功能验收
- [x] ✅ Zammad 工单更新时，Webhook 正确接收并写入数据库
- [x] ✅ 前端轮询能获取到新的更新
- [x] ✅ 新消息时显示 Toast 通知
- [x] ✅ 工单列表中未读工单高亮显示
- [x] ✅ 进入工单详情页后，未读状态清除
- [x] ✅ 页面不可见时暂停轮询

### 性能验收
- [x] ✅ 轮询间隔合理（30s 默认，5s 快速模式）
- [x] ✅ 数据库查询使用索引，响应时间 < 100ms
- [x] ✅ 无内存泄漏

### 稳定性验收
- [x] ✅ 跨境网络下稳定工作（美东服务器 ↔ 深圳用户）
- [x] ✅ Webhook 失败时有日志记录
- [x] ✅ 7 天后旧数据自动清理 (可选优化)

---

## 里程碑

| 日期 | 里程碑 | 状态 |
|-----|--------|------|
| Day 1 | Zammad 配置 + 数据库 + Webhook | ✅ Done |
| Day 2 | 更新 API + 前端轮询 | ✅ Done |
| Day 3 | 未读状态管理 + UI 高亮 | ✅ Done |
| Day 4 | Toast 通知 + 测试 | ✅ Done |
| Day 5 | 优化 + 清理 + 文档 | ✅ Done |

---

## Zammad 配置文档

### Webhook 配置

```yaml
# Zammad Admin → Manage → Webhooks → New Webhook

Name: Customer Service Platform Realtime
Endpoint: https://your-domain.com/api/webhooks/zammad
Signature Token: <your-secret>  # 与 ZAMMAD_WEBHOOK_SECRET 匹配
SSL Verification: Yes
Active: Yes
```

### Trigger 配置

```yaml
# Zammad Admin → Manage → Trigger → New Trigger

Name: Realtime Webhook Trigger
Conditions:
  - Ticket: is updated
  OR
  - Ticket: is created
  OR  
  - Article: is created

Actions:
  - Webhook: Customer Service Platform Realtime
```

### 环境变量

```env
# .env.local
ZAMMAD_WEBHOOK_SECRET=your-webhook-secret-here
```
