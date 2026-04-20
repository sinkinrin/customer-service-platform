# Service Group Assignment Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace customer routing truth based on `note.Region` and `CustomerStaffBinding` runtime assignment with `ServiceGroup + CustomerGroupAssignment`, while keeping Zammad as the system of record for tickets and articles.

**Architecture:** The refactor keeps the existing 8 base Zammad groups as the routing substrate, but moves customer ownership truth into local Prisma models. Web ticket creation, email ticket routing, and customer session enrichment are all switched to an `assignment-first` model. Staging becomes the single explicit fallback for unassigned customers and unavailable owners. The old note-based customer region logic is removed from runtime routing, and the email welcome flow is decoupled from region detection.

**Tech Stack:** Next.js App Router, TypeScript, Prisma/PostgreSQL, Zammad API integration, Vitest/Jest-style test suite already present in `__tests__`, NextAuth session enrichment, static docs in `docs/plans`, OpenSpec change management.

---

## Task 0: Prepare OpenSpec Change, Conflict Resolution, And Planning Baseline

**Files:**
- Read: `openspec/AGENTS.md`
- Read: `openspec/project.md`
- Read: `openspec/changes/add-email-ticket-routing/**/*`
- Read: `openspec/changes/add-email-user-welcome-password/**/*`
- Read: `openspec/changes/fix-ticket-permission-and-ux-issues/**/*`
- Read: `docs/plans/2026-04-16-ticket-lifecycle-note-region-refactor-design.md`
- Create: `openspec/changes/refactor-service-group-assignment/proposal.md`
- Create: `openspec/changes/refactor-service-group-assignment/tasks.md`
- Create: `openspec/changes/refactor-service-group-assignment/design.md`
- Create: `openspec/changes/refactor-service-group-assignment/specs/...`

**Step 1: Enumerate existing OpenSpec context**

Run:

```powershell
openspec list
openspec list --specs
```

Expected:
- Existing pending changes are listed
- No conflicting change already owns the same feature area
- Any overlapping pending changes that still define `note.Region` routing or welcome-flow semantics are identified up front

**Step 2: Explicitly resolve overlapping pending changes**

Before writing the new change, the new change MUST explicitly supersede or modify the overlapping pending changes that still define old behavior.

- Record and resolve at least these overlaps:
  - `openspec/changes/add-email-ticket-routing`
  - `openspec/changes/add-email-user-welcome-password`
  - `openspec/changes/fix-ticket-permission-and-ux-issues`
- update the new proposal/design/tasks to say exactly which of the above changes are superseded or amended
- do not leave the repo with contradictory pending requirements

Expected:
- The OpenSpec surface is not left internally contradictory
- The new change text is executable, not advisory

**Step 3: Create a new OpenSpec change**

Use change id:

```text
refactor-service-group-assignment
```

Expected:
- Proposal explains removal of `note.Region` from runtime truth
- Tasks describe phased schema, migration, runtime cutover, and cleanup
- Design explains assignment-first routing and staging fallback

**Step 4: Validate the OpenSpec change**

Run:

```powershell
openspec validate refactor-service-group-assignment --strict
```

Expected:
- Validation passes with no format or scenario errors

**Step 5: Commit planning artifacts**

```powershell
git add openspec/changes/refactor-service-group-assignment
git commit -m "docs: add service group assignment refactor proposal"
```

---

## Task 1: Add Prisma Models For Service Groups And Customer Assignment

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_service_group_assignment/*`
- Test: `__tests__/` new schema-adjacent integration tests if present in repo conventions

**Step 1: Write the failing migration/schema test or validation step**

Because this repo does not currently expose a single schema unit-test harness, use migration generation / type generation as the red step.

Run:

```powershell
Get-Content prisma/schema.prisma
```

Add target models:

```prisma
enum ServiceBaseRegion {
  AFRICA
  MIDDLE_EAST
  ASIA_PACIFIC
  NORTH_AMERICA
  LATIN_AMERICA
  EUROPE_ZONE_1
  EUROPE_ZONE_2
  CIS
}

model ServiceGroup {
  id            Int      @id @default(autoincrement())
  name          String   @unique
  baseRegion    ServiceBaseRegion
  staffZammadId Int
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  assignments CustomerGroupAssignment[]

  @@index([staffZammadId])
  @@index([baseRegion, isActive])
  @@map("service_groups")
}

model CustomerGroupAssignment {
  id               Int          @id @default(autoincrement())
  customerZammadId Int          @unique
  serviceGroupId   Int
  assignedAt       DateTime     @default(now())
  updatedAt        DateTime     @updatedAt
  assignedBy       String?

  serviceGroup ServiceGroup @relation(fields: [serviceGroupId], references: [id], onDelete: Restrict)

  @@index([serviceGroupId])
  @@map("customer_group_assignments")
}
```

Add an explicit mapper in the service layer between `ServiceBaseRegion` and the existing runtime `RegionValue` strings used by `src/lib/constants/regions.ts`.

**Step 2: Run schema validation to verify the old schema no longer matches required target**

Run:

```powershell
npx prisma validate
```

Expected:
- Initially fails until model syntax and relations are correct

**Step 3: Write the minimal schema changes**

Implement only the enum + two models + indexes above. Do not add history tables yet.

**Step 4: Run Prisma validation and create migration**

Run:

```powershell
npx prisma validate
npx prisma migrate dev --name add_service_group_assignment
```

Expected:
- Prisma schema validates
- Migration is generated successfully

**Step 5: Commit**

```powershell
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add service group assignment models"
```

---

## Task 2: Add Service Group And Assignment Data Access Layer

**Files:**
- Create: `src/lib/service-groups/service-group-service.ts`
- Create: `src/lib/service-groups/customer-assignment-service.ts`
- Test: `__tests__/lib/service-groups/service-group-service.test.ts`
- Test: `__tests__/lib/service-groups/customer-assignment-service.test.ts`

**Step 1: Write the failing tests**

Add tests for:

- create/list/update/deactivate service groups
- resolve customer assignment by `customerZammadId`
- upsert assignment
- list unassigned customers helper input/output shape

Example test skeleton:

```typescript
it('returns assigned service group for customer zammad id', async () => {
  const result = await findCustomerServiceGroup(123)
  expect(result?.serviceGroup.name).toBe('亚太 1')
})
```

**Step 2: Run the tests to verify they fail**

Run:

```powershell
npm test -- __tests__/lib/service-groups/service-group-service.test.ts __tests__/lib/service-groups/customer-assignment-service.test.ts
```

Expected:
- FAIL because modules/functions do not exist yet

**Step 3: Write minimal implementation**

Implement:

- `listServiceGroups()`
- `getServiceGroup(id)`
- `createServiceGroup(input)`
- `updateServiceGroup(id, input)`
- `findCustomerServiceGroup(customerZammadId)`
- `assignCustomerToServiceGroup(customerZammadId, serviceGroupId, assignedBy?)`
- `clearCustomerAssignment(customerZammadId)`

Keep the layer thin and Prisma-only.

**Step 4: Run tests to verify pass**

Run:

```powershell
npm test -- __tests__/lib/service-groups/service-group-service.test.ts __tests__/lib/service-groups/customer-assignment-service.test.ts
```

Expected:
- PASS

**Step 5: Commit**

```powershell
git add src/lib/service-groups __tests__/lib/service-groups
git commit -m "feat: add service group data services"
```

---

## Task 3: Seed Initial Service Groups From Provided Support Roster

**Files:**
- Create: `scripts/seed-service-groups.ts`
- Create: `src/lib/service-groups/seed-service-groups.ts`
- Modify: `src/lib/zammad/client.ts` only if a safe helper is needed for owner permission sync
- Create: `docs/plans/seed-input-example-service-groups.md` (optional operator note)
- Test: `__tests__/lib/service-groups/seed-service-groups.test.ts` if seed helper extracted

**Step 1: Write the failing test for seed helper**

Test a pure helper, not Prisma directly:

```typescript
it('maps provided support roster into service group seed rows', () => {
  const rows = buildInitialServiceGroups(input)
  expect(rows).toHaveLength(5)
  expect(rows[0].name).toBe('亚太 1')
})
```

**Step 2: Run test to verify it fails**

Run:

```powershell
npm test -- __tests__/lib/service-groups/seed-service-groups.test.ts
```

Expected:
- FAIL because helper does not exist

**Step 3: Write minimal implementation**

Implement a helper that accepts the operator-provided list and produces deterministic seed rows.

Do not generate groups from legacy bindings.
Do not reuse `prisma/seed.ts` or `npm run db:seed` for this operator path, because the existing seed entrypoint is destructive outside the service-group domain.

The new seed path must be:

- non-destructive
- idempotent
- safe to re-run
- scoped only to `ServiceGroup`
- validates that each seeded `staffZammadId` has or is granted the Zammad `group_ids` permission required by the target `baseRegion`
- fails loudly if owner-permission consistency cannot be established on day one

**Step 4: Run test to verify pass**

Run:

```powershell
npm test -- __tests__/lib/service-groups/seed-service-groups.test.ts
```

Expected:
- PASS

**Step 5: Commit**

```powershell
git add scripts/seed-service-groups.ts src/lib/service-groups/seed-service-groups.ts __tests__/lib/service-groups/seed-service-groups.test.ts docs/plans/seed-input-example-service-groups.md
git commit -m "feat: add initial service group seed support"
```

---

## Task 4: Freeze Legacy Ownership Writes And Build Safe Migration Tooling

**Files:**
- Create: `scripts/migrate-customer-bindings-to-service-groups.ts`
- Create: `docs/plans/2026-04-16-service-group-migration-runbook.md`
- Modify: `src/app/api/admin/customer-bindings/route.ts`
- Modify: `src/app/api/admin/customer-bindings/transfer/route.ts`
- Modify: `src/app/api/admin/customer-bindings/[id]/route.ts`
- Modify: `src/app/api/tickets/auto-assign/route.ts`
- Modify: `src/lib/ticket/auto-assign.ts`
- Modify: `src/app/api/tickets/route.ts` only if a cutover guard/flag is needed to prevent binding writes during migration
- Modify: `src/lib/ticket/email-ticket-routing.ts` only if a cutover guard/flag is needed to prevent binding writes during migration
- Modify: `src/lib/ticket/customer-binding.ts` only if read helpers are needed
- Test: `__tests__/scripts/migrate-customer-bindings-to-service-groups.test.ts`
- Test: `__tests__/api/customer-bindings-freeze.test.ts`
- Test: `__tests__/api/tickets-auto-assign-cutover-guard.test.ts`
- Test: `__tests__/unit/auto-assign-cutover-write-freeze.test.ts`

**Step 1: Write the failing tests**

Test migration rules:

- legacy ownership freeze blocks new writes through old admin binding endpoints
- batch auto-assign no longer drains staging/unassigned tickets during the cutover window
- runtime `autoAssignSingleTicket()` no longer auto-creates new `CustomerStaffBinding` rows during the migration window
- active binding maps to a seeded group only when the mapping is unambiguous
- no valid binding => unassigned
- `note.Region` alone does not create assignment
- ambiguous mapping logs and skips

Example:

```typescript
it('does not assign customers based only on note region', async () => {
  const result = await migrateCustomer(record)
  expect(result.status).toBe('unassigned')
})
```

Also add tests for:

```typescript
it('rejects legacy admin binding writes after migration freeze is enabled', async () => {
  const response = await POST(new Request('http://localhost/api/admin/customer-bindings', { method: 'POST' }) as any)
  expect(response.status).toBeGreaterThanOrEqual(400)
})
```

**Step 2: Run tests to verify fail**

Run:

```powershell
npm test -- __tests__/scripts/migrate-customer-bindings-to-service-groups.test.ts
```

Expected:
- FAIL

**Step 3: Write minimal implementation**

Implement script behavior:

- before any migration writes, freeze or hard-deprecate legacy binding mutation endpoints so they cannot drift during cutover
- before any migration writes, prevent `/api/tickets/auto-assign` from draining staging/unassigned tickets during the cutover window
- before any migration writes, disable the runtime `findOrCreateBinding(...)` path in `autoAssignSingleTicket()` so normal web/email ticket traffic cannot keep creating fresh binding rows
- read seeded service groups
- read active `CustomerStaffBinding`
- never treat `CustomerStaffBinding.region` as authoritative
- map old binding to target service group by this order:
  - if `staffZammadId` maps to exactly one seeded service group, use it
  - always compare the candidate mapping against the customer's current non-closed ticket ownership/group footprint
  - if the current live ticket footprint contradicts the binding, mark unresolved instead of silently trusting the binding
  - if `staffZammadId` maps to multiple seeded groups, require a unique live-ticket match before migrating
  - if still ambiguous or contradictory, log unresolved and leave unassigned
- treat `note.Region` as diagnostic-only migration metadata, never as the ownership source
- create `CustomerGroupAssignment`
- write report summary:
  - migrated
  - unassigned
  - ambiguous
  - missing-group
- add dry-run mode
- add idempotency checks
- require a backup/snapshot step before live writes
- include rollback instructions in the runbook

**Step 4: Run tests to verify pass**

Run:

```powershell
npm test -- __tests__/scripts/migrate-customer-bindings-to-service-groups.test.ts
```

Expected:
- PASS

**Step 5: Commit**

```powershell
git add scripts/migrate-customer-bindings-to-service-groups.ts docs/plans/2026-04-16-service-group-migration-runbook.md src/app/api/admin/customer-bindings src/app/api/tickets/auto-assign/route.ts __tests__/scripts/migrate-customer-bindings-to-service-groups.test.ts __tests__/api/customer-bindings-freeze.test.ts __tests__/api/tickets-auto-assign-cutover-guard.test.ts
git commit -m "feat: add customer assignment migration script"
```

---

## Task 5: Switch Customer Session Enrichment From note.Region To Assignment

**Release rule:** Do not deploy this task independently. Ship it in the same runtime cutover batch as Task 6, because the current create-ticket route still derives region from session/user inputs.

**Files:**
- Modify: `src/auth.ts`
- Modify: `src/lib/utils/region-auth.ts`
- Test: `__tests__/auth/session-region-assignment.test.ts`
- Test: `__tests__/unit/region-auth.test.ts`

**Step 1: Write the failing tests**

Add tests for:

- customer with assignment derives region from `ServiceGroup.baseRegion`
- unassigned customer gets `region: undefined`
- staff/admin still derive visibility from `group_ids`
- customer-without-region legacy fallback behavior is removed or narrowed so unassigned customers do not implicitly gain broad region access

Example:

```typescript
it('derives customer region from service group assignment instead of note', async () => {
  const user = await authenticateWithZammad('customer@example.com', 'pw')
  expect(user?.region).toBe('asia-pacific')
})
```

**Step 2: Run tests to verify fail**

Run:

```powershell
npm test -- __tests__/auth/session-region-assignment.test.ts
```

Expected:
- FAIL because current auth still parses `note`

**Step 3: Write minimal implementation**

Modify customer branch in `authenticateWithZammad`:

- fetch assignment by `zammadUser.id`
- if assigned, set `region = serviceGroup.baseRegion`
- if not assigned, leave region undefined

Do not remove staff/admin `group_ids` handling.
Update `region-auth` so customer-without-region fallback semantics do not silently contradict the new “unassigned => staging/admin handling” model.
This task is only complete when the old customer-without-region implicit fallback no longer routes an unassigned customer into an arbitrary base region.

**Step 4: Run tests to verify pass**

Run:

```powershell
npm test -- __tests__/auth/session-region-assignment.test.ts
```

Expected:
- PASS

**Step 5: Commit**

```powershell
git add src/auth.ts src/lib/utils/region-auth.ts __tests__/auth/session-region-assignment.test.ts __tests__/unit/region-auth.test.ts
git commit -m "feat: derive customer session region from service group assignment"
```

---

## Task 6: Refactor Web Ticket Creation To assignment-first

**Prerequisite:** Do not start until Task 4 has frozen legacy binding writes and guarded batch auto-assign behavior.

**Files:**
- Modify: `src/app/api/tickets/route.ts`
- Modify: `src/lib/zammad/ensure-user.ts` only if helper signatures need adjustment
- Test: `__tests__/api/tickets-create-assignment-first.test.ts`

**Step 1: Write the failing tests**

Cover:

- assigned customer + available owner => create in regional group and assign fixed owner
- unassigned customer => create in staging group
- assigned customer + unavailable owner => create in staging group

Example:

```typescript
it('creates ticket in staging for unassigned customer', async () => {
  // expect group_id to be STAGING_GROUP_ID
})
```

**Step 2: Run tests to verify fail**

Run:

```powershell
npm test -- __tests__/api/tickets-create-assignment-first.test.ts
```

Expected:
- FAIL because current route still uses `ticketData.region || user.region`

**Step 3: Write minimal implementation**

Refactor `POST /api/tickets`:

- resolve customer assignment first
- if assignment exists and owner is available:
  - derive `groupId` from `serviceGroup.baseRegion`
  - create ticket in that group
  - call direct owner assignment path
- otherwise:
  - create ticket in `STAGING_GROUP_ID`
  - keep unassigned

Do not let customer-provided `region` override assignment truth.

**Step 4: Run tests to verify pass**

Run:

```powershell
npm test -- __tests__/api/tickets-create-assignment-first.test.ts
```

Expected:
- PASS

**Step 5: Commit**

```powershell
git add src/app/api/tickets/route.ts src/lib/zammad/ensure-user.ts __tests__/api/tickets-create-assignment-first.test.ts
git commit -m "feat: switch web ticket creation to assignment-first routing"
```

---

## Task 7: Refactor Email Ticket Routing To assignment-first

**Prerequisite:** Do not start until Task 4 has frozen legacy binding writes and guarded batch auto-assign behavior.

**Files:**
- Modify: `src/lib/ticket/email-ticket-routing.ts`
- Modify: `src/app/api/webhooks/zammad/route.ts`
- Test: `__tests__/unit/email-ticket-routing.test.ts`
- Test: `__tests__/api/webhooks-zammad.test.ts`

**Step 1: Write the failing tests**

Add or modify tests for:

- assigned customer + available owner => move from staging to target regional group and assign owner
- unassigned customer => keep in staging and notify admin
- unavailable owner => keep in staging and notify admin
- no parsing of `note.Region` in routing decisions

**Step 2: Run tests to verify fail**

Run:

```powershell
npm test -- __tests__/unit/email-ticket-routing.test.ts
```

Expected:
- FAIL because current implementation parses `customer.note`

**Step 3: Write minimal implementation**

Change routing source:

- from `customer.note`
- to `CustomerGroupAssignment -> ServiceGroup`

Keep staging behavior.
Also harden the real webhook entrypoint so the non-blocking orchestration path that calls email routing and welcome flow is exercised by tests, not only helper-level units.

**Step 4: Run tests to verify pass**

Run:

```powershell
npm test -- __tests__/unit/email-ticket-routing.test.ts
```

Expected:
- PASS

**Step 5: Commit**

```powershell
git add src/lib/ticket/email-ticket-routing.ts src/app/api/webhooks/zammad/route.ts __tests__/unit/email-ticket-routing.test.ts __tests__/api/webhooks-zammad.test.ts
git commit -m "feat: switch email routing to assignment-first logic"
```

---

## Task 8: Replace CustomerStaffBinding In Runtime Auto-Assign Logic

**Files:**
- Modify: `src/lib/ticket/auto-assign.ts`
- Modify: `src/app/api/tickets/auto-assign/route.ts`
- Test: `__tests__/unit/auto-assign-service-group.test.ts`
- Test: existing `__tests__/api/customer-bindings.test.ts` updated or deprecated if needed
- Test: `__tests__/api/tickets-auto-assign-cutover-guard.test.ts`

**Step 1: Write the failing tests**

Add tests for:

- no runtime read from binding for new tickets
- service-group owner available => direct assignment
- no service-group owner available => return failure for staging/admin handling
- no load-balancing fallback for the new assignment-first path

**Step 2: Run tests to verify fail**

Run:

```powershell
npm test -- __tests__/unit/auto-assign-service-group.test.ts
```

Expected:
- FAIL

**Step 3: Write minimal implementation**

Refactor auto-assign:

- remove `findActiveBinding()` as primary path
- remove auto-create binding behavior
- ensure staging/unassigned tickets are not silently redistributed by legacy batch auto-assign behavior
- only direct assign when explicit service-group owner is valid
- otherwise return failure and let caller keep ticket in staging / notify admin

Keep shared agent eligibility checks.

**Step 4: Run tests to verify pass**

Run:

```powershell
npm test -- __tests__/unit/auto-assign-service-group.test.ts
```

Expected:
- PASS

**Step 5: Commit**

```powershell
git add src/lib/ticket/auto-assign.ts src/app/api/tickets/auto-assign/route.ts __tests__/unit/auto-assign-service-group.test.ts
git commit -m "feat: remove binding-first runtime assignment"
```

---

## Task 9: Add Admin APIs For Service Groups And Customer Assignment

**Release rule:** Do not expose customer reassignment or service-group owner-change mutation endpoints to admins until Task 10 ticket-migration behavior is implemented and covered by tests. If needed, land the read surfaces first and keep mutation handlers behind a feature flag or return a temporary 503/NotReady guard.

**Files:**
- Create: `src/app/api/admin/service-groups/route.ts`
- Create: `src/app/api/admin/service-groups/[id]/route.ts`
- Create: `src/app/api/admin/service-groups/[id]/customers/route.ts`
- Create: `src/app/api/admin/customers/[zammadId]/service-group/route.ts`
- Modify: `src/app/admin/users/[id]/page.tsx`
- Modify: `src/app/admin/users/[id]/edit/page.tsx`
- Test: `__tests__/api/admin-service-groups.test.ts`
- Test: `__tests__/app/admin-user-detail-service-group.test.tsx`

**Step 1: Write the failing tests**

Cover:

- list/create/update service groups
- assign customer to group
- reassign customer to another group
- service-group owner change triggers bulk migration service call
- customer detail page becomes the first operational entry point for assignment
- edit page no longer treats customer `region` as the primary mutable business field

**Step 2: Run tests to verify fail**

Run:

```powershell
npm test -- __tests__/api/admin-service-groups.test.ts
```

Expected:
- FAIL

**Step 3: Write minimal implementation**

Add admin-only APIs backed by the new service layer.

Do not expose customer region as the business control field anymore.
Validate or synchronize Zammad `group_ids` whenever a service-group owner is created or changed so the assigned owner actually has permission for the group implied by `baseRegion`.
Update the customer detail and edit surfaces so service-group assignment is the first-class admin workflow.
Do not ship mutation endpoints that can change assignment truth until bulk ticket migration is available in the same release batch.

**Step 4: Run tests to verify pass**

Run:

```powershell
npm test -- __tests__/api/admin-service-groups.test.ts
```

Expected:
- PASS

**Step 5: Commit**

```powershell
git add src/app/api/admin/service-groups src/app/api/admin/customers src/app/admin/users/[id]/page.tsx src/app/admin/users/[id]/edit/page.tsx __tests__/api/admin-service-groups.test.ts __tests__/app/admin-user-detail-service-group.test.tsx
git commit -m "feat: add admin service group management APIs"
```

---

## Task 10: Add Bulk Ticket Migration Service

**Files:**
- Create: `src/lib/service-groups/ticket-migration-service.ts`
- Modify: `src/app/api/tickets/[id]/assign/route.ts`
- Test: `__tests__/lib/service-groups/ticket-migration-service.test.ts`
- Test: `__tests__/api/tickets-assign.test.ts`

**Step 1: Write the failing tests**

Cover:

- customer reassignment migrates all non-closed tickets
- service-group owner change migrates all non-closed tickets for all group customers
- if base region changes, group change is explicit from `ServiceGroup.baseRegion`
- no “smallest staff group” inference for service-group-driven migrations
- single-ticket reassignment still only changes that one ticket and does not mutate customer default ownership
- direct `PUT /api/tickets/[id]/assign` no longer silently moves a ticket to `staffGroupIds[0]`; any group move must be explicit and observable

**Step 2: Run tests to verify fail**

Run:

```powershell
npm test -- __tests__/lib/service-groups/ticket-migration-service.test.ts
```

Expected:
- FAIL

**Step 3: Write minimal implementation**

Implement helpers:

- `migrateCustomerOpenTicketsToGroup(customerZammadId, targetGroupId, targetOwnerId)`
- `migrateServiceGroupOpenTickets(groupId, targetOwnerId)`

Use Zammad ticket search by customer id and non-closed states.
Preserve the single-ticket admin assign route as a separate path with explicit tests proving it does not mutate `CustomerGroupAssignment`.
Remove or hard-fail the legacy “smallest staff group” fallback in the single-ticket assign route so post-cutover single-ticket moves cannot violate the service-group/base-region model.

**Step 4: Run tests to verify pass**

Run:

```powershell
npm test -- __tests__/lib/service-groups/ticket-migration-service.test.ts
```

Expected:
- PASS

**Step 5: Commit**

```powershell
git add src/lib/service-groups/ticket-migration-service.ts src/app/api/tickets/[id]/assign/route.ts __tests__/lib/service-groups/ticket-migration-service.test.ts __tests__/api/tickets-assign.test.ts
git commit -m "feat: add bulk ticket migration service"
```

---

## Task 11: Decouple Email Welcome Flow From note.Region

**Files:**
- Modify: `src/lib/ticket/email-user-welcome.ts`
- Create: `src/lib/ticket/email-user-welcome-state.ts` or equivalent helper
- Optional schema addition later: a dedicated local email welcome state table if needed
- Test: `__tests__/unit/email-user-welcome.test.ts`

**Step 1: Write the failing tests**

Change tests to reflect new rule:

- first-time email user detection must not depend on `note.Region`
- welcome markers may still live in note temporarily, but routing markers do not

Example:

```typescript
it('does not use note region presence to determine first-time email user', () => {
  expect(isFirstTimeEmailUserByState(...)).toBe(true)
})
```

**Step 2: Run tests to verify fail**

Run:

```powershell
npm test -- __tests__/unit/email-user-welcome.test.ts
```

Expected:
- FAIL

**Step 3: Write minimal implementation**

Short-term acceptable implementation:

- determine first-time email user by dedicated welcome markers or other explicit state
- stop treating “no Region in note” as the trigger

Long-term optional follow-up:

- move welcome state entirely to local DB

**Step 4: Run tests to verify pass**

Run:

```powershell
npm test -- __tests__/unit/email-user-welcome.test.ts
```

Expected:
- PASS

**Step 5: Commit**

```powershell
git add src/lib/ticket/email-user-welcome.ts src/lib/ticket/email-user-welcome-state.ts __tests__/unit/email-user-welcome.test.ts
git commit -m "fix: decouple email welcome flow from note region"
```

---

## Task 12: Remove Customer Region As Primary Admin Business Control

**Release rule:** This task is a hard prerequisite for any production cutover of Tasks 5-8. Do not let admin create/import/update paths continue minting fresh `note.Region` truth once assignment-first runtime behavior is enabled.

**Files:**
- Modify: `src/app/api/admin/users/route.ts`
- Modify: `src/app/api/admin/users/[id]/route.ts`
- Modify: `src/app/api/admin/users/import/route.ts`
- Modify: `src/app/api/admin/users/export/route.ts`
- Modify: `src/app/admin/users/page.tsx`
- Test: `__tests__/api/admin-users-region-deprecation.test.ts`

**Step 1: Write the failing tests**

Cover:

- customer region is no longer written to `note` as part of standard assignment flow
- admin user APIs still return displayable region, but sourced from assignment for customers
- import/export semantics updated accordingly

**Step 2: Run tests to verify fail**

Run:

```powershell
npm test -- __tests__/api/admin-users-region-deprecation.test.ts
```

Expected:
- FAIL

**Step 3: Write minimal implementation**

Refactor customer-facing region logic:

- for customers, display region from assignment if present
- do not treat `region` as the primary mutable business field
- leave staff/admin group-based region behavior intact
- this task is mandatory before or in the same release batch as the runtime cutover, because current admin create/import/update paths definitely still mint fresh `note.Region`-based truth
- remove the conditional language entirely during execution: treat this as part of the cutover batch, not optional cleanup

**Step 4: Run tests to verify pass**

Run:

```powershell
npm test -- __tests__/api/admin-users-region-deprecation.test.ts
```

Expected:
- PASS

**Step 5: Commit**

```powershell
git add src/app/api/admin/users src/app/api/admin/users/import/route.ts src/app/api/admin/users/export/route.ts src/app/admin/users/page.tsx __tests__/api/admin-users-region-deprecation.test.ts
git commit -m "refactor: remove customer region as primary admin control"
```

---

## Task 13: Add Cutover Verification And Regression Coverage

**Files:**
- Modify/Create: `__tests__/integration/service-group-cutover.test.ts`
- Modify/Create: `docs/plans/2026-04-16-service-group-cutover-checklist.md`

**Step 1: Write the failing integration tests**

Cover the whole expected lifecycle:

- customer login derives assignment-based region
- web ticket creation routes correctly
- email ticket creation routes correctly from staging
- real webhook entrypoint fans out correctly to email routing and welcome logic
- unassigned customer falls into staging
- group owner change migrates non-closed tickets
- conversation/article APIs remain unaffected
- single-ticket reassignment still only changes one ticket
- admin create/import/update no longer mints `note.Region` as runtime truth during cutover

**Step 2: Run tests to verify fail**

Run:

```powershell
npm test -- __tests__/integration/service-group-cutover.test.ts
```

Expected:
- FAIL until all prior tasks are complete

**Step 3: Write minimal integration harness / fixtures**

Only add what is necessary to model the end-to-end cutover behavior.

**Step 4: Run tests to verify pass**

Run:

```powershell
npm test -- __tests__/integration/service-group-cutover.test.ts
```

Expected:
- PASS

**Step 5: Commit**

```powershell
git add __tests__/integration/service-group-cutover.test.ts docs/plans/2026-04-16-service-group-cutover-checklist.md
git commit -m "test: add service group cutover regression coverage"
```

---

## Task 14: Runtime Cleanup After Verified Cutover

**Files:**
- Modify: `src/lib/ticket/customer-binding.ts`
- Modify: `src/app/api/admin/customer-bindings/route.ts`
- Modify: `src/app/api/admin/customer-bindings/transfer/route.ts`
- Modify: `src/app/api/admin/customer-bindings/[id]/route.ts`
- Modify: any runtime callers still reading customer binding
- Update docs:
  - `docs/ZAMMAD-INTEGRATION.md`
  - `docs/ZAMMAD-INTEGRATION.zh-CN.md`
  - `docs/AUTHENTICATION.md`
  - `docs/AUTHENTICATION.zh-CN.md`
  - `docs/ARCHITECTURE.zh-CN.md`
  - `docs/README.md`
  - `docs/plans/2026-04-16-ticket-lifecycle-note-region-refactor-design.md`

**Step 1: Write the failing cleanup tests or assertions**

Add checks that runtime assignment path no longer reads `CustomerStaffBinding`.

**Step 2: Run tests to verify fail**

Run:

```powershell
npm test -- related cleanup tests
```

Expected:
- FAIL until references are removed

**Step 3: Write minimal cleanup**

- demote binding code to migration/legacy-only
- remove, hard-deprecate, or compatibility-lock the old admin binding endpoints so they cannot remain a second writable ownership control plane
- update docs so they no longer describe `note.Region` as runtime truth

**Step 4: Run full targeted regression suite**

Run:

```powershell
npm test -- __tests__/scripts/migrate-customer-bindings-to-service-groups.test.ts __tests__/auth/session-region-assignment.test.ts __tests__/unit/region-auth.test.ts __tests__/api/tickets-create-assignment-first.test.ts __tests__/unit/email-ticket-routing.test.ts __tests__/api/webhooks-zammad.test.ts __tests__/unit/email-user-welcome.test.ts __tests__/api/tickets-auto-assign-cutover-guard.test.ts __tests__/unit/auto-assign-cutover-write-freeze.test.ts __tests__/api/admin-service-groups.test.ts __tests__/app/admin-user-detail-service-group.test.tsx __tests__/lib/service-groups/ticket-migration-service.test.ts __tests__/api/tickets-assign.test.ts __tests__/api/admin-users-region-deprecation.test.ts __tests__/integration/service-group-cutover.test.ts
```

Expected:
- PASS

**Step 5: Commit**

```powershell
git add src/lib/ticket/customer-binding.ts src/app/api/admin/customer-bindings docs/ZAMMAD-INTEGRATION.md docs/ZAMMAD-INTEGRATION.zh-CN.md docs/AUTHENTICATION.md docs/AUTHENTICATION.zh-CN.md docs/ARCHITECTURE.zh-CN.md docs/README.md docs/plans/2026-04-16-ticket-lifecycle-note-region-refactor-design.md
git commit -m "refactor: finalize service group assignment cutover"
```

---

## Execution Notes

- Use TDD for every behavior change.
- Prefer thin service layers and explicit migration helpers over broad refactors.
- Keep staging fallback behavior explicit and test-covered.
- Do not silently infer ownership from legacy `note.Region`.
- Do not silently infer target ticket group from “smallest staff group” in service-group-driven migrations.
- Keep the first runtime cutover conservative:
  - switch web and email routing to assignment-first
  - preserve Zammad ticket/article ownership as downstream truth
  - only remove legacy runtime binding reads after regression coverage is green

---

## Suggested Verification Commands

Run these repeatedly during execution:

```powershell
npx prisma validate
npm test -- __tests__/unit/email-ticket-routing.test.ts
npm test -- __tests__/unit/email-user-welcome.test.ts
npm test -- __tests__/api/tickets-create-assignment-first.test.ts
npm test -- __tests__/integration/service-group-cutover.test.ts
```

Use targeted runs while iterating; only batch broader verification after a task is complete.

---

Plan complete and saved to `docs/plans/2026-04-16-service-group-assignment-refactor-implementation-plan.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?
