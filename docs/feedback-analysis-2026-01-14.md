# 用户反馈问题分析报告

**日期**: 2026-01-14  
**分析人**: AI Agent  
**项目**: Customer Service Platform

---

## 问题概览

| # | 问题描述 | 严重程度 | 涉及模块 | 状态 |
|---|----------|----------|----------|------|
| 1 | Email HTML解析失效 | 🔴 高 | Email通知 | 待修复 |
| 2 | Staff跨区工单可见性（含数量） | 🔴 高 | 权限控制 | 待修复 |
| 3 | 附件UI和格式支持 | 🟡 中 | 附件系统 | 待修复 |
| 4 | Webhook刷新影响所有Staff | 🔴 高 | 实时更新 | 待修复 |
| 5 | 工单创建速度慢 | 🟡 中 | 性能优化 | 待优化 |
| 6 | 区域内客户-Staff对应 | 🔵 低 | 功能缺失 | 待规划 |
| 7 | 个人设置功能未完善 | 🟡 中 | 用户设置 | 待完善 |
| 8 | 工单填充模板精简 | 🔵 低 | 模板系统 | 待优化 |
| 9 | 单行文本显示不全 | 🟡 中 | UI组件 | 待修复 |
| 10 | 未启用Customer可见 | 🔴 高 | 用户过滤 | 待修复 |
| 11 | 工单详情默认滚动位置 | 🔵 低 | UX优化 | 待实现 |
| 12 | Pending功能说明 | 🔵 低 | 文档/UX | 待说明 |
| 13 | 工单评价展示优化 | 🟡 中 | 评价系统 | 待优化 |
| 14 | Admin账号自动分配排除 | 🟡 中 | 自动分配 | 待验证 |

---

## 详细分析

### 1. Email HTML解析失效（有一堆div）

**问题描述**: 网页创建工单时自动发送的Email中，HTML内容解析失效，显示原始的div标签。

**相关代码位置**:
- `scripts/setup-email-triggers.ts` - Email触发器配置
- `src/app/api/webhooks/zammad/route.ts` - Webhook处理

**问题根因分析**:
Zammad的Email触发器模板使用了简单的文本格式(`body`字段)，但实际发送时可能被当作HTML处理。邮件内容的`content_type`设置可能不正确。

```typescript
// scripts/setup-email-triggers.ts (第51-57行)
perform: {
  'notification.email': {
    recipient: 'ticket_customer',
    subject: 'Your ticket ##{ticket.number} has been received - #{ticket.title}',
    body: `Dear #{ticket.customer.firstname},...` // 纯文本格式
  }
}
```

**建议修复**:
1. 在邮件触发器中明确指定 `content_type: 'text/plain'` 或设计正确的HTML模板
2. 检查Zammad邮件触发器是否需要配置邮件格式
3. 如使用HTML模板，需要完整的HTML结构而非简单的换行文本

---

### 2. Staff跨区工单可见性问题（含数量统计）

**问题描述**: 
- ⚠️ **重要**: Staff不允许跨区查看任何工单数据，**包括工单数量统计**
- 当前Staff可以看到其他区域的工单统计数量，这违反了权限隔离原则
- 工单详情API已正确实施区域过滤，Staff无法查看跨区工单详情

**期望行为**:
| 数据类型 | Staff可见范围 |
|---------|---------------|
| 工单列表 | 仅本区域 |
| 工单详情 | 仅本区域 |
| **工单数量统计** | **仅本区域** |
| 区域汇总 | **仅本区域** |

**相关代码位置**:
- `src/lib/utils/permission.ts` - 权限过滤逻辑
- `src/app/api/admin/stats/dashboard/route.ts` - 统计API（**问题所在**）
- `src/app/api/tickets/[id]/articles/route.ts` - 工单详情API（已正确过滤）
- `docs/architecture/architecture-review-zh.md` - 架构文档

**当前权限规则（工单列表）**:
```typescript
// src/lib/utils/permission.ts (第165-188行)
if (user.role === 'staff') {
  const filtered = tickets.filter(t => {
    // 未分配工单对staff不可见
    const isUnassigned = t.owner_id == null || t.owner_id === 0 || t.owner_id === 1
    if (isUnassigned) return false
    
    // 分配给我的 - 可见
    if (t.owner_id === userZammadId) return true
    
    // 同区域的 - 可见
    if (t.group_id != null && userGroupIds.includes(t.group_id)) return true
    
    return false
  })
}
```

**问题根因**:
1. **统计API权限缺失**: `src/app/api/admin/stats/dashboard/route.ts` 虽然要求 `requireRole(['admin'])`，但Staff可能通过其他方式获取数据
2. **前端显示问题**: Staff Dashboard可能调用了Admin统计API或显示了不应展示的跨区数据
3. **数据泄露路径**: 需要检查Staff可访问的所有API是否都正确过滤了区域

**建议修复**:
1. **统计API区域过滤**: 为Staff角色创建独立的统计API，只返回本区域数据
2. **前端严格隔离**: Staff Dashboard只能显示本区域统计
3. **统一过滤函数**: 在所有工单相关API中使用统一的 `filterTicketsByPermission()` 函数
4. **审计所有接口**: 检查以下API是否对Staff正确过滤区域:
   - `/api/tickets` (列表)
   - `/api/tickets/[id]` (详情)
   - `/api/admin/stats/*` (统计)
   - `/api/tickets/export` (导出)

---

### 3. 附件UI看不清字，zip/wmv等格式不支持

**问题描述**: 
1. 附件显示的文字不清晰
2. zip、wmv等文件格式不被允许上传

**相关代码位置**:
- `src/components/ticket/ticket-actions.tsx` (第378行) - 文件上传组件
- `src/components/ticket/article-content.tsx` (第172-195行) - 附件显示组件
- `src/app/customer/my-tickets/[id]/page.tsx` (第352行, 第503行)

**当前支持的文件格式**:
```typescript
// ticket-actions.tsx 第378行
accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
```

**问题根因**:
1. **格式限制**: 当前只允许图片、PDF、Office文档和TXT，不包含zip、wmv、mp4等常见格式
2. **UI样式**: 附件显示使用了 `text-gray-500` 颜色，可能在某些背景下不够清晰

**附件UI代码** (`article-content.tsx` 第181-190行):
```tsx
<span className="max-w-[200px] truncate">{att.filename}</span>
<span className="text-xs text-gray-500">({formatFileSize(att.size)})</span>
```

**建议修复**:
1. 扩展支持的文件格式:
   ```typescript
   accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar,.7z,.mp4,.wmv,.avi,.mov"
   ```
2. 改善附件文字样式，使用更高对比度的颜色:
   ```tsx
   className="text-sm text-foreground" // 替换 text-gray-500
   ```

---

### 4. Webhook刷新时，其它Staff都在刷新

**问题描述**: 当Webhook触发更新时，所有在线Staff的界面都会刷新，而非只刷新相关工单的Staff。

**相关代码位置**:
- `src/app/api/webhooks/zammad/route.ts` - Webhook处理
- `src/app/api/tickets/updates/stream/route.ts` - SSE流
- `src/lib/sse/emitter.ts` - SSE事件发射器

**问题根因**:
SSE事件可能在广播时没有正确过滤目标用户。当webhook触发时，更新事件被发送给所有已连接的客户端。

**当前Webhook处理流程**:
```typescript
// webhooks/zammad/route.ts
// Webhook收到 -> 创建TicketUpdate记录 -> SSE广播
```

**建议修复**:
1. 在SSE发射器中根据工单的owner_id和group_id过滤接收用户
2. 只向相关Staff发送更新事件:
   - 工单的owner (负责人)
   - 同区域的Staff (如果需要)
   - Admin用户
3. 客户端只接收与自己相关的工单更新

---

### 5. 工单创建速度过慢，附件上传机制

**问题描述**: 工单创建过程较慢，尤其是带附件时。

**相关代码位置**:
- `src/app/api/tickets/route.ts` - 工单创建API (第92-145行, 第446-473行)
- `src/app/customer/my-tickets/[id]/page.tsx` (第53-65行) - 文件转Base64

**当前流程分析**:
```typescript
// 工单创建流程 (route.ts)
1. 验证用户登录 -> 同步
2. ensureZammadUser() -> 异步，可能需要API调用
3. 创建工单 with attachments (Base64) -> 异步
```

**问题根因**:
1. **Base64转换**: 附件需要先转为Base64才能发送，大文件会增加处理时间
2. **Zammad用户确认**: 每次创建前都要确认Zammad用户存在
3. **单次请求**: 工单和附件在同一请求中处理

**建议修复**:
1. **分离附件上传**: 
   - 先创建工单获取ID
   - 异步上传附件到Zammad
   - 使用进度条显示上传状态
2. **缓存用户确认**: 已实现 `getVerifiedZammadUser` 缓存，但需验证是否生效
3. **前端优化**: 显示创建进度，避免用户重复点击

---

### 6. 同一区域内，不同客户对应不同Staff

**问题描述**: 需要支持在同一区域内，将特定客户分配给特定Staff。

**相关代码位置**:
- `src/lib/zammad/user-mapping.ts` - 用户映射
- `src/lib/utils/permission.ts` - 权限控制

**当前状态**:
系统目前没有客户-Staff绑定机制，工单分配主要基于:
1. 手动分配 (Admin指定owner_id)
2. 区域分组 (group_id)

**建议实现**:
1. 创建新的数据模型 `CustomerStaffAssignment`:
   ```prisma
   model CustomerStaffAssignment {
     id         String   @id @default(cuid())
     customerId String
     staffId    String
     region     String
     createdAt  DateTime @default(now())
   }
   ```
2. 在Admin界面添加客户-Staff绑定管理
3. 工单自动分配时优先使用绑定关系

---

### 7. 个人设置的一些功能尚未完善

**问题描述**: 用户个人设置页面的部分功能未真正实现。

**相关代码位置**:
- `src/app/customer/settings/page.tsx`

**当前状态分析**:
```typescript
// customer/settings/page.tsx 第61-72行
const handleSavePersonalInfo = async () => {
  setLoading(true)
  try {
    // ⚠️ 仅模拟API调用，未实际保存
    await new Promise(resolve => setTimeout(resolve, 1000))
    toast.success(tToast('personalInfoUpdated'))
  } catch {
    toast.error(tToast('updateFailed'))
  } finally {
    setLoading(false)
  }
}
```

**未完成功能**:
1. ❌ 个人信息保存 - 只有模拟调用
2. ❌ 通知设置保存 - 只有模拟调用  
3. ❌ 密码修改 - 只有模拟调用
4. ⚠️ 语言切换 - UI存在但可能未联动实际locale切换

**建议修复**:
1. 实现 `PUT /api/user/profile` API 用于更新个人信息
2. 实现 `PUT /api/user/preferences` API 用于通知设置
3. 实现 `PUT /api/user/password` API 用于密码修改
4. 连接到Zammad用户更新API

---

### 8. 精简工单填充模板

**问题描述**: 工单回复模板需要精简优化。

**相关代码位置**:
- `src/app/api/templates/route.ts` - 模板API
- 数据库表: `ReplyTemplate`

**当前模板结构**:
```typescript
// templates/route.ts
const templateSchema = z.object({
  name: z.string().min(1).max(100),
  content: z.string().min(1).max(5000),
  category: z.enum(['first_contact', 'technical', 'follow_up', 'closing', 'general']),
  region: z.string().optional(),
  isActive: z.boolean().optional().default(true),
})
```

**建议优化**:
1. 添加模板变量支持: `{{customer_name}}`, `{{ticket_number}}` 等
2. 支持快捷键触发模板插入
3. 提供默认模板库
4. 允许Staff自定义个人模板

---

### 9. 单行文本过长显示不全

**问题描述**: 较长的文本内容在单行显示时被截断，无法完整查看。

**相关代码位置**:
- `src/components/ticket/article-content.tsx` - 文章内容显示
- `src/app/admin/tickets/[id]/page.tsx` (第189行) - 工单标题显示

**当前实现**:
```tsx
// article-content.tsx 第187行
<span className="max-w-[200px] truncate">{att.filename}</span>

// admin/tickets/[id]/page.tsx 第189行
<p className="text-base text-foreground mt-1">{ticket.title}</p>
```

**问题根因**:
1. 文件名使用 `truncate` 类强制截断
2. 工单标题没有使用 `break-words` 或 `whitespace-normal` 处理

**建议修复**:
1. 添加tooltip显示完整文本:
   ```tsx
   <Tooltip content={att.filename}>
     <span className="max-w-[200px] truncate">{att.filename}</span>
   </Tooltip>
   ```
2. 对长文本使用换行而非截断:
   ```tsx
   <p className="break-words">{ticket.title}</p>
   ```

---

### 10. 未启用的Customer被Staff看到了

**问题描述**: 已禁用（inactive）的客户仍然在Staff的客户列表中显示。

**相关代码位置**:
- `src/app/staff/customers/page.tsx` (第59-77行)
- `src/app/api/admin/users/route.ts`

**当前代码**:
```typescript
// staff/customers/page.tsx
const loadCustomers = async () => {
  const response = await fetch('/api/admin/users')
  const data = await response.json()
  // ⚠️ 只过滤了角色，未过滤active状态
  const customerList = (data.data?.users || []).filter(
    (user: Customer) => user.role === 'customer'
  )
  setCustomers(customerList)
}
```

**建议修复**:
```typescript
const customerList = (data.data?.users || []).filter(
  (user: Customer) => user.role === 'customer' && user.active !== false
)
```

或者在API层面添加 `active=true` 查询参数过滤。

---

### 11. 点开工单详情最好是默认到最新消息

**问题描述**: 打开工单详情时，希望自动滚动到最新的消息位置。

**相关代码位置**:
- `src/app/customer/my-tickets/[id]/page.tsx`
- `src/app/admin/tickets/[id]/page.tsx`
- `src/app/staff/tickets/[id]/page.tsx`

**当前状态**:
工单详情页面加载后默认显示顶部，用户需要手动滚动到底部查看最新回复。

**建议实现**:
```typescript
// 在articles加载完成后
useEffect(() => {
  if (articles.length > 0) {
    // 滚动到底部
    const articlesContainer = document.getElementById('articles-container')
    if (articlesContainer) {
      articlesContainer.scrollTop = articlesContainer.scrollHeight
    }
  }
}, [articles])
```

或使用 React ref:
```tsx
const messagesEndRef = useRef<HTMLDivElement>(null)
const scrollToBottom = () => {
  messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
}
```

---

### 12. Pending功能到底有什么用

**问题描述**: 用户不清楚Pending（待处理）状态的具体用途。

**相关代码位置**:
- `src/components/ticket/ticket-actions.tsx` (第36-42行, 第115-130行)
- `src/components/ticket/ticket-detail.tsx` (第26-33行)

**Pending状态说明**:

| 状态 | 用途 |
|------|------|
| **Pending Reminder** | 设置提醒时间，到期后系统会提醒Staff跟进 |
| **Pending Close** | 等待客户确认，到期后自动关闭工单 |

**当前实现**:
```typescript
// ticket-actions.tsx 第115-130行
useEffect(() => {
  const stateLower = state.toLowerCase()
  const requiresPendingTime = stateLower === 'pending reminder' || stateLower === 'pending close'
  setShowPendingTime(requiresPendingTime)
  
  // 默认设置24小时后
  if (requiresPendingTime && !pendingTime) {
    const defaultTime = new Date()
    defaultTime.setHours(defaultTime.getHours() + 24)
    setPendingTime(formatted)
  }
}, [state, pendingTime])
```

**建议改进**:
1. 在UI中添加状态说明tooltip
2. 添加用户引导或帮助文档
3. 考虑增加自动化动作（如到期自动发送邮件提醒）

---

### 13. 工单结束后的评价更好展示出来

**问题描述**: 工单关闭后的评价信息需要更明显的展示。

**相关代码位置**:
- `src/components/ticket/ticket-rating.tsx` - 评价组件
- `src/app/api/tickets/[id]/rating/route.ts` - 评价API

**当前评价界面**:
```tsx
// ticket-rating.tsx
interface RatingData {
  id: number
  ticketId: number
  rating: 'positive' | 'negative'
  reason?: string
  createdAt: string
}
```

**建议改进**:
1. **视觉强调**: 使用更大的图标和更醒目的颜色区分好评/差评
2. **显示位置**: 在工单详情顶部或侧边栏显示评价状态
3. **Admin视图**: 在工单列表中显示评价图标
4. **统计展示**: 在Staff/Admin Dashboard中展示评价统计

---

### 14. Admin账号（admin@test.com）不应参与自动分配

**问题描述**: 
- `admin@test.com` (Test Admin) 账号不应参与工单的自动分配
- 需要验证自动分配功能是否正常工作，是否正确排除了Admin账号

**相关代码位置**:
- `src/app/api/tickets/auto-assign/route.ts` - 自动分配API

**当前排除规则**:
```typescript
// auto-assign/route.ts 第22-23行
// 当前只排除了系统账号
const EXCLUDED_EMAILS = ['support@howentech.com', 'howensupport@howentech.com']
```

**自动分配逻辑分析**:
```typescript
// auto-assign/route.ts 第99-134行
const availableAgents = allAgents.filter(agent => {
    // 1. 排除系统账号
    if (EXCLUDED_EMAILS.some(email => agent.email?.toLowerCase() === email.toLowerCase())) {
        return false
    }
    
    // 2. 检查是否有该区域的访问权限
    const agentGroupIds = agent.group_ids || {}
    const hasGroupAccess = Object.keys(agentGroupIds).includes(String(groupId))
    
    // 3. 检查是否在休假
    if (agent.out_of_office) { ... }
    
    return hasGroupAccess
})
```

**问题根因**:
1. ⚠️ **Admin账号未被排除**: `admin@test.com` 不在 `EXCLUDED_EMAILS` 列表中
2. **排除依据不完整**: 当前只按邮箱排除，没有按角色(Admin)排除
3. **潜在风险**: 如果Admin账号有区域权限，可能会被分配工单

**验证方法**:
1. 调用 `GET /api/tickets/auto-assign` 查看未分配工单状态
2. 调用 `POST /api/tickets/auto-assign` 触发自动分配
3. 检查分配结果中是否包含 `admin@test.com`

**建议修复**:

**方案一**: 添加Admin邮箱到排除列表
```typescript
const EXCLUDED_EMAILS = [
    'support@howentech.com', 
    'howensupport@howentech.com',
    'admin@test.com'  // 添加Admin账号
]
```

**方案二**: 按角色排除Admin用户（推荐）
```typescript
const availableAgents = allAgents.filter(agent => {
    // 排除系统账号
    if (EXCLUDED_EMAILS.some(email => agent.email?.toLowerCase() === email.toLowerCase())) {
        return false
    }
    
    // 排除Admin角色用户（role_id=1通常是Admin）
    if (agent.role_ids?.includes(1) || agent.roles?.includes('Admin')) {
        return false
    }
    
    // ... 其余逻辑
})
```

**自动分配功能状态**:
| 检查项 | 状态 | 说明 |
|--------|------|------|
| 排除系统账号 | ✅ 正常 | 已配置 `EXCLUDED_EMAILS` |
| 排除Admin账号 | ❌ 未实现 | 需要添加 |
| 排除休假人员 | ✅ 正常 | 检查 `out_of_office` |
| 区域权限匹配 | ✅ 正常 | 检查 `group_ids` |
| 负载均衡 | ✅ 正常 | 按工单数量排序 |

---

## 优先级建议


### 🔴 高优先级（影响核心功能）
1. **#4 Webhook刷新问题** - 影响系统性能和用户体验
2. **#2 Staff跨区可见性** - 数据隔离/权限安全问题
3. **#1 Email HTML解析** - 影响客户通知质量
4. **#10 未启用Customer可见** - 数据隐私问题

### 🟡 中优先级（影响用户体验）
5. **#3 附件格式支持** - 功能限制
6. **#5 工单创建性能** - 用户体验
7. **#7 个人设置完善** - 功能完整性
8. **#9 文本显示** - UI问题
9. **#13 评价展示** - UX优化
10. **#14 Admin账号分配排除** - 自动分配逻辑验证

### 🔵 低优先级（功能增强）
11. **#6 客户-Staff对应** - 新功能需求
12. **#8 模板精简** - 优化需求
13. **#11 默认滚动位置** - UX细节
14. **#12 Pending说明** - 文档/引导

---

## 后续行动

1. 创建对应的Issue或Task跟踪每个问题
2. 按优先级分配开发资源
3. 高优先级问题建议在下个Sprint中解决
4. 中优先级问题可以安排在后续迭代
5. 低优先级作为Backlog持续改进
