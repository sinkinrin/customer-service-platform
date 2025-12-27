# 任务清单：添加工单实时更新系统

> [!NOTE]
> 本项目基于2025-12-26用户反馈，解决实时消息提醒和未读高亮问题。

## 概览

| 阶段 | 任务数 | 预计时间 | 优先级 | 状态 |
|-----|--------|---------|--------|------|
| 1. SSE基础设施 | 5 | 2天 | P0 | ⬜ Not Started |
| 2. 未读状态管理 | 4 | 1天 | P0 | ⬜ Not Started |
| 3. UI通知组件 | 6 | 2天 | P0 | ⬜ Not Started |
| 4. 详情页实时更新 | 3 | 1天 | P1 | ⬜ Not Started |
| 5. 性能优化 | 4 | 1天 | P1 | ⬜ Not Started |
| 6. 测试与监控 | 3 | 1天 | P2 | ⬜ Not Started |
| **总计** | **25** | **8天** | - | - |

---

## 阶段1：SSE基础设施（P0）

### 1.1 服务端事件发射器
- [ ] 1.1.1 创建 `src/lib/sse/event-emitter.ts`
  - 实现 `ServerEventEmitter` 类
  - 支持事件类型：`article:new`, `ticket:update`, `ticket:assigned`, `ticket:new`
  - 实现 `emit()`, `on()`, `off()` 方法
  - 添加通配符监听器支持（`ticket:*`）
- [ ] 1.1.2 导出全局单例 `eventEmitter`
- [ ] 1.1.3 编写单元测试 (`__tests__/unit/sse/event-emitter.test.ts`)
- **预计时间**：0.5天
- **优先级**：P0

### 1.2 SSE服务端点
- [ ] 1.2.1 创建 `src/app/api/sse/tickets/route.ts`
  - 实现 `GET` 方法，返回 `text/event-stream`
  - 添加用户认证 (`requireAuth`)
  - 维护SSE连接池
  - 实现心跳机制（每30秒发送 `:heartbeat\n\n`）
- [ ] 1.2.2 处理客户端断开连接（清理监听器）
- [ ] 1.2.3 实现事件过滤（用户只接收自己相关的事件）
- [ ] 1.2.4 添加连接数限制（每用户最多2个连接）
- **预计时间**：1天
- **优先级**：P0

### 1.3 客户端SSE封装
- [ ] 1.3.1 创建 `src/lib/sse/client.ts`
  - 封装 `EventSource` API
  - 实现自动重连机制（3次重试，指数退避）
  - 添加心跳检测
  - 提供 `on()`, `off()`, `close()` 方法
- [ ] 1.3.2 添加TypeScript类型定义
- [ ] 1.3.3 实现连接状态管理（connecting/connected/disconnected/error）
- **预计时间**：0.5天
- **优先级**：P0

### 1.4 集成到API路由
- [ ] 1.4.1 在 `src/app/api/tickets/[id]/articles/route.ts` 的 `POST` 方法中触发 `article:new` 事件
- [ ] 1.4.2 在 `src/app/api/tickets/[id]/route.ts` 的 `PUT` 方法中触发 `ticket:update` 事件
- [ ] 1.4.3 在 `src/app/api/tickets/[id]/assign/route.ts` 的 `PUT` 方法中触发 `ticket:assigned` 事件
- [ ] 1.4.4 在 `src/app/api/tickets/route.ts` 的 `POST` 方法中触发 `ticket:new` 事件
- **预计时间**：0.5天
- **优先级**：P0

### 1.5 集成到Session Provider
- [ ] 1.5.1 修改 `src/components/providers/session-provider.tsx`
  - 在用户登录后自动创建SSE连接
  - 在用户登出时关闭SSE连接
  - 提供 `useSSE()` hook 供组件使用
- **预计时间**：0.5天
- **优先级**：P0

---

## 阶段2：未读状态管理（P0）

### 2.1 Zustand Store
- [ ] 2.1.1 创建 `src/lib/stores/unread-store.ts`
  - 定义状态：`unreadTickets: Set<number>`, `unreadCounts: Map<number, number>`
  - 实现actions：`markAsUnread()`, `markAsRead()`, `incrementCount()`, `clearAll()`
  - 添加localStorage持久化（使用 `persist` middleware）
- [ ] 2.1.2 添加TypeScript类型定义
- [ ] 2.1.3 编写单元测试 (`__tests__/unit/stores/unread-store.test.ts`)
- **预计时间**：0.5天
- **优先级**：P0

### 2.2 SSE事件处理
- [ ] 2.2.1 监听 `article:new` 事件，调用 `markAsUnread()` 和 `incrementCount()`
- [ ] 2.2.2 监听 `ticket:update` 事件，更新工单状态
- [ ] 2.2.3 添加事件去重逻辑（防止同一事件重复处理）
- **预计时间**：0.25天
- **优先级**：P0

### 2.3 已读逻辑
- [ ] 2.3.1 在工单详情页 (`src/app/staff/tickets/[id]/page.tsx`) useEffect中调用 `markAsRead(ticketId)`
- [ ] 2.3.2 在工单详情页 (`src/app/admin/tickets/[id]/page.tsx`) useEffect中调用 `markAsRead(ticketId)`
- **预计时间**：0.25天
- **优先级**：P0

### 2.4 清理机制
- [ ] 2.4.1 登出时调用 `clearAll()` 清空未读状态
- [ ] 2.4.2 定期清理过期数据（超过7天的未读记录）
- **预计时间**：0.25天
- **优先级**：P1

---

## 阶段3：UI通知组件（P0）

### 3.1 实时Toast通知
- [ ] 3.1.1 创建 `src/components/notification/real-time-toast.tsx`
  - 监听SSE `article:new` 事件
  - 使用 `sonner` 显示toast
  - 添加"View"按钮跳转到工单详情
  - 显示发送者和工单编号
- [ ] 3.1.2 添加音效通知（可选，需用户授权）
- [ ] 3.1.3 集成到 `session-provider.tsx`
- **预计时间**：0.5天
- **优先级**：P0

### 3.2 桌面通知（可选）
- [ ] 3.2.1 请求 Notification API 权限
- [ ] 3.2.2 在 `article:new` 事件时发送桌面通知
- [ ] 3.2.3 添加用户设置开关
- **预计时间**：0.5天
- **优先级**：P2

### 3.3 工单列表未读高亮
- [ ] 3.3.1 修改 `src/components/ticket/ticket-list.tsx`
  - 使用 `useUnreadStore()` 获取未读状态
  - 添加未读高亮样式（左边蓝色边框 + 浅蓝背景）
  - 标题加粗
  - 显示未读消息数badge
- [ ] 3.3.2 添加红点标记（在标题右侧）
- **预计时间**：0.5天
- **优先级**：P0

### 3.4 导航栏未读计数
- [ ] 3.4.1 在 `src/components/layout/nav-bar.tsx` 添加未读总数badge
  - 显示在 "Tickets" 导航链接旁边
  - 使用红色badge（数字）
- [ ] 3.4.2 未读数 > 99 时显示 "99+"
- **预计时间**：0.25天
- **优先级**：P1

### 3.5 通知设置页面
- [ ] 3.5.1 创建 `src/app/staff/settings/notifications/page.tsx`
  - 开启/关闭实时通知
  - 选择通知方式（Toast/桌面/音效）
  - 免打扰模式（设置时间段）
- [ ] 3.5.2 保存设置到localStorage
- **预计时间**：0.5天
- **优先级**：P2

### 3.6 未读消息预览（可选）
- [ ] 3.6.1 创建 `src/components/notification/unread-preview-popover.tsx`
  - Hover未读badge时显示未读工单列表
  - 显示最新3条未读消息摘要
  - 提供"Mark all as read"按钮
- **预计时间**：0.5天
- **优先级**：P3

---

## 阶段4：详情页实时更新（P1）

### 4.1 新消息自动追加
- [ ] 4.1.1 修改 `src/app/staff/tickets/[id]/page.tsx`
  - 监听SSE `article:new` 事件
  - 检查 `event.data.ticketId === ticketId`
  - 追加新消息到 `articles` 数组
  - 自动滚动到底部
- [ ] 4.1.2 同样修改 `src/app/admin/tickets/[id]/page.tsx`
- **预计时间**：0.5天
- **优先级**：P1

### 4.2 状态实时同步
- [ ] 4.2.1 监听SSE `ticket:update` 事件
  - 更新工单状态badge
  - 更新优先级badge
  - 显示状态变化提示（小toast）
- [ ] 4.2.2 监听SSE `ticket:assigned` 事件，更新分配信息
- **预计时间**：0.5天
- **优先级**：P1

### 4.3 新消息动画
- [ ] 4.3.1 新消息出现时添加淡入动画（fade-in）
- [ ] 4.3.2 添加"New"标记（5秒后自动消失）
- **预计时间**：0.25天
- **优先级**：P2

---

## 阶段5：性能优化（P1）

### 5.1 事件防抖与去重
- [ ] 5.1.1 实现事件去重逻辑（基于事件ID）
- [ ] 5.1.2 防抖处理（500ms内相同事件只触发一次）
- [ ] 5.1.3 限流处理（1秒内最多10个事件）
- **预计时间**：0.5天
- **优先级**：P1

### 5.2 内存泄漏检测
- [ ] 5.2.1 组件卸载时确保SSE连接关闭
- [ ] 5.2.2 清理所有事件监听器
- [ ] 5.2.3 使用React DevTools Profiler检测内存泄漏
- **预计时间**：0.25天
- **优先级**：P1

### 5.3 连接池管理
- [ ] 5.3.1 限制单个用户的SSE连接数（最多2个）
- [ ] 5.3.2 清理超过5分钟无响应的僵尸连接
- [ ] 5.3.3 添加连接数监控日志
- **预计时间**：0.5天
- **优先级**：P1

### 5.4 懒加载与代码分割
- [ ] 5.4.1 将通知设置页面动态导入（lazy load）
- [ ] 5.4.2 将音效文件延迟加载
- **预计时间**：0.25天
- **优先级**：P2

---

## 阶段6：测试与监控（P2）

### 6.1 单元测试
- [ ] 6.1.1 测试 `event-emitter.ts` 的所有方法
- [ ] 6.1.2 测试 `unread-store.ts` 的所有actions
- [ ] 6.1.3 测试 `sse/client.ts` 的连接/断开/重连逻辑
- **预计时间**：0.5天
- **优先级**：P1

### 6.2 集成测试
- [ ] 6.2.1 测试：创建新消息 → toast出现 → 未读高亮
- [ ] 6.2.2 测试：进入详情页 → 未读状态清除
- [ ] 6.2.3 测试：状态变化 → 详情页自动更新
- **预计时间**：0.5天
- **优先级**：P1

### 6.3 性能测试与监控
- [ ] 6.3.1 测试100个并发SSE连接的性能
- [ ] 6.3.2 测试事件延迟（从触发到接收）< 100ms
- [ ] 6.3.3 添加监控指标：
  - SSE连接数（Prometheus metric）
  - 事件延迟（Prometheus histogram）
  - 未读消息总数（Prometheus gauge）
  - 错误率（Prometheus counter）
- **预计时间**：0.5天
- **优先级**：P2

---

## 数据库迁移（可选）

> [!NOTE]
> 未读状态使用localStorage存储，无需数据库。如果未来需要跨设备同步，可添加此表。

### 6.4 Prisma Schema（可选）
- [ ] 6.4.1 添加 `TicketRead` 模型到 `prisma/schema.prisma`
```prisma
model TicketRead {
  id         String   @id @default(cuid())
  userId     String
  ticketId   Int
  lastReadAt DateTime @default(now())

  @@unique([userId, ticketId])
  @@index([userId])
}
```
- [ ] 6.4.2 运行 `npx prisma migrate dev --name add_ticket_read`
- [ ] 6.4.3 创建API端点 `GET /api/users/me/ticket-reads`
- [ ] 6.4.4 创建API端点 `POST /api/users/me/ticket-reads/:ticketId`
- **预计时间**：1天
- **优先级**：P3（未来增强）

---

## 验收标准

### 功能验收
- [ ] ✅ Staff收到新消息时，toast通知出现
- [ ] ✅ 工单列表中未读工单高亮显示（蓝色边框 + 加粗）
- [ ] ✅ 导航栏显示未读工单总数badge
- [ ] ✅ 进入工单详情页后，未读状态清除
- [ ] ✅ 工单状态变化时，详情页自动更新
- [ ] ✅ SSE连接断开后自动重连（3次重试）

### 性能验收
- [ ] ✅ 事件延迟 < 100ms（从触发到客户端接收）
- [ ] ✅ 无内存泄漏（使用Chrome DevTools验证）
- [ ] ✅ 100个并发SSE连接时服务器稳定运行

### 兼容性验收
- [ ] ✅ Chrome、Firefox、Safari、Edge浏览器测试通过
- [ ] ✅ 不支持SSE的浏览器降级为轮询（可选）

---

## 里程碑

| 日期 | 里程碑 | 状态 |
|-----|--------|------|
| Day 1-2 | SSE基础设施完成 | ⬜ |
| Day 3 | 未读状态管理完成 | ⬜ |
| Day 4-5 | UI通知组件完成 | ⬜ |
| Day 6 | 详情页实时更新完成 | ⬜ |
| Day 7 | 性能优化完成 | ⬜ |
| Day 8 | 测试与监控完成 | ⬜ |

---

## 注意事项

1. **SSE连接限制**：浏览器对同一域名的SSE连接数有限制（通常6个），确保每个用户最多2个连接。
2. **心跳机制**：必须实现心跳，否则某些代理服务器会在30秒后断开空闲连接。
3. **内存泄漏**：务必在组件卸载时清理事件监听器和SSE连接。
4. **事件过滤**：服务端必须过滤事件，用户只能接收自己有权限的工单事件。
5. **localStorage限制**：localStorage有5MB限制，定期清理过期数据。
6. **降级方案**：对于不支持SSE的浏览器，提供轮询降级方案。

---

## 参考资料

- [MDN: Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [Next.js API Routes](https://nextjs.org/docs/api-routes/introduction)
- [EventSource API](https://developer.mozilla.org/en-US/docs/Web/API/EventSource)
- [Zustand Persist Middleware](https://docs.pmnd.rs/zustand/integrations/persisting-store-data)
- [Vercel SSE Example](https://github.com/vercel/next.js/tree/canary/examples/with-sse)
