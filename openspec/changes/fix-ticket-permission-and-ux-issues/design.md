# 设计：工单权限系统重构

## 上下文

### 背景
权限问题已在多次测试中反复出现（12月19日、12月30日），说明当前分散的权限检查逻辑存在根本性问题：
- 权限逻辑分散在多个 API 文件中
- 客户、Staff、Admin 的权限边界不清晰
- 未分配工单的可见性规则不明确

### 约束
- 必须兼容现有 Zammad 后端的 group_id 和 owner_id 机制
- 不能破坏现有的工单创建和分配流程
- 需要支持 8 个区域（asia-pacific, middle-east, europe-zone-1, europe-zone-2, north-america, latin-america, africa, cis）

### 利益相关者
- Admin：需要全局工单视图和管理权限
- Staff：需要区域隔离，只看到自己负责的工单
- Customer：需要严格隔离，只看到自己的工单

## 目标 / 非目标

### 目标
1. 建立统一的权限检查层，所有 API 复用同一逻辑
2. 明确定义三类用户的工单可见性规则
3. 修复所有已知的权限泄露问题
4. 提供清晰的权限调试日志

### 非目标
- 不重构 Zammad 后端权限模型
- 不添加新的权限层级（如团队主管）
- 不实现细粒度的字段级权限

## 决策

### 决策 1：统一权限工具类

**内容**：创建 `src/lib/utils/permission.ts` 作为统一权限入口

**原因**：
- 避免权限逻辑分散导致的不一致
- 便于测试和维护
- 提供统一的日志和调试接口

```typescript
// src/lib/utils/permission.ts
interface PermissionContext {
  user: AuthUser
  ticket?: Ticket
  action: 'view' | 'edit' | 'delete' | 'close' | 'assign'
}

interface PermissionResult {
  allowed: boolean
  reason?: string
}

export function checkTicketPermission(ctx: PermissionContext): PermissionResult
export function filterTicketsByPermission(tickets: Ticket[], user: AuthUser): Ticket[]
```

### 决策 2：工单可见性规则矩阵

| 用户角色 | 自己创建 | 分配给自己 | 自己区域 | 未分配 | 其他区域 |
|----------|----------|------------|----------|--------|----------|
| Customer | ✅ | - | - | - | ❌ |
| Staff | ❌ | ✅ | ✅ | ❌ | ❌ |
| Admin | ✅ | ✅ | ✅ | ✅ | ✅ |

**关键规则**：
1. **Customer**：只能看到 `customer_id === user.id` 的工单
2. **Staff**：只能看到 `owner_id === user.id` 或 `group_id in user.group_ids` 的工单
3. **Admin**：可以看到所有工单
4. **未分配工单**：`owner_id` 为空、0、或 1，视为未分配，仅 Admin 可见

**边界补充**：
- **用户 ID 对齐**：`user.id` 指用户在 Zammad 中的 ID（`session.user.zammad_id`）
- **未分配判定**：`owner_id` 为空、0、或 1 均视为未分配
- **区域解析优先级**：`group_id -> region` 映射优先，其次 `note` 中的 `Region:` 标记；无法解析则视为未知区域
- **未知区域工单**：仅 Admin 可见，Staff 不可见（除非已明确分配给该 Staff）

### 决策 3：未分配工单处理

**内容**：新工单创建时保持未分配状态

**原因**：
- 反馈指出"工单不应默认分配给 Admin"
- 允许 Admin 手动分配到合适的区域和人员

**实现**：
- 创建工单时不设置 `owner_id`
- 根据客户区域设置 `group_id`（可选，便于区域统计）
- 未分配工单在 Staff 工单列表中不显示

### 决策 4：权限检查位置

**内容**：在 API 层统一进行权限过滤

**考虑的替代方案**：
1. ~~前端过滤~~：不安全，可被绕过
2. ~~数据库层过滤~~：Zammad 限制，无法修改
3. **API 层过滤**（选择）：在获取数据后、返回前过滤

```typescript
// src/app/api/tickets/route.ts
const allTickets = await zammadClient.getAllTickets()
const visibleTickets = filterTicketsByPermission(allTickets, currentUser)
return successResponse({ tickets: visibleTickets })
```

## 风险 / 权衡

### 风险 1：性能影响
- **风险**：过滤大量工单可能影响响应时间
- **缓解**：利用已有的分页机制，限制单次获取数量

### 风险 2：权限遗漏
- **风险**：某些 API 可能遗漏权限检查
- **缓解**：创建 API 权限检查清单，逐一验证

### 风险 3：现有用户影响
- **风险**：Staff 可能突然看不到之前能看到的工单
- **缓解**：
  1. 记录变更前后的可见工单数量
  2. 提供管理员工具查看权限变更影响

## 实现要点

### 权限过滤核心逻辑

```typescript
export function filterTicketsByPermission(
  tickets: Ticket[],
  user: AuthUser
): Ticket[] {
  if (user.role === 'admin') {
    return tickets // Admin sees all
  }

  if (user.role === 'customer') {
    return tickets.filter(t => t.customer_id === user.zammad_id)
  }

  if (user.role === 'staff') {
    const userGroupIds = user.group_ids || []
    return tickets.filter(t => {
      // Assigned to me
      if (t.owner_id === user.zammad_id) return true
      // In my region (has group_id and matches my groups)
      if (t.group_id && userGroupIds.includes(t.group_id)) return true
      // Unassigned tickets are NOT visible to staff
      return false
    })
  }

  return [] // Unknown role sees nothing
}
```

### 需要修改的 API 端点

| 端点 | 当前状态 | 修改内容 |
|------|----------|----------|
| `GET /api/tickets` | 部分过滤 | 使用统一过滤函数 |
| `GET /api/tickets/[id]` | 无检查 | 添加单工单权限检查 |
| `DELETE /api/tickets/[id]` | 有检查 | 验证前端调用 |
| `PUT /api/tickets/[id]` | 部分检查 | 统一权限入口 |

## 测试策略

### 单元测试
```typescript
describe('filterTicketsByPermission', () => {
  it('customer only sees own tickets')
  it('staff sees assigned and regional tickets')
  it('staff cannot see unassigned tickets')
  it('admin sees all tickets')
})
```

### 集成测试
- 使用不同区域的测试账号验证工单可见性
- 验证未分配工单的行为

## 开放问题

1. ~~客户区域如何确定？~~ → 使用 `note` 字段或创建时指定
2. 是否需要工单分配通知？ → 后续功能，不在本次范围
3. 批量分配时的权限检查？ → 复用单工单检查逻辑
