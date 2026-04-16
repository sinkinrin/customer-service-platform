# Documentation Archive

This directory stores docs that should no longer stay in the main `docs/` navigation.

**Archived On**: 2026-04-15

---

## Implemented Plans

These documents were archived because the described work is already reflected in the repository.

| Document | Why It Was Archived | Evidence Snapshot |
|----------|---------------------|-------------------|
| `implemented/plans/2026-01-28-yuxi-know-integration-design.md` | Customer platform and bundled `Yuxi-Know` project both contain the integration described here | `src/lib/ai/providers/openai-compat.ts`, `src/lib/ai/providers/yuxi-legacy.ts`, `Yuxi-Know/server/routers/openai_compat_router.py`, `Yuxi-Know/server/routers/api_key_router.py` |
| `implemented/plans/2026-01-28-yuxi-know-implementation.md` | Same feature set has been implemented and split across platform + `Yuxi-Know` app | `src/app/admin/settings/page.tsx`, `src/app/api/admin/settings/ai/test/route.ts`, `Yuxi-Know/web/src/components/settings/ApiKeyManagement.vue` |
| `implemented/plans/2026-01-29-multi-ai-provider-implementation.md` | Multi-provider routing is live | `src/lib/ai/providers/index.ts`, `src/lib/utils/ai-config.ts`, `src/app/api/ai/chat/route.ts` |
| `implemented/plans/2026-02-07-ai-conversation-pgsql-migration-design.md` | Conversation storage, ratings, and admin stats exist in schema, services, routes, and tests | `prisma/schema.prisma`, `src/lib/ai-conversation-service.ts`, `src/app/api/conversations/[id]/messages/[messageId]/rating/route.ts`, `src/app/api/admin/stats/ai-conversations/route.ts` |
| `implemented/superpowers/plans/2026-04-09-attachment-inline-preview.md` | Attachment preview and drag-drop upload are implemented | `src/lib/hooks/use-drag-drop.ts`, `src/components/ui/media-renderer.tsx`, `src/components/ui/image-lightbox.tsx` |
| `implemented/superpowers/plans/2026-04-10-customer-staff-binding.md` | Customer-staff binding model, routes, and tests are present | `prisma/schema.prisma`, `src/lib/ticket/customer-binding.ts`, `src/app/api/admin/customer-bindings/route.ts` |
| `implemented/superpowers/specs/2026-04-09-attachment-inline-preview-design.md` | Same feature is already live in UI and attachment routes | `src/components/ticket/article-content.tsx`, `src/components/conversation/message-list.tsx`, `src/app/api/tickets/[id]/articles/[articleId]/attachments/[attachmentId]/route.ts` |

## Historical Docs

These documents are kept only as historical context and should not be treated as current guidance.

| Document | Why It Was Archived |
|----------|---------------------|
| `historical/FAQ-ARCHITECTURE-DESIGN.md` | Superseded by the Prisma-backed FAQ system; the file already marks itself as superseded |
| `historical/KNOWLEDGE-BASE-EVALUATION.md` | Recommendation favored Zammad KB, but the repository now centers on a self-hosted FAQ/OpenSpec path |
| `historical/OPENSPEC-IMPLEMENTATION-SUMMARY.md` | One-time setup summary after OpenSpec structure was introduced |

## Active Docs Not Archived

These remain outside the archive because they are still actionable.

| Document | Status |
|----------|--------|
| `../plans/2026-04-09-email-system-design.md` | Draft, not implemented |
| `../superpowers/specs/2026-04-14-service-group-assignment-design.md` | Proposal only, no `ServiceGroup` implementation found |
| `../feedback/TODO-未实现功能清单.md` | Backlog snapshot with unresolved items |
