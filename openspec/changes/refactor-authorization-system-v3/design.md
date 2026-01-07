# 设计：授权系统 V3 架构

## 上下文

### 背景

当前权限系统存在根本性缺陷：
- 权限逻辑分散在 `permission.ts`、`region-auth.ts` 和各 API 文件中
- 部分 API 完全缺乏权限检查（如 AI Chat、File Download）
- `permission.ts` 与实际 API 行为不一致（staff assign 问题）
- 缺乏统一的审计日志

### 约束

- 必须兼容现有 Zammad 后端的 `group_id` 和 `owner_id` 机制
- 不能破坏现有的工单创建和分配流程
- 需要支持 8 个区域
- 不修改 NextAuth.js 配置

### 利益相关者

- **Admin**：全局权限，可跨区域分配工单
- **Staff**：只能访问分配给自己的工单（未分配/非 owner 不可见）
- **Customer**：个人权限，只能访问自己的工单

## 目标 / 非目标

### 目标

1. **单一权限入口** - 所有权限决策通过 `PolicyEngine`
2. **声明式策略** - 使用 YAML 定义权限规则，非代码分支
3. **完整覆盖** - 所有 56+ API 端点受统一策略保护
4. **资源桥接** - 本地数据（文件、评分）正确关联到工单权限
5. **默认拒绝** - 无匹配规则则拒绝访问
6. **审计就绪** - 所有决策可追溯

### 非目标

- 不重构 Zammad 后端权限模型
- 不添加新的权限层级（如团队主管）
- 不实现细粒度的字段级权限
- 不实现实时权限同步

## 决策

### 决策 1：领域模型设计

**内容**：采用 Principal-Resource-Action 三元组模型

```typescript
// Principal（谁）
interface Principal {
  id: string
  role: 'admin' | 'staff' | 'customer'
  scopes: string[]  // 可访问的区域
  attributes: { externalId?: number; email: string }
}

// Resource（什么）
interface Resource {
  type: ResourceType  // ticket, file, rating, update, etc.
  id: string | number
  scope: string       // 所属区域
  owner?: string      // 所有者
  assignee?: string   // 负责人
  state: ResourceState
  parent?: { type: ResourceType; id: string | number }
}

// Action（如何）
type Action = 'view' | 'create' | 'edit' | 'delete' | 'assign' | 'close' | 'reopen' | 'export' | 'download' | '*'
```

**原因**：
- 清晰分离身份、资源和操作
- 支持父资源权限继承（文件→工单）
- 便于策略规则编写

### 决策 2：策略评估引擎

**内容**：基于规则优先级的策略引擎

```typescript
interface PolicyRule {
  id: string
  description: string
  resource: ResourceType | '*'
  action: Action | Action[]
  effect: 'allow' | 'deny'
  priority: number  // 数字越小优先级越高
  conditions: Condition[]
}
```

**评估流程**：
1. 按优先级排序规则
2. 依次检查规则是否匹配
3. 第一个匹配的规则决定结果
4. 无匹配规则则拒绝

**原因**：
- 简单明确的评估逻辑
- 支持显式拒绝规则
- 便于调试和审计

### 决策 3：资源类型定义

**内容**：定义完整的资源类型层次

| 资源类型 | 父资源 | 说明 |
|---------|-------|------|
| `ticket` | - | 工单，核心资源 |
| `article` | `ticket` | 工单消息 |
| `file` | `ticket` 或无 | 上传文件 |
| `rating` | `ticket` | 工单评分 |
| `update` | `ticket` | 工单更新事件 |
| `conversation` | - | AI 对话 |
| `template` | - | 回复模板 |
| `user` | - | 用户管理 |
| `faq` | - | FAQ 文章 |
| `faq_rating` | `faq` | FAQ 评分 |
| `ai_chat` | - | AI 聊天会话 |
| `session` | - | 用户会话 |
| `vacation` | - | 假期设置 |

**原因**：
- 支持父资源权限继承
- 覆盖所有业务实体

### 决策 4：条件类型定义

**内容**：定义丰富的条件检查类型

```typescript
type ConditionType =
  // 登录状态检查
  | 'authenticated'     // 已登录（存在会话）
  // 角色检查
  | 'role_is'           // 角色等于
  | 'role_in'           // 角色在列表中
  // 所有权检查
  | 'is_owner'          // 是资源所有者
  | 'is_assignee'       // 是资源负责人
  | 'is_self'           // 操作自己的资源
  // 范围检查
  | 'scope_contains'    // 用户范围包含资源范围
  | 'scope_is_global'   // 资源无特定区域
  | 'has_scopes'        // 用户有有效范围
  // 状态检查
  | 'state_is'          // 状态等于
  | 'state_not'         // 状态不等于
  // 父资源检查
  | 'can_view_parent'   // 可查看父资源
  | 'parent_type_is'    // 父资源类型是
  // 引用检查
  | 'reference_type_is' // 文件引用类型是
```

**原因**：
- 覆盖所有权限检查场景
- 支持复杂条件组合

### 决策 5：API 包装器模式

**内容**：使用高阶函数包装 API 处理器

```typescript
export const GET = withAuthorization(
  async (req, { params, principal, resource }) => {
    // 业务逻辑（已通过权限检查）
  },
  {
    resourceType: 'ticket',
    action: 'view',
    resolveResource: async (req, params) => {
      // 解析资源
    },
  }
)
```

**原因**：
- 分离权限检查和业务逻辑
- 统一错误处理
- 便于测试

### 决策 6：审计日志设计

**内容**：记录所有权限决策

```prisma
model AuditLog {
  id            String   @id @default(uuid())
  timestamp     DateTime @default(now())
  principalId   String
  principalRole String
  principalEmail String
  resourceType  String
  resourceId    String
  action        String
  decision      String   // 'allowed' | 'denied'
  ruleId        String
  reason        String
  metadata      String?  // JSON: 跨区域分配详情等

  @@index([principalEmail])
  @@index([resourceType, resourceId])
  @@index([action])
  @@index([timestamp])
}
```

**原因**：
- 合规审计需求
- 安全事件追溯
- 权限问题调试

### 决策 7：区域（Scope）管理

**内容**：使用 ScopeRegistry 统一管理区域映射

```typescript
const SCOPE_DEFINITIONS: ScopeDefinition[] = [
  { id: 'global', name: 'Global', externalId: 0 },
  { id: 'asia-pacific', name: 'Asia Pacific', externalId: 4, parent: 'global' },
  { id: 'middle-east', name: 'Middle East', externalId: 3, parent: 'global' },
  { id: 'africa', name: 'Africa', externalId: 1, parent: 'global' },
  { id: 'north-america', name: 'North America', externalId: 6, parent: 'global' },
  { id: 'latin-america', name: 'Latin America', externalId: 7, parent: 'global' },
  { id: 'europe-zone-1', name: 'Europe Zone 1', externalId: 2, parent: 'global' },
  { id: 'europe-zone-2', name: 'Europe Zone 2', externalId: 8, parent: 'global' },
  { id: 'cis', name: 'CIS', externalId: 5, parent: 'global' },
]
```

**原因**：
- 单一真相源
- 支持 Zammad group_id 映射
- 支持层级关系（global 包含所有区域）

## 关键策略规则

### Ticket 策略

```yaml
policies:
  # Admin 全权限
  - id: admin-ticket-access
    resource: ticket
    action: "*"
    effect: allow
    priority: 10
    conditions:
      - type: role_is
        params: { role: admin }

  # 拒绝 Staff 访问未分配工单
  - id: deny-staff-unassigned
    resource: ticket
    action: [view, edit, close, reopen]
    effect: deny
    priority: 20
    conditions:
      - type: role_is
        params: { role: staff }
      - type: state_is
        params: { state: unassigned }

  # 拒绝 Staff 访问非自己负责的工单
  - id: deny-staff-not-assignee
    resource: ticket
    action: [view, edit, close, reopen]
    effect: deny
    priority: 21
    conditions:
      - type: role_is
        params: { role: staff }
      - type: is_assignee
        negate: true

  # 拒绝 Staff 分配工单（仅 Admin 可分配）
  - id: deny-staff-assign
    resource: ticket
    action: assign
    effect: deny
    priority: 23
    conditions:
      - type: role_is
        params: { role: staff }

  # 拒绝 Customer 访问他人工单
  - id: deny-customer-others
    resource: ticket
    action: "*"
    effect: deny
    priority: 25
    conditions:
      - type: role_is
        params: { role: customer }
      - type: is_owner
        negate: true

  # 允许 Staff 访问自己负责的工单
  - id: allow-staff-assigned
    resource: ticket
    action: [view, edit, close, reopen]
    effect: allow
    priority: 40
    conditions:
      - type: role_is
        params: { role: staff }
      - type: is_assignee
      - type: state_not
        params: { state: unassigned }

  # 允许 Customer 访问自己的工单
  - id: allow-customer-own
    resource: ticket
    action: [view, edit, close, reopen]
    effect: allow
    priority: 50
    conditions:
      - type: role_is
        params: { role: customer }
      - type: is_owner
```

### File 策略（父资源桥接）

```yaml
policies:
  # 所有者可访问自己上传的文件
  - id: owner-file-access
    resource: file
    action: [view, download, delete]
    effect: allow
    priority: 20
    conditions:
      - type: is_owner

  # 可查看工单则可查看其文件
  - id: ticket-file-access
    resource: file
    action: [view, download]
    effect: allow
    priority: 30
    conditions:
      - type: reference_type_is
        params: { type: ticket }
      - type: can_view_parent
```

## 风险 / 权衡

### 风险 1：YAML 策略加载性能

- **风险**：每次请求解析 YAML 影响性能
- **缓解**：启动时加载并缓存，仅开发环境支持热更新

### 风险 2：父资源查询开销

- **风险**：`can_view_parent` 条件需要额外查询
- **缓解**：使用请求级缓存，同一请求中复用查询结果

### 风险 3：迁移过程中的权限不一致

- **风险**：部分 API 使用旧逻辑，部分使用新逻辑
- **缓解**：
  1. 先修复 P0 漏洞（不依赖 V3）
  2. 按优先级分批迁移
  3. 保持旧函数可用直到完全迁移

### 风险 4：审计日志数据量

- **风险**：高流量下日志快速增长
- **缓解**：
  1. 开发环境仅 console 输出
  2. 生产环境配置日志保留策略
  3. 仅记录敏感操作详情

## 文件结构

```
src/lib/authorization/
├── index.ts                 # 公共 API 导出
├── types.ts                 # 类型定义
├── scope-registry.ts        # 区域管理
├── principal-resolver.ts    # 身份解析
├── resource-resolver.ts     # 资源解析
├── policy-engine.ts         # 策略引擎
├── policy-loader.ts         # YAML 加载
├── with-authorization.ts    # API 包装器
├── audit-logger.ts          # 审计日志
└── __tests__/               # 单元测试

config/policies/
├── ticket.yaml
├── file.yaml
├── rating.yaml
├── update.yaml
├── template.yaml
├── conversation.yaml
├── user.yaml
├── ai-chat.yaml
├── session.yaml
├── vacation.yaml
└── faq.yaml
```

## 测试策略

### 单元测试

```typescript
describe('PolicyEngine', () => {
  describe('Ticket Permissions', () => {
    it('should allow admin to view any ticket')
    it('should deny staff access to unassigned tickets')
    it('should deny staff assign action')
    it('should allow customer to view own tickets')
    it('should deny customer access to others tickets')
  })

  describe('File Permissions with Parent Bridging', () => {
    it('should allow file owner to download')
    it('should allow access to ticket-referenced file if can view ticket')
    it('should deny access to file without valid reference')
  })
})
```

### 集成测试

```typescript
describe('API Authorization', () => {
  it('GET /api/tickets/updates should filter by accessible tickets')
  it('POST /api/tickets/[id]/rating should verify ticket ownership')
  it('GET /api/files/[id]/download should check file permissions')
  it('POST /api/ai/chat should require authentication')
})
```

## 开放问题

1. **策略热更新** - 是否需要不重启服务更新策略？
   - 当前决策：仅开发环境支持，生产需重启

2. **审计日志查询 API** - 是否需要管理界面查询审计日志？
   - 当前决策：后续功能，不在本次范围

3. **权限缓存** - 是否需要用户级权限缓存？
   - 当前决策：暂不实现，观察性能后决定
