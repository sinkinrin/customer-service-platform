## 1. Admin FAQ categories stay canonical
- [x] 1.1 Keep `category_id` + display name in `FAQManagementPage` state and filter lists, and stop deriving IDs from strings when editing.
- [x] 1.2 Replace the hardcoded `CATEGORIES` array in `FAQFormDialog` with data fetched from `/api/faq/categories`, caching as needed so new categories appear without a refresh.

## 2. Customer conversation SSE works before transfer
- [x] 2.1 Ensure `/customer/conversations/[id]` always has an active SSE subscription (even in AI mode) and gates message handling on `conversationId` rather than `mode`.
- [x] 2.2 Add regression coverage/manual test notes proving the page flips to human mode and displays staff replies immediately after a transfer event.

## 3. Customer ticket list paginates
- [x] 3.1 Teach `/customer/my-tickets` to request additional `/api/tickets` pages while `hasMore` is true and show a "Load more" or infinite-scroll affordance.
- [x] 3.2 Update the count copy to reflect the total rows loaded and add a basic test/QA note for >50 ticket accounts.
