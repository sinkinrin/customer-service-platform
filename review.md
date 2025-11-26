## Review of commit 1cfea5a6e282da9c5fca3158142dafbc9da17a36

### Findings
- [Medium] `src/app/api/tickets/[id]/route.ts:197,339` and `src/app/api/tickets/[id]/articles/route.ts:84,173` call `ticketCustomer.email.toLowerCase()` without guarding against missing email. If Zammad returns a customer without an email (or `email` is undefined/null), these comparisons will throw and turn otherwise handled cases into 500s. Consider null‑checking before `.toLowerCase()` and returning 404/403 accordingly.

### Notes
- Other changes (FAQ findFirst swap, ticket access checks, AI history order) look reasonable and align with described intent.
