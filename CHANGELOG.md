# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-11-14

### Fixed

#### R1: FAQ Category Filtering Parameter Compatibility
- **Files**: `src/app/api/faq/route.ts`, `src/app/api/admin/faq/route.ts`
- Fixed FAQ category filtering to support both `categoryId` (camelCase) and `category_id` (snake_case) query parameters
- Ensures backward compatibility with existing API consumers
- Resolves issue where customer/staff FAQ pages failed to filter by category

#### R2: Conversation Creation Initial Message Persistence
- **Files**: `src/app/api/conversations/route.ts`
- Fixed conversation creation to properly persist and broadcast `initial_message` from request payload
- Initial customer messages are now saved to local storage immediately
- SSE events are broadcast to update UI in real-time
- Prevents loss of the first customer question when starting a new chat

#### R3: Mark-Read Endpoint Participant Authorization
- **Files**: `src/app/api/conversations/[id]/mark-read/route.ts`
- Added participant verification to mark-read endpoint
- Only conversation participants (customer owner or assigned staff/admin) can mark conversations as read
- Non-participants receive 403 Forbidden error
- Prevents unauthorized users from resetting unread counters

#### R4: Staff Unread Count Per-User Isolation
- **Files**: `src/lib/local-conversation-storage.ts`, `src/app/api/conversations/unread-count/route.ts`
- Modified `getStaffUnreadCount()` to support per-user filtering
- Staff members now see only their assigned conversations' unread counts
- Admin users continue to see global unread counts
- Enables proper queue management and shift handoffs

#### R5: Customer Ticket Visibility Regardless of Group Reassignment
- **Files**: `src/lib/utils/region-auth.ts`
- Fixed `filterTicketsByRegion()` to preserve customer access to their tickets
- Customers now see all their tickets regardless of group_id changes
- Ticket ownership (customer_id) now takes precedence over group assignment for customer access
- Staff region filtering remains intact for security
- Resolves issue where customers lost access to tickets after agent reassignment

### Technical Details

- All fixes implement OpenSpec proposal: `update-faq-conversation-ticket-integrity`
- Changes maintain backward compatibility with existing API contracts
- No database schema changes required
- All modifications follow existing code patterns and conventions

### References

- OpenSpec Proposal: `openspec/changes/update-faq-conversation-ticket-integrity/proposal.md`
- Task List: `openspec/changes/update-faq-conversation-ticket-integrity/tasks.md`

---

## [Unreleased]

### Added
- Initial changelog file

