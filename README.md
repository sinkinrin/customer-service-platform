# 🎫 Customer Service Platform

> A modern, multilingual customer service platform with Zammad ticketing integration.

**Version**: 1.0.0
**Status**: ✅ Development - Post-Supabase Removal
**Last Updated**: 2025-10-31

---

## 📋 Project Overview

A comprehensive customer service platform with conversation management, FAQ self-service, and Zammad ticketing integration. Currently running with mock authentication and in-memory data storage.

### Current Features

- ✅ **Mock Authentication**
  - Test users: customer@test.com, staff@test.com, admin@test.com
  - Role-based access control
  - Auto-redirect to role-specific dashboards

- ✅ **Customer Portal**
  - FAQ self-service
  - Live chat conversations (auto-join)
  - Ticket management
  - Feedback and complaints submission

- ✅ **Staff Portal**
  - Ticket management
  - Knowledge base access
  - Dashboard with statistics

- ✅ **Admin Panel**
  - User management
  - FAQ management
  - System settings (AI auto-reply)

- ✅ **Zammad Integration**
  - External ticket system
  - Create/update/search tickets
  - X-On-Behalf-Of authentication
  - Webhook support

- ✅ **Multilingual Support**
  - 6 languages: en, zh-CN, fr, es, ru, pt
  - next-intl 4.4.0

---

## 🏗️ Technology Stack

### Frontend
- **Framework**: Next.js 14 (App Router, TypeScript)
- **UI**: Tailwind CSS 3.4.0 + shadcn/ui (15 components)
- **State**: Zustand 5.0.8 with persist
- **Forms**: React Hook Form + Zod
- **i18n**: next-intl 4.4.0
- **Icons**: lucide-react
- **Dates**: date-fns

### Backend
- **API**: Next.js API Routes
- **Auth**: Mock implementation (TODO: replace)
- **Data**: In-memory storage (TODO: replace)
- **Tickets**: Zammad REST API integration

### External Services
- **Zammad**: Ticket management system (http://172.16.40.22:8080)

---

## 📚 Documentation

### Essential Guides
- [📖 Architecture Overview](./docs/ARCHITECTURE.md)
- [🎫 Zammad Integration](./docs/ZAMMAD-INTEGRATION.md)
- [🔌 API Design](./docs/05-API设计.md)
- [📊 Project Overview](./docs/00-project-overview.md)
- [📋 Requirements](./docs/01-requirements.md)
- [🔄 Business Flows](./docs/02-business-flows.md)

### Migration Documentation
- ✅ Supabase Removal Complete

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Zammad instance (optional, for ticket features)

### Installation
```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Zammad credentials

# Start development server
npm run dev
```

### Access the Application
- **URL**: http://localhost:3010
- **Test Accounts**:
  - Customer: `customer@test.com` (any password)
  - Staff: `staff@test.com` (any password)
  - Admin: `admin@test.com` (any password)

---

## 🎯 Current Status

### ✅ Completed
- Frontend UI (customer/staff/admin portals)
- Mock authentication system
- Zammad ticket integration
- Multilingual support (6 languages)
- Responsive design with dark mode

### ⏳ TODO (Future Work)
- Replace mock authentication with real system (NextAuth.js, Auth0, Clerk)
- Replace in-memory storage with real database (PostgreSQL, MongoDB)
- Implement real-time features (Socket.IO, Pusher)
- Add file upload functionality
- Comprehensive testing (unit, integration, E2E)
   - Performance analytics

### Technical Goals
1. **Scalability**: Support 10,000+ concurrent users
2. **Performance**: <500ms API response time
3. **Reliability**: 99.9% uptime
4. **Security**: Enterprise-grade security standards
5. **Maintainability**: Clean code, comprehensive tests

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Zammad instance (optional, for ticket features)

### Installation
```bash
# Clone the repository
git clone <repository-url>
cd customer-service-platform

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your configuration

# Run database migrations
npm run db:migrate

# Start development server
npm run dev
```

### Environment Variables
```env
# Zammad Integration
ZAMMAD_URL=http://172.16.40.22:8080/
ZAMMAD_API_TOKEN=your_zammad_api_token_here

# Socket.IO
SOCKET_IO_PORT=3001

# JWT Secret (for mock authentication)
JWT_SECRET=your_jwt_secret_here
```

---

## 📁 Project Structure

```
customer-service-platform/
├── app/                    # Next.js App Router
│   ├── (customer)/        # Customer portal routes
│   ├── (staff)/           # Staff portal routes
│   ├── (admin)/           # Admin panel routes
│   ├── (auth)/            # Authentication routes
│   ├── api/               # API routes
│   └── layout.tsx         # Root layout
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   ├── auth/             # Authentication components
│   ├── customer/         # Customer-specific components
│   ├── staff/            # Staff-specific components
│   └── admin/            # Admin-specific components
├── lib/                   # Utility libraries
│   ├── hooks/            # Custom React hooks
│   ├── stores/           # Zustand stores
│   ├── utils/            # Utility functions
│   ├── zammad/           # Zammad integration
│   ├── mock-auth.ts      # Mock authentication (TODO: replace)
│   └── mock-data.ts      # Mock data storage (TODO: replace)
├── services/              # Business logic layer
│   ├── zammad.service.ts # Zammad service
│   └── zammad-user.service.ts # Zammad user management
├── repositories/          # Data access layer
│   ├── zammad.repository.ts # Zammad repository
│   └── webhook.repository.ts # Webhook repository
├── types/                 # TypeScript type definitions
├── public/               # Static assets
├── docs/                 # Documentation
└── wiki/                 # Wiki pages
```

---

## 🔐 Security

- **Authentication**: JWT-based with bcrypt password hashing
- **Authorization**: Role-based access control (RBAC)
- **Data Protection**: Row Level Security (RLS) policies
- **API Security**: Rate limiting, input validation
- **Communication**: HTTPS only, secure WebSocket

---

## 🌍 Internationalization

### Supported Languages
- 🇬🇧 English (Primary)
- 🇨🇳 Simplified Chinese (Secondary)
- 🌐 Extensible for other languages

### Translation Coverage
- UI labels and buttons
- FAQ questions and answers
- System notifications
- Error messages
- Email templates

---

## 📊 Features Roadmap

### Phase 1: MVP (Current)
- [x] Requirements analysis
- [x] Business flow design
- [x] Database design
- [x] API design
- [ ] UI mockups
- [ ] Project initialization

### Phase 2: Core Features
- [ ] Authentication system
- [ ] Conversation management
- [ ] FAQ self-service
- [ ] Human agent handoff
- [ ] Basic ticketing

### Phase 3: Advanced Features
- [ ] AI-assisted responses
- [ ] Advanced analytics
- [ ] Multi-channel support
- [ ] Mobile app

### Phase 4: Enterprise Features
- [ ] Custom workflows
- [ ] Advanced reporting
- [ ] SLA management
- [ ] API for third-party integrations

---

## 🤝 Contributing

This project is currently in the design phase. Contributions are welcome once the MVP is complete.

---

## 📄 License

TBD

---

## 📞 Contact

For questions or support, please refer to the documentation or contact the development team.

---

**Built with ❤️ using Next.js, Zammad, and modern web technologies.**

