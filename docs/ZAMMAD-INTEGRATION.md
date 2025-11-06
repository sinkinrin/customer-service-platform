# Zammad Integration Guide

**Last Updated**: 2025-10-31  
**Status**: ✅ Implemented and Tested

---

## Overview

This project integrates with **Zammad** as an external ticket management system via REST API.

### Architecture
- **External Ticket System**: Ticket data stored in Zammad (not local database)
- **User Mapping**: In-memory mapping between local users and Zammad users (`src/lib/zammad/user-mapping.ts`)
- **X-On-Behalf-Of**: API calls made on behalf of users using admin token with `X-On-Behalf-Of` header
- **Error Recovery**: Built-in retry mechanism and error handling

### Data Flow
```
Customer Conversation → Create Ticket Request → Zammad API → Save User Mapping → Webhook Callback → Update Local State
```

---

## Configuration

### Environment Variables
```env
ZAMMAD_URL=http://172.16.40.22:8080
ZAMMAD_API_TOKEN=gfgNF40pP1WjbDBMM9Jftwi2UIgOt9fze9WiNy3kxSb5akK4-mcV1F3ef3fJZ3Zt
ZAMMAD_WEBHOOK_SECRET=<random_secret>
```

### Required Permissions
The API token must have:
- `admin.api` - API access
- `admin.user` - User management (for X-On-Behalf-Of)
- `ticket.agent` - Ticket operations

---

## API Endpoints

### Project API → Zammad API Mapping

| Project Endpoint | Zammad Endpoint | Method | Description |
|-----------------|----------------|--------|-------------|
| `GET /api/tickets/search` | `GET /api/v1/tickets/search` | Search tickets |
| `POST /api/tickets` | `POST /api/v1/tickets` | Create ticket |
| `GET /api/tickets/:id` | `GET /api/v1/tickets/:id` | Get ticket |
| `PUT /api/tickets/:id` | `PUT /api/v1/tickets/:id` | Update ticket |
| `POST /api/tickets/:id/articles` | `POST /api/v1/ticket_articles` | Add reply |
| `GET /api/tickets/:id/articles` | `GET /api/v1/ticket_articles/by_ticket/:id` | Get history |

---

## Code Structure

### Core Files
```
src/
├── lib/zammad/
│   ├── client.ts              # Zammad API client
│   ├── types.ts               # TypeScript types
│   └── user-mapping.ts        # User-to-Zammad ID mapping
├── services/
│   ├── zammad.service.ts      # Business logic layer
│   └── zammad-user.service.ts # User management
├── repositories/
│   └── zammad.repository.ts   # Data access layer
└── app/api/tickets/
    ├── route.ts               # GET/POST /api/tickets
    ├── [id]/route.ts          # GET/PUT /api/tickets/:id
    ├── [id]/articles/route.ts # GET/POST /api/tickets/:id/articles
    └── search/route.ts        # GET /api/tickets/search
```

---

## Usage Examples

### Create Ticket
```typescript
import { zammadService } from '@/services/zammad.service'

const result = await zammadService.createTicket(conversationId, {
  title: 'Ticket Title',
  group: 'Support',
  customer: 'customer@example.com',
  priority_id: 2,
  article: {
    subject: 'Issue Description',
    body: 'Detailed content',
    type: 'note',
    internal: false,
  }
}, userId) // userId for X-On-Behalf-Of
```

### Search Tickets
```typescript
const result = await zammadService.searchTickets('query', 10, userId)
console.log(result.tickets) // Array of tickets
console.log(result.tickets_count) // Total count
```

### Update Ticket
```typescript
const ticket = await zammadService.updateTicket(conversationId, {
  state_id: 2, // Open
  priority_id: 3, // High
}, userId)
```

### Add Article (Reply)
```typescript
const article = await zammadService.addArticle(conversationId, {
  subject: 'Follow-up',
  body: 'Additional information',
  type: 'note',
  internal: false,
}, userId)
```

---

## Security: X-On-Behalf-Of

### How It Works
1. Admin API token used for all requests
2. `X-On-Behalf-Of` header specifies which user the action is for
3. Zammad creates/updates tickets as if the user performed the action
4. Maintains proper audit trail and permissions

### User Mapping
```typescript
import { setUserZammadMapping, getUserZammadId } from '@/lib/zammad/user-mapping'

// After creating Zammad user
setUserZammadMapping(userId, zammadUserId, zammadUserEmail)

// When making API calls
const zammadUserId = getUserZammadId(userId)
```

---

## Webhook Integration

### Setup
1. Configure webhook in Zammad admin panel
2. Set URL: `https://your-domain.com/api/webhooks/zammad`
3. Set secret in environment variable
4. Enable events: `ticket.create`, `ticket.update`, `ticket.state_update`

### Webhook Handler
Located at `src/app/api/webhooks/zammad/route.ts`
- Verifies signature using HMAC-SHA256
- Logs all webhook events
- Updates local conversation state based on ticket changes

---

## Troubleshooting

### Common Issues

**401 Unauthorized**
- Check API token is valid
- Verify token has required permissions

**403 Forbidden (X-On-Behalf-Of)**
- Ensure token has `admin.user` permission
- Verify user exists in Zammad

**404 Not Found**
- Check Zammad URL is correct
- Verify ticket/user ID exists

**500 Internal Server Error**
- Check Zammad server logs
- Verify request payload format

### Debug Mode
Enable detailed logging:
```typescript
// In zammad.service.ts
console.log('Zammad request:', { endpoint, method, data, onBehalfOf })
console.log('Zammad response:', response)
```

---

## Knowledge Base API

Zammad provides comprehensive Knowledge Base API:
- Categories with hierarchical structure
- Answers with translations (multi-language)
- Permissions (public/internal)
- Publish/archive status
- Search functionality

### Example: Get KB Categories
```typescript
const categories = await zammadClient.request('/knowledge_bases/1/categories')
```

### Example: Search KB
```typescript
const results = await zammadClient.request('/knowledge_bases/1/answers/search?query=login')
```

---

## Testing

### Test Accounts
```
customer@test.com  → Zammad customer user
staff@test.com     → Zammad agent user
admin@test.com     → Zammad admin user
```

### Manual Testing
1. Create ticket via API: `POST /api/tickets`
2. Verify in Zammad UI: http://172.16.40.22:8080
3. Update ticket in Zammad UI
4. Verify webhook received: Check logs

---

## Related Documentation
- Zammad Official API Docs: https://docs.zammad.org/en/latest/api/intro.html
- Project API Design: `docs/05-API设计.md`
- Backend Architecture: `docs/07-后端架构.md`

---

## Migration Notes

**Post-Supabase Removal**:
- User mapping moved from `user_zammad_mapping` table to in-memory Map
- Sync records (`zammad_sync` table) removed - tickets tracked by conversation ID only
- All Zammad client code remains unchanged
- API routes still functional with mock authentication

