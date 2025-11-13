# Customer Portal 优化技术规范

## 1. 系统架构

### 1.1 整体架构
```
┌────────────────────────────────────────────────────────────┐
│                   Customer Portal前端                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐ │
│  │Dashboard │  │My Tickets│  │  FAQ     │  │Conversations│ │
│  └─────┬────┘  └─────┬────┘  └─────┬────┘  └──────┬─────┘ │
│        └──────────────┴──────────────┴───────────────┘     │
│                         │                                   │
│                    ┌────▼────┐                             │
│                    │API Layer│                             │
│                    └────┬────┘                             │
└─────────────────────────┼────────────────────────────────-─┘
                          │
        ┌─────────────────┼──────────────────┐
        │                 │                  │
   ┌────▼────┐      ┌────▼────┐       ┌────▼────┐
   │Customer │      │  File   │       │   AI    │
   │   API   │      │ Upload  │       │Assistant│
   └────┬────┘      └────┬────┘       └────┬────┘
        │                │                  │
        └────────────────┴──────────────────┘
                         │
                    ┌────▼────┐
                    │Database │
                    │  Store  │
                    └─────────┘
```

## 2. Bug修复详细设计

### 2.1 工单路由修复

#### 问题定位
```typescript
// src/app/(customer)/my-tickets/page.tsx
// Line 173 和 200 - 错误的路由跳转

// 当前错误代码
router.push(`/staff/tickets/${ticket.id}`)  // ❌

// 应该是
router.push(`/my-tickets/${ticket.id}`)      // ✅
```

#### 修复方案
```typescript
// src/app/(customer)/my-tickets/page.tsx
'use client'

import { useRouter } from 'next/navigation'
import { useTickets } from '@/lib/hooks/use-customer-tickets'

export default function MyTicketsPage() {
  const router = useRouter()
  const { tickets, isLoading } = useTickets()

  const handleTicketClick = (ticketId: string | number) => {
    // 确保使用客户端的路由
    router.push(`/my-tickets/${ticketId}`)
  }

  return (
    <div>
      {tickets.map(ticket => (
        <div
          key={ticket.id}
          onClick={() => handleTicketClick(ticket.id)}
          className="cursor-pointer"
        >
          <TicketCard ticket={ticket} />
        </div>
      ))}
    </div>
  )
}
```

#### 测试用例
```typescript
describe('Customer ticket routing', () => {
  it('应该导航到正确的工单详情页', () => {
    const mockRouter = { push: jest.fn() }
    jest.spyOn(require('next/navigation'), 'useRouter')
      .mockReturnValue(mockRouter)

    const { getByText } = render(<MyTicketsPage />)
    const ticket = getByText('Test Ticket')

    fireEvent.click(ticket)

    expect(mockRouter.push).toHaveBeenCalledWith('/my-tickets/60097')
    expect(mockRouter.push).not.toHaveBeenCalledWith('/staff/tickets/60097')
  })
})
```

### 2.2 工单列表为空问题修复

#### 问题分析
可能的原因：
1. Zammad用户映射错误
2. API数据获取失败
3. 权限问题
4. 数据过滤逻辑错误

#### 调查步骤
```typescript
// 1. 验证Zammad用户映射
console.log('Customer user:', {
  email: 'customer@test.com',
  zammadId: getUserZammadId('customer@test.com')
})

// 2. 检查API响应
const response = await fetch('/api/customer/tickets')
const data = await response.json()
console.log('API response:', data)

// 3. 检查Zammad API调用
const zammadTickets = await zammadClient.searchTickets({
  query: `customer.id:${customerId}`
})
console.log('Zammad tickets:', zammadTickets)
```

#### 修复方案

**方案A：修复用户映射**
```typescript
// src/lib/zammad/user-mapping.ts
export const USER_ZAMMAD_MAPPING: Record<string, number> = {
  'customer@test.com': 2, // 确保映射到正确的Zammad用户ID
  'staff@test.com': 3,
  'admin@test.com': 1
}

export function getUserZammadId(email: string): number | null {
  const id = USER_ZAMMAD_MAPPING[email]

  if (!id) {
    console.warn(`[UserMapping] No Zammad ID found for: ${email}`)
    return null
  }

  console.log(`[UserMapping] ${email} -> Zammad ID: ${id}`)
  return id
}
```

**方案B：修复API端点**
```typescript
// src/app/api/customer/tickets/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/mock-auth'
import { getUserZammadId } from '@/lib/zammad/user-mapping'
import { searchTickets } from '@/lib/zammad/client'

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 获取Zammad用户ID
    const zammadUserId = getUserZammadId(currentUser.email)
    if (!zammadUserId) {
      console.error('[API] No Zammad ID for user:', currentUser.email)
      return NextResponse.json(
        { tickets: [], total: 0 },
        { status: 200 }
      )
    }

    // 搜索该用户的工单
    const tickets = await searchTickets({
      query: `customer.id:${zammadUserId}`,
      limit: 100
    })

    console.log(`[API] Found ${tickets.length} tickets for customer ${currentUser.email}`)

    return NextResponse.json({
      success: true,
      tickets,
      total: tickets.length
    })
  } catch (error) {
    console.error('[API] Error fetching customer tickets:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tickets' },
      { status: 500 }
    )
  }
}
```

**方案C：添加Zammad用户创建**
```typescript
// src/lib/zammad/ensure-user.ts
export async function ensureZammadUser(user: {
  email: string
  name: string
  role: string
}) {
  // 检查用户是否存在
  const existingUsers = await zammadClient.searchUsers(user.email)

  if (existingUsers.length > 0) {
    console.log('[Zammad] User exists:', existingUsers[0].id)
    return existingUsers[0]
  }

  // 创建新用户
  const newUser = await zammadClient.createUser({
    firstname: user.name.split(' ')[0],
    lastname: user.name.split(' ')[1] || '',
    email: user.email,
    roles: [user.role === 'customer' ? 'Customer' : 'Agent']
  })

  console.log('[Zammad] Created user:', newUser.id)

  // 更新用户映射
  USER_ZAMMAD_MAPPING[user.email] = newUser.id

  return newUser
}
```

### 2.3 文件上传实现

#### 技术选型

**选项1：本地文件系统存储**
- 优点：简单、无额外成本
- 缺点：不适合水平扩展、备份困难

**选项2：云存储（推荐）**
- AWS S3 / Azure Blob / Cloudinary
- 优点：可扩展、高可用、CDN加速
- 缺点：需要额外配置

**选型建议**：开发环境使用本地存储，生产环境使用云存储

#### 实现方案

**后端：文件上传API**
```typescript
// src/app/api/files/upload/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

// 允许的文件类型
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]

// 最大文件大小 (5MB)
const MAX_SIZE = 5 * 1024 * 1024

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // 验证文件类型
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'File type not allowed' },
        { status: 400 }
      )
    }

    // 验证文件大小
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds limit (5MB)' },
        { status: 400 }
      )
    }

    // 生成唯一文件名
    const fileId = uuidv4()
    const ext = path.extname(file.name)
    const filename = `${fileId}${ext}`

    // 读取文件内容
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // 保存文件
    const uploadDir = path.join(process.cwd(), 'uploads')
    const filepath = path.join(uploadDir, filename)

    await writeFile(filepath, buffer)

    // 保存文件元数据到数据库
    const fileRecord = await saveFileMetadata({
      id: fileId,
      originalName: file.name,
      filename,
      mimeType: file.type,
      size: file.size,
      uploadedBy: getCurrentUserId(),
      uploadedAt: new Date()
    })

    return NextResponse.json({
      success: true,
      file: {
        id: fileId,
        name: file.name,
        size: file.size,
        type: file.type,
        url: `/api/files/${fileId}`
      }
    })
  } catch (error) {
    console.error('[Upload] Error:', error)
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 }
    )
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
}
```

**后端：文件下载API**
```typescript
// src/app/api/files/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const fileId = params.id

    // 从数据库获取文件元数据
    const fileRecord = await getFileMetadata(fileId)

    if (!fileRecord) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      )
    }

    // 验证访问权限
    const hasAccess = await checkFileAccess(fileId, getCurrentUserId())
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // 读取文件
    const filepath = path.join(process.cwd(), 'uploads', fileRecord.filename)
    const fileBuffer = await readFile(filepath)

    // 返回文件
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': fileRecord.mimeType,
        'Content-Disposition': `inline; filename="${fileRecord.originalName}"`,
        'Content-Length': fileRecord.size.toString(),
        'Cache-Control': 'private, max-age=31536000'
      }
    })
  } catch (error) {
    console.error('[Download] Error:', error)
    return NextResponse.json(
      { error: 'Download failed' },
      { status: 500 }
    )
  }
}
```

**前端：文件上传组件**
```typescript
// src/components/file-upload.tsx
'use client'

import { useState, useRef } from 'react'
import { Upload, X, FileIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface UploadedFile {
  id: string
  name: string
  size: number
  type: string
  url: string
}

interface FileUploadProps {
  onUpload?: (files: UploadedFile[]) => void
  maxFiles?: number
  accept?: string
}

export function FileUpload({ onUpload, maxFiles = 5, accept }: FileUploadProps) {
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])

    if (files.length + selectedFiles.length > maxFiles) {
      alert(`最多只能上传 ${maxFiles} 个文件`)
      return
    }

    setUploading(true)

    try {
      const uploadedFiles: UploadedFile[] = []

      for (const file of selectedFiles) {
        const formData = new FormData()
        formData.append('file', file)

        const response = await fetch('/api/files/upload', {
          method: 'POST',
          body: formData
        })

        if (!response.ok) {
          throw new Error(`上传失败: ${file.name}`)
        }

        const data = await response.json()
        uploadedFiles.push(data.file)
      }

      const newFiles = [...files, ...uploadedFiles]
      setFiles(newFiles)
      onUpload?.(newFiles)
    } catch (error) {
      console.error('[Upload] Error:', error)
      alert('文件上传失败，请重试')
    } finally {
      setUploading(false)
      if (inputRef.current) {
        inputRef.current.value = ''
      }
    }
  }

  const handleRemove = (fileId: string) => {
    const newFiles = files.filter(f => f.id !== fileId)
    setFiles(newFiles)
    onUpload?.(newFiles)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accept}
          onChange={handleFileChange}
          className="hidden"
        />

        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={uploading || files.length >= maxFiles}
        >
          <Upload className="w-4 h-4 mr-2" />
          {uploading ? '上传中...' : '选择文件'}
        </Button>

        <span className="text-sm text-muted-foreground">
          {files.length}/{maxFiles} 个文件
        </span>
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map(file => (
            <div
              key={file.id}
              className="flex items-center justify-between p-3 border rounded-lg"
            >
              <div className="flex items-center gap-3">
                <FileIcon className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.size)}
                  </p>
                </div>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleRemove(file.id)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
```

**集成到工单创建**
```typescript
// src/app/(customer)/my-tickets/create/page.tsx
'use client'

import { useState } from 'react'
import { FileUpload } from '@/components/file-upload'

export default function CreateTicketPage() {
  const [attachments, setAttachments] = useState<UploadedFile[]>([])

  const handleSubmit = async (formData: TicketFormData) => {
    const ticketData = {
      ...formData,
      attachments: attachments.map(f => f.id)
    }

    const response = await fetch('/api/customer/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ticketData)
    })

    // 处理响应...
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* 其他表单字段 */}

      <div>
        <label>附件</label>
        <FileUpload
          onUpload={setAttachments}
          maxFiles={5}
          accept="image/*,.pdf,.doc,.docx,.txt"
        />
      </div>

      <button type="submit">提交工单</button>
    </form>
  )
}
```

### 2.4 FAQ评分系统

#### 数据库设计
```sql
CREATE TABLE faq_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id VARCHAR(50) NOT NULL,
  user_id VARCHAR(50) NOT NULL,
  rating INTEGER NOT NULL CHECK (rating IN (-1, 1)), -- -1=不满意, 1=满意
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(article_id, user_id) -- 每个用户每篇文章只能评分一次
);

CREATE INDEX idx_faq_ratings_article ON faq_ratings(article_id);
CREATE INDEX idx_faq_ratings_user ON faq_ratings(user_id);

-- 评分统计视图
CREATE VIEW faq_rating_stats AS
SELECT
  article_id,
  COUNT(*) as total_ratings,
  SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as helpful_count,
  SUM(CASE WHEN rating = -1 THEN 1 ELSE 0 END) as not_helpful_count,
  ROUND(
    SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*),
    1
  ) as helpful_percentage
FROM faq_ratings
GROUP BY article_id;
```

#### API实现
```typescript
// src/app/api/faq/[id]/rating/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const articleId = params.id
    const { rating } = await request.json()
    const userId = getCurrentUserId()

    if (![-1, 1].includes(rating)) {
      return NextResponse.json(
        { error: 'Invalid rating value' },
        { status: 400 }
      )
    }

    // 使用UPSERT插入或更新评分
    await db.query(`
      INSERT INTO faq_ratings (article_id, user_id, rating)
      VALUES ($1, $2, $3)
      ON CONFLICT (article_id, user_id)
      DO UPDATE SET rating = $3, updated_at = NOW()
    `, [articleId, userId, rating])

    // 获取更新后的统计数据
    const stats = await db.query(`
      SELECT * FROM faq_rating_stats WHERE article_id = $1
    `, [articleId])

    return NextResponse.json({
      success: true,
      rating,
      stats: stats.rows[0]
    })
  } catch (error) {
    console.error('[Rating] Error:', error)
    return NextResponse.json(
      { error: 'Failed to submit rating' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const articleId = params.id
    const userId = getCurrentUserId()

    // 获取用户的评分
    const userRating = await db.query(`
      SELECT rating FROM faq_ratings
      WHERE article_id = $1 AND user_id = $2
    `, [articleId, userId])

    // 获取统计数据
    const stats = await db.query(`
      SELECT * FROM faq_rating_stats WHERE article_id = $1
    `, [articleId])

    return NextResponse.json({
      success: true,
      userRating: userRating.rows[0]?.rating || null,
      stats: stats.rows[0] || {
        total_ratings: 0,
        helpful_count: 0,
        not_helpful_count: 0,
        helpful_percentage: 0
      }
    })
  } catch (error) {
    console.error('[Rating] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch rating' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const articleId = params.id
    const userId = getCurrentUserId()

    await db.query(`
      DELETE FROM faq_ratings
      WHERE article_id = $1 AND user_id = $2
    `, [articleId, userId])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Rating] Error:', error)
    return NextResponse.json(
      { error: 'Failed to delete rating' },
      { status: 500 }
    )
  }
}
```

#### 前端组件
```typescript
// src/components/faq/faq-rating.tsx
'use client'

import { useState, useEffect } from 'react'
import { ThumbsUp, ThumbsDown } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface FaqRatingProps {
  articleId: string
}

export function FaqRating({ articleId }: FaqRatingProps) {
  const [userRating, setUserRating] = useState<number | null>(null)
  const [stats, setStats] = useState({
    total_ratings: 0,
    helpful_count: 0,
    not_helpful_count: 0,
    helpful_percentage: 0
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchRating()
  }, [articleId])

  const fetchRating = async () => {
    try {
      const response = await fetch(`/api/faq/${articleId}/rating`)
      const data = await response.json()

      setUserRating(data.userRating)
      setStats(data.stats)
    } catch (error) {
      console.error('[Rating] Fetch error:', error)
    }
  }

  const handleRate = async (rating: number) => {
    if (loading) return

    setLoading(true)

    try {
      const response = await fetch(`/api/faq/${articleId}/rating`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating })
      })

      const data = await response.json()

      if (data.success) {
        setUserRating(rating)
        setStats(data.stats)
      }
    } catch (error) {
      console.error('[Rating] Submit error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border-t pt-4">
      <p className="text-sm font-medium mb-3">这篇文章有帮助吗？</p>

      <div className="flex items-center gap-4">
        <Button
          variant={userRating === 1 ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleRate(1)}
          disabled={loading}
        >
          <ThumbsUp className="w-4 h-4 mr-2" />
          有帮助 ({stats.helpful_count})
        </Button>

        <Button
          variant={userRating === -1 ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleRate(-1)}
          disabled={loading}
        >
          <ThumbsDown className="w-4 h-4 mr-2" />
          没帮助 ({stats.not_helpful_count})
        </Button>
      </div>

      {stats.total_ratings > 0 && (
        <p className="text-xs text-muted-foreground mt-2">
          {stats.helpful_percentage}% 的用户认为有帮助
          （共 {stats.total_ratings} 人评价）
        </p>
      )}
    </div>
  )
}
```

## 3. 通知系统设计

### 3.1 数据库设计
```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(50) NOT NULL,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(200) NOT NULL,
  content TEXT,
  data JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read);

CREATE TABLE notification_preferences (
  user_id VARCHAR(50) PRIMARY KEY,
  email_enabled BOOLEAN DEFAULT true,
  sms_enabled BOOLEAN DEFAULT false,
  push_enabled BOOLEAN DEFAULT true,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 3.2 通知类型
```typescript
export enum NotificationType {
  TICKET_CREATED = 'ticket_created',
  TICKET_UPDATED = 'ticket_updated',
  TICKET_REPLIED = 'ticket_replied',
  TICKET_CLOSED = 'ticket_closed',
  MESSAGE_RECEIVED = 'message_received',
  SYSTEM_ANNOUNCEMENT = 'system_announcement'
}

export interface Notification {
  id: string
  userId: string
  type: NotificationType
  title: string
  content: string
  data: Record<string, any>
  isRead: boolean
  readAt: Date | null
  createdAt: Date
}
```

### 3.3 推送服务
```typescript
// src/lib/notifications/push-service.ts
export class PushNotificationService {
  async send(userId: string, notification: {
    title: string
    body: string
    icon?: string
    data?: any
  }) {
    // 获取用户的推送订阅
    const subscriptions = await getPushSubscriptions(userId)

    // 发送到所有设备
    const promises = subscriptions.map(subscription =>
      webpush.sendNotification(subscription, JSON.stringify(notification))
    )

    await Promise.allSettled(promises)
  }
}
```

## 4. 性能优化策略

### 4.1 前端优化
```typescript
// 1. 图片懒加载
<Image
  src={imageUrl}
  loading="lazy"
  placeholder="blur"
/>

// 2. 组件懒加载
const FaqRating = dynamic(() => import('@/components/faq/faq-rating'), {
  loading: () => <Skeleton className="h-20" />
})

// 3. 虚拟滚动
import { useVirtualizer } from '@tanstack/react-virtual'

// 4. SWR数据缓存
import useSWR from 'swr'

const { data, error } = useSWR('/api/tickets', fetcher, {
  revalidateOnFocus: false,
  dedupingInterval: 60000
})
```

### 4.2 后端优化
```typescript
// 1. 数据库查询优化
// 添加索引
CREATE INDEX idx_tickets_customer ON tickets(customer_id);
CREATE INDEX idx_tickets_status ON tickets(status);

// 2. API响应缓存
import { unstable_cache } from 'next/cache'

const getCachedTickets = unstable_cache(
  async (userId) => getTickets(userId),
  ['tickets'],
  { revalidate: 60 }
)

// 3. 分页查询
const tickets = await db.query(`
  SELECT * FROM tickets
  WHERE customer_id = $1
  ORDER BY created_at DESC
  LIMIT $2 OFFSET $3
`, [customerId, limit, offset])
```

## 5. 安全措施

### 5.1 文件上传安全
```typescript
// 1. 文件类型验证（魔数检查）
import { fileTypeFromBuffer } from 'file-type'

const fileType = await fileTypeFromBuffer(buffer)
if (!ALLOWED_TYPES.includes(fileType?.mime)) {
  throw new Error('Invalid file type')
}

// 2. 文件名清理
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .substring(0, 100)
}

// 3. 病毒扫描（可选）
import { scanFile } from '@/lib/virus-scan'

const isSafe = await scanFile(filepath)
if (!isSafe) {
  throw new Error('File contains malware')
}
```

### 5.2 API安全
```typescript
// 1. 速率限制
import rateLimit from 'express-rate-limit'

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100 // 最多100个请求
})

// 2. CSRF保护
// 3. SQL注入防护（使用参数化查询）
// 4. XSS防护（输入验证和输出转义）
```

## 6. 测试策略

### 6.1 单元测试
```typescript
describe('FileUpload', () => {
  it('should validate file type', async () => {
    const invalidFile = new File(['content'], 'test.exe', {
      type: 'application/x-msdownload'
    })

    await expect(uploadFile(invalidFile)).rejects.toThrow('File type not allowed')
  })

  it('should validate file size', async () => {
    const largeFile = new File([new ArrayBuffer(10 * 1024 * 1024)], 'large.jpg')

    await expect(uploadFile(largeFile)).rejects.toThrow('File size exceeds limit')
  })
})
```

### 6.2 集成测试
```typescript
describe('Ticket creation flow', () => {
  it('should create ticket with attachments', async () => {
    // 1. 上传文件
    const file = await uploadTestFile()

    // 2. 创建工单
    const ticket = await createTicket({
      title: 'Test',
      description: 'Test description',
      attachments: [file.id]
    })

    // 3. 验证
    expect(ticket.attachments).toHaveLength(1)
  })
})
```

### 6.3 E2E测试
```typescript
test('customer can create and view ticket', async ({ page }) => {
  // 登录
  await page.goto('/login')
  await page.fill('[name="email"]', 'customer@test.com')
  await page.fill('[name="password"]', 'password123')
  await page.click('button[type="submit"]')

  // 创建工单
  await page.goto('/my-tickets/create')
  await page.fill('[name="title"]', 'Test Ticket')
  await page.fill('[name="description"]', 'Test description')

  // 上传附件
  await page.setInputFiles('input[type="file"]', 'test.pdf')

  await page.click('button[type="submit"]')

  // 验证
  await expect(page).toHaveURL(/\/my-tickets\/\d+/)
  await expect(page.locator('h1')).toContainText('Test Ticket')
})
```

## 7. 监控与日志

### 7.1 错误追踪
```typescript
// 使用Sentry
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV
})

// 捕获错误
try {
  await uploadFile(file)
} catch (error) {
  Sentry.captureException(error, {
    tags: { feature: 'file-upload' },
    extra: { fileSize: file.size, fileType: file.type }
  })
  throw error
}
```

### 7.2 性能监控
```typescript
// 使用Web Vitals
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals'

function sendToAnalytics(metric) {
  const body = JSON.stringify(metric)
  const url = '/api/analytics'

  if (navigator.sendBeacon) {
    navigator.sendBeacon(url, body)
  } else {
    fetch(url, { body, method: 'POST', keepalive: true })
  }
}

getCLS(sendToAnalytics)
getFID(sendToAnalytics)
getFCP(sendToAnalytics)
getLCP(sendToAnalytics)
getTTFB(sendToAnalytics)
```

## 8. 部署清单

### 8.1 环境变量
```env
# 文件存储
UPLOAD_DIR=/var/uploads
MAX_FILE_SIZE=5242880
ALLOWED_FILE_TYPES=image/jpeg,image/png,application/pdf

# 通知服务
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:support@example.com

# Sentry
SENTRY_DSN=...
```

### 8.2 数据库迁移
```sql
-- 运行迁移脚本
psql -U postgres -d customerservice -f migrations/001_file_metadata.sql
psql -U postgres -d customerservice -f migrations/002_faq_ratings.sql
psql -U postgres -d customerservice -f migrations/003_notifications.sql
```

### 8.3 部署步骤
1. 运行数据库迁移
2. 构建生产版本
3. 运行测试
4. 部署到staging环境
5. 验证功能
6. 部署到生产环境
7. 监控错误和性能
