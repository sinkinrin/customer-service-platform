# Customer-Staff Fixed Binding Implementation Plan (v3.1 — final)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace random regional load-balancing ticket assignment with a fixed customer-to-staff binding model, where each customer is permanently assigned to one dedicated technical support staff.

**Architecture:** Add a `CustomerStaffBinding` Prisma model to persist customer→staff relationships. Extract shared helpers (`checkIsOnVacation`, `getAgentDisplayName`, `isAgentEligible`) to eliminate DRY violations. Modify `autoAssignSingleTicket()` to accept an optional `customerId`, hoist the `getAgents()` call to the top so the binding-first and load-balancing paths share the same agent list, and auto-create the binding on first assignment using first-write-wins semantics. The batch auto-assign route keeps its "fetch once, iterate locally" architecture for performance, but inlines binding lookups and uses shared helpers — it does NOT delegate to `autoAssignSingleTicket` (avoids N+1 API calls and stale load data). Provide Admin API endpoints for manual binding management.

**Tech Stack:** Prisma (PostgreSQL), Next.js API routes, Vitest, existing Zammad client

**Review fixes applied (v3 over v2):**
- Batch route: keeps "fetch once, iterate" architecture; does NOT delegate to autoAssignSingleTicket (fixes N+1 and load-balancing regression)
- `findOrCreateBinding`: P2002 handler re-activates deactivated bindings instead of returning null
- `autoAssignSingleTicket`: hoists `getAgents()` before binding check so both paths share one call
- `isAgentEligible`: adds `agent.active` check for self-containment
- Admin API: distinguishes 401 Unauthorized vs 403 Forbidden
- Keeps `filterStats` summary logging for observability
- Batch test updated with correct mocks and assertions

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `prisma/schema.prisma` (append after line 267) | Add `CustomerStaffBinding` model |
| Create | `src/lib/ticket/agent-helpers.ts` | Shared helpers: `checkIsOnVacation`, `getAgentDisplayName`, `isAgentEligible` |
| Create | `__tests__/lib/ticket/agent-helpers.test.ts` | Unit tests for shared helpers |
| Create | `src/lib/ticket/customer-binding.ts` | Binding CRUD: findOrCreate, deactivate, transfer, list |
| Create | `__tests__/lib/ticket/customer-binding.test.ts` | Unit tests for binding CRUD |
| Modify | `src/lib/ticket/auto-assign.ts` | Add `customerId` param, binding-first with shared agent list, use helpers |
| Modify | `__tests__/lib/ticket/auto-assign.test.ts` | Tests for binding-aware assignment |
| Modify | `src/app/api/tickets/route.ts:512-516` | Pass `customerId` to `autoAssignSingleTicket` |
| Modify | `src/lib/ticket/email-ticket-routing.ts:141-147` | Pass `customerId` to `autoAssignSingleTicket` |
| Modify | `src/app/api/tickets/auto-assign/route.ts:100-212` | Add binding lookup inline; use shared helpers; keep fetch-once architecture |
| Modify | `__tests__/api/tickets-auto-assign.test.ts` | Update mocks for binding + fix assertions |
| Create | `src/app/api/admin/customer-bindings/route.ts` | GET (list) + POST (create/update) bindings |
| Create | `src/app/api/admin/customer-bindings/[id]/route.ts` | DELETE (deactivate) single binding |
| Create | `src/app/api/admin/customer-bindings/transfer/route.ts` | POST batch transfer customers between staff |
| Create | `__tests__/api/customer-bindings.test.ts` | API route tests for admin binding management |

---

## Task 1: Database Schema — Add CustomerStaffBinding Model

**Files:**
- Modify: `prisma/schema.prisma` (append after line 267, end of file)

- [ ] **Step 1: Add the Prisma model**

Add the following model to the end of `prisma/schema.prisma`:

```prisma
// Customer-Staff Fixed Binding (persistent assignment relationship)
// Each customer is bound to one dedicated staff member for ticket assignment.
// When a customer creates a ticket, the system assigns it to their bound staff first.
model CustomerStaffBinding {
  id               Int       @id @default(autoincrement())
  customerZammadId Int       @unique // Zammad customer user ID (one binding per customer)
  staffZammadId    Int       // Zammad staff user ID (dedicated support person)
  region           String    // Region at time of binding (for change detection)
  source           String    // 'auto' = first-ticket auto-bind, 'manual' = admin-set
  isActive         Boolean   @default(true)
  deactivatedAt    DateTime? // Audit: when binding was deactivated (null = active)
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  @@index([staffZammadId])
  @@index([isActive, staffZammadId])
  @@index([isActive, region])
  @@map("customer_staff_bindings")
}
```

- [ ] **Step 2: Generate and apply migration**

Run:
```bash
npx prisma migrate dev --name add-customer-staff-binding
```
Expected: Migration created successfully, Prisma Client regenerated.

- [ ] **Step 3: Verify Prisma Client types**

Run:
```bash
npx prisma generate
```
Expected: `prisma.customerStaffBinding` is available in TypeScript autocomplete.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add CustomerStaffBinding schema for fixed customer-staff assignment"
```

---

## Task 2: Shared Agent Helpers — Extract DRY utilities

**Files:**
- Create: `src/lib/ticket/agent-helpers.ts`
- Create: `__tests__/lib/ticket/agent-helpers.test.ts`

- [ ] **Step 1: Write failing tests for shared helpers**

Create `__tests__/lib/ticket/agent-helpers.test.ts`:

```typescript
/**
 * Shared agent helper unit tests
 */

import { describe, it, expect } from 'vitest'
import { checkIsOnVacation, getAgentDisplayName, isAgentEligible } from '@/lib/ticket/agent-helpers'

describe('checkIsOnVacation', () => {
  it('returns false when not on vacation', () => {
    expect(checkIsOnVacation({ out_of_office: false })).toBe(false)
  })

  it('returns true when within vacation range', () => {
    const now = new Date()
    expect(checkIsOnVacation({
      out_of_office: true,
      out_of_office_start_at: new Date(now.getTime() - 86400000).toISOString(),
      out_of_office_end_at: new Date(now.getTime() + 86400000).toISOString(),
    })).toBe(true)
  })

  it('returns false when vacation is in the future', () => {
    const now = new Date()
    expect(checkIsOnVacation({
      out_of_office: true,
      out_of_office_start_at: new Date(now.getTime() + 86400000).toISOString(),
      out_of_office_end_at: new Date(now.getTime() + 172800000).toISOString(),
    })).toBe(false)
  })

  it('returns true for open-ended vacation (start only)', () => {
    const now = new Date()
    expect(checkIsOnVacation({
      out_of_office: true,
      out_of_office_start_at: new Date(now.getTime() - 86400000).toISOString(),
    })).toBe(true)
  })

  it('returns true for end-only vacation when before end date', () => {
    const now = new Date()
    expect(checkIsOnVacation({
      out_of_office: true,
      out_of_office_end_at: new Date(now.getTime() + 86400000).toISOString(),
    })).toBe(true)
  })
})

describe('getAgentDisplayName', () => {
  it('returns full name when both first and last name exist', () => {
    expect(getAgentDisplayName({ firstname: 'John', lastname: 'Doe', login: 'jdoe', email: 'j@test.com' })).toBe('John Doe')
  })

  it('falls back to login when name is empty', () => {
    expect(getAgentDisplayName({ firstname: '', lastname: '', login: 'jdoe', email: 'j@test.com' })).toBe('jdoe')
  })

  it('falls back to email when login is also empty', () => {
    expect(getAgentDisplayName({ firstname: '', lastname: '', login: '', email: 'j@test.com' })).toBe('j@test.com')
  })
})

const EXCLUDED_EMAILS = ['support@howentech.com', 'howensupport@howentech.com']

describe('isAgentEligible', () => {
  const baseAgent = {
    id: 1, email: 'agent@test.com', active: true,
    role_ids: [2], group_ids: { '4': ['full'] }, out_of_office: false,
    firstname: 'A', lastname: 'B', login: 'ab',
  }

  it('returns true for eligible agent', () => {
    expect(isAgentEligible(baseAgent as any, 4, EXCLUDED_EMAILS)).toBe(true)
  })

  it('excludes inactive agents', () => {
    expect(isAgentEligible({ ...baseAgent, active: false } as any, 4, EXCLUDED_EMAILS)).toBe(false)
  })

  it('excludes system accounts', () => {
    expect(isAgentEligible({ ...baseAgent, email: 'support@howentech.com' } as any, 4, EXCLUDED_EMAILS)).toBe(false)
  })

  it('excludes admin role', () => {
    expect(isAgentEligible({ ...baseAgent, role_ids: [1, 2] } as any, 4, EXCLUDED_EMAILS)).toBe(false)
  })

  it('excludes agents without group access', () => {
    expect(isAgentEligible(baseAgent as any, 99, EXCLUDED_EMAILS)).toBe(false)
  })

  it('excludes agents on vacation', () => {
    const now = new Date()
    expect(isAgentEligible({
      ...baseAgent,
      out_of_office: true,
      out_of_office_start_at: new Date(now.getTime() - 86400000).toISOString(),
      out_of_office_end_at: new Date(now.getTime() + 86400000).toISOString(),
    } as any, 4, EXCLUDED_EMAILS)).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/lib/ticket/agent-helpers.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the shared helpers**

Create `src/lib/ticket/agent-helpers.ts`:

```typescript
/**
 * Shared Agent Helpers
 *
 * DRY utilities used by auto-assign, batch auto-assign, and binding-first logic.
 */

import type { ZammadUser } from '@/lib/zammad/types'

/** Check if an agent is currently on vacation */
export function checkIsOnVacation(agent: {
  out_of_office?: boolean
  out_of_office_start_at?: string | null
  out_of_office_end_at?: string | null
}): boolean {
  if (!agent.out_of_office) return false
  const now = new Date()
  const start = agent.out_of_office_start_at ? new Date(agent.out_of_office_start_at) : null
  const end = agent.out_of_office_end_at ? new Date(agent.out_of_office_end_at) : null
  if (start && end) return now >= start && now <= end
  if (start && !end) return now >= start
  if (!start && end) return now <= end
  return false
}

/** Get display name for an agent */
export function getAgentDisplayName(agent: {
  firstname?: string
  lastname?: string
  login?: string
  email?: string
}): string {
  const fullName = [agent.firstname, agent.lastname].filter(Boolean).join(' ')
  return fullName || agent.login || agent.email || 'Unknown'
}

/**
 * Check if an agent is eligible for ticket assignment.
 * Self-contained: checks active, not system account, not admin role, has group access, not on vacation.
 */
export function isAgentEligible(
  agent: ZammadUser,
  groupId: number,
  excludedEmails: string[]
): boolean {
  // Must be active
  if (!agent.active) return false
  // Exclude system accounts
  if (excludedEmails.some(e => agent.email?.toLowerCase() === e.toLowerCase())) return false
  // Exclude Admin role (role_id 1)
  if (agent.role_ids?.includes(1)) return false
  // Check group access
  const hasGroupAccess = Object.keys(agent.group_ids || {}).includes(String(groupId))
  if (!hasGroupAccess) return false
  // Check vacation
  if (checkIsOnVacation(agent)) return false
  return true
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/lib/ticket/agent-helpers.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ticket/agent-helpers.ts __tests__/lib/ticket/agent-helpers.test.ts
git commit -m "refactor: extract shared agent helpers (checkIsOnVacation, getAgentDisplayName, isAgentEligible)"
```

---

## Task 3: Binding CRUD Service

**Files:**
- Create: `src/lib/ticket/customer-binding.ts`
- Create: `__tests__/lib/ticket/customer-binding.test.ts`

- [ ] **Step 1: Write failing tests for binding CRUD**

Create `__tests__/lib/ticket/customer-binding.test.ts`:

```typescript
/**
 * Customer-Staff Binding CRUD unit tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  findActiveBinding,
  findOrCreateBinding,
  deactivateBinding,
  deactivateBindingsByStaff,
  deactivateBindingByCustomer,
  transferBindings,
  listBindings,
} from '@/lib/ticket/customer-binding'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    customerStaffBinding: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'

describe('customer-binding', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('findActiveBinding', () => {
    it('returns binding when active binding exists for customer', async () => {
      const mockBinding = {
        id: 1, customerZammadId: 100, staffZammadId: 200,
        region: 'asia-pacific', source: 'auto', isActive: true,
      }
      vi.mocked(prisma.customerStaffBinding.findFirst).mockResolvedValue(mockBinding as any)

      const result = await findActiveBinding(100)

      expect(result).toEqual(mockBinding)
      expect(prisma.customerStaffBinding.findFirst).toHaveBeenCalledWith({
        where: { customerZammadId: 100, isActive: true },
      })
    })

    it('returns null when no active binding exists', async () => {
      vi.mocked(prisma.customerStaffBinding.findFirst).mockResolvedValue(null)
      const result = await findActiveBinding(999)
      expect(result).toBeNull()
    })
  })

  describe('findOrCreateBinding (first-write-wins)', () => {
    it('creates a new binding when none exists', async () => {
      const mockBinding = {
        id: 1, customerZammadId: 100, staffZammadId: 200,
        region: 'asia-pacific', source: 'auto', isActive: true,
      }
      vi.mocked(prisma.customerStaffBinding.create).mockResolvedValue(mockBinding as any)

      const result = await findOrCreateBinding(100, 200, 'asia-pacific', 'auto')

      expect(result).toEqual(mockBinding)
    })

    it('returns existing active binding on unique constraint violation', async () => {
      const uniqueError = new Error('Unique constraint failed')
      ;(uniqueError as any).code = 'P2002'
      vi.mocked(prisma.customerStaffBinding.create).mockRejectedValue(uniqueError)

      const existingBinding = {
        id: 1, customerZammadId: 100, staffZammadId: 201,
        region: 'asia-pacific', source: 'auto', isActive: true,
      }
      vi.mocked(prisma.customerStaffBinding.findUnique).mockResolvedValue(existingBinding as any)

      const result = await findOrCreateBinding(100, 200, 'asia-pacific', 'auto')

      expect(result).toEqual(existingBinding)
    })

    it('re-activates deactivated binding on unique constraint violation', async () => {
      const uniqueError = new Error('Unique constraint failed')
      ;(uniqueError as any).code = 'P2002'
      vi.mocked(prisma.customerStaffBinding.create).mockRejectedValue(uniqueError)

      const deactivatedBinding = {
        id: 1, customerZammadId: 100, staffZammadId: 201,
        region: 'asia-pacific', source: 'auto', isActive: false,
        deactivatedAt: new Date(),
      }
      vi.mocked(prisma.customerStaffBinding.findUnique).mockResolvedValue(deactivatedBinding as any)

      const reactivated = { ...deactivatedBinding, staffZammadId: 200, isActive: true, deactivatedAt: null }
      vi.mocked(prisma.customerStaffBinding.update).mockResolvedValue(reactivated as any)

      const result = await findOrCreateBinding(100, 200, 'asia-pacific', 'auto')

      expect(result).toEqual(reactivated)
      expect(prisma.customerStaffBinding.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          staffZammadId: 200, region: 'asia-pacific', source: 'auto',
          isActive: true, deactivatedAt: null,
        },
      })
    })
  })

  describe('deactivateBinding', () => {
    it('deactivates a single binding by ID', async () => {
      vi.mocked(prisma.customerStaffBinding.update).mockResolvedValue({} as any)
      await deactivateBinding(1)
      expect(prisma.customerStaffBinding.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { isActive: false, deactivatedAt: expect.any(Date) },
      })
    })
  })

  describe('deactivateBindingsByStaff', () => {
    it('deactivates all bindings for a staff member', async () => {
      vi.mocked(prisma.customerStaffBinding.updateMany).mockResolvedValue({ count: 3 })
      const count = await deactivateBindingsByStaff(200)
      expect(count).toBe(3)
    })
  })

  describe('deactivateBindingByCustomer', () => {
    it('deactivates binding for a customer', async () => {
      vi.mocked(prisma.customerStaffBinding.updateMany).mockResolvedValue({ count: 1 })
      const count = await deactivateBindingByCustomer(100)
      expect(count).toBe(1)
    })
  })

  describe('transferBindings', () => {
    it('transfers all active bindings from one staff to another', async () => {
      vi.mocked(prisma.customerStaffBinding.updateMany).mockResolvedValue({ count: 5 })
      const count = await transferBindings(200, 300)
      expect(count).toBe(5)
    })
  })

  describe('listBindings', () => {
    it('returns paginated results with filters', async () => {
      vi.mocked(prisma.customerStaffBinding.findMany).mockResolvedValue([{ id: 1 }] as any)
      vi.mocked(prisma.customerStaffBinding.count).mockResolvedValue(1)
      const result = await listBindings({ staffZammadId: 200, page: 1, pageSize: 10 })
      expect(result.bindings).toHaveLength(1)
      expect(result.total).toBe(1)
    })

    it('supports customerZammadId filter', async () => {
      vi.mocked(prisma.customerStaffBinding.findMany).mockResolvedValue([])
      vi.mocked(prisma.customerStaffBinding.count).mockResolvedValue(0)
      await listBindings({ customerZammadId: 100 })
      expect(prisma.customerStaffBinding.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ customerZammadId: 100, isActive: true }),
        })
      )
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/lib/ticket/customer-binding.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the binding service**

Create `src/lib/ticket/customer-binding.ts`:

```typescript
/**
 * Customer-Staff Binding Service
 *
 * CRUD operations for the persistent customer→staff assignment relationship.
 * Uses first-write-wins semantics to handle concurrent ticket creation.
 */

import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

/**
 * Find the active binding for a customer.
 * Returns null if the customer has no active binding.
 */
export async function findActiveBinding(customerZammadId: number) {
  return prisma.customerStaffBinding.findFirst({
    where: { customerZammadId, isActive: true },
  })
}

/**
 * Create a binding using first-write-wins semantics.
 *
 * - If no row exists: creates a new binding.
 * - If an active row exists (P2002): returns the existing binding (first writer wins).
 * - If a deactivated row exists (P2002): re-activates it with the new staff.
 *
 * This prevents race conditions where two concurrent first-tickets overwrite each other.
 */
export async function findOrCreateBinding(
  customerZammadId: number,
  staffZammadId: number,
  region: string,
  source: 'auto' | 'manual'
) {
  try {
    return await prisma.customerStaffBinding.create({
      data: {
        customerZammadId,
        staffZammadId,
        region,
        source,
        isActive: true,
      },
    })
  } catch (error: any) {
    // P2002 = Unique constraint violation on customerZammadId
    if (error?.code === 'P2002') {
      const existing = await prisma.customerStaffBinding.findUnique({
        where: { customerZammadId },
      })
      if (!existing) throw error // Should not happen, but be safe

      if (existing.isActive) {
        // Active binding already exists — first writer wins, return as-is
        return existing
      }

      // Deactivated binding exists — re-activate with new staff
      return prisma.customerStaffBinding.update({
        where: { id: existing.id },
        data: {
          staffZammadId,
          region,
          source,
          isActive: true,
          deactivatedAt: null,
        },
      })
    }
    throw error
  }
}

/**
 * Admin: explicitly set or update a binding (manual source).
 * Uses upsert because admin intends to override any existing binding.
 */
export async function setBinding(
  customerZammadId: number,
  staffZammadId: number,
  region: string
) {
  return prisma.customerStaffBinding.upsert({
    where: { customerZammadId },
    create: {
      customerZammadId,
      staffZammadId,
      region,
      source: 'manual',
      isActive: true,
    },
    update: {
      staffZammadId,
      region,
      source: 'manual',
      isActive: true,
      deactivatedAt: null,
    },
  })
}

/**
 * Deactivate a single binding by ID.
 */
export async function deactivateBinding(id: number) {
  return prisma.customerStaffBinding.update({
    where: { id },
    data: { isActive: false, deactivatedAt: new Date() },
  })
}

/**
 * Deactivate all bindings for a staff member (e.g., staff leaves / disabled).
 */
export async function deactivateBindingsByStaff(staffZammadId: number): Promise<number> {
  const result = await prisma.customerStaffBinding.updateMany({
    where: { staffZammadId, isActive: true },
    data: { isActive: false, deactivatedAt: new Date() },
  })
  return result.count
}

/**
 * Deactivate a binding by customer Zammad ID (e.g., stale binding detected).
 */
export async function deactivateBindingByCustomer(customerZammadId: number): Promise<number> {
  const result = await prisma.customerStaffBinding.updateMany({
    where: { customerZammadId, isActive: true },
    data: { isActive: false, deactivatedAt: new Date() },
  })
  return result.count
}

/**
 * Batch-transfer all active bindings from one staff to another.
 */
export async function transferBindings(
  fromStaffZammadId: number,
  toStaffZammadId: number
): Promise<number> {
  const result = await prisma.customerStaffBinding.updateMany({
    where: { staffZammadId: fromStaffZammadId, isActive: true },
    data: { staffZammadId: toStaffZammadId, source: 'manual' },
  })
  return result.count
}

/**
 * List all active bindings, optionally filtered.
 */
export async function listBindings(filters?: {
  staffZammadId?: number
  customerZammadId?: number
  region?: string
  page?: number
  pageSize?: number
}) {
  const where: Prisma.CustomerStaffBindingWhereInput = { isActive: true }
  if (filters?.staffZammadId) where.staffZammadId = filters.staffZammadId
  if (filters?.customerZammadId) where.customerZammadId = filters.customerZammadId
  if (filters?.region) where.region = filters.region

  const page = filters?.page ?? 1
  const pageSize = filters?.pageSize ?? 50

  const [bindings, total] = await Promise.all([
    prisma.customerStaffBinding.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.customerStaffBinding.count({ where }),
  ])

  return { bindings, total, page, pageSize }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/lib/ticket/customer-binding.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ticket/customer-binding.ts __tests__/lib/ticket/customer-binding.test.ts
git commit -m "feat: add customer-staff binding CRUD service with first-write-wins and re-activation"
```

---

## Task 4: Modify Core Auto-Assign — Binding-First Logic

**Files:**
- Modify: `src/lib/ticket/auto-assign.ts`
- Modify: `__tests__/lib/ticket/auto-assign.test.ts`

- [ ] **Step 1: Add mocks for binding module to test file**

In `__tests__/lib/ticket/auto-assign.test.ts`, add after the existing `vi.mock('@/lib/zammad/client', ...)` block (after line 15):

```typescript
vi.mock('@/lib/ticket/customer-binding', () => ({
  findActiveBinding: vi.fn(),
  findOrCreateBinding: vi.fn(),
  deactivateBindingByCustomer: vi.fn(),
}))
```

And add import after line 17:

```typescript
import { findActiveBinding, findOrCreateBinding, deactivateBindingByCustomer } from '@/lib/ticket/customer-binding'
```

- [ ] **Step 2: Add failing tests for binding-aware assignment**

Add the following tests inside the existing `describe('autoAssignSingleTicket')` block, before its closing `})`:

```typescript
  describe('binding-aware assignment', () => {
    it('assigns to bound staff when binding exists and staff is available', async () => {
      vi.mocked(findActiveBinding).mockResolvedValue({
        id: 1, customerZammadId: 50, staffZammadId: 100,
        region: 'asia-pacific', source: 'auto', isActive: true,
        createdAt: new Date(), updatedAt: new Date(), deactivatedAt: null,
      })
      // getAgents is hoisted — called once, shared by binding-first and LB paths
      vi.mocked(zammadClient.getAgents).mockResolvedValue([
        {
          id: 100, email: 'bound-agent@test.com', firstname: 'Bound', lastname: 'Agent',
          active: true, role_ids: [2], group_ids: { [asiaGroupId]: ['full'] }, out_of_office: false,
        },
      ] as any)
      vi.mocked(zammadClient.updateTicket).mockResolvedValue({} as any)

      const result = await autoAssignSingleTicket(1, '10001', 'Test', asiaGroupId, undefined, 50)

      expect(result.success).toBe(true)
      expect(result.assignedTo?.id).toBe(100)
      expect(findOrCreateBinding).not.toHaveBeenCalled()
      // getAgents called only ONCE (hoisted)
      expect(zammadClient.getAgents).toHaveBeenCalledTimes(1)
    })

    it('falls back to load-balancing when bound staff is on vacation', async () => {
      const now = new Date()
      vi.mocked(findActiveBinding).mockResolvedValue({
        id: 1, customerZammadId: 50, staffZammadId: 100,
        region: 'asia-pacific', source: 'auto', isActive: true,
        createdAt: new Date(), updatedAt: new Date(), deactivatedAt: null,
      })
      vi.mocked(zammadClient.searchTicketsRawQuery).mockResolvedValue({ tickets: [], total_count: 0 } as any)
      vi.mocked(zammadClient.getAgents).mockResolvedValue([
        {
          id: 100, email: 'bound@test.com', firstname: 'Bound', lastname: 'Agent',
          active: true, role_ids: [2], group_ids: { [asiaGroupId]: ['full'] },
          out_of_office: true,
          out_of_office_start_at: new Date(now.getTime() - 86400000).toISOString(),
          out_of_office_end_at: new Date(now.getTime() + 86400000).toISOString(),
          out_of_office_replacement_id: null,
        },
        {
          id: 101, email: 'fallback@test.com', firstname: 'Fallback', lastname: 'Agent',
          active: true, role_ids: [2], group_ids: { [asiaGroupId]: ['full'] }, out_of_office: false,
        },
      ] as any)
      vi.mocked(zammadClient.updateTicket).mockResolvedValue({} as any)

      const result = await autoAssignSingleTicket(1, '10001', 'Test', asiaGroupId, undefined, 50)

      expect(result.success).toBe(true)
      expect(result.assignedTo?.id).toBe(101)
      expect(findOrCreateBinding).not.toHaveBeenCalled()
      // getAgents called only ONCE even though we fell through to LB
      expect(zammadClient.getAgents).toHaveBeenCalledTimes(1)
    })

    it('tries vacation replacement before load-balancing', async () => {
      const now = new Date()
      vi.mocked(findActiveBinding).mockResolvedValue({
        id: 1, customerZammadId: 50, staffZammadId: 100,
        region: 'asia-pacific', source: 'auto', isActive: true,
        createdAt: new Date(), updatedAt: new Date(), deactivatedAt: null,
      })
      vi.mocked(zammadClient.getAgents).mockResolvedValue([
        {
          id: 100, email: 'bound@test.com', firstname: 'Bound', lastname: 'Agent',
          active: true, role_ids: [2], group_ids: { [asiaGroupId]: ['full'] },
          out_of_office: true,
          out_of_office_start_at: new Date(now.getTime() - 86400000).toISOString(),
          out_of_office_end_at: new Date(now.getTime() + 86400000).toISOString(),
          out_of_office_replacement_id: 102,
        },
        {
          id: 102, email: 'replacement@test.com', firstname: 'Replacement', lastname: 'Agent',
          active: true, role_ids: [2], group_ids: { [asiaGroupId]: ['full'] }, out_of_office: false,
        },
      ] as any)
      vi.mocked(zammadClient.updateTicket).mockResolvedValue({} as any)

      const result = await autoAssignSingleTicket(1, '10001', 'Test', asiaGroupId, undefined, 50)

      expect(result.success).toBe(true)
      expect(result.assignedTo?.id).toBe(102)
    })

    it('auto-creates binding on first assignment when no binding exists', async () => {
      vi.mocked(findActiveBinding).mockResolvedValue(null)
      vi.mocked(zammadClient.searchTicketsRawQuery).mockResolvedValue({ tickets: [], total_count: 0 } as any)
      vi.mocked(zammadClient.getAgents).mockResolvedValue([
        {
          id: 100, email: 'agent@test.com', firstname: 'Test', lastname: 'Agent',
          active: true, role_ids: [2], group_ids: { [asiaGroupId]: ['full'] }, out_of_office: false,
        },
      ] as any)
      vi.mocked(zammadClient.updateTicket).mockResolvedValue({} as any)
      vi.mocked(findOrCreateBinding).mockResolvedValue({} as any)

      const result = await autoAssignSingleTicket(1, '10001', 'Test', asiaGroupId, undefined, 50)

      expect(result.success).toBe(true)
      expect(findOrCreateBinding).toHaveBeenCalledWith(50, 100, 'asia-pacific', 'auto')
    })

    it('skips binding logic when customerId is not provided (backward compat)', async () => {
      vi.mocked(zammadClient.searchTicketsRawQuery).mockResolvedValue({ tickets: [], total_count: 0 } as any)
      vi.mocked(zammadClient.getAgents).mockResolvedValue([
        {
          id: 100, email: 'agent@test.com', firstname: 'Test', lastname: 'Agent',
          active: true, role_ids: [2], group_ids: { [asiaGroupId]: ['full'] }, out_of_office: false,
        },
      ] as any)
      vi.mocked(zammadClient.updateTicket).mockResolvedValue({} as any)

      const result = await autoAssignSingleTicket(1, '10001', 'Test', asiaGroupId)

      expect(result.success).toBe(true)
      expect(findActiveBinding).not.toHaveBeenCalled()
    })

    it('deactivates stale binding when bound staff is inactive', async () => {
      vi.mocked(findActiveBinding).mockResolvedValue({
        id: 1, customerZammadId: 50, staffZammadId: 100,
        region: 'asia-pacific', source: 'auto', isActive: true,
        createdAt: new Date(), updatedAt: new Date(), deactivatedAt: null,
      })
      vi.mocked(zammadClient.searchTicketsRawQuery).mockResolvedValue({ tickets: [], total_count: 0 } as any)
      vi.mocked(zammadClient.getAgents).mockResolvedValue([
        {
          id: 100, email: 'disabled@test.com', firstname: 'Disabled', lastname: 'Agent',
          active: false, role_ids: [2], group_ids: { [asiaGroupId]: ['full'] }, out_of_office: false,
        },
        {
          id: 101, email: 'fallback@test.com', firstname: 'Fallback', lastname: 'Agent',
          active: true, role_ids: [2], group_ids: { [asiaGroupId]: ['full'] }, out_of_office: false,
        },
      ] as any)
      vi.mocked(zammadClient.updateTicket).mockResolvedValue({} as any)
      vi.mocked(deactivateBindingByCustomer).mockResolvedValue(1)
      vi.mocked(findOrCreateBinding).mockResolvedValue({} as any)

      const result = await autoAssignSingleTicket(1, '10001', 'Test', asiaGroupId, undefined, 50)

      expect(result.success).toBe(true)
      expect(deactivateBindingByCustomer).toHaveBeenCalledWith(50)
      expect(findOrCreateBinding).toHaveBeenCalledWith(50, 101, 'asia-pacific', 'auto')
    })

    it('does not break assignment when binding lookup fails', async () => {
      vi.mocked(findActiveBinding).mockRejectedValue(new Error('DB connection failed'))
      vi.mocked(zammadClient.searchTicketsRawQuery).mockResolvedValue({ tickets: [], total_count: 0 } as any)
      vi.mocked(zammadClient.getAgents).mockResolvedValue([
        {
          id: 100, email: 'agent@test.com', firstname: 'Test', lastname: 'Agent',
          active: true, role_ids: [2], group_ids: { [asiaGroupId]: ['full'] }, out_of_office: false,
        },
      ] as any)
      vi.mocked(zammadClient.updateTicket).mockResolvedValue({} as any)

      const result = await autoAssignSingleTicket(1, '10001', 'Test', asiaGroupId, undefined, 50)

      expect(result.success).toBe(true)
    })
  })
```

- [ ] **Step 3: Run tests to verify the new ones fail**

Run: `npx vitest run __tests__/lib/ticket/auto-assign.test.ts`
Expected: New binding tests FAIL. Old tests still PASS.

- [ ] **Step 4: Implement binding-first logic in autoAssignSingleTicket**

Rewrite `src/lib/ticket/auto-assign.ts` in its entirety:

```typescript
/**
 * Auto-assign single ticket to available agent
 *
 * Supports customer-staff binding: if a customer has a dedicated staff member,
 * the ticket is assigned to them first. Falls back to load-balancing if unavailable.
 */

import { zammadClient } from '@/lib/zammad/client'
import { GROUP_REGION_MAPPING } from '@/lib/constants/regions'
import { getActiveStateIds } from '@/lib/constants/zammad-states'
import { createApiLogger } from '@/lib/utils/api-logger'
import {
  notifyTicketAssigned,
  notifySystemAlert,
  resolveLocalUserIdsForZammadUserId,
} from '@/lib/notification'
import { checkIsOnVacation, getAgentDisplayName, isAgentEligible } from '@/lib/ticket/agent-helpers'
import { findActiveBinding, findOrCreateBinding, deactivateBindingByCustomer } from '@/lib/ticket/customer-binding'

// Excluded system accounts that shouldn't receive ticket assignments
export const EXCLUDED_EMAILS = ['support@howentech.com', 'howensupport@howentech.com']

// Single ticket auto-assign result
export interface SingleAssignResult {
  success: boolean
  assignedTo?: {
    id: number
    name: string
    email: string
  }
  error?: string
}

/**
 * Auto-assign a single ticket to the available agent with lowest load in the ticket's region.
 * If customerId is provided, checks for a dedicated staff binding first.
 */
export async function autoAssignSingleTicket(
  ticketId: number,
  ticketNumber: string,
  ticketTitle: string,
  groupId: number,
  requestId?: string,
  customerId?: number
): Promise<SingleAssignResult> {
  const log = createApiLogger('AutoAssign', requestId)

  try {
    log.info('Starting auto-assign', { ticketNumber, ticketId, groupId, title: ticketTitle })

    // 1. Get all active agents (hoisted — shared by binding-first and LB paths)
    const agentsRaw = await zammadClient.getAgents(true)
    const allAgents = Array.isArray(agentsRaw) ? agentsRaw : []
    log.debug('Fetched active agents from Zammad', { count: allAgents.length })

    // ★ 2. Binding-first: check if customer has a dedicated staff member
    let bindingExists = false
    if (customerId) {
      try {
        const binding = await findActiveBinding(customerId)
        if (binding) {
          bindingExists = true
          log.debug('Found active binding', { customerId, staffZammadId: binding.staffZammadId })

          const boundStaff = allAgents.find(a => a.id === binding.staffZammadId)

          if (boundStaff && isAgentEligible(boundStaff, groupId, EXCLUDED_EMAILS)) {
            // ✅ Bound staff is available — assign directly
            await zammadClient.updateTicket(ticketId, { owner_id: boundStaff.id, state: 'open' })
            const name = getAgentDisplayName(boundStaff)
            log.info('Assigned to bound staff', { ticketNumber, assignedTo: name })
            return { success: true, assignedTo: { id: boundStaff.id, name, email: boundStaff.email } }
          }

          // Bound staff on vacation — try their replacement
          if (boundStaff && checkIsOnVacation(boundStaff) && boundStaff.out_of_office_replacement_id) {
            const replacement = allAgents.find(a => a.id === boundStaff.out_of_office_replacement_id)
            if (replacement && isAgentEligible(replacement, groupId, EXCLUDED_EMAILS)) {
              await zammadClient.updateTicket(ticketId, { owner_id: replacement.id, state: 'open' })
              const name = getAgentDisplayName(replacement)
              log.info('Assigned to vacation replacement', { ticketNumber, assignedTo: name, boundStaffId: boundStaff.id })
              return { success: true, assignedTo: { id: replacement.id, name, email: replacement.email } }
            }
          }

          // Bound staff inactive or not found — auto-deactivate stale binding
          if (!boundStaff || !boundStaff.active) {
            log.warning('Bound staff inactive/missing, deactivating stale binding', {
              ticketNumber, staffZammadId: binding.staffZammadId,
            })
            deactivateBindingByCustomer(customerId).catch(() => {})
            bindingExists = false
          } else {
            log.info('Bound staff unavailable, falling back to load-balancing', { ticketNumber, boundStaffId: boundStaff.id })
          }
        }
      } catch (bindingError) {
        log.warning('Binding lookup failed, falling back to load-balancing', {
          ticketNumber, error: bindingError instanceof Error ? bindingError.message : bindingError,
        })
      }
    }

    // 3. Calculate ticket load per agent using targeted search
    const activeStateIds = getActiveStateIds()
    const stateQuery = activeStateIds.map(id => `state_id:${id}`).join(' OR ')
    const groupQuery = `group_id:${groupId} AND (${stateQuery})`
    const groupTickets = await zammadClient.searchTicketsRawQuery(groupQuery, 500)
    const allTickets = groupTickets?.tickets ?? []
    log.debug('Fetched group tickets for load calculation', { groupId, count: allTickets.length })

    // 4. Calculate current ticket count per agent in this group
    const ticketCountByAgent: Record<number, number> = {}
    for (const ticket of allTickets) {
      if (ticket.owner_id && ticket.owner_id !== 1) {
        ticketCountByAgent[ticket.owner_id] = (ticketCountByAgent[ticket.owner_id] || 0) + 1
      }
    }
    log.debug('Calculated ticket load', { activeStateIds, ticketCountByAgent })

    // 5. Filter available agents using shared helper
    const availableAgents = allAgents.filter(agent => isAgentEligible(agent, groupId, EXCLUDED_EMAILS))

    log.debug('Agent filter summary', { total: allAgents.length, available: availableAgents.length })

    // 6. No available agents
    if (availableAgents.length === 0) {
      const region = GROUP_REGION_MAPPING[groupId] || 'unknown'
      log.warning('No available agents for region', { region, ticketNumber })
      return { success: false, error: `No available agents for region: ${region}` }
    }

    // 7. Sort by load (ascending), pick the one with lowest load
    availableAgents.sort((a, b) => {
      const loadA = ticketCountByAgent[a.id] || 0
      const loadB = ticketCountByAgent[b.id] || 0
      return loadA - loadB
    })

    const selectedAgent = availableAgents[0]
    const selectedLoad = ticketCountByAgent[selectedAgent.id] || 0
    log.debug('Selected agent with lowest load', {
      email: selectedAgent.email, agentId: selectedAgent.id, load: selectedLoad,
    })

    // 8. Assign ticket and update state to open
    await zammadClient.updateTicket(ticketId, {
      owner_id: selectedAgent.id,
      state: 'open',
    })

    const agentName = getAgentDisplayName(selectedAgent)

    // ★ 9. Auto-create binding for first-time customers
    if (customerId && !bindingExists) {
      const region = GROUP_REGION_MAPPING[groupId] || 'unknown'
      findOrCreateBinding(customerId, selectedAgent.id, region, 'auto').catch(err => {
        log.warning('Failed to auto-create binding (non-blocking)', {
          error: err instanceof Error ? err.message : err,
        })
      })
    }

    log.info('Auto-assign successful', { ticketNumber, assignedTo: agentName, agentId: selectedAgent.id })
    return {
      success: true,
      assignedTo: { id: selectedAgent.id, name: agentName, email: selectedAgent.email },
    }
  } catch (error) {
    log.error('Auto-assign failed', { ticketNumber, error: error instanceof Error ? error.message : error })
    return { success: false, error: error instanceof Error ? error.message : 'Auto-assignment failed' }
  }
}

/**
 * Handle notifications after auto-assignment attempt
 * - Success: notify the assigned Staff
 * - Failure: notify all Admins
 */
export async function handleAssignmentNotification(
  result: SingleAssignResult,
  ticketId: number,
  ticketNumber: string,
  ticketTitle: string,
  region: string,
  requestId?: string
): Promise<void> {
  const log = createApiLogger('AutoAssign', requestId)

  try {
    if (result.success && result.assignedTo) {
      const staffLocalIds = await resolveLocalUserIdsForZammadUserId(result.assignedTo.id)
      for (const recipientUserId of staffLocalIds) {
        await notifyTicketAssigned({ recipientUserId, ticketId, ticketNumber, ticketTitle })
      }
      log.info('Notified staff for ticket assignment', { staffEmail: result.assignedTo.email, ticketNumber })
    } else {
      const allUsers = await zammadClient.searchUsersPaginated('*', 100, 1)
      const adminUsers = allUsers.filter(user => user.role_ids?.includes(1) && user.active)

      let notifiedCount = 0
      for (const admin of adminUsers) {
        const adminLocalIds = await resolveLocalUserIdsForZammadUserId(admin.id)
        for (const recipientUserId of adminLocalIds) {
          await notifySystemAlert({
            recipientUserId,
            title: 'Auto-assignment failed',
            body: `Ticket #${ticketNumber} could not be assigned: ${result.error}`,
            data: { ticketId, ticketNumber, ticketTitle, region },
          })
          notifiedCount++
        }
      }
      log.info('Notified admins about failed assignment', { ticketNumber, notifiedCount })
    }
  } catch (error) {
    log.error('Failed to send notification', { error: error instanceof Error ? error.message : error })
  }
}
```

- [ ] **Step 5: Run all auto-assign tests**

Run: `npx vitest run __tests__/lib/ticket/auto-assign.test.ts`
Expected: All tests PASS (old + new).

- [ ] **Step 6: Commit**

```bash
git add src/lib/ticket/auto-assign.ts __tests__/lib/ticket/auto-assign.test.ts
git commit -m "feat: add binding-first logic to auto-assign with hoisted getAgents and stale binding cleanup"
```

---

## Task 5: Update Ticket Creation Route — Pass customerId

**Files:**
- Modify: `src/app/api/tickets/route.ts:512-516`

- [ ] **Step 1: Update the autoAssignSingleTicket call**

In `src/app/api/tickets/route.ts`, find the auto-assign call block (around line 512-516):

```typescript
    // Auto-assign to available Staff in the ticket's region
    const requestId = log.requestId
    const assignResult = requestId
      ? await autoAssignSingleTicket(ticket.id, ticket.number, ticket.title, groupId, requestId)
      : await autoAssignSingleTicket(ticket.id, ticket.number, ticket.title, groupId)
```

Replace with:

```typescript
    // Auto-assign to available Staff in the ticket's region (with binding support)
    const assignResult = await autoAssignSingleTicket(
      ticket.id, ticket.number, ticket.title, groupId, log.requestId, zammadUser.id
    )
```

Note: `zammadUser.id` is the customer's Zammad ID, already available from line 461.

- [ ] **Step 2: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/tickets/route.ts
git commit -m "feat: pass customerId to auto-assign on ticket creation"
```

---

## Task 6: Update Email Ticket Routing — Pass customerId

**Files:**
- Modify: `src/lib/ticket/email-ticket-routing.ts:141-147`

- [ ] **Step 1: Update the autoAssignSingleTicket call**

In `src/lib/ticket/email-ticket-routing.ts`, find the auto-assign call (lines 141-147):

```typescript
    const result = await autoAssignSingleTicket(
      ticket.id,
      ticket.number,
      ticket.title,
      targetGroupId,
      requestId
    )
```

Replace with:

```typescript
    const result = await autoAssignSingleTicket(
      ticket.id,
      ticket.number,
      ticket.title,
      targetGroupId,
      requestId,
      customerId  // already defined on line 88 as ticket.customer_id
    )
```

- [ ] **Step 2: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/ticket/email-ticket-routing.ts
git commit -m "feat: pass customerId to auto-assign in email ticket routing"
```

---

## Task 7: Update Batch Auto-Assign Route — Add Binding Logic (Fetch-Once Architecture)

The batch route keeps its "fetch once, iterate locally" architecture for performance. It does NOT delegate to `autoAssignSingleTicket` (which would cause N+1 API calls and stale load data). Instead, it adds binding lookups inline and uses shared helpers.

**Files:**
- Modify: `src/app/api/tickets/auto-assign/route.ts:11-25,100-212`
- Modify: `__tests__/api/tickets-auto-assign.test.ts`

- [ ] **Step 1: Add imports to batch route**

In `src/app/api/tickets/auto-assign/route.ts`, replace the import block and constants (lines 11-25):

```typescript
import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/utils/auth'
import { getApiLogger } from '@/lib/utils/api-logger'
import {
    successResponse,
    serverErrorResponse,
    errorResponse,
} from '@/lib/utils/api-response'
import { zammadClient } from '@/lib/zammad/client'
import { GROUP_REGION_MAPPING } from '@/lib/constants/regions'
import { notifySystemAlert, resolveLocalUserIdsForZammadUserId } from '@/lib/notification'
import { isAgentEligible, checkIsOnVacation, getAgentDisplayName } from '@/lib/ticket/agent-helpers'
import { findActiveBinding, findOrCreateBinding, deactivateBindingByCustomer } from '@/lib/ticket/customer-binding'
import { EXCLUDED_EMAILS } from '@/lib/ticket/auto-assign'
```

Remove the local `EXCLUDED_EMAILS` constant (line 25) and the `ZAMMAD_ROLES` import (line 21) — now imported from shared modules.

- [ ] **Step 2: Replace the per-ticket loop with binding-aware logic**

Replace the per-ticket loop (lines 100-212, from `// Process each unassigned ticket` through the end of the for loop) with:

```typescript
        // Process each unassigned ticket
        for (const ticket of unassignedTickets) {
            const groupId = ticket.group_id

            // ★ Binding-first: check for dedicated staff
            if (ticket.customer_id) {
                try {
                    const binding = await findActiveBinding(ticket.customer_id)
                    if (binding) {
                        const boundStaff = allAgents.find(a => a.id === binding.staffZammadId)

                        if (boundStaff && isAgentEligible(boundStaff, groupId, EXCLUDED_EMAILS)) {
                            // Bound staff available — assign directly
                            try {
                                await zammadClient.updateTicket(ticket.id, { owner_id: boundStaff.id })
                                ticketCountByAgent[boundStaff.id] = (ticketCountByAgent[boundStaff.id] || 0) + 1
                                results.push({
                                    ticketId: ticket.id,
                                    ticketNumber: ticket.number,
                                    assignedTo: { id: boundStaff.id, name: getAgentDisplayName(boundStaff), email: boundStaff.email },
                                })
                                log.info('Batch: assigned to bound staff', { ticketNumber: ticket.number, agentId: boundStaff.id })
                                continue
                            } catch (err) {
                                log.error('Batch: failed to assign to bound staff', { ticketId: ticket.id, error: err instanceof Error ? err.message : err })
                            }
                        }

                        // Bound staff on vacation — try replacement
                        if (boundStaff && checkIsOnVacation(boundStaff) && boundStaff.out_of_office_replacement_id) {
                            const replacement = allAgents.find(a => a.id === boundStaff.out_of_office_replacement_id)
                            if (replacement && isAgentEligible(replacement, groupId, EXCLUDED_EMAILS)) {
                                try {
                                    await zammadClient.updateTicket(ticket.id, { owner_id: replacement.id })
                                    ticketCountByAgent[replacement.id] = (ticketCountByAgent[replacement.id] || 0) + 1
                                    results.push({
                                        ticketId: ticket.id,
                                        ticketNumber: ticket.number,
                                        assignedTo: { id: replacement.id, name: getAgentDisplayName(replacement), email: replacement.email },
                                    })
                                    log.info('Batch: assigned to vacation replacement', { ticketNumber: ticket.number, agentId: replacement.id })
                                    continue
                                } catch (err) {
                                    log.error('Batch: failed to assign to replacement', { ticketId: ticket.id, error: err instanceof Error ? err.message : err })
                                }
                            }
                        }

                        // Bound staff inactive/missing — deactivate stale binding
                        if (!boundStaff || !boundStaff.active) {
                            deactivateBindingByCustomer(ticket.customer_id).catch(() => {})
                        }
                    }
                } catch {
                    // Binding lookup failed — fall through to load-balancing
                }
            }

            // Load-balancing fallback (using shared helper)
            const availableAgents = allAgents.filter(agent => isAgentEligible(agent, groupId, EXCLUDED_EMAILS))

            if (availableAgents.length === 0) {
                const region = GROUP_REGION_MAPPING[groupId] || 'unknown'
                results.push({
                    ticketId: ticket.id,
                    ticketNumber: ticket.number,
                    assignedTo: null,
                    error: `No available agents for group ${groupId} (region: ${region})`,
                })
                continue
            }

            // Sort by ticket count (ascending) and pick lowest load
            availableAgents.sort((a, b) => {
                const loadA = ticketCountByAgent[a.id] || 0
                const loadB = ticketCountByAgent[b.id] || 0
                return loadA - loadB
            })

            const selectedAgent = availableAgents[0]

            try {
                await zammadClient.updateTicket(ticket.id, { owner_id: selectedAgent.id })
                ticketCountByAgent[selectedAgent.id] = (ticketCountByAgent[selectedAgent.id] || 0) + 1

                results.push({
                    ticketId: ticket.id,
                    ticketNumber: ticket.number,
                    assignedTo: {
                        id: selectedAgent.id,
                        name: getAgentDisplayName(selectedAgent),
                        email: selectedAgent.email,
                    },
                })

                // Auto-create binding for first-time customers (non-blocking)
                if (ticket.customer_id) {
                    const region = GROUP_REGION_MAPPING[groupId] || 'unknown'
                    findOrCreateBinding(ticket.customer_id, selectedAgent.id, region, 'auto').catch(() => {})
                }

                log.info('Ticket auto-assigned', {
                    ticketId: ticket.id, ticketNumber: ticket.number,
                    groupId, agentId: selectedAgent.id,
                })
            } catch (error) {
                log.error('Failed to auto-assign ticket', {
                    ticketId: ticket.id, ticketNumber: ticket.number,
                    error: error instanceof Error ? error.message : error,
                })
                results.push({
                    ticketId: ticket.id,
                    ticketNumber: ticket.number,
                    assignedTo: null,
                    error: error instanceof Error ? error.message : 'Assignment failed',
                })
            }
        }
```

- [ ] **Step 3: Update batch test mocks and assertions**

Replace `__tests__/api/tickets-auto-assign.test.ts` in its entirety:

```typescript
/**
 * Ticket auto-assign API integration tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/tickets/auto-assign/route'
import { getGroupIdByRegion } from '@/lib/constants/regions'

vi.mock('@/lib/utils/auth', () => ({
  requireRole: vi.fn(),
}))

vi.mock('@/lib/zammad/client', () => ({
  zammadClient: {
    getAllTickets: vi.fn(),
    getAgents: vi.fn(),
    updateTicket: vi.fn(),
  },
}))

vi.mock('@/lib/ticket/customer-binding', () => ({
  findActiveBinding: vi.fn().mockResolvedValue(null),
  findOrCreateBinding: vi.fn().mockResolvedValue({}),
  deactivateBindingByCustomer: vi.fn().mockResolvedValue(0),
}))

import { requireRole } from '@/lib/utils/auth'
import { zammadClient } from '@/lib/zammad/client'
import { findActiveBinding } from '@/lib/ticket/customer-binding'

function createRequestWithSecret(secret?: string) {
  const headers = new Headers()
  if (secret) headers.set('x-cron-secret', secret)
  return new NextRequest('http://localhost:3000/api/tickets/auto-assign', { headers })
}

describe('Ticket Auto-Assign API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset binding mock to default (no binding)
    vi.mocked(findActiveBinding).mockResolvedValue(null)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('rejects invalid cron secret', async () => {
    process.env.CRON_SECRET = 'secret'

    const request = createRequestWithSecret('wrong')
    const response = await POST(request)

    expect(response.status).toBe(403)
    expect(requireRole).not.toHaveBeenCalled()
  })

  it('skips role check when cron secret is valid', async () => {
    process.env.CRON_SECRET = 'secret'

    vi.mocked(zammadClient.getAllTickets).mockResolvedValue([])
    vi.mocked(zammadClient.getAgents).mockResolvedValue([])

    const request = createRequestWithSecret('secret')
    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(requireRole).not.toHaveBeenCalled()
  })

  it('assigns unassigned tickets to available agents', async () => {
    process.env.CRON_SECRET = 'secret'

    const asiaGroupId = getGroupIdByRegion('asia-pacific')
    vi.mocked(zammadClient.getAllTickets).mockResolvedValue([
      {
        id: 1,
        number: '10001',
        title: 'Unassigned',
        owner_id: 1,
        customer_id: 50,
        group_id: asiaGroupId,
        state_id: 1,
      },
    ] as any)

    vi.mocked(zammadClient.getAgents).mockResolvedValue([
      {
        id: 20,
        email: 'agent@test.com',
        firstname: 'Agent',
        lastname: 'One',
        active: true,
        role_ids: [2],
        group_ids: { [asiaGroupId.toString()]: ['full'] },
        out_of_office: false,
      },
    ] as any)

    const request = createRequestWithSecret('secret')
    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(zammadClient.updateTicket).toHaveBeenCalledWith(1, { owner_id: 20 })
  })

  it('assigns to bound staff when binding exists', async () => {
    process.env.CRON_SECRET = 'secret'

    const asiaGroupId = getGroupIdByRegion('asia-pacific')
    vi.mocked(findActiveBinding).mockResolvedValue({
      id: 1, customerZammadId: 50, staffZammadId: 30,
      region: 'asia-pacific', source: 'auto', isActive: true,
      createdAt: new Date(), updatedAt: new Date(), deactivatedAt: null,
    })

    vi.mocked(zammadClient.getAllTickets).mockResolvedValue([
      {
        id: 1,
        number: '10001',
        title: 'Unassigned',
        owner_id: 1,
        customer_id: 50,
        group_id: asiaGroupId,
        state_id: 1,
      },
    ] as any)

    vi.mocked(zammadClient.getAgents).mockResolvedValue([
      {
        id: 20,
        email: 'other@test.com',
        firstname: 'Other',
        lastname: 'Agent',
        active: true,
        role_ids: [2],
        group_ids: { [asiaGroupId.toString()]: ['full'] },
        out_of_office: false,
      },
      {
        id: 30,
        email: 'bound@test.com',
        firstname: 'Bound',
        lastname: 'Agent',
        active: true,
        role_ids: [2],
        group_ids: { [asiaGroupId.toString()]: ['full'] },
        out_of_office: false,
      },
    ] as any)

    const request = createRequestWithSecret('secret')
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(zammadClient.updateTicket).toHaveBeenCalledWith(1, { owner_id: 30 })
    expect(data.data.results[0].assignedTo.id).toBe(30)
  })
})
```

- [ ] **Step 4: Run batch tests**

Run: `npx vitest run __tests__/api/tickets-auto-assign.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/tickets/auto-assign/route.ts __tests__/api/tickets-auto-assign.test.ts
git commit -m "feat: add binding-aware logic to batch auto-assign with shared helpers"
```

---

## Task 8: Admin API — List and Create Bindings

**Files:**
- Create: `src/app/api/admin/customer-bindings/route.ts`

- [ ] **Step 1: Implement the Admin bindings API**

Create `src/app/api/admin/customer-bindings/route.ts`:

```typescript
/**
 * Admin Customer-Staff Binding Management API
 *
 * GET  /api/admin/customer-bindings — List bindings (with filters)
 * POST /api/admin/customer-bindings — Create or update a binding (admin manual)
 */

import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/utils/auth'
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  validationErrorResponse,
  serverErrorResponse,
} from '@/lib/utils/api-response'
import { listBindings, setBinding } from '@/lib/ticket/customer-binding'
import { zammadClient } from '@/lib/zammad/client'
import { z } from 'zod'
import { logger } from '@/lib/utils/logger'

const CreateBindingSchema = z.object({
  customerZammadId: z.number().int().positive(),
  staffZammadId: z.number().int().positive(),
  region: z.string().min(1),
})

export async function GET(request: NextRequest) {
  try {
    await requireRole(['admin'])

    const { searchParams } = new URL(request.url)
    const staffZammadId = searchParams.get('staffZammadId')
    const customerZammadId = searchParams.get('customerZammadId')
    const region = searchParams.get('region')
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '50')

    const result = await listBindings({
      staffZammadId: staffZammadId ? parseInt(staffZammadId) : undefined,
      customerZammadId: customerZammadId ? parseInt(customerZammadId) : undefined,
      region: region || undefined,
      page: isNaN(page) ? 1 : page,
      pageSize: isNaN(pageSize) ? 50 : Math.min(pageSize, 100),
    })

    return successResponse(result)
  } catch (error: any) {
    if (error.message === 'Unauthorized') return unauthorizedResponse()
    if (error.message === 'Forbidden') return forbiddenResponse()
    logger.error('AdminBindings', 'GET error', { data: { error: error.message } })
    return serverErrorResponse('Failed to list bindings')
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole(['admin'])

    const body = await request.json()
    const validation = CreateBindingSchema.safeParse(body)

    if (!validation.success) {
      return validationErrorResponse(validation.error.errors)
    }

    const { customerZammadId, staffZammadId, region } = validation.data

    // Validate target staff exists and is active
    try {
      const staff = await zammadClient.getUser(staffZammadId)
      if (!staff.active) {
        return validationErrorResponse([{ path: ['staffZammadId'], message: 'Target staff is inactive' }])
      }
    } catch {
      return validationErrorResponse([{ path: ['staffZammadId'], message: 'Staff not found in Zammad' }])
    }

    const binding = await setBinding(customerZammadId, staffZammadId, region)

    return successResponse({ binding, message: 'Binding saved successfully' }, 201)
  } catch (error: any) {
    if (error.message === 'Unauthorized') return unauthorizedResponse()
    if (error.message === 'Forbidden') return forbiddenResponse()
    logger.error('AdminBindings', 'POST error', { data: { error: error.message } })
    return serverErrorResponse('Failed to save binding')
  }
}
```

- [ ] **Step 2: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/customer-bindings/route.ts
git commit -m "feat: add admin API for listing and creating customer-staff bindings"
```

---

## Task 9: Admin API — Delete Binding and Batch Transfer

**Files:**
- Create: `src/app/api/admin/customer-bindings/[id]/route.ts`
- Create: `src/app/api/admin/customer-bindings/transfer/route.ts`

- [ ] **Step 1: Implement single-binding deactivation**

Create `src/app/api/admin/customer-bindings/[id]/route.ts`:

```typescript
/**
 * DELETE /api/admin/customer-bindings/[id] — Deactivate a binding
 */

import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/utils/auth'
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  validationErrorResponse,
  notFoundResponse,
  serverErrorResponse,
} from '@/lib/utils/api-response'
import { deactivateBinding } from '@/lib/ticket/customer-binding'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/utils/logger'

type RouteParams = { params: Promise<{ id: string }> }

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    await requireRole(['admin'])

    const { id } = await params
    const bindingId = parseInt(id)

    if (isNaN(bindingId)) {
      return validationErrorResponse([{ path: ['id'], message: 'Invalid binding ID' }])
    }

    const binding = await prisma.customerStaffBinding.findUnique({ where: { id: bindingId } })
    if (!binding) {
      return notFoundResponse('Binding not found')
    }

    await deactivateBinding(bindingId)

    return successResponse({ message: 'Binding deactivated successfully' })
  } catch (error: any) {
    if (error.message === 'Unauthorized') return unauthorizedResponse()
    if (error.message === 'Forbidden') return forbiddenResponse()
    logger.error('AdminBindings', 'DELETE error', { data: { error: error.message } })
    return serverErrorResponse('Failed to deactivate binding')
  }
}
```

- [ ] **Step 2: Implement batch transfer API with target staff validation**

Create `src/app/api/admin/customer-bindings/transfer/route.ts`:

```typescript
/**
 * POST /api/admin/customer-bindings/transfer — Transfer all customers from one staff to another
 */

import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/utils/auth'
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  validationErrorResponse,
  serverErrorResponse,
} from '@/lib/utils/api-response'
import { transferBindings } from '@/lib/ticket/customer-binding'
import { zammadClient } from '@/lib/zammad/client'
import { z } from 'zod'
import { logger } from '@/lib/utils/logger'

const TransferSchema = z.object({
  fromStaffZammadId: z.number().int().positive(),
  toStaffZammadId: z.number().int().positive(),
})

export async function POST(request: NextRequest) {
  try {
    await requireRole(['admin'])

    const body = await request.json()
    const validation = TransferSchema.safeParse(body)

    if (!validation.success) {
      return validationErrorResponse(validation.error.errors)
    }

    const { fromStaffZammadId, toStaffZammadId } = validation.data

    if (fromStaffZammadId === toStaffZammadId) {
      return validationErrorResponse([{
        path: ['toStaffZammadId'],
        message: 'Cannot transfer to the same staff member',
      }])
    }

    // Validate target staff exists and is active
    try {
      const targetStaff = await zammadClient.getUser(toStaffZammadId)
      if (!targetStaff.active) {
        return validationErrorResponse([{ path: ['toStaffZammadId'], message: 'Target staff is inactive' }])
      }
    } catch {
      return validationErrorResponse([{ path: ['toStaffZammadId'], message: 'Target staff not found in Zammad' }])
    }

    const count = await transferBindings(fromStaffZammadId, toStaffZammadId)

    return successResponse({
      message: `Transferred ${count} customer binding(s)`,
      transferred: count,
    })
  } catch (error: any) {
    if (error.message === 'Unauthorized') return unauthorizedResponse()
    if (error.message === 'Forbidden') return forbiddenResponse()
    logger.error('AdminBindings', 'Transfer error', { data: { error: error.message } })
    return serverErrorResponse('Failed to transfer bindings')
  }
}
```

- [ ] **Step 3: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/customer-bindings/
git commit -m "feat: add admin APIs for deleting bindings and batch transfer with validation"
```

---

## Task 10: Admin API Tests

**Files:**
- Create: `__tests__/api/customer-bindings.test.ts`

- [ ] **Step 1: Write API route tests**

Create `__tests__/api/customer-bindings.test.ts`:

```typescript
/**
 * Admin Customer-Staff Binding API tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/utils/auth', () => ({
  requireRole: vi.fn(),
  requireAuth: vi.fn(),
}))

vi.mock('@/lib/ticket/customer-binding', () => ({
  listBindings: vi.fn(),
  setBinding: vi.fn(),
  deactivateBinding: vi.fn(),
  transferBindings: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    customerStaffBinding: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('@/lib/zammad/client', () => ({
  zammadClient: {
    getUser: vi.fn(),
  },
}))

import { requireRole } from '@/lib/utils/auth'
import { listBindings, setBinding, deactivateBinding, transferBindings } from '@/lib/ticket/customer-binding'
import { prisma } from '@/lib/prisma'
import { zammadClient } from '@/lib/zammad/client'

describe('Admin Customer Bindings API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireRole).mockResolvedValue({ id: 'admin1', email: 'admin@test.com', role: 'admin' } as any)
  })

  describe('GET /api/admin/customer-bindings', () => {
    it('returns paginated bindings', async () => {
      vi.mocked(listBindings).mockResolvedValue({
        bindings: [{ id: 1, customerZammadId: 100, staffZammadId: 200 }],
        total: 1, page: 1, pageSize: 50,
      } as any)

      const { GET } = await import('@/app/api/admin/customer-bindings/route')
      const request = new Request('http://localhost/api/admin/customer-bindings?page=1') as any
      const response = await GET(request)
      const data = await response.json()

      expect(data.data.total).toBe(1)
    })

    it('supports customerZammadId filter', async () => {
      vi.mocked(listBindings).mockResolvedValue({ bindings: [], total: 0, page: 1, pageSize: 50 } as any)

      const { GET } = await import('@/app/api/admin/customer-bindings/route')
      const request = new Request('http://localhost/api/admin/customer-bindings?customerZammadId=100') as any
      await GET(request)

      expect(listBindings).toHaveBeenCalledWith(expect.objectContaining({ customerZammadId: 100 }))
    })

    it('returns 401 when not authenticated', async () => {
      vi.mocked(requireRole).mockRejectedValue(new Error('Unauthorized'))

      const { GET } = await import('@/app/api/admin/customer-bindings/route')
      const request = new Request('http://localhost/api/admin/customer-bindings') as any
      const response = await GET(request)

      expect(response.status).toBe(401)
    })

    it('returns 403 when wrong role', async () => {
      vi.mocked(requireRole).mockRejectedValue(new Error('Forbidden'))

      const { GET } = await import('@/app/api/admin/customer-bindings/route')
      const request = new Request('http://localhost/api/admin/customer-bindings') as any
      const response = await GET(request)

      expect(response.status).toBe(403)
    })
  })

  describe('POST /api/admin/customer-bindings', () => {
    it('creates a manual binding after validating target staff', async () => {
      vi.mocked(zammadClient.getUser).mockResolvedValue({ id: 200, active: true } as any)
      vi.mocked(setBinding).mockResolvedValue({ id: 1, source: 'manual' } as any)

      const { POST } = await import('@/app/api/admin/customer-bindings/route')
      const request = new Request('http://localhost/api/admin/customer-bindings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerZammadId: 100, staffZammadId: 200, region: 'asia-pacific' }),
      }) as any
      const response = await POST(request)

      expect(response.status).toBe(201)
      expect(setBinding).toHaveBeenCalledWith(100, 200, 'asia-pacific')
    })

    it('rejects binding to inactive staff', async () => {
      vi.mocked(zammadClient.getUser).mockResolvedValue({ id: 200, active: false } as any)

      const { POST } = await import('@/app/api/admin/customer-bindings/route')
      const request = new Request('http://localhost/api/admin/customer-bindings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerZammadId: 100, staffZammadId: 200, region: 'asia-pacific' }),
      }) as any
      const response = await POST(request)

      expect(response.status).toBe(400)
    })
  })

  describe('POST /api/admin/customer-bindings/transfer', () => {
    it('transfers bindings after validating target staff', async () => {
      vi.mocked(zammadClient.getUser).mockResolvedValue({ id: 300, active: true } as any)
      vi.mocked(transferBindings).mockResolvedValue(5)

      const { POST } = await import('@/app/api/admin/customer-bindings/transfer/route')
      const request = new Request('http://localhost/api/admin/customer-bindings/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromStaffZammadId: 200, toStaffZammadId: 300 }),
      }) as any
      const response = await POST(request)
      const data = await response.json()

      expect(data.data.transferred).toBe(5)
    })

    it('rejects same-staff transfer', async () => {
      const { POST } = await import('@/app/api/admin/customer-bindings/transfer/route')
      const request = new Request('http://localhost/api/admin/customer-bindings/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromStaffZammadId: 200, toStaffZammadId: 200 }),
      }) as any
      const response = await POST(request)

      expect(response.status).toBe(400)
    })

    it('rejects transfer to inactive staff', async () => {
      vi.mocked(zammadClient.getUser).mockResolvedValue({ id: 300, active: false } as any)

      const { POST } = await import('@/app/api/admin/customer-bindings/transfer/route')
      const request = new Request('http://localhost/api/admin/customer-bindings/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromStaffZammadId: 200, toStaffZammadId: 300 }),
      }) as any
      const response = await POST(request)

      expect(response.status).toBe(400)
    })
  })

  describe('DELETE /api/admin/customer-bindings/[id]', () => {
    it('deactivates a binding', async () => {
      vi.mocked(prisma.customerStaffBinding.findUnique).mockResolvedValue({ id: 1, isActive: true } as any)
      vi.mocked(deactivateBinding).mockResolvedValue({} as any)

      const { DELETE } = await import('@/app/api/admin/customer-bindings/[id]/route')
      const request = new Request('http://localhost/api/admin/customer-bindings/1', { method: 'DELETE' }) as any
      const response = await DELETE(request, { params: Promise.resolve({ id: '1' }) })

      expect(response.status).toBe(200)
      expect(deactivateBinding).toHaveBeenCalledWith(1)
    })

    it('returns 404 for non-existent binding', async () => {
      vi.mocked(prisma.customerStaffBinding.findUnique).mockResolvedValue(null)

      const { DELETE } = await import('@/app/api/admin/customer-bindings/[id]/route')
      const request = new Request('http://localhost/api/admin/customer-bindings/999', { method: 'DELETE' }) as any
      const response = await DELETE(request, { params: Promise.resolve({ id: '999' }) })

      expect(response.status).toBe(404)
    })
  })
})
```

- [ ] **Step 2: Run API tests**

Run: `npx vitest run __tests__/api/customer-bindings.test.ts`
Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add __tests__/api/customer-bindings.test.ts
git commit -m "test: add admin customer-bindings API tests"
```

---

## Task 11: Full Integration Verification

**Files:** (no changes — verification only)

- [ ] **Step 1: Run all unit tests**

Run: `npx vitest run`
Expected: All tests PASS. No regressions.

- [ ] **Step 2: Type-check the entire project**

Run: `npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 3: Build the project**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Verify backward compatibility**

Run:
```bash
npx vitest run __tests__/lib/ticket/auto-assign.test.ts __tests__/unit/email-ticket-routing.test.ts __tests__/api/tickets-auto-assign.test.ts
```
Expected: All tests PASS — old behavior preserved when `customerId` is omitted.

- [ ] **Step 5: Final commit (if any fixups needed)**

```bash
git add -A
git commit -m "chore: integration verification and fixups for customer-staff binding"
```
