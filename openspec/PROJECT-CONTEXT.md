# Customer Service Platform - 项目技术上下文

> 📅 **最后更新**: 2025-12-12 | 📌 **版本**: v0.1.0

---

## 项目概览

| 项目 | 值 |
|------|-----|
| **框架** | Next.js 16.0.10 (App Router) |
| **语言** | TypeScript 5.3 |
| **端口** | 3010 |
| **数据库** | SQLite (Prisma 6.19) |
| **认证** | NextAuth.js 5.0.0-beta.30 |
| **工单系统** | Zammad REST API |
| **i18n** | next-intl 4.5.7 (6语言) |

### 功能模块

| 模块 | 功能 |
|------|------|
| **Customer Portal** | FAQ自助、在线对话、工单管理 |
| **Staff Portal** | 工单处理、对话管理、知识库 |
| **Admin Panel** | FAQ管理、用户管理、系统设置 |

---

## 技术栈

| 类别 | 技术 | 版本 |
|------|------|------|
| **框架** | Next.js | 16.0.10 |
| **UI** | React | 19.2.1 |
| **样式** | Tailwind CSS | 3.4.18 |
| **组件** | shadcn/ui (Radix) | - |
| **状态** | Zustand | 5.0.8 |
| **表单** | React Hook Form + Zod | 7.65 / 3.22 |
| **ORM** | Prisma | 6.19.0 |
| **认证** | NextAuth.js | 5.0.0-beta.30 |
| **i18n** | next-intl | 4.5.7 |

---

## 目录结构

```
src/
├── app/
│   ├── admin/          # 管理后台
│   ├── api/            # API路由 (40+端点)
│   ├── auth/           # 认证页面
│   ├── customer/       # 客户门户
│   └── staff/          # 员工门户
├── components/
│   ├── ui/             # shadcn/ui (23组件)
│   ├── conversation/   # 对话组件
│   ├── faq/            # FAQ组件
│   └── ticket/         # 工单组件
├── lib/
│   ├── hooks/          # 自定义Hooks
│   ├── stores/         # Zustand (auth, conversation, ticket)
│   ├── zammad/         # Zammad客户端
│   └── utils/          # 工具函数
└── types/              # TypeScript类型

prisma/schema.prisma    # 数据库模型
messages/               # i18n翻译 (6语言)
```

---

## 数据库模型 (Prisma)

```prisma
// 已实现
FaqCategory      # FAQ分类
FaqArticle       # FAQ文章
FaqArticleTranslation  # 多语言翻译
FaqRating        # 用户评分
```

---

## API端点

### 认证
| 端点 | 说明 |
|------|------|
| `/api/auth/[...nextauth]` | NextAuth.js处理器 |

### 工单 (Zammad)
| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/tickets` | GET/POST | 列表/创建 |
| `/api/tickets/[id]` | GET/PUT | 详情/更新 |
| `/api/tickets/[id]/articles` | GET/POST | 回复列表/添加 |
| `/api/tickets/search` | GET | 搜索 |

### 通知
| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/notifications` | GET | 列表 (limit/offset/unread) |
| `/api/notifications/unread-count` | GET | 未读数量 |
| `/api/notifications/[id]/read` | PUT | 标记单条已读 |
| `/api/notifications/read-all` | PUT | 全部已读 |
| `/api/notifications/[id]` | DELETE | 删除 |

### 对话
| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/conversations` | GET/POST | 列表/创建 |
| `/api/conversations/[id]` | GET/PUT | 详情/更新 |
| `/api/conversations/[id]/messages` | GET/POST | 消息 |

### FAQ
| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/faq` | GET | 搜索 |
| `/api/faq/categories` | GET | 分类列表 |
| `/api/faq/[id]/rating` | POST | 评分 |

### 管理
| 端点 | 说明 |
|------|------|
| `/api/admin/faq` | FAQ管理 |
| `/api/admin/users` | 用户管理 |
| `/api/admin/settings` | 系统设置 |

### 其他
| 端点 | 说明 |
|------|------|
| `/api/health` | 健康检查 |
| `/api/sse/tickets` | SSE实时更新 |
| `/api/ai/chat` | AI对话 |

---

## 核心代码模式

### 认证检查
```typescript
import { requireAuth } from '@/lib/utils/auth'

export async function GET() {
  const user = await requireAuth()
  // user: { id, email, role, region, ... }
}
```

### API响应
```typescript
import { successResponse, errorResponse } from '@/lib/utils/api-response'

return successResponse({ data }, 200)
return errorResponse('Not found', 404)
```

### Zammad客户端
```typescript
import { zammadClient } from '@/lib/zammad/client'

const tickets = await zammadClient.getAllTickets()
const ticket = await zammadClient.createTicket(data, onBehalfOf)
```

### Zustand Store
```typescript
import { useAuthStore } from '@/lib/stores/auth-store'
const { user, signIn, signOut } = useAuthStore()
```

---

## 环境变量

```env
# 必需
AUTH_SECRET=xxx
DATABASE_URL=file:./dev.db
ZAMMAD_URL=http://xxx:8080/
ZAMMAD_API_TOKEN=xxx

# 可选
FASTGPT_API_KEY=xxx
LOG_LEVEL=info
```

---

## 快速开始

```bash
npm install
cp .env.example .env.local
npx prisma migrate dev
npm run db:seed
npm run dev  # http://localhost:3010
```

### 测试账户
- Customer: `customer@test.com`
- Staff: `staff@test.com`
- Admin: `admin@test.com`

---

## 常用命令

```bash
npm run dev          # 开发服务器
npm run build        # 生产构建
npm run type-check   # 类型检查
npm run db:seed      # 填充数据
npm run i18n:check   # 验证翻译
npx prisma studio    # 数据库GUI
```

---

**最后更新**: 2025-12-12
