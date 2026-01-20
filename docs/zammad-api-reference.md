# Zammad API 端点参考对比

**生成日期**: 2026-01-15
**目的**: 对比 Zammad 官方 API 与本项目使用的端点

---

## 一、Zammad 官方 API 端点列表

### Tickets (工单)

| 方法 | 端点 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/v1/tickets` | 获取工单列表 | ticket.agent / ticket.customer |
| GET | `/api/v1/tickets/{id}` | 获取单个工单 | ticket.agent / ticket.customer |
| POST | `/api/v1/tickets` | 创建工单 | ticket.agent / ticket.customer |
| PUT | `/api/v1/tickets/{id}` | 更新工单 | ticket.agent / ticket.customer |
| DELETE | `/api/v1/tickets/{id}` | 删除工单 | ticket.agent |
| GET | `/api/v1/tickets/search?query={query}` | 搜索工单 | ticket.agent / ticket.customer |

### Articles (文章/回复)

| 方法 | 端点 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/v1/ticket_articles/{id}` | 获取单个文章 | ticket.agent / ticket.customer |
| GET | `/api/v1/ticket_articles/by_ticket/{ticket_id}` | 获取工单的所有文章 | ticket.agent / ticket.customer |
| POST | `/api/v1/ticket_articles` | 创建文章 | ticket.agent / ticket.customer |

### Attachments (附件)

| 方法 | 端点 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/v1/ticket_attachment/{ticket_id}/{article_id}/{attachment_id}` | 下载附件 | ticket.agent / ticket.customer |

**附件上传方式 (官方文档)**:
- **Base64 嵌入**: 在创建文章时，将附件以 base64 编码嵌入 `attachments` 数组
- **无独立上传端点**: 官方文档中没有 `/api/v1/attachments` 或 `/api/v1/upload_caches` 的说明

### Users (用户)

| 方法 | 端点 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/v1/users` | 获取所有用户 | admin.user |
| GET | `/api/v1/users/{id}` | 获取单个用户 | admin.user / 本人 |
| GET | `/api/v1/users/me` | 获取当前用户 | 任何已认证用户 |
| POST | `/api/v1/users` | 创建用户 | admin.user |
| PUT | `/api/v1/users/{id}` | 更新用户 | admin.user |
| GET | `/api/v1/users/search?query={query}` | 搜索用户 | admin.user |

### Groups (分组)

| 方法 | 端点 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/v1/groups` | 获取所有分组 | admin.group |
| GET | `/api/v1/groups/{id}` | 获取单个分组 | admin.group |
| POST | `/api/v1/groups` | 创建分组 | admin.group |

### Tags (标签)

| 方法 | 端点 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/v1/tags?object=Ticket&o_id={id}` | 获取工单标签 | ticket.agent / admin.tag |
| POST | `/api/v1/tags/add` | 添加标签 | ticket.agent / admin.tag |
| DELETE | `/api/v1/tags/remove` | 移除标签 | ticket.agent / admin.tag |

### SLAs

| 方法 | 端点 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/v1/slas` | 获取所有 SLA | admin.sla |
| GET | `/api/v1/slas/{id}` | 获取单个 SLA | admin.sla |

### Organizations (组织)

| 方法 | 端点 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/v1/organizations` | 获取所有组织 | admin.organization |

### Search (搜索)

| 方法 | 端点 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/v1/search?query={query}` | 全局搜索 | 任何已认证用户 |

### Knowledge Base (知识库)

| 方法 | 端点 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/v1/knowledge_bases/init` | 获取知识库初始化数据 | knowledge_base.reader |
| GET | `/api/v1/knowledge_bases/search?query={query}` | 搜索知识库 | knowledge_base.reader |
| POST | `/api/v1/knowledge_bases/{id}/answers/{id}/attachments` | 上传知识库附件 | knowledge_base.editor |

### Triggers (触发器)

| 方法 | 端点 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/v1/triggers` | 获取所有触发器 | admin.trigger |
| GET | `/api/v1/triggers/{id}` | 获取单个触发器 | admin.trigger |
| POST | `/api/v1/triggers` | 创建触发器 | admin.trigger |
| PUT | `/api/v1/triggers/{id}` | 更新触发器 | admin.trigger |
| DELETE | `/api/v1/triggers/{id}` | 删除触发器 | admin.trigger |

---

## 二、本项目使用的 Zammad API 端点

**文件**: `src/lib/zammad/client.ts`

### 已使用的端点

| 方法 | 端点 | 对应函数 | 状态 |
|------|------|----------|------|
| POST | `/tickets` | `createTicket()` | ✅ 官方支持 |
| GET | `/tickets/{id}` | `getTicket()` | ✅ 官方支持 |
| GET | `/tickets?page={page}&per_page={perPage}` | `getTickets()` | ✅ 官方支持 |
| PUT | `/tickets/{id}` | `updateTicket()` | ✅ 官方支持 |
| DELETE | `/tickets/{id}` | `deleteTicket()` | ✅ 官方支持 |
| GET | `/tickets/search?query={query}` | `searchTickets()` | ✅ 官方支持 |
| POST | `/ticket_articles` | `createArticle()` | ✅ 官方支持 |
| GET | `/ticket_articles/{id}` | `getArticle()` | ✅ 官方支持 |
| GET | `/ticket_articles/by_ticket/{ticketId}` | `getArticlesByTicket()` | ✅ 官方支持 |
| GET | `/ticket_attachment/{ticketId}/{articleId}/{attachmentId}` | `downloadAttachment()` | ✅ 官方支持 |
| GET | `/tags?object=Ticket&o_id={id}` | `getTags()` | ✅ 官方支持 |
| POST | `/tags/add` | `addTag()` | ✅ 官方支持 |
| DELETE | `/tags/remove` | `removeTag()` | ✅ 官方支持 |
| GET | `/slas` | `getSLAs()` | ✅ 官方支持 |
| GET | `/slas/{id}` | `getSLA()` | ✅ 官方支持 |
| GET | `/users/me` | `getCurrentUser()` | ✅ 官方支持 |
| GET | `/users/{id}` | `getUser()` | ✅ 官方支持 |
| GET | `/users` | `getAgents()` | ✅ 官方支持 |
| POST | `/users` | `createUser()` | ✅ 官方支持 |
| PUT | `/users/{id}` | `updateUser()` | ✅ 官方支持 |
| GET | `/users/search?query={query}` | `searchUsers()` | ✅ 官方支持 |
| GET | `/groups` | `getGroups()` | ✅ 官方支持 |
| GET | `/groups/{id}` | `getGroup()` | ✅ 官方支持 |
| POST | `/groups` | `createGroup()` | ✅ 官方支持 |
| GET | `/knowledge_bases/init` | `getKnowledgeBaseInit()` | ✅ 官方支持 |
| GET | `/knowledge_bases/search?query={query}` | `searchKnowledgeBase()` | ✅ 官方支持 |
| GET | `/triggers` | `getTriggers()` | ✅ 官方支持 |
| GET | `/triggers/{id}` | `getTrigger()` | ✅ 官方支持 |
| POST | `/triggers` | `createTrigger()` | ✅ 官方支持 |
| PUT | `/triggers/{id}` | `updateTrigger()` | ✅ 官方支持 |
| DELETE | `/triggers/{id}` | `deleteTrigger()` | ✅ 官方支持 |

### ⚠️ 非官方/未文档化的端点

| 方法 | 端点 | 对应函数 | 状态 |
|------|------|----------|------|
| POST | `/upload_caches/{form_id}` | `uploadAttachment()` | ⚠️ **未在官方文档中记录** |

---

## 三、附件上传机制分析

### 官方支持的方式：Base64 嵌入

```json
// POST /api/v1/ticket_articles
{
   "ticket_id": 5,
   "body": "Please see attached file...",
   "attachments": [
      {
         "filename": "portal.txt",
         "data": "VGhlIGNha2UgaXMgYSBsaWUhCg==",  // base64 编码
         "mime-type": "text/plain"
      }
   ]
}
```

**优点**:
- 官方支持，稳定可靠
- 单次请求完成

**缺点**:
- Base64 编码增加约 33% 的数据量
- 大文件可能导致请求超时
- 无法显示上传进度

### 当前实现的方式：upload_caches (未文档化)

```typescript
// POST /api/v1/upload_caches/{form_id}
// FormData: File=<binary>
```

**来源分析**:
- 这个端点可能来自 Zammad 内部实现
- 在 Zammad Web UI 中用于表单附件上传
- **不在官方 REST API 文档中**

**潜在风险**:
- 可能在 Zammad 版本升级时失效
- 缺乏官方支持和稳定性保证
- 可能存在权限或认证问题

---

## 四、建议

### 短期方案（稳定性优先）

恢复使用 **Base64 嵌入方式**，这是官方文档支持的唯一方式：

```typescript
// 在创建文章时嵌入附件
const article = {
  ticket_id: 5,
  body: "Reply with attachment",
  attachments: [
    {
      filename: file.name,
      data: btoa(fileContent),  // base64 编码
      "mime-type": file.type
    }
  ]
}
```

### 长期方案（性能优先）

1. **验证 upload_caches 端点**:
   - 检查 Zammad 源码确认该端点是否为稳定 API
   - 测试不同 Zammad 版本的兼容性

2. **混合方案**:
   - 小文件（<1MB）使用 Base64 嵌入
   - 大文件尝试 upload_caches，失败时回退到 Base64

3. **联系 Zammad 社区**:
   - 确认是否有官方的预上传附件 API
   - 了解 `upload_caches` 的稳定性承诺

---

## 五、端点兼容性检查清单

| 检查项 | 状态 |
|--------|------|
| Tickets CRUD | ✅ 完全兼容 |
| Articles CRUD | ✅ 完全兼容 |
| 附件下载 | ✅ 完全兼容 |
| 附件上传 (Base64) | ✅ 官方支持 |
| 附件上传 (upload_caches) | ⚠️ 未文档化 |
| Tags 管理 | ✅ 完全兼容 |
| Users 管理 | ✅ 完全兼容 |
| Groups 管理 | ✅ 完全兼容 |
| SLAs 查询 | ✅ 完全兼容 |
| Knowledge Base | ✅ 完全兼容 |
| Triggers 管理 | ✅ 完全兼容 |

---

## 参考资料

- [Zammad REST API 官方文档](https://docs.zammad.org/en/latest/api/intro.html)
- [Zammad GitHub 仓库](https://github.com/zammad/zammad)
- [Context7 Zammad 文档](https://context7.com/zammad/zammad-documentation)
