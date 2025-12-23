# 技术设计：地区和分配系统优化

## 上下文

### 背景
当前客服平台支持 8 个服务区域，但地区机制仅在工单（Ticket）系统中实现，对话（Conversation）系统缺乏地区支持，导致：
- 客户转人工后，对话无法自动路由到对应区域的客服
- Staff 可能看到不属于自己区域的对话
- 管理员无法按地区统计对话数据

### 约束
- 对话存储使用本地 JSON 文件（`local-conversation-storage.ts`）
- 工单存储在 Zammad，通过 `group_id` 实现地区分组
- 需要保持与现有 Zammad 集成的兼容性
- 不能破坏现有客户的对话历史

### 利益相关者
- **客户**：期望转人工后快速得到本区域客服响应
- **Staff**：只需处理本区域的对话，减少工作混乱
- **Admin**：需要全局视图和按地区统计

## 目标 / 非目标

### 目标
1. 对话系统支持地区字段，与工单系统保持一致
2. 转人工时自动路由到对应区域的客服队列
3. Staff 默认只看到本区域对话
4. Admin 可以跨区域管理和转移对话
5. UI 清晰展示地区信息

### 非目标
- 不实现自动负载均衡（按客服在线状态分配）
- 不实现跨区域协作功能
- 不修改 Zammad 的 Group 结构

## 决策

### D1: 对话地区字段设计

**决策**：在 `LocalConversation` 接口添加 `region` 字段，类型为 `RegionValue`

```typescript
export interface LocalConversation {
  // ... existing fields
  region: RegionValue  // 新增：对话所属区域
  assigned_at?: string // 新增：分配时间
}
```

**理由**：
- 与用户模型的 `region` 字段类型一致
- 可复用现有的 `REGIONS` 常量和工具函数
- 简单直接，无需额外的映射表

**考虑的替代方案**：
- 使用 `group_id` 与 Zammad 保持一致 → 拒绝：对话不一定创建 Zammad 工单
- 使用单独的 region 表 → 拒绝：过度设计，当前数据量不需要

### D2: 地区路由策略

**决策**：转人工时，对话自动进入该区域的"待处理队列"，不指定具体 Staff

```typescript
// transfer/route.ts
const updated = await updateConversation(conversationId, {
  mode: 'human',
  region: user.region,  // 继承客户的 region
  status: 'waiting',    // 等待客服接单
  // staff_id 不设置，等待客服主动接单
})
```

**理由**：
- 避免在线状态检测的复杂性
- 让客服自主选择接单，更灵活
- 与现有 `status: 'waiting'` 状态语义一致

**考虑的替代方案**：
- 自动分配给在线客服 → 拒绝：需要实现在线状态追踪
- 轮询分配 → 拒绝：需要额外的分配状态管理

### D3: Staff 对话列表过滤

**决策**：Staff 默认只看到 `region === user.region` 的对话，Admin 看到全部

```typescript
// conversations/route.ts GET
if (user.role === 'staff') {
  conversations = conversations.filter(c => c.region === user.region)
} else if (user.role === 'admin') {
  // Admin sees all, optionally filter by query param
  const regionFilter = searchParams.get('region')
  if (regionFilter) {
    conversations = conversations.filter(c => c.region === regionFilter)
  }
}
```

**理由**：
- 与工单系统的 `filterTicketsByRegion` 逻辑一致
- Admin 保留全局视图能力
- 支持 Admin 按区域筛选

### D4: 跨区域转移

**决策**：仅 Admin 可以将对话转移到其他区域

```typescript
// POST /api/conversations/[id]/reassign-region
// 仅 Admin 可调用
const ReassignRegionSchema = z.object({
  newRegion: z.enum([...REGIONS.map(r => r.value)]),
  reason: z.string().optional()
})
```

**理由**：
- 防止 Staff 随意转移对话逃避工作
- Admin 有全局视角，可以做出合理的转移决策
- 记录转移原因便于审计

### D5: 数据迁移策略

**决策**：创建迁移脚本，基于 `customer_email` 查找用户 region 并回填

```typescript
// scripts/migrate-conversation-regions.ts
async function migrate() {
  const conversations = await readConversations()
  for (const conv of conversations) {
    if (!conv.region) {
      // 从 mock-auth 或用户数据库查找
      const userRegion = await findUserRegion(conv.customer_email)
      conv.region = userRegion || 'asia-pacific' // 默认值
    }
  }
  await writeConversations(conversations)
}
```

**理由**：
- 保留现有对话数据
- 基于客户信息推断是最可靠的方式
- 提供默认值确保所有对话都有 region

## 风险 / 权衡

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| 迁移脚本无法找到用户 region | 中 | 低 | 使用默认值 'asia-pacific' |
| Staff 误以为没有对话（实际在其他区域） | 低 | 中 | UI 提示"显示本区域对话" |
| Admin 忘记按区域筛选导致混乱 | 低 | 低 | 默认显示全部，提供明显的筛选器 |
| 性能：大量对话时过滤变慢 | 低 | 低 | 当前使用文件存储，数据量有限 |

## 迁移计划

### 阶段 1：数据模型更新（无破坏性）
1. 添加 `region` 字段为可选
2. 更新创建对话逻辑，新对话自动设置 region
3. 部署后新对话有 region，旧对话无 region

### 阶段 2：数据迁移
1. 运行迁移脚本回填旧对话的 region
2. 验证所有对话都有 region

### 阶段 3：启用过滤逻辑
1. 更新 API 启用 region 过滤
2. 更新 UI 显示 region 信息
3. 此时 `region` 字段变为必需

### 回滚计划
- 阶段 1 回滚：移除新增字段（无影响）
- 阶段 2 回滚：保留 region 数据（无需回滚）
- 阶段 3 回滚：禁用过滤逻辑，恢复显示全部对话

## 开放问题

1. **Q**: 是否需要支持"全局客服"角色（可处理所有区域）？
   - **建议**：暂不实现，Admin 已有此能力

2. **Q**: 客户是否可以选择转接到特定区域？
   - **建议**：暂不实现，默认使用客户所属区域

3. **Q**: 是否需要地区转移的审批流程？
   - **建议**：暂不实现，Admin 直接转移即可

## 接口设计

### 更新后的 LocalConversation

```typescript
export interface LocalConversation {
  id: string
  customer_id: string
  customer_email: string
  customer_name?: string
  region: RegionValue           // 新增
  mode: 'ai' | 'human'
  status: 'active' | 'waiting' | 'closed'
  zammad_ticket_id?: number
  transferred_at?: string
  transfer_reason?: string
  staff_id?: string
  staff_name?: string
  assigned_at?: string          // 新增
  customer_unread_count?: number
  staff_unread_count?: number
  customer_last_read_at?: string
  staff_last_read_at?: string
  rating?: ConversationRating
  created_at: string
  updated_at: string
  last_message_at: string
}
```

### 新增 API 端点

```typescript
// POST /api/conversations/[id]/reassign-region
// Request
{
  "newRegion": "europe-zone-1",
  "reason": "客户实际位于欧洲"
}

// Response
{
  "success": true,
  "data": {
    "conversation": { ... },
    "previousRegion": "asia-pacific",
    "newRegion": "europe-zone-1"
  }
}
```

### 新增工具函数

```typescript
// region-auth.ts
export function hasConversationRegionAccess(
  user: RegionAuthUser,
  conversation: LocalConversation
): boolean

export function filterConversationsByRegion(
  conversations: LocalConversation[],
  user: RegionAuthUser
): LocalConversation[]
```
