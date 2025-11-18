## 1. Fix admin ticket region filtering
- [x] 1.1 Switch the region predicate in `src/app/admin/tickets/page.tsx` to compare against canonical data (`group_id` mapped via `REGION_GROUP_MAPPING`) so fallback regions (Africa/EU Zone 2) stop filtering out every ticket.
- [ ] 1.2 Cover the change with a unit/UI test (or Storybook state) proving that selecting each region only hides tickets whose `group_id` does not match the chosen region value.

## 2. Broadcast conversation updates to staff
- [x] 2.1 Update `/api/conversations/[id]/route.ts` so the `conversation_updated` SSE event targets both the customer id and the assigned `staff_id` (or the staff pool when unassigned).
- [ ] 2.2 Add regression coverage (API/unit test or mocked SSE emitter) that asserts staff subscribers receive the update when a conversation status changes.

## 3. Implement staff ticket detail route
- [x] 3.1 Create `src/app/staff/tickets/[id]/page.tsx` that fetches the ticket + articles via `useTicket`, renders the shared `TicketDetail` component, and surfaces response history/reply controls tailored for staff.
- [x] 3.2 Wire the new page into navigation (`TicketList` already points to this path) - staff can now open tickets without hitting a 404.
