# API Reference

> Complete API Endpoint Documentation (69 Routes)

**中文导读**: See [API-REFERENCE.zh-CN.md](./API-REFERENCE.zh-CN.md)

**Last Updated**: 2026-01-21
**Base URL**: `/api`

---

## Overview

The platform exposes 69 API route files organized into the following categories:

| Category | Routes | Description |
|----------|--------|-------------|
| [Authentication](#authentication) | 1 | NextAuth.js handlers |
| [Tickets](#tickets) | 12 | Zammad ticket management |
| [Notifications](#notifications) | 5 | In-app notification system |
| [Conversations](#conversations) | 6 | AI chat conversations |
| [FAQ](#faq) | 4 | Knowledge base |
| [User Profile](#user-profile) | 4 | User settings & profile |
| [Staff](#staff) | 2 | Staff management |
| [Admin - Users](#admin-users) | 6 | User administration |
| [Admin - FAQ](#admin-faq) | 3 | FAQ management |
| [Admin - Settings](#admin-settings) | 3 | System configuration |
| [Admin - Stats](#admin-stats) | 5 | Dashboard statistics |
| [Admin - Triggers](#admin-triggers) | 3 | Zammad triggers |
| [Files](#files) | 5 | File upload & download |
| [Templates](#templates) | 2 | Reply templates |
| [Health](#health) | 3 | Service health checks |
| [Webhooks](#webhooks) | 1 | Zammad webhooks |
| [Other](#other) | 4 | Sessions, OpenAPI, etc. |

---

## Response Format

All API responses follow a consistent format:

### Success Response

```json
{
  "success": true,
  "data": { ... }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": { ... }
  }
}
```

### Common HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request / Validation Error |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 500 | Internal Server Error |
| 503 | Service Unavailable (Zammad down) |

---

## Authentication

All protected endpoints require a valid session. The platform uses NextAuth.js v5 with JWT strategy.

### POST /api/auth/callback/credentials

Login with email and password.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

### GET /api/auth/session

Get current session.

**Response:**
```json
{
  "user": {
    "id": "zammad-15",
    "email": "user@example.com",
    "role": "customer",
    "full_name": "John Doe",
    "region": "asia-pacific",
    "zammad_id": 15
  },
  "expires": "2026-01-28T00:00:00.000Z"
}
```

### POST /api/auth/signout

Logout current session.

---

## Tickets

Ticket management via Zammad integration.

### GET /api/tickets

List tickets with filtering.

**Authentication:** Required
**Roles:** All (filtered by permission)

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| status | string | Filter by status (open, closed, pending) |
| page | number | Page number (default: 1) |
| limit | number | Items per page (default: 20) |
| sort | string | Sort field (created_at, updated_at) |
| order | string | Sort order (asc, desc) |

**Response:**
```json
{
  "success": true,
  "data": {
    "tickets": [
      {
        "id": 10001,
        "number": "10001",
        "title": "Help needed",
        "state": "open",
        "priority_id": 2,
        "group_id": 4,
        "customer_id": 15,
        "owner_id": 3,
        "created_at": "2026-01-20T10:00:00Z",
        "updated_at": "2026-01-20T12:00:00Z"
      }
    ],
    "total": 100,
    "page": 1,
    "limit": 20
  }
}
```

### POST /api/tickets

Create a new ticket.

**Authentication:** Required
**Roles:** All

**Request Body:**
```json
{
  "title": "Help needed",
  "region": "asia-pacific",
  "priority_id": 2,
  "article": {
    "subject": "Issue description",
    "body": "Detailed description of the issue...",
    "type": "note",
    "internal": false,
    "form_id": "upload-form-123"
  }
}
```

**Validation Schema (Zod):**
```typescript
z.object({
  title: z.string().min(1).max(255),
  group: z.string().optional().default('Support'),
  priority_id: z.number().int().min(1).max(3).default(2),
  region: z.string().optional(),
  article: z.object({
    subject: z.string().min(1),
    body: z.string().min(1),
    type: z.enum(['note', 'email', 'phone', 'web']).default('note'),
    internal: z.boolean().default(false),
    attachment_ids: z.array(z.number()).optional(),
    form_id: z.string().optional(),
  }),
})
```

### GET /api/tickets/[id]

Get ticket details with articles.

**Authentication:** Required
**Permission:** Customer sees own tickets, Staff sees regional tickets

**Response:**
```json
{
  "success": true,
  "data": {
    "ticket": {
      "id": 10001,
      "number": "10001",
      "title": "Help needed",
      "state": "open",
      "articles": [
        {
          "id": 1,
          "body": "Message content",
          "from": "customer@example.com",
          "created_at": "2026-01-20T10:00:00Z"
        }
      ]
    }
  }
}
```

### PUT /api/tickets/[id]

Update ticket (status, priority, etc.).

**Authentication:** Required
**Roles:** Staff, Admin

**Request Body:**
```json
{
  "state_id": 4,
  "priority_id": 1
}
```

### POST /api/tickets/[id]/articles

Add a reply/article to a ticket.

**Authentication:** Required
**Roles:** All (with permission)

**Request Body:**
```json
{
  "body": "Reply content",
  "content_type": "text/html",
  "type": "note",
  "internal": false,
  "form_id": "upload-form-123"
}
```

**Validation Schema:**
```typescript
z.object({
  subject: z.string().optional(),
  body: z.string().min(1),
  content_type: z.string().default('text/html'),
  type: z.enum(['note', 'email', 'phone', 'web']).default('note'),
  internal: z.boolean().default(false),
  to: z.string().email().optional(),
  cc: z.string().optional(),
  attachment_ids: z.array(z.number()).optional(),
  form_id: z.string().optional(),
})
```

### GET /api/tickets/[id]/articles/[articleId]/attachments/[attachmentId]

Download attachment from Zammad.

**Authentication:** Required
**Response:** Binary file stream

### PUT /api/tickets/[id]/assign

Assign ticket to staff member.

**Authentication:** Required
**Roles:** Staff, Admin

**Request Body:**
```json
{
  "owner_id": 5
}
```

### POST /api/tickets/[id]/reopen

Reopen a closed ticket.

**Authentication:** Required

### POST /api/tickets/[id]/rating

Rate a closed ticket.

**Authentication:** Required
**Roles:** Customer

**Request Body:**
```json
{
  "rating": "positive",
  "reason": "Great service!"
}
```

### POST /api/tickets/auto-assign

Batch auto-assign tickets.

**Authentication:** Required
**Roles:** Admin

### GET /api/tickets/search

Search tickets by query.

**Authentication:** Required

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| q | string | Search query |
| limit | number | Max results |

### GET /api/tickets/export

Export tickets as CSV.

**Authentication:** Required
**Roles:** Admin

### GET /api/tickets/updates

Get recent ticket updates.

**Authentication:** Required

### GET /api/tickets/updates/stream

Server-Sent Events stream for real-time updates.

**Authentication:** Required
**Response:** SSE stream

---

## Notifications

In-app notification system stored in Prisma.

### GET /api/notifications

Get user notifications.

**Authentication:** Required

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| limit | number | Max results (default: 20) |
| offset | number | Pagination offset |
| unread | boolean | Filter unread only |

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "cuid123",
        "type": "ticket_reply",
        "title": "New reply on ticket #10001",
        "body": "Staff has replied to your ticket",
        "read": false,
        "createdAt": "2026-01-20T10:00:00Z",
        "data": { "ticketId": 10001 }
      }
    ],
    "total": 50,
    "unreadCount": 5
  }
}
```

### GET /api/notifications/unread-count

Get unread notification count.

**Response:**
```json
{
  "success": true,
  "data": { "unreadCount": 5 }
}
```

### PUT /api/notifications/[id]/read

Mark single notification as read.

**Authentication:** Required

### PUT /api/notifications/read-all

Mark all notifications as read.

**Authentication:** Required

### DELETE /api/notifications/[id]

Delete a notification.

**Authentication:** Required

---

## Conversations

AI chat conversations (FastGPT integration).

### GET /api/conversations

List user's AI conversations.

**Authentication:** Required
**Roles:** Customer

**Response:**
```json
{
  "success": true,
  "data": {
    "conversations": [
      {
        "id": "conv-123",
        "title": "Help with product",
        "created_at": "2026-01-20T10:00:00Z",
        "updated_at": "2026-01-20T12:00:00Z",
        "message_count": 5
      }
    ]
  }
}
```

### POST /api/conversations

Create new AI conversation.

**Request Body:**
```json
{
  "initial_message": "Hello, I need help"
}
```

### GET /api/conversations/[id]

Get conversation with messages.

### GET /api/conversations/[id]/messages

Get messages in a conversation.

### POST /api/conversations/[id]/messages

Send a message (triggers AI response).

**Request Body:**
```json
{
  "content": "User message"
}
```

### POST /api/conversations/[id]/mark-read

Mark conversation as read.

### GET /api/conversations/unread-count

Get unread conversation count.

---

## FAQ

Self-service knowledge base.

### GET /api/faq

List FAQ articles.

**Authentication:** None (public)

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| language | string | Locale (en, zh-CN, fr, es, ru, pt) |
| categoryId | number | Filter by category |
| query | string | Search query |
| limit | number | Max results |

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 1,
        "slug": "getting-started",
        "title": "Getting Started",
        "content": "Markdown content...",
        "views": 150,
        "helpful_count": 45,
        "not_helpful_count": 3
      }
    ],
    "total": 20,
    "language": "en"
  }
}
```

### GET /api/faq/categories

List FAQ categories.

**Response:**
```json
{
  "success": true,
  "data": {
    "categories": [
      {
        "id": 1,
        "name": "Getting Started",
        "description": "Basic guides",
        "icon": "help-circle",
        "article_count": 5
      }
    ]
  }
}
```

### GET /api/faq/[id]

Get single FAQ article.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| language | string | Locale for translation |

### POST /api/faq/[id]/rating

Rate FAQ article helpfulness.

**Authentication:** Required

**Request Body:**
```json
{
  "is_helpful": true
}
```

---

## User Profile

User account management.

### GET /api/user/profile

Get current user profile.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "data": {
    "profile": {
      "id": "zammad-15",
      "email": "user@example.com",
      "full_name": "John Doe",
      "phone": "+1234567890",
      "language": "en",
      "avatar_url": "/avatars/15.jpg",
      "region": "asia-pacific"
    }
  }
}
```

### PUT /api/user/profile

Update user profile.

**Request Body:**
```json
{
  "full_name": "John Smith",
  "phone": "+1987654321",
  "language": "zh-CN"
}
```

### PUT /api/user/password

Change password.

**Request Body:**
```json
{
  "currentPassword": "oldpassword",
  "newPassword": "newpassword123",
  "confirmPassword": "newpassword123"
}
```

**Validation:**
- `newPassword` must be at least 8 characters
- `newPassword` must match `confirmPassword`

### GET/PUT /api/user/preferences

Get or update notification preferences.

### POST /api/user/avatar

Upload avatar image.

---

## Staff

Staff availability management.

### GET /api/staff/available

Get available staff for assignment.

**Authentication:** Required
**Roles:** Staff, Admin

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| region | string | Filter by region |

**Response:**
```json
{
  "success": true,
  "data": {
    "agents": [
      {
        "id": 5,
        "email": "staff@example.com",
        "full_name": "Agent Smith",
        "region": "asia-pacific",
        "active_tickets": 12
      }
    ]
  }
}
```

### GET/POST /api/staff/vacation

Get or set vacation/out-of-office status.

**Request Body (POST):**
```json
{
  "out_of_office": true,
  "out_of_office_start_at": "2026-02-01",
  "out_of_office_end_at": "2026-02-15",
  "out_of_office_replacement_id": 6
}
```

---

## Admin Users

User administration (Admin only).

### GET /api/admin/users

List all users.

**Authentication:** Required
**Roles:** Admin

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| role | string | Filter by role |
| region | string | Filter by region |
| search | string | Search query |
| page | number | Page number |
| limit | number | Items per page |

### POST /api/admin/users

Create new user.

**Request Body:**
```json
{
  "email": "newuser@example.com",
  "password": "password123",
  "full_name": "New User",
  "role": "staff",
  "region": "asia-pacific",
  "phone": "+1234567890",
  "language": "en"
}
```

**Validation Schema:**
```typescript
z.object({
  email: z.string().email(),
  password: z.string().min(8),
  full_name: z.string().min(1),
  role: z.enum(['customer', 'staff', 'admin']),
  region: z.string().refine(isValidRegion),
  phone: z.string().optional(),
  language: z.string().optional(),
})
```

### GET /api/admin/users/[id]

Get user by Zammad ID.

**Roles:** Admin, Staff

### PUT /api/admin/users/[id]

Update user.

**Request Body:**
```json
{
  "full_name": "Updated Name",
  "region": "middle-east",
  "role": "staff"
}
```

### GET/PATCH /api/admin/users/[id]/status

Get or update user active status.

**Request Body (PATCH):**
```json
{
  "active": false
}
```

### PUT /api/admin/users/[id]/role

Change user role.

**Request Body:**
```json
{
  "role": "admin"
}
```

### GET /api/admin/users/export

Export users as CSV.

### POST /api/admin/users/import

Bulk import users.

---

## Admin FAQ

FAQ content management.

### GET /api/admin/faq

List all FAQ articles (including inactive).

**Roles:** Admin, Staff

### POST /api/admin/faq/categories

Create FAQ category.

**Request Body:**
```json
{
  "name": "New Category",
  "description": "Category description",
  "icon": "book",
  "slug": "new-category"
}
```

### PUT/DELETE /api/admin/faq/categories

Update or delete category.

### POST /api/admin/faq/articles

Create FAQ article with translations.

**Request Body:**
```json
{
  "category_id": 1,
  "slug": "new-article",
  "translations": [
    {
      "locale": "en",
      "title": "Article Title",
      "content": "Markdown content...",
      "keywords": ["help", "guide"]
    },
    {
      "locale": "zh-CN",
      "title": "文章标题",
      "content": "Markdown 内容...",
      "keywords": ["帮助", "指南"]
    }
  ]
}
```

### PUT/DELETE /api/admin/faq/articles

Update or delete article.

---

## Admin Settings

System configuration.

### GET /api/admin/settings

Get system settings.

**Roles:** Admin

### PUT /api/admin/settings

Update system settings.

### GET /api/admin/settings/ai

Get AI/FastGPT configuration.

**Response:**
```json
{
  "success": true,
  "data": {
    "enabled": true,
    "model": "gpt-4",
    "temperature": 0.7,
    "fastgpt_url": "https://fastgpt.example.com",
    "fastgpt_appid": "app-123"
  }
}
```

### PUT /api/admin/settings/ai

Update AI settings.

**Request Body:**
```json
{
  "enabled": true,
  "model": "gpt-4",
  "temperature": 0.7,
  "system_prompt": "You are a helpful assistant...",
  "fastgpt_url": "https://fastgpt.example.com",
  "fastgpt_appid": "app-123",
  "fastgpt_api_key": "key-123"
}
```

### POST /api/admin/settings/ai/test

Test AI connection.

---

## Admin Stats

Dashboard statistics.

### GET /api/admin/stats/dashboard

Unified dashboard statistics.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| trendRange | string | 7d, 30d, 90d |

**Response:**
```json
{
  "success": true,
  "data": {
    "ticketStats": {
      "total": 500,
      "open": 120,
      "pending": 50,
      "closed": 330
    },
    "userStats": {
      "total": 200,
      "customers": 180,
      "staff": 15,
      "admins": 5
    },
    "regionStats": [...],
    "trendData": [...]
  }
}
```

### GET /api/admin/stats/tickets

Ticket statistics.

### GET /api/admin/stats/ratings

Customer satisfaction statistics.

### GET /api/admin/stats/regions

Regional ticket distribution.

### GET /api/admin/stats/staff

Staff workload statistics.

---

## Admin Triggers

Zammad trigger management.

### GET /api/admin/triggers

List Zammad triggers.

### POST /api/admin/triggers

Create trigger.

### GET /api/admin/triggers/[id]

Get trigger details.

### PUT /api/admin/triggers/[id]

Update trigger.

### DELETE /api/admin/triggers/[id]

Delete trigger.

### POST /api/admin/triggers/setup

Setup default triggers.

---

## Files

File upload and download.

### POST /api/attachments/upload

Upload file to Zammad cache.

**Content-Type:** multipart/form-data

**Form Fields:**

| Field | Type | Description |
|-------|------|-------------|
| file | File | The file to upload |
| form_id | string | Optional form ID for grouping |

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 123,
    "form_id": "form-abc",
    "filename": "document.pdf",
    "size": 102400,
    "content_type": "application/pdf"
  }
}
```

**Limits:**
- Max file size: 10MB
- Allowed types: images, PDF, text, common documents

### POST /api/files/upload

Upload file with metadata (local storage).

### GET /api/files/[id]

Get file metadata.

### DELETE /api/files/[id]

Delete file.

### GET /api/files/[id]/download

Download file.

### GET /api/avatars/[id]

Get user avatar.

---

## Templates

Reply templates for staff.

### GET /api/templates

List reply templates.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| category | string | Filter by category |
| region | string | Filter by region |

**Response:**
```json
{
  "success": true,
  "data": {
    "templates": [
      {
        "id": 1,
        "name": "Greeting",
        "content": "Hello {customer_name}...",
        "category": "first_contact",
        "region": null
      }
    ]
  }
}
```

### POST /api/templates

Create template.

**Request Body:**
```json
{
  "name": "Template Name",
  "content": "Template content with {variables}",
  "category": "first_contact",
  "region": "asia-pacific"
}
```

**Categories:** first_contact, technical, follow_up, closing, general

### PUT /api/templates/[id]

Update template.

### DELETE /api/templates/[id]

Delete template.

---

## Health

Service health monitoring.

### GET /api/health

Platform health check.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2026-01-20T10:00:00Z"
  }
}
```

### GET /api/health/zammad

Zammad connection health.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "responseTime": 45,
    "version": "6.4.1"
  }
}
```

### GET /api/ai/health

AI/FastGPT connection health.

---

## Webhooks

External service webhooks.

### POST /api/webhooks/zammad

Receive Zammad events.

**Headers:**
- `X-Hub-Signature` or `X-Zammad-Signature`: HMAC-SHA1 signature (optional)

**Payload:**
```json
{
  "ticket": {
    "id": 10001,
    "number": "10001",
    "title": "Ticket title",
    "state_id": 2,
    "customer_id": 15,
    "owner_id": 5
  },
  "article": {
    "id": 50,
    "body": "Reply content",
    "from": "staff@example.com"
  }
}
```

**Events Detected:**
- `created` - New ticket created
- `article_created` - New reply added
- `status_changed` - State changed
- `assigned` - Owner changed

**Actions:**
1. Stores update in `TicketUpdate` table
2. Creates in-app notifications
3. Broadcasts via SSE

---

## Other

### GET /api/openapi.json

OpenAPI specification.

### POST /api/sessions

Create debug session (admin).

### GET /api/sessions

List debug sessions.

### DELETE /api/sessions/[id]

Delete session.

### POST /api/dev/auto-login

Development auto-login (dev only).

### POST /api/ai/chat

Direct AI chat endpoint.

---

## Error Codes

| Code | Description |
|------|-------------|
| UNAUTHORIZED | Authentication required |
| FORBIDDEN | Insufficient permissions |
| NOT_FOUND | Resource not found |
| VALIDATION_ERROR | Request validation failed |
| INVALID_ID | Invalid ID format |
| ZAMMAD_UNAVAILABLE | Zammad service is down |
| INVALID_SIGNATURE | Invalid webhook signature |
| INVALID_PAYLOAD | Invalid request payload |
| SLUG_EXISTS | Duplicate slug |
| MISSING_FIELDS | Required fields missing |

---

## Rate Limiting

Currently no rate limiting is implemented. For production deployments, consider adding rate limiting at the reverse proxy level.

---

## Related Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - System overview
- [ZAMMAD-INTEGRATION.md](./ZAMMAD-INTEGRATION.md) - Zammad API details
- [DATABASE.md](./DATABASE.md) - Prisma schema
- [AUTHENTICATION.md](./AUTHENTICATION.md) - Auth system
