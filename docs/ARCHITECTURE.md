# Architecture Overview

**Last Updated**: 2025-10-31  
**Status**: ✅ Post-Supabase Removal - Mock Implementation

---

## Current Architecture

### Tech Stack

**Frontend**:
- Next.js 14 (App Router, TypeScript, Server Components)
- React 18 with Hooks
- Tailwind CSS 3.4.0 (responsive design, dark mode)
- shadcn/ui (15 components)
- Zustand 5.0.8 (state management with persist)
- React Hook Form + Zod (form validation)
- next-intl 4.4.0 (i18n: en, zh-CN, fr, es, ru, pt)
- lucide-react (icons)
- date-fns (date formatting)

**Backend**:
- Next.js API Routes (REST API)
- Mock Authentication (temporary)
- In-memory Data Storage (temporary)
- Zammad Integration (external ticket system)

**Development**:
- TypeScript (strict mode)
- ESLint + Prettier
- PowerShell (Windows environment)

---

## Project Structure

```
src/
├── app/                        # Next.js App Router
│   ├── (customer)/            # Customer portal routes
│   ├── (staff)/               # Staff portal routes
│   ├── (admin)/               # Admin panel routes
│   ├── login/                 # Login page
│   └── api/                   # API routes
│       ├── health/            # Health check
│       ├── conversations/     # Conversation API
│       ├── tickets/           # Zammad ticket API
│       └── admin/             # Admin API
├── components/                # React components
│   ├── auth/                  # Authentication components
│   ├── ui/                    # shadcn/ui components
│   ├── customer/              # Customer-specific components
│   ├── staff/                 # Staff-specific components
│   └── admin/                 # Admin-specific components
├── lib/                       # Utilities and libraries
│   ├── hooks/                 # Custom React hooks
│   ├── stores/                # Zustand stores
│   ├── utils/                 # Utility functions
│   ├── zammad/                # Zammad integration
│   ├── mock-auth.ts           # Mock authentication (TODO: replace)
│   └── mock-data.ts           # Mock data storage (TODO: replace)
├── services/                  # Business logic layer
│   ├── zammad.service.ts      # Zammad service
│   └── zammad-user.service.ts # Zammad user management
├── repositories/              # Data access layer
│   ├── zammad.repository.ts   # Zammad repository
│   └── webhook.repository.ts  # Webhook repository
├── types/                     # TypeScript type definitions
└── middleware.ts              # Next.js middleware (TODO: replace)
```

---

## Authentication Flow (Current - Mock)

```
User Login → Mock Authentication → Always Succeeds → Set Session → Redirect to Dashboard
```

**Mock Users**:
- `customer@test.com` → role: 'customer'
- `staff@test.com` → role: 'staff'
- `admin@test.com` → role: 'admin'

**TODO**: Replace with real authentication (NextAuth.js, Auth0, Clerk)

---

## Data Storage (Current - Mock)

**In-Memory Storage** (`src/lib/mock-data.ts`):
- `mockConversations` - Empty array
- `mockMessages` - Empty array
- `mockUsers` - 3 test users
- `mockFAQItems` - Empty array

**Zammad User Mapping** (`src/lib/zammad/user-mapping.ts`):
- In-memory Map for user-to-Zammad ID mapping
- Replaces previous `user_zammad_mapping` database table

**TODO**: Replace with real database (PostgreSQL + Prisma, MongoDB)

---

## Route Groups

### (customer) - Customer Portal
- `/customer/dashboard` - Statistics and recent activity
- `/customer/faq` - Self-service FAQ
- `/customer/conversations` - Live chat (auto-join)
- `/customer/my-tickets` - Ticket management
- `/customer/feedback` - Submit feedback
- `/customer/complaints` - Submit complaints

### (staff) - Staff Portal
- `/staff/dashboard` - Overview and statistics
- `/staff/tickets` - Ticket management
- `/staff/faq` - Knowledge base

### (admin) - Admin Panel
- `/admin/dashboard` - System overview
- `/admin/users` - User management
- `/admin/faq` - FAQ management
- `/admin/settings` - System settings (AI auto-reply)

---

## API Routes

### Health Check
- `GET /api/health` - Returns system health status

### Conversations (TODO: Update to use mock data)
- `GET /api/conversations` - List conversations
- `POST /api/conversations` - Create conversation
- `GET /api/conversations/:id` - Get conversation
- `PUT /api/conversations/:id` - Update conversation
- `GET /api/conversations/:id/messages` - Get messages
- `POST /api/conversations/:id/messages` - Send message
- `GET /api/conversations/stats` - Get statistics

### Tickets (Zammad Integration)
- `GET /api/tickets/search` - Search tickets
- `POST /api/tickets` - Create ticket
- `GET /api/tickets/:id` - Get ticket
- `PUT /api/tickets/:id` - Update ticket
- `GET /api/tickets/:id/articles` - Get articles
- `POST /api/tickets/:id/articles` - Add article

### Admin (TODO: Update to use mock data)
- `GET /api/admin/users` - List users
- `PUT /api/admin/users/:id` - Update user
- `GET /api/admin/faq` - List FAQ items
- `POST /api/admin/faq` - Create FAQ item
- `PUT /api/admin/faq/:id` - Update FAQ item
- `DELETE /api/admin/faq/:id` - Delete FAQ item
- `GET /api/admin/settings` - Get settings
- `PUT /api/admin/settings` - Update settings

---

## State Management

### Zustand Stores

**Auth Store** (`src/lib/stores/auth-store.ts`):
```typescript
interface AuthState {
  user: MockUser | null
  session: MockSession | null
  userRole: 'customer' | 'staff' | 'admin' | null
  isLoading: boolean
  isInitialized: boolean
}
```

**Conversation Store** (if exists):
- Active conversation
- Message list
- Typing indicators
- Real-time updates

---

## Internationalization (i18n)

**Supported Languages**:
- English (en)
- Simplified Chinese (zh-CN)
- French (fr)
- Spanish (es)
- Russian (ru)
- Portuguese (pt)

**Implementation**:
- next-intl 4.4.0
- Message files in `messages/` directory
- Language switcher in UI
- Server-side and client-side translations

---

## Zammad Integration

**External Ticket System**:
- Zammad URL: http://172.16.40.22:8080
- API Token: Configured in environment variables
- X-On-Behalf-Of: Admin token with user impersonation

**Features**:
- Create tickets from conversations
- Search and filter tickets
- Update ticket status and priority
- Add articles (replies)
- Webhook integration for real-time updates

**See**: `docs/ZAMMAD-INTEGRATION.md` for detailed guide

---

## Middleware

**Current** (`src/middleware.ts`):
- Bypass all authentication checks
- Allow all requests to pass through
- TODO: Implement real authentication middleware

**Future**:
- Session validation
- Role-based access control
- JWT token verification
- Redirect logic based on user role

---

## Performance Considerations

**Current Limitations**:
- In-memory storage (data lost on restart)
- No database indexes
- No caching layer
- No CDN for static assets

**Future Optimizations**:
- Database indexes for common queries
- Redis caching for frequently accessed data
- CDN for images and static files
- API response caching
- Database connection pooling

---

## Security Considerations

**Current** (Mock Implementation):
- No real authentication
- No password hashing
- No session encryption
- No CSRF protection
- No rate limiting

**Future** (Production Ready):
- Real authentication system (NextAuth.js, Auth0, Clerk)
- Password hashing (bcrypt, argon2)
- Session encryption (JWT, secure cookies)
- CSRF tokens
- Rate limiting (API routes)
- Input validation (Zod schemas)
- SQL injection prevention (Prisma, parameterized queries)
- XSS prevention (React auto-escaping)

---

## Deployment

**Development**:
- Local: `npm run dev` on port 3010
- Hot reload enabled
- Mock data and authentication

**Production** (Future):
- Platform: Vercel, Netlify, or custom server
- Database: PostgreSQL, MongoDB
- Authentication: NextAuth.js, Auth0, or Clerk
- File Storage: S3, Cloudinary
- Real-time: Socket.IO, Pusher
- Monitoring: Sentry, LogRocket, or custom solution

---

## Migration Path

### Phase 1: Current State ✅
- Supabase removed
- Mock authentication implemented
- Mock data storage implemented
- Zammad integration preserved
- Dev server running

### Phase 2: Choose Solutions (TODO)
- Evaluate authentication options
- Evaluate database options
- Evaluate real-time options
- Evaluate file storage options

### Phase 3: Implement Real Systems (TODO)
- Replace mock-auth.ts with real authentication
- Replace mock-data.ts with real database
- Update API routes to use real data
- Implement real-time features
- Add file upload functionality

### Phase 4: Production Ready (TODO)
- Security hardening
- Performance optimization
- Comprehensive testing
- Monitoring and logging
- Documentation updates

---

## Related Documentation
- `docs/ZAMMAD-INTEGRATION.md` - Zammad integration guide
- `docs/05-API设计.md` - API design documentation
- Supabase removal report (historical)
- `README.md` - Project overview and setup

