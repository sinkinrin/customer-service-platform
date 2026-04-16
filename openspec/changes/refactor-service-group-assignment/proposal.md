# Change: Refactor Service Group Assignment

## Why

The current ticket-routing and customer-ownership model splits runtime truth across incompatible sources:

- customer routing truth in Zammad `note.Region`
- default ownership truth in local `CustomerStaffBinding`
- staff/admin visibility truth in Zammad `group_ids`

This creates conflicting behavior between web ticket creation, email-created ticket routing, auth session enrichment, direct assignment, and welcome-flow detection. It also leaves multiple pending OpenSpec changes encoding note-based or region-fallback assumptions that no longer fit the agreed architecture.

## What Changes

This change replaces runtime customer ownership truth with local `ServiceGroup + CustomerGroupAssignment` while keeping the existing 8 base Zammad groups as the routing substrate.

Key changes:

- add local service-group and customer-assignment models as the only runtime truth for customer ownership
- route web ticket creation and email-created ticket processing with assignment-first logic
- keep staging as the single explicit fallback for unassigned customers or unavailable owners
- remove `note.Region` from runtime auth, ticket routing, and assignment decisions
- decouple email welcome first-time detection from `Region` note markers
- move admin operations to customer-detail-driven assignment management
- migrate existing valid ownership data into seeded service groups and mark the rest unassigned

## Overlap Resolution

This change explicitly resolves overlapping pending changes:

- `add-email-ticket-routing`: superseded for routing truth and owner resolution semantics; staging-group and admin-notification behavior are retained but routing source changes from `note.Region` to `CustomerGroupAssignment -> ServiceGroup`
- `add-email-user-welcome-password`: amended so first-time email-user detection no longer depends on missing `Region` in `note`
- `fix-ticket-permission-and-ux-issues`: amended where ticket creation, unrouted-ticket visibility, and unknown-region boundaries still assume customer region is derived from note-based routing truth

The repository SHALL not treat the older note-based semantics as authoritative after this change is implemented.

## Impact

- Affected specs:
  - `service-group-assignment` (new)
  - `ticket-routing` (modified)
  - `email-user-welcome` (modified)
  - `ticket-permission` (modified)
- Affected code:
  - `prisma/schema.prisma`
  - `src/auth.ts`
  - `src/app/api/tickets/route.ts`
  - `src/lib/ticket/email-ticket-routing.ts`
  - `src/lib/ticket/auto-assign.ts`
  - `src/lib/ticket/email-user-welcome.ts`
  - `src/app/api/tickets/[id]/assign/route.ts`
  - `src/app/api/admin/users*`
  - legacy customer-binding admin APIs
