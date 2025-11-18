# Update Conversation Security And Launch

## Summary
Staff/customer chat flows currently have regressions that expose security gaps and degrade UX across admin/staff/customer portals. The `switch-to-ai` escalation rollback endpoint does not call any auth helper, so any unauthenticated caller can flip a conversation back to AI mode. Mark-read requests broadcast global unread totals even for individual staff which makes every agent see the entire global queue. Finally, the customer-side auto-redirect at `/customer/conversations` immediately creates a fresh conversation before `fetchConversations` finishes, so users accumulate duplicate threads instead of reusing their open chat.

## Goals
- Require authentication and participant checks before switching a human conversation back to AI.
- Ensure unread count broadcasts and badges stay scoped to the staff member clearing a conversation.
- Let the auto-redirect page reuse an active conversation before calling `createConversation` so customers are not spammed with duplicates.

## Non-Goals
- Replacing mock auth with a production-ready provider.
- Redesigning the SSE stack or local storage schema beyond the fixes listed here.
- Touching ticket/FAQ flows unless needed for the issues above.

## MODIFIED Requirements

### R1 – `POST /api/conversations/:id/switch-to-ai` must enforce auth + participant checks
#### Scenario: Any browser script calls `/api/conversations/conv_123/switch-to-ai`
- **GIVEN** the current handler at `src/app/api/conversations/[id]/switch-to-ai/route.ts` never calls `requireAuth`
- **WHEN** an unauthenticated or unrelated user hits the endpoint
- **THEN** the request is rejected with 401/403 and no mode change occurs; only the customer who owns the conversation (or assigned staff/admin) can switch modes.

### R2 – Mark-read unread broadcasts must use the caller’s `staff_id`
#### Scenario: Staff A marks a conversation as read via `/api/conversations/:id/mark-read`
- **GIVEN** lines 58‑63 in `src/app/api/conversations/[id]/mark-read/route.ts` call `getStaffUnreadCount()` without a `staff_id`
- **WHEN** multiple staff clear conversations
- **THEN** each staff member should see their own unread total instead of the global count; admins can still request the aggregate elsewhere.

### R3 – `/customer/conversations` must reuse active threads before creating a new one
#### Scenario: A customer opens `/customer/conversations`
- **GIVEN** the second effect in `src/app/customer/conversations/page.tsx:21-62` runs before `fetchConversations()` populates state
- **WHEN** `conversations` is still the default empty array
- **THEN** the page waits for the fetch promise/state update (or an explicit loading flag) before calling `createConversation`, preventing duplicate conversations and honoring any existing active chat.

## Impact
- **API**: tighten `switch-to-ai` auth, adjust mark-read unread-count helper usage, and possibly extend helper utilities.
- **Client**: update the customer conversation launcher logic to wait for data before creating threads.
- **Data/SSE**: no schema changes; only leverage the existing unread-count helpers.

## Validation
- Unit/integration coverage for `switch-to-ai` (authorized vs unauthorized) and mark-read unread counts per staff.
- Customer end-to-end test ensuring `/customer/conversations` reuses an existing active conversation.
- Regression pass for staff unread badges to confirm per-user totals after mark-read.
