# Service Group Assignment Design

## Overview

Replace the existing `CustomerStaffBinding` (auto-created 1:1 customer-staff binding) with an admin-managed **Service Group** system. Admin manually assigns customers to named sub-groups (e.g., "亚太1", "中东2"), each sub-group maps to one responsible staff member.

**Motivation:** The current binding system assigns customers to staff randomly on first ticket via load-balancing, then persists the binding. Admin wants deterministic control over who serves whom from the start. The customer base is small enough for manual assignment.

## Background

### Current Assignment Flow

```
Customer creates ticket
  → region (from user.region) → Zammad group_id (1-8)
  → autoAssignSingleTicket:
      1. Check CustomerStaffBinding → if bound, assign to that staff
      2. Fallback: load-balance among eligible agents in group
      3. Auto-create binding on first successful assignment
```

### Problems with Current System

1. **First-assignment is random** — admin has no control over initial staff-customer pairing
2. **Binding granularity mismatch** — `transferBindings(fromStaff, toStaff)` moves ALL of a staff's customers, cannot transfer a subset (e.g., only CIS customers of a multi-region staff like Cody)
3. **No organizational structure** — bindings are flat, no grouping concept for admin to reason about

### Admin's Actual Staff-Region Structure

```
北美:     KEVIN
拉美:     FAITH
亚太1:    SHEVIN      亚太2:    EDWARD
欧1-1:    CODY        欧2-1:    CODY        独联体1:  CODY
欧2-2:    VINSON      独联体2:  VINSON
非洲1:    JASON
中东1:    LUCA        中东2:    DOVER       中东3:    JASON
```

13 sub-groups, some staff spanning multiple regions (Cody: 3 groups across 3 regions).

## Design Decisions

### Zammad-side: No Changes

Zammad stays with the existing 8 region groups. Reasons:

- Admin does not use the Zammad UI, only our platform
- Zammad sub-groups (v6.2+ `::` syntax) provide no automatic assignment — our custom code handles it regardless
- Zammad sub-groups add complexity (13 new groups, overview configuration per group, no hierarchy inheritance) with zero benefit for this use case
- Staff `group_ids` in Zammad continue to control which region's tickets they can be assigned to

### Data Layer: Prisma-only Sub-groups

Two new Prisma models replace `CustomerStaffBinding`:

- `ServiceGroup` — admin-defined sub-groups with region + staff mapping
- `CustomerGroupAssignment` — customer-to-group assignment (one group per customer)

### Unassigned Customer Handling

Customers not yet assigned to any service group → tickets routed to **staging group** (`group_id = 9`). Admin gets notified and must assign the customer to a group before the ticket can be processed.

## Data Model

### New Tables

```prisma
model ServiceGroup {
  id            Int       @id @default(autoincrement())
  name          String    @unique       // "亚太1", "中东2", "欧2-1"
  region        String                  // "asia-pacific" → maps to Zammad group_id
  staffZammadId Int                     // Zammad user ID of responsible staff
  isActive      Boolean   @default(true)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  customers     CustomerGroupAssignment[]

  @@index([region])
  @@index([staffZammadId])
  @@map("service_groups")
}

model CustomerGroupAssignment {
  id               Int          @id @default(autoincrement())
  customerZammadId Int          @unique      // one group per customer
  serviceGroupId   Int
  serviceGroup     ServiceGroup @relation(fields: [serviceGroupId], references: [id])
  assignedAt       DateTime     @default(now())

  @@index([serviceGroupId])
  @@map("customer_group_assignments")
}
```

### Deprecated (Retain, Stop Reading)

`CustomerStaffBinding` — table and code remain but auto-assign no longer queries it. Clean up after the new system stabilizes.

## Auto-Assign Logic Changes

### Single Ticket (`autoAssignSingleTicket`)

```
autoAssignSingleTicket(ticketId, ticketNumber, ticketTitle, groupId, requestId, customerId)

1. [SERVICE-GROUP-FIRST] Look up customer's ServiceGroup via CustomerGroupAssignment
   ├─ Found:
   │  ├─ Get group.staffZammadId
   │  ├─ Staff eligible (active, has group access, not excluded, not on vacation)?
   │  │  └─ YES → assign directly, return success
   │  ├─ Staff on vacation with replacement?
   │  │  └─ Replacement eligible? → assign to replacement, return success
   │  └─ Staff unavailable → fall through to step 2
   └─ Not found → step 2

2. [NO GROUP] Route ticket to staging group (group_id = 9)
   ├─ Update ticket: group_id = 9, keep state as new
   ├─ Notify admins: "Unassigned customer ticket requires group assignment"
   └─ Return { success: false, error: "Customer not assigned to service group" }
```

Key changes vs. current:
- Replaces `findActiveBinding()` with `findCustomerServiceGroup()` query
- Removes auto-create binding on first assignment
- Unassigned customers → staging instead of load-balance

### Batch Assign (`POST /api/tickets/auto-assign`)

Same logic applied per ticket. For tickets already in staging (group_id = 9), skip — they're waiting for admin action.

### Ticket Creation (`POST /api/tickets`)

When creating a ticket:
- Look up customer's ServiceGroup
- If found: use `ServiceGroup.region` → `getGroupIdByRegion()` for `group_id`
- If not found: use `STAGING_GROUP_ID` (9)

This replaces the current `ticketData.region || user.region || 'asia-pacific'` chain.

## Admin API

### Service Group CRUD

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/service-groups` | List all groups with customer counts and staff info |
| POST | `/api/admin/service-groups` | Create group (name, region, staffZammadId) |
| PUT | `/api/admin/service-groups/[id]` | Update group (change staff, rename) |
| DELETE | `/api/admin/service-groups/[id]` | Deactivate group |

### Customer Assignment

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/service-groups/[id]/customers` | List customers in group |
| POST | `/api/admin/service-groups/[id]/customers` | Add customer(s) to group |
| DELETE | `/api/admin/service-groups/[id]/customers/[customerZammadId]` | Remove customer from group |

### Validation Rules

- **Create group**: name must be unique, region must be valid (one of 8), staffZammadId must reference an active Zammad agent
- **Add customer**: customerZammadId must exist in Zammad, customer can only belong to one group (upsert — moves if already in another group)
- **Change staff**: when updating a group's staffZammadId, verify the new staff has `group_ids` access to the group's region in Zammad. If not, auto-update via `zammadClient.updateUser()` to add the group permission.
- **Deactivate group**: only allowed if no customers are assigned (or force flag to move them to unassigned)

## Admin UI

### Navigation

Add "服务分组" entry to admin sidebar in `admin-layout.tsx`, between "Tickets" and "FAQ".

### Page: `/admin/service-groups`

**Group List View:**
- Table columns: Name, Region (localized label), Staff (name from Zammad), Customer Count, Status, Actions
- Actions: Edit (dialog), Delete (confirm dialog)
- "Create Group" button → dialog form
- Alert banner at top if there are unassigned customers (query customers with no group assignment)

**Create/Edit Group Dialog:**
- Fields: Name (text), Region (select from 8 regions), Staff (select from Zammad agents filtered by region compatibility)
- On save: POST/PUT to API

**Group Detail (expandable or click-through):**
- Customer list within the group
- "Add Customer" button → search Zammad customers by name/email, select and assign
- "Remove" action per customer (with confirmation)

## Staff group_ids Synchronization

When admin assigns a staff member to a service group whose region differs from the staff's current Zammad `group_ids`:

1. Query staff's current `group_ids` from Zammad
2. If missing the required region's group_id, merge it in: `{ ...existing, [newGroupId]: ["full"] }`
3. Call `zammadClient.updateUser(staffZammadId, { group_ids: merged })`

This ensures staff like Cody (3 regions) automatically get the right Zammad permissions.

## Migration Strategy

1. Add new Prisma models, run migration
2. Update auto-assign logic to read ServiceGroup instead of CustomerStaffBinding
3. Keep old CustomerStaffBinding table and code — just stop reading from it
4. Admin creates 13 initial service groups via UI or seed script
5. Admin assigns existing customers to groups via UI
6. After stabilization: remove old binding code and table

## Files Changed

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add ServiceGroup + CustomerGroupAssignment models |
| `prisma/migrations/` | New migration |
| `src/lib/ticket/auto-assign.ts` | Replace binding-first with service-group-first logic |
| `src/lib/ticket/customer-binding.ts` | Keep file, mark as deprecated |
| `src/app/api/tickets/auto-assign/route.ts` | Update batch assign to use service groups |
| `src/app/api/tickets/route.ts` | Update ticket creation: use ServiceGroup region or staging |
| `src/app/api/admin/service-groups/route.ts` | New: CRUD for service groups |
| `src/app/api/admin/service-groups/[id]/route.ts` | New: PUT/DELETE for single group |
| `src/app/api/admin/service-groups/[id]/customers/route.ts` | New: customer assignment |
| `src/app/api/admin/service-groups/[id]/customers/[customerId]/route.ts` | New: remove customer |
| `src/app/admin/service-groups/page.tsx` | New: admin management page |
| `src/components/layouts/admin-layout.tsx` | Add navigation entry |
| `messages/*.json` | i18n keys for service group UI |
| `__tests__/` | Tests for new service + API |
