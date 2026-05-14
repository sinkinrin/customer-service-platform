# Change: Add Staff AI Assistant Entry

## Why
Staff currently have ticket, customer, QA, and settings navigation, but no direct personal AI assistant entry. Customer AI conversations already support fast draft entry and per-user history, so staff should get the same assistant without adding a heavier first-load path.

## What Changes
- Add a staff sidebar entry for AI Assistant.
- Add `/staff/conversations` and `/staff/conversations/[id]` routes that reuse the existing AI conversation APIs and UI behavior.
- Keep staff assistant entry fast by redirecting to the draft conversation route without preloading history.
- Keep ticket realtime and notification polling disabled on staff AI assistant pages when those providers are route-scoped.

## Impact
- Affected specs: `ai-conversation-history`
- Affected code:
  - `src/components/layouts/staff-layout.tsx`
  - `src/app/staff/conversations/page.tsx`
  - `src/app/staff/conversations/[id]/page.tsx`
  - shared AI conversation page logic/components as needed
  - staff navigation translations in `messages/*`
