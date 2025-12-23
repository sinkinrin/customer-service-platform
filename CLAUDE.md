# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

A **production-ready Customer Service Platform** built with Next.js 16 (App Router), React 19, and TypeScript. Integrates with Zammad as an external ticketing system and provides a comprehensive solution for customer support.

### Core Features
- **NextAuth.js v5**: JWT-based authentication with role-based access control (Customer/Staff/Admin)
- **Prisma Database**: SQLite (dev) / PostgreSQL (prod) with full ORM support
- **Multi-portal Access**: Separate portals for customers, staff, and administrators
- **Zammad Integration**: Complete ticketing system integration with X-On-Behalf-Of authentication
- **Multilingual**: 6 languages (en, zh-CN, fr, es, ru, pt) via next-intl
- **Staff Management**: Vacation tracking, availability management, auto-assignment
- **FAQ System**: Self-service knowledge base with Prisma backend
- **AI Integration**: FastGPT API for intelligent auto-replies (optional)
- **Testing**: Vitest (unit) + Playwright (E2E)

### Tech Stack
- **Frontend**: Next.js 16 (App Router), React 19, TypeScript
- **Auth**: NextAuth.js v5 (JWT sessions, no database sessions)
- **Database**: Prisma 6.19 (SQLite dev / PostgreSQL prod)
- **UI**: Tailwind CSS, shadcn/ui, Lucide icons
- **State**: Zustand with persistence
- **Forms**: React Hook Form + Zod validation
- **i18n**: next-intl 4.5
- **Real-time**: Socket.IO 4.6

## Quick Start

```bash
# Development
npm run dev              # http://localhost:3010

# Database
npm run db:seed          # Seed database with FAQ data

# Testing
npm run test             # Run unit tests (Vitest)
npm run test:e2e         # Run E2E tests (Playwright)
npm run type-check       # TypeScript type checking

# Build
npm run build            # Production build
npm run start            # Production server
```

## Environment Variables

### Required
```env
# Authentication (Required in production)
AUTH_SECRET=your_auth_secret_here_at_least_32_chars

# Database
DATABASE_URL=file:./dev.db  # SQLite for dev, postgresql://... for prod

# Zammad Integration (Required)
ZAMMAD_URL=http://your-zammad-server:8080/
ZAMMAD_API_TOKEN=your_zammad_api_token
```

### Optional
```env
FASTGPT_API_KEY=your_fastgpt_api_key
SOCKET_IO_PORT=3001
LOG_LEVEL=info
NEXT_PUBLIC_ENABLE_MOCK_AUTH=true  # Enable test users (dev only)
```

## Test Accounts (Development)

When `NEXT_PUBLIC_ENABLE_MOCK_AUTH=true`:
- **Customer**: `customer@test.com` (password: `password123`)
- **Staff**: `staff@test.com` (password: `password123`)
- **Admin**: `admin@test.com` (password: `password123`)

Regional test users also available (asia-pacific@test.com, middle-east@test.com, etc.)

## Architecture Notes

### Authentication Flow
- NextAuth.js v5 with JWT strategy (stateless sessions)
- Credentials provider for email/password
- Middleware (`middleware.ts`) handles route protection
- Role-based access: Customer, Staff, Admin
- Mock auth available as development fallback

### Database Layer
- Prisma ORM with singleton pattern (`src/lib/prisma.ts`)
- Current schema: FAQ management (categories, articles, translations, ratings)
- Migrations in `prisma/migrations/`
- Seed script in `prisma/seed.ts`

### Zammad Integration
- Full REST API client: `src/lib/zammad/client.ts`
- Auto-assignment system for tickets
- X-On-Behalf-Of header for impersonation
- Retry logic with exponential backoff
- Current instance: http://47.252.29.254:8080/ (see `.env.local`)

### Internationalization
- Translation files: `messages/*.json`
- Language selector: `src/components/language-selector.tsx`
- Validation: `npm run i18n:check`

## Project Structure (Key Directories)

```
src/
├── app/
│   ├── (auth)/         # Login, signup, unauthorized
│   ├── (customer)/     # Customer portal
│   ├── (staff)/        # Staff portal
│   ├── (admin)/        # Admin panel
│   └── api/            # 40+ API routes
├── auth.ts             # NextAuth.js v5 configuration
├── lib/
│   ├── zammad/         # Zammad API client
│   ├── stores/         # Zustand state stores
│   └── prisma.ts       # Prisma singleton
├── components/         # React components (UI, domain)
└── types/              # TypeScript definitions

prisma/
├── schema.prisma       # Database schema
├── migrations/         # Database migrations
└── seed.ts             # Seed data

messages/               # i18n translation files
```

## OpenSpec 需求管理

本项目使用 OpenSpec 进行结构化需求管理。

**目录结构**:
- `openspec/specs/` - 当前系统规范
- `openspec/changes/` - 提议的变更
- `openspec/archive/` - 已完成的变更

**工作流程**:
1. 查看现有规范: `openspec/specs/`
2. 创建变更提案: `openspec/changes/<feature-name>/`
3. 跟踪进度: 在 `tasks.md` 中更新清单
4. 归档已完成: 移动到 `openspec/archive/`
5. 生成 Changelog: 遵循 `CHANGELOG_GUIDE.md`

## Development Tips

- **Code Search**: Use `codebase-retrieval` MCP tool for semantic code search
- **API Routes**: See `src/app/api/` for all endpoints
- **Components**: UI components in `src/components/ui/` (shadcn/ui)
- **Middleware**: Route protection in `middleware.ts`
- **Type Safety**: All API responses typed in `src/types/`

---

**Note**: Use `codebase-retrieval` when searching for code patterns or architecture information about this project.
