# Update Support Routing and Realtime

## Summary
The current support surfaces regress in three critical flows:
1. **Admin ticket region filter** compares each ticket's group string against the localized REGIONS[i].label text, so any region whose Zammad group name differs from the bilingual label (especially the fallback regions that map to group id 1) silently filters out every ticket.
2. **Conversation updates** only notify the customer via SSE when /api/conversations/:id performs a PUT, leaving assigned staff (or other agents monitoring the queue) unaware that a conversation was closed, reopened, or reassigned.
3. **Staff ticket lists** link to /staff/tickets/{id} from TicketList, but there is no dynamic [id]/page.tsx route in src/app/staff/tickets, so staff hit a 404 whenever they try to inspect a ticket.

This change aligns the admin filter with canonical region metadata, ensures conversation "updated" events reach every participant, and delivers the missing staff ticket detail route so the list is actionable.

## Goals
- Make the admin region dropdown match tickets via group_id/RegionValue, including the regions that currently share the Users fallback group.
- Broadcast conversation updates to both the customer and the assigned/participating staff member(s) so real-time views stay in sync.
- Provide a first-class staff ticket detail page (reusing the shared TicketDetail component and article feed) that the list can navigate to without 404s.

## Non-Goals
- Replacing the existing mock auth/store implementations.
- Rebuilding the admin ticket UI beyond the filtering logic.
- Changing how customers view their own ticket detail pages.

## MODIFIED Requirements

### Requirement: Admin region filters must use canonical group data
#### Scenario: Admin switches the region dropdown to a fallback region (e.g., "Africa") in src/app/admin/tickets/page.tsx
- **GIVEN** 	icket.group contains the raw Zammad group name ("Users") while REGIONS[i].label includes localized text ("������ (Africa)") and multiple regions reuse the same fallback group id (src/lib/constants/regions.ts)
- **WHEN** the admin picks any region
- **THEN** the filter must compare by canonical RegionValue/group_id so Africa/Europe Zone 2 still surface tickets routed through the Users group, and no valid tickets disappear due to localization mismatches.

### Requirement: Conversation updates must notify staff participants
#### Scenario: Staff closes a human-mode conversation from /staff/conversations/[id]
- **GIVEN** /api/conversations/[id] calls roadcastConversationEvent(..., [updated.customer_id]) and therefore only the customer receives the conversation_updated SSE payload (src/app/api/conversations/[id]/route.ts)
- **WHEN** a conversation is updated (status changes, reassignments, etc.)
- **THEN** the SSE broadcast must target every participant (customer id plus staff_id when present, or all staff watchers for unassigned threads) so staff tabs/list views update immediately.

### Requirement: Staff ticket list links must resolve to a ticket detail page
#### Scenario: Staff clicks any card inside TicketList while signed in as ole === 'staff'
- **GIVEN** getTicketDetailPath routes staff to /staff/tickets/{ticketId} (src/components/ticket/ticket-list.tsx) but src/app/staff/tickets does not implement a [id]/page.tsx
- **WHEN** the staff user clicks a ticket
- **THEN** the application must render a staff-friendly ticket detail screen (reusing TicketDetail, article history, and reply box as needed) instead of returning 404.

## Impact
- Admin ticket operations regain working regional filters, preventing false negatives across Africa/EU2 queues.
- Staff dashboards and detail views stay in sync with conversation state changes, reducing duplicate work caused by stale UIs.
- Staff can finally inspect ticket metadata and history from their own portal without switching to the admin/customer experiences.

## Validation
- Manual/automated test covering each region filter to prove tickets mapped to REGION_GROUP_MAPPING[value] remain visible even when multiple values share the same group id.
- Test that updates triggered via /api/conversations/:id fire a conversation_updated event to both customer and staff SSE connections.
- Cypress/Playwright (or manual) test exercising the new /staff/tickets/{id} page: clicking from the list should load ticket details, render articles, and allow navigation back.
