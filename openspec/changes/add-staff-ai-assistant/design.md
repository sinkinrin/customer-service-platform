## Context
Customer AI conversations are implemented under `/customer/conversations` with a fast entry route that redirects to a draft conversation. The API layer stores conversations by authenticated `user.id`, so staff can use the same persistence model without a new database table.

## Goals / Non-Goals
- Goal: Staff can open a personal AI assistant from the staff sidebar.
- Goal: First load stays fast and does not fetch history until the staff user opens history.
- Goal: Existing customer AI behavior is preserved.
- Non-goal: Staff viewing customer AI conversations or QA review changes.
- Non-goal: New AI provider, new schema, or new external dependency.

## Decision
Use one shared conversation detail component that accepts a portal base path, then render it from both customer and staff route trees. The staff entry route will mirror the customer entry route and redirect to `/staff/conversations/new`.

Alternatives considered:
- Duplicate the customer page under staff routes: faster to copy, but creates drift.
- Send staff to `/customer/conversations`: less code, but leaves staff outside the staff portal navigation.

## Risks / Tradeoffs
- The current customer page has customer-specific route strings and translation namespaces. The implementation must move only the route-dependent parts into props and keep text reuse small.
- Staff layout currently polls notifications directly. Staff conversation pages should avoid extra polling where the notification bell is hidden or not needed.

## Migration Plan
No data migration is required. Existing AI conversations remain scoped by user ID.
