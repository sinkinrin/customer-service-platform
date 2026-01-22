# Documentation

> Customer Service Platform - Technical Documentation

**Chinese Index**: See [README.zh-CN.md](./README.zh-CN.md)

**Last Updated**: 2026-01-21
**Platform Version**: 2.0

---

## Quick Navigation

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System architecture, tech stack, project structure |
| [API-REFERENCE.md](./API-REFERENCE.md) | Complete API reference (69 endpoints) |
| [DATABASE.md](./DATABASE.md) | Prisma schema, models, migrations |
| [AUTHENTICATION.md](./AUTHENTICATION.md) | NextAuth.js v5, roles, middleware |
| [ZAMMAD-INTEGRATION.md](./ZAMMAD-INTEGRATION.md) | Zammad API client, webhooks, permissions |

---

## Core Documentation

### System Architecture

**[ARCHITECTURE.md](./ARCHITECTURE.md)** - Complete system overview

- Tech stack (Next.js 16, React 19, Prisma 6.19, NextAuth.js v5)
- System architecture diagram
- Project structure (69 API routes, 28 UI components)
- Data flow diagrams
- Key design decisions

### API Reference

**[API-REFERENCE.md](./API-REFERENCE.md)** - All 69 API endpoints

| Category | Endpoints | Description |
|----------|-----------|-------------|
| Tickets | 12 | Zammad ticket management |
| Notifications | 5 | In-app notification system |
| Conversations | 6 | AI chat (FastGPT) |
| FAQ | 4 | Knowledge base |
| User Profile | 4 | Account management |
| Admin | 20 | Users, FAQ, stats, settings |
| Files | 5 | Upload/download |
| Health | 3 | Service monitoring |

### Database Schema

**[DATABASE.md](./DATABASE.md)** - Prisma ORM documentation

| Model | Description |
|-------|-------------|
| FaqCategory | FAQ categories |
| FaqArticle | FAQ articles |
| FaqArticleTranslation | Multi-language content |
| FaqRating | User feedback |
| UserZammadMapping | User ID mapping |
| UploadedFile | File metadata |
| TicketRating | Ticket feedback |
| ReplyTemplate | Staff templates |
| TicketUpdate | Real-time tracking |
| Notification | In-app notifications |

### Authentication

**[AUTHENTICATION.md](./AUTHENTICATION.md)** - Auth system details

- NextAuth.js v5 configuration
- Dual authentication (Zammad + Mock)
- Role-based access control (Customer, Staff, Admin)
- JWT session structure
- Middleware protection

### Zammad Integration

**[ZAMMAD-INTEGRATION.md](./ZAMMAD-INTEGRATION.md)** - External ticketing

- ZammadClient API reference
- X-On-Behalf-Of authentication pattern
- Region to Group mapping (8 regions)
- Auto-assignment algorithm
- Webhook processing
- Permission system

---

## For Developers

### Getting Started

1. **Environment Setup**: See [CLAUDE.md](../CLAUDE.md) for quick start
2. **Architecture**: Read [ARCHITECTURE.md](./ARCHITECTURE.md) for system overview
3. **API**: Reference [API-REFERENCE.md](./API-REFERENCE.md) for endpoints

### Common Tasks

| Task | Documentation |
|------|---------------|
| Add new API endpoint | [API-REFERENCE.md](./API-REFERENCE.md) |
| Modify database schema | [DATABASE.md](./DATABASE.md) |
| Update auth logic | [AUTHENTICATION.md](./AUTHENTICATION.md) |
| Integrate with Zammad | [ZAMMAD-INTEGRATION.md](./ZAMMAD-INTEGRATION.md) |

### Test Accounts (Development)

Mock authentication is enabled by default in development (`NODE_ENV !== "production"`).
In production, mock auth is disabled by default, but can be explicitly enabled with `NEXT_PUBLIC_ENABLE_MOCK_AUTH=true`.

| Email | Password | Role |
|-------|----------|------|
| customer@test.com | password123 | Customer |
| staff@test.com | password123 | Staff |
| admin@test.com | password123 | Admin |

---

## Supplementary Documentation

| Document | Description | Status |
|----------|-------------|--------|
| [TESTING.md](./TESTING.md) | Test framework guide (Vitest, Playwright) | ✅ Current |
| [PERFORMANCE-OPTIMIZATIONS.md](./PERFORMANCE-OPTIMIZATIONS.md) | LRU cache, FAQ optimization | ✅ Current |
| [AI-CONFIGURATION-PERSISTENCE.md](./AI-CONFIGURATION-PERSISTENCE.md) | FastGPT settings persistence | ✅ Current |
| [TRANSLATION-STATUS.md](./TRANSLATION-STATUS.md) | i18n translation progress | ⚠️ Verify |
| [zammad-api-reference.md](./zammad-api-reference.md) | Zammad API endpoint comparison | ✅ Current |
| [FAQ-ARCHITECTURE-DESIGN.md](./FAQ-ARCHITECTURE-DESIGN.md) | Original FAQ design (superseded) | 📋 Historical |
| [feedback/TODO-未实现功能清单.md](./feedback/TODO-未实现功能清单.md) | TODO list with status updates | ✅ Updated |

---

## External Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [NextAuth.js v5](https://authjs.dev/)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Zammad REST API](https://docs.zammad.org/en/latest/api/)
- [FastGPT Documentation](https://doc.fastai.site/)

---

**Maintainer**: Development Team
**Last Updated**: 2026-01-21
