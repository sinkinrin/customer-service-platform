# 🎫 Customer Service Platform

> A modern, multilingual customer service platform with Zammad ticketing integration, NextAuth.js authentication, and Prisma ORM.

**Version**: 0.1.0  
**Last Updated**: 2025-12-12

---

## 📋 Overview

A comprehensive customer service platform featuring:
- **Customer Portal** - FAQ self-service, live chat, ticket management
- **Staff Portal** - Ticket handling, knowledge base, dashboard
- **Admin Panel** - User management, FAQ management, system settings
- **Zammad Integration** - Full ticketing system with X-On-Behalf-Of support

---

## ✨ Features

| Feature | Status | Description |
|---------|--------|-------------|
| **Authentication** | ✅ | NextAuth.js with mock/production modes |
| **Customer Portal** | ✅ | FAQ, conversations, tickets, feedback |
| **Staff Portal** | ✅ | Ticket management, knowledge base |
| **Admin Panel** | ✅ | Users, FAQ, AI settings |
| **Zammad Integration** | ✅ | Tickets, articles, tags, knowledge base |
| **Multilingual (i18n)** | ✅ | 6 languages (en, zh-CN, fr, es, ru, pt) |
| **Dark Mode** | ✅ | System-aware theme switching |
| **Responsive Design** | ✅ | Mobile-first UI |

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | Next.js 16 (App Router) |
| **Language** | TypeScript 5.3 |
| **UI** | React 19, Tailwind CSS 3.4, shadcn/ui |
| **State** | Zustand 5.0 |
| **Forms** | React Hook Form + Zod |
| **Auth** | NextAuth.js 5 (beta) |
| **Database** | Prisma 6.19 + SQLite |
| **i18n** | next-intl 4.5 |
| **Ticketing** | Zammad REST API |
| **Icons** | Lucide React |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Zammad instance (optional)

### Installation

```bash
# Clone and install
git clone <repository-url>
cd customer-service-platform
npm install

# Setup environment
cp .env.example .env.local
# Edit .env.local with your configuration

# Initialize database
npx prisma migrate dev
npm run db:seed

# Start development server
npm run dev
```

### Access
- **URL**: http://localhost:3010
- **Test Accounts** (development mock fallback):
  - Customer: `customer@test.com` / `password123`
  - Staff: `staff@test.com` / `password123`
  - Admin: `admin@test.com` / `password123`

---

## ⚙️ Environment Variables

```env
# Authentication (required in production)
AUTH_SECRET=your_auth_secret_here

# Database
DATABASE_URL=file:./dev.db

# Zammad Integration
ZAMMAD_URL=http://your-zammad-server:8080/
ZAMMAD_API_TOKEN=your_api_token

# Optional
FASTGPT_API_KEY=your_fastgpt_key
LOG_LEVEL=info
```

---

## 📁 Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── admin/             # Admin panel routes
│   ├── api/               # API routes (40+ endpoints)
│   ├── auth/              # Authentication pages
│   ├── customer/          # Customer portal routes
│   └── staff/             # Staff portal routes
├── components/            # React components
│   ├── ui/               # shadcn/ui (23 components)
│   ├── conversation/     # Chat components
│   ├── faq/              # FAQ components
│   ├── ticket/           # Ticket components
│   └── layouts/          # Layout components
├── lib/                   # Utilities
│   ├── hooks/            # Custom React hooks
│   ├── stores/           # Zustand stores
│   ├── zammad/           # Zammad API client
│   └── utils/            # Helper functions
└── types/                 # TypeScript definitions

prisma/
├── schema.prisma          # Database schema
├── migrations/            # Database migrations
└── seed.ts               # Seed data

messages/                  # i18n translations (6 languages)
docs/                      # Documentation
openspec/                  # Requirements & change proposals
```

---

## 🔌 API Endpoints

| Category | Endpoints | Description |
|----------|-----------|-------------|
| `/api/auth` | NextAuth handlers | Authentication |
| `/api/tickets` | CRUD + search | Zammad ticket management |
| `/api/conversations` | CRUD + messages | Chat conversations |
| `/api/faq` | Categories + articles | FAQ management |
| `/api/admin` | Users, settings | Admin operations |
| `/api/health` | Status check | System health |

---

## 📚 Documentation

- [Documentation Index](./docs/README.md)
- [Legacy Docs](./docs/legacy/)
- [OpenSpec Changes](./openspec/)

---

## 🛠️ Scripts

```bash
npm run dev          # Development server (port 3010)
npm run dev:turbo    # Development with Turbopack
npm run build        # Production build
npm run start        # Production server
npm run lint         # ESLint
npm run type-check   # TypeScript check
npm run db:seed      # Seed database
npm run i18n:check   # Validate translations
```

---

## 🔐 Security

- **Authentication**: NextAuth.js with JWT sessions
- **Authorization**: Role-based access control (customer/staff/admin)
- **API Security**: Input validation with Zod
- **Zammad**: X-On-Behalf-Of header for user impersonation

---

## 🌍 Internationalization

Supported languages with full translation coverage:
- 🇬🇧 English (en)
- 🇨🇳 简体中文 (zh-CN)
- 🇫🇷 Français (fr)
- 🇪🇸 Español (es)
- 🇷🇺 Русский (ru)
- 🇧🇷 Português (pt)

---

## 📄 License

TBD

---

**Built with Next.js 16, React 19, and Zammad**

