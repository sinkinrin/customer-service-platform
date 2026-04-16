# Service Group Refactor Deployment Runbook

## Scope

This runbook describes how to deploy the `ServiceGroup + CustomerGroupAssignment` refactor safely to an environment that already has a stable version running against the same PostgreSQL and Zammad.

This runbook reflects the **implemented state** of the branch, not the earlier draft plan.

## What This Release Changes

After deployment, the application changes customer runtime truth from:

- `note.Region`
- `CustomerStaffBinding`

to:

- `ServiceGroup`
- `CustomerGroupAssignment`

The runtime behavior that changes immediately after deploy includes:

- customer login/session region resolution
- customer web ticket creation
- email ticket routing from staging
- runtime auto-assign logic
- admin user region display / update semantics
- email welcome first-time detection

## Database Changes

Applying Prisma migration `20260416061040_add_service_group_assignment` changes PostgreSQL by:

- creating enum `ServiceBaseRegion`
- creating table `service_groups`
- creating table `customer_group_assignments`
- creating indexes:
  - `service_groups_name_key`
  - `service_groups_staffZammadId_idx`
  - `service_groups_baseRegion_isActive_idx`
  - `customer_group_assignments_customerZammadId_key`
  - `customer_group_assignments_serviceGroupId_idx`
- creating foreign key:
  - `customer_group_assignments.serviceGroupId -> service_groups.id`

This migration is additive. It does **not** drop old tables such as `customer_staff_bindings`.

## Immediate Behavioral Impact After Deploy

### If the new tables are empty

If `service_groups` and `customer_group_assignments` are empty when the new app starts:

- customers log in with `region: undefined`
- customer web-created tickets go to `STAGING_GROUP_ID`
- email-created tickets stay in staging and notify admin
- runtime auto-assign does not recover ownership from legacy `CustomerStaffBinding`
- admin user pages may show no customer service-group assignment

This is operationally safe in the sense that tickets do not get silently misrouted, but it shifts work into staging/admin handling.

### If service groups exist but customers are not assigned

- fixed-owner behavior still does not apply to those customers
- customer traffic continues to fall into staging until assignments are populated

### If service groups and assignments are populated

The new intended behavior activates:

- assigned customer + available owner => direct routing / direct assignment
- unassigned customer => staging/admin handling
- assigned customer + unavailable owner => staging/admin handling

## Shared-Environment Warning

If local testing or deployment uses the **same PostgreSQL** and the **same Zammad** as the stable version:

- local UI actions can mutate live data
- deploying the new code changes runtime behavior for the live environment immediately
- there is no isolation between local test writes and production data

This applies to:

- ticket creation
- ticket assignment / unassignment
- service-group assignment
- admin user create / update / import
- email routing
- welcome-flow updates
- any Prisma write to shared PostgreSQL

## Preconditions

Before deployment:

- production PostgreSQL backup completed
- Zammad API credentials verified
- production app process manager access verified
- maintenance / low-traffic window strongly recommended
- operator understands that assignment data must be populated quickly after deploy if live customer traffic is expected

## Commands You Should Use

Use:

```powershell
npm install
npx prisma migrate deploy
npm run build
npm run start
```

Do **not** use:

```powershell
npm run db:seed
```

Reason:

- `prisma/seed.ts` is destructive for FAQ data

Also do **not** use this in production:

```powershell
npx prisma migrate dev
```

Use `npx prisma migrate deploy` only.

## Recommended Deployment Order

### Phase 1: Backup and Preconditions

1. Back up PostgreSQL.
2. Record current application version / commit.
3. Confirm `AUTH_SECRET`, `DATABASE_URL`, `ZAMMAD_URL`, and `ZAMMAD_API_TOKEN`.
4. Confirm the new branch/build artifact is the one being deployed.

### Phase 2: Schema Rollout

1. Run:

```powershell
npx prisma migrate deploy
```

2. Verify the following exist in PostgreSQL:

- `service_groups`
- `customer_group_assignments`
- enum `ServiceBaseRegion`

### Phase 3: Application Rollout

1. Deploy the new code.
2. Run:

```powershell
npm run build
npm run start
```

3. Restart the production process manager.

### Phase 4: Post-Deploy Initialization

Immediately after the new app is live:

1. Create service groups through the new admin service-group API / UI.
2. Verify each service-group owner exists and is active in Zammad.
3. Verify owner `group_ids` contains the group implied by `baseRegion`.
4. Assign customers to service groups.
5. Migrate open tickets for those customers where needed.

## Current Implementation Note About Assignment Migration

The branch contains:

- `scripts/migrate-customer-bindings-to-service-groups.ts`

This file currently provides migration helpers / logic, but it is **not** a complete operator CLI with a ready-made `main()` entrypoint.

That means:

- the logic exists
- but production execution still requires a controlled wrapper / operator invocation strategy

Practical implication:

- if you need zero-gap migration, prepare an operator procedure before production rollout
- otherwise deploy in a maintenance window and use admin APIs / UI to create service groups and assign customers immediately after deploy

## Post-Deploy Smoke Checks

Run these checks after deploy:

### Authentication

- customer login succeeds
- assigned customer session shows expected assignment-derived region behavior
- unassigned customer login still succeeds

### Ticket Creation

- assigned customer creates ticket => correct regional group / fixed owner
- unassigned customer creates ticket => staging

### Email Routing

- email-created ticket in staging routes correctly for assigned customer
- email-created ticket remains in staging for unassigned customer

### Admin

- admin user list loads
- customer detail page shows service-group assignment
- customer edit page does not treat customer region as direct business control
- service-group admin APIs load and mutate correctly

## Rollback Expectations

### Database rollback

The schema migration is additive, so the fastest rollback is usually **application rollback**, not schema rollback.

If you roll application code back to the previous stable version:

- the old app should generally tolerate the extra tables existing
- the new tables become unused by the old version

### Application rollback

Rollback app code if:

- routing behavior is unacceptable
- service-group initialization cannot be completed quickly
- staging volume spikes unexpectedly

### Data rollback

If you already wrote `service_groups` / `customer_group_assignments` data:

- rollback may require manual cleanup or controlled SQL changes
- do not delete data blindly without confirming app version and current operator intent

## Safe / Unsafe Local Testing Rules

### Safe enough

- login checks
- read-only admin pages
- read-only ticket lists

### Unsafe against shared production dependencies

- create ticket
- assign / unassign ticket
- import users
- change service-group assignment
- replay webhook events
- any write path through Prisma or Zammad

## Minimum Operator Checklist

- PostgreSQL backup complete
- `npx prisma migrate deploy` complete
- new app code deployed
- service groups created
- owner permissions synchronized in Zammad
- customer assignments populated
- smoke checks passed
- staging ticket volume monitored

## Related Files

- `prisma/migrations/20260416061040_add_service_group_assignment/migration.sql`
- `src/lib/service-groups/customer-assignment-service.ts`
- `src/lib/service-groups/ticket-migration-service.ts`
- `src/app/api/admin/service-groups/route.ts`
- `src/app/api/admin/customers/[zammadId]/service-group/route.ts`
- `docs/plans/2026-04-16-service-group-cutover-checklist.md`
