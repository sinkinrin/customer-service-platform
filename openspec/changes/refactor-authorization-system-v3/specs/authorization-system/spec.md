# 授权系统规范

## 背景与目标

### 设计原则

1. **一劳永逸** - 从架构层面彻底解决权限问题，避免修补式开发
2. **统一入口** - 所有权限决策通过 PolicyEngine，消除分散检查
3. **声明式配置** - 权限规则通过 YAML 定义，便于审计和修改
4. **默认拒绝** - 无匹配规则则拒绝，安全优先

### 原始需求

| 来源 | 需求 | 优先级 |
|------|------|--------|
| 安全审计 | 所有 API 端点必须有权限检查 | P0 |
| 业务规则 | Staff 只能访问分配给自己的已分配工单 | P0 |
| 业务规则 | Customer 只能访问自己的工单 | P0 |
| 业务规则 | 仅 Admin 可分配工单 | P0 |
| 合规需求 | 敏感操作需要审计日志 | P1 |
| 可维护性 | 权限逻辑集中管理，便于修改 | P1 |

### 现有问题分析

#### 问题 1：权限逻辑分散

**现状**：权限检查分布在 3 处：
- `src/lib/utils/permission.ts` - 工单权限函数
- `src/lib/utils/region-auth.ts` - 区域过滤函数
- 各 API 文件内联检查

**问题**：
- 相同检查逻辑重复实现
- 修改时容易遗漏
- 无法统一审计

**已尝试方法**：
- 抽取 `checkTicketPermission` 函数 → 但 API 仍有内联检查
- 创建 `filterTicketsByPermission` → 但部分 API 仍用旧函数

#### 问题 2：API 权限检查缺失

**现状**：多个 API 端点缺乏权限检查

| API | 问题 | 风险 |
|-----|------|------|
| `POST /api/ai/chat` | 无认证 | 任何人可调用 |
| `GET /api/files/[id]/download` | 无所有权验证 | 任何用户可下载任何文件 |
| `GET /api/tickets/updates` | 无过滤 | 泄露所有工单动态 |
| `GET /api/tickets/[id]/rating` | 无工单验证 | 可查看他人评分 |
| `GET /api/tickets/.../attachments/...` | Staff 无工单访问验证 | 可下载非自己负责工单附件 |

**已尝试方法**：
- 逐个 API 添加检查 → 容易遗漏，不可持续

#### 问题 3：permission.ts 与 API 行为不一致

**现状**：
- `canAssignTicket()` 返回 `admin || staff`
- 实际 API 只允许 admin 分配

**问题**：
- 前端按 permission.ts 显示按钮，后端拒绝
- 用户体验差，容易误导

**已尝试方法**：无

#### 问题 4：区域权限不完整

**现状**：
- Templates 无区域隔离
- Reopen 无 Staff owner 校验
- Export 使用旧过滤函数

**已尝试方法**：
- `filterTicketsByRegion` 函数 → 但未统一使用

#### 问题 5：缺乏审计日志

**现状**：
- 敏感操作无记录
- 权限拒绝无日志
- 跨区域分配无审计

**已尝试方法**：无

### 解决方案：V3 架构重构

```
┌─────────────────────────────────────────────────────────┐
│                      API 端点                           │
│  withAuthorization(handler, { resourceType, action })   │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                    PolicyEngine                          │
│  evaluate(principal, resource, action) → Decision        │
└─────────────────────────────────────────────────────────┘
        │                   │                    │
        ▼                   ▼                    ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────────┐
│ Principal    │   │ Resource     │   │ PolicyLoader     │
│ Resolver     │   │ Resolver     │   │ (YAML → Rules)   │
└──────────────┘   └──────────────┘   └──────────────────┘
        │                   │                    │
        ▼                   ▼                    ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────────┐
│ Session      │   │ Zammad API   │   │ config/policies/ │
│ (NextAuth)   │   │ Prisma DB    │   │ *.yaml           │
└──────────────┘   └──────────────┘   └──────────────────┘
                          │
                          ▼
                  ┌──────────────┐
                  │ AuditLogger  │
                  └──────────────┘
```

---

## ADDED Requirements

### Requirement: 统一授权层
The system SHALL 提供统一的授权层，所有 API 端点通过 `PolicyEngine` 进行权限决策。

#### Scenario: 管理员访问任意资源
- **WHEN** 管理员用户请求访问任意资源
- **THEN** 系统允许访问
- **AND** 记录访问决策到审计日志

#### Scenario: 员工访问分配给自己的工单
- **WHEN** 员工用户请求访问分配给自己的已分配工单
- **THEN** 系统允许访问

#### Scenario: 员工访问非自己负责的工单被拒绝
- **WHEN** 员工用户请求访问非自己负责的工单（无论是否同区域）
- **THEN** 系统拒绝并返回 403

#### Scenario: 员工访问未分配工单被拒绝
- **WHEN** 员工用户请求访问未分配工单
- **THEN** 系统拒绝访问并返回 403

#### Scenario: 客户访问自己的工单
- **WHEN** 客户用户请求访问自己创建的工单
- **THEN** 系统允许访问

#### Scenario: 客户编辑自己的工单标题/描述
- **WHEN** 客户用户请求编辑自己创建的工单标题/描述
- **THEN** 系统允许操作

#### Scenario: 客户访问他人工单被拒绝
- **WHEN** 客户用户请求访问其他客户的工单
- **THEN** 系统返回 404（不泄露资源存在）

### Requirement: Principal 身份解析
The system SHALL 从会话中解析用户身份为 Principal 对象，包含角色和可访问区域。

#### Scenario: 管理员获得全局区域
- **WHEN** 管理员用户会话被解析
- **THEN** Principal.scopes 包含 'global'

#### Scenario: 员工获得指定区域
- **WHEN** 员工用户会话被解析
- **THEN** Principal.scopes 包含用户所属区域

#### Scenario: Principal 包含 Zammad 用户 ID
- **WHEN** 用户会话被解析
- **THEN** Principal.attributes.externalId 等于用户在 Zammad 中的用户 ID（`session.user.zammad_id`）

### Requirement: Resource 资源解析
The system SHALL 将业务实体解析为 Resource 对象，支持父资源关联。

#### Scenario: 工单资源解析
- **WHEN** Zammad 工单被解析
- **THEN** Resource 包含 type='ticket'、scope、owner、assignee、state

#### Scenario: 文件资源解析带父工单
- **WHEN** 关联工单的文件被解析
- **THEN** Resource.parent 指向关联的工单

### Requirement: 策略声明式定义
The system SHALL 支持通过 YAML 文件声明式定义权限策略。

#### Scenario: 加载 YAML 策略
- **WHEN** 系统启动
- **THEN** 从 config/policies/*.yaml 加载所有策略规则

#### Scenario: 策略规则优先级
- **WHEN** 评估权限时多个规则匹配
- **THEN** 优先级数字最小的规则生效

### Requirement: 父资源权限继承
The system SHALL 支持子资源通过父资源获得权限。

#### Scenario: 文件通过工单获得权限
- **WHEN** 用户请求访问工单关联的文件
- **AND** 用户有权访问该工单
- **THEN** 系统允许访问文件

#### Scenario: 评分通过工单获得权限
- **WHEN** 客户请求为工单评分
- **AND** 工单属于该客户
- **THEN** 系统允许评分操作

#### Scenario: 附件通过工单获得权限
- **WHEN** 用户请求下载工单的附件
- **AND** 用户有权访问该工单
- **THEN** 系统允许下载附件

### Requirement: 仅管理员可分配工单
The system SHALL 限制工单分配操作仅管理员可执行。

#### Scenario: 管理员分配工单
- **WHEN** 管理员请求分配工单给员工
- **THEN** 系统允许操作

#### Scenario: 员工分配工单被拒绝
- **WHEN** 员工请求分配工单
- **THEN** 系统拒绝并返回 403

### Requirement: 区域范围管理
The system SHALL 提供 ScopeRegistry 统一管理区域与 Zammad group_id 的映射。

#### Scenario: 区域 ID 转换
- **WHEN** 查询区域 'asia-pacific' 的 Zammad group_id
- **THEN** 返回 4

#### Scenario: 全局区域包含检查
- **WHEN** 检查 'global' 是否包含 'asia-pacific'
- **THEN** 返回 true

### Requirement: 模板区域隔离
The system SHALL 根据用户区域过滤可访问的回复模板。

#### Scenario: Staff 访问区域模板
- **WHEN** Staff 请求获取模板列表
- **THEN** 只返回其区域的模板或全局模板

#### Scenario: Staff 修改他区模板被拒绝
- **WHEN** Staff 请求修改非其区域的模板
- **THEN** 返回 403

### Requirement: 工单重开权限
The system SHALL 验证用户对工单的访问权限后才能重开工单。

#### Scenario: Customer 重开自己工单
- **WHEN** Customer 请求重开自己的已关闭工单
- **THEN** 允许重开

#### Scenario: Staff 重开分配给自己的工单
- **WHEN** Staff 请求重开分配给自己的已关闭工单
- **THEN** 允许重开

#### Scenario: Staff 重开非自己负责工单被拒绝
- **WHEN** Staff 请求重开非自己负责的工单
- **THEN** 返回 403

---

## 问题追踪

| ID | 问题 | 类型 | 状态 | 解决方案 |
|----|------|------|------|----------|
| P-001 | AI Chat 无认证 | 安全漏洞 | 待修复 | PolicyEngine + ai_chat 资源类型 |
| P-002 | File 无所有权验证 | 安全漏洞 | 待修复 | 父资源权限继承 |
| P-003 | Rating 无工单验证 | 安全漏洞 | 待修复 | 父资源权限继承 |
| P-004 | Updates 泄露全部 | 安全漏洞 | 待修复 | PolicyEngine.filter() |
| P-005 | Webhook 签名可选 | 安全漏洞 | 待修复 | 生产环境强制验证 |
| P-006 | permission.ts 不一致 | 代码缺陷 | 待修复 | 统一使用 PolicyEngine |
| P-007 | Attachment 无工单访问验证 | 安全漏洞 | 待修复 | 父资源权限继承 |
| P-008 | Export 用旧过滤函数 | 代码缺陷 | 待修复 | 使用 PolicyEngine.filter() |
| P-009 | Templates 无区域隔离 | 权限缺失 | 待修复 | template 资源类型 + scope 检查 |
| P-010 | Reopen 权限过宽 | 权限缺失 | 待修复 | ticket.reopen action 策略 |

---

## 领域模型

### Principal（用户身份）

```typescript
interface Principal {
  id: string
  role: 'admin' | 'staff' | 'customer'
  scopes: string[]
  attributes: {
    externalId?: number
    email: string
  }
}
```

### Resource（资源）

```typescript
interface Resource {
  type: ResourceType
  id: string | number
  scope: string
  owner?: string | number
  assignee?: string | number
  state: ResourceState
  parent?: { type: ResourceType; id: string | number }
}
```

**字段映射约定**：
- `Principal.id` = NextAuth `session.user.id`（本地用户 ID）
- `Principal.attributes.externalId` = NextAuth `session.user.zammad_id`（Zammad 用户 ID）
- `ticket.owner` = Zammad `ticket.customer_id`（Customer）
- `ticket.assignee` = Zammad `ticket.owner_id`（Zammad 字段名为 owner_id，语义为“负责人/Agent”）
- `ticket.state = unassigned` 当 `ticket.owner_id` 为 `null/0/1`

### 资源类型

| 类型 | 父资源 | 说明 |
|------|-------|------|
| `ticket` | - | 工单 |
| `article` | `ticket` | 工单消息 |
| `attachment` | `ticket` | 工单附件 |
| `file` | `ticket` 或无 | 上传文件 |
| `rating` | `ticket` | 工单评分 |
| `update` | `ticket` | 工单更新事件 |
| `conversation` | - | AI 对话 |
| `template` | - | 回复模板 |
| `user` | - | 用户 |
| `faq` | - | FAQ 文章 |
| `ai_chat` | - | AI 聊天 |
| `session` | - | 用户会话 |
| `vacation` | - | 假期设置 |

### 区域列表

| ID | 名称 | Zammad group_id |
|----|------|-----------------|
| `global` | Global | — |
| `asia-pacific` | Asia Pacific | 4 |
| `middle-east` | Middle East | 3 |
| `africa` | Africa | 1 |
| `north-america` | North America | 6 |
| `latin-america` | Latin America | 7 |
| `europe-zone-1` | Europe Zone 1 | 2 |
| `europe-zone-2` | Europe Zone 2 | 8 |
| `cis` | CIS | 5 |

> 注：`global` 是内部 scope，用于表示 Admin 全局权限；Zammad 实际 group_id 以 `src/lib/constants/regions.ts` 为准（1-8），不存在 group_id=0。

---

## 边界情况与决策

### 决策 1：Staff 非 owner 工单不可见

**问题**：Staff 能否查看区域内已分配但非自己负责的工单？

**决策**：不可以。Staff 仅可访问分配给自己的工单。

**说明**：未分配工单仍遵循“决策 11：未分配工单仅 Admin 可见”。

**实现**：
```yaml
- id: deny-staff-not-assignee
  action: [view, edit, close, reopen]
  effect: deny
  conditions:
    - type: role_is
      params: { role: staff }
    - type: is_assignee
      negate: true
```

### 决策 2：跨区域分配后的历史访问

**问题**：工单从区域 A 分配到区域 B 后，A 的 Staff 能否查看历史？

**决策**：不能。工单跟随当前 group_id。

**原因**：简化权限模型，避免历史追溯复杂度。

### 决策 3：Customer 角色的 404 vs 403

**问题**：Customer 访问他人资源时返回什么？

**决策**：返回 404，不泄露资源存在。

**实现**：`withAuthorization` 包装器对 Customer 角色的拒绝响应使用 404。

### 决策 4：Admin 代管假期

**问题**：Admin 能否修改 Staff 的假期状态？

**决策**：可以。Admin 需要管理团队可用性。

**实现**：vacation 资源对 Admin 开放所有操作。

### 决策 5：跨区域分配机制

**问题**：Admin 将工单分配给其他区域的 Staff 时，如何处理权限？

**背景**：
- Zammad API 限制：Agent 必须拥有工单所属 `group_id` 的权限才能被设为 `owner_id`
- 业务需求：支持跨区域临时借调 Staff 处理工单

**决策**：跨区域分配时，工单的 `group_id` 跟随目标 Staff 变更。

**行为**：
| 属性 | 变更 | 说明 |
|------|------|------|
| `owner_id` | → 目标 Staff | 新负责人 |
| `group_id` | → 目标 Staff 的区域 | Zammad 限制，必须变更 |
| `customer_id` | 不变 | 客户归属不变 |

**影响**：
| 角色 | 分配后 | 原因 |
|------|--------|------|
| Admin | ✅ 可见 | 全局权限 |
| 目标区域 Staff（新负责人） | ✅ 可见 | owner_id 指向他 |
| 目标区域其他 Staff | ❌ 不可见 | 非 owner 工单不可见 |
| 原区域 Staff | ❌ 不可见 | 非 owner 工单不可见（owner 已变更） |
| Customer | ✅ 可见 | customer_id 是他 |

**审计**：
- 所有跨区域分配必须记录审计日志
- 记录内容：原区域、目标区域、操作 Admin、目标 Staff、原因

**注意**：
- 只影响这一个工单，不影响 Customer 的区域归属
- Customer 的其他工单和未来新工单仍在原区域
- 这是"临时借调"的实现方式，符合业务需求

### 决策 6：工单创建与自动分配

**问题**：工单创建后如何分配？

**场景 1：网页端创建**
- 用户有账号，系统知道其区域
- 工单创建时设置 `group_id` 为用户所属区域
- 自动分配系统按 `group_id` 找本区域可用 Agent
- 工单在创建后短时间内被自动分配

**场景 2：邮件创建（Zammad 自动转换）**
- 用户无账号或未关联区域
- Zammad 使用邮件渠道默认 group
- 工单保持"未分配"状态（`owner_id` = 1）
- 需要 Admin 手动分配（可跨区域）

**决策**：
- 网页工单：自动分配，无需 Admin 干预
- 邮件工单：Admin 分发模式，手动分配

### 决策 7：Customer 操作权限

**问题**：Customer 可以执行哪些操作？

**决策**：

| 操作 | 允许 | 说明 |
|------|------|------|
| 创建工单 | ✅ | 基本功能 |
| 查看自己工单 | ✅ | 基本功能 |
| 关闭工单 | ✅ | 主动结束服务 |
| 重开工单 | ✅ | 问题未解决 |
| 上传附件 | ✅ | 提供补充材料 |
| 修改工单标题/描述 | ✅ | 补充信息 |
| 查看他人工单 | ❌ | 返回 404 |
| 分配工单 | ❌ | 仅 Admin |
| 删除工单 | ❌ | 仅 Admin |

### 决策 8：AI Chat 权限

**问题**：谁可以使用 AI Chat？

**决策**：所有已登录用户均可使用。

**实现**：
```yaml
- id: allow-authenticated-ai-chat
  action: use
  resource: ai_chat
  effect: allow
  conditions:
    - type: authenticated
```

### 决策 9：Staff 回复权限（严格责任制）

**问题**：Staff 能否回复区域内但非自己负责的工单？

**决策**：不可以。严格责任制，只有 owner 才能回复。

**行为**：
| 角色 | 条件 | 能否回复 |
|------|------|----------|
| Staff | owner_id 是自己 | ✅ |
| Staff | 在区域内但 owner_id 不是自己 | ❌ |
| Admin | 任意工单 | ✅ |
| Customer | 自己的工单 | ✅ |

**原因**：
- 明确责任归属
- 避免多人同时处理造成混乱
- 如需协作，Admin 可重新分配

### 决策 10：Staff 离职/账号禁用处理

**问题**：Staff 离职、账号禁用或删除后，其负责的工单如何处理？

**决策**：自动变为"未分配"状态。

**触发条件**：
- 账号被禁用（disabled）
- 账号被删除（deleted）
- 以上均视为"离职处理"

**行为**：
1. 系统检测到 Staff 账号状态变更
2. 查找该 Staff 负责的所有 open 工单
3. 将这些工单的 `owner_id` 设为 1（Zammad 系统用户，表示未分配）
4. 记录审计日志
5. 通知 Admin（如有通知系统）

**注意**：
- 已关闭的工单不受影响（保留历史负责人信息）
- 只处理 open/pending 状态的工单

### 决策 11：未分配工单可见性

**问题**：Staff 能否查看区域内未分配的工单？

**决策**：不可以。未分配工单仅 Admin 可见。

**原因**：
- 未分配工单会自动走分配程序分配出去
- 除非不满足分配条件（如该区域无可用 Agent）
- 这种情况需要 Admin 介入处理

**现有实现**：`src/lib/utils/permission.ts` 已包含“Staff 不可访问未分配工单”的拒绝逻辑。

### 决策 12：工单删除

**问题**：工单删除是硬删除还是软删除？

**决策**：硬删除（Zammad 原生行为）。

**行为**：
- 仅 Admin 可删除工单
- 调用 Zammad API `DELETE /tickets/{id}`
- 工单从 Zammad 数据库中永久移除
- 删除操作记录审计日志

**原因**：
- Zammad 不支持内置软删除
- 实现软删除需要额外开发（自定义状态或本地标记）
- 当前业务需求不需要回收站功能

**注意**：
- 删除前应确认，操作不可逆
- 审计日志保留删除记录（工单 ID、标题、操作者、时间）

### 决策 13：工单状态流转权限

**问题**：谁可以变更工单状态？

**决策**：

| 操作 | Admin | Staff (owner) | Staff (非owner) | Customer |
|------|-------|---------------|-----------------|----------|
| 关闭工单 | ✅ | ✅ | ❌ | ✅ (自己的) |
| 重开工单 | ✅ | ✅ | ❌ | ✅ (自己的) |
| 其他状态变更 | ✅ | ✅ | ❌ | ❌ |

**说明**：
- 关闭：有编辑权限的人都可以关闭
- 重开：Customer 可以重开自己的工单（问题未解决时）
- 其他状态（pending reminder、pending close 等）：仅 Admin/owner Staff 可操作
