# Update Support UX Consistency

## Summary
Admin/staff/customer portals share several regressions that make the ticket and conversation workflows unreliable. The admin ticket filter compares each ticket’s `group` against `REGIONS[i].label`, which contains Chinese text (e.g. `"亚太区 (Asia-Pacific)"`). Because Zammad returns English group names (e.g. `"Asia-Pacific"`), choosing any region currently hides every ticket. Customer/staff conversations also drop every attachment because `addMessage()` always persists `message_type: 'text'`, so `MessageList` never renders images/files even though `message-input.tsx` uploads them with metadata. Finally, staff cannot clear unread counts after a human transfer: `/api/conversations/:id/mark-read` only permits `conversation.staff_id === user.id`, but no flow ever assigns `staff_id` and the schema requires UUIDs even though our mock users use IDs like `mock-staff-id`. As a result, staff unread badges remain stuck >0 forever.

## Goals
- Allow the admin ticket region filter to match the canonical group name/ID that the backend returns so region slices work again.
- Persist the real `message_type` (text/image/file/system/transfer history) and metadata inside `local-conversation-storage` so attachments show up for staff/customers.
- Let staff mark human-mode conversations as read even when they are the first agent touching the thread, by assigning/accepting ownership and clearing unread counts for that staffer only.

## Non-Goals
- Replacing the mock auth/session stack with production identity.
- Rebuilding the entire ticket filtering UI or exporting CSVs.
- Changing how AI-mode conversations behave outside of attachment persistence and unread semantics.

## MODIFIED Requirements

### R1 – Admin ticket region filter must compare against canonical values
#### Scenario: Admin switches the region dropdown to “Asia-Pacific” in `src/app/admin/tickets/page.tsx`
- **GIVEN** lines 98‑105 compare `ticket.group.toLowerCase()` to `ticketRegion.label.toLowerCase()` even though `REGIONS[i].label` contains strings such as “亚太区 (Asia-Pacific)” (`src/lib/constants/regions.ts:8-15`)
- **WHEN** a region is selected
- **THEN** the filter must use the canonical value (e.g. `region.value`, `labelEn`, or even `group_id`) so tickets whose `group` equals “Asia-Pacific” remain visible instead of being filtered out.

### R2 – Stored conversation messages must preserve `message_type`
#### Scenario: Customer uploads an image via `MessageInput` on `/customer/conversations/[id]`
- **GIVEN** `message-input.tsx` detects files and calls `onSend(content, messageType, metadata)` with `messageType` set to `image` or `file`
- **AND** `POST /api/conversations/:id/messages` forwards that request but calls `addMessage()` which hard-codes `message_type: 'text'` in `src/lib/local-conversation-storage.ts:203-221`
- **THEN** the stored message should persist the requested `message_type` (and metadata) so `MessageList` can render attachments via the logic at `src/components/conversation/message-list.tsx:86-199`.

### R3 – Staff mark-read must not require a pre-populated `staff_id`
#### Scenario: A staff user opens a freshly transferred human conversation and tries to mark it read
- **GIVEN** `/api/conversations/:id/mark-read` only allows the call when `conversation.staff_id === user.id` (`src/app/api/conversations/[id]/mark-read/route.ts:35-43`)
- **AND** neither `createAIConversation`, the transfer handler (`src/app/api/conversations/[id]/transfer/route.ts:107-111`), nor `addMessage()` ever assign `staff_id`, while the schema only accepts UUIDs even though `mock-staff-id` is not a UUID
- **WHEN** the first staff agent opens the conversation
- **THEN** the system should either claim the conversation for that staffer (populate `staff_id`/`staff_name`) or otherwise treat them as a participant so they can call `mark-read` and reset their own unread counter; the unread broadcast should remain scoped to that staff ID only.

## Impact
- **Admin UI:** Adjusts filtering logic to rely on canonical region info. No backend change required.
- **Conversations API & storage:** `addMessage()` (and any other call sites) must accept/forward `message_type` so stored history is lossless. May introduce a small data migration for future messages.
- **Conversation auth:** `mark-read`/assignment flow will auto-assign or at least relax the check so staff can clear unread counts while still preventing unrelated users from snooping.

## Validation
- Unit/UI test proving that selecting each region still shows tickets from that group while other regions stay hidden.
- API/storage tests verifying that sending `message_type = image | file` results in persisted records and UI rendering the attachment preview.
- Integration test where a staff user receives a transferred conversation, hits `mark-read`, and sees their unread badge drop to zero while other staff remain unaffected.
