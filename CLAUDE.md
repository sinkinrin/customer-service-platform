# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Customer Service Platform** built with Next.js 14 (App Router) and TypeScript. The platform integrates with **Zammad** as an external ticketing system and provides a comprehensive solution for customer support with conversation management, FAQ self-service, and ticket handling.

### Key Features
- **Mock Authentication**: Test users (customer@test.com, staff@test.com, admin@test.com)
- **Multi-portal Access**: Customer, Staff, and Admin portals
- **Zammad Integration**: External ticket system with X-On-Behalf-Of authentication
- **Multilingual Support**: 6 languages (en, zh-CN, fr, es, ru, pt) via next-intl
- **Conversation Management**: Real-time messaging with mock data storage
- **FAQ Knowledge Base**: Searchable self-service with Zammad Knowledge Base integration
- **OpenSpec 需求管理**: 使用 OpenSpec 进行结构化需求定义和变更管理

## Development Commands

### Starting the Development Server
```bash
npm run dev
# Starts the development server on port 3010
# Access at: http://localhost:3010
```

### Building for Production
```bash
npm run build
# Creates an optimized production build
```

### Running in Production Mode
```bash
npm run start
# Starts the production server on port 3010
```

### Type Checking
```bash
npm run type-check
# Runs TypeScript type checking without emitting files
```

### Linting
```bash
npm run lint
# Runs ESLint to check for code quality issues
```

## Architecture Overview

### Tech Stack
- **Frontend**: Next.js 14 (App Router), React 18, TypeScript
- **UI**: Tailwind CSS, shadcn/ui components
- **State Management**: Zustand with persistence
- **Forms**: React Hook Form + Zod validation
- **Internationalization**: next-intl
- **API**: Next.js API Routes
- **External Services**: Zammad REST API (ticketing system)

### Core Architecture Patterns

#### Authentication System
- **Current**: Mock authentication with cookie-based sessions
- **Future**: Planned replacement with real authentication (NextAuth.js, Auth0, Clerk)
- **Key Files**:
  - `src/lib/mock-auth.ts` (mock authentication implementation)
  - `src/lib/hooks/use-auth.ts` (authentication hook)
  - `src/lib/stores/auth-store.ts` (authentication state store)

#### Data Storage
- **Current**: In-memory mock data storage
- **Future**: Planned replacement with real database (PostgreSQL, MongoDB)
- **Key Files**:
  - `src/lib/mock-data.ts` (mock data structures and operations)
  - `src/lib/zammad/user-mapping.ts` (Zammad user ID mapping)

#### Zammad Integration
- **External Ticket System**: Zammad (http://172.16.40.22:8080)
- **Authentication**: Admin API token with X-On-Behalf-Of header
- **Key Files**:
  - `src/lib/zammad/client.ts` (Zammad API client)
  - `src/lib/zammad/types.ts` (Zammad type definitions)
  - `src/app/api/tickets/` (ticket API routes)
  - `src/app/api/webhooks/zammad/route.ts` (webhook handler)

#### Internationalization
- **Library**: next-intl v4.4.0
- **Languages**: English (primary), Simplified Chinese, French, Spanish, Russian, Portuguese
- **Key Files**:
  - `messages/*.json` (translation files)
  - `src/i18n.ts` (i18n configuration)
  - `src/components/language-selector.tsx` (language switcher)

#### State Management
- **Library**: Zustand v5.0.8 with persistence
- **Key Stores**:
  - `src/lib/stores/auth-store.ts` (authentication state)
  - `src/lib/stores/conversation-store.ts` (conversation state)
  - `src/lib/stores/ticket-store.ts` (ticket state)

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Authentication routes
│   ├── (customer)/        # Customer portal routes
│   ├── (staff)/           # Staff portal routes
│   ├── (admin)/           # Admin panel routes
│   └── api/               # API routes
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   ├── auth/             # Authentication components
│   ├── conversation/     # Conversation components
│   ├── faq/              # FAQ components
│   ├── ticket/           # Ticket components
│   └── layouts/          # Layout components
├── lib/                   # Utility libraries
│   ├── hooks/            # Custom React hooks
│   ├── stores/           # Zustand stores
│   ├── utils/            # Utility functions
│   ├── zammad/           # Zammad integration
│   ├── mock-auth.ts      # Mock authentication (TODO: replace)
│   └── mock-data.ts      # Mock data storage (TODO: replace)
├── types/                 # TypeScript type definitions
└── messages/             # Translation files
```

## Key API Routes

### Authentication
- `POST /api/dev/auto-login` - Development auto-login (dev only)

### Conversations
- `GET /api/conversations` - List conversations
- `POST /api/conversations` - Create conversation
- `GET /api/conversations/:id` - Get conversation
- `PUT /api/conversations/:id` - Update conversation
- `GET /api/conversations/:id/messages` - Get messages
- `POST /api/conversations/:id/messages` - Send message

### Tickets (Zammad Integration)
- `GET /api/tickets/search` - Search tickets
- `POST /api/tickets` - Create ticket
- `GET /api/tickets/:id` - Get ticket
- `PUT /api/tickets/:id` - Update ticket
- `GET /api/tickets/:id/articles` - Get articles
- `POST /api/tickets/:id/articles` - Add article

### FAQ (Knowledge Base)
- `GET /api/faq` - Search FAQ items
- `GET /api/faq/categories` - Get FAQ categories

### Webhooks
- `POST /api/webhooks/zammad` - Zammad webhook handler

## Testing Accounts

### Development Login
- **Customer**: `customer@test.com` (password: password123)
- **Staff**: `staff@test.com` (password: password123)
- **Admin**: `admin@test.com` (password: password123)

### Auto-Login API (Development Only)
```bash
# Quick login for testing
curl -X POST http://localhost:3010/api/dev/auto-login \
  -H "Content-Type: application/json" \
  -d '{"role": "customer"}'
```

## Environment Variables

### Required Variables
```env
# Zammad Integration
ZAMMAD_URL=http://172.16.40.22:8080/
ZAMMAD_API_TOKEN=your_zammad_api_token

# Socket.IO (optional)
SOCKET_IO_PORT=3001
```

## Future Implementation Tasks

### Authentication
Replace mock authentication with real system:
- NextAuth.js
- Auth0
- Clerk
- Firebase Auth

### Data Storage
Replace in-memory storage with real database:
- PostgreSQL + Prisma
- MongoDB + Mongoose

### Real-time Features
Implement real-time communication:
- Socket.IO
- Pusher

### File Upload
Add file upload functionality:
- Cloud storage (AWS S3, Cloudinary)
- Local file storage

## OpenSpec 需求管理

本项目使用 OpenSpec 进行结构化需求管理。OpenSpec 提供了一种标准化的方法来定义、管理和跟踪系统需求和变更。

### 关键目录
- `openspec/specs/` - 当前系统规范
- `openspec/changes/` - 提议的变更和增强
- `openspec/archive/` - 已完成的变更

### 使用 OpenSpec
1. **查看现有规范**：查看 `openspec/specs/` 目录
2. **提议变更**：在 `openspec/changes/` 中创建新目录和提案
3. **跟踪进度**：在 `tasks.md` 中更新实施清单
4. **归档已完成的变更**：将已完成的变更移动到 `openspec/archive/`
5. **生成 Changelog**：遵循 `CHANGELOG_GUIDE.md` 中的指引，基于 git commits 生成规范的变更日志


## Key Dependencies

### UI Components
- **shadcn/ui**: Radix UI + Tailwind CSS components
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Icon library

### State Management
- **Zustand**: Lightweight state management with persistence

### Forms and Validation
- **React Hook Form**: Performant, flexible forms
- **Zod**: TypeScript-first schema declaration and validation

### Internationalization
- **next-intl**: Internationalization for Next.js

### API Integration
- **Zammad Client**: Custom REST API client for Zammad

## Testing

### Manual Testing
1. Start development server: `npm run dev`
2. Navigate to: http://localhost:3010
3. Use auto-login or test accounts to access different portals
4. Test conversation creation and messaging
5. Test ticket creation and management
6. Test FAQ search and knowledge base

### Test Users
- Customer Portal: customer@test.com
- Staff Portal: staff@test.com
- Admin Panel: admin@test.com

- Use ` codebase-retrieval  ` when searching information about the project