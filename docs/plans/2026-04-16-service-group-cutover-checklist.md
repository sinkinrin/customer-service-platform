# Service Group Cutover Checklist

## Runtime Truth

- customer login derives region from `CustomerGroupAssignment -> ServiceGroup`
- customer web ticket creation ignores `ticketData.region` and `note.Region` as routing truth
- email ticket routing ignores `note.Region` as routing truth
- runtime auto-assign no longer reads `CustomerStaffBinding`

## Fallback Behavior

- unassigned customers create tickets into `STAGING_GROUP_ID`
- assigned customers with unavailable owners remain in staging/admin handling
- batch auto-assign skips staging tickets
- email routing reverts to staging if owner assignment fails after regional move

## Admin Control Plane

- admin user create/update/import no longer mints customer `note.Region` as primary truth
- admin user list/detail/export display customer region from assignment where present
- customer detail page shows service-group assignment controls
- customer edit page no longer treats region as customer business-control input

## Migration

- service groups seeded
- migration dry run reviewed
- ambiguous mappings reviewed
- bulk ticket migration helpers available
- direct assign route no longer auto-moves to a staff member’s smallest group

## Regression

- customer login smoke verified
- customer ticket creation smoke verified
- webhook fan-out smoke verified
- admin user create smoke verified
