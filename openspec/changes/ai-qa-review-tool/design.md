# AI 问答质检工具 — 架构设计 (v3)

> v3 修订说明：
> - 暂不实现 FastGPT 数据同步，但 schema 和接口预留
> - 平台数据直查 AiMessage，不复制到 AiQaReview
> - AiQaReview 仅存审核结果 + 重测结果
> - 一键重测保留（调 FastGPT 测试 App）
> - 大幅精简实现范围

---

## 1. 架构决策

### 1.1 集成到主服务

原因见 v2（认证复用、零运维、代码可复用）。不再赘述。

### 1.2 当前范围 vs 预留

| 功能 | 当前实现 | 预留（未来） |
|------|---------|------------|
| 平台 Q&A 审核 | ✅ | — |
| 一键重测 | ✅ | — |
| CSV 导出 | ✅ | — |
| FastGPT 数据同步 | ❌ | Schema 字段 + API 路由占位 |
| FastGPT Tab | ❌ | UI 位置预留 |

### 1.3 角色权限

- **Staff + Admin** 均可访问（Staff 是主要使用者，Admin 有权限但非日常操作者）
- Staff 可查看**所有客户**的 AI 对话（质检是全局任务，不按区域限制）
- 审核操作记录 `reviewedBy` + 日志审计

### 1.4 隔离措施

- 重测的 FastGPT 调用使用 `AbortSignal.timeout` + 速率限制
- API 路由独立在 `/api/staff/ai-qa/` 下
- 业务逻辑独立在 `src/lib/ai-qa/` 下

---

## 2. 数据模型

### 2.1 核心思路

**平台数据不复制**。列表 API 直接查 AiMessage 表，LEFT JOIN AiQaReview 获取审核状态。AiQaReview 只在 staff 执行审核或重测时才创建记录。

```
查询流程：
AiMessage (senderRole='ai', date range)
  JOIN AiConversation → customerEmail
  JOIN AiMessageRating → 客户评价
  LEFT JOIN AiQaReview → 审核状态、重测结果
  配对前一条 customer 消息 → question
```

### 2.2 新增 Prisma Model

```prisma
model AiQaReview {
  id             String    @id @default(cuid())
  messageId      String    @unique  // 关联 AiMessage.id
  status         String    // 'correct' | 'incorrect'（无记录 = 未审核，不使用 pending）
  reviewNote     String?   // 审核备注
  reviewedBy     String?   // 审核人 user ID
  reviewedAt     DateTime?
  retestAnswer   String?   // 一键重测后的新答案
  retestAppId    String?   // 重测使用的 FastGPT App ID
  retestAt       DateTime? // 重测时间
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  // ── 预留字段（FastGPT 同步用，当前不使用）──
  source         String    @default("platform") // 'platform' | 'fastgpt'
  appId          String?   // FastGPT App ID
  externalId     String?   // FastGPT 消息原始 ID
  question       String?   // FastGPT 来源时存原文（platform 来源为 null，直查 AiMessage）
  answer         String?   // 同上
  customerEmail  String?   // FastGPT 来源为 null（匿名）
  conversationId String?   // FastGPT chatId
  qaTime         DateTime? // FastGPT 来源的原始时间

  message        AiMessage @relation(fields: [messageId], references: [id], onDelete: Restrict)

  @@unique([source, appId, externalId]) // 预留：FastGPT 数据防重复
  @@index([status])
  @@index([messageId])
  @@map("ai_qa_reviews")
}
```

### 2.3 AiMessage 表修改

添加反向关系：

```prisma
model AiMessage {
  // ... existing fields ...
  review       AiQaReview?    // 新增
}
```

### 2.4 设计说明

- `onDelete: Restrict`：如果 AI 消息有审核记录，阻止删除（保护审核数据完整性）
- `messageId` 当前为必填（`@unique`），因为只处理平台数据。未来 FastGPT 同步时，需改为可选并依赖 `@@unique([source, appId, externalId])` 做去重
- 预留字段全部可选（nullable），不影响当前使用

---

## 3. 数据流

### 3.1 列表查询

```
GET /api/staff/ai-qa/rounds?from=...&to=...&status=...
  │
  ▼
Prisma query:
  AiMessage.findMany({
    where: { senderRole: 'ai', createdAt: { gte, lte } },
    include: {
      conversation: { select: { customerEmail } },
      rating: { select: { rating, feedback } },
      review: { select: { status, reviewNote, retestAnswer, ... } },
    },
    orderBy: ...
  })
  │
  ▼
qa-pair-extractor: 配对前一条 customer 消息 → question
  │
  ▼
Response → 前端展示
```

### 3.2 审核操作

```
Staff 标记正确/错误
  │
  ▼
POST /api/staff/ai-qa/review
  body: { messageId, status, reviewNote? }
  │
  ▼
Prisma upsert AiQaReview:
  where: { messageId }
  create: { messageId, status, reviewNote, reviewedBy, reviewedAt }
  update: { status, reviewNote, reviewedBy, reviewedAt }
  │
  ▼
logger.info 审计日志（messageId, previousStatus, newStatus, reviewedBy）
```

### 3.3 一键重测

```
Staff 点击"重测"
  │
  ▼
POST /api/staff/ai-qa/retest
  body: { messageId }
  │
  ▼
服务端从 AiMessage + qa-pair-extractor 获取原始 question（不信任客户端传入）
  │
  ▼
复用 FastGPTProvider.chat()，构造独立 AISettings 对象（替换 apiKey 为测试 App Key）
  chatId = 'retest-{date}-{cuid}'
  stream = false
  AbortSignal.timeout(FASTGPT_RETEST_TIMEOUT)
  速率限制：5 次/分钟/用户
  │
  ▼
Prisma upsert AiQaReview:
  update: { retestAnswer, retestAppId, retestAt }
  │
  ▼
Response: { originalAnswer, retestAnswer, retestAppId, retestAt }
```

---

## 4. API 设计

### 4.1 GET /api/staff/ai-qa/rounds

Q&A 轮次列表。直查 AiMessage + LEFT JOIN AiQaReview。

**Query Params:**
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| status | string | 'all' | 'all' / 'unreviewed' / 'correct' / 'incorrect' |
| from | string | 7天前 | 开始日期 |
| to | string | 今天 | 结束日期 |
| page | number | 1 | 页码 |
| pageSize | number | 50 | 每页条数 |

**Response:**
```json
{
  "success": true,
  "data": {
    "rounds": [
      {
        "messageId": "clxx...",
        "question": "如何退款？",
        "answer": "请联系客服热线...",
        "customerEmail": "user@example.com",
        "customerRating": "negative",
        "customerFeedback": "答错了",
        "reviewStatus": null,
        "reviewNote": null,
        "retestAnswer": null,
        "qaTime": "2026-04-07T10:30:00Z",
        "conversationId": "clxx..."
      }
    ],
    "total": 224,
    "page": 1,
    "pageSize": 50,
    "stats": { "total": 224, "unreviewed": 179, "correct": 40, "incorrect": 5 }
  }
}
```

**排序：** 客户差评 → 未评价 → 好评 → qaTime 倒序。

`reviewStatus` 为 null 表示未审核（没有 AiQaReview 记录）。`status=unreviewed` 筛选 = LEFT JOIN 后 review 为 null 的记录。状态只有三种：null（未审核）、"correct"、"incorrect"，不使用 "pending"。

### 4.2 POST /api/staff/ai-qa/review

审核标注（upsert）。

**Request:** `{ "messageId": "...", "status": "incorrect", "reviewNote": "..." }`

**Response:** `{ "success": true, "data": { "messageId", "status", "reviewNote", "reviewedBy", "reviewedAt" } }`

审计日志：`logger.info('AiQaReview', 'Review action', { messageId, previousStatus, newStatus, reviewedBy })`

### 4.3 POST /api/staff/ai-qa/retest

一键重测。速率限制 5 次/分钟/用户。

**Request:** `{ "messageId": "..." }`

服务端从 messageId 查 AiMessage 获取原始回答，通过 qa-pair-extractor 获取对应的客户问题。不接受客户端传入 question（防篡改）。构造独立 AISettings 对象，将 apiKey 替换为 `AI_QA_RETEST_KEY`，避免误用生产 Key。

**Response:** `{ "success": true, "data": { "originalAnswer", "retestAnswer", "retestAppId", "retestAt" } }`

### 4.4 GET /api/staff/ai-qa/export

CSV 导出（从 `/api/admin/ai-export` 迁移）。

Query Params: `from`, `to`。复用 `qa-pair-extractor`。

### 4.5 预留 API（暂不实现）

| 路由 | 用途 | 状态 |
|------|------|------|
| `POST /api/staff/ai-qa/sync` | FastGPT 数据同步 | 预留 |
| `GET /api/staff/ai-qa/config` | FastGPT App 配置 | 预留 |

---

## 5. 前端设计

### 5.1 页面路径

`/staff/ai-qa` — Staff 侧边栏新增"AI 质检"导航项

### 5.2 页面布局

```
┌─────────────────────────────────────────────────────────────┐
│  AI 质检                                  [导出CSV] [刷新]   │
├─────────────────────────────────────────────────────────────┤
│  筛选栏：                                                    │
│  [状态: 全部/未审核/正确/错误 ▾]                               │
│  [日期范围: 2026-04-01 ~ 2026-04-08]                        │
│  统计：共 224 条 | 未审核 179 | 正确 40 | 错误 5             │
├───────────────────────────┬─────────────────────────────────┤
│  Q&A 列表（左侧）         │  详情面板（右侧）                 │
│                           │                                 │
│  🔴 如何退款？            │  问题：如何退款？                 │
│     AI: 请联系客服..      │                                 │
│     👎 "答错了"           │  AI 回答：                       │
│     [待审核]              │  请联系客服热线 400-xxx-xxxx     │
│  ─────────────────        │                                 │
│  ⚪ 营业时间是？          │  上下文（前后 2-3 条消息）        │
│     AI: 周一至周五..      │  [展开查看完整对话 ▾]             │
│     [待审核]              │                                 │
│  ─────────────────        │  客户评价：👎 "答错了"           │
│  🟢 地址在哪？            │  来源：平台 | user@example.com   │
│     AI: 位于XX路..        │                                 │
│     👍                    │  ── 审核操作 ──                  │
│     [已审核 ✓]            │  [✓ 正确] [✗ 错误]              │
│                           │  备注：[________________]        │
│                           │        [保存]                    │
│                           │                                 │
│                           │  ── 一键重测 ──                  │
│                           │  [重测此问题]  测试App: 重测专用  │
│                           │  旧答案：请联系客服热线...        │
│                           │  新答案：您可以在「我的订单」...   │
│                           │                                 │
│  [← 上一页] 1/5 [下一页→] │                                 │
└───────────────────────────┴─────────────────────────────────┘
```

---

## 6. 文件结构

```
src/
├── app/staff/ai-qa/
│   └── page.tsx                       ← 质检主页面
│
├── app/api/staff/ai-qa/
│   ├── rounds/route.ts                ← Q&A 轮次列表（查 AiMessage）
│   ├── review/route.ts                ← 审核标注 (POST upsert)
│   ├── retest/route.ts                ← 一键重测
│   └── export/route.ts                ← CSV 导出
│
├── lib/ai-qa/
│   ├── qa-pair-extractor.ts           ← Q&A 配对工具（共享，导出也用）
│   ├── review-service.ts              ← 审核 upsert + 审计日志
│   ├── rounds-service.ts              ← Q&A 轮次查询（AiMessage + JOIN）
│   ├── constants.ts                   ← 超时、速率限制等常量
│   └── types.ts                       ← 类型定义
│
├── components/staff/ai-qa/
│   ├── qa-list.tsx                     ← Q&A 列表
│   ├── qa-detail-panel.tsx             ← 详情面板（含上下文）
│   ├── review-actions.tsx              ← 审核操作区
│   ├── retest-section.tsx              ← 重测区域
│   └── qa-filters.tsx                  ← 筛选栏

prisma/
├── schema.prisma                       ← 新增 AiQaReview + AiMessage 反向关系
└── migrations/xxx_add_ai_qa_review/

messages/ (6 languages)
├── en.json → staff.aiQa.*
├── zh-CN.json / fr.json / es.json / ru.json / pt.json
```

---

## 7. 配置管理

扩展 `src/lib/utils/ai-config.ts` 的 `AISettings` 接口：

```typescript
export interface AISettings {
  // ... existing fields ...

  // QA Review - Retest
  qaRetestAppId: string  // 重测用的 FastGPT App ID

  // QA Review - Reserved for future FastGPT sync
  qaApps: Array<{
    id: string       // 内部标识，也用于 env var 名构建: AI_QA_APP_{ID}_KEY
    name: string     // 显示名称
    appId: string    // FastGPT App ID
  }>
}
```

环境变量：
```env
AI_QA_RETEST_KEY=fastgpt-xxxx       # 重测 App 的 API Key
# AI_QA_APP_{ID}_KEY=...            # 预留：各 FastGPT App 的 Key
```

敏感字段加入 `SENSITIVE_FIELDS`。运行时通过 `process.env[`AI_QA_APP_${id.toUpperCase()}_KEY`]` 解析。

---

## 8. 安全与性能

### 8.1 安全

- 所有 API 路由必须调用 `requireRole(['staff', 'admin'])`（middleware 仅保护页面路由 `/staff/*`，不保护 `/api/staff/*`）
- FastGPT API Key 不暴露到前端
- CSV 导出复用 `escapeCSV`（formula injection 防护）
- 审核操作 `logger.info` 审计日志

### 8.2 性能常量

```typescript
// src/lib/ai-qa/constants.ts
export const FASTGPT_RETEST_TIMEOUT = 15_000  // 重测调用超时
export const RETEST_RATE_LIMIT = 5            // 每用户每分钟重测上限
```

### 8.3 错误处理

- 重测超时 → 返回超时错误，不影响审核标注
- 重测 FastGPT 不可达 → 前端 toast，审核功能不受影响
- DB 查询失败 → 标准 500

---

## 9. 实现计划

### Phase 1a：后端

1. Prisma schema 新增 `AiQaReview` + AiMessage 反向关系 + migration
2. `src/lib/ai-qa/qa-pair-extractor.ts` — Q&A 配对（从导出 API 抽取共享）
3. `src/lib/ai-qa/rounds-service.ts` — 列表查询
4. `src/lib/ai-qa/review-service.ts` — 审核 upsert + 审计日志
5. `GET /api/staff/ai-qa/rounds`
6. `POST /api/staff/ai-qa/review`
7. `POST /api/staff/ai-qa/retest` — 复用 FastGPTProvider.chat()
8. `GET /api/staff/ai-qa/export` — 从 admin 迁移，重构用共享 extractor
9. 扩展 ai-config.ts（qaRetestAppId + qaApps 预留）
10. 单元测试

### Phase 1b：前端

11. `src/app/staff/ai-qa/page.tsx` — 列表 + 详情 + 审核 + 重测
12. Staff 侧边栏导航添加"AI 质检"
13. i18n（6 语言）
14. API 集成测试 + E2E

### Phase 2（未来）：FastGPT 数据源

- FastGPT 管理 API 验证 Spike
- fastgpt-client.ts + sync-service.ts + circuit-breaker.ts
- POST /api/staff/ai-qa/sync
- GET /api/staff/ai-qa/config
- FastGPT Tab + 同步按钮

---

## 10. 测试策略

### 单元测试 (Vitest)

| 文件 | 测试重点 |
|------|---------|
| `qa-pair-extractor.test.ts` | 正常配对、连续客户消息、系统消息插入、AI 欢迎消息（无问题）、连续 AI 消息 |
| `review-service.test.ts` | upsert 创建、upsert 更新、审计日志输出 |
| `rounds-service.test.ts` | 分页、状态筛选、排序（差评优先）、日期范围 |

### API 路由测试

| 路由 | 测试重点 |
|------|---------|
| rounds | Auth guard (staff ok, customer 403)、参数校验、分页 |
| review | Auth guard、upsert 行为、无效 messageId |
| retest | Auth guard、速率限制、FastGPT 超时 |
| export | Auth guard (staff ok)、CSV 格式、formula injection |

### E2E (Playwright)

- 平台审核流程：打开质检页 → 选择 Q&A → 标记错误 + 备注 → 验证状态更新
- 重测流程：选择已标记错误的 Q&A → 点击重测 → 验证新旧答案对比展示

---

## 11. 迁移回滚

`AiQaReview` 是独立新表。回滚：移除 AiMessage 反向关系 + drop 表。现有表不受影响。
