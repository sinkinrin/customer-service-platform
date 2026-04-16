## 1. OpenSpec Alignment

- [ ] 1.1 Record this change as the authoritative resolution for `add-email-ticket-routing`
- [ ] 1.2 Record this change as the authoritative amendment for `add-email-user-welcome-password`
- [ ] 1.3 Record this change as the authoritative amendment for `fix-ticket-permission-and-ux-issues`

## 2. Data Model And Services

- [ ] 2.1 Add `ServiceGroup` and `CustomerGroupAssignment` Prisma models
- [ ] 2.2 Add service-group CRUD and customer-assignment data services
- [ ] 2.3 Add explicit mapping between `ServiceBaseRegion` and runtime region constants
- [ ] 2.4 Add non-destructive seeding and migration tooling

## 3. Freeze Legacy Ownership Mutation Paths

- [ ] 3.1 Disable legacy runtime auto-creation of `CustomerStaffBinding`
- [ ] 3.2 Freeze legacy customer-binding admin mutation endpoints
- [ ] 3.3 Remove note-based ownership writes from admin user update/import flows

## 4. Runtime Cutover

- [ ] 4.1 Switch web ticket creation to assignment-first group selection
- [ ] 4.2 Switch email ticket routing to assignment-first routing and staging fallback
- [ ] 4.3 Switch auth customer region derivation to service-group assignment
- [ ] 4.4 Remove direct-assign fallback that chooses a smallest staff group
- [ ] 4.5 Preserve single-ticket reassignment semantics for direct admin assignment

## 5. Admin Operations And Migration

- [ ] 5.1 Add customer-detail-first admin assignment operations
- [ ] 5.2 Add service-group management and owner validation against Zammad group permissions
- [ ] 5.3 Migrate existing valid assignments and non-closed tickets
- [ ] 5.4 Keep unmatched customers unassigned and routed to staging/admin handling

## 6. Verification And Cleanup

- [ ] 6.1 Update tests for webhook, ticket creation, auth, assignment, and migration paths
- [ ] 6.2 Update lifecycle and architecture docs to remove note-based runtime truth
- [ ] 6.3 Validate `refactor-service-group-assignment` with OpenSpec strict mode
