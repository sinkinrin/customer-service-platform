# Auto-Assign on Ticket Creation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Customer 创建工单后，系统自动将工单分配给对应区域负载最低的可用 Staff。

**Architecture:** 抽取 `auto-assign/route.ts` 中的分配算法为独立模块 `src/lib/ticket/auto-assign.ts`，在 `POST /api/tickets` 成功创建后同步调用。分配成功通知 Staff，失败通知 Admin。

**Tech Stack:** Next.js API Routes, Zammad REST API, Prisma (通知), Vitest (测试)

---

## Task 1: Create auto-assign module with types

**Files:**
- Create: `src/lib/ticket/auto-assign.ts`

**Step 1: Create the file with type definitions and constants**

```typescript
/**
 * Auto-assign single ticket to available agent
 *
 * Extracted from /api/tickets/auto-assign for reuse in ticket creation flow
 */

import { zammadClient } from '@/lib/zammad/client'
import { GROUP_REGION_MAPPING } from '@/lib/constants/regions'
import type { ZammadUser } from '@/lib/zammad/types'

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

// Placeholder for implementation
export async function autoAssignSingleTicket(
  ticketId: number,
  ticketNumber: string,
  ticketTitle: string,
  groupId: number
): Promise<SingleAssignResult> {
  return { success: false, error: 'Not implemented' }
}

export async function handleAssignmentNotification(
  result: SingleAssignResult,
  ticketId: number,
  ticketNumber: string,
  ticketTitle: string,
  region: string
): Promise<void> {
  // Placeholder
}
```

**Step 2: Verify file compiles**

Run: `npx tsc --noEmit src/lib/ticket/auto-assign.ts 2>&1 || echo "Check imports"`

Expected: No errors (or only import resolution errors which are OK)

**Step 3: Commit**

```bash
git add src/lib/ticket/auto-assign.ts
git commit -m "feat(ticket): add auto-assign module skeleton

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: Write failing tests for autoAssignSingleTicket

**Files:**
- Create: `__tests__/lib/ticket/auto-assign.test.ts`

**Step 1: Write test file with core test cases**

```typescript
/**
 * Auto-assign single ticket unit tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { autoAssignSingleTicket, EXCLUDED_EMAILS } from '@/lib/ticket/auto-assign'
import { getGroupIdByRegion } from '@/lib/constants/regions'

vi.mock('@/lib/zammad/client', () => ({
  zammadClient: {
    getAllTickets: vi.fn(),
    getAgents: vi.fn(),
    updateTicket: vi.fn(),
  },
}))

import { zammadClient } from '@/lib/zammad/client'

describe('autoAssignSingleTicket', () => {
  const asiaGroupId = getGroupIdByRegion('asia-pacific')

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('assigns ticket to available agent in the same region', async () => {
    vi.mocked(zammadClient.getAllTickets).mockResolvedValue([])
    vi.mocked(zammadClient.getAgents).mockResolvedValue([
      {
        id: 100,
        email: 'agent@test.com',
        firstname: 'Test',
        lastname: 'Agent',
        active: true,
        role_ids: [2], // Agent role
        group_ids: { [asiaGroupId]: ['full'] },
        out_of_office: false,
      },
    ] as any)
    vi.mocked(zammadClient.updateTicket).mockResolvedValue({} as any)

    const result = await autoAssignSingleTicket(1, '10001', 'Test Ticket', asiaGroupId)

    expect(result.success).toBe(true)
    expect(result.assignedTo).toEqual({
      id: 100,
      name: 'Test Agent',
      email: 'agent@test.com',
    })
    expect(zammadClient.updateTicket).toHaveBeenCalledWith(1, {
      owner_id: 100,
      state_id: 2,
    })
  })

  it('returns error when no agents available for region', async () => {
    vi.mocked(zammadClient.getAllTickets).mockResolvedValue([])
    vi.mocked(zammadClient.getAgents).mockResolvedValue([])

    const result = await autoAssignSingleTicket(1, '10001', 'Test Ticket', asiaGroupId)

    expect(result.success).toBe(false)
    expect(result.error).toContain('No available agents')
    expect(zammadClient.updateTicket).not.toHaveBeenCalled()
  })

  it('excludes agents without access to the ticket group', async () => {
    const europeGroupId = getGroupIdByRegion('europe-zone-1')

    vi.mocked(zammadClient.getAllTickets).mockResolvedValue([])
    vi.mocked(zammadClient.getAgents).mockResolvedValue([
      {
        id: 100,
        email: 'europe-agent@test.com',
        firstname: 'Europe',
        lastname: 'Agent',
        active: true,
        role_ids: [2],
        group_ids: { [europeGroupId]: ['full'] }, // Only Europe access
        out_of_office: false,
      },
    ] as any)

    const result = await autoAssignSingleTicket(1, '10001', 'Test Ticket', asiaGroupId)

    expect(result.success).toBe(false)
    expect(result.error).toContain('No available agents')
  })

  it('excludes agents on vacation', async () => {
    const now = new Date()
    const startDate = new Date(now.getTime() - 86400000).toISOString() // Yesterday
    const endDate = new Date(now.getTime() + 86400000).toISOString() // Tomorrow

    vi.mocked(zammadClient.getAllTickets).mockResolvedValue([])
    vi.mocked(zammadClient.getAgents).mockResolvedValue([
      {
        id: 100,
        email: 'vacation@test.com',
        firstname: 'Vacation',
        lastname: 'Agent',
        active: true,
        role_ids: [2],
        group_ids: { [asiaGroupId]: ['full'] },
        out_of_office: true,
        out_of_office_start_at: startDate,
        out_of_office_end_at: endDate,
      },
    ] as any)

    const result = await autoAssignSingleTicket(1, '10001', 'Test Ticket', asiaGroupId)

    expect(result.success).toBe(false)
    expect(result.error).toContain('No available agents')
  })

  it('excludes admin role agents', async () => {
    vi.mocked(zammadClient.getAllTickets).mockResolvedValue([])
    vi.mocked(zammadClient.getAgents).mockResolvedValue([
      {
        id: 100,
        email: 'admin@test.com',
        firstname: 'Admin',
        lastname: 'User',
        active: true,
        role_ids: [1, 2], // Admin + Agent
        group_ids: { [asiaGroupId]: ['full'] },
        out_of_office: false,
      },
    ] as any)

    const result = await autoAssignSingleTicket(1, '10001', 'Test Ticket', asiaGroupId)

    expect(result.success).toBe(false)
    expect(result.error).toContain('No available agents')
  })

  it('excludes system accounts', async () => {
    vi.mocked(zammadClient.getAllTickets).mockResolvedValue([])
    vi.mocked(zammadClient.getAgents).mockResolvedValue([
      {
        id: 100,
        email: 'support@howentech.com',
        firstname: 'Support',
        lastname: 'System',
        active: true,
        role_ids: [2],
        group_ids: { [asiaGroupId]: ['full'] },
        out_of_office: false,
      },
    ] as any)

    const result = await autoAssignSingleTicket(1, '10001', 'Test Ticket', asiaGroupId)

    expect(result.success).toBe(false)
  })

  it('selects agent with lowest ticket load', async () => {
    vi.mocked(zammadClient.getAllTickets).mockResolvedValue([
      { id: 1, owner_id: 100, state_id: 2 }, // Agent 100 has 1 ticket
      { id: 2, owner_id: 100, state_id: 2 }, // Agent 100 has 2 tickets
      { id: 3, owner_id: 101, state_id: 2 }, // Agent 101 has 1 ticket
    ] as any)
    vi.mocked(zammadClient.getAgents).mockResolvedValue([
      {
        id: 100,
        email: 'busy@test.com',
        firstname: 'Busy',
        lastname: 'Agent',
        active: true,
        role_ids: [2],
        group_ids: { [asiaGroupId]: ['full'] },
        out_of_office: false,
      },
      {
        id: 101,
        email: 'free@test.com',
        firstname: 'Free',
        lastname: 'Agent',
        active: true,
        role_ids: [2],
        group_ids: { [asiaGroupId]: ['full'] },
        out_of_office: false,
      },
    ] as any)
    vi.mocked(zammadClient.updateTicket).mockResolvedValue({} as any)

    const result = await autoAssignSingleTicket(999, '10099', 'Test Ticket', asiaGroupId)

    expect(result.success).toBe(true)
    expect(result.assignedTo?.id).toBe(101) // Free agent with lower load
  })

  it('handles Zammad API errors gracefully', async () => {
    vi.mocked(zammadClient.getAllTickets).mockRejectedValue(new Error('API timeout'))

    const result = await autoAssignSingleTicket(1, '10001', 'Test Ticket', asiaGroupId)

    expect(result.success).toBe(false)
    expect(result.error).toBe('API timeout')
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npm run test -- __tests__/lib/ticket/auto-assign.test.ts`

Expected: Tests FAIL (function returns `{ success: false, error: 'Not implemented' }`)

**Step 3: Commit failing tests**

```bash
git add __tests__/lib/ticket/auto-assign.test.ts
git commit -m "test(ticket): add failing tests for autoAssignSingleTicket

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: Implement autoAssignSingleTicket

**Files:**
- Modify: `src/lib/ticket/auto-assign.ts`

**Step 1: Implement the full function**

Replace the placeholder `autoAssignSingleTicket` function with:

```typescript
/**
 * Auto-assign a single ticket to the available agent with lowest load in the ticket's region
 */
export async function autoAssignSingleTicket(
  ticketId: number,
  ticketNumber: string,
  ticketTitle: string,
  groupId: number
): Promise<SingleAssignResult> {
  try {
    // 1. Get all active agents
    const allAgents = await zammadClient.getAgents(true)

    // 2. Get all tickets for load calculation
    const allTickets = await zammadClient.getAllTickets()

    // 3. Calculate current ticket count per agent
    // Only count active tickets (state_id: 1=new, 2=open, 3=pending, 7=pending close)
    const ticketCountByAgent: Record<number, number> = {}
    for (const ticket of allTickets) {
      if (ticket.owner_id && ticket.owner_id !== 1 && [1, 2, 3, 7].includes(ticket.state_id)) {
        ticketCountByAgent[ticket.owner_id] = (ticketCountByAgent[ticket.owner_id] || 0) + 1
      }
    }

    const now = new Date()

    // 4. Filter available agents
    const availableAgents = allAgents.filter(agent => {
      // Exclude system accounts
      if (EXCLUDED_EMAILS.some(email => agent.email?.toLowerCase() === email.toLowerCase())) {
        return false
      }

      // Exclude Admin role (role_id 1)
      if (agent.role_ids?.includes(1)) {
        return false
      }

      // Check if agent has access to this group
      const agentGroupIds = agent.group_ids || {}
      const hasGroupAccess = Object.keys(agentGroupIds).includes(String(groupId))
      if (!hasGroupAccess) {
        return false
      }

      // Check if on vacation
      if (agent.out_of_office) {
        const startDate = agent.out_of_office_start_at ? new Date(agent.out_of_office_start_at) : null
        const endDate = agent.out_of_office_end_at ? new Date(agent.out_of_office_end_at) : null

        if (startDate && endDate) {
          if (now >= startDate && now <= endDate) return false
        } else if (startDate && !endDate) {
          if (now >= startDate) return false
        } else if (!startDate && endDate) {
          if (now <= endDate) return false
        }
      }

      return true
    })

    // 5. No available agents
    if (availableAgents.length === 0) {
      const region = GROUP_REGION_MAPPING[groupId] || 'unknown'
      return {
        success: false,
        error: `No available agents for region: ${region}`,
      }
    }

    // 6. Sort by load (ascending), pick the one with lowest load
    availableAgents.sort((a, b) => {
      const loadA = ticketCountByAgent[a.id] || 0
      const loadB = ticketCountByAgent[b.id] || 0
      return loadA - loadB
    })

    const selectedAgent = availableAgents[0]

    // 7. Assign ticket and update state to open
    await zammadClient.updateTicket(ticketId, {
      owner_id: selectedAgent.id,
      state_id: 2, // new -> open
    })

    const agentName = selectedAgent.firstname && selectedAgent.lastname
      ? `${selectedAgent.firstname} ${selectedAgent.lastname}`.trim()
      : selectedAgent.login || selectedAgent.email

    return {
      success: true,
      assignedTo: {
        id: selectedAgent.id,
        name: agentName,
        email: selectedAgent.email,
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Auto-assignment failed',
    }
  }
}
```

**Step 2: Run tests to verify they pass**

Run: `npm run test -- __tests__/lib/ticket/auto-assign.test.ts`

Expected: All tests PASS

**Step 3: Commit**

```bash
git add src/lib/ticket/auto-assign.ts
git commit -m "feat(ticket): implement autoAssignSingleTicket

- Filter agents by region, vacation, admin role, system accounts
- Load balance by current ticket count
- Update ticket state to open on assignment

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: Implement handleAssignmentNotification

**Files:**
- Modify: `src/lib/ticket/auto-assign.ts`

**Step 1: Add imports and implement notification handler**

Add to the top of `src/lib/ticket/auto-assign.ts`:

```typescript
import {
  notifyTicketAssigned,
  notifySystemAlert,
  resolveLocalUserIdsForZammadUserId,
} from '@/lib/notification'
import { prisma } from '@/lib/prisma'
```

Replace the placeholder `handleAssignmentNotification` with:

```typescript
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
  region: string
): Promise<void> {
  try {
    if (result.success && result.assignedTo) {
      // Assignment succeeded -> notify Staff
      const staffLocalIds = await resolveLocalUserIdsForZammadUserId(result.assignedTo.id)
      for (const recipientUserId of staffLocalIds) {
        await notifyTicketAssigned({
          recipientUserId,
          ticketId,
          ticketNumber,
          ticketTitle,
        })
      }
      console.log(`[Auto-Assign] Notified staff ${result.assignedTo.email} for ticket #${ticketNumber}`)
    } else {
      // Assignment failed -> notify all Admins
      const adminUsers = await prisma.user.findMany({
        where: { role: 'admin' },
        select: { id: true },
      })

      for (const admin of adminUsers) {
        await notifySystemAlert({
          recipientUserId: admin.id,
          title: 'Auto-assignment failed',
          body: `Ticket #${ticketNumber} could not be assigned: ${result.error}`,
          data: {
            ticketId,
            ticketNumber,
            ticketTitle,
            region,
          },
        })
      }
      console.log(`[Auto-Assign] Notified ${adminUsers.length} admins about failed assignment for ticket #${ticketNumber}`)
    }
  } catch (error) {
    console.error('[Auto-Assign] Failed to send notification:', error)
  }
}
```

**Step 2: Verify file compiles**

Run: `npx tsc --noEmit`

Expected: No type errors

**Step 3: Commit**

```bash
git add src/lib/ticket/auto-assign.ts
git commit -m "feat(ticket): implement handleAssignmentNotification

- Notify Staff on successful assignment
- Notify all Admins on failure

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: Integrate auto-assign into ticket creation API

**Files:**
- Modify: `src/app/api/tickets/route.ts`

**Step 1: Add import at top of file**

Add after other imports (around line 10):

```typescript
import { autoAssignSingleTicket, handleAssignmentNotification } from '@/lib/ticket/auto-assign'
```

**Step 2: Add auto-assign logic after ticket creation**

Find the comment `// OpenSpec: New tickets remain UNASSIGNED by default` (around line 600) and replace that block with:

```typescript
    // Auto-assign to available Staff in the ticket's region
    const assignResult = await autoAssignSingleTicket(
      ticket.id,
      ticket.number,
      ticket.title,
      groupId
    )

    if (assignResult.success) {
      console.log(`[Auto-Assign] Ticket #${ticket.number} assigned to ${assignResult.assignedTo?.name}`)
    } else {
      console.warn(`[Auto-Assign] Failed for #${ticket.number}: ${assignResult.error}`)
    }

    // Send notifications asynchronously (don't block response)
    handleAssignmentNotification(
      assignResult,
      ticket.id,
      ticket.number,
      ticket.title,
      region
    ).catch(err => console.error('[Auto-Assign] Notification error:', err))
```

**Step 3: Verify file compiles**

Run: `npx tsc --noEmit`

Expected: No type errors

**Step 4: Commit**

```bash
git add src/app/api/tickets/route.ts
git commit -m "feat(ticket): integrate auto-assign on ticket creation

Tickets are now automatically assigned to available Staff
in the same region immediately after creation.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: Add integration test for ticket creation with auto-assign

**Files:**
- Modify: `__tests__/api/tickets.test.ts`

**Step 1: Add test case for auto-assignment on creation**

Add to the existing test file (find a suitable location in the POST tests):

```typescript
import { autoAssignSingleTicket } from '@/lib/ticket/auto-assign'

vi.mock('@/lib/ticket/auto-assign', () => ({
  autoAssignSingleTicket: vi.fn(),
  handleAssignmentNotification: vi.fn(),
}))

// Add this test in the POST /api/tickets describe block:
it('auto-assigns ticket after creation', async () => {
  vi.mocked(autoAssignSingleTicket).mockResolvedValue({
    success: true,
    assignedTo: { id: 100, name: 'Test Agent', email: 'agent@test.com' },
  })

  // ... setup mock for ticket creation ...

  const response = await POST(request)

  expect(response.status).toBe(201)
  expect(autoAssignSingleTicket).toHaveBeenCalledWith(
    expect.any(Number),
    expect.any(String),
    expect.any(String),
    expect.any(Number)
  )
})

it('creates ticket successfully even when auto-assign fails', async () => {
  vi.mocked(autoAssignSingleTicket).mockResolvedValue({
    success: false,
    error: 'No available agents',
  })

  // ... setup mock for ticket creation ...

  const response = await POST(request)

  // Ticket creation should still succeed
  expect(response.status).toBe(201)
})
```

**Step 2: Run all ticket tests**

Run: `npm run test -- __tests__/api/tickets.test.ts`

Expected: All tests PASS

**Step 3: Commit**

```bash
git add __tests__/api/tickets.test.ts
git commit -m "test(ticket): add integration tests for auto-assign on creation

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 7: Run full test suite and verify

**Step 1: Run all tests**

Run: `npm run test`

Expected: All tests PASS

**Step 2: Run type check**

Run: `npm run type-check`

Expected: No errors

**Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address any test/type issues

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Create auto-assign module skeleton | `src/lib/ticket/auto-assign.ts` |
| 2 | Write failing tests | `__tests__/lib/ticket/auto-assign.test.ts` |
| 3 | Implement autoAssignSingleTicket | `src/lib/ticket/auto-assign.ts` |
| 4 | Implement handleAssignmentNotification | `src/lib/ticket/auto-assign.ts` |
| 5 | Integrate into ticket creation API | `src/app/api/tickets/route.ts` |
| 6 | Add integration tests | `__tests__/api/tickets.test.ts` |
| 7 | Run full test suite | - |

**Total: 7 tasks, ~15-20 steps**
