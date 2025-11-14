# Update FAQ/Conversation/Ticket Integrity

## Summary
The current admin, staff, and customer flows around FAQ search, live conversations, and ticket visibility have regressions that block daily use. Category filtering never works because the client sends `categoryId` while the API only reads `category_id`; new customer conversations silently drop the initial question; any authenticated user can reset another conversation's unread counters; staff dashboards show a global unread number instead of the caller's queue; and customers lose access to tickets as soon as agents move them into a regional group. This change codifies the fixes needed to make those flows reliable across all three portals.

## Goals
- Restore FAQ category filtering on customer/staff/admin pages without changing the API contract for other callers.
- Ensure a chat's first message is persisted and dispatched when a customer opens a new conversation.
- Lock down unread-count mutations to the actual participants and show per-user unread figures.
- Guarantee that customers can still see their tickets even after staff reassign them to a different Zammad group.

## Non-Goals
- Re-architecting realtime delivery beyond the fixes listed here.
- Adding new FAQ moderation tooling or ticket assignment flows unrelated to the identified regressions.

## MODIFIED Requirements

### R1 – FAQ endpoints must accept both `categoryId` camelCase and `category_id` snake_case filters
#### Scenario: A customer opens `/customer/faq/[category]` or staff uses the FAQ panel filter
- The UI issues `/api/faq?categoryId=123` and expects results scoped to that category.
- The server must treat `categoryId` and `category_id` as equivalent, parsing whichever is present before querying Prisma.
- Filtering must work for every role (customer/staff/admin) without breaking existing consumers already using `category_id`.

### R2 – Creating a conversation must store the provided `initial_message`
#### Scenario: A customer clicks “Start chat” with a drafted question
- `POST /api/conversations` receives `initial_message` plus metadata.
- The API validates the payload and immediately appends the initial message to local storage/SSE so that history shows the question and the AI can respond.
- No extra client call should be required to send the same text again.

### R3 – Only participants can clear unread counts on a conversation
#### Scenario: User A calls `POST /api/conversations/:id/mark-read`
- The API confirms User A is either the customer tied to the conversation or the assigned staff/admin (or admin overriding on behalf).
- If the user is not a participant, the API returns 404/403 and does not mutate unread counters or broadcast SSE events.
- Successful calls continue to emit per-user unread updates.

### R4 – Staff unread totals must be scoped to the caller’s queue
#### Scenario: Staff A has 2 unread human conversations, Staff B has 5
- `GET /api/conversations/unread-count` returns `2` for Staff A and `5` for Staff B instead of a shared `7`.
- The calculation must consider ownership/assignment (staff_id or another deterministic mapping) when summing `staff_unread_count`.
- Admins may continue to request a global count via a separate flag/parameter if needed, but the default endpoint must be per-user.

### R5 – Customers keep visibility into their tickets regardless of group reassignment
#### Scenario: After creating a ticket, support moves it from group_id 1 to 4
- Subsequent `GET /api/tickets` calls for the ticket owner still return that ticket.
- Region/group filters continue to protect staff-only queues, but customer access is decided by ticket ownership, not the current group.
- `/customer/my-tickets` renders the moved ticket with full detail, including its updated group/state.

## Impact
- **API**: `/api/faq`, `/api/conversations`, `/api/conversations/[id]/mark-read`, `/api/conversations/unread-count`, `/api/tickets`.
- **Client**: FAQ hooks no longer need workarounds, conversation launchers can rely on the initial message, unread badges reflect real assignments, and customer ticket pages stay consistent.
- **Data**: No schema changes; conversation storage logic and ticket filter heuristics are updated.

## Validation
- Update unit/integration tests around the touched endpoints.
- Re-run Playwright flows for admin/staff/customer FAQ filtering, conversation start, and ticket visibility to ensure parity.
