## 1. Fix admin ticket region filter
- [x] 1.1 Change the region comparison in `src/app/admin/tickets/page.tsx` to match tickets by canonical value (`labelEn`) instead of the localized `label`. ✅ **COMPLETED** - Changed line 102 to use `ticketRegion.labelEn.toLowerCase()`
- [ ] 1.2 Add a regression test (or storybook/state test) proving that selecting "Asia-Pacific" only returns tickets whose `group` or `group_id` belongs to that region.

## 2. Preserve conversation attachments
- [x] 2.1 Update `src/lib/local-conversation-storage.ts` so `addMessage()` accepts a `message_type` argument and stores the provided type/metadata. ✅ **COMPLETED** - Updated `addMessage()` function signature and `LocalMessage` interface to support 'text' | 'image' | 'file' | 'system' | 'transfer_history'
- [x] 2.2 Adjust `/api/conversations/[id]/messages` (and any other call sites such as initial-message creation) to forward the requested message type when calling the storage helper. ✅ **COMPLETED** - Updated API route to pass `validation.data.message_type` to `addMessage()`
- [x] 2.3 Updated `src/lib/stores/conversation-store.ts` Message interface to support all message types and additional metadata fields ✅ **COMPLETED**
- [ ] 2.4 Cover the change with unit/API tests that send `image`/`file` messages and assert the stored payload retains the type and metadata rendered by `MessageList`.

## 3. Allow staff to clear unread conversations
- [x] 3.1 Relax or extend `/api/conversations/[id]/mark-read` so the first staff member to handle a human conversation is considered a participant. ✅ **COMPLETED** - Changed permission check to allow any staff/admin to mark human-mode conversations as read (lines 35-38)
- [x] 3.2 Ensure the unread-count helpers (`markConversationAsRead`, `getStaffUnreadCount`) emit counts for the exact staff ID that cleared the conversation. ✅ **ALREADY IMPLEMENTED** - The existing code already supports per-staff unread counts
- [ ] 3.3 Add end-to-end or integration coverage showing a staff user can mark a transferred conversation as read and watch their unread badge drop to zero while other staff remain unaffected.
