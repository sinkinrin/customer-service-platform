# 变更：添加工单实时更新系统

## 原因

基于用户反馈（2025-12-26），当前系统缺乏实时更新机制，主要问题：

1. **新消息无实时提醒** - 工单收到新回复时，staff需要手动刷新页面才能看到
2. **未读工单无高亮** - 无法快速识别哪些工单有新消息未读
3. **状态变化不同步** - 工单状态更新后，需要刷新页面才能看到变化

**用户反馈**：
- 反馈人：Cody (技术支持)
- 日期：2025-12-26
- 问题描述：
  - "新消息过来，需要增加提醒；未读工单需要高亮，方便staff查看"
  - "状态更新，需要同步到聊天页面，提醒用户状态变化"

这些问题导致工作效率低下，staff无法及时响应客户。

## 变更内容

### 阶段1：后端实时事件推送（P0）

**技术选型**：Server-Sent Events (SSE)
- ✅ 单向推送，满足通知场景
- ✅ 基于HTTP，部署简单
- ✅ 自动重连机制
- ✅ 比WebSocket轻量

**实现内容**：
1. 创建SSE端点 `/api/sse/tickets`
2. 推送事件类型：
   - `ticket:new` - 新工单创建
   - `ticket:update` - 工单状态变化
   - `article:new` - 新消息/回复
   - `ticket:assigned` - 工单分配变化

### 阶段2：前端实时订阅（P0）

1. **SSE客户端封装** (`src/lib/sse/client.ts`)
   - 自动重连机制
   - 事件类型过滤
   - 心跳检测

2. **实时通知组件** (`src/components/notification/real-time-toast.tsx`)
   - 新消息toast提示
   - 音效通知（可选）
   - 桌面通知（需用户授权）

3. **未读标记系统** (`src/lib/stores/unread-store.ts`)
   - 追踪未读工单列表
   - 未读消息计数
   - localStorage持久化

### 阶段3：UI高亮显示（P0）

1. **工单列表未读高亮** (`src/components/ticket/ticket-list.tsx`)
   - 未读工单加粗显示
   - 红点标记
   - 未读消息计数badge

2. **详情页实时更新** (`src/app/staff/tickets/[id]/page.tsx`)
   - 状态变化自动刷新
   - 新消息自动追加
   - 滚动到新消息

### 阶段4：优化与监控（P1）

1. **性能优化**
   - 事件去重
   - 防抖处理
   - 内存泄漏检测

2. **用户偏好设置**
   - 开启/关闭实时通知
   - 选择通知方式（toast/桌面/音效）
   - 免打扰模式

## 影响

### 受影响的规范
- `notification-system` - 通知系统（需创建）
- `real-time-updates` - 实时更新系统（需创建）

### 受影响的代码

**新增文件**：
- `src/app/api/sse/tickets/route.ts` - SSE服务端点
- `src/lib/sse/client.ts` - SSE客户端封装
- `src/lib/sse/event-emitter.ts` - 服务端事件发射器
- `src/lib/stores/unread-store.ts` - 未读状态管理
- `src/components/notification/real-time-toast.tsx` - 实时通知组件
- `src/components/notification/notification-settings.tsx` - 通知设置页面

**修改文件**：
- `src/components/ticket/ticket-list.tsx` - 添加未读高亮
- `src/app/staff/tickets/[id]/page.tsx` - 添加实时更新
- `src/app/admin/tickets/[id]/page.tsx` - 添加实时更新
- `src/components/providers/session-provider.tsx` - 集成SSE客户端

### 数据库变更

**新增表**：
```prisma
model TicketRead {
  id        String   @id @default(cuid())
  userId    String
  ticketId  Int
  lastReadAt DateTime @default(now())

  @@unique([userId, ticketId])
  @@index([userId])
}
```

### 破坏性变更
- **无破坏性变更**

## 优先级

**整体优先级**：🔴 P0（高优先级）

这是用户反馈的核心问题之一，显著影响工作效率。

## 预期收益

1. **提升响应速度** - staff 收到新消息后立即得到通知，平均响应时间减少50%
2. **减少遗漏** - 未读高亮帮助 staff 快速定位待处理工单
3. **改善用户体验** - 状态实时同步，无需手动刷新
4. **提高工作效率** - 减少不必要的页面刷新操作

## 技术架构

### SSE vs WebSocket 对比

| 特性 | SSE | WebSocket |
|-----|-----|-----------|
| 连接方向 | 单向（服务器→客户端） | 双向 |
| 协议 | HTTP | WS/WSS |
| 重连 | 自动 | 需手动实现 |
| 浏览器支持 | 广泛 | 广泛 |
| 部署复杂度 | 低 | 中 |
| 适用场景 | ✅ 通知推送 | ❌ 双向聊天 |

**选择理由**：工单通知是单向推送，SSE更轻量且部署简单。

### 事件流程图

```
1. 工单状态变化
   ↓
2. Zammad Webhook → API Handler
   ↓
3. 事件发射器 → SSE连接池
   ↓
4. 客户端SSE接收 → Store更新
   ↓
5. UI自动刷新 + Toast通知
```

## 实施建议

### MVP范围（最小可行产品）
- SSE基础设施
- 新消息toast通知
- 工单列表未读高亮

### 后续增强
- 桌面通知
- 音效提示
- 通知偏好设置
- 未读消息详情预览

## 依赖项

### 前端依赖
```json
{
  "eventsource": "^2.0.2"  // SSE客户端（可选，浏览器原生支持）
}
```

### 后端依赖
- 无额外依赖（Next.js原生支持SSE）

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|-----|------|---------|
| SSE连接超时 | 中 | 自动重连机制 |
| 内存泄漏 | 中 | 组件卸载时关闭连接 |
| 通知过载 | 低 | 防抖+去重 |
| 用户反感通知 | 低 | 提供关闭选项 |

## 参考资料

- [MDN: Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [Next.js API Routes](https://nextjs.org/docs/api-routes/introduction)
- [EventSource API](https://developer.mozilla.org/en-US/docs/Web/API/EventSource)
