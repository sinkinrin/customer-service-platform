# Service Group Migration Runbook

## Purpose

This runbook describes the freeze-first migration from legacy `CustomerStaffBinding` runtime ownership to `ServiceGroup + CustomerGroupAssignment`.

## Preconditions

- `ServiceGroup` rows are seeded and reviewed
- new Prisma migration is applied
- legacy runtime cutover is not yet enabled
- admin operators know that customer ownership mutations must stop during the migration window

## Freeze Step

Set the cutover guard before migration work:

```powershell
$env:SERVICE_GROUP_ASSIGNMENT_CUTOVER = "true"
```

Expected effect:

- admin binding mutation endpoints reject writes
- batch `/api/tickets/auto-assign` stops processing unassigned tickets
- runtime single-ticket auto-assign stops auto-creating new bindings

## Dry Run

Run the migration script in dry-run mode first and review the result categories:

- `mapped`
- `unassigned`
- `skipped`

Review all `skipped` rows before any write run.

## Write Run

After review, execute the script in write mode to upsert `CustomerGroupAssignment` rows only for unambiguous matches.

Rules:

- active binding may map by unique `staffZammadId`
- if a staff member owns multiple seeded groups, binding `region` may only be used as a narrowing hint
- `note.Region` alone never creates assignment
- unmatched or ambiguous records remain unassigned

## Verification

- compare migrated assignment count against expected valid bindings
- spot-check ambiguous and unassigned customers
- confirm no new legacy bindings were written during the migration window

## Rollback

- keep the cutover guard enabled
- delete or revert newly created `CustomerGroupAssignment` rows if the write run is invalid
- fix seed data or mapping ambiguity
- rerun dry run before another write run
