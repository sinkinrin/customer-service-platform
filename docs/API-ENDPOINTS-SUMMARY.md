# 📋 API 端点清单

> Customer Service Platform - 完整的 API 端点快速参考

**文档版本**: 1.0  
**最后更新**: 2025-10-27  
**详细文档**: [05-API设计.md](./05-API设计.md)

---

## 端点总览

**总计**: 32 个 RESTful 端点 + 15+ WebSocket 事件

| 分类 | 端点数量 | 认证要求 |
|------|----------|----------|
| 认证相关 | 3 | 部分需要 |
| 业务类型 | 1 | 不需要 |
| 对话管理 | 7 | 需要 |
| 消息管理 | 3 | 需要 |
| FAQ 管理 | 6 | 部分需要 |
| 工单管理 | 5 | 需要 |
| 员工功能 | 5 | 需要（员工） |
| Zammad 集成 | 2 | 部分需要 |

---

## 1. 认证相关 API (3)

| 方法 | 端点 | 认证 | 描述 |
|------|------|------|------|
| POST | `/api/v1/auth/register` | ❌ | 用户注册 |
| POST | `/api/v1/auth/login` | ❌ | 用户登录 |
| GET | `/api/v1/auth/verify` | ✅ | 验证 Token |

---

## 2. 业务类型 API (1)

| 方法 | 端点 | 认证 | 描述 |
|------|------|------|------|
| GET | `/api/v1/business-types` | ❌ | 获取业务类型列表 |

---

## 3. 对话管理 API (7)

| 方法 | 端点 | 认证 | 角色 | 描述 |
|------|------|------|------|------|
| POST | `/api/v1/conversations` | 可选 | All | 创建对话 |
| GET | `/api/v1/conversations` | ✅ | All | 获取对话列表 |
| GET | `/api/v1/conversations/:id` | ✅ | All | 获取对话详情 |
| POST | `/api/v1/conversations/:id/request-staff` | ✅ | Customer | 请求人工接入 |
| POST | `/api/v1/conversations/:id/assign` | ✅ | Staff/Admin | 分配对话 |
| PUT | `/api/v1/conversations/:id/close` | ✅ | Staff/Admin | 关闭对话 |
| POST | `/api/v1/conversations/:id/rate` | ✅ | Customer | 评价对话 |

---

## 4. 消息管理 API (3)

| 方法 | 端点 | 认证 | 描述 |
|------|------|------|------|
| GET | `/api/v1/conversations/:id/messages` | ✅ | 获取消息列表 |
| POST | `/api/v1/conversations/:id/messages` | ✅ | 发送消息 |
| PUT | `/api/v1/conversations/:id/messages/read` | ✅ | 标记已读 |

---

## 5. FAQ 管理 API (6)

| 方法 | 端点 | 认证 | 描述 |
|------|------|------|------|
| GET | `/api/v1/faq/categories` | ❌ | 获取 FAQ 分类 |
| GET | `/api/v1/faq/items` | ❌ | 获取 FAQ 列表 |
| GET | `/api/v1/faq/items/:id` | ❌ | 获取 FAQ 详情 |
| POST | `/api/v1/faq/search` | ❌ | 搜索 FAQ |
| GET | `/api/v1/faq/keywords/suggest` | ❌ | 关键词建议 |
| POST | `/api/v1/faq/items/:id/feedback` | ❌ | 反馈有用性 |

---

## 6. 工单管理 API (5)

| 方法 | 端点 | 认证 | 角色 | 描述 |
|------|------|------|------|------|
| POST | `/api/v1/tickets` | ✅ | Customer | 创建工单 |
| GET | `/api/v1/tickets` | ✅ | All | 获取工单列表 |
| GET | `/api/v1/tickets/:id` | ✅ | All | 获取工单详情 |
| PUT | `/api/v1/tickets/:id` | ✅ | Staff/Admin | 更新工单 |
| POST | `/api/v1/tickets/:id/articles` | ✅ | All | 添加工单回复 |

---

## 7. 员工功能 API (5)

| 方法 | 端点 | 认证 | 角色 | 描述 |
|------|------|------|------|------|
| GET | `/api/v1/staff/queue` | ✅ | Staff/Admin | 获取对话队列 |
| GET | `/api/v1/staff/customers/:id` | ✅ | Staff/Admin | 获取客户信息 |
| GET | `/api/v1/staff/quick-replies` | ✅ | Staff/Admin | 获取快捷回复 |
| POST | `/api/v1/staff/quick-replies` | ✅ | Staff/Admin | 创建快捷回复 |
| GET | `/api/v1/staff/analytics` | ✅ | Staff/Admin | 获取绩效统计 |

---

## 8. Zammad 集成 API (2)

| 方法 | 端点 | 认证 | 描述 |
|------|------|------|------|
| POST | `/api/v1/zammad/auth` | ❌ | Zammad 认证 |
| GET | `/api/v1/zammad/auth/verify` | ❌ | 验证 Zammad Token |

---

## WebSocket 事件

### 客户端 → 服务器

| 事件名 | Payload | 描述 |
|--------|---------|------|
| `conversation:join` | `{ conversationId }` | 加入对话房间 |
| `message:send` | `{ conversationId, content, contentType }` | 发送消息 |
| `message:typing` | `{ conversationId, isTyping }` | 正在输入 |
| `message:read` | `{ conversationId, messageIds }` | 标记已读 |

### 服务器 → 客户端

| 事件名 | Payload | 描述 |
|--------|---------|------|
| `message:new` | `{ message }` | 新消息 |
| `message:typing` | `{ conversationId, userId, isTyping }` | 对方正在输入 |
| `message:read` | `{ conversationId, messageIds, readBy }` | 消息已读 |
| `conversation:status` | `{ conversationId, status, staffId }` | 对话状态变更 |
| `conversation:assigned` | `{ conversationId, staff }` | 对话分配 |
| `conversation:closed` | `{ conversationId, reason }` | 对话关闭 |
| `queue:new` | `{ conversation }` | 新对话进入队列 |
| `queue:update` | `{ queueLength, avgWaitTime }` | 队列更新 |
| `ticket:status` | `{ ticketId, status, updatedBy }` | 工单状态更新 |
| `ticket:article` | `{ ticketId, article }` | 工单新回复 |
| `ticket:assigned` | `{ ticketId, staff }` | 工单分配 |
| `error` | `{ code, message }` | 错误事件 |

---

## 速率限制

| 端点类别 | 限制 | 时间窗口 |
|----------|------|----------|
| 认证 | 5 次 | 15 分钟 |
| 对话 | 60 次 | 1 分钟 |
| 配置 | 100 次 | 15 分钟 |
| FAQ 搜索 | 30 次 | 1 分钟 |
| 工单创建 | 10 次 | 1 小时 |

---

## 错误码

### 认证相关
- `AUTH_MISSING_TOKEN`: 缺少认证 token
- `AUTH_INVALID_TOKEN`: token 无效或已过期
- `AUTH_USER_NOT_FOUND`: 用户不存在或已禁用
- `AUTH_CONFIG_ERROR`: 认证配置错误

### 验证相关
- `VALIDATION_ERROR`: 请求参数验证失败
- `INVALID_EMAIL`: 邮箱格式无效
- `INVALID_PASSWORD`: 密码格式无效

### 业务逻辑
- `EMAIL_EXISTS`: 邮箱已存在
- `INVALID_CREDENTIALS`: 邮箱或密码错误
- `USER_INACTIVE`: 用户已被禁用
- `CONVERSATION_NOT_FOUND`: 对话不存在
- `TICKET_NOT_FOUND`: 工单不存在
- `FAQ_NOT_FOUND`: FAQ 不存在
- `ACCESS_DENIED`: 无权访问
- `INSUFFICIENT_PERMISSIONS`: 权限不足

### 速率限制
- `RATE_LIMIT_EXCEEDED`: 超过速率限制

### 外部服务
- `ZAMMAD_ERROR`: Zammad 服务错误
- `ZAMMAD_SYNC_FAILED`: Zammad 同步失败
- `FASTGPT_ERROR`: FastGPT 服务错误

### 系统错误
- `INTERNAL_ERROR`: 服务器内部错误
- `DATABASE_ERROR`: 数据库错误
- `NETWORK_ERROR`: 网络错误

---

## HTTP 状态码

| 状态码 | 含义 | 使用场景 |
|--------|------|----------|
| 200 | OK | 请求成功 |
| 201 | Created | 资源创建成功 |
| 400 | Bad Request | 请求参数错误、验证失败 |
| 401 | Unauthorized | 未认证或 token 无效 |
| 403 | Forbidden | 已认证但无权限 |
| 404 | Not Found | 资源不存在 |
| 409 | Conflict | 资源冲突 |
| 429 | Too Many Requests | 速率限制 |
| 500 | Internal Server Error | 服务器错误 |
| 502 | Bad Gateway | 外部服务错误 |
| 503 | Service Unavailable | 服务暂时不可用 |

---

## 快速开始示例

### 1. 用户注册和登录

```bash
# 注册
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123",
    "firstName": "John",
    "lastName": "Doe"
  }'

# 登录
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123"
  }'
```

### 2. 创建对话并发送消息

```bash
# 创建对话
curl -X POST http://localhost:3000/api/v1/conversations \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "businessTypeId": "uuid-here",
    "initialMessage": "Hello, I need help!"
  }'

# 发送消息
curl -X POST http://localhost:3000/api/v1/conversations/CONVERSATION_ID/messages \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "My order number is #12345",
    "contentType": "text"
  }'
```

### 3. 搜索 FAQ

```bash
curl -X POST http://localhost:3000/api/v1/faq/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "reset password",
    "locale": "en",
    "limit": 10
  }'
```

### 4. 创建工单

```bash
curl -X POST http://localhost:3000/api/v1/tickets \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Unable to access my account",
    "description": "I have been trying to log in for the past hour...",
    "priority": "high",
    "category": "account"
  }'
```

---

**相关文档**:
- [完整 API 设计文档](./05-API设计.md)
- [数据库设计](./04-数据库设计.md)
- [业务流程](./02-业务流程.md)
- [需求规格说明](./01-需求规格说明.md)

