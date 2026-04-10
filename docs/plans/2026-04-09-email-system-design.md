# 自建邮件收发系统设计

> 日期：2026-04-09
> 状态：Draft
> 核心需求：客户邮件回复只提取新增内容；Staff 回复像正常邮件一样带引用上下文

---

## 为什么 Zammad 做不好这件事

Zammad 的 Article 存储是"全量存入"——客户通过邮件回复时，Zammad 把整封邮件原文（含所有引用历史）存为 Article body。结果就是每条回复都是一个"俄罗斯套娃"，越往后引用链越长，工单页面阅读体验极差。

Zammad 虽然有 `blockquote` 检测，但：
- 不同邮件客户端引用格式完全不标准（Gmail/Outlook/Apple Mail/纯文本各不相同）
- Zammad 没有"只存新内容"的灵活性——它只有一个 `body` 字段
- 无法对解析失败的 case 做 fallback

---

## 核心思路：双轨存储

**一条 Article 存两个 body**：

| 字段 | 用途 | 内容 |
|------|------|------|
| `bodyVisible` | 前端 UI 展示 | 剥离引用后的"新增内容" |
| `bodyFull` | Staff 回复引用 + 存档 | 原始完整邮件内容 |

这解决了 Zammad 的根本局限：

- UI 只展示 `bodyVisible` → 没有重复引用
- Staff 回复时引用 `bodyVisible`（或 `bodyFull`）→ 邮件上下文完整
- 解析失败时 `bodyVisible = bodyFull` → 退化为旧行为，不丢数据
- 可以后续人工修正 `bodyVisible`

---

## 系统全景

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          邮件子系统                                      │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                     Inbound (客户 → 平台)                         │  │
│  │                                                                   │  │
│  │  [客户邮件]                                                       │  │
│  │      │                                                            │  │
│  │      ▼                                                            │  │
│  │  [Mailgun Inbound Parse]  ← MX record: support.example.com       │  │
│  │      │  解析 MIME，提供 stripped-html                              │  │
│  │      │  POST webhook                                              │  │
│  │      ▼                                                            │  │
│  │  POST /api/inbound/email                                          │  │
│  │      │                                                            │  │
│  │      ├── 验签 + 幂等去重 (Message-ID)                              │  │
│  │      ├── 过滤自动回复/垃圾                                         │  │
│  │      ├── 线程匹配 → 找到 Ticket（或创建新工单）                     │  │
│  │      ├── 引用剥离 → bodyVisible                                   │  │
│  │      ├── 创建 Article (bodyVisible + bodyFull)                    │  │
│  │      ├── 附件处理                                                  │  │
│  │      ├── 存 EmailMeta (Message-ID/In-Reply-To/References)         │  │
│  │      └── 通知 + SSE 广播                                          │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                     Outbound (Staff → 客户)                       │  │
│  │                                                                   │  │
│  │  [Staff 在平台上回复, type='email']                               │  │
│  │      │                                                            │  │
│  │      ├── 存 Article (bodyVisible = bodyFull = Staff 写的内容)      │  │
│  │      │                                                            │  │
│  │      ├── 构建邮件正文                                              │  │
│  │      │     Staff 新内容                                            │  │
│  │      │     + 引用客户最后一条 bodyVisible                          │  │
│  │      │                                                            │  │
│  │      ├── 设置线程 headers                                         │  │
│  │      │     Message-ID / In-Reply-To / References                  │  │
│  │      │                                                            │  │
│  │      ├── nodemailer + SMTP (或 Mailgun Send API) 发送             │  │
│  │      ├── 存 EmailMeta                                             │  │
│  │      └── 通知 + SSE 广播                                          │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  闭环：客户在邮件客户端收到带引用的回复 → 客户回复 → 循环回到 Inbound    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 一、数据模型

### 1.1 Article 表改造

在现有 Article 模型（或未来自建的）上新增字段：

```prisma
model Article {
  id              Int       @id @default(autoincrement())
  ticketId        Int
  type            String    @default("note")   // "note" | "email" | "web" | "phone"
  sender          String    @default("Agent")  // "Agent" | "Customer" | "System"
  from            String
  to              String?
  cc              String?
  subject         String?
  internal        Boolean   @default(false)

  // ═══ 双轨 body（核心设计）═══
  bodyVisible     String    // UI 展示用：剥离引用后的新增内容
  bodyFull        String    // 原始完整邮件内容（Staff 回复引用用）
  contentType     String    @default("text/html")

  // ═══ 引用解析元数据 ═══
  quoteParseMethod     String?   // "html-structure" | "text-pattern" | "provider-stripped" | "diff" | "fallback"
  quoteParseConfidence Float?    // 0.0 ~ 1.0，供后续分析

  originById      String?   // 实际作者 user ID

  ticket          Ticket    @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  attachments     Attachment[]
  emailMeta       ArticleEmailMeta?

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([ticketId])
  @@index([ticketId, createdAt])
  @@map("articles")
}
```

### 1.2 邮件线程元数据表（新增）

```prisma
model ArticleEmailMeta {
  id              Int       @id @default(autoincrement())
  articleId       Int       @unique
  messageId       String    @unique          // RFC 2822 Message-ID
  inReplyTo       String?                    // 回复的那封邮件的 Message-ID
  references      String?                    // JSON array: 完整 References 链
  fromEmail       String
  toEmails        String                     // JSON array
  ccEmails        String?                    // JSON array
  subject         String?
  rawHeaders      String?                    // 完整邮件头 (调试用, 可选)

  article         Article   @relation(fields: [articleId], references: [id], onDelete: Cascade)

  @@index([messageId])
  @@index([inReplyTo])
  @@index([fromEmail])
  @@map("article_email_meta")
}
```

### 1.3 附件表

```prisma
model Attachment {
  id          Int       @id @default(autoincrement())
  articleId   Int?
  filename    String
  size        Int                            // bytes
  mimeType    String
  storagePath String                         // 磁盘路径或 S3 key
  storageType String    @default("local")    // "local" | "s3"
  formId      String?                        // 上传缓存分组 ID
  contentId   String?                        // CID for inline images

  article     Article?  @relation(fields: [articleId], references: [id], onDelete: Cascade)
  createdAt   DateTime  @default(now())

  @@index([articleId])
  @@index([formId])
  @@map("attachments")
}
```

---

## 二、Inbound：邮件接收

### 2.1 接收方案

**生产环境：Mailgun Inbound Routing**

```
MX record: support.example.com → Mailgun
Mailgun route: match_recipient(".*@support.example.com")
  → forward("https://your-app.com/api/inbound/email")
```

Mailgun 的 webhook POST 包含结构化数据：

| 字段 | 说明 |
|------|------|
| `sender` | 发件人邮箱 |
| `from` | 发件人完整地址 (含名称) |
| `subject` | 邮件主题 |
| `body-html` | 原始 HTML (含引用) |
| `body-plain` | 原始纯文本 (含引用) |
| `stripped-html` | **Mailgun 已剥离引用的 HTML** |
| `stripped-text` | **Mailgun 已剥离引用的纯文本** |
| `Message-Id` | 邮件 Message-ID |
| `In-Reply-To` | 回复的 Message-ID |
| `References` | 线程 Message-ID 链 |
| `attachments` | 附件信息 (JSON) |
| `content-id-map` | 内嵌图片 CID 映射 |
| `timestamp` | UNIX 时间戳 |
| `token` | 验签 token |
| `signature` | HMAC 签名 |

**关键点**：Mailgun 的 `stripped-html` 是我们引用剥离的第一道防线。

**开发/测试环境：IMAP 轮询**

```typescript
// 定时任务，每 30 秒检查收件箱
// 使用 imapflow + mailparser
```

### 2.2 Webhook Handler

```
POST /api/inbound/email
```

**完整处理管道：**

```typescript
// src/app/api/inbound/email/route.ts

export async function POST(request: NextRequest) {
  // ── Step 1: 验证来源 ──
  // Mailgun: HMAC(timestamp + token) === signature
  // 防止伪造 webhook

  // ── Step 2: 解析参数 ──
  // Mailgun 用 multipart/form-data POST
  const formData = await request.formData()
  const sender     = formData.get('sender')      as string
  const from       = formData.get('from')         as string
  const subject    = formData.get('subject')      as string
  const bodyHtml   = formData.get('body-html')    as string | null
  const bodyPlain  = formData.get('body-plain')   as string | null
  const strippedHtml = formData.get('stripped-html') as string | null
  const strippedText = formData.get('stripped-text') as string | null
  const messageId  = formData.get('Message-Id')   as string
  const inReplyTo  = formData.get('In-Reply-To')  as string | null
  const references = formData.get('References')   as string | null

  // ── Step 3: 幂等去重 ──
  // 同一封邮件的 webhook 可能被重试
  const existing = await prisma.articleEmailMeta.findUnique({
    where: { messageId }
  })
  if (existing) return successResponse({ status: 'duplicate' })

  // ── Step 4: 过滤垃圾/自动回复 ──
  // 检查邮件头:
  //   Auto-Submitted: auto-replied | auto-generated → 跳过
  //   Precedence: bulk | junk | list → 跳过
  //   Return-Path: <> → bounce 通知，跳过
  //   X-Autoreply: yes → 跳过

  // ── Step 5: 线程匹配 → 找到 Ticket ──
  const ticket = await matchEmailToTicket({
    messageId, inReplyTo, references, subject, senderEmail: sender
  })
  // 如果找不到 → 创建新工单

  // ── Step 6: 引用剥离 (核心) ──
  const stripResult = stripQuotedReply({
    bodyHtml, bodyPlain, strippedHtml, strippedText,
    previousSentBody: await getLastOutboundBody(ticket.id),
  })

  // ── Step 7: 创建 Article ──
  const article = await prisma.article.create({
    data: {
      ticketId:    ticket.id,
      type:        'email',
      sender:      'Customer',
      from:        from,
      to:          'support@example.com',
      subject:     subject,
      bodyVisible: stripResult.bodyVisible,
      bodyFull:    stripResult.bodyFull,
      contentType: bodyHtml ? 'text/html' : 'text/plain',
      internal:    false,
      quoteParseMethod:     stripResult.method,
      quoteParseConfidence: stripResult.confidence,
    }
  })

  // ── Step 8: 存邮件元数据 ──
  await prisma.articleEmailMeta.create({
    data: {
      articleId:  article.id,
      messageId,
      inReplyTo,
      references: references || null,
      fromEmail:  sender,
      toEmails:   JSON.stringify(['support@example.com']),
      subject,
    }
  })

  // ── Step 9: 附件处理 ──
  // Mailgun 把附件作为 multipart file 字段传递
  // 下载 → 存本地/S3 → 关联到 Article

  // ── Step 10: 更新工单状态 ──
  // 客户回复了 → state 改为 open（如果之前是 pending）
  if ([STATES.PENDING_REMINDER, STATES.PENDING_CLOSE].includes(ticket.stateId)) {
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { stateId: STATES.OPEN, updatedAt: new Date() }
    })
  }

  // ── Step 11: 通知 + SSE ──
  // 同现有 webhook handler 的通知逻辑
}
```

### 2.3 线程匹配算法

```typescript
// src/lib/email/thread-matcher.ts

async function matchEmailToTicket(params: {
  messageId: string
  inReplyTo: string | null
  references: string | null
  subject: string
  senderEmail: string
}): Promise<Ticket | null> {

  // ── 策略 1: In-Reply-To 精确匹配 (最可靠) ──
  if (params.inReplyTo) {
    const meta = await prisma.articleEmailMeta.findUnique({
      where: { messageId: params.inReplyTo },
      include: { article: { include: { ticket: true } } }
    })
    if (meta?.article?.ticket) return meta.article.ticket
  }

  // ── 策略 2: References 链遍历 ──
  if (params.references) {
    // References 是空格分隔的 Message-ID 列表
    const refIds = params.references.split(/\s+/).filter(Boolean)
    // 从后往前查（最近的最可能命中）
    for (const refId of refIds.reverse()) {
      const meta = await prisma.articleEmailMeta.findUnique({
        where: { messageId: refId },
        include: { article: { include: { ticket: true } } }
      })
      if (meta?.article?.ticket) return meta.article.ticket
    }
  }

  // ── 策略 3: Subject 中提取工单号 ──
  // 匹配 [Ticket#10001] 或 [#10001] 或 Re: [Ticket#10001]
  const ticketNumMatch = params.subject.match(/\[(?:Ticket)?#?(\d+)\]/)
  if (ticketNumMatch) {
    const ticket = await prisma.ticket.findFirst({
      where: { number: ticketNumMatch[1] }
    })
    if (ticket) return ticket
  }

  // ── 策略 4: 发件人最近活跃工单 (低可靠) ──
  // 用于客户直接写新邮件到 support@ 但 Subject 不含工单号的场景
  // 这种情况实际上应该创建新工单

  // ── 都不匹配 → 返回 null (上层创建新工单) ──
  return null
}
```

---

## 三、引用剥离引擎（核心难点）

### 3.1 架构：四层 Fallback

```
Layer 1: 邮件服务商 stripped (Mailgun stripped-html)
    │ 如果 stripped ≠ 空 且 stripped ≠ bodyFull → 使用
    │ confidence: 0.90
    ▼
Layer 2: HTML 结构化检测 (cheerio DOM 操作)
    │ 识别 Gmail/Outlook/Apple Mail 的引用标记并删除
    │ confidence: 0.85-0.95
    ▼
Layer 3: 文本模式匹配 (正则)
    │ 识别 "On ... wrote:" / "-----Original Message-----" 等模式
    │ confidence: 0.70-0.85
    ▼
Layer 4: Fallback
    │ bodyVisible = bodyFull (不做剥离)
    │ confidence: 0
    │ 标记 quoteParseMethod='fallback'，可人工修正
```

### 3.2 HTML 结构化剥离

```typescript
// src/lib/email/quote-stripper.ts

import * as cheerio from 'cheerio'

/**
 * 各邮件客户端的引用 DOM 特征
 *
 * 这些选择器经过实测验证，覆盖 2024-2026 年主流客户端版本。
 * 注意：邮件客户端版本更新可能改变 DOM 结构，需要定期验证。
 */
const HTML_QUOTE_SELECTORS = [
  // ── Gmail ──
  // Gmail 网页版和移动端一致使用 class="gmail_quote"
  { selector: 'div.gmail_quote',  method: 'remove-element',  client: 'gmail' },
  { selector: 'div.gmail_extra',  method: 'remove-element',  client: 'gmail' },

  // ── Outlook ──
  // Outlook Web (OWA): 使用 id="appendonsend" 作为分割点
  // 它后面的所有内容都是引用
  { selector: '#appendonsend',    method: 'remove-after',    client: 'outlook-web' },
  // Outlook Desktop: 使用 id="divRplyFwdMsg" 包裹引用头
  { selector: '#divRplyFwdMsg',   method: 'remove-after',    client: 'outlook-desktop' },

  // ── Apple Mail ──
  { selector: 'blockquote[type="cite"]', method: 'remove-with-header', client: 'apple-mail' },

  // ── 通用 ──
  // 只在 blockquote 前有 "wrote:" / "写道" 等标记时才移除
  // 避免误删非引用的 blockquote（如代码块、引文）
  { selector: 'blockquote', method: 'remove-if-quote-header', client: 'generic' },
]

function stripHtmlQuotes(html: string): {
  stripped: string
  found: boolean
  client: string | null
} {
  const $ = cheerio.load(html, { decodeEntities: false })
  let found = false
  let client: string | null = null

  for (const rule of HTML_QUOTE_SELECTORS) {
    const elements = $(rule.selector)
    if (elements.length === 0) continue

    switch (rule.method) {
      case 'remove-element':
        elements.each((_, el) => $(el).remove())
        break

      case 'remove-after':
        // 删除匹配元素及其后续的所有兄弟节点
        elements.each((_, el) => {
          let current: any = el
          while (current) {
            const next = $(current).next().get(0)
            $(current).remove()
            current = next
          }
        })
        break

      case 'remove-with-header':
        // 删除 blockquote 和它前面的引用头（"On ... wrote:"）
        elements.each((_, el) => {
          const prev = $(el).prev()
          if (prev.length) {
            const prevText = prev.text().trim()
            if (isQuoteAttribution(prevText)) {
              prev.remove()
            }
          }
          $(el).remove()
        })
        break

      case 'remove-if-quote-header':
        elements.each((_, el) => {
          const prev = $(el).prev()
          if (prev.length && isQuoteAttribution(prev.text().trim())) {
            prev.remove()
            $(el).remove()
          }
        })
        break
    }

    found = true
    client = rule.client
    break  // 找到第一个匹配的客户端就停止
  }

  // 额外处理: Outlook 风格的 <hr> + 引用头
  if (!found) {
    $('hr').each((_, el) => {
      const next = $(el).next()
      if (next.length && isEmailMetaBlock(next.text())) {
        let current: any = el
        while (current) {
          const n = $(current).next().get(0)
          $(current).remove()
          current = n
        }
        found = true
        client = 'outlook-hr'
      }
    })
  }

  // 清理: 移除末尾空的 <br> 和空白 div
  $('body').children().filter((_, el) => {
    const tag = $(el).prop('tagName')?.toLowerCase()
    return (tag === 'br' || tag === 'div') && $(el).text().trim() === '' && $(el).children().length === 0
  }).last().remove()

  return { stripped: $.html(), found, client }
}

// 判断文本是否是引用归属行 ("On ... wrote:" 等)
function isQuoteAttribution(text: string): boolean {
  const patterns = [
    /wrote\s*:?\s*$/i,
    /写道\s*[：:]\s*$/,
    /schrieb\s*:?\s*$/i,
    /a écrit\s*:?\s*$/i,
    /escribió\s*:?\s*$/i,
    /написал[аи]?\s*:?\s*$/i,  // Russian
    /escreveu\s*:?\s*$/i,      // Portuguese
  ]
  return patterns.some(p => p.test(text))
}

// 判断文本是否是邮件元信息块 (From:/Sent:/Subject: 等)
function isEmailMetaBlock(text: string): boolean {
  // 至少包含 From 和 Sent/Date 中的两个
  const hasFrom = /^(From|De|Von|От|发件人)\s*[：:]/mi.test(text)
  const hasDate = /^(Sent|Date|Envoyé|Gesendet|Дата|发送时间)\s*[：:]/mi.test(text)
  return hasFrom && hasDate
}
```

### 3.3 纯文本剥离

```typescript
// 按优先级排列的引用分隔模式
// 匹配到第一个 → 截断到该位置之前
const TEXT_QUOTE_PATTERNS: Array<{
  pattern: RegExp
  name: string
  confidence: number
}> = [
  // ── Outlook 分隔线 (最可靠，误判率极低) ──
  { pattern: /^-{3,}\s*Original Message\s*-{3,}\s*$/mi,
    name: 'outlook-separator', confidence: 0.95 },
  { pattern: /^-{3,}\s*原始邮件\s*-{3,}\s*$/mi,
    name: 'outlook-separator-cn', confidence: 0.95 },
  { pattern: /^-{3,}\s*Message d'origine\s*-{3,}\s*$/mi,
    name: 'outlook-separator-fr', confidence: 0.95 },

  // ── "On ... wrote:" 模式 (常见，偶有误判) ──
  { pattern: /^On .{10,80} wrote:\s*$/m,
    name: 'on-wrote-en', confidence: 0.85 },
  { pattern: /^在 .{5,60} 写道[：:]\s*$/m,
    name: 'on-wrote-cn', confidence: 0.85 },
  { pattern: /^Le .{10,80} a écrit\s*[：:]\s*$/m,
    name: 'on-wrote-fr', confidence: 0.85 },
  { pattern: /^El .{10,80} escribió\s*[：:]\s*$/m,
    name: 'on-wrote-es', confidence: 0.85 },
  { pattern: /^.{10,80} написал[аи]?\s*[：:]\s*$/m,
    name: 'on-wrote-ru', confidence: 0.85 },
  { pattern: /^.{10,80} escreveu\s*[：:]\s*$/m,
    name: 'on-wrote-pt', confidence: 0.85 },
  // Gmail 多行 "On ...\n... wrote:"
  { pattern: /^On [\s\S]{10,200}?wrote:\s*$/m,
    name: 'on-wrote-multiline', confidence: 0.80 },

  // ── Gmail 转发 ──
  { pattern: /^-{5,}\s*Forwarded message\s*-{5,}\s*$/mi,
    name: 'gmail-forward', confidence: 0.90 },

  // ── 下划线分隔符 (某些企业邮件客户端) ──
  { pattern: /^_{10,}\s*$/m,
    name: 'underscore-separator', confidence: 0.80 },

  // ── 行级 > 引用 (最后检查，因为 Markdown 也用 >) ──
  // 只在出现 > 引用之前有空行时才生效
  { pattern: /\n\n>+ .+/,
    name: 'line-quote', confidence: 0.70 },
]

function stripTextQuotes(text: string): {
  stripped: string
  found: boolean
  patternName: string | null
  confidence: number
} {
  for (const { pattern, name, confidence } of TEXT_QUOTE_PATTERNS) {
    const match = text.match(pattern)
    if (match && match.index !== undefined) {
      // 取匹配位置之前的文本
      let cutPoint = match.index

      // 往回吃掉末尾空行
      while (cutPoint > 0 && text[cutPoint - 1] === '\n') cutPoint--

      const stripped = text.substring(0, cutPoint).trim()

      // 安全检查: 剥离后不能为空（说明整封邮件都是引用，不合理）
      if (stripped.length === 0) continue

      return { stripped, found: true, patternName: name, confidence }
    }
  }

  return { stripped: text, found: false, patternName: null, confidence: 0 }
}
```

### 3.4 主函数：多层 Fallback 编排

```typescript
interface StripResult {
  bodyVisible: string
  bodyFull: string
  method: 'provider-stripped' | 'html-structure' | 'text-pattern' | 'diff' | 'fallback'
  confidence: number
  clientDetected?: string
}

function stripQuotedReply(params: {
  bodyHtml?: string | null
  bodyPlain?: string | null
  strippedHtml?: string | null
  strippedText?: string | null
  previousSentBody?: string | null  // 我们上一封发出去的 bodyVisible
}): StripResult {
  const bodyFull = params.bodyHtml || params.bodyPlain || ''

  // ── Layer 1: 邮件服务商已剥离的内容 ──
  if (params.strippedHtml && params.strippedHtml !== params.bodyHtml) {
    // Mailgun 剥离成功（stripped ≠ 原始 body）
    const stripped = params.strippedHtml.trim()
    if (stripped.length > 0) {
      return {
        bodyVisible: stripped,
        bodyFull,
        method: 'provider-stripped',
        confidence: 0.90,
      }
    }
  }

  // ── Layer 2: 自己的 HTML 结构化剥离 ──
  if (params.bodyHtml) {
    const htmlResult = stripHtmlQuotes(params.bodyHtml)
    if (htmlResult.found) {
      return {
        bodyVisible: htmlResult.stripped,
        bodyFull,
        method: 'html-structure',
        confidence: htmlResult.client === 'gmail' ? 0.95 : 0.85,
        clientDetected: htmlResult.client || undefined,
      }
    }
  }

  // ── Layer 3: 纯文本模式匹配 ──
  const plainText = params.bodyPlain || ''
  if (plainText) {
    const textResult = stripTextQuotes(plainText)
    if (textResult.found) {
      return {
        bodyVisible: textResult.stripped,
        bodyFull,
        method: 'text-pattern',
        confidence: textResult.confidence,
      }
    }
  }

  // ── Layer 4: 内容 diff (如果有上一封发出去的内容) ──
  // 从原文中移除与上一封发出内容重复的部分
  if (params.previousSentBody && plainText) {
    const diffResult = diffBasedStrip(plainText, params.previousSentBody)
    if (diffResult) {
      return {
        bodyVisible: diffResult,
        bodyFull,
        method: 'diff',
        confidence: 0.60,
      }
    }
  }

  // ── Layer 5: Fallback — 不做剥离 ──
  return {
    bodyVisible: bodyFull,
    bodyFull,
    method: 'fallback',
    confidence: 0,
  }
}
```

---

## 四、Outbound：Staff 邮件发送

### 4.1 发送时机

Staff 在平台上回复工单时，如果 `type = 'email'`（而非 `'note'`），创建 Article 后自动发送邮件。

### 4.2 邮件构建

```typescript
// src/lib/email/outbound.ts

import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  // 方案 A: 直接 SMTP
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  // 方案 B: 用 Mailgun SMTP
  // host: 'smtp.mailgun.org',
  // port: 587, auth: { ... }
})

interface SendReplyParams {
  ticket: { id: number; number: string; title: string }
  article: { id: number; bodyVisible: string; from: string }
  customerEmail: string
  cc?: string[]
  lastCustomerArticle?: {
    bodyVisible: string
    from: string
    createdAt: Date
    emailMeta?: { messageId: string }
  }
}

async function sendTicketReply(params: SendReplyParams): Promise<string> {
  const { ticket, article, customerEmail, lastCustomerArticle } = params

  // ── 生成 Message-ID ──
  const domain = process.env.EMAIL_DOMAIN || 'support.example.com'
  const messageId = `<ticket-${ticket.number}-art-${article.id}-${Date.now()}@${domain}>`

  // ── 构建 In-Reply-To / References ──
  const lastCustomerMessageId = lastCustomerArticle?.emailMeta?.messageId
  const threadMessageId = `<thread-${ticket.number}@${domain}>`

  // References 链：线程根 + 客户最后一封
  const references = [threadMessageId]
  if (lastCustomerMessageId) references.push(lastCustomerMessageId)

  // ── 构建邮件正文 ──
  // Staff 写的新内容 + 引用客户最后一条 bodyVisible
  const htmlBody = buildOutboundHtml(
    article.bodyVisible,
    lastCustomerArticle
  )

  // ── 发送 ──
  await transporter.sendMail({
    from:        `"Support Team" <support@${domain}>`,
    to:          customerEmail,
    cc:          params.cc?.join(', ') || undefined,
    subject:     `Re: [Ticket#${ticket.number}] ${ticket.title}`,
    html:        htmlBody,
    messageId:   messageId,
    inReplyTo:   lastCustomerMessageId || threadMessageId,
    references:  references.join(' '),
    headers: {
      'X-Ticket-ID':     ticket.id.toString(),
      'X-Ticket-Number': ticket.number,
    },
  })

  // ── 存 EmailMeta ──
  await prisma.articleEmailMeta.create({
    data: {
      articleId:  article.id,
      messageId:  messageId,
      inReplyTo:  lastCustomerMessageId || null,
      references: JSON.stringify(references),
      fromEmail:  `support@${domain}`,
      toEmails:   JSON.stringify([customerEmail]),
      ccEmails:   params.cc ? JSON.stringify(params.cc) : null,
      subject:    `Re: [Ticket#${ticket.number}] ${ticket.title}`,
    },
  })

  return messageId
}
```

### 4.3 发出的邮件 HTML 格式

```typescript
/**
 * 构建发出去的邮件 HTML
 *
 * 关键设计：使用标准 Gmail 引用格式 (class="gmail_quote" + <blockquote>)
 * 这样当客户回复时，我们的 Layer 2 解析器能最可靠地识别和剥离它
 *
 * 形成自增强闭环：
 *   我们发标准格式 → 客户回复带着标准格式 → 我们能可靠剥离
 */
function buildOutboundHtml(
  newContent: string,
  quotedArticle?: {
    bodyVisible: string
    from: string
    createdAt: Date
  }
): string {
  if (!quotedArticle) {
    // 首条消息，不需要引用
    return `<div>${newContent}</div>`
  }

  const dateStr = quotedArticle.createdAt.toLocaleString('en-US', {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  return `
<div>${newContent}</div>
<br>
<div class="gmail_quote">
  <div class="gmail_attr" style="color:#888;font-size:12px;">
    On ${dateStr}, ${quotedArticle.from} wrote:
  </div>
  <blockquote class="gmail_quote" style="margin:0 0 0 .8ex;border-left:1px #ccc solid;padding-left:1ex;">
    ${quotedArticle.bodyVisible}
  </blockquote>
</div>`.trim()
}
```

---

## 五、边缘情况处理

### 5.1 防护清单

| 场景 | 处理 |
|------|------|
| **同一邮件 webhook 重试** | 按 Message-ID 幂等去重 |
| **自动回复/OOO** | 检查 `Auto-Submitted` / `Precedence` / `X-Autoreply` 头 → 跳过 |
| **邮件循环** | 检测 `Precedence: bulk` + 我们自己发出的 `X-Ticket-ID` 头 → 跳过 |
| **编码问题 (GB2312/Big5)** | Mailgun 已做 UTF-8 转换；IMAP 模式用 `iconv-lite` |
| **内嵌图片 (CID)** | 提取 `cid:xxx` 引用 → 替换为附件 URL |
| **垃圾邮件** | Mailgun 提供 SPF/DKIM 验证结果 → 拒绝失败的 |
| **超大邮件** | 限制 body 大小 (如 1MB)，超出截断并标记 |
| **引用剥离失败** | `quoteParseMethod = 'fallback'`，可在管理后台查看并手动修正 |
| **纯签名邮件** | 剥离后 bodyVisible 为空 → fallback 到 bodyFull |
| **多层嵌套引用** | Layer 2 从外到内删除第一层引用即可 |
| **CC 抄送** | 保存 CC 列表；Staff 回复时可选择是否 Reply-All |

### 5.2 自动回复过滤

```typescript
function isAutoReply(headers: Record<string, string>): boolean {
  // RFC 3834
  const autoSubmitted = headers['auto-submitted']?.toLowerCase()
  if (autoSubmitted && autoSubmitted !== 'no') return true

  // De-facto standards
  if (headers['x-autoreply']?.toLowerCase() === 'yes') return true
  if (headers['x-autorespond']) return true

  const precedence = headers['precedence']?.toLowerCase()
  if (precedence === 'bulk' || precedence === 'junk' || precedence === 'auto_reply') return true

  // Bounce detection (empty Return-Path)
  if (headers['return-path'] === '<>') return true

  // Out-of-office subject patterns
  const subject = headers['subject'] || ''
  if (/^(out of office|automatic reply|autoreply|自动回复)/i.test(subject)) return true

  return false
}
```

### 5.3 邮件域名配置 (可送达性)

Staff 发出的邮件要进收件箱而非垃圾箱，必须配置：

```
DNS records for support.example.com:

# MX — 指向 Mailgun (接收用)
MX  support.example.com  mxa.mailgun.org   10
MX  support.example.com  mxb.mailgun.org   10

# SPF — 允许 Mailgun 代发
TXT support.example.com  "v=spf1 include:mailgun.org ~all"

# DKIM — Mailgun 提供的签名密钥
TXT mg._domainkey.support.example.com  "k=rsa; p=MIGfMA0G..."

# DMARC — 告诉接收方如何处理验证失败
TXT _dmarc.support.example.com  "v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com"
```

---

## 六、环境变量

```env
# ═══ 邮件接收 (Inbound) ═══
EMAIL_INBOUND_PROVIDER=mailgun          # "mailgun" | "ses" | "imap"
MAILGUN_INBOUND_WEBHOOK_SIGNING_KEY=xxx # Mailgun webhook 验签密钥

# IMAP (开发环境 fallback)
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_USER=support@example.com
IMAP_PASS=xxx
IMAP_POLL_INTERVAL_MS=30000

# ═══ 邮件发送 (Outbound) ═══
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=postmaster@support.example.com
SMTP_PASS=xxx
EMAIL_FROM_NAME="Support Team"
EMAIL_DOMAIN=support.example.com

# ═══ 通用 ═══
EMAIL_ENABLED=true                       # 总开关
```

---

## 七、文件结构

```
src/lib/email/
├── index.ts                 # 导出
├── inbound.ts               # Inbound 处理主逻辑
├── outbound.ts              # Outbound 发送
├── thread-matcher.ts        # 线程匹配算法
├── quote-stripper.ts        # 引用剥离引擎 (核心)
├── auto-reply-filter.ts     # 自动回复/垃圾过滤
├── attachment-handler.ts    # 附件下载和存储
└── types.ts                 # 类型定义

src/app/api/
├── inbound/
│   └── email/
│       └── route.ts         # POST /api/inbound/email (webhook 入口)
```

---

## 八、测试策略

引用剥离是最容易出 bug 的部分，需要大量实际邮件样本测试。

```
__tests__/lib/email/
├── quote-stripper.test.ts        # 核心测试
│   ├── gmail-html.test.ts        # Gmail HTML 样本
│   ├── outlook-html.test.ts      # Outlook HTML 样本
│   ├── apple-mail-html.test.ts   # Apple Mail 样本
│   ├── plain-text.test.ts        # 纯文本样本
│   ├── multilingual.test.ts      # 中/法/西/俄/葡 引用格式
│   ├── nested-quotes.test.ts     # 多层嵌套引用
│   └── edge-cases.test.ts        # 空邮件、纯签名、超长引用
├── thread-matcher.test.ts        # 线程匹配
├── auto-reply-filter.test.ts     # 自动回复过滤
└── outbound.test.ts              # 发送邮件
```

**测试数据收集方法**：
1. 用不同客户端互相发邮件，保存原始 MIME
2. 提取 HTML/纯文本部分作为测试 fixture
3. 手工标注"新内容"和"引用部分"的分界线

---

## 九、为什么这个方案能成功（而 Zammad 失败了）

| 维度 | Zammad | 本方案 |
|------|--------|--------|
| 存储 | 单个 `body` 字段 | **双轨**: `bodyVisible` + `bodyFull` |
| 剥离失败 | 全量显示，无法修正 | Fallback 到全量 + **可人工修正** |
| 服务商辅助 | 自己解析 MIME | **Mailgun `stripped-html` 做第一道** |
| 发出格式 | Zammad 自有格式 | **标准 Gmail 引用格式 → 形成闭环** |
| 可观测性 | 无 | `quoteParseMethod` + `confidence` 指标 |
| 多语言 | 仅英文模式 | **6 语言引用模式 (en/zh/fr/es/ru/pt)** |
| 线程管理 | 依赖 Zammad 内部 | **完整 RFC 2822 Message-ID 链** |
