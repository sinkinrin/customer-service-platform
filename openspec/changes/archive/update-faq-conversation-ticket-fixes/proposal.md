# Fix FAQ Category Integrity, Conversation Transfer SSE, and Ticket Pagination

## Summary
- Admin FAQ management currently rewrites the category field into display strings like `"Category 3"`, so edits or publishes often get saved under the wrong `category_id`, and the form hardcodes a short category list instead of reflecting what exists in the database.
- The customer conversation detail page only opens an SSE stream when the conversation is already in human mode, so users stuck in AI mode never receive `conversation_transferred` or human replies unless they refresh manually.
- The customer "My Tickets" page fetches a single `/api/tickets?limit=50` page and ignores the pager metadata, so anyone with more than 50 tickets loses access to the rest of their history.

## MODIFIED Requirements

### Requirement 1: Admin FAQ management preserves canonical category IDs and labels
#### Scenario:
When an admin opens `/admin/faq`, every row and the edit/create dialog must source the real `category_id` + localized name from the backend, persist those IDs in component state, and pass the untouched numeric ID back to `/api/admin/faq/articles` (instead of parsing placeholder strings). Selecting a category in the dialog should list the live category set from `/api/faq/categories`, so newly-created categories or localized labels appear instantly and no edit falls back to category `1`.

### Requirement 2: Customer conversation view listens for transfers before human mode
#### Scenario:
While a customer is still chatting with the AI on `/customer/conversations/[id]`, the page must maintain an active SSE subscription so that `conversation_transferred` and `new_message` events from `/api/sse/conversations` are received immediately, automatically switch the UI into human mode, mark the conversation as read, and render the incoming staff responses without requiring a page reload.

### Requirement 3: Customer "My Tickets" page surfaces all pages returned by the API
#### Scenario:
If `/api/tickets` responds with `hasMore=true` because the customer owns more than 50 tickets, the `/customer/my-tickets` table must offer a way (auto-load or "Load more") to request subsequent pages by incrementing `page` until all records are shown, ensuring older tickets remain discoverable and the row count in the header reflects the full dataset.
