# Authorization System V2 - Architecture Design

> **Status**: Proposal
> **Author**: Claude
> **Date**: 2026-01-05
> **Version**: 2.0

## 1. Executive Summary

This document proposes a redesigned authorization architecture for the Customer Service Platform. The new design addresses fundamental issues in the current implementation:

- **Data inconsistency** between multiple permission sources
- **Scattered permission logic** across API endpoints
- **Fragile boundary handling** with different behaviors per function
- **Semantic confusion** between `group_id`, `region`, and `owner_id`

The new architecture adopts a **Policy-Based Access Control (PBAC)** model with declarative rules.

---

## 2. Current Architecture Problems

### 2.1 Multiple Sources of Truth

```
Current State:
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│   Zammad    │   │  Mock Auth  │   │    JWT      │
│  group_ids  │   │  group_ids  │   │  group_ids  │
└──────┬──────┘   └──────┬──────┘   └──────┬──────┘
       │                 │                 │
       └────────┬────────┴────────┬────────┘
                │   INCONSISTENT   │
                ▼                  ▼
         Permission Check FAILS or LEAKS
```

### 2.2 Scattered Permission Logic

| File | Permission Function | Issue |
|------|---------------------|-------|
| `permission.ts` | `filterTicketsByPermission()` | Checks `owner_id` and `group_id` |
| `region-auth.ts` | `filterTicketsByRegion()` | Only checks `group_id`, ignores `owner_id` |
| API routes | Inline `requireRole()` | No resource-level checks |

### 2.3 Identified Edge Cases

1. **Staff with empty `group_ids`**: Returns no tickets (silent failure)
2. **Mock user data mismatch**: `region: 'asia-pacific'` but `group_ids: [2]` (should be `[4]`)
3. **Legacy conversations without region**: Accessible by all staff
4. **Unassigned tickets**: Rely on `owner_id = 1` detection (Zammad-specific)

---

## 3. New Architecture Design

### 3.1 Core Principles

| Principle | Description |
|-----------|-------------|
| **Single Source of Truth** | All permission decisions flow through `PolicyEngine` |
| **Declarative Rules** | Permissions defined in configuration, not code branches |
| **Resource-Oriented** | Permissions attached to resources, not operations |
| **Fail-Safe** | Default deny; only explicit `allow` rules grant access |
| **Audit-Ready** | Every decision logged with rule ID and reason |

### 3.2 System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     APPLICATION LAYER                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  API Routes / Server Actions                         │   │
│  │  → Business logic only, no permission checks         │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   AUTHORIZATION LAYER                       │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  AuthorizationMiddleware                             │   │
│  │  → Intercepts all requests                           │   │
│  │  → Resolves Principal from session                   │   │
│  │  → Extracts Resource from request                    │   │
│  │  → Calls PolicyEngine.evaluate()                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                              │                              │
│                              ▼                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  PolicyEngine                                        │   │
│  │  → Evaluates rules in priority order                 │   │
│  │  → Returns Decision {allowed, rule, reason}          │   │
│  └─────────────────────────────────────────────────────┘   │
│                              │                              │
│                              ▼                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  PolicyDefinitions (YAML)                            │   │
│  │  → Declarative permission rules                      │   │
│  │  → Versioned in repository                           │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     IDENTITY LAYER                          │
│                                                             │
│  ┌───────────────────────┐   ┌───────────────────────┐     │
│  │  PrincipalResolver    │   │  ScopeRegistry        │     │
│  │  → Builds Principal   │   │  → Region definitions │     │
│  │    from session       │   │  → Group ID mappings  │     │
│  └───────────────────────┘   │  → Hierarchy support  │     │
│                              └───────────────────────┘     │
│                                                             │
│  ┌───────────────────────────────────────────────────┐     │
│  │  ResourceAdapter                                   │     │
│  │  → Converts Zammad objects to Resource            │     │
│  │  → Normalizes external data                       │     │
│  └───────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Domain Model

### 4.1 Principal (Who)

The authenticated entity requesting access.

```typescript
interface Principal {
  id: string                    // Internal user ID
  role: 'admin' | 'staff' | 'customer'
  scopes: string[]              // Accessible scope IDs
  attributes: {
    externalId?: number         // Zammad user ID
    email: string
    organizationId?: number
  }
}
```

### 4.2 Resource (What)

The object being accessed.

```typescript
interface Resource {
  type: ResourceType
  id: string | number
  scope: string                 // Owning scope (region)
  owner?: string                // Owner ID (customer)
  assignee?: string             // Assigned agent ID
  state: ResourceState
  attributes?: Record<string, unknown>
}

type ResourceType =
  | 'ticket'
  | 'article'
  | 'conversation'
  | 'user'
  | 'faq'
  | 'report'

type ResourceState =
  | 'unassigned'
  | 'assigned'
  | 'closed'
  | 'archived'
```

### 4.3 Scope (Where)

Hierarchical access boundaries.

```typescript
interface ScopeDefinition {
  id: string                    // 'asia-pacific'
  name: string                  // 'Asia Pacific'
  externalId: number            // Zammad group_id: 4
  parent?: string               // 'global' for hierarchy
  metadata?: {
    timezone?: string
    languages?: string[]
  }
}
```

### 4.4 Action (How)

The operation being performed.

```typescript
type Action =
  | 'view'      // Read access
  | 'create'    // Create new
  | 'edit'      // Modify existing
  | 'delete'    // Remove
  | 'assign'    // Change assignee
  | 'close'     // Close ticket
  | 'reopen'    // Reopen ticket
  | 'export'    // Export data
  | '*'         // All actions
```

---

## 5. Core Components

### 5.1 ScopeRegistry

Single source of truth for region/group mappings.

```typescript
// src/lib/authorization/scope-registry.ts

export const SCOPE_DEFINITIONS: ScopeDefinition[] = [
  // Root scope
  { id: 'global', name: 'Global', externalId: 0 },

  // Regional scopes (mapped to Zammad groups)
  { id: 'asia-pacific',   name: 'Asia Pacific',   externalId: 4, parent: 'global' },
  { id: 'middle-east',    name: 'Middle East',    externalId: 3, parent: 'global' },
  { id: 'africa',         name: 'Africa',         externalId: 1, parent: 'global' },
  { id: 'north-america',  name: 'North America',  externalId: 6, parent: 'global' },
  { id: 'latin-america',  name: 'Latin America',  externalId: 7, parent: 'global' },
  { id: 'europe-zone-1',  name: 'Europe Zone 1',  externalId: 2, parent: 'global' },
  { id: 'europe-zone-2',  name: 'Europe Zone 2',  externalId: 8, parent: 'global' },
  { id: 'cis',            name: 'CIS',            externalId: 5, parent: 'global' },
]

export class ScopeRegistry {
  private scopes: Map<string, ScopeDefinition>
  private externalIdMap: Map<number, ScopeDefinition>

  constructor(definitions: ScopeDefinition[] = SCOPE_DEFINITIONS) {
    this.scopes = new Map(definitions.map(d => [d.id, d]))
    this.externalIdMap = new Map(definitions.map(d => [d.externalId, d]))
  }

  get(id: string): ScopeDefinition | undefined {
    return this.scopes.get(id)
  }

  fromExternalId(externalId: number): ScopeDefinition | undefined {
    return this.externalIdMap.get(externalId)
  }

  /**
   * Check if scopeA contains scopeB (hierarchy)
   * 'global' contains all scopes
   */
  contains(scopeA: string, scopeB: string): boolean {
    if (scopeA === 'global') return true
    if (scopeA === scopeB) return true

    // Walk up the hierarchy
    let current = this.scopes.get(scopeB)
    while (current?.parent) {
      if (current.parent === scopeA) return true
      current = this.scopes.get(current.parent)
    }
    return false
  }

  getAllScopeIds(): string[] {
    return [...this.scopes.keys()].filter(id => id !== 'global')
  }

  getAllExternalIds(): number[] {
    return [...this.externalIdMap.keys()].filter(id => id !== 0)
  }
}

export const scopeRegistry = new ScopeRegistry()
```

### 5.2 PrincipalResolver

Builds standardized Principal from session data.

```typescript
// src/lib/authorization/principal-resolver.ts

import { auth } from '@/auth'
import { scopeRegistry } from './scope-registry'

export class PrincipalResolver {
  async resolve(): Promise<Principal | null> {
    const session = await auth()
    if (!session?.user) return null

    const { user } = session
    const role = user.role as Principal['role']

    // Admin gets global scope
    if (role === 'admin') {
      return {
        id: user.id,
        role: 'admin',
        scopes: ['global'],
        attributes: {
          externalId: user.zammad_id,
          email: user.email,
        }
      }
    }

    // Staff/Customer: derive scope from region
    const scopeId = user.region
    if (!scopeId) {
      // No region = no access (Fail-Safe)
      console.warn(`[AuthZ] User ${user.email} has no region assigned`)
      return {
        id: user.id,
        role,
        scopes: [],
        attributes: {
          externalId: user.zammad_id,
          email: user.email,
        }
      }
    }

    // Validate scope exists
    if (!scopeRegistry.get(scopeId)) {
      console.error(`[AuthZ] Unknown scope: ${scopeId}`)
      return {
        id: user.id,
        role,
        scopes: [],
        attributes: {
          externalId: user.zammad_id,
          email: user.email,
        }
      }
    }

    return {
      id: user.id,
      role,
      scopes: [scopeId],
      attributes: {
        externalId: user.zammad_id,
        email: user.email,
      }
    }
  }
}

export const principalResolver = new PrincipalResolver()
```

### 5.3 ResourceAdapter

Converts external data to standardized Resource.

```typescript
// src/lib/authorization/resource-adapter.ts

import type { ZammadTicket } from '@/lib/zammad/types'
import { scopeRegistry } from './scope-registry'

export class ResourceAdapter {
  /**
   * Convert Zammad ticket to Resource
   */
  fromZammadTicket(ticket: ZammadTicket): Resource {
    const scope = scopeRegistry.fromExternalId(ticket.group_id)

    // Detect unassigned state
    // Zammad: owner_id = null | 0 | 1 means unassigned
    const isUnassigned = !ticket.owner_id ||
                         ticket.owner_id === 0 ||
                         ticket.owner_id === 1

    // Map state_id to ResourceState
    let state: ResourceState = 'assigned'
    if (isUnassigned) {
      state = 'unassigned'
    } else if (ticket.state_id === 4) {
      state = 'closed'
    }

    return {
      type: 'ticket',
      id: ticket.id,
      scope: scope?.id ?? 'unknown',
      owner: ticket.customer_id?.toString(),
      assignee: isUnassigned ? undefined : ticket.owner_id?.toString(),
      state,
      attributes: {
        number: ticket.number,
        title: ticket.title,
        priority_id: ticket.priority_id,
        state_id: ticket.state_id,
      }
    }
  }

  /**
   * Convert conversation to Resource
   */
  fromConversation(conv: { id: string; region?: string; customer_email: string }): Resource {
    return {
      type: 'conversation',
      id: conv.id,
      scope: conv.region ?? 'unknown',
      owner: conv.customer_email,
      state: 'assigned',
    }
  }
}

export const resourceAdapter = new ResourceAdapter()
```

### 5.4 PolicyEngine

Evaluates permission rules.

```typescript
// src/lib/authorization/policy-engine.ts

interface PolicyRule {
  id: string
  description: string
  resource: ResourceType | '*'
  action: Action | Action[]
  effect: 'allow' | 'deny'
  conditions: Condition[]
  priority: number
}

interface Condition {
  type: ConditionType
  negate?: boolean
  params?: Record<string, unknown>
}

type ConditionType =
  | 'role_is'
  | 'role_in'
  | 'is_owner'
  | 'is_assignee'
  | 'scope_contains'
  | 'state_is'
  | 'state_not'
  | 'has_scopes'

interface Decision {
  allowed: boolean
  rule: string
  reason: string
}

export class PolicyEngine {
  private rules: PolicyRule[]

  constructor(rules: PolicyRule[]) {
    this.rules = [...rules].sort((a, b) => a.priority - b.priority)
  }

  evaluate(principal: Principal, resource: Resource, action: Action): Decision {
    for (const rule of this.rules) {
      if (this.matchesRule(rule, principal, resource, action)) {
        return {
          allowed: rule.effect === 'allow',
          rule: rule.id,
          reason: rule.description,
        }
      }
    }

    // Default deny
    return {
      allowed: false,
      rule: 'default-deny',
      reason: 'No matching rule found',
    }
  }

  filter<T>(
    principal: Principal,
    items: T[],
    adapter: (item: T) => Resource,
    action: Action = 'view'
  ): T[] {
    return items.filter(item => {
      const resource = adapter(item)
      const decision = this.evaluate(principal, resource, action)
      return decision.allowed
    })
  }

  private matchesRule(
    rule: PolicyRule,
    principal: Principal,
    resource: Resource,
    action: Action
  ): boolean {
    // Check resource type
    if (rule.resource !== '*' && rule.resource !== resource.type) {
      return false
    }

    // Check action
    const actions = Array.isArray(rule.action) ? rule.action : [rule.action]
    if (!actions.includes('*') && !actions.includes(action)) {
      return false
    }

    // Check all conditions
    return rule.conditions.every(cond => {
      const result = this.evaluateCondition(cond, principal, resource)
      return cond.negate ? !result : result
    })
  }

  private evaluateCondition(
    condition: Condition,
    principal: Principal,
    resource: Resource
  ): boolean {
    const { type, params } = condition

    switch (type) {
      case 'role_is':
        return principal.role === params?.role

      case 'role_in':
        return (params?.roles as string[])?.includes(principal.role)

      case 'is_owner':
        return resource.owner === principal.id ||
               resource.owner === principal.attributes.externalId?.toString() ||
               resource.owner === principal.attributes.email

      case 'is_assignee':
        return resource.assignee === principal.attributes.externalId?.toString()

      case 'scope_contains':
        return principal.scopes.some(s =>
          scopeRegistry.contains(s, resource.scope)
        )

      case 'state_is':
        return resource.state === params?.state

      case 'state_not':
        return resource.state !== params?.state

      case 'has_scopes':
        return principal.scopes.length > 0

      default:
        console.warn(`[PolicyEngine] Unknown condition type: ${type}`)
        return false
    }
  }
}
```

---

## 6. Policy Definitions

### 6.1 Ticket Policies

```yaml
# config/policies/ticket.yaml

policies:
  # ========== ADMIN RULES (Highest Priority) ==========
  - id: admin-full-access
    description: Admin has full access to all tickets
    resource: ticket
    action: "*"
    effect: allow
    priority: 10
    conditions:
      - type: role_is
        params: { role: admin }

  # ========== DENY RULES (High Priority) ==========
  - id: deny-staff-unassigned
    description: Staff cannot access unassigned tickets
    resource: ticket
    action: [view, edit]
    effect: deny
    priority: 20
    conditions:
      - type: role_is
        params: { role: staff }
      - type: state_is
        params: { state: unassigned }

  - id: deny-staff-other-region
    description: Staff cannot access tickets outside their region (unless assigned)
    resource: ticket
    action: [view, edit]
    effect: deny
    priority: 21
    conditions:
      - type: role_is
        params: { role: staff }
      - type: is_assignee
        negate: true
      - type: scope_contains
        negate: true

  - id: deny-staff-delete
    description: Staff cannot delete tickets
    resource: ticket
    action: delete
    effect: deny
    priority: 22
    conditions:
      - type: role_is
        params: { role: staff }

  - id: deny-customer-others
    description: Customer cannot access other customers' tickets
    resource: ticket
    action: "*"
    effect: deny
    priority: 25
    conditions:
      - type: role_is
        params: { role: customer }
      - type: is_owner
        negate: true

  - id: deny-no-scopes
    description: Users without scopes cannot access any tickets
    resource: ticket
    action: "*"
    effect: deny
    priority: 30
    conditions:
      - type: has_scopes
        negate: true

  # ========== STAFF ALLOW RULES ==========
  - id: allow-staff-assigned
    description: Staff can access tickets assigned to them
    resource: ticket
    action: [view, edit, close]
    effect: allow
    priority: 40
    conditions:
      - type: role_is
        params: { role: staff }
      - type: is_assignee
      - type: state_not
        params: { state: unassigned }

  - id: allow-staff-region
    description: Staff can view tickets in their region
    resource: ticket
    action: view
    effect: allow
    priority: 41
    conditions:
      - type: role_is
        params: { role: staff }
      - type: scope_contains
      - type: state_not
        params: { state: unassigned }

  - id: allow-staff-assign-region
    description: Staff can assign tickets in their region
    resource: ticket
    action: assign
    effect: allow
    priority: 42
    conditions:
      - type: role_is
        params: { role: staff }
      - type: scope_contains
      - type: state_not
        params: { state: unassigned }

  # ========== CUSTOMER ALLOW RULES ==========
  - id: allow-customer-own
    description: Customer can view and interact with their own tickets
    resource: ticket
    action: [view, edit, close, reopen]
    effect: allow
    priority: 50
    conditions:
      - type: role_is
        params: { role: customer }
      - type: is_owner
```

### 6.2 Conversation Policies

```yaml
# config/policies/conversation.yaml

policies:
  - id: admin-conversation-access
    description: Admin has full access to all conversations
    resource: conversation
    action: "*"
    effect: allow
    priority: 10
    conditions:
      - type: role_is
        params: { role: admin }

  - id: customer-own-conversation
    description: Customer can only access their own conversations
    resource: conversation
    action: [view, edit]
    effect: allow
    priority: 20
    conditions:
      - type: role_is
        params: { role: customer }
      - type: is_owner

  - id: staff-region-conversation
    description: Staff can access conversations in their region
    resource: conversation
    action: [view, edit]
    effect: allow
    priority: 30
    conditions:
      - type: role_is
        params: { role: staff }
      - type: scope_contains
```

---

## 7. Zammad API Integration

### 7.1 Currently Used Endpoints

| Endpoint | Method | Usage |
|----------|--------|-------|
| `/api/v1/tickets` | GET | List tickets with pagination |
| `/api/v1/tickets/{id}` | GET | Get single ticket |
| `/api/v1/tickets` | POST | Create ticket |
| `/api/v1/tickets/{id}` | PUT | Update ticket |
| `/api/v1/tickets/{id}` | DELETE | Delete ticket |
| `/api/v1/tickets/search` | GET | Search tickets |
| `/api/v1/ticket_articles` | POST | Create article |
| `/api/v1/ticket_articles/by_ticket/{id}` | GET | Get articles |
| `/api/v1/users` | GET/POST | User management |
| `/api/v1/users/{id}` | GET/PUT | User CRUD |
| `/api/v1/users/me` | GET | Current user |
| `/api/v1/users/search` | GET | Search users |
| `/api/v1/groups` | GET | List groups |
| `/api/v1/groups/{id}` | GET | Get group |
| `/api/v1/tags` | GET | Get tags |
| `/api/v1/tags/add` | POST | Add tag |
| `/api/v1/tags/remove` | DELETE | Remove tag |
| `/api/v1/slas` | GET | List SLAs |
| `/api/v1/triggers` | GET/POST/PUT/DELETE | Trigger management |
| `/api/v1/knowledge_bases/*` | GET | Knowledge base |

### 7.2 Missing/Recommended Endpoints

| Endpoint | Method | Purpose | Priority |
|----------|--------|---------|----------|
| `/api/v1/roles` | GET | List roles for permission sync | High |
| `/api/v1/ticket_states` | GET | Get available states | Medium |
| `/api/v1/ticket_priorities` | GET | Get available priorities | Medium |
| `/api/v1/organizations` | GET | List organizations | Medium |
| `/api/v1/overviews` | GET | Get ticket overviews | Low |
| `/api/v1/online_notifications` | GET | Real-time notifications | Low |
| `/api/v1/object_manager_attributes` | GET | Custom fields | Low |
| `/api/v1/tickets/{id}/history` | GET | Ticket audit log | Medium |
| `/api/v1/ticket_time_accounting` | GET | Time tracking | Low |

### 7.3 Key Zammad Concepts for Authorization

```typescript
// Zammad role IDs (from /api/v1/roles)
const ZAMMAD_ROLES = {
  ADMIN: 1,
  AGENT: 2,
  CUSTOMER: 3,
} as const

// Zammad state IDs (from /api/v1/ticket_states)
const ZAMMAD_STATES = {
  NEW: 1,
  OPEN: 2,
  PENDING_REMINDER: 3,
  CLOSED: 4,
  MERGED: 5,
  PENDING_CLOSE: 6,
  // REMOVED: 7 (inactive by default)
} as const

// Zammad priority IDs (from /api/v1/ticket_priorities)
const ZAMMAD_PRIORITIES = {
  LOW: 1,
  NORMAL: 2,
  HIGH: 3,
} as const

// Zammad system user (represents unassigned)
const ZAMMAD_SYSTEM_USER_ID = 1
```

---

## 8. Migration Strategy

### Phase 1: Foundation (Week 1-2)

1. Implement `ScopeRegistry` with all region definitions
2. Implement `PrincipalResolver`
3. Implement `ResourceAdapter` for tickets
4. Add comprehensive unit tests

### Phase 2: Policy Engine (Week 2-3)

1. Implement `PolicyEngine` core
2. Define YAML policy format and loader
3. Port existing permission rules to YAML
4. Add integration tests

### Phase 3: Middleware Integration (Week 3-4)

1. Implement `AuthorizationMiddleware`
2. Apply to ticket API routes first
3. Add audit logging
4. Verify behavior matches existing system

### Phase 4: Full Migration (Week 4-5)

1. Migrate all API routes
2. Remove old `permission.ts` and `region-auth.ts`
3. Update mock auth to use new system
4. Performance testing

### Phase 5: Cleanup (Week 5-6)

1. Remove deprecated code
2. Update documentation
3. Add monitoring dashboards
4. Team training

---

## 9. Testing Strategy

### 9.1 Unit Tests

```typescript
describe('PolicyEngine', () => {
  describe('Staff ticket access', () => {
    it('should deny unassigned tickets', () => {
      const principal = createStaffPrincipal('asia-pacific')
      const resource = createTicketResource({ state: 'unassigned', scope: 'asia-pacific' })

      const decision = policyEngine.evaluate(principal, resource, 'view')

      expect(decision.allowed).toBe(false)
      expect(decision.rule).toBe('deny-staff-unassigned')
    })

    it('should allow tickets in own region', () => {
      const principal = createStaffPrincipal('asia-pacific')
      const resource = createTicketResource({ state: 'assigned', scope: 'asia-pacific' })

      const decision = policyEngine.evaluate(principal, resource, 'view')

      expect(decision.allowed).toBe(true)
    })

    it('should deny tickets in other region (not assigned)', () => {
      const principal = createStaffPrincipal('asia-pacific')
      const resource = createTicketResource({ state: 'assigned', scope: 'europe-zone-1' })

      const decision = policyEngine.evaluate(principal, resource, 'view')

      expect(decision.allowed).toBe(false)
    })

    it('should allow assigned tickets regardless of region', () => {
      const principal = createStaffPrincipal('asia-pacific', { externalId: 100 })
      const resource = createTicketResource({
        state: 'assigned',
        scope: 'europe-zone-1',
        assignee: '100'
      })

      const decision = policyEngine.evaluate(principal, resource, 'view')

      expect(decision.allowed).toBe(true)
    })
  })

  describe('Edge cases', () => {
    it('should deny staff with empty scopes', () => {
      const principal: Principal = {
        id: 'staff-1',
        role: 'staff',
        scopes: [],
        attributes: { email: 'staff@test.com' }
      }
      const resource = createTicketResource({ state: 'assigned', scope: 'asia-pacific' })

      const decision = policyEngine.evaluate(principal, resource, 'view')

      expect(decision.allowed).toBe(false)
      expect(decision.rule).toBe('deny-no-scopes')
    })
  })
})
```

### 9.2 Integration Tests

```typescript
describe('Authorization Integration', () => {
  it('should filter tickets correctly for staff', async () => {
    const tickets = [
      { id: 1, group_id: 4, owner_id: 1 },    // unassigned, asia-pacific
      { id: 2, group_id: 4, owner_id: 100 },  // assigned, asia-pacific
      { id: 3, group_id: 2, owner_id: 100 },  // assigned, europe (staff's)
      { id: 4, group_id: 3, owner_id: 200 },  // assigned, middle-east
    ]

    const principal = createStaffPrincipal('asia-pacific', { externalId: 100 })
    const filtered = policyEngine.filter(
      principal,
      tickets,
      resourceAdapter.fromZammadTicket
    )

    expect(filtered.map(t => t.id)).toEqual([2, 3])
  })
})
```

---

## 10. Monitoring & Observability

### 10.1 Metrics

| Metric | Description |
|--------|-------------|
| `authz_decisions_total` | Total decisions by rule_id, effect |
| `authz_decision_latency_ms` | Policy evaluation time |
| `authz_denied_total` | Denied requests by rule_id |
| `authz_no_scopes_total` | Users with empty scopes |

### 10.2 Logging

```typescript
interface AuthzLogEntry {
  timestamp: string
  principal_id: string
  principal_role: string
  resource_type: string
  resource_id: string
  action: string
  decision: 'allow' | 'deny'
  rule_id: string
  reason: string
  latency_ms: number
}
```

---

## 11. Appendix

### A. Current vs New Architecture Comparison

| Aspect | Current | New |
|--------|---------|-----|
| Permission source | Multiple (JWT, Zammad, Mock) | Single (PolicyEngine) |
| Rule definition | Code (if-else) | YAML configuration |
| Boundary handling | Per-function | Centralized |
| Audit trail | Scattered logs | Structured decisions |
| Testing | Mock heavy | Pure function |
| Extensibility | Code changes | Config changes |

### B. File Structure

```
src/lib/authorization/
├── index.ts                 # Public API exports
├── types.ts                 # Type definitions
├── scope-registry.ts        # Scope/region management
├── principal-resolver.ts    # Session → Principal
├── resource-adapter.ts      # External → Resource
├── policy-engine.ts         # Rule evaluation
├── policy-loader.ts         # YAML → PolicyRule[]
├── middleware.ts            # Request interceptor
└── __tests__/
    ├── scope-registry.test.ts
    ├── policy-engine.test.ts
    └── integration.test.ts

config/policies/
├── ticket.yaml
├── conversation.yaml
├── user.yaml
└── faq.yaml
```

### C. References

- [Zammad REST API Documentation](https://docs.zammad.org/en/latest/api/intro.html)
- [PBAC (Policy-Based Access Control)](https://en.wikipedia.org/wiki/Attribute-based_access_control)
- [Open Policy Agent](https://www.openpolicyagent.org/) (inspiration)
