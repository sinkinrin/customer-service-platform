# Zammad Integration Guide

> Deep integration with Zammad ticketing system

**中文概览**: See [ZAMMAD-INTEGRATION.zh-CN.md](./ZAMMAD-INTEGRATION.zh-CN.md)

**Last Updated**: 2026-01-29
**Version**: 2.1

---

## Overview

The platform uses Zammad as the external ticketing system. All ticket data is stored in Zammad, while the platform handles UI, authentication, and additional features like notifications and ratings.

### Integration Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Platform ↔ Zammad Integration                │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│   Platform (Next.js)                    Zammad Server            │
│   ┌─────────────────┐                   ┌─────────────────┐     │
│   │                 │   REST API        │                 │     │
│   │  ZammadClient   │◄─────────────────►│  Zammad API     │     │
│   │  (client.ts)    │   Token Auth      │  /api/v1/*      │     │
│   │                 │                   │                 │     │
│   └────────┬────────┘                   └────────┬────────┘     │
│            │                                     │               │
│            │                                     │               │
│   ┌────────▼────────┐                   ┌────────▼────────┐     │
│   │  Webhook        │   HTTP POST       │  Triggers       │     │
│   │  Handler        │◄──────────────────│  (Events)       │     │
│   │                 │                   │                 │     │
│   └─────────────────┘                   └─────────────────┘     │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Configuration

### Environment Variables

```env
# Required
ZAMMAD_URL=http://your-zammad-server:8080/
ZAMMAD_API_TOKEN=<admin-token-with-admin.user-permission>

# Optional
ZAMMAD_WEBHOOK_SECRET=<webhook-signature-secret>
```

### API Token Requirements

The API token must have the following permissions:
- `admin.user` - Required for X-On-Behalf-Of functionality
- `ticket.agent` - Required for ticket operations
- Access to all groups for cross-region operations

---

## ZammadClient API

Location: `src/lib/zammad/client.ts`

### Initialization

```typescript
import { zammadClient } from '@/lib/zammad/client'

// Client is a singleton, auto-configured from env
const tickets = await zammadClient.getAllTickets()
```

### Ticket Operations

| Method | Description |
|--------|-------------|
| `createTicket(data, onBehalfOf?)` | Create new ticket |
| `getTicket(id, onBehalfOf?)` | Get ticket by ID |
| `getAllTickets()` | Get all tickets (paginated) |
| `updateTicket(id, data, onBehalfOf?)` | Update ticket |
| `deleteTicket(id, onBehalfOf?)` | Delete ticket |
| `searchTickets(query, limit?, onBehalfOf?)` | Search tickets |

### Article Operations

| Method | Description |
|--------|-------------|
| `createArticle(data, onBehalfOf?)` | Create reply/note |
| `getArticle(id, onBehalfOf?)` | Get article by ID |
| `getArticlesByTicket(ticketId, onBehalfOf?)` | Get ticket articles |
| `downloadAttachment(ticketId, articleId, attachmentId, onBehalfOf?)` | Download file |
| `uploadAttachment(file, filename, mimeType, onBehalfOf, formId?)` | Upload file |

### User Operations

| Method | Description |
|--------|-------------|
| `authenticateUser(email, password)` | Validate credentials |
| `getUser(id)` | Get user by ID |
| `getUserByEmail(email)` | Find user by email |
| `createUser(data)` | Create new user |
| `updateUser(id, data)` | Update user |
| `searchUsers(query)` | Search users |
| `getAgents(activeOnly?)` | Get all agents |
| `setOutOfOffice(userId, data)` | Set vacation status |

### Tag Operations

| Method | Description |
|--------|-------------|
| `getTicketTags(ticketId)` | Get ticket tags |
| `addTag(ticketId, tag, onBehalfOf?)` | Add tag |
| `removeTag(ticketId, tag, onBehalfOf?)` | Remove tag |

### Group & SLA Operations

| Method | Description |
|--------|-------------|
| `getGroups()` | Get all groups |
| `getGroup(id)` | Get group by ID |
| `createGroup(data)` | Create group |
| `getSLAs()` | Get all SLAs |

---

## X-On-Behalf-Of Pattern

The platform uses a single admin API token for all operations. To preserve user identity, the `X-On-Behalf-Of` header is used.

### How It Works

```typescript
// When customer creates a ticket:
await zammadClient.createTicket(
  {
    title: 'Help needed',
    group: 'Asia-Pacific',
    article: { body: 'I need help...' }
  },
  'customer@example.com'  // X-On-Behalf-Of
)

// Zammad creates the ticket as if customer@example.com created it
// The ticket.customer_id is set to the customer's Zammad user ID
```

### Usage by Role

| Role | X-On-Behalf-Of Usage |
|------|---------------------|
| **Customer** | Always used - ensures customer only sees own tickets |
| **Staff** | Used for articles - shows staff name as sender |
| **Admin** | Optional - can act as any user |

### Permission Requirements

The API token must have `admin.user` permission to use X-On-Behalf-Of.

---

## Region & Group Mapping

### Region Constants

Location: `src/lib/constants/regions.ts`

```typescript
export const REGION_GROUP_MAPPING: Record<RegionValue, number> = {
  'asia-pacific': 4,      // Zammad Group: 亚太
  'middle-east': 3,       // Zammad Group: 中东
  'africa': 1,            // Zammad Group: 非洲 Users
  'north-america': 6,     // Zammad Group: 北美
  'latin-america': 7,     // Zammad Group: 拉美
  'europe-zone-1': 2,     // Zammad Group: 欧洲
  'europe-zone-2': 8,     // Zammad Group: 欧洲二区
  'cis': 5,               // Zammad Group: 独联体
}
```

### Helper Functions

```typescript
import {
  getGroupIdByRegion,   // 'asia-pacific' → 4
  getRegionByGroupId,   // 4 → 'asia-pacific'
  isValidRegion         // Validate region string
} from '@/lib/constants/regions'
```

### Ticket Routing

When a customer creates a ticket:
1. Customer's region is determined (from session or selection)
2. Region is mapped to Zammad group ID
3. Ticket is created in that group
4. Staff in that region can see the ticket

```typescript
// In ticket creation flow:
const groupId = getGroupIdByRegion(userRegion)
await zammadClient.createTicket({
  title: 'Help needed',
  group_id: groupId,  // Routes to correct regional group
  customer_id: zammadUserId,
  article: { ... }
}, userEmail)
```

---

## Ticket State Mapping

Location: `src/lib/constants/zammad-states.ts`

| State ID | Zammad State | Platform Display |
|----------|--------------|------------------|
| 1 | new | New |
| 2 | open | Open |
| 3 | pending reminder | Pending |
| 4 | closed | Closed |
| 5 | merged | Merged |
| 6 | removed | Removed |
| 7 | pending close | Pending Close |

### State Transitions

```
new (1) ──────► open (2) ──────► closed (4)
    │              │                 │
    │              ▼                 │
    │         pending (3,7)          │
    │              │                 │
    └──────────────┴─────────────────┘
                 (reopen)
```

---

## Auto-Assignment System

Location: `src/lib/ticket/auto-assign.ts`

### Algorithm

1. Get all active agents from Zammad
2. Filter by region (group membership)
3. Exclude system accounts and on-vacation users
4. Calculate workload (active ticket count per agent)
5. Select agent with lowest workload
6. Assign ticket and update state to "open"

### Excluded Accounts

```typescript
const EXCLUDED_EMAILS = [
  'support@howentech.com',
  'howensupport@howentech.com'
]
```

### Integration Point

Auto-assignment runs:
- Immediately after ticket creation (if `auto_assign: true`)
- Via `/api/tickets/auto-assign` endpoint (batch)

---

## Webhook Integration

Location: `src/app/api/webhooks/zammad/route.ts`

### Endpoint

```
POST /api/webhooks/zammad
```

### Zammad Trigger Configuration

Configure a Zammad trigger to POST to the webhook URL on ticket events:
- Ticket created
- Ticket updated
- Article created

### Payload Processing

The webhook handler:
1. Validates signature (if `ZAMMAD_WEBHOOK_SECRET` is set)
2. Determines event type from payload
3. Stores update in `TicketUpdate` table
4. Creates in-app notifications
5. Broadcasts via SSE

### Event Detection Logic

```typescript
// Determine event type from Zammad payload
if (webhookPayload.article && !prevArticle) {
  event = 'article_created'
} else if (prevState !== currentState) {
  event = 'status_changed'
} else if (prevOwner !== currentOwner) {
  event = 'assigned'
}
```

### Signature Verification

```typescript
// Zammad sends X-Hub-Signature or X-Zammad-Signature
const signature = request.headers.get('X-Hub-Signature')
const isValid = verifyWebhookSignature(rawBody, signature, webhookSecret)
```

---

## User Synchronization

### First Ticket Flow

When a customer creates their first ticket:

1. Platform checks if user exists in Zammad
2. If not, creates user with matching email
3. Stores mapping in `UserZammadMapping` table
4. Proceeds with ticket creation

```typescript
// Ensure user exists in Zammad before ticket creation
async function ensureZammadUser(email, fullName, role, region) {
  // Try to find existing user
  const existing = await zammadClient.getUserByEmail(email)
  if (existing) return existing

  // Create new user with appropriate role
  const zammadRoles = role === 'admin' ? ['Admin', 'Agent']
                    : role === 'staff' ? ['Agent']
                    : ['Customer']

  return await zammadClient.createUser({
    email,
    firstname: fullName.split(' ')[0],
    lastname: fullName.split(' ').slice(1).join(' '),
    roles: zammadRoles,
    group_ids: getGroupPermissions(role, region)
  })
}
```

### Role Mapping

| Platform Role | Zammad Roles |
|---------------|--------------|
| customer | Customer |
| staff | Agent |
| admin | Admin, Agent |

### Customer Region Storage

Customer regions are stored in Zammad's `note` field:

```
Region: asia-pacific
```

Staff regions are determined by their `group_ids` in Zammad.

---

## Email User Welcome System

Location: `src/lib/ticket/email-user-welcome.ts`

### Overview

When a user first contacts support via email, Zammad automatically creates a customer account but without a usable password. This system automatically generates a password and sends a welcome email.

### Configuration

```env
# Enable auto-generation of password for first-time email users (default: true)
EMAIL_USER_AUTO_PASSWORD_ENABLED=true

# Enable sending welcome email with login credentials (default: true)
EMAIL_USER_WELCOME_EMAIL_ENABLED=true

# Web platform URL for the login link in welcome emails
WEB_PLATFORM_URL=https://support.example.com
```

### How It Works

1. **Webhook Trigger**: When a ticket is created via email (`article.type === 'email'`), the webhook handler triggers the welcome flow asynchronously.

2. **First-Time User Detection**: The system distinguishes first-time email users from existing users by checking the `note` field for a Region marker:
   - **No Region** = First-time email user (auto-created by Zammad with empty note)
   - **Has Region** = Existing user (registered via web or created by admin, always has `Region: xxx`)

3. **Two-Step Idempotency**: The system uses two separate markers to ensure safe retries:
   - `WelcomePasswordSet:` - Written immediately after password is set
   - `WelcomeEmailSent:` - Written after welcome email is successfully sent

4. **Password Generation**: A 12-character secure random password is generated using `crypto.randomBytes()`. The password excludes confusing characters (0/O, 1/l/I).

5. **Password Setting**: The password is set via `zammadClient.updateUser()`, then immediately marked with `WelcomePasswordSet:`.

6. **Welcome Email**: An HTML email is sent via `zammadClient.createArticle()` with:
   - Login credentials (email + temporary password)
   - Login URL link
   - Security warning to change password after first login

7. **Marker Update**: After successful email delivery, the user's `note` field is updated with `WelcomeEmailSent: <timestamp>`.

### Security Considerations

⚠️ **Important**: The welcome email is sent as an external article and appears in the ticket history. This means:
- Staff and admins can see the temporary password in ticket history
- The email prominently warns users to change their password immediately
- Password is only set once per user (idempotent via `WelcomePasswordSet:` marker)
- Only truly new email users (no Region) receive credentials; existing users are never affected

### Retry Logic

- If password setting fails: the flow aborts, no marker is written
- If email sending fails: only `WelcomePasswordSet:` is written; password won't be regenerated on retry
- All errors are logged but don't block the webhook response
- Note: If password was set but email failed, subsequent retries cannot send the welcome email (password is not stored)

---

## Permission System

Location: `src/lib/utils/permission.ts`

### Ticket Access Rules

```typescript
function checkTicketPermission(ctx: PermissionContext): PermissionResult {
  const { user, ticket, action } = ctx

  // Admin: full access
  if (user.role === 'admin') return { allowed: true }

  // Customer: own tickets only
  if (user.role === 'customer') {
    return {
      allowed: ticket.customer_id === user.zammad_id,
      reason: 'Customers can only access their own tickets'
    }
  }

  // Staff: assigned or regional tickets
  if (user.role === 'staff') {
    const isAssigned = ticket.owner_id === user.zammad_id
    const isInRegion = user.group_ids?.includes(ticket.group_id)
    return {
      allowed: isAssigned || isInRegion,
      reason: 'Staff can access assigned or regional tickets'
    }
  }
}
```

### Filtering Functions

```typescript
// Filter ticket list by permissions
filterTicketsByPermission(tickets, user)

// Filter by region only (for staff)
filterTicketsByRegion(tickets, user)

// Check single ticket access
checkTicketPermission({ user, ticket, action: 'view' })
```

---

## Health Monitoring

Location: `src/lib/zammad/health-check.ts`

### Health Check Endpoint

```
GET /api/health/zammad
```

### Response

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

### Error Handling

When Zammad is unavailable:
- API routes return 503 with friendly message
- Frontend shows "Service temporarily unavailable"
- Requests are not retried to avoid blocking

---

## Attachment Handling

### Upload Flow

1. Client uploads file to `/api/attachments/upload`
2. Platform validates file (size, type, magic bytes)
3. Platform uploads to Zammad's `upload_caches` endpoint
4. Returns `form_id` for later reference
5. When creating article, reference the `form_id`

### Size Limits

Location: `src/lib/constants/attachments.ts`

```typescript
export const ATTACHMENT_LIMITS = {
  MAX_FILE_SIZE: 10 * 1024 * 1024,  // 10MB
  UPLOAD_TIMEOUT: 120000,            // 2 minutes
  ALLOWED_MIME_TYPES: [
    'image/jpeg', 'image/png', 'image/gif',
    'application/pdf',
    'text/plain',
    // ... more types
  ]
}
```

### Security Measures

- MIME type validation (client + magic bytes)
- Filename sanitization
- Path traversal prevention
- XSS prevention in filenames

---

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "Zammad is not configured" | Missing env vars | Set `ZAMMAD_URL` and `ZAMMAD_API_TOKEN` |
| 403 on ticket operations | Token lacks permissions | Ensure token has `admin.user` permission |
| Tickets not visible to staff | Wrong group assignment | Check staff's `group_ids` in Zammad |
| Webhook not received | Firewall/URL issue | Verify Zammad can reach webhook URL |
| User not syncing | Email mismatch | Check email case sensitivity |

### Debug Logging

Enable debug logs by checking console output. Key log prefixes:
- `[Zammad]` - API client operations
- `[Auth]` - Authentication flow
- `[Webhook]` - Webhook processing
- `[Permission]` - Access control checks
- `[Auto-Assign]` - Assignment logic

---

## API Reference

For complete API documentation, see [API-REFERENCE.md](./API-REFERENCE.md).

Ticket-related endpoints:
- `GET /api/tickets` - List tickets
- `POST /api/tickets` - Create ticket
- `GET /api/tickets/:id` - Get ticket details
- `PUT /api/tickets/:id` - Update ticket
- `POST /api/tickets/:id/articles` - Add reply
- `PUT /api/tickets/:id/assign` - Assign to staff
- `POST /api/tickets/auto-assign` - Batch auto-assign
- `POST /api/webhooks/zammad` - Receive Zammad events
