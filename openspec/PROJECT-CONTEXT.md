# Customer Service Platform - 项目技术上下文

> 📅 **最后更新**: 2025-11-12
> 📌 **版本**: v0.1.0
> 🎯 **目的**: 为AI助手提供快速项目理解的完整技术上下文

---

## 📋 目录

1. [项目概览](#项目概览)
2. [技术栈](#技术栈)
3. [架构设计](#架构设计)
4. [数据库设计](#数据库设计)
5. [API端点清单](#api端点清单)
6. [核心库和工具](#核心库和工具)
7. [状态管理](#状态管理)
8. [文件结构](#文件结构)
9. [开发约定](#开发约定)
10. [已知问题](#已知问题)
11. [待实现功能](#待实现功能)

---

## 项目概览

### 基本信息
- **项目名称**: Customer Service Platform (客户服务平台)
- **框架**: Next.js 14 (App Router)
- **语言**: TypeScript
- **端口**: 3010
- **数据库**: SQLite (通过Prisma)
- **外部集成**: Zammad (工单系统)

### 核心功能模块
1. **Customer Portal** (客户门户)
   - 在线咨询 (AI + 人工)
   - 工单管理
   - FAQ自助服务
   - 反馈与投诉

2. **Staff Portal** (客服门户)
   - 对话管理
   - 工单处理
   - Knowledge Base
   - 客户管理

3. **Admin Panel** (管理后台)
   - FAQ管理
   - 用户管理
   - 系统设置
   - 数据统计

---

## 技术栈

### 核心技术
```json
{
  "框架": "Next.js 14.0.0",
  "语言": "TypeScript 5.3.0",
  "React": "18.2.0",
  "数据库": "SQLite (Prisma ORM)",
  "样式": "Tailwind CSS 3.4.18"
}
```

### 主要依赖

#### UI组件
```json
{
  "shadcn/ui": "基于 Radix UI",
  "Radix UI": "无障碍组件库",
  "Lucide React": "图标库 v0.548.0",
  "Tailwind CSS": "v3.4.18",
  "class-variance-authority": "CSS变体管理"
}
```

#### 状态管理
```json
{
  "Zustand": "v5.0.8 - 轻量级状态管理",
  "React Hook Form": "v7.65.0 - 表单管理",
  "Zod": "v3.22.0 - Schema验证"
}
```

#### 数据层
```json
{
  "Prisma": "v6.19.0 - ORM",
  "@prisma/client": "v6.19.0",
  "数据库": "SQLite (dev), 可迁移到PostgreSQL"
}
```

#### 国际化
```json
{
  "next-intl": "v4.4.0",
  "支持语言": ["en", "zh-CN", "fr", "es", "ru", "pt"]
}
```

#### 实时通信
```json
{
  "Socket.IO": "v4.6.0 - WebSocket (已安装但未充分使用)",
  "SSE": "自定义SSEManager (用于工单更新)"
}
```

#### 其他工具
```json
{
  "date-fns": "v4.1.0 - 日期处理",
  "js-cookie": "v3.0.5 - Cookie管理",
  "sonner": "v2.0.7 - Toast通知",
  "next-themes": "v0.4.6 - 主题切换"
}
```

---

## 架构设计

### 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                      Next.js App Router                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Customer   │  │    Staff     │  │    Admin     │      │
│  │    Portal    │  │   Portal     │  │    Panel     │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                  │               │
│         └─────────────────┴──────────────────┘               │
│                           │                                  │
│                      ┌────▼────┐                            │
│                      │API Layer│                            │
│                      └────┬────┘                            │
└───────────────────────────┼─────────────────────────────────┘
                            │
        ┌───────────────────┼────────────────────┐
        │                   │                    │
   ┌────▼────┐        ┌────▼────┐        ┌─────▼─────┐
   │ Prisma  │        │  SSE    │        │  Zammad   │
   │   ORM   │        │ Manager │        │  Client   │
   └────┬────┘        └────┬────┘        └─────┬─────┘
        │                  │                    │
        │                  │                    │
   ┌────▼────┐        ┌────▼────┐        ┌─────▼─────┐
   │ SQLite  │        │Real-time│        │  Zammad   │
   │Database │        │ Events  │        │    API    │
   └─────────┘        └─────────┘        └───────────┘
```

### 目录结构

```
src/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # 认证路由组
│   │   ├── login/
│   │   └── register/
│   ├── (customer)/               # 客户门户路由组
│   │   ├── dashboard/
│   │   ├── conversations/
│   │   ├── my-tickets/
│   │   ├── faq/
│   │   ├── feedback/
│   │   └── complaints/
│   ├── (staff)/                  # 客服门户路由组
│   │   ├── dashboard/
│   │   ├── conversations/        ⚠️ 有Bug
│   │   ├── tickets/              ⚠️ 路由错误
│   │   ├── customers/
│   │   └── settings/
│   ├── (admin)/                  # 管理后台路由组
│   │   ├── dashboard/
│   │   ├── faq/
│   │   ├── users/
│   │   └── settings/
│   └── api/                      # API路由
│       ├── admin/
│       ├── conversations/
│       ├── faq/
│       ├── files/                ⚠️ Mock实现
│       ├── tickets/
│       └── sse/
│
├── components/                   # React组件
│   ├── ui/                       # shadcn/ui基础组件
│   ├── layouts/                  # 布局组件
│   ├── auth/                     # 认证组件
│   ├── conversation/             # 对话组件
│   ├── faq/                      # FAQ组件
│   └── ticket/                   # 工单组件
│
├── lib/                          # 工具库
│   ├── hooks/                    # 自定义Hooks
│   │   ├── use-auth.ts
│   │   ├── use-conversation.ts
│   │   ├── use-faq.ts
│   │   ├── use-sse.ts           # SSE管理Hook
│   │   └── use-ticket.ts
│   ├── stores/                   # Zustand状态管理
│   │   ├── auth-store.ts
│   │   ├── conversation-store.ts
│   │   └── ticket-store.ts
│   ├── zammad/                   # Zammad集成
│   │   ├── client.ts
│   │   ├── types.ts
│   │   └── user-mapping.ts      ⚠️ Mock映射
│   ├── sse/                      # SSE实现
│   │   └── sse-manager.ts
│   ├── utils/                    # 工具函数
│   │   ├── api-response.ts
│   │   ├── auth.ts
│   │   ├── cookies.ts
│   │   └── logger.ts
│   ├── mock-auth.ts              ⚠️ Mock认证
│   ├── mock-data.ts              ⚠️ Mock数据
│   └── prisma.ts                 # Prisma客户端
│
├── types/                        # TypeScript类型
│   ├── api.types.ts
│   └── database.types.ts
│
└── messages/                     # i18n翻译文件
    ├── en.json
    ├── zh-CN.json
    ├── fr.json
    ├── es.json
    ├── ru.json
    └── pt.json
```

---

## 数据库设计

### Prisma Schema (SQLite)

#### 当前已实现的表

```prisma
// FAQ系统 (完全实现)
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
}

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
  ratings      FaqRating[]              // ✅ 评分功能已实现
}

model FaqArticleTranslation {
  id        Int      @id @default(autoincrement())
  articleId Int
  locale    String   // en, zh-CN, fr, es, ru, pt
  title     String
  content   String   // Markdown
  keywords  String   // JSON array

  article FaqArticle @relation(...)

  @@unique([articleId, locale])
}

model FaqRating {
  id        Int      @id @default(autoincrement())
  articleId Int
  userId    String
  isHelpful Boolean  // true = 👍, false = 👎
  createdAt DateTime @default(now())

  article FaqArticle @relation(...)

  @@unique([articleId, userId])
}
```

#### 待实现的表

```prisma
// 工单分配 (待实现)
model TicketAssignment {
  id           String   @id @default(uuid())
  ticketId     String
  assignedToId String
  assignedById String
  assignedAt   DateTime @default(now())
  unassignedAt DateTime?
  notes        String?
}

// 响应模板 (待实现)
model ResponseTemplate {
  id          String   @id @default(uuid())
  staffId     String
  title       String
  content     String
  category    String?
  shortcutKey String?
  variables   Json     @default("[]")
  usageCount  Int      @default(0)
  isPublic    Boolean  @default(false)
}

// 对话升级记录 (待实现)
model ConversationEscalation {
  id             String   @id @default(uuid())
  conversationId String
  escalatedById  String
  acceptedById   String?
  escalatedAt    DateTime @default(now())
  acceptedAt     DateTime?
  priority       String   @default("normal")
  reason         String?
  status         String   @default("pending")
}

// 通知 (待实现)
model Notification {
  id        String   @id @default(uuid())
  userId    String
  type      String
  title     String
  content   String?
  data      Json     @default("{}")
  isRead    Boolean  @default(false)
  readAt    DateTime?
  createdAt DateTime @default(now())
}

// 文件元数据 (待实现 - 当前只有mock)
model FileMetadata {
  id           String   @id @default(uuid())
  originalName String
  filename     String
  mimeType     String
  size         Int
  uploadedBy   String
  bucketName   String
  filePath     String
  uploadedAt   DateTime @default(now())
}
```

### 数据库连接

```typescript
// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'error', 'warn']
    : ['error'],
})

export { prisma }
```

---

## API端点清单

### 认证相关

| 端点 | 方法 | 状态 | 说明 |
|------|------|------|------|
| `/api/dev/auto-login` | POST | ✅ Mock | 开发环境快速登录 |
| `/api/sessions` | GET/POST | ✅ Mock | 会话管理 |

### Customer Portal API

| 端点 | 方法 | 状态 | 说明 |
|------|------|------|------|
| `/api/conversations` | GET/POST | ✅ 实现 | 对话列表/创建 |
| `/api/conversations/[id]` | GET/PUT | ✅ 实现 | 对话详情/更新 |
| `/api/conversations/[id]/messages` | GET/POST | ✅ 实现 | 消息列表/发送 |
| `/api/tickets` | GET | ❌ 需修复 | 工单列表（数据为空） |
| `/api/tickets/search` | GET | ✅ 实现 | 工单搜索 |
| `/api/faq` | GET | ✅ 实现 | FAQ搜索 |
| `/api/faq/[id]/rating` | POST | ✅ 实现 | FAQ评分 |
| `/api/files/upload` | POST | ⚠️ Mock | 文件上传（返回mock数据） |
| `/api/files/[id]` | GET | ⚠️ Mock | 文件下载 |

### Staff Portal API

| 端点 | 方法 | 状态 | 说明 |
|------|------|------|------|
| `/api/sse/tickets` | GET | ⚠️ 问题 | SSE连接（心跳超时） |
| `/api/tickets/[id]/assign` | POST | ❌ 待实现 | 工单分配 |
| `/api/staff/templates` | GET/POST | ❌ 待实现 | 响应模板 |
| `/api/conversations/[id]/escalate` | POST | ❌ 待实现 | 对话升级 |

### Admin Panel API

| 端点 | 方法 | 状态 | 说明 |
|------|------|------|------|
| `/api/admin/faq` | GET/POST | ✅ 实现 | FAQ管理 |
| `/api/admin/faq/[id]` | PUT/DELETE | ✅ 实现 | FAQ更新/删除 |
| `/api/admin/users` | GET/POST | ✅ 实现 | 用户管理 |
| `/api/admin/users/[id]` | PUT/DELETE | ✅ 实现 | 用户更新/删除 |
| `/api/admin/settings` | GET/PUT | ✅ 实现 | 系统设置 |
| `/api/admin/stats/regions` | GET | ✅ 实现 | 区域统计 |

### AI相关

| 端点 | 方法 | 状态 | 说明 |
|------|------|------|------|
| `/api/ai/chat` | POST | ✅ 实现 | AI对话 |
| `/api/admin/settings/ai/test` | POST | ✅ 实现 | AI配置测试 |

---

## 核心库和工具

### 1. Prisma ORM

**配置文件**: `prisma/schema.prisma`

```typescript
// 使用方式
import { prisma } from '@/lib/prisma'

// 示例查询
const articles = await prisma.faqArticle.findMany({
  where: { isActive: true },
  include: { translations: true, ratings: true }
})

// 创建记录
await prisma.faqRating.create({
  data: {
    articleId: 1,
    userId: 'user_123',
    isHelpful: true
  }
})
```

### 2. Zammad Client

**位置**: `src/lib/zammad/client.ts`

```typescript
import { ZammadClient } from '@/lib/zammad/client'

// 配置
const zammadClient = new ZammadClient({
  baseURL: process.env.ZAMMAD_URL,
  token: process.env.ZAMMAD_API_TOKEN
})

// 使用X-On-Behalf-Of模拟用户
zammadClient.setOnBehalfOf(userId)

// 获取工单
const ticket = await zammadClient.getTicket(ticketId)

// 搜索工单
const tickets = await zammadClient.searchTickets({
  query: `customer.id:${customerId}`
})
```

**用户映射** (`src/lib/zammad/user-mapping.ts`):
```typescript
export const USER_ZAMMAD_MAPPING = {
  'customer@test.com': 2,
  'staff@test.com': 3,
  'admin@test.com': 1
}
```

### 3. SSE Manager

**位置**: `src/lib/sse/sse-manager.ts`

```typescript
import { useSSE } from '@/lib/hooks/use-sse'

// 在组件中使用
const { state, isConnected, error } = useSSE({
  url: '/api/sse/tickets',
  enabled: true,
  onMessage: (event) => {
    console.log('SSE event:', event)
  }
})
```

### 4. API响应工具

**位置**: `src/lib/utils/api-response.ts`

```typescript
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  serverErrorResponse
} from '@/lib/utils/api-response'

// 成功响应
return successResponse({ data: tickets }, 200)

// 错误响应
return errorResponse('Ticket not found', 404)

// 未授权
return unauthorizedResponse()

// 服务器错误
return serverErrorResponse('Database error', error.message)
```

### 5. 认证工具

**位置**: `src/lib/utils/auth.ts`

```typescript
import { requireAuth } from '@/lib/utils/auth'

// 在API路由中使用
export async function GET(request: NextRequest) {
  const user = await requireAuth() // 如果未认证会抛出错误

  // 使用user对象
  console.log('Current user:', user.id, user.role)
}
```

### 6. Zod Schema验证

**位置**: `src/types/api.types.ts`

```typescript
import { CreateMessageSchema } from '@/types/api.types'

// 验证请求body
const validation = CreateMessageSchema.safeParse(body)

if (!validation.success) {
  return validationErrorResponse(validation.error.errors)
}

const { conversation_id, content } = validation.data
```

---

## 状态管理

### Zustand Stores

#### 1. Auth Store (`src/lib/stores/auth-store.ts`)

```typescript
interface AuthState {
  user: User | null
  isLoading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  fetchUser: () => Promise<void>
}

// 使用
import { useAuthStore } from '@/lib/stores/auth-store'

const { user, signIn, signOut } = useAuthStore()
```

#### 2. Conversation Store (`src/lib/stores/conversation-store.ts`)

```typescript
interface ConversationState {
  conversations: Conversation[]
  activeConversation: Conversation | null
  messages: Message[]
  // ... 其他状态和方法
}

// 使用
import { useConversationStore } from '@/lib/stores/conversation-store'

const { conversations, sendMessage } = useConversationStore()
```

#### 3. Ticket Store (`src/lib/stores/ticket-store.ts`)

```typescript
interface TicketState {
  tickets: Ticket[]
  selectedTicket: Ticket | null
  // ... 其他状态和方法
}
```

### 持久化

Zustand stores使用`persist`中间件实现本地存储：

```typescript
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // state and actions
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage)
    }
  )
)
```

---

## 文件结构

### 组件命名约定

```
命名模式: <功能>-<类型>.tsx

示例:
- conversation-list.tsx        # 对话列表
- ticket-card.tsx              # 工单卡片
- faq-search-bar.tsx           # FAQ搜索栏
- user-profile-form.tsx        # 用户资料表单
```

### API路由约定

```
结构: app/api/<资源>/<动作>/route.ts

示例:
- app/api/tickets/route.ts              # GET/POST /api/tickets
- app/api/tickets/[id]/route.ts         # GET/PUT/DELETE /api/tickets/:id
- app/api/tickets/[id]/assign/route.ts  # POST /api/tickets/:id/assign
```

### 类型定义约定

```typescript
// Request类型使用Zod schema
export const CreateTicketSchema = z.object({
  title: z.string().min(1),
  description: z.string()
})

export type CreateTicketRequest = z.infer<typeof CreateTicketSchema>

// Response类型使用interface
export interface TicketResponse {
  id: string
  title: string
  status: string
}
```

---

## 开发约定

### 1. API响应格式

**成功响应**:
```json
{
  "success": true,
  "data": {
    "id": "123",
    "title": "Ticket title"
  }
}
```

**错误响应**:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "details": [...]
  }
}
```

### 2. 错误处理模式

```typescript
export async function POST(request: NextRequest) {
  try {
    // 1. 认证检查
    const user = await requireAuth()

    // 2. 参数验证
    const validation = Schema.safeParse(body)
    if (!validation.success) {
      return validationErrorResponse(validation.error.errors)
    }

    // 3. 业务逻辑
    const result = await doSomething(validation.data)

    // 4. 返回成功
    return successResponse(result, 201)

  } catch (error: any) {
    // 5. 错误处理
    if (error.message === 'Unauthorized') {
      return unauthorizedResponse()
    }
    return serverErrorResponse('Operation failed', error.message)
  }
}
```

### 3. Prisma查询模式

```typescript
// ✅ 推荐：使用include获取关联数据
const article = await prisma.faqArticle.findUnique({
  where: { id: articleId },
  include: {
    translations: true,
    ratings: true,
    category: true
  }
})

// ✅ 推荐：使用upsert处理创建/更新
await prisma.faqRating.upsert({
  where: {
    articleId_userId: {
      articleId,
      userId
    }
  },
  create: {
    articleId,
    userId,
    isHelpful: true
  },
  update: {
    isHelpful: true
  }
})

// ❌ 避免：N+1查询问题
for (const article of articles) {
  const ratings = await prisma.faqRating.findMany({
    where: { articleId: article.id }  // ❌ 每次循环都查询
  })
}
```

### 4. 国际化使用

```typescript
// 在Server Component中
import { getTranslations } from 'next-intl/server'

export default async function Page() {
  const t = await getTranslations('dashboard')

  return <h1>{t('title')}</h1>
}

// 在Client Component中
'use client'

import { useTranslations } from 'next-intl'

export default function Component() {
  const t = useTranslations('dashboard')

  return <h1>{t('title')}</h1>
}
```

### 5. 环境变量

`.env.local` 示例:
```env
# 数据库
DATABASE_URL="file:./dev.db"

# Zammad集成
ZAMMAD_URL="http://172.16.40.22:8080"
ZAMMAD_API_TOKEN="your_token_here"

# Socket.IO (可选)
SOCKET_IO_PORT=3001

# 文件存储 (计划中)
STORAGE_BUCKET_MESSAGE_ATTACHMENTS="message-attachments"
STORAGE_BUCKET_AVATARS="avatars"
STORAGE_BUCKET_TICKET_ATTACHMENTS="ticket-attachments"
```

---

## 已知问题

### 🔴 P0 - 紧急Bug

| ID | 位置 | 问题 | 影响 |
|----|------|------|------|
| BUG-001 | `src/app/(staff)/conversations/page.tsx:108` | `TypeError: conversations.filter is not a function` | Staff无法访问对话页面 |
| BUG-002 | Staff tickets路由 | 工单ID从60097截断为97 | 工单详情404错误 |
| BUG-003 | `/staff/knowledge` | 页面不存在 | Staff无法浏览知识库 |
| BUG-004 | `src/app/(customer)/my-tickets/page.tsx:173,200` | 跳转到`/staff/tickets/{id}`而非`/my-tickets/{id}` | Customer无法查看工单详情 |
| BUG-005 | SSE连接 | Heartbeat timeout | 实时更新失效 |

### ⚠️ P1 - 高优先级问题

| ID | 问题 | 说明 |
|----|------|------|
| ISSUE-001 | 工单列表为空 | Customer看不到自己的工单，可能是Zammad用户映射问题 |
| ISSUE-002 | 文件上传Mock | API存在但只返回mock数据，未实际保存文件 |
| ISSUE-003 | Mock认证 | 使用mock-auth.ts，需要替换为真实认证系统 |
| ISSUE-004 | Mock数据 | 使用mock-data.ts内存存储，需要迁移到数据库 |

---

## 待实现功能

### Customer Portal

- [x] FAQ浏览和搜索
- [x] FAQ评分后端API
- [ ] FAQ评分前端UI集成
- [x] 在线对话（AI助手）
- [ ] 在线对话（文件附件）
- [ ] 工单创建（文件附件）
- [ ] 工单列表显示
- [ ] 工单详情查看
- [ ] 通知中心
- [ ] 帮助引导

### Staff Portal

- [ ] Conversations页面修复
- [ ] Tickets详情页路由修复
- [ ] Knowledge Base页面创建
- [ ] 工单分配功能
- [ ] 响应模板系统
- [ ] 对话升级工作流
- [ ] 批量操作
- [ ] Dashboard KPI
- [ ] 队列管理

### Admin Portal

- [x] FAQ管理
- [x] 用户管理
- [x] 系统设置
- [ ] 业务类型管理（当前是占位页面）
- [ ] 高级分析报表

### 共同功能

- [ ] 真实文件存储实现
- [ ] SSE连接稳定性优化
- [ ] 真实认证系统
- [ ] 数据库迁移（SQLite → PostgreSQL）
- [ ] WebSocket实时通信

---

## 快速开始指南

### 开发环境设置

```bash
# 1. 克隆仓库
git clone <repo-url>
cd customer-service-platform

# 2. 安装依赖
npm install

# 3. 设置环境变量
cp .env.example .env.local
# 编辑 .env.local 填入Zammad配置

# 4. 初始化数据库
npx prisma generate
npx prisma db push

# 5. 填充测试数据（可选）
npm run db:seed

# 6. 启动开发服务器
npm run dev
# 访问: http://localhost:3010
```

### 测试账户

```
Customer: customer@test.com / password123
Staff:    staff@test.com / password123
Admin:    admin@test.com / password123
```

### 常用命令

```bash
# 开发
npm run dev              # 启动开发服务器 (端口3010)
npm run type-check       # TypeScript类型检查
npm run lint             # ESLint检查

# 生产
npm run build            # 构建生产版本
npm run start            # 启动生产服务器

# 数据库
npx prisma studio        # 打开Prisma Studio
npx prisma generate      # 生成Prisma Client
npx prisma db push       # 同步schema到数据库
npm run db:seed          # 填充测试数据
```

---

## 下一步行动

### 立即修复 (Week 1)
1. 修复 Staff Conversations 页面Bug
2. 修复 Tickets 路由错误
3. 创建 Staff Knowledge Base 页面
4. 修复 SSE 连接问题
5. 修复 Customer 工单路由

### 核心功能 (Week 2-4)
1. 实现真实文件上传存储
2. 实现工单分配系统
3. 创建响应模板功能
4. 完善FAQ评分UI
5. 解决工单列表为空问题

### 数据迁移 (Week 5-6)
1. 替换mock认证为真实系统
2. 替换mock数据为数据库存储
3. 考虑迁移到PostgreSQL

---

## 参考资料

- [Next.js 14 文档](https://nextjs.org/docs)
- [Prisma 文档](https://www.prisma.io/docs)
- [shadcn/ui 组件](https://ui.shadcn.com)
- [Zammad API 文档](https://docs.zammad.org/en/latest/api/intro.html)
- [项目CLAUDE.md](../CLAUDE.md)
- [优化提案总览](./changes/OPTIMIZATION-OVERVIEW.md)

---

**📌 重要提示**:
- 本文档会随着项目进展持续更新
- 任何架构变更都应该更新此文档
- 新加入的开发者应先阅读此文档

**最后更新**: 2025-11-12 by Claude Code
