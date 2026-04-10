# Architecture Diagram

> Auto-generated: 2026-04-09

---

## 1. System Overview (C4 - Context Level)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         External Users                                  │
│                                                                         │
│   [Customer]          [Staff]            [Admin]                        │
│       │                  │                  │                            │
└───────┼──────────────────┼──────────────────┼───────────────────────────┘
        │                  │                  │
        ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│              Customer Service Platform (Next.js 16)                     │
│                                                                         │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐   │
│   │ Customer │  │  Staff   │  │  Admin   │  │    69 API Routes     │   │
│   │  Portal  │  │  Portal  │  │  Portal  │  │  (src/app/api/**)    │   │
│   └──────────┘  └──────────┘  └──────────┘  └──────────────────────┘   │
│                                                                         │
└───────┬──────────────────┬──────────────────┬───────────────────────────┘
        │                  │                  │
        ▼                  ▼                  ▼
┌──────────────┐  ┌──────────────┐   ┌──────────────────┐
│  PostgreSQL  │  │    Zammad    │   │  FastGPT / AI    │
│  (Prisma)    │  │  (Ticketing) │   │  (Optional)      │
│  Local Data  │  │  External    │   │  3 Providers     │
└──────────────┘  └──────────────┘   └──────────────────┘
```

---

## 2. Application Layer Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Next.js App Router                               │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                        Root Layout                                  │    │
│  │  SessionProvider > NextIntlClientProvider > TicketUpdatesProvider   │    │
│  │  > NotificationProvider > {children} + Toaster                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐                │
│  │   (auth)/      │  │  (customer)/   │  │   (staff)/     │                │
│  │                │  │                │  │                │                │
│  │  /auth/login   │  │  /customer/    │  │  /staff/       │                │
│  │  /auth/register│  │   dashboard    │  │   dashboard    │                │
│  │  /auth/error   │  │   my-tickets   │  │   tickets      │                │
│  │  /unauthorized │  │   conversations│  │   tickets/[id] │                │
│  │                │  │   faq          │  │   vacations    │                │
│  └────────────────┘  └────────────────┘  └────────────────┘                │
│                                                                             │
│  ┌────────────────┐  ┌─────────────────────────────────────────────────┐   │
│  │   (admin)/     │  │                  api/                           │   │
│  │                │  │                                                 │   │
│  │  /admin/       │  │  /api/tickets/**      (Zammad CRUD)            │   │
│  │   dashboard    │  │  /api/conversations/** (AI chat, Prisma)       │   │
│  │   users        │  │  /api/faq/**           (FAQ, Prisma)           │   │
│  │   settings     │  │  /api/notifications/** (Notifications, Prisma) │   │
│  │   qa-reviews   │  │  /api/admin/**         (Admin ops)             │   │
│  │   faq          │  │  /api/staff/**         (Staff AI chat)         │   │
│  │                │  │  /api/webhooks/zammad   (Inbound webhook)      │   │
│  └────────────────┘  │  /api/ai/**            (AI chat + health)      │   │
│                      │  /api/health            (System health)         │   │
│                      └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Authentication & Authorization Flow

```
                    ┌──────────┐
                    │  Client  │
                    └────┬─────┘
                         │ POST /api/auth (credentials)
                         ▼
              ┌──────────────────────┐
              │  NextAuth.js v5      │
              │  (src/auth.ts)       │
              │                      │
              │  validateCredentials()│
              └──────┬───────────────┘
                     │
          ┌──────────┼──────────────┐
          ▼          ▼              ▼
   ┌─────────┐ ┌──────────┐ ┌────────────┐
   │ Zammad  │ │  Mock    │ │ Env-based  │
   │  Auth   │ │  Users   │ │ Production │
   │ (prod)  │ │  (dev)   │ │ Fallback   │
   └────┬────┘ └────┬─────┘ └─────┬──────┘
        │           │              │
        └───────────┴──────────────┘
                    │
                    ▼
         ┌──────────────────┐
         │   JWT Token      │
         │                  │
         │  { id, email,    │
         │    role, region, │
         │    zammad_id,    │
         │    group_ids }   │
         └────────┬─────────┘
                  │
    ──────────────┼───────────────────────
    Request Flow  │
                  ▼
         ┌──────────────────┐        ┌──────────────────┐
         │  middleware.ts   │◄──────►│  routes.ts       │
         │                  │        │  (Role Matrix)   │
         │  - Request ID    │        │                  │
         │  - Auth check    │        │  /admin/* → admin│
         │  - RBAC enforce  │        │  /staff/* → staff│
         │  - Public routes │        │          + admin │
         │                  │        │  /customer/* →   │
         └──────────────────┘        │    all authed    │
                                     └──────────────────┘
```

---

## 4. Data Layer: Local (Prisma) vs External (Zammad)

```
┌─────────────────────────────────────┐    ┌────────────────────────────────┐
│      PostgreSQL (Prisma ORM)        │    │       Zammad (REST API)        │
│      Local Data                     │    │       External Data            │
│                                     │    │                                │
│  ┌─────────────────────────────┐    │    │  ┌──────────────────────┐     │
│  │ FAQ System                  │    │    │  │ Tickets              │     │
│  │  - FaqCategory              │    │    │  │  - CRUD              │     │
│  │  - FaqArticle               │    │    │  │  - Search            │     │
│  │  - FaqArticleTranslation    │    │    │  │  - Articles          │     │
│  │  - FaqRating                │    │    │  │  - Attachments       │     │
│  └─────────────────────────────┘    │    │  │  - Tags              │     │
│                                     │    │  │  - SLAs              │     │
│  ┌─────────────────────────────┐    │    │  └──────────────────────┘     │
│  │ AI Conversations            │    │    │                                │
│  │  - AiConversation           │    │    │  ┌──────────────────────┐     │
│  │  - AiMessage                │    │    │  │ Users                │     │
│  │  - AiMessageRating          │    │    │  │  - Auth source       │     │
│  │  - AiQaReview               │    │    │  │  - Roles (role_ids)  │     │
│  └─────────────────────────────┘    │    │  │  - Groups            │     │
│                                     │    │  │  - Out-of-office     │     │
│  ┌─────────────────────────────┐    │    │  └──────────────────────┘     │
│  │ Real-time & Notifications   │    │    │                                │
│  │  - TicketUpdate             │    │    │  ┌──────────────────────┐     │
│  │  - Notification             │    │    │  │ Knowledge Base       │     │
│  └─────────────────────────────┘    │    │  │  - Categories        │     │
│                                     │    │  │  - Answers           │     │
│  ┌─────────────────────────────┐    │    │  │  - Search            │     │
│  │ Operational                 │    │    │  └──────────────────────┘     │
│  │  - UserZammadMapping        │    │    │                                │
│  │  - UploadedFile             │    │    │  ┌──────────────────────┐     │
│  │  - TicketRating             │    │    │  │ Triggers & Webhooks  │     │
│  │  - ReplyTemplate            │    │    │  │  - Outbound webhooks │     │
│  └─────────────────────────────┘    │    │  └──────────────────────┘     │
│                                     │    │                                │
└─────────────────────────────────────┘    └────────────────────────────────┘
```

---

## 5. Real-time Update Pipeline

```
┌──────────┐     Ticket Event      ┌──────────────────┐
│  Zammad  │ ────────────────────► │  Webhook Handler  │
│  Server  │   POST /api/webhooks  │  (route.ts)       │
└──────────┘       /zammad         └────────┬──────────┘
                                            │
                          ┌─────────────────┼──────────────────┐
                          │                 │                  │
                          ▼                 ▼                  ▼
                   ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐
                   │ Prisma      │  │ SSE Emitter  │  │ Notification     │
                   │ TicketUpdate│  │ (in-memory)  │  │ Triggers         │
                   │   .create() │  │  .broadcast()│  │  notifyReply()   │
                   └──────┬──────┘  └──────┬───────┘  │  notifyAssigned()│
                          │                │          │  notifyStatus()  │
                          │                │          └────────┬─────────┘
                          │                │                   │
                          │                ▼                   ▼
                          │    ┌────────────────────┐  ┌──────────────┐
                          │    │ SSE Stream         │  │ Notification │
                          │    │ /api/tickets/      │  │ (Prisma DB)  │
                          │    │ updates/stream     │  └──────┬───────┘
                          │    │                    │         │
                          │    │ EventSource ──────►│         │ Polling
                          │    │ ticket-update      │         │ 15s interval
                          │    └────────┬───────────┘         │
                          │             │                     │
            ┌─────────────┴─────────────┴─────────────────────┘
            │
            ▼
┌──────────────────────────────────────────────────────────────┐
│                    Client (Browser)                           │
│                                                              │
│  ┌─────────────────────────┐  ┌───────────────────────────┐ │
│  │ TicketUpdatesProvider   │  │ NotificationProvider      │ │
│  │                         │  │                           │ │
│  │  SSE (primary)          │  │  useNotifications()       │ │
│  │    useTicketSSE()       │  │  SWR + 15s polling        │ │
│  │    ↓ fallback           │  │                           │ │
│  │  Polling (backup)       │  │  NotificationCenter       │ │
│  │    useTicketUpdates()   │  │  (Bell + Dropdown)        │ │
│  │    30s interval         │  │                           │ │
│  └─────────────────────────┘  └───────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

---

## 6. AI Integration Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                       Client                                  │
│                                                              │
│  [Customer]                        [Staff]                   │
│  /customer/conversations/[id]      AI Assistant Panel        │
│       │                                 │                    │
│       │  useStreamingChat()             │  useStreamingChat()│
│       │  readAIChatResponse()           │                    │
└───────┼─────────────────────────────────┼────────────────────┘
        │                                 │
        ▼                                 ▼
  POST /api/ai/chat              POST /api/staff/ai/chat
        │                                 │
        └────────────┬────────────────────┘
                     │
                     ▼
          ┌──────────────────────┐
          │  AI Config           │
          │  readAISettings()    │
          │  (file + env vars)   │
          └──────────┬───────────┘
                     │
                     ▼
          ┌──────────────────────┐
          │  Provider Registry   │
          │  aiProviders{}       │
          │                      │
          │  ┌────────────────┐  │
          │  │   FastGPT      │  │ ◄── Primary
          │  │   Provider     │  │
          │  └────────────────┘  │
          │  ┌────────────────┐  │
          │  │ OpenAI-Compat  │  │ ◄── Alternative
          │  │   Provider     │  │
          │  └────────────────┘  │
          │  ┌────────────────┐  │
          │  │  Yuxi-Legacy   │  │ ◄── Legacy
          │  │   Provider     │  │
          │  └────────────────┘  │
          └──────────────────────┘
                     │
                     ▼
          ┌──────────────────────┐
          │  Prisma Storage      │
          │                      │
          │  AiConversation      │
          │  AiMessage           │
          │  AiMessageRating     │
          │  AiQaReview          │
          └──────────────────────┘
```

---

## 7. Client-Side State Management

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Zustand State Stores                            │
│                                                                     │
│  ┌─────────────────────┐    Synced from NextAuth session            │
│  │  useAuthStore       │◄──── SessionProvider > AuthStoreSync       │
│  │                     │                                            │
│  │  user, session,     │    ┌────────────────────────────────┐      │
│  │  userRole,          │    │  NextAuth SessionProvider      │      │
│  │  isLoading,         │    │  (server-side session inject)  │      │
│  │  isInitialized      │    │  refetchOnWindowFocus: false   │      │
│  └─────────────────────┘    └────────────────────────────────┘      │
│                                                                     │
│  ┌─────────────────────┐    persist: localStorage                   │
│  │  useConversationStore│    (conversations list only)              │
│  │                     │                                            │
│  │  conversations,     │                                            │
│  │  activeConversation,│                                            │
│  │  messages,          │                                            │
│  │  loading states     │                                            │
│  └─────────────────────┘                                            │
│                                                                     │
│  ┌─────────────────────┐    No persistence                          │
│  │  useTicketStore     │                                            │
│  │                     │                                            │
│  │  tickets,           │                                            │
│  │  selectedTicket,    │                                            │
│  │  filters            │                                            │
│  └─────────────────────┘                                            │
│                                                                     │
│  ┌─────────────────────┐    persist: localStorage                   │
│  │  useUnreadStore     │                                            │
│  │                     │                                            │
│  │  unreadTickets,     │                                            │
│  │  unreadCounts       │                                            │
│  └─────────────────────┘                                            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 8. Internationalization (i18n)

```
┌─────────────────────────────────────────────────┐
│  next-intl 4.5                                   │
│                                                  │
│  Server: getLocale() + getMessages()             │
│     │                                            │
│     ▼                                            │
│  NextIntlClientProvider (Root Layout)            │
│     │                                            │
│     ▼                                            │
│  useTranslations('namespace')                    │
│                                                  │
│  messages/                                       │
│  ├── en.json       (English)                     │
│  ├── zh-CN.json    (Simplified Chinese)          │
│  ├── fr.json       (French)                      │
│  ├── es.json       (Spanish)                     │
│  ├── ru.json       (Russian)                     │
│  └── pt.json       (Portuguese)                  │
│                                                  │
│  LanguageSelector component for runtime switch   │
└─────────────────────────────────────────────────┘
```

---

## 9. Key Library Dependencies

```
┌───────────────┬────────────────────────────────────────┐
│ Layer         │ Technology                             │
├───────────────┼────────────────────────────────────────┤
│ Framework     │ Next.js 16 (App Router), React 19      │
│ Auth          │ NextAuth.js v5 (JWT, Credentials)      │
│ Database      │ Prisma 6.19 + PostgreSQL               │
│ Styling       │ Tailwind CSS + shadcn/ui + Lucide      │
│ State         │ Zustand (with persist middleware)       │
│ Forms         │ React Hook Form + Zod validation       │
│ i18n          │ next-intl 4.5 (6 languages)            │
│ Real-time     │ SSE (EventSource) + Polling fallback   │
│ Data Fetching │ SWR (notifications), fetch (tickets)   │
│ AI            │ FastGPT / OpenAI-compat / Yuxi-Legacy  │
│ External      │ Zammad REST API (X-On-Behalf-Of)       │
│ Testing       │ Vitest (unit) + Playwright (E2E)       │
│ Logging       │ Custom logger (src/lib/utils/logger.ts)│
└───────────────┴────────────────────────────────────────┘
```

---

## 10. Request Lifecycle (Typical Ticket Operation)

```
  Browser
    │
    │  GET /staff/tickets/123
    ▼
  middleware.ts
    │  1. Generate requestId (G{group}-staff-{zammadId}-{ts}-{rand})
    │  2. Validate JWT session
    │  3. Check RBAC: /staff/* → requires staff|admin
    ▼
  src/app/staff/tickets/[id]/page.tsx   (Server Component)
    │
    │  fetch /api/tickets/123
    ▼
  src/app/api/tickets/[id]/route.ts
    │  1. requireAuth() → extract session
    │  2. zammadClient.getTicket(123, onBehalfOf)
    │  3. checkTicketPermission()
    │  4. transformTicket() → standardized format
    │  5. successResponse(ticket)
    ▼
  ZammadClient.request()
    │  1. Authorization: Token {ZAMMAD_API_TOKEN}
    │  2. X-On-Behalf-Of: {user email}
    │  3. Retry with exponential backoff (max 1)
    │  4. Timeout: 5s
    ▼
  Zammad Server (http://47.252.29.254:8080)
```
