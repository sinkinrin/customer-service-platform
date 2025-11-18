# Update Ticket SSE And AI History

## Summary
Admin and staff ticket pages depend on `/api/sse/tickets`, yet nothing in the backend ever calls `broadcastEvent`, so the badge that warns about new tickets never fires. At the same time, many ticket/FAQ endpoints pass only two arguments to `errorResponse`, which means the JSON payload ends up with `error.code` set to the human message and `error.message` set to the HTTP status number, so the UI toasts literally show “400”. Finally, customer AI chats are kept only in the component’s local state (`aiMessages`). If the page reloads before escalation, the user sees an empty thread and the system loses the data needed to hand off to humans. This change formalizes fixes for those three regressions across the FAQ/Conversation/Ticket surfaces.

## Goals
- Deliver real-time ticket badges by actually emitting SSE events whenever tickets are created, updated, or deleted.
- Ensure every API that calls `errorResponse` returns a meaningful `error.code` and `error.message` pair so the UI can surface descriptive text.
- Persist AI-side conversation history server-side so customers can refresh/return to a chat (and so the transfer workflow always has the required context).

## Non-Goals
- Replacing the mock auth/session mechanism.
- Rewriting the SSE infrastructure beyond wiring the ticket publisher into existing flows.
- Adding new AI models or redesigning the escalation UI.

## MODIFIED Requirements

### R1 – Ticket SSE streams must emit events for staff/admin consoles
#### Scenario: An admin keeps `/admin/tickets` open while tickets change
- The UI stays connected to `/api/sse/tickets` (already implemented).
- Whenever a ticket is created, updated, or deleted through our APIs or webhook handlers, the backend calls `broadcastEvent` so connected staff/admin clients receive `ticket_created`, `ticket_updated`, or `ticket_deleted`.
- The UI’s “New Updates” badge flips on without refreshing, matching the behavior currently advertised in `admin/staff` ticket pages.

### R2 – API error payloads expose descriptive messages
#### Scenario: A customer hits `/api/tickets/search` without a `query`
- The server returns HTTP 400 with `error.code = 'INVALID_QUERY'` (or similar) and `error.message = 'Query parameter is required'`.
- No endpoint returns numeric values inside `error.message`; all existing `errorResponse` usages provide both the machine-readable code and the human message.
- UI toasts (Sonner) now display readable failure reasons instead of `400`.

### R3 – AI conversation history persists across reloads
#### Scenario: A customer chats with AI, refreshes, and continues later
- Each AI/user message posted via `handleAIMessage` is also written to the conversation store (`addMessage` or similar), so `/api/conversations/:id/messages` can return the full transcript even in AI mode.
- Opening `/customer/conversations/[id]` loads the stored AI history into the timeline instead of resetting to an empty view.
- When the customer transfers to a human agent, the stored history (not just the in-memory array) is available to include in the transfer note, guaranteeing no loss even if the page was reloaded beforehand.

## Impact
- **API/SSE**: `/api/tickets`, `/api/tickets/[id]`, `/api/tickets/[id]/articles`, and webhook handlers need to publish SSE events; multiple API modules must adjust `errorResponse` usage.
- **Client**: Ticket pages will finally receive live badges; AI conversation components fetch and render persisted history rather than ephemeral state.
- **Data**: Local conversation storage gains AI-mode message persistence; no schema changes required.

## Validation
- Unit/integration tests for ticket APIs assert correct `error.code/message` pairs and SSE notifications.
- Manual/automated checks show `/admin` and `/staff` ticket views light the “New Updates” badge when another client changes a ticket.
- Play through an AI conversation, refresh, confirm the transcript remains, then transfer to human and verify history arrives in the handoff message.
