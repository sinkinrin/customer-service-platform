## Context

The agreed target architecture keeps Zammad tickets and articles as the external ticket system of record, but moves customer ownership truth into local Prisma models:

- `ServiceGroup`
- `CustomerGroupAssignment`

The base-region Zammad groups remain in place as routing targets and permission substrate for staff/admin users. Customer ownership no longer lives in free-text `note`.

## Goals

- Replace `note.Region` and runtime `CustomerStaffBinding` dependence with assignment-first routing
- Preserve staging as the explicit fallback for unassigned customers and unavailable owners
- Keep staff/admin visibility based on Zammad `group_ids`
- Make customer reassignment and service-group owner change propagate to non-closed tickets
- Remove welcome-flow dependence on region markers

## Non-Goals

- Reintroducing AI conversation handoff or region-based live-conversation routing
- Changing the 8 base Zammad group topology
- Adding historical audit tables in the first cutover

## Decisions

### Decision: Local assignment is the only runtime truth for customer ownership

Customer ownership SHALL be resolved from `CustomerGroupAssignment -> ServiceGroup`.

`note.Region` MAY remain as inert legacy data during transition, but SHALL NOT be used for:

- auth customer region derivation
- web ticket group selection
- email ticket routing
- direct assignment fallback logic

### Decision: Staging is the only explicit fallback

When a customer has no assignment, or the assigned service-group owner is unavailable, the ticket SHALL stay in staging for admin handling.

The system SHALL NOT invent ownership by:

- parsing `note.Region`
- load-balancing unassigned customers
- picking the smallest staff group
- auto-creating new customer bindings during runtime assignment

### Decision: Overlapping pending changes are superseded or amended here

This design supersedes or amends the following pending changes:

- `add-email-ticket-routing`
- `add-email-user-welcome-password`
- `fix-ticket-permission-and-ux-issues`

After this change, any pending requirement that still depends on note-derived customer routing truth SHALL be interpreted through this design and updated by implementation.

### Decision: Migration trusts seeded service groups, not legacy region strings as authority

Initial service groups SHALL be seeded from explicit support-staff and group definitions.

Migration MAY use legacy data as input hints, but SHALL NOT treat `CustomerStaffBinding.region` or `note.Region` as independently sufficient to create new ownership without a valid seeded service-group match.

## Migration Plan

1. Add `ServiceGroup` and `CustomerGroupAssignment`.
2. Seed initial service groups from approved support-staff/group definitions.
3. Freeze legacy ownership mutation paths.
4. Migrate valid existing customer ownership into assignments.
5. Cut over auth, ticket creation, email routing, and direct assignment to assignment-first logic.
6. Remove note-based runtime write paths from admin user management and imports.
7. Verify ticket migration, webhook behavior, and admin operational entry flow.

## Risks / Tradeoffs

- Local DB truth and Zammad ticket updates cannot be strongly transactional.
- Existing tests and docs may still encode note-based assumptions and must be updated together with runtime cutover.
- Baseline test runs in this workspace currently show an unrelated `DATABASE_URL` visibility issue in `__tests__/api/conversations-real.test.ts`; this is not part of this change but must be considered during final verification.
