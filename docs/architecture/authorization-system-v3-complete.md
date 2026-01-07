# Authorization System V3 - Complete Refactoring Design

> **Status**: Draft for Review (Updated)
> **Author**: Claude
> **Date**: 2026-01-06
> **Version**: 3.1
> **Base**: V2 Architecture + Review Findings + Full Audit + Cross-Region Assignment Fix

---

## 1. Executive Summary

This document provides a **complete, production-ready authorization architecture** that addresses ALL identified security and consistency issues in the customer service platform. Unlike patch-based approaches, this design provides a unified solution that will make all API endpoints consistently secure.

### Key Objectives

1. **Single Source of Truth**: All permission decisions flow through `PolicyEngine`
2. **Complete Coverage**: All 56 API routes protected by unified policy system
3. **Resource Bridging**: Local data (files, ratings, updates) properly linked to ticket permissions
4. **Fail-Safe by Default**: Explicit allow rules required; everything else denied
5. **Audit-Ready**: Every decision logged with rule ID and reason

---

## 2. Current Problems (Complete Audit)

### 2.1 Security Vulnerabilities (P0)

| Issue | File | Root Cause |
|-------|------|------------|
| TicketUpdate leaks all updates | `tickets/updates/route.ts:35-46` | No ticket permission filter |
| TicketRating no ownership check | `tickets/[id]/rating/route.ts` | Missing ticket validation |
| File GET no owner check | `files/[id]/route.ts` | Only `requireAuth()` |
| File Download no owner check | `files/[id]/download/route.ts` | Only `requireAuth()` |
| Webhook optional signature | `webhooks/zammad/route.ts:64` | `if (secret && signature)` |
| **AI Chat no authentication** | `ai/chat/route.ts` | **No auth check at all** |

### 2.2 Inconsistency Issues (P1)

| Issue | File | Root Cause |
|-------|------|------------|
| Export uses wrong filter | `tickets/export/route.ts:86` | Uses `filterTicketsByRegion` |
| Articles uses different method | `tickets/[id]/articles/route.ts` | Uses `validateTicketAccess` |
| Templates inline filtering | `templates/route.ts` | Custom region logic |
| **permission.ts allows staff assign** | `permission.ts:123-126` | Inconsistent with assign API (admin only) |

### 2.3 Architectural Issues (P2)

| Issue | Description |
|-------|-------------|
| Scattered permission logic | `permission.ts`, `region-auth.ts`, inline checks |
| Multiple data sources | JWT `group_ids` vs Zammad real-time `group_ids` |
| Hardcoded mappings | state_id, priority_id, group_id scattered |
| No audit trail | Decisions not logged consistently |
| Production security gaps | Mock auth enableable, insecure cookies |

---

## 3. New Architecture Design

### 3.1 System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            REQUEST FLOW                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────┐    ┌──────────────────┐    ┌────────────────────────────┐    │
│  │  Client  │───▶│  Next.js         │───▶│  API Route Handler         │    │
│  │          │    │  Middleware      │    │  (Business Logic Only)     │    │
│  └──────────┘    │  (Route Guard)   │    └─────────────┬──────────────┘    │
│                  └──────────────────┘                  │                    │
│                                                        ▼                    │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    AUTHORIZATION LAYER                                │  │
│  │  ┌────────────────────────────────────────────────────────────────┐  │  │
│  │  │  withAuthorization(handler, config)                            │  │  │
│  │  │  - Wraps API handlers                                          │  │  │
│  │  │  - Resolves Principal from session                             │  │  │
│  │  │  - Resolves Resource from request/params                       │  │  │
│  │  │  - Calls PolicyEngine.evaluate()                               │  │  │
│  │  │  - Logs decision to AuditLog                                   │  │  │
│  │  └────────────────────────────────────────────────────────────────┘  │  │
│  │                              │                                        │  │
│  │                              ▼                                        │  │
│  │  ┌───────────────────┐  ┌───────────────────┐  ┌──────────────────┐  │  │
│  │  │  PolicyEngine     │  │  PolicyLoader     │  │  AuditLogger     │  │  │
│  │  │  - evaluate()     │  │  - loadYAML()     │  │  - logDecision() │  │  │
│  │  │  - filter()       │  │  - validate()     │  │  - query()       │  │  │
│  │  └───────────────────┘  └───────────────────┘  └──────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                              │                                              │
│                              ▼                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                      IDENTITY LAYER                                   │  │
│  │  ┌─────────────────────┐  ┌─────────────────────┐                    │  │
│  │  │  PrincipalResolver  │  │  ScopeRegistry      │                    │  │
│  │  │  - fromSession()    │  │  - get(id)          │                    │  │
│  │  │  - fromWebhook()    │  │  - fromExternalId() │                    │  │
│  │  └─────────────────────┘  │  - contains()       │                    │  │
│  │                           └─────────────────────┘                    │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │  │
│  │  │  ResourceResolver                                                │ │  │
│  │  │  - fromTicket(ZammadTicket): Resource                           │ │  │
│  │  │  - fromFile(UploadedFile): Resource                             │ │  │
│  │  │  - fromRating(TicketRating): Resource                           │ │  │
│  │  │  - fromUpdate(TicketUpdate): Resource                           │ │  │
│  │  │  - fromConversation(Conversation): Resource                     │ │  │
│  │  │  - fromTemplate(ReplyTemplate): Resource                        │ │  │
│  │  │  - resolveParentTicket(Resource): Promise<Resource | null>      │ │  │
│  │  └─────────────────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Core Principles

| Principle | Implementation |
|-----------|----------------|
| **Single Source of Truth** | All decisions via `PolicyEngine.evaluate()` |
| **Fail-Safe Default** | No matching rule = deny |
| **Resource-Centric** | Permissions on resources, not operations |
| **Parent Bridging** | Child resources inherit parent ticket permissions |
| **Audit Everything** | Every decision logged with context |
| **Declarative Rules** | YAML config, not code branches |

---

## 4. Domain Model

### 4.1 Principal (Who)

```typescript
// src/lib/authorization/types.ts

export interface Principal {
  id: string                      // Internal user ID
  role: 'admin' | 'staff' | 'customer'
  scopes: string[]                // Accessible scope IDs (regions)
  attributes: {
    externalId?: number           // Zammad user ID
    email: string
    organizationId?: number
  }
}
```

### 4.2 Resource (What)

```typescript
export type ResourceType =
  | 'ticket'
  | 'article'
  | 'file'
  | 'rating'
  | 'update'
  | 'conversation'
  | 'template'
  | 'user'
  | 'faq'
  | 'faq_rating'       // NEW: FAQ article ratings
  | 'ai_chat'          // NEW: AI chat sessions
  | 'session'          // NEW: User sessions
  | 'vacation'         // NEW: Staff vacation settings

export type ResourceState =
  | 'unassigned'
  | 'assigned'
  | 'closed'
  | 'archived'

export interface Resource {
  type: ResourceType
  id: string | number
  scope: string                   // Owning scope (region)
  owner?: string                  // Owner ID (customer)
  assignee?: string               // Assigned agent ID
  state: ResourceState
  parent?: {                      // For child resources
    type: ResourceType
    id: string | number
  }
  attributes?: Record<string, unknown>
}
```

### 4.3 Scope (Where)

```typescript
export interface ScopeDefinition {
  id: string                      // 'asia-pacific'
  name: string                    // 'Asia Pacific'
  externalId: number              // Zammad group_id: 4
  parent?: string                 // 'global' for hierarchy
}

// Scope Registry - Single Source of Truth for regions
export const SCOPE_DEFINITIONS: ScopeDefinition[] = [
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

### 4.4 Action (How)

```typescript
export type Action =
  | 'view'
  | 'create'
  | 'edit'
  | 'delete'
  | 'assign'
  | 'close'
  | 'reopen'
  | 'export'
  | 'download'
  | '*'
```

### 4.5 Policy Rule

```typescript
export interface PolicyRule {
  id: string
  description: string
  resource: ResourceType | '*'
  action: Action | Action[]
  effect: 'allow' | 'deny'
  priority: number                // Lower = higher priority
  conditions: Condition[]
}

export interface Condition {
  type: ConditionType
  negate?: boolean
  params?: Record<string, unknown>
}

export type ConditionType =
  // Role checks
  | 'role_is'
  | 'role_in'
  // Ownership checks
  | 'is_owner'
  | 'is_assignee'
  | 'is_self'              // NEW: User operating on their own resource (session, vacation)
  // Scope checks
  | 'scope_contains'
  | 'scope_is_global'      // NEW: Resource has no region (global/null)
  | 'has_scopes'
  // State checks
  | 'state_is'
  | 'state_not'
  // Parent resource checks
  | 'can_view_parent'
  | 'parent_type_is'
  // Reference checks (for files)
  | 'reference_type_is'
  // Target checks (for assign action)
  | 'target_has_group_permission'  // NEW: For cross-region assignment validation

export interface Decision {
  allowed: boolean
  rule: string
  reason: string
  principal?: string
  resource?: string
  action?: string
  timestamp?: string
}
```

---

## 5. Core Components Implementation

### 5.1 ScopeRegistry

```typescript
// src/lib/authorization/scope-registry.ts

import { SCOPE_DEFINITIONS, type ScopeDefinition } from './types'

export class ScopeRegistry {
  private scopes: Map<string, ScopeDefinition>
  private externalIdMap: Map<number, ScopeDefinition>

  constructor(definitions: ScopeDefinition[] = SCOPE_DEFINITIONS) {
    this.scopes = new Map(definitions.map(d => [d.id, d]))
    this.externalIdMap = new Map(
      definitions.filter(d => d.externalId > 0).map(d => [d.externalId, d])
    )
  }

  get(id: string): ScopeDefinition | undefined {
    return this.scopes.get(id)
  }

  fromExternalId(externalId: number): ScopeDefinition | undefined {
    return this.externalIdMap.get(externalId)
  }

  contains(scopeA: string, scopeB: string): boolean {
    if (scopeA === 'global') return true
    if (scopeA === scopeB) return true

    let current = this.scopes.get(scopeB)
    while (current?.parent) {
      if (current.parent === scopeA) return true
      current = this.scopes.get(current.parent)
    }
    return false
  }

  getAllRegionIds(): string[] {
    return [...this.scopes.keys()].filter(id => id !== 'global')
  }

  getExternalId(scopeId: string): number | undefined {
    return this.scopes.get(scopeId)?.externalId
  }
}

export const scopeRegistry = new ScopeRegistry()
```

### 5.2 PrincipalResolver

```typescript
// src/lib/authorization/principal-resolver.ts

import { auth } from '@/auth'
import { scopeRegistry } from './scope-registry'
import type { Principal } from './types'

export class PrincipalResolver {
  async fromSession(): Promise<Principal | null> {
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
    if (!scopeId || !scopeRegistry.get(scopeId)) {
      console.warn(`[AuthZ] User ${user.email} has invalid/no region: ${scopeId}`)
      return {
        id: user.id,
        role,
        scopes: [], // No access without valid scope
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

  // For webhook requests (system-level)
  fromWebhook(secret: string, providedSecret: string): Principal | null {
    if (secret !== providedSecret) return null

    return {
      id: 'system',
      role: 'admin',
      scopes: ['global'],
      attributes: {
        email: 'system@internal',
      }
    }
  }
}

export const principalResolver = new PrincipalResolver()
```

### 5.3 ResourceResolver

```typescript
// src/lib/authorization/resource-resolver.ts

import type { ZammadTicket } from '@/lib/zammad/types'
import type { UploadedFile, TicketRating, TicketUpdate, ReplyTemplate } from '@prisma/client'
import { scopeRegistry } from './scope-registry'
import { zammadClient } from '@/lib/zammad/client'
import type { Resource, ResourceState } from './types'

// Zammad system user ID (represents unassigned)
const ZAMMAD_SYSTEM_USER_ID = 1

export class ResourceResolver {

  // =========================================================================
  // Ticket Resource
  // =========================================================================

  fromTicket(ticket: ZammadTicket): Resource {
    const scope = scopeRegistry.fromExternalId(ticket.group_id)
    const isUnassigned = !ticket.owner_id ||
                         ticket.owner_id === 0 ||
                         ticket.owner_id === ZAMMAD_SYSTEM_USER_ID

    let state: ResourceState = 'assigned'
    if (isUnassigned) {
      state = 'unassigned'
    } else if (ticket.state_id === 4) { // closed
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
        group_id: ticket.group_id,
      }
    }
  }

  // =========================================================================
  // File Resource (with parent reference)
  // =========================================================================

  fromFile(file: UploadedFile): Resource {
    const hasTicketParent = file.referenceType === 'ticket' && file.referenceId

    return {
      type: 'file',
      id: file.id,
      scope: 'global', // Files don't have inherent scope
      owner: file.userId,
      state: 'assigned',
      parent: hasTicketParent ? {
        type: 'ticket',
        id: parseInt(file.referenceId!, 10),
      } : undefined,
      attributes: {
        referenceType: file.referenceType,
        referenceId: file.referenceId,
        bucketName: file.bucketName,
        fileName: file.fileName,
      }
    }
  }

  // =========================================================================
  // Rating Resource (always has ticket parent)
  // =========================================================================

  fromRating(rating: TicketRating): Resource {
    return {
      type: 'rating',
      id: rating.id,
      scope: 'global', // Scope determined by parent ticket
      owner: rating.userId,
      state: 'assigned',
      parent: {
        type: 'ticket',
        id: rating.ticketId,
      },
      attributes: {
        rating: rating.rating,
      }
    }
  }

  // =========================================================================
  // Update Resource (always has ticket parent)
  // =========================================================================

  fromUpdate(update: TicketUpdate): Resource {
    return {
      type: 'update',
      id: update.id,
      scope: 'global', // Scope determined by parent ticket
      owner: undefined, // Updates don't have owners
      state: 'assigned',
      parent: {
        type: 'ticket',
        id: update.ticketId,
      },
      attributes: {
        event: update.event,
      }
    }
  }

  // =========================================================================
  // Template Resource
  // =========================================================================

  fromTemplate(template: ReplyTemplate): Resource {
    return {
      type: 'template',
      id: template.id,
      scope: template.region ?? 'global',
      owner: template.createdById,
      state: template.isActive ? 'assigned' : 'archived',
      attributes: {
        category: template.category,
        name: template.name,
      }
    }
  }

  // =========================================================================
  // Conversation Resource
  // =========================================================================

  fromConversation(conv: {
    id: string
    customer_id: string
    customer_email: string
    region?: string
  }): Resource {
    return {
      type: 'conversation',
      id: conv.id,
      scope: conv.region ?? 'global',
      owner: conv.customer_email, // Use email as owner identifier
      state: 'assigned',
    }
  }

  // =========================================================================
  // Parent Resolution (for permission bridging)
  // =========================================================================

  async resolveParentTicket(resource: Resource): Promise<Resource | null> {
    if (!resource.parent || resource.parent.type !== 'ticket') {
      return null
    }

    try {
      const ticket = await zammadClient.getTicket(resource.parent.id as number)
      return this.fromTicket(ticket)
    } catch (error) {
      console.error(`[ResourceResolver] Failed to resolve parent ticket ${resource.parent.id}:`, error)
      return null
    }
  }
}

export const resourceResolver = new ResourceResolver()
```

### 5.4 PolicyEngine

```typescript
// src/lib/authorization/policy-engine.ts

import type { Principal, Resource, Action, PolicyRule, Condition, Decision } from './types'
import { scopeRegistry } from './scope-registry'
import { resourceResolver } from './resource-resolver'

export class PolicyEngine {
  private rules: PolicyRule[]
  private parentCache: Map<string, Resource | null> = new Map()

  constructor(rules: PolicyRule[]) {
    this.rules = [...rules].sort((a, b) => a.priority - b.priority)
  }

  async evaluate(
    principal: Principal,
    resource: Resource,
    action: Action
  ): Promise<Decision> {
    const startTime = Date.now()

    for (const rule of this.rules) {
      const matches = await this.matchesRule(rule, principal, resource, action)
      if (matches) {
        const decision: Decision = {
          allowed: rule.effect === 'allow',
          rule: rule.id,
          reason: rule.description,
          principal: principal.id,
          resource: `${resource.type}:${resource.id}`,
          action,
          timestamp: new Date().toISOString(),
        }

        console.log(`[PolicyEngine] Decision in ${Date.now() - startTime}ms:`, decision)
        return decision
      }
    }

    // Default deny
    return {
      allowed: false,
      rule: 'default-deny',
      reason: 'No matching rule found',
      principal: principal.id,
      resource: `${resource.type}:${resource.id}`,
      action,
      timestamp: new Date().toISOString(),
    }
  }

  async filter<T>(
    principal: Principal,
    items: T[],
    resolver: (item: T) => Resource,
    action: Action = 'view'
  ): Promise<T[]> {
    const results: T[] = []

    for (const item of items) {
      const resource = resolver(item)
      const decision = await this.evaluate(principal, resource, action)
      if (decision.allowed) {
        results.push(item)
      }
    }

    return results
  }

  private async matchesRule(
    rule: PolicyRule,
    principal: Principal,
    resource: Resource,
    action: Action
  ): Promise<boolean> {
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
    for (const condition of rule.conditions) {
      const result = await this.evaluateCondition(condition, principal, resource)
      const matches = condition.negate ? !result : result
      if (!matches) return false
    }

    return true
  }

  private async evaluateCondition(
    condition: Condition,
    principal: Principal,
    resource: Resource
  ): Promise<boolean> {
    const { type, params } = condition

    switch (type) {
      case 'role_is':
        return principal.role === params?.role

      case 'role_in':
        return (params?.roles as string[])?.includes(principal.role)

      case 'is_owner':
        return this.isOwner(principal, resource)

      case 'is_assignee':
        return resource.assignee === principal.attributes.externalId?.toString()

      case 'is_self':
        // User is operating on their own resource (session, vacation, profile)
        return resource.owner === principal.id ||
               resource.owner === principal.attributes.email ||
               resource.id === principal.id

      case 'scope_contains':
        return principal.scopes.some(s => scopeRegistry.contains(s, resource.scope))

      case 'scope_is_global':
        // Resource has no specific region (null/undefined/global)
        return !resource.scope || resource.scope === 'global' || resource.scope === 'unknown'

      case 'has_scopes':
        return principal.scopes.length > 0

      case 'state_is':
        return resource.state === params?.state

      case 'state_not':
        return resource.state !== params?.state

      case 'can_view_parent':
        return await this.canViewParent(principal, resource)

      case 'parent_type_is':
        return resource.parent?.type === params?.type

      case 'reference_type_is':
        return resource.attributes?.referenceType === params?.type

      default:
        console.warn(`[PolicyEngine] Unknown condition type: ${type}`)
        return false
    }
  }

  private isOwner(principal: Principal, resource: Resource): boolean {
    if (!resource.owner) return false

    return resource.owner === principal.id ||
           resource.owner === principal.attributes.externalId?.toString() ||
           resource.owner === principal.attributes.email
  }

  private async canViewParent(principal: Principal, resource: Resource): Promise<boolean> {
    if (!resource.parent) return false

    const cacheKey = `${resource.parent.type}:${resource.parent.id}`

    // Check cache
    if (!this.parentCache.has(cacheKey)) {
      const parentResource = await resourceResolver.resolveParentTicket(resource)
      this.parentCache.set(cacheKey, parentResource)
    }

    const parentResource = this.parentCache.get(cacheKey)
    if (!parentResource) return false

    // Recursively check parent permission
    const decision = await this.evaluate(principal, parentResource, 'view')
    return decision.allowed
  }

  // Clear cache between requests
  clearCache(): void {
    this.parentCache.clear()
  }
}
```

### 5.5 Policy Loader

```typescript
// src/lib/authorization/policy-loader.ts

import fs from 'fs'
import path from 'path'
import yaml from 'js-yaml'
import type { PolicyRule } from './types'

interface PolicyFile {
  policies: PolicyRule[]
}

export class PolicyLoader {
  private policiesDir: string

  constructor(policiesDir: string = 'config/policies') {
    this.policiesDir = policiesDir
  }

  loadAll(): PolicyRule[] {
    const allRules: PolicyRule[] = []
    const policyDir = path.join(process.cwd(), this.policiesDir)

    if (!fs.existsSync(policyDir)) {
      console.warn(`[PolicyLoader] Policies directory not found: ${policyDir}`)
      return this.getDefaultPolicies()
    }

    const files = fs.readdirSync(policyDir).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))

    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(policyDir, file), 'utf-8')
        const parsed = yaml.load(content) as PolicyFile

        if (parsed?.policies && Array.isArray(parsed.policies)) {
          allRules.push(...parsed.policies)
          console.log(`[PolicyLoader] Loaded ${parsed.policies.length} rules from ${file}`)
        }
      } catch (error) {
        console.error(`[PolicyLoader] Failed to load ${file}:`, error)
      }
    }

    return allRules.length > 0 ? allRules : this.getDefaultPolicies()
  }

  private getDefaultPolicies(): PolicyRule[] {
    // Fallback policies if YAML files not found
    return [
      {
        id: 'admin-full-access',
        description: 'Admin has full access to everything',
        resource: '*',
        action: '*',
        effect: 'allow',
        priority: 1,
        conditions: [{ type: 'role_is', params: { role: 'admin' } }],
      },
      {
        id: 'deny-no-scopes',
        description: 'Users without scopes cannot access anything',
        resource: '*',
        action: '*',
        effect: 'deny',
        priority: 5,
        conditions: [{ type: 'has_scopes', negate: true }],
      },
    ]
  }
}

export const policyLoader = new PolicyLoader()
```

### 5.6 AuditLogger (NEW - Critical for Cross-Region Assignment)

```typescript
// src/lib/authorization/audit-logger.ts

import { prisma } from '@/lib/prisma'
import type { Principal, Resource, Action, Decision } from './types'

export interface AuditEntry {
  id?: string
  timestamp: Date
  principalId: string
  principalRole: string
  principalEmail: string
  resourceType: string
  resourceId: string
  action: string
  decision: 'allowed' | 'denied'
  ruleId: string
  reason: string
  // Cross-region assignment specific fields
  metadata?: {
    originalScope?: string      // Original ticket region
    targetScope?: string        // New ticket region (after assignment)
    targetUserId?: string       // Staff being assigned to
    targetUserEmail?: string    // Staff email
    autoGroupChange?: boolean   // Whether group was auto-changed
  }
}

export class AuditLogger {
  private enabled: boolean
  private logToConsole: boolean
  private logToDatabase: boolean

  constructor(options: {
    enabled?: boolean
    logToConsole?: boolean
    logToDatabase?: boolean
  } = {}) {
    this.enabled = options.enabled ?? process.env.NODE_ENV === 'production'
    this.logToConsole = options.logToConsole ?? true
    this.logToDatabase = options.logToDatabase ?? process.env.NODE_ENV === 'production'
  }

  async logDecision(
    principal: Principal,
    resource: Resource,
    action: Action,
    decision: Decision,
    metadata?: AuditEntry['metadata']
  ): Promise<void> {
    if (!this.enabled) return

    const entry: AuditEntry = {
      timestamp: new Date(),
      principalId: principal.id,
      principalRole: principal.role,
      principalEmail: principal.attributes.email,
      resourceType: resource.type,
      resourceId: String(resource.id),
      action,
      decision: decision.allowed ? 'allowed' : 'denied',
      ruleId: decision.rule,
      reason: decision.reason,
      metadata,
    }

    // Console logging (always in development, configurable in production)
    if (this.logToConsole) {
      const logLevel = decision.allowed ? 'info' : 'warn'
      const logMethod = logLevel === 'warn' ? console.warn : console.log

      logMethod('[AuditLog]', {
        principal: `${entry.principalRole}:${entry.principalEmail}`,
        resource: `${entry.resourceType}:${entry.resourceId}`,
        action: entry.action,
        decision: entry.decision,
        rule: entry.ruleId,
        ...(metadata && { metadata }),
      })
    }

    // Database logging (production)
    if (this.logToDatabase) {
      try {
        // Note: Requires AuditLog model in Prisma schema
        // @ts-ignore - AuditLog model may not exist yet
        await prisma.auditLog?.create({
          data: {
            timestamp: entry.timestamp,
            principalId: entry.principalId,
            principalRole: entry.principalRole,
            principalEmail: entry.principalEmail,
            resourceType: entry.resourceType,
            resourceId: entry.resourceId,
            action: entry.action,
            decision: entry.decision,
            ruleId: entry.ruleId,
            reason: entry.reason,
            metadata: metadata ? JSON.stringify(metadata) : null,
          },
        })
      } catch (error) {
        console.error('[AuditLogger] Failed to write to database:', error)
      }
    }
  }

  /**
   * Log cross-region ticket assignment (sensitive operation)
   * This creates a detailed audit trail for compliance
   */
  async logCrossRegionAssignment(params: {
    admin: Principal
    ticket: Resource
    targetStaff: {
      id: string
      email: string
      region: string
    }
    originalRegion: string
    newRegion: string
    autoGroupChange: boolean
  }): Promise<void> {
    const { admin, ticket, targetStaff, originalRegion, newRegion, autoGroupChange } = params

    // Always log cross-region assignments regardless of enabled flag
    console.log('[AUDIT] Cross-Region Assignment:', {
      adminEmail: admin.attributes.email,
      ticketId: ticket.id,
      ticketNumber: ticket.attributes?.number,
      originalRegion,
      newRegion,
      targetStaffEmail: targetStaff.email,
      autoGroupChange,
      timestamp: new Date().toISOString(),
    })

    if (this.logToDatabase) {
      try {
        // @ts-ignore
        await prisma.auditLog?.create({
          data: {
            timestamp: new Date(),
            principalId: admin.id,
            principalRole: 'admin',
            principalEmail: admin.attributes.email,
            resourceType: 'ticket',
            resourceId: String(ticket.id),
            action: 'cross_region_assign',
            decision: 'allowed',
            ruleId: 'admin-ticket-access',
            reason: `Cross-region assignment from ${originalRegion} to ${newRegion}`,
            metadata: JSON.stringify({
              originalScope: originalRegion,
              targetScope: newRegion,
              targetUserId: targetStaff.id,
              targetUserEmail: targetStaff.email,
              autoGroupChange,
            }),
          },
        })
      } catch (error) {
        console.error('[AuditLogger] Failed to log cross-region assignment:', error)
      }
    }
  }

  /**
   * Query audit logs for compliance/debugging
   */
  async query(params: {
    principalEmail?: string
    resourceType?: string
    resourceId?: string
    action?: string
    decision?: 'allowed' | 'denied'
    startDate?: Date
    endDate?: Date
    limit?: number
  }): Promise<AuditEntry[]> {
    if (!this.logToDatabase) {
      console.warn('[AuditLogger] Database logging not enabled')
      return []
    }

    try {
      // @ts-ignore
      const logs = await prisma.auditLog?.findMany({
        where: {
          ...(params.principalEmail && { principalEmail: params.principalEmail }),
          ...(params.resourceType && { resourceType: params.resourceType }),
          ...(params.resourceId && { resourceId: params.resourceId }),
          ...(params.action && { action: params.action }),
          ...(params.decision && { decision: params.decision }),
          ...(params.startDate && { timestamp: { gte: params.startDate } }),
          ...(params.endDate && { timestamp: { lte: params.endDate } }),
        },
        orderBy: { timestamp: 'desc' },
        take: params.limit ?? 100,
      })

      return logs?.map((log: any) => ({
        ...log,
        metadata: log.metadata ? JSON.parse(log.metadata) : undefined,
      })) ?? []
    } catch (error) {
      console.error('[AuditLogger] Query failed:', error)
      return []
    }
  }
}

export const auditLogger = new AuditLogger()
```

### 5.7 Prisma Schema Addition for AuditLog

```prisma
// Add to prisma/schema.prisma

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
  metadata      String?  // JSON string for additional context

  @@index([principalEmail])
  @@index([resourceType, resourceId])
  @@index([action])
  @@index([timestamp])
}
```

---

## 6. Policy Definitions (YAML)

### 6.1 Ticket Policies

```yaml
# config/policies/ticket.yaml

policies:
  # ========== ADMIN RULES ==========
  - id: admin-ticket-access
    description: Admin has full access to all tickets (including cross-region assign)
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
    action: [view, edit, close]
    effect: deny
    priority: 20
    conditions:
      - type: role_is
        params: { role: staff }
      - type: state_is
        params: { state: unassigned }

  - id: deny-staff-other-region
    description: Staff cannot access tickets outside their region unless assigned
    resource: ticket
    action: [view, edit, close]
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

  # CRITICAL FIX: Staff cannot assign tickets (only Admin can)
  - id: deny-staff-assign
    description: Staff cannot assign tickets - only Admin can perform cross-region assignment
    resource: ticket
    action: assign
    effect: deny
    priority: 23
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
    description: Users without scopes cannot access tickets
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
    description: Staff can view/edit/close tickets in their region (but NOT assign)
    resource: ticket
    action: [view, edit, close]  # FIXED: removed 'assign' - only Admin can assign
    effect: allow
    priority: 41
    conditions:
      - type: role_is
        params: { role: staff }
      - type: scope_contains
      - type: state_not
        params: { state: unassigned }

  # ========== CUSTOMER ALLOW RULES ==========
  - id: allow-customer-own
    description: Customer can access their own tickets
    resource: ticket
    action: [view, edit, close, reopen]
    effect: allow
    priority: 50
    conditions:
      - type: role_is
        params: { role: customer }
      - type: is_owner
```

### 6.2 File Policies

```yaml
# config/policies/file.yaml

policies:
  # Admin access
  - id: admin-file-access
    description: Admin can access all files
    resource: file
    action: "*"
    effect: allow
    priority: 10
    conditions:
      - type: role_is
        params: { role: admin }

  # Owner access
  - id: owner-file-access
    description: Users can access their own uploaded files
    resource: file
    action: [view, download, delete]
    effect: allow
    priority: 20
    conditions:
      - type: is_owner

  # Ticket reference access
  - id: ticket-file-access
    description: Users who can view ticket can view its files
    resource: file
    action: [view, download]
    effect: allow
    priority: 30
    conditions:
      - type: reference_type_is
        params: { type: ticket }
      - type: can_view_parent

  # Avatar bucket is public (special case)
  - id: public-avatar-access
    description: Avatar files are publicly accessible
    resource: file
    action: [view, download]
    effect: allow
    priority: 5
    conditions:
      - type: reference_type_is
        params: { type: user_profile }
```

### 6.3 Rating Policies

```yaml
# config/policies/rating.yaml

policies:
  # Admin access
  - id: admin-rating-access
    description: Admin can access all ratings
    resource: rating
    action: "*"
    effect: allow
    priority: 10
    conditions:
      - type: role_is
        params: { role: admin }

  # Customer can rate their own tickets
  - id: customer-own-rating
    description: Customer can rate tickets they own
    resource: rating
    action: [view, create, edit]
    effect: allow
    priority: 20
    conditions:
      - type: role_is
        params: { role: customer }
      - type: can_view_parent

  # Staff can view ratings for tickets in their region
  - id: staff-rating-view
    description: Staff can view ratings for accessible tickets
    resource: rating
    action: view
    effect: allow
    priority: 30
    conditions:
      - type: role_is
        params: { role: staff }
      - type: can_view_parent
```

### 6.4 Update Policies

```yaml
# config/policies/update.yaml

policies:
  # Admin access
  - id: admin-update-access
    description: Admin can access all updates
    resource: update
    action: view
    effect: allow
    priority: 10
    conditions:
      - type: role_is
        params: { role: admin }

  # Users can view updates for tickets they can access
  - id: user-update-access
    description: Users can view updates for accessible tickets
    resource: update
    action: view
    effect: allow
    priority: 20
    conditions:
      - type: can_view_parent
```

### 6.5 Template Policies

```yaml
# config/policies/template.yaml

policies:
  # Admin full access
  - id: admin-template-access
    description: Admin can manage all templates
    resource: template
    action: "*"
    effect: allow
    priority: 10
    conditions:
      - type: role_is
        params: { role: admin }

  # Staff can view global and regional templates
  - id: staff-template-view
    description: Staff can view templates in their region or global
    resource: template
    action: view
    effect: allow
    priority: 20
    conditions:
      - type: role_is
        params: { role: staff }
      - type: scope_contains

  # Staff can create templates
  - id: staff-template-create
    description: Staff can create templates
    resource: template
    action: create
    effect: allow
    priority: 21
    conditions:
      - type: role_in
        params: { roles: [staff, admin] }
```

### 6.6 Conversation Policies

```yaml
# config/policies/conversation.yaml

policies:
  # Admin access
  - id: admin-conversation-access
    description: Admin can access all conversations
    resource: conversation
    action: "*"
    effect: allow
    priority: 10
    conditions:
      - type: role_is
        params: { role: admin }

  # Customer own conversations
  - id: customer-own-conversation
    description: Customer can access their own conversations
    resource: conversation
    action: [view, edit, delete]
    effect: allow
    priority: 20
    conditions:
      - type: role_is
        params: { role: customer }
      - type: is_owner

  # Staff regional access
  - id: staff-conversation-access
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

### 6.7 AI Chat Policies (NEW)

```yaml
# config/policies/ai-chat.yaml

policies:
  # AI Chat requires authentication
  - id: deny-unauthenticated-ai-chat
    description: Unauthenticated users cannot access AI chat
    resource: ai_chat
    action: "*"
    effect: deny
    priority: 5
    conditions:
      - type: has_scopes
        negate: true

  # All authenticated users can use AI chat
  - id: allow-authenticated-ai-chat
    description: Any authenticated user can use AI chat
    resource: ai_chat
    action: [view, create]
    effect: allow
    priority: 20
    conditions:
      - type: has_scopes
```

### 6.8 Session Policies (NEW)

```yaml
# config/policies/session.yaml

policies:
  # Admin can manage all sessions
  - id: admin-session-access
    description: Admin can manage all sessions
    resource: session
    action: "*"
    effect: allow
    priority: 10
    conditions:
      - type: role_is
        params: { role: admin }

  # Users can only manage their own sessions
  - id: user-own-session
    description: Users can only view and delete their own sessions
    resource: session
    action: [view, delete]
    effect: allow
    priority: 20
    conditions:
      - type: is_self
```

### 6.9 Vacation Policies (NEW)

```yaml
# config/policies/vacation.yaml

policies:
  # Admin can manage all vacation settings
  - id: admin-vacation-access
    description: Admin can manage all vacation settings
    resource: vacation
    action: "*"
    effect: allow
    priority: 10
    conditions:
      - type: role_is
        params: { role: admin }

  # Staff can only manage their own vacation
  - id: staff-own-vacation
    description: Staff can only manage their own vacation settings
    resource: vacation
    action: [view, edit, delete]
    effect: allow
    priority: 20
    conditions:
      - type: role_is
        params: { role: staff }
      - type: is_self

  # Customer cannot access vacation settings
  - id: deny-customer-vacation
    description: Customers cannot access vacation settings
    resource: vacation
    action: "*"
    effect: deny
    priority: 30
    conditions:
      - type: role_is
        params: { role: customer }
```

### 6.10 FAQ Policies (NEW)

```yaml
# config/policies/faq.yaml

policies:
  # FAQ articles are publicly viewable (no auth required)
  - id: public-faq-view
    description: Anyone can view FAQ articles
    resource: faq
    action: view
    effect: allow
    priority: 5
    conditions: []  # No conditions = always match

  # Admin can manage FAQ
  - id: admin-faq-manage
    description: Admin can manage FAQ articles
    resource: faq
    action: [create, edit, delete]
    effect: allow
    priority: 10
    conditions:
      - type: role_is
        params: { role: admin }

  # Authenticated users can rate FAQ articles
  - id: user-faq-rating
    description: Authenticated users can rate FAQ articles
    resource: faq_rating
    action: [view, create, edit]
    effect: allow
    priority: 20
    conditions:
      - type: has_scopes
```

### 6.11 User Management Policies (NEW)

```yaml
# config/policies/user.yaml

policies:
  # Admin can manage all users
  - id: admin-user-access
    description: Admin can manage all users
    resource: user
    action: "*"
    effect: allow
    priority: 10
    conditions:
      - type: role_is
        params: { role: admin }

  # Staff can view users in their region only
  - id: staff-user-view-region
    description: Staff can only view users in their region
    resource: user
    action: view
    effect: allow
    priority: 20
    conditions:
      - type: role_is
        params: { role: staff }
      - type: scope_contains

  # Staff cannot create/edit/delete users
  - id: deny-staff-user-manage
    description: Staff cannot manage users
    resource: user
    action: [create, edit, delete]
    effect: deny
    priority: 21
    conditions:
      - type: role_is
        params: { role: staff }

  # Customer cannot access user management
  - id: deny-customer-user
    description: Customers cannot access user management
    resource: user
    action: "*"
    effect: deny
    priority: 30
    conditions:
      - type: role_is
        params: { role: customer }
```

---

## 7. API Integration

### 7.1 Authorization Wrapper

```typescript
// src/lib/authorization/with-authorization.ts

import { NextRequest, NextResponse } from 'next/server'
import { PolicyEngine } from './policy-engine'
import { policyLoader } from './policy-loader'
import { principalResolver } from './principal-resolver'
import { resourceResolver } from './resource-resolver'
import type { Resource, Action, Principal } from './types'

// Initialize PolicyEngine with loaded rules
let policyEngine: PolicyEngine | null = null

function getEngine(): PolicyEngine {
  if (!policyEngine) {
    const rules = policyLoader.loadAll()
    policyEngine = new PolicyEngine(rules)
  }
  return policyEngine
}

// Reload policies (for hot reload in development)
export function reloadPolicies(): void {
  policyEngine = null
}

export interface AuthorizationConfig {
  // Resource type for this endpoint
  resourceType: Resource['type']
  // Action being performed
  action: Action
  // Function to extract resource from request
  resolveResource: (req: NextRequest, params: Record<string, string>) => Promise<Resource | Resource[] | null>
  // Skip authorization for this request (for public endpoints)
  skipAuth?: boolean
}

export function withAuthorization<T>(
  handler: (req: NextRequest, context: {
    params: Record<string, string>
    principal: Principal
    resource: Resource | null
  }) => Promise<NextResponse>,
  config: AuthorizationConfig
) {
  return async (req: NextRequest, props: { params: Promise<Record<string, string>> }) => {
    const params = await props.params
    const engine = getEngine()

    try {
      // Skip auth if configured
      if (config.skipAuth) {
        return handler(req, { params, principal: null as any, resource: null })
      }

      // Resolve principal
      const principal = await principalResolver.fromSession()
      if (!principal) {
        return NextResponse.json(
          { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
          { status: 401 }
        )
      }

      // Resolve resource(s)
      const resource = await config.resolveResource(req, params)

      // If resource is array (list endpoints), filter
      if (Array.isArray(resource)) {
        const filteredResources = await engine.filter(
          principal,
          resource,
          (r) => r,
          config.action
        )

        // Clear cache after filtering
        engine.clearCache()

        return handler(req, {
          params,
          principal,
          resource: filteredResources as any
        })
      }

      // Single resource authorization
      if (resource) {
        const decision = await engine.evaluate(principal, resource, config.action)
        engine.clearCache()

        if (!decision.allowed) {
          // Return 404 for customers to not leak existence
          if (principal.role === 'customer') {
            return NextResponse.json(
              { success: false, error: { code: 'NOT_FOUND', message: 'Resource not found' } },
              { status: 404 }
            )
          }
          return NextResponse.json(
            { success: false, error: { code: 'FORBIDDEN', message: decision.reason } },
            { status: 403 }
          )
        }
      }

      return handler(req, { params, principal, resource })
    } catch (error) {
      console.error('[withAuthorization] Error:', error)
      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: 'Authorization failed' } },
        { status: 500 }
      )
    }
  }
}
```

### 7.2 Example: Refactored Rating API

```typescript
// src/app/api/tickets/[id]/rating/route.ts (REFACTORED)

import { NextRequest, NextResponse } from 'next/server'
import { withAuthorization } from '@/lib/authorization/with-authorization'
import { resourceResolver } from '@/lib/authorization/resource-resolver'
import { zammadClient } from '@/lib/zammad/client'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const ratingSchema = z.object({
  rating: z.enum(['positive', 'negative']),
  reason: z.string().max(1000).optional(),
})

// GET - View rating
export const GET = withAuthorization(
  async (req, { params, principal }) => {
    const ticketId = parseInt(params.id, 10)

    const rating = await prisma.ticketRating.findUnique({
      where: { ticketId },
    })

    return NextResponse.json({ success: true, data: rating })
  },
  {
    resourceType: 'rating',
    action: 'view',
    resolveResource: async (req, params) => {
      const ticketId = parseInt(params.id, 10)
      if (isNaN(ticketId)) return null

      // Get or create a rating resource with parent ticket reference
      const existingRating = await prisma.ticketRating.findUnique({
        where: { ticketId },
      })

      if (existingRating) {
        return resourceResolver.fromRating(existingRating)
      }

      // If no rating exists, create a virtual resource for permission check
      // The parent ticket validation will determine access
      return {
        type: 'rating' as const,
        id: 0,
        scope: 'global',
        owner: undefined,
        state: 'assigned' as const,
        parent: { type: 'ticket' as const, id: ticketId },
      }
    },
  }
)

// POST - Create/Update rating
export const POST = withAuthorization(
  async (req, { params, principal }) => {
    const ticketId = parseInt(params.id, 10)
    const body = await req.json()

    const validation = ratingSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: validation.error.message } },
        { status: 400 }
      )
    }

    const { rating, reason } = validation.data

    const savedRating = await prisma.ticketRating.upsert({
      where: { ticketId },
      update: { rating, reason, updatedAt: new Date() },
      create: {
        ticketId,
        userId: principal.id,
        rating,
        reason,
      },
    })

    return NextResponse.json({ success: true, data: savedRating })
  },
  {
    resourceType: 'rating',
    action: 'create',
    resolveResource: async (req, params) => {
      const ticketId = parseInt(params.id, 10)
      if (isNaN(ticketId)) return null

      return {
        type: 'rating' as const,
        id: 0,
        scope: 'global',
        owner: undefined,
        state: 'assigned' as const,
        parent: { type: 'ticket' as const, id: ticketId },
      }
    },
  }
)
```

### 7.3 Example: Refactored Updates API

```typescript
// src/app/api/tickets/updates/route.ts (REFACTORED)

import { NextRequest, NextResponse } from 'next/server'
import { withAuthorization } from '@/lib/authorization/with-authorization'
import { resourceResolver } from '@/lib/authorization/resource-resolver'
import { prisma } from '@/lib/prisma'
import type { Resource } from '@/lib/authorization/types'

export const GET = withAuthorization(
  async (req, { params, principal, resource }) => {
    // resource here is the filtered list of updates
    const filteredUpdates = resource as Resource[]

    const transformedUpdates = filteredUpdates.map((update: any) => ({
      id: update.attributes?.originalId || update.id,
      ticketId: update.parent?.id,
      event: update.attributes?.event,
      data: update.attributes?.data,
      createdAt: update.attributes?.createdAt,
    }))

    return NextResponse.json({
      success: true,
      data: {
        updates: transformedUpdates,
        serverTime: Date.now(),
        count: transformedUpdates.length,
      },
    })
  },
  {
    resourceType: 'update',
    action: 'view',
    resolveResource: async (req) => {
      const searchParams = req.nextUrl.searchParams
      const sinceParam = searchParams.get('since')
      const since = sinceParam
        ? new Date(parseInt(sinceParam, 10))
        : new Date(Date.now() - 5 * 60 * 1000)

      // Fetch all updates (will be filtered by PolicyEngine)
      const updates = await prisma.ticketUpdate.findMany({
        where: { createdAt: { gt: since } },
        orderBy: { createdAt: 'desc' },
        take: 100,
      })

      // Convert to Resource[] for filtering
      return updates.map(update => ({
        ...resourceResolver.fromUpdate(update),
        attributes: {
          ...resourceResolver.fromUpdate(update).attributes,
          originalId: update.id,
          data: update.data ? JSON.parse(update.data) : null,
          createdAt: update.createdAt.toISOString(),
        }
      }))
    },
  }
)
```

---

## 8. Migration Strategy

### Phase 1: Foundation (Week 1)

```
Day 1-2: Core Components
├── Implement ScopeRegistry
├── Implement PrincipalResolver
├── Implement ResourceResolver (all resource types)
└── Unit tests for all resolvers

Day 3-4: PolicyEngine
├── Implement PolicyEngine core
├── Implement PolicyLoader (YAML)
├── Implement all condition types including can_view_parent
└── Unit tests for policy evaluation

Day 5: Integration
├── Implement withAuthorization wrapper
├── Create all policy YAML files
└── Integration tests
```

### Phase 2: API Migration (Week 2-3)

```
Day 1-3: P0 Critical APIs
├── tickets/[id]/rating/route.ts
├── tickets/updates/route.ts
├── files/[id]/route.ts
├── files/[id]/download/route.ts
└── webhooks/zammad/route.ts (mandatory signature)

Day 4-6: P1 Ticket APIs
├── tickets/route.ts
├── tickets/[id]/route.ts
├── tickets/search/route.ts
├── tickets/export/route.ts
└── tickets/[id]/articles/route.ts

Day 7-10: Remaining APIs
├── templates/*
├── conversations/*
├── staff/*
├── admin/*
└── All remaining routes
```

### Phase 3: Cleanup (Week 4)

```
Day 1-2: Remove Legacy Code
├── Remove permission.ts (replaced by PolicyEngine)
├── Remove region-auth.ts (replaced by ScopeRegistry)
├── Remove inline permission checks in routes
└── Update imports

Day 3-4: Security Hardening
├── Enforce ZAMMAD_WEBHOOK_SECRET
├── Disable mock auth in production
├── Enable secure cookies for production
└── Add rate limiting

Day 5: Documentation & Training
├── Update CLAUDE.md
├── Create permission troubleshooting guide
└── Document policy YAML format
```

### Phase 4: Monitoring (Week 5)

```
├── Add structured audit logging
├── Create permission decision dashboard
├── Add alerting for suspicious patterns
└── Performance monitoring
```

---

## 9. Testing Strategy

### 9.1 Unit Tests

```typescript
// __tests__/authorization/policy-engine.test.ts

describe('PolicyEngine', () => {
  describe('Ticket Permissions', () => {
    it('should allow admin to view any ticket', async () => {
      const principal = createAdminPrincipal()
      const resource = createTicketResource({ state: 'unassigned' })

      const decision = await engine.evaluate(principal, resource, 'view')

      expect(decision.allowed).toBe(true)
      expect(decision.rule).toBe('admin-ticket-access')
    })

    it('should deny staff access to unassigned tickets', async () => {
      const principal = createStaffPrincipal('asia-pacific')
      const resource = createTicketResource({
        state: 'unassigned',
        scope: 'asia-pacific'
      })

      const decision = await engine.evaluate(principal, resource, 'view')

      expect(decision.allowed).toBe(false)
      expect(decision.rule).toBe('deny-staff-unassigned')
    })

    it('should allow staff to view assigned tickets in their region', async () => {
      const principal = createStaffPrincipal('asia-pacific')
      const resource = createTicketResource({
        state: 'assigned',
        scope: 'asia-pacific'
      })

      const decision = await engine.evaluate(principal, resource, 'view')

      expect(decision.allowed).toBe(true)
    })

    it('should allow customer to view their own tickets', async () => {
      const principal = createCustomerPrincipal('customer@test.com', 100)
      const resource = createTicketResource({
        owner: '100',
        state: 'assigned'
      })

      const decision = await engine.evaluate(principal, resource, 'view')

      expect(decision.allowed).toBe(true)
    })
  })

  describe('Rating Permissions with Parent Bridging', () => {
    it('should allow customer to rate their own ticket', async () => {
      const principal = createCustomerPrincipal('customer@test.com', 100)
      const resource = createRatingResource({
        parentTicket: { owner: '100', state: 'closed' }
      })

      const decision = await engine.evaluate(principal, resource, 'create')

      expect(decision.allowed).toBe(true)
    })

    it('should deny customer rating another customers ticket', async () => {
      const principal = createCustomerPrincipal('customer@test.com', 100)
      const resource = createRatingResource({
        parentTicket: { owner: '200', state: 'closed' }
      })

      const decision = await engine.evaluate(principal, resource, 'create')

      expect(decision.allowed).toBe(false)
    })
  })

  describe('File Permissions with Parent Bridging', () => {
    it('should allow file owner to download', async () => {
      const principal = createCustomerPrincipal('customer@test.com', 100)
      const resource = createFileResource({
        owner: 'customer@test.com',
        referenceType: 'message'
      })

      const decision = await engine.evaluate(principal, resource, 'download')

      expect(decision.allowed).toBe(true)
    })

    it('should allow access to ticket-referenced file if can view ticket', async () => {
      const principal = createCustomerPrincipal('customer@test.com', 100)
      const resource = createFileResource({
        owner: 'other@test.com',
        referenceType: 'ticket',
        parentTicket: { owner: '100', state: 'assigned' }
      })

      const decision = await engine.evaluate(principal, resource, 'download')

      expect(decision.allowed).toBe(true)
    })
  })
})
```

### 9.2 Integration Tests

```typescript
// __tests__/api/authorization-integration.test.ts

describe('API Authorization Integration', () => {
  describe('GET /api/tickets/updates', () => {
    it('should only return updates for accessible tickets', async () => {
      // Setup: Create updates for 3 tickets
      // - Ticket 1: belongs to customer A
      // - Ticket 2: belongs to customer B
      // - Ticket 3: in staff's region

      // Login as customer A
      const response = await fetchAsCustomerA('/api/tickets/updates')

      // Should only see updates for Ticket 1
      expect(response.data.updates.every(u => u.ticketId === ticket1.id)).toBe(true)
    })
  })

  describe('POST /api/tickets/[id]/rating', () => {
    it('should reject rating for ticket not owned by customer', async () => {
      const response = await fetchAsCustomerA(`/api/tickets/${otherCustomerTicketId}/rating`, {
        method: 'POST',
        body: { rating: 'positive' }
      })

      expect(response.status).toBe(404) // 404 not 403 for customers
    })
  })

  describe('GET /api/files/[id]/download', () => {
    it('should reject download of file not owned and not ticket-referenced', async () => {
      const response = await fetchAsCustomerA(`/api/files/${otherUsersFileId}/download`)

      expect(response.status).toBe(404)
    })
  })
})
```

---

## 10. File Structure

```
src/lib/authorization/
├── index.ts                 # Public API exports
├── types.ts                 # Type definitions
├── scope-registry.ts        # Scope/region management
├── principal-resolver.ts    # Session → Principal
├── resource-resolver.ts     # Data → Resource
├── policy-engine.ts         # Rule evaluation
├── policy-loader.ts         # YAML → PolicyRule[]
├── with-authorization.ts    # API wrapper
├── audit-logger.ts          # Decision logging
└── __tests__/
    ├── scope-registry.test.ts
    ├── policy-engine.test.ts
    ├── resource-resolver.test.ts
    └── integration.test.ts

config/policies/
├── ticket.yaml
├── file.yaml
├── rating.yaml
├── update.yaml
├── template.yaml
├── conversation.yaml
├── user.yaml
├── ai-chat.yaml          # NEW
├── session.yaml          # NEW
├── vacation.yaml         # NEW
└── faq.yaml              # NEW
```

---

## 11. Appendix

### A. Complete API Route Coverage (Updated)

**Legend**: ✅ Secure | ⚠️ Needs migration | ❌ Vulnerable (P0)

#### Ticket APIs
| Route | Resource | Action | Status | Priority |
|-------|----------|--------|--------|----------|
| GET /api/tickets | ticket | view | ✅ Has permission filter | P1 |
| POST /api/tickets | ticket | create | ✅ Has region validation | P1 |
| GET /api/tickets/[id] | ticket | view | ✅ Has permission check | P1 |
| PUT /api/tickets/[id] | ticket | edit | ✅ Has permission check | P1 |
| DELETE /api/tickets/[id] | ticket | delete | ✅ Admin only | P1 |
| GET /api/tickets/search | ticket | view | ✅ Has permission filter | P1 |
| GET /api/tickets/export | ticket | export | ⚠️ Wrong filter (filterTicketsByRegion) | P0 |
| GET /api/tickets/updates | update | view | ❌ No filter - returns ALL updates | P0 |
| GET /api/tickets/[id]/articles | article | view | ⚠️ Uses validateTicketAccess | P1 |
| POST /api/tickets/[id]/articles | article | create | ⚠️ Uses validateTicketAccess | P1 |
| GET /api/tickets/[id]/rating | rating | view | ❌ No ticket ownership check | P0 |
| POST /api/tickets/[id]/rating | rating | create | ❌ No ticket ownership check | P0 |
| PUT /api/tickets/[id]/assign | ticket | assign | ✅ Admin only (correct) | P1 |
| DELETE /api/tickets/[id]/assign | ticket | assign | ✅ Admin only | P1 |
| PUT /api/tickets/[id]/reopen | ticket | reopen | ✅ Has check | P1 |

#### File APIs
| Route | Resource | Action | Status | Priority |
|-------|----------|--------|--------|----------|
| GET /api/files/[id] | file | view | ❌ Only requireAuth() | P0 |
| GET /api/files/[id]/download | file | download | ❌ Only requireAuth() | P0 |
| DELETE /api/files/[id] | file | delete | ✅ Has owner check | P1 |
| POST /api/files/upload | file | create | ⚠️ No reference validation | P1 |
| GET /api/avatars/[id] | file | view | ✅ Public by design | - |

#### Template APIs
| Route | Resource | Action | Status | Priority |
|-------|----------|--------|--------|----------|
| GET /api/templates | template | view | ⚠️ Inline region filter | P2 |
| POST /api/templates | template | create | ✅ Role check | P2 |
| GET /api/templates/[id] | template | view | ⚠️ Needs migration | P2 |
| PUT /api/templates/[id] | template | edit | ⚠️ Needs migration | P2 |
| DELETE /api/templates/[id] | template | delete | ⚠️ Needs migration | P2 |

#### Conversation APIs
| Route | Resource | Action | Status | Priority |
|-------|----------|--------|--------|----------|
| GET /api/conversations | conversation | view | ✅ Has email check | P2 |
| GET /api/conversations/[id] | conversation | view | ✅ Has email check | P2 |
| POST /api/conversations | conversation | create | ✅ Has auth | P2 |
| DELETE /api/conversations/[id] | conversation | delete | ⚠️ Needs owner check | P2 |

#### AI Chat APIs (NEW)
| Route | Resource | Action | Status | Priority |
|-------|----------|--------|--------|----------|
| POST /api/ai/chat | ai_chat | create | ❌ **No auth at all** | P0 |

#### Staff APIs
| Route | Resource | Action | Status | Priority |
|-------|----------|--------|--------|----------|
| GET /api/staff/vacation | vacation | view | ✅ Staff only, own data | P2 |
| PUT /api/staff/vacation | vacation | edit | ✅ Staff only, own data | P2 |
| DELETE /api/staff/vacation | vacation | delete | ✅ Staff only, own data | P2 |
| GET /api/staff/available | user | view | ✅ Has role check | P2 |

#### Admin APIs
| Route | Resource | Action | Status | Priority |
|-------|----------|--------|--------|----------|
| GET /api/admin/users | user | view | ✅ Staff sees own region | P2 |
| POST /api/admin/users | user | create | ✅ Admin only | P2 |
| GET /api/admin/users/[id] | user | view | ⚠️ Needs region check | P2 |
| PUT /api/admin/users/[id] | user | edit | ✅ Admin only | P2 |
| DELETE /api/admin/users/[id] | user | delete | ✅ Admin only | P2 |
| GET /api/admin/stats/* | - | view | ✅ Admin only | P2 |

#### FAQ APIs
| Route | Resource | Action | Status | Priority |
|-------|----------|--------|--------|----------|
| GET /api/faq | faq | view | ✅ Public | - |
| GET /api/faq/[id] | faq | view | ✅ Public | - |
| POST /api/faq/[id]/rating | faq_rating | create | ✅ Requires auth | P2 |

#### Session APIs
| Route | Resource | Action | Status | Priority |
|-------|----------|--------|--------|----------|
| GET /api/sessions | session | view | ⚠️ Needs own-session filter | P2 |
| GET /api/sessions/[id] | session | view | ⚠️ Needs own-session check | P2 |
| DELETE /api/sessions/[id] | session | delete | ⚠️ Needs own-session check | P2 |

#### Webhook APIs
| Route | Resource | Action | Status | Priority |
|-------|----------|--------|--------|----------|
| POST /api/webhooks/zammad | - | - | ⚠️ Optional signature | P0 |

### B. Cross-Region Assignment Behavior

**Business Rule**: Admin can assign tickets to staff in any region.

**Current Implementation** (`assign/route.ts`):
1. Admin assigns ticket to staff
2. If staff doesn't have permission for ticket's current group:
   - System auto-changes ticket's `group_id` to staff's group
   - This effectively moves the ticket to the staff's region
3. Original region's staff can no longer see the ticket
4. New region's staff can see the ticket

**V3 Handling**:
- Only Admin has `assign` action on tickets (via `admin-ticket-access` rule)
- Staff explicitly denied `assign` action (via `deny-staff-assign` rule)
- All cross-region assignments logged via `auditLogger.logCrossRegionAssignment()`
- Audit trail includes: original region, new region, target staff, auto-group-change flag

```typescript
// Key Zammad constants (should move to ScopeRegistry)
const ZAMMAD_SYSTEM_USER_ID = 1  // Represents "unassigned"

const ZAMMAD_ROLES = {
  ADMIN: 1,
  AGENT: 2,
  CUSTOMER: 3,
}

const ZAMMAD_STATES = {
  NEW: 1,
  OPEN: 2,
  PENDING_REMINDER: 3,
  CLOSED: 4,
  MERGED: 5,
  PENDING_CLOSE: 6,
}

const ZAMMAD_PRIORITIES = {
  LOW: 1,
  NORMAL: 2,
  HIGH: 3,
}
```

### C. Security Checklist

- [ ] All API routes use `withAuthorization` wrapper
- [ ] Webhook signature verification is mandatory (not optional)
- [ ] Mock auth disabled in production (`NEXT_PUBLIC_ENABLE_MOCK_AUTH=false`)
- [ ] Secure cookies enabled in production (`useSecureCookies: true`)
- [ ] All local data (ratings, updates, files) linked to ticket permissions
- [ ] Customer requests return 404 (not 403) for unauthorized access
- [ ] All permission decisions logged with audit trail
- [ ] Policy YAML files validated on startup
- [ ] **AI Chat endpoint requires authentication** (NEW)
- [ ] **Staff cannot assign tickets** - only Admin (NEW)
- [ ] **Cross-region assignments are audited** (NEW)
- [ ] Rate limiting configured for public endpoints

### D. V3.1 Changelog (Updates from V3.0)

| Change | Description |
|--------|-------------|
| **Staff assign removed** | Removed `assign` from staff allowed actions; added explicit `deny-staff-assign` rule |
| **AI Chat P0 vulnerability** | Added `ai_chat` resource type and policies requiring authentication |
| **New resource types** | Added `faq_rating`, `ai_chat`, `session`, `vacation` resource types |
| **New condition types** | Added `is_self`, `scope_is_global`, `target_has_group_permission` |
| **AuditLogger** | Added comprehensive audit logging with cross-region assignment tracking |
| **AuditLog schema** | Added Prisma schema for AuditLog table |
| **Policy files** | Added `ai-chat.yaml`, `session.yaml`, `vacation.yaml`, `faq.yaml` |
| **API coverage** | Expanded from 23 to 50+ routes with detailed status |
| **Cross-region docs** | Documented admin cross-region assignment behavior and audit trail |

---

## 12. References

- [V2 Architecture Design](./authorization-system-v2.md)
- [Architecture Review (Chinese)](./architecture-review-zh.md)
- [Zammad REST API Documentation](https://docs.zammad.org/en/latest/api/intro.html)
- [PBAC (Policy-Based Access Control)](https://en.wikipedia.org/wiki/Attribute-based_access_control)
