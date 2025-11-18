## 1. Secure switch-to-ai
- [x] 1.1 Gate `POST /api/conversations/[id]/switch-to-ai` behind `requireAuth` + participant/role checks that mirror the transfer endpoint.
- [x] 1.2 Return 401/403 on unauthorized requests and add tests covering customer/staff/admin behaviors.

## 2. Fix unread-count broadcasts
- [x] 2.1 Update `mark-read` to call `getStaffUnreadCount(user.id)` for staff and keep admin global support.
- [ ] 2.2 Exercise SSE/unit tests to verify staff see their own unread totals after clearing conversations.

## 3. Stabilize customer auto-redirect
- [x] 3.1 Add an explicit "conversations loaded" flag (or `conversations.length` check) so the effect waits for `fetchConversations()` before creating a new thread.
- [ ] 3.2 Add regression coverage ensuring existing active conversations are reused and no duplicate conversations are created during navigation.
