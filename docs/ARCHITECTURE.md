# System Architecture

> Customer Service Platform - Production Architecture Documentation

**中文概览**: See [ARCHITECTURE.zh-CN.md](./ARCHITECTURE.zh-CN.md)

**Last Updated**: 2026-01-21
**Version**: 2.0

---

## Overview

The Customer Service Platform is a production-ready customer support solution built with modern web technologies. It integrates with Zammad as the external ticketing system and provides three distinct portals for different user roles.

### Key Features

- **Multi-Portal Access**: Customer, Staff, and Admin portals
- **Zammad Integration**: Complete ticketing system with X-On-Behalf-Of authentication
- **Real-time Updates**: SSE-based ticket notifications
- **Region-based Access Control**: 8 regions with dedicated Zammad groups
- **Multilingual Support**: 6 languages (en, zh-CN, fr, es, ru, pt)
- **AI Integration**: Optional FastGPT for intelligent auto-replies

---

## Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| **Framework** | Next.js (App Router) | 16.0.10 |
| **UI Library** | React | 19.0.0 |
| **Language** | TypeScript | 5.3 |
| **Authentication** | NextAuth.js | 5.0.0-beta.30 |
| **Database ORM** | Prisma | 6.19.0 |
| **Database** | SQLite (current) | - |
| **UI Components** | shadcn/ui + Tailwind CSS | 3.4 |
| **State Management** | Zustand | 5.0.8 |
| **Forms** | React Hook Form + Zod | 7.65 / 3.22 |
| **Internationalization** | next-intl | 4.5.7 |
| **Icons** | Lucide React | 0.548 |
| **Testing** | Vitest + Playwright | 4.0 / 1.57 |
| **Ticketing** | Zammad REST API | External |

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Customer Service Platform                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐               │
│   │  Customer   │   │    Staff    │   │    Admin    │               │
│   │   Portal    │   │   Portal    │   │   Portal    │               │
│   │ /customer/* │   │  /staff/*   │   │  /admin/*   │               │
│   └──────┬──────┘   └──────┬──────┘   └──────┬──────┘               │
│          │                 │                 │                       │
│          └─────────────────┼─────────────────┘                       │
│                            │                                         │
│                   ┌────────▼────────┐                                │
│                   │   Next.js API   │                                │
│                   │   Routes (69)   │                                │
│                   └────────┬────────┘                                │
│                            │                                         │
│         ┌──────────────────┼──────────────────┐                      │
│         │                  │                  │                      │
│   ┌─────▼─────┐    ┌──────▼──────┐    ┌──────▼──────┐              │
│   │  Prisma   │    │   Zammad    │    │   FastGPT   │              │
│   │ (SQLite)  │    │  REST API   │    │     API     │              │
│   └───────────┘    └─────────────┘    └─────────────┘              │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
customer-service-platform/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── (auth)/                   # Auth pages (login, signup, error)
│   │   ├── (customer)/               # Customer portal routes
│   │   │   ├── dashboard/            # Customer dashboard
│   │   │   ├── faq/                  # Self-service FAQ
│   │   │   ├── conversations/        # AI chat
│   │   │   └── my-tickets/           # Ticket management
│   │   ├── (staff)/                  # Staff portal routes
│   │   │   ├── dashboard/            # Staff dashboard
│   │   │   └── tickets/              # Ticket handling
│   │   ├── (admin)/                  # Admin panel routes
│   │   │   ├── dashboard/            # Admin dashboard
│   │   │   ├── users/                # User management
│   │   │   ├── faq/                  # FAQ management
│   │   │   └── settings/             # System settings
│   │   └── api/                      # API Routes (69 endpoints)
│   │       ├── auth/                 # NextAuth endpoints
│   │       ├── tickets/              # Ticket management
│   │       ├── conversations/        # AI conversations
│   │       ├── notifications/        # In-app notifications
│   │       ├── admin/                # Admin operations
│   │       ├── faq/                  # FAQ endpoints
│   │       ├── user/                 # User profile
│   │       └── webhooks/             # Zammad webhooks
│   │
│   ├── auth.ts                       # NextAuth.js v5 configuration
│   ├── middleware.ts                 # Route protection middleware
│   │
│   ├── components/                   # React Components
│   │   ├── ui/                       # shadcn/ui (28 components)
│   │   ├── layouts/                  # Portal layouts
│   │   ├── auth/                     # Auth components
│   │   ├── ticket/                   # Ticket components
│   │   ├── conversation/             # Chat components
│   │   ├── faq/                      # FAQ components
│   │   ├── notification/             # Notification center
│   │   └── providers/                # Context providers
│   │
│   ├── lib/                          # Utilities & Services
│   │   ├── zammad/                   # Zammad API client
│   │   │   ├── client.ts             # REST client with retry
│   │   │   ├── types.ts              # TypeScript interfaces
│   │   │   └── health-check.ts       # Health monitoring
│   │   ├── notification/             # Notification service
│   │   │   ├── service.ts            # CRUD operations
│   │   │   ├── triggers.ts           # Event triggers
│   │   │   └── types.ts              # Type definitions
│   │   ├── stores/                   # Zustand stores
│   │   │   ├── auth-store.ts         # Authentication state
│   │   │   ├── conversation-store.ts # Chat state
│   │   │   └── ticket-store.ts       # Ticket state
│   │   ├── constants/                # App constants
│   │   │   ├── regions.ts            # Region/Group mapping
│   │   │   ├── zammad-states.ts      # Ticket states
│   │   │   └── routes.ts             # Route definitions
│   │   ├── hooks/                    # Custom React hooks
│   │   ├── utils/                    # Utility functions
│   │   │   ├── auth.ts               # Auth helpers
│   │   │   ├── permission.ts         # Permission checks
│   │   │   ├── region-auth.ts        # Region access control
│   │   │   └── api-response.ts       # Response helpers
│   │   ├── prisma.ts                 # Prisma singleton
│   │   ├── mock-auth.ts              # Development auth
│   │   └── env.ts                    # Environment validation
│   │
│   └── types/                        # TypeScript definitions
│       └── api.types.ts              # API type definitions
│
├── prisma/
│   ├── schema.prisma                 # Database schema (10 models)
│   ├── migrations/                   # Migration history
│   └── seed.ts                       # Seed data
│
├── messages/                         # i18n translations
│   ├── en.json                       # English
│   ├── zh-CN.json                    # Simplified Chinese
│   ├── fr.json                       # French
│   ├── es.json                       # Spanish
│   ├── ru.json                       # Russian
│   └── pt.json                       # Portuguese
│
├── __tests__/                        # Unit tests (Vitest)
├── e2e/                              # E2E tests (Playwright)
└── docs/                             # Documentation
```

---

## Authentication Flow

The platform uses NextAuth.js v5 with a dual authentication strategy:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Authentication Flow                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│   User Login (email + password)                                  │
│         │                                                        │
│         ▼                                                        │
│   ┌─────────────────────────────────┐                           │
│   │  Strategy 1: Zammad Auth        │                           │
│   │  - Validate via Zammad API      │                           │
│   │  - Extract role from role_ids   │                           │
│   │  - Extract region from groups   │                           │
│   └────────────┬────────────────────┘                           │
│                │ Success?                                        │
│         ┌──────┴──────┐                                          │
│         │ Yes         │ No                                       │
│         ▼             ▼                                          │
│   ┌───────────┐  ┌─────────────────────────────┐                │
│   │  Return   │  │  Strategy 2: Mock Auth      │                │
│   │   User    │  │  (if ENABLE_MOCK_AUTH=true) │                │
│   └───────────┘  └──────────────┬──────────────┘                │
│                                  │                               │
│                                  ▼                               │
│                        ┌─────────────────┐                       │
│                        │  JWT Session    │                       │
│                        │  (7 days TTL)   │                       │
│                        └─────────────────┘                       │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Role-Based Access Control

| Role | Portal Access | Permissions |
|------|---------------|-------------|
| **customer** | `/customer/*` | View own tickets, create tickets, use FAQ, AI chat |
| **staff** | `/staff/*`, `/customer/*` | Handle region tickets, manage assignments |
| **admin** | `/admin/*`, `/staff/*`, `/customer/*` | Full system access, user management |

---

## Zammad Integration

The platform integrates deeply with Zammad for ticket management.

### Key Integration Points

1. **Authentication**: User credentials validated against Zammad
2. **Ticket Management**: Full CRUD via Zammad REST API
3. **User Sync**: Users created in Zammad on first ticket
4. **Webhook Events**: Real-time updates from Zammad
5. **X-On-Behalf-Of**: Admin token with user impersonation

### Region to Group Mapping

| Region | Zammad Group ID | Group Name |
|--------|-----------------|------------|
| africa | 1 | 非洲 Users |
| europe-zone-1 | 2 | 欧洲 |
| middle-east | 3 | 中东 |
| asia-pacific | 4 | 亚太 |
| cis | 5 | 独联体 |
| north-america | 6 | 北美 |
| latin-america | 7 | 拉美 |
| europe-zone-2 | 8 | 欧洲二区 |

See [ZAMMAD-INTEGRATION.md](./ZAMMAD-INTEGRATION.md) for detailed integration documentation.

---

## Data Flow

### Ticket Creation Flow

```
Customer                    Platform                      Zammad
   │                           │                            │
   │  1. Create ticket         │                            │
   │──────────────────────────>│                            │
   │                           │  2. Ensure user exists     │
   │                           │───────────────────────────>│
   │                           │                            │
   │                           │  3. Create ticket          │
   │                           │  (X-On-Behalf-Of: customer)│
   │                           │───────────────────────────>│
   │                           │                            │
   │                           │  4. Auto-assign to staff   │
   │                           │<──────────────────────────>│
   │                           │                            │
   │                           │  5. Create notification    │
   │                           │  (staff + customer)        │
   │  6. Return ticket         │                            │
   │<──────────────────────────│                            │
```

### Real-time Update Flow

```
Zammad                      Platform                      Client
   │                           │                            │
   │  1. Webhook event         │                            │
   │  (ticket update)          │                            │
   │──────────────────────────>│                            │
   │                           │  2. Store TicketUpdate     │
   │                           │  3. Create Notification    │
   │                           │  4. SSE broadcast          │
   │                           │───────────────────────────>│
   │                           │                            │
   │                           │  5. Poll notifications     │
   │                           │<──────────────────────────>│
```

---

## Key Design Decisions

### 1. JWT-only Sessions

- No database session storage
- Stateless, scalable authentication
- 7-day session TTL

### 2. Zammad as Source of Truth

- All ticket data stored in Zammad
- Platform only stores metadata (ratings, updates, notifications)
- Prisma for local-only features

### 3. Region-based Access Control

- Staff limited to their assigned region
- Tickets routed to regional Zammad groups
- Admin has global access

### 4. X-On-Behalf-Of Pattern

- Single admin API token for all operations
- Customer/staff identity preserved via header
- Simplifies permission management

### 5. SSE + Polling Hybrid

- SSE for instant ticket updates
- Polling fallback for notifications
- No WebSocket complexity

---

## Environment Configuration

### Required Variables

```env
# Authentication
AUTH_SECRET=<32+ character secret>

# Database (SQLite)
DATABASE_URL=file:./dev.db

# Zammad Integration
ZAMMAD_URL=http://your-zammad-server:8080/
ZAMMAD_API_TOKEN=<admin token with admin.user permission>
```

### Optional Variables

```env
# AI Integration
FASTGPT_API_KEY=<api key>

# Mock auth
# - Development: always enabled when NODE_ENV !== "production"
# - Production: disabled by default, can be explicitly enabled:
NEXT_PUBLIC_ENABLE_MOCK_AUTH=true

# Webhook Security
ZAMMAD_WEBHOOK_SECRET=<webhook secret>

# Logging
LOG_LEVEL=info
```

---

## Related Documentation

- [API-REFERENCE.md](./API-REFERENCE.md) - Complete API endpoint reference
- [DATABASE.md](./DATABASE.md) - Prisma schema documentation
- [AUTHENTICATION.md](./AUTHENTICATION.md) - Auth system details
- [ZAMMAD-INTEGRATION.md](./ZAMMAD-INTEGRATION.md) - Zammad integration guide
- [TESTING.md](./TESTING.md) - Testing guide
