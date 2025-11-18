## 1. Ticket SSE Publisher
- [x] 1.1 Add helper(s) that call `broadcastEvent` from ticket CRUD/search/webhook flows (`/api/tickets`, `/api/tickets/[id]`, `/api/webhooks/zammad`, etc.) when tickets are created/updated/deleted.
- [x] 1.2 Extend the SSE payload schema (`ticket_broadcaster`) to include enough fields for the admin/staff badge text (at minimum event type + ticket id/title).
- [ ] 1.3 Smoke-test `/admin/tickets` and `/staff/tickets` to confirm the "New Updates" badge toggles without a manual refresh.

## 2. Error Response Normalization
- [x] 2.1 Update every `errorResponse` invocation in ticket/FAQ APIs to pass `(code, message, details?, status?)`.
- [ ] 2.2 Add lightweight regression tests (or unit coverage) proving that invalid inputs return descriptive `error.message` values.
- [ ] 2.3 Manually trigger a few failure paths (e.g., missing ticket search query, invalid ticket id) to ensure Sonner toasts show readable text.

## 3. Persist AI Conversation History
- [x] 3.1 Enhance the AI chat handler to write both customer and AI messages into `local-conversation-storage` (or equivalent) whenever `handleAIMessage` runs.
- [x] 3.2 Load persisted AI messages when mounting `/customer/conversations/[id]`, merging them into `aiMessages` so the thread survives reloads.
- [x] 3.3 Ensure the transfer endpoint reads the persisted history (not only the client payload) when generating the handoff record; add tests covering refresh-before-transfer.
