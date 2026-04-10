# Security Audit Report — 2026-03-31

> Full codebase security audit across 8 modules.
> - **Initial audit**: Claude Code (Opus 4.6)
> - **Adversarial validation**: Codex (GPT-5.4) — verified findings, corrected 3 errors, found 8 missed issues
>
> Severity ratings below reflect post-validation adjustments.

## Summary

| Severity | Initial | After Codex Validation |
|----------|---------|----------------------|
| CRITICAL | 1 | **0** (C1 downgraded to HIGH) |
| HIGH | 9 | **8** (3 downgraded, +2 new) |
| MEDIUM | 13 | **15** (3 promoted from HIGH, -2 invalid, +4 new) |
| LOW | 15 | **17** (+2 new) |

**Test Status**: 821 unit tests passing, i18n 6 languages fully aligned (1587 keys).

### Codex Validation Notes
- 22/38 findings confirmed as-is
- 3 findings invalid or inaccurate (M5, M12, H5 description)
- 4 findings downgraded (C1, H5, H7, H9)
- 8 new findings discovered by Codex validation

---

## CRITICAL (0)

> C1 was downgraded to HIGH after Codex validation — the manual role check at line 27 prevents actual exploitation.

---

## HIGH (8)

### H1. Ticket Reopen Ownership Bypass — `tickets/[id]/reopen/route.ts:53-61`

When a customer has no `zammad_id` (undefined), the condition `if (userZammadId && ...)` evaluates to false, skipping the ownership check entirely. Any customer without a zammad_id can reopen any ticket.

**Fix**: Change to `if (!userZammadId || ticket.customer_id !== userZammadId)` to hard-reject.

### H2. Mock Auth Not Blocked in Production — `lib/env.ts:122-127`

`NEXT_PUBLIC_ENABLE_MOCK_AUTH=true` in production only emits `console.warn`, not `throw`. Anyone who can set this env var gets access via `customer@test.com / password123`.

**Fix**: Throw an error or at minimum use `logger.error` and report to monitoring.

### H3. Webhook Signature Verification Optional — `webhooks/zammad/route.ts:92-100`

When `ZAMMAD_WEBHOOK_SECRET` is not configured or the signature header is missing, verification is skipped entirely. Attackers can forge webhook requests to create fake TicketUpdates, trigger notifications, and route tickets.

**Fix**: When secret is configured but signature header is absent, reject the request.

### H4. AI API Keys Stored in Plaintext — `lib/utils/ai-config.ts:42,109`

AI configuration (including API keys in cleartext) is stored in `config/ai-settings.json`. Anyone with filesystem access can read all AI provider credentials.

**Fix**: Use encrypted storage or environment variables for sensitive keys.

### ~~H5.~~ Moved to M14 (Codex downgraded)

Avatar endpoint IS authenticated by middleware. The real issue is missing ownership check — any authenticated user can access any avatar by ID enumeration. See M14.

### H6. CSV Import Formula Injection — `admin/users/import/route.ts:50-101`

CSV import has no formula injection prevention. Fields like `full_name` can contain `=1+1` which Excel will execute when the data is later exported. CSV parsing also has edge cases with quoted fields.

**Fix**: Sanitize leading `=+@-` characters from all imported fields.

### ~~H7.~~ Moved to M15 (Codex downgraded — availability, not security)

### H7. (NEW) No Rate Limiting on Login — `auth.ts` authorize callback

The entire application has zero rate limiting. Most critically, the login endpoint has no brute-force protection, no account lockout, and no CAPTCHA. Any API route can be called at unlimited frequency.

**Fix**: Add rate limiting middleware, especially on `/api/auth` and `/api/ai/chat`.

### H8. SSE No Connection Limits — `tickets/updates/stream/route.ts`

No rate limiting, no max concurrent connections, no per-user connection limit. A malicious user can open unlimited SSE connections to exhaust server memory.

**Fix**: Implement per-user and global connection limits.

### ~~H9.~~ Moved to M16 (Codex downgraded — operational, not security)

### H9. (NEW) CSV Export Formula Injection — `admin/users/export/route.ts:50-57`

The `escapeCSV()` function handles commas/quotes/newlines but does not sanitize leading `=+@-` characters. Data from Zammad (user names, ticket titles) could contain formula payloads that execute when opened in Excel.

**Fix**: Strip leading formula characters in `escapeCSV()`.

---

## MEDIUM (15)

### Module 1: Authentication & Middleware

| # | File | Issue |
|---|------|-------|
| M1 | `auth.ts:396` | `useSecureCookies: false` hardcoded — cookies lack Secure flag even on HTTPS |
| M2 | `auth.ts` + `middleware.ts` | Dual authorization logic with subtle inconsistencies |
| M3 | `middleware.ts:138` | `x-user-role` response header leaks user role to clients |
| M4 | `lib/utils/auth.ts:87` | `getUserRole()` returns "customer" instead of null for unauthenticated users |

### Module 2: Zammad Integration

| # | File | Issue |
|---|------|-------|
| ~~M5~~ | ~~`zammad/client.ts:127-131`~~ | ~~Non-5xx errors also trigger retries~~ — **INVALID** (Codex: code only retries on 5xx) |
| M6 | `ticket/auto-assign.ts:52` | `getAllTickets()` fetches all tickets for each assignment — poor performance at scale |
| M7 | `ticket/auto-assign.ts:218` | `searchUsers('*')` to find admins — inefficient, may miss paginated results |
| M8 | `zammad/client.ts:256` | `formatSearchQuery` injects user input into `title:*${input}*` without escaping |

### Module 6: Frontend

| # | File | Issue |
|---|------|-------|
| M9 | `article-content.tsx` | DOMPurify ALLOWED_TAGS includes `img` — tracking pixels from Zammad emails possible |

### Module 7: AI Integration

| # | File | Issue |
|---|------|-------|
| M10 | `api/ai/chat/route.ts` | No `requireAuth()` in handler — relies solely on middleware (no defense-in-depth) |
| M11 | `api/ai/chat/route.ts` | No rate limiting — malicious users can exhaust AI API quota/cost |

### Module 4+5: SSE & Database

| # | File | Issue |
|---|------|-------|
| ~~M12~~ | ~~`tickets/updates/stream/route.ts:72`~~ | ~~cancel() race condition~~ — **INVALID** (Codex: interval self-terminates when isConnected=false) |
| M12 | `sse/emitter.ts:23` | Subscriber Map can retain orphaned connections after network partitions |
| M13 | `admin/users/[id]/role/route.ts:26` | (Was C1) Uses `requireAuth()` not `requireRole(['admin'])` — inconsistent with other admin routes |
| M14 | `avatars/[id]/route.ts` | (Was H5) No ownership check — any authenticated user can access any avatar by ID |
| M15 | `sse/emitter.ts:55-70` | (Was H7) broadcast() callbacks lack try-catch — one error breaks remaining subscribers |
| M16 | `prisma/schema.prisma:149-160` | (Was H9) TicketUpdate table no TTL/cleanup — unbounded growth |
| M17 | `admin/users/import/route.ts:130` | `Math.random()` for ID/password generation — should use `crypto.getRandomValues()` |
| M18 | `tickets/[id]/reopen/route.ts:53` | Staff can reopen any ticket with no regional restriction |
| M19 | `api/ai/chat/route.ts` | Accessible to all authenticated roles including customers — no `requireRole()` check |
| M20 | `auth.ts:385` | JWT 7-day maxAge with no rotation — stolen JWT valid for full duration, no revocation |

---

## LOW (17)

### Module 1: Authentication

- **L1** `auth.ts:224-231` — Zammad fail falls back to mock; in production with mock enabled, bypasses password policy
- **L2** `auth.ts:312-324` — JWT contains group_ids/zammad_id/phone; JWT is signed but not encrypted, client can decode
- **L3** `auth.ts:136` — Admin `group_ids = [1..8]` hardcoded; new Zammad groups won't be covered

### Module 2: Zammad

- **L4** `zammad/client.ts:47-48` — Default timeout=5s may be too aggressive for multi-page requests
- **L5** `webhooks/zammad/route.ts:138` — 5-second threshold for created-vs-reply detection; edge cases may misclassify
- **L6** `zammad/client.ts:84` — API token sent as `Token token=xxx` in cleartext (Zammad standard; requires HTTPS)

### Module 6: Frontend

- **L7** `faq/article-card.tsx:32` — `new RegExp` from user input (escaped, but extreme lengths could ReDoS)
- **L8** `language-selector.tsx:37` — `document.cookie` set without HttpOnly/Secure (locale preference only)

### Module 4+5: SSE & Database

- **L9** `tickets/updates/stream/route.ts:66` — Abort event listener never explicitly removed
- **L10** `prisma/schema.prisma` — Notification.expiresAt has no index; `cleanupExpired()` query inefficient
- **L11** Notification `cleanupExpired()` method exists but is never called; expired records persist forever
- **L12** TicketUpdate/Notification have no FK constraints; external deletes create orphaned records

### Module 8: Testing

- **L13** No unit tests for `src/lib/sse/emitter.ts` — memory leak scenarios uncovered
- **L14** No E2E tests for AI conversation flow

### Module 7: AI

- **L15** `ai-config.ts:120-135` — `updateEnvFile()` writes `.env.local` directly; fails in containerized deployments
- **L16** `webhooks/zammad/route.ts:43-51` — Webhook HMAC uses SHA-1 (Zammad dictated); modern practice recommends SHA-256
- **L17** `api/openapi.json/route.ts` — OpenAPI spec endpoint exposes full API surface for reconnaissance

---

## Positive Findings

- **i18n**: 6 languages, 1587 keys, fully aligned across all locales
- **Tests**: 69 test files, 821 tests, all passing
- **XSS Prevention**: DOMPurify correctly applied on all `dangerouslySetInnerHTML` usages
- **Input Validation**: Zod schemas on all API route request bodies
- **Permission Model**: Unified `checkTicketPermission()` function with region + ownership checks
- **Customer Isolation**: X-On-Behalf-Of + ownership verification correctly implemented
- **No dangerous patterns**: No `eval()`, raw SQL, or unprotected innerHTML in API layer

---

## Recommended Fix Priority

1. **Immediate**: H1, H2, H3 (authentication/authorization bypass)
2. **This sprint**: H4, H6, H7(new-rate-limit), H8, H9(new-csv-export) (data exposure, DoS, injection)
3. **Next sprint**: M1-M20 (hardening, performance, defense-in-depth, JWT rotation)
4. **Backlog**: L1-L17 (minor improvements, test coverage)
