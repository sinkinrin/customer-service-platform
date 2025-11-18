## 1. FAQ Filtering Fix
- [ ] 1.1 Update `/api/faq` (and admin variant if reused) to normalize `categoryId`/`category_id` query params.
- [ ] 1.2 Add tests covering both parameter names to prevent regressions.
- [ ] 1.3 Verify customer/staff FAQ hooks receive filtered results without code changes.

## 2. Conversation Creation & Permissions
- [ ] 2.1 Persist `initial_message` inside `POST /api/conversations` (reuse existing validation + message creation helpers).
- [ ] 2.2 Emit the initial message through SSE/local storage so UI history updates immediately.
- [ ] 2.3 Lock `POST /api/conversations/:id/mark-read` behind participant/assignment checks and add tests for unauthorized access.
- [ ] 2.4 Scope `/api/conversations/unread-count` to the caller’s assigned conversations; update helper(s) plus regression tests.

## 3. Ticket Visibility
- [ ] 3.1 Adjust `filterTicketsByRegion`/`GET /api/tickets` logic to keep returning tickets owned by the requesting customer even if group_id changes.
- [ ] 3.2 Add coverage ensuring staff region filtering still works while customers always see their own tickets.

## 4. Validation & Docs
- [ ] 4.1 Extend API/Playwright suites for FAQ filtering, conversation start, unread counts, and ticket visibility.
- [ ] 4.2 Update relevant README/docs to mention the accepted FAQ query params and unread-count semantics.
