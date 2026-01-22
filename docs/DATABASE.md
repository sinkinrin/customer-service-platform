# Database Schema

> Prisma ORM with SQLite (current)

**中文概览**: See [DATABASE.zh-CN.md](./DATABASE.zh-CN.md)

**Last Updated**: 2026-01-21
**Prisma Version**: 6.19.0

---

## Overview

The platform uses Prisma ORM for database operations. Ticket data is stored in Zammad (external), while Prisma handles local-only features:

- FAQ management with translations
- User ratings and feedback
- Notification system
- Reply templates
- File metadata
- Real-time update tracking

---

## Database Configuration

### SQLite (Current)

```env
DATABASE_URL=file:./dev.db
```

> Note: The current Prisma schema uses `provider = "sqlite"` (see `prisma/schema.prisma`).
> If you want to run PostgreSQL, you must update the Prisma datasource provider and generate/apply new migrations for PostgreSQL.

---

## Schema Overview

Location: `prisma/schema.prisma`

```
┌─────────────────────────────────────────────────────────────────┐
│                        Prisma Models (10)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│   FAQ System                    User Management                   │
│   ┌──────────────┐              ┌──────────────────┐            │
│   │ FaqCategory  │              │ UserZammadMapping│            │
│   │ FaqArticle   │              └──────────────────┘            │
│   │ FaqTranslation│                                              │
│   │ FaqRating    │              Feedback                        │
│   └──────────────┘              ┌──────────────────┐            │
│                                 │ TicketRating     │            │
│   Content                       └──────────────────┘            │
│   ┌──────────────┐                                               │
│   │ ReplyTemplate│              Real-time                       │
│   │ UploadedFile │              ┌──────────────────┐            │
│   └──────────────┘              │ TicketUpdate     │            │
│                                 │ Notification     │            │
│                                 └──────────────────┘            │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Models

### FaqCategory

FAQ categories for organizing knowledge base articles.

```prisma
model FaqCategory {
  id          Int      @id @default(autoincrement())
  name        String
  description String
  icon        String
  slug        String   @unique
  sortOrder   Int      @default(0)
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  articles FaqArticle[]

  @@map("faq_categories")
}
```

| Field | Type | Description |
|-------|------|-------------|
| id | Int | Primary key |
| name | String | Category name |
| description | String | Category description |
| icon | String | Icon identifier (e.g., "help-circle") |
| slug | String | URL-friendly unique identifier |
| sortOrder | Int | Display order |
| isActive | Boolean | Whether category is visible |

---

### FaqArticle

Individual FAQ articles with multi-language support.

```prisma
model FaqArticle {
  id         Int      @id @default(autoincrement())
  categoryId Int
  slug       String   @unique
  views      Int      @default(0)
  isActive   Boolean  @default(true)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  category     FaqCategory              @relation(...)
  translations FaqArticleTranslation[]
  ratings      FaqRating[]

  @@index([categoryId])
  @@map("faq_articles")
}
```

| Field | Type | Description |
|-------|------|-------------|
| id | Int | Primary key |
| categoryId | Int | Foreign key to FaqCategory |
| slug | String | URL-friendly unique identifier |
| views | Int | View count |
| isActive | Boolean | Whether article is visible |

---

### FaqArticleTranslation

Translated content for FAQ articles (6 languages supported).

```prisma
model FaqArticleTranslation {
  id        Int      @id @default(autoincrement())
  articleId Int
  locale    String   // en, zh-CN, fr, es, ru, pt
  title     String
  content   String   // Markdown content
  keywords  String   // JSON array of keywords
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  article FaqArticle @relation(...)

  @@unique([articleId, locale])
  @@index([articleId])
  @@index([locale])
  @@map("faq_article_translations")
}
```

| Field | Type | Description |
|-------|------|-------------|
| locale | String | Language code (en, zh-CN, fr, es, ru, pt) |
| title | String | Translated title |
| content | String | Markdown content |
| keywords | String | JSON array for search |

---

### FaqRating

User feedback on FAQ articles.

```prisma
model FaqRating {
  id        Int      @id @default(autoincrement())
  articleId Int
  userId    String
  isHelpful Boolean
  createdAt DateTime @default(now())

  article FaqArticle @relation(...)

  @@unique([articleId, userId])
  @@index([articleId])
  @@map("faq_ratings")
}
```

---

### UserZammadMapping

Maps local user IDs to Zammad user IDs.

```prisma
model UserZammadMapping {
  id              Int      @id @default(autoincrement())
  userId          String   @unique
  zammadUserId    Int
  zammadUserEmail String
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([userId])
  @@index([zammadUserId])
  @@map("user_zammad_mappings")
}
```

| Field | Type | Description |
|-------|------|-------------|
| userId | String | Local user ID (from NextAuth) |
| zammadUserId | Int | Zammad user ID |
| zammadUserEmail | String | User email in Zammad |

---

### UploadedFile

Metadata for uploaded files (actual files stored on disk or cloud).

```prisma
model UploadedFile {
  id            String   @id @default(uuid())
  userId        String
  bucketName    String
  filePath      String
  fileName      String
  fileSize      Int
  mimeType      String
  referenceType String
  referenceId   String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([userId])
  @@index([referenceType, referenceId])
  @@map("uploaded_files")
}
```

| Field | Type | Description |
|-------|------|-------------|
| bucketName | String | Storage bucket (avatars, attachments) |
| filePath | String | Relative path to file |
| referenceType | String | Type: message, user_profile, ticket |
| referenceId | String? | Associated entity ID |

---

### TicketRating

Customer feedback on closed tickets.

```prisma
model TicketRating {
  id        Int      @id @default(autoincrement())
  ticketId  Int      @unique
  userId    String
  rating    String   // 'positive' or 'negative'
  reason    String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([ticketId])
  @@index([userId])
  @@index([rating])
  @@map("ticket_ratings")
}
```

| Field | Type | Description |
|-------|------|-------------|
| ticketId | Int | Zammad ticket ID |
| rating | String | 'positive' or 'negative' |
| reason | String? | Optional feedback text |

---

### ReplyTemplate

Quick response templates for staff.

```prisma
model ReplyTemplate {
  id          Int      @id @default(autoincrement())
  name        String
  content     String
  category    String
  region      String?
  createdById String
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([category])
  @@index([region])
  @@index([isActive])
  @@map("reply_templates")
}
```

| Field | Type | Description |
|-------|------|-------------|
| name | String | Template name |
| content | String | Template content with variables |
| category | String | first_contact, technical, closing, etc. |
| region | String? | Optional region restriction |

---

### TicketUpdate

Real-time ticket update tracking (from Zammad webhooks).

```prisma
model TicketUpdate {
  id        String   @id @default(cuid())
  ticketId  Int
  event     String
  data      String?
  createdAt DateTime @default(now())

  @@index([ticketId])
  @@index([createdAt])
  @@map("ticket_updates")
}
```

| Field | Type | Description |
|-------|------|-------------|
| ticketId | Int | Zammad ticket ID |
| event | String | article_created, status_changed, assigned, created |
| data | String? | JSON: { articleId, newState, assignedTo, senderEmail } |

---

### Notification

Persistent in-app notifications.

```prisma
model Notification {
  id        String   @id @default(cuid())
  userId    String
  type      String
  title     String
  body      String
  data      String?
  read      Boolean  @default(false)
  readAt    DateTime?
  createdAt DateTime @default(now())
  expiresAt DateTime?

  @@index([userId, read])
  @@index([userId, createdAt])
  @@index([type])
  @@map("notifications")
}
```

| Field | Type | Description |
|-------|------|-------------|
| type | String | ticket_reply, ticket_assigned, ticket_status, system_alert, etc. |
| title | String | Short notification title |
| body | String | Notification content |
| data | String? | JSON with ticketId, articleId, etc. |
| read | Boolean | Whether user has read the notification |
| expiresAt | DateTime? | Optional expiration time |

---

## Migrations

Location: `prisma/migrations/`

### Run Migrations

```bash
# Development: apply pending migrations
npx prisma migrate dev

# Production: apply migrations without prompts
npx prisma migrate deploy

# Generate Prisma Client
npx prisma generate
```

### Migration History

| Date | Migration | Description |
|------|-----------|-------------|
| 2025-11-10 | 20251110114117_init | Initial schema (FAQ) |
| 2025-12-22 | 20251222105357_add_user_mapping_and_file_upload | User mapping + file metadata |
| 2026-01-12 | 20260112090000_add_notifications | In-app notifications |
| 2026-01-22 | 20260122015327_add_ticket_models | Ticket ratings + reply templates + ticket updates |

---

## Prisma Client Usage

### Singleton Pattern

Location: `src/lib/prisma.ts`

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

### Usage in API Routes

```typescript
import { prisma } from '@/lib/prisma'

// Get all FAQ categories
const categories = await prisma.faqCategory.findMany({
  where: { isActive: true },
  orderBy: { sortOrder: 'asc' },
  include: { articles: true }
})

// Create notification
await prisma.notification.create({
  data: {
    userId: 'user-123',
    type: 'ticket_reply',
    title: 'New reply on ticket #10001',
    body: 'Staff has replied to your ticket',
    data: JSON.stringify({ ticketId: 10001 })
  }
})
```

---

## Seeding

Location: `prisma/seed.ts`

```bash
# Run seed script
npm run db:seed
```

The seed script creates:
- FAQ categories (5)
- FAQ articles with translations (20+)

---

## Indexes

Performance-critical indexes are defined in the schema:

| Model | Index | Purpose |
|-------|-------|---------|
| FaqArticle | categoryId | Filter by category |
| FaqArticleTranslation | [articleId, locale] | Unique translation lookup |
| Notification | [userId, read] | Unread notifications |
| Notification | [userId, createdAt] | Recent notifications |
| TicketUpdate | [ticketId] | Updates per ticket |
| TicketUpdate | [createdAt] | Recent updates |

---

## Related Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - System overview
- [API-REFERENCE.md](./API-REFERENCE.md) - API endpoints
- [Prisma Docs](https://www.prisma.io/docs) - Official documentation
