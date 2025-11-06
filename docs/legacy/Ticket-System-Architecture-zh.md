# 🎫 纯工单系统架构设计

> 基于现有 howen-ai-chat 项目的 Supabase + Zammad 集成，设计一个纯工单管理系统

**创建时间**: 2025-10-27  
**版本**: v1.0  
**状态**: 设计阶段

---

## 📋 目录

1. [系统概述](#系统概述)
2. [核心功能](#核心功能)
3. [技术栈](#技术栈)
4. [架构设计](#架构设计)
5. [数据库设计](#数据库设计)
6. [API 端点清单](#api-端点清单)
7. [认证流程](#认证流程)
8. [数据流设计](#数据流设计)
9. [AI 功能预留](#ai-功能预留)
10. [部署建议](#部署建议)

---

## 系统概述

### 设计目标

基于现有 howen-ai-chat 项目，设计一个**纯工单管理系统**，核心功能包括：

- ✅ **Supabase 用户认证**：自定义 JWT 认证（非 Supabase Auth）
- ✅ **Zammad 工单系统**：完整的工单 CRUD 操作
- ✅ **用户管理**：Supabase 用户与 Zammad 用户同步
- 🔮 **AI 功能预留**：为未来 AI 辅助功能预留接口

### 系统特点

1. **模块化设计**：认证、工单、用户管理独立模块
2. **安全优先**：JWT + RLS + Token 验证多层安全
3. **可扩展性**：预留 AI 接口，便于未来集成
4. **现有基础**：基于已验证的 Supabase + Zammad 架构

---

## 核心功能

### 1. 用户认证模块

- **注册**：创建 Supabase 用户 + 自动创建 Zammad Customer
- **登录**：JWT Token 认证（7天有效期）
- **Token 验证**：中间件验证 JWT
- **用户同步**：Supabase ↔ Zammad 用户关联

### 2. 工单管理模块

- **创建工单**：支持普通工单和从聊天记录创建
- **查询工单**：分页、搜索、筛选
- **更新工单**：状态、优先级、分配
- **工单详情**：包含文章（articles）历史
- **添加回复**：工单文章（ticket articles）

### 3. 用户管理模块

- **用户信息**：查看和更新个人信息
- **Zammad 关联**：查看 Zammad 用户 ID 和关联状态
- **权限管理**：基于 RLS 的数据访问控制

---

## 技术栈

### 前端
- **框架**: Next.js 14 (App Router)
- **UI**: React + TailwindCSS + shadcn/ui
- **状态管理**: React Hooks (useAuth, useTicketManager, useZammadAuth)
- **HTTP 客户端**: Fetch API

### 后端
- **运行时**: Next.js API Routes (Node.js)
- **认证**: JWT (jsonwebtoken) + bcrypt
- **验证**: Zod Schema
- **日志**: 自定义 Logger (lib/logger.ts)

### 数据库
- **主数据库**: Supabase (PostgreSQL)
- **工单系统**: Zammad (独立实例)
- **安全**: Row Level Security (RLS)

### 部署
- **平台**: Vercel / 自托管
- **数据库**: Supabase Cloud
- **工单**: Zammad 自托管或云服务

---

## 架构设计

### 系统架构图

\`\`\`mermaid
graph TB
    subgraph "客户端层"
        WebApp[Web 应用<br/>Next.js 14]
        MobileApp[移动端<br/>未来扩展]
    end

    subgraph "API 层 - Next.js API Routes"
        AuthAPI[认证 API<br/>/api/auth/*]
        TicketAPI[工单 API<br/>/api/zammad/tickets]
        UserAPI[用户 API<br/>/api/user/*]
        ConfigAPI[配置 API<br/>/api/config]
        HealthAPI[健康检查<br/>/api/healthz/*]
        AIPlaceholder[AI API 预留<br/>/api/ai/*]
    end

    subgraph "业务逻辑层"
        AuthMiddleware[认证中间件<br/>JWT 验证]
        ZammadClient[Zammad 客户端<br/>lib/zammad.ts]
        SupabaseClient[Supabase 客户端<br/>lib/supabase/*]
        Logger[日志系统<br/>lib/logger.ts]
    end

    subgraph "数据层"
        Supabase[(Supabase<br/>PostgreSQL)]
        Zammad[(Zammad<br/>工单系统)]
    end

    WebApp --> AuthAPI
    WebApp --> TicketAPI
    WebApp --> UserAPI
    WebApp --> ConfigAPI
    MobileApp -.-> AuthAPI
    MobileApp -.-> TicketAPI

    AuthAPI --> AuthMiddleware
    TicketAPI --> AuthMiddleware
    UserAPI --> AuthMiddleware
    ConfigAPI --> AuthMiddleware

    AuthMiddleware --> SupabaseClient
    TicketAPI --> ZammadClient
    AuthAPI --> SupabaseClient
    UserAPI --> SupabaseClient

    SupabaseClient --> Supabase
    ZammadClient --> Zammad

    AuthAPI --> Logger
    TicketAPI --> Logger
    UserAPI --> Logger

    style AIPlaceholder fill:#f9f,stroke:#333,stroke-dasharray: 5 5
    style MobileApp fill:#f9f,stroke:#333,stroke-dasharray: 5 5
\`\`\`

### 模块依赖关系

\`\`\`mermaid
graph LR
    subgraph "核心模块"
        Auth[认证模块]
        Ticket[工单模块]
        User[用户模块]
    end

    subgraph "基础设施"
        DB[Supabase 数据库]
        Zammad[Zammad API]
        Logger[日志系统]
    end

    subgraph "未来扩展"
        AI[AI 辅助模块]
    end

    Auth --> DB
    Auth --> Zammad
    Ticket --> Zammad
    Ticket --> Auth
    User --> DB
    User --> Auth

    Auth --> Logger
    Ticket --> Logger
    User --> Logger

    AI -.-> Ticket
    AI -.-> User

    style AI fill:#f9f,stroke:#333,stroke-dasharray: 5 5
\`\`\`

---

## 数据库设计

### 现有表结构（保留）

#### 1. users 表
\`\`\`sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  zammad_user_id INTEGER,           -- Zammad 用户 ID
  zammad_linked BOOLEAN DEFAULT false,  -- 是否已关联 Zammad
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
\`\`\`

**说明**：
- 移除 `address` 字段（实际数据库中已不存在）
- 保留 `zammad_user_id` 和 `zammad_linked` 用于用户同步
- `password_hash` 使用 bcrypt (12 rounds)

#### 2. chat_configurations 表（可选保留）
\`\`\`sql
CREATE TABLE chat_configurations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  app_id VARCHAR(50) UNIQUE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  welcome_message TEXT,
  fastgpt_api_key VARCHAR(255),      -- 可为空，AI 功能预留
  fastgpt_app_id VARCHAR(100),       -- 可为空，AI 功能预留
  guest_quota INTEGER DEFAULT 10,
  whatsapp_number VARCHAR(20),
  theme VARCHAR(20) DEFAULT 'default',
  language VARCHAR(10) DEFAULT 'auto',
  -- Zammad 集成字段
  zammad_enabled BOOLEAN DEFAULT false,
  zammad_url VARCHAR(255),
  zammad_token VARCHAR(255),
  zammad_group VARCHAR(100) DEFAULT 'Users',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
\`\`\`

**说明**：
- 保留用于未来 AI 功能配置
- `zammad_*` 字段用于多租户 Zammad 配置
- 纯工单系统可简化此表

#### 3. chat_sessions 表（可选保留）
\`\`\`sql
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  app_id VARCHAR(50) NOT NULL REFERENCES chat_configurations(app_id),
  conversation_id VARCHAR(100) NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ip_address INET,
  user_agent TEXT,
  message_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(app_id, conversation_id)
);
\`\`\`

**说明**：
- 保留用于未来聊天功能
- 可用于从聊天创建工单的历史记录

#### 4. feedback 表（可选保留）
\`\`\`sql
CREATE TABLE feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
  message_id VARCHAR(100),
  type VARCHAR(20) CHECK (type IN ('like', 'dislike')),
  reason VARCHAR(100),
  details TEXT,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
\`\`\`

#### 5. usage_quotas 表（可选保留）
\`\`\`sql
CREATE TABLE usage_quotas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  app_id VARCHAR(50) NOT NULL REFERENCES chat_configurations(app_id),
  ip_address INET NOT NULL,
  date DATE NOT NULL,
  count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(app_id, ip_address, date)
);
\`\`\`

#### 6. analytics 表（可选保留）
\`\`\`sql
CREATE TABLE analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  app_id VARCHAR(50) NOT NULL REFERENCES chat_configurations(app_id),
  event_type VARCHAR(50) NOT NULL,
  event_data JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
\`\`\`

### 新增表（工单系统专用）

#### 7. ticket_cache 表（可选）
\`\`\`sql
CREATE TABLE ticket_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  zammad_ticket_id INTEGER NOT NULL,
  ticket_data JSONB NOT NULL,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, zammad_ticket_id)
);

CREATE INDEX idx_ticket_cache_user ON ticket_cache(user_id);
CREATE INDEX idx_ticket_cache_zammad_id ON ticket_cache(zammad_ticket_id);
\`\`\`

**说明**：
- 缓存 Zammad 工单数据，减少 API 调用
- 提升查询性能
- 可选实现，取决于性能需求

---

## API 端点清单

### 认证 API (`/api/auth/*`)

| 端点 | 方法 | 描述 | 认证 | 请求体 | 响应 |
|------|------|------|------|--------|------|
| `/api/auth/register` | POST | 用户注册 | ❌ | `{email, password, firstname, lastname}` | `{success, data: {user, token, zammadLinked}}` |
| `/api/auth/register-simple` | POST | 简化注册（无 Zammad） | ❌ | `{email, password, firstname, lastname}` | `{success, data: {user, token}}` |
| `/api/auth/login` | POST | 用户登录 | ❌ | `{email, password}` | `{success, data: {user, token, zammadLinked}}` |
| `/api/auth/verify` | GET | 验证 Token | ✅ | Header: `Authorization: Bearer <token>` | `{success, data: {userId, email, type}}` |

### Zammad 认证 API (`/api/zammad/auth`)

| 端点 | 方法 | 描述 | 认证 | 请求体/查询 | 响应 |
|------|------|------|------|-------------|------|
| `/api/zammad/auth` | POST | Zammad 登录 | ❌ | `{username, password, zammadUrl?}` | `{success, data: {user, token, zammadUrl}}` |
| `/api/zammad/auth` | GET | 验证 Zammad Token | ❌ | Query: `token, zammadUrl?` | `{success, data: {user, zammadUrl}}` |
| `/api/zammad/auth` | DELETE | Zammad 登出 | ❌ | - | `{success, message}` |

### 工单 API (`/api/zammad/tickets`)

| 端点 | 方法 | 描述 | 认证 | 请求体/查询 | 响应 |
|------|------|------|------|-------------|------|
| `/api/zammad/tickets` | POST | 创建工单 | ✅ | `{title, body, customerEmail, priority?, groupName?, token, zammadUrl?}` | `{success, data: {ticket}}` |
| `/api/zammad/tickets` | POST | 从聊天创建工单 | ✅ | `{chatHistory[], customerEmail, title?, priority?, groupName?, token, zammadUrl?}` | `{success, data: {ticket}}` |
| `/api/zammad/tickets` | GET | 查询工单列表 | ✅ | Query: `token, zammadUrl?, page?, limit?, search?` | `{success, data: {tickets[], pagination}}` |

### 工单详情 API (`/api/zammad/tickets/[id]`)

| 端点 | 方法 | 描述 | 认证 | 请求体/查询 | 响应 |
|------|------|------|------|-------------|------|
| `/api/zammad/tickets/[id]` | GET | 获取工单详情 | ✅ | Query: `token, zammadUrl?` | `{success, data: {ticket}}` |
| `/api/zammad/tickets/[id]` | PUT | 更新工单 | ✅ | `{state_id?, priority_id?, ...}` + Query: `token, zammadUrl?` | `{success, data: {ticket}}` |
| `/api/zammad/tickets/[id]/articles` | GET | 获取工单文章 | ✅ | Query: `token, zammadUrl?` | `{success, data: {articles[]}}` |
| `/api/zammad/tickets/[id]/articles` | POST | 添加工单回复 | ✅ | `{body, subject?, internal?}` + Query: `token, zammadUrl?` | `{success, data: {article}}` |

### 用户 API (`/api/user/*`)（需新增）

| 端点 | 方法 | 描述 | 认证 | 请求体 | 响应 |
|------|------|------|------|--------|------|
| `/api/user/profile` | GET | 获取用户信息 | ✅ | - | `{success, data: {user}}` |
| `/api/user/profile` | PUT | 更新用户信息 | ✅ | `{first_name?, last_name?}` | `{success, data: {user}}` |
| `/api/user/zammad-link` | GET | 获取 Zammad 关联状态 | ✅ | - | `{success, data: {zammadLinked, zammadUserId}}` |

### 健康检查 API (`/api/healthz/*`)

| 端点 | 方法 | 描述 | 认证 | 响应 |
|------|------|------|------|------|
| `/api/healthz` | GET | 基础健康检查 | ❌ | `{status: "ok", timestamp}` |
| `/api/healthz/database` | GET | 数据库健康检查 | ❌ | `{status, checks: {...}}` |
| `/api/healthz/schema` | GET | 数据库 Schema 验证 | ❌ | `{status, tables: [...]}` |

---

## 认证流程

### 1. 用户注册流程

\`\`\`mermaid
sequenceDiagram
    participant User as 用户
    participant API as /api/auth/register
    participant Supabase as Supabase DB
    participant Zammad as Zammad API

    User->>API: POST {email, password, firstname, lastname}
    API->>API: 验证输入 (Zod)
    API->>Supabase: 检查用户是否存在
    API->>Zammad: 检查 Zammad 用户是否存在
    
    alt 用户已存在
        API-->>User: 409 Conflict
    else 用户不存在
        API->>API: bcrypt.hash(password, 12)
        API->>Supabase: INSERT INTO users
        API->>Zammad: 创建 Customer (findOrCreateCustomer)
        
        alt Zammad 创建成功
            API->>Supabase: UPDATE users SET zammad_user_id, zammad_linked=true
        end
        
        API->>API: sign JWT (7天有效期)
        API-->>User: 200 OK {user, token, zammadLinked}
    end
\`\`\`

### 2. 用户登录流程

\`\`\`mermaid
sequenceDiagram
    participant User as 用户
    participant API as /api/auth/login
    participant Supabase as Supabase DB

    User->>API: POST {email, password}
    API->>API: 验证输入 (Zod)
    API->>Supabase: SELECT * FROM users WHERE email=?
    
    alt 用户不存在
        API-->>User: 401 Unauthorized
    else 用户存在
        API->>API: bcrypt.compare(password, password_hash)
        
        alt 密码错误
            API-->>User: 401 Unauthorized
        else 密码正确
            API->>API: sign JWT (userId, email, type='user_auth')
            API-->>User: 200 OK {user, token, zammadLinked}
        end
    end
\`\`\`

### 3. JWT 验证流程（中间件）

\`\`\`mermaid
sequenceDiagram
    participant Client as 客户端
    participant Middleware as authenticateRequest
    participant Supabase as Supabase DB
    participant API as API Handler

    Client->>Middleware: Request + Header: Authorization: Bearer <token>
    
    alt Token 缺失
        Middleware-->>Client: 401 AUTH_MISSING_TOKEN
    else Token 存在
        Middleware->>Middleware: verify(token, JWT_SECRET)
        
        alt Token 无效/过期
            Middleware-->>Client: 401 AUTH_INVALID_TOKEN
        else Token 有效
            Middleware->>Supabase: SELECT * FROM users WHERE id=? AND is_active=true
            
            alt 用户不存在/未激活
                Middleware-->>Client: 401 AUTH_USER_NOT_FOUND
            else 用户有效
                Middleware->>API: 传递 AuthContext {userId, email, token, supabase}
                API-->>Client: 200 OK (业务响应)
            end
        end
    end
\`\`\`

---

## 数据流设计

### 工单创建数据流

\`\`\`mermaid
graph LR
    A[用户提交工单] --> B{认证检查}
    B -->|未认证| C[返回 401]
    B -->|已认证| D[验证输入 Zod]
    D --> E{Zammad Token 验证}
    E -->|无效| F[返回 401]
    E -->|有效| G[查找/创建 Customer]
    G --> H[查找 Group ID]
    H --> I[创建 Zammad Ticket]
    I --> J{创建成功?}
    J -->|失败| K[Fallback 硬编码]
    J -->|成功| L[返回工单数据]
    K --> L
    L --> M[记录日志]
    M --> N[返回 200 OK]
\`\`\`

### 用户同步数据流

\`\`\`mermaid
graph TB
    A[用户注册] --> B[创建 Supabase 用户]
    B --> C{Zammad 集成启用?}
    C -->|否| D[完成注册]
    C -->|是| E[调用 findOrCreateCustomer]
    E --> F{Zammad 用户存在?}
    F -->|是| G[返回现有用户]
    F -->|否| H[创建新 Customer]
    G --> I[更新 Supabase users.zammad_user_id]
    H --> I
    I --> J[设置 zammad_linked=true]
    J --> D
\`\`\`

---

## AI 功能预留

### 预留接口设计

#### 1. AI 辅助回复 API（未来）
\`\`\`
POST /api/ai/suggest-reply
Authorization: Bearer <token>
Body: {
  ticketId: number,
  context: string,
  language?: string
}
Response: {
  success: boolean,
  data: {
    suggestedReply: string,
    confidence: number
  }
}
\`\`\`

#### 2. AI 工单分类 API（未来）
\`\`\`
POST /api/ai/classify-ticket
Authorization: Bearer <token>
Body: {
  title: string,
  body: string
}
Response: {
  success: boolean,
  data: {
    category: string,
    priority: number,
    suggestedGroup: string
  }
}
\`\`\`

#### 3. AI 聊天 API（未来）
\`\`\`
POST /api/ai/chat
Authorization: Bearer <token>
Body: {
  message: string,
  conversationId?: string,
  context?: object
}
Response: {
  success: boolean,
  data: {
    reply: string,
    conversationId: string
  }
}
\`\`\`

### 数据库预留字段

- `chat_configurations.fastgpt_api_key`：FastGPT API 密钥
- `chat_configurations.fastgpt_app_id`：FastGPT 应用 ID
- `chat_sessions` 表：保留用于聊天历史
- `analytics` 表：保留用于 AI 使用分析

---

## 部署建议

### 环境变量配置

\`\`\`env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Zammad
ZAMMAD_BASE_URL=https://your-zammad.com
ZAMMAD_SYSTEM_TOKEN=your_system_token
ZAMMAD_DEFAULT_GROUP=Users

# JWT
JWT_SECRET=your_super_secret_jwt_key

# 应用
NEXT_PUBLIC_APP_URL=https://your-domain.com
NODE_ENV=production
LOG_LEVEL=info
\`\`\`

### 部署步骤

1. **数据库迁移**
   \`\`\`bash
   # 在 Supabase 控制台执行
   supabase/migrations/001_initial_schema.sql
   \`\`\`

2. **环境变量配置**
   - Vercel: 在 Settings → Environment Variables 配置
   - 自托管: 创建 `.env.production` 文件

3. **构建部署**
   \`\`\`bash
   npm run build
   npm run start
   \`\`\`

4. **健康检查**
   \`\`\`bash
   curl https://your-domain.com/api/healthz
   curl https://your-domain.com/api/healthz/database
   \`\`\`

---

## 总结

### 核心优势

1. ✅ **安全可靠**：JWT + RLS + Token 多层验证
2. ✅ **模块化**：认证、工单、用户独立模块
3. ✅ **可扩展**：预留 AI 接口，便于未来集成
4. ✅ **已验证**：基于现有 howen-ai-chat 架构

### 下一步行动

1. **简化数据库**：移除不必要的表（如 analytics、feedback）
2. **实现用户 API**：补充 `/api/user/*` 端点
3. **前端开发**：基于 shadcn/ui 构建工单管理界面
4. **测试部署**：在测试环境验证完整流程
5. **文档完善**：API 文档、用户手册

---

**相关文档**：
- [项目架构图](./Project-Architecture-zh.md)
- [数据库 ER 图](./Database-ER-Diagram-zh.md)
- [API 文档](./API-Documentation-zh.md)
- [配置指南](./Configuration-Guide-zh.md)

