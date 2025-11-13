# Customer Portal 优化技术规范 v2.0

> 📌 **本版本已对齐现有项目架构**
> 基于实际代码库分析，使用项目现有的技术栈和模式

---

## 前置阅读

在实施本spec前，请先阅读：
- [`openspec/PROJECT-CONTEXT.md`](../../PROJECT-CONTEXT.md) - 完整项目技术上下文

---

## 1. 技术栈对齐

### 1.1 已确认的技术栈

```yaml
框架: Next.js 14.0.0 (App Router)
语言: TypeScript 5.3.0
数据库: SQLite (Prisma 6.19.0)
状态管理: Zustand 5.0.8
表单: React Hook Form 7.65.0 + Zod 3.22.0
UI: shadcn/ui (Radix UI + Tailwind)
国际化: next-intl 4.4.0
实时通信: 自定义SSE Manager (不使用Socket.IO)
```

### 1.2 关键差异说明

| 之前假设 | 实际情况 | 影响 |
|---------|---------|------|
| 使用PostgreSQL | ✅ SQLite (可迁移PostgreSQL) | SQL语法需兼容SQLite |
| 使用原生SQL | ✅ Prisma ORM | 使用Prisma API而非raw SQL |
| 使用SSE (原生) | ✅ 自定义SSEManager | 使用现有SSEManager类 |
| 需创建文件上传API | ⚠️ API已存在但为Mock | 只需实现真实存储逻辑 |
| 需创建FAQ评分API | ✅ 完整实现 | 只需前端集成 |

---

## 2. Bug修复详细设计（对齐实际代码）

### 2.1 工单路由修复

#### 当前代码分析

```typescript
// src/app/(customer)/my-tickets/page.tsx
// ❌ 错误代码 (Line 173, 200)
router.push(`/staff/tickets/${ticket.id}`)

// ✅ 应改为
router.push(`/my-tickets/${ticket.id}`)
```

#### 修复方案

```typescript
// src/app/(customer)/my-tickets/page.tsx
'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useTickets } from '@/lib/hooks/use-ticket'

export default function MyTicketsPage() {
  const router = useRouter()
  const t = useTranslations('tickets')
  const { tickets, isLoading } = useTickets()

  const handleTicketClick = (ticket: any) => {
    // ✅ 修复：使用customer路由
    router.push(`/my-tickets/${ticket.number || ticket.id}`)
  }

  return (
    <div className="container py-6">
      <h1>{t('myTickets')}</h1>

      {tickets.map((ticket) => (
        <div
          key={ticket.id}
          onClick={() => handleTicketClick(ticket)}
          className="cursor-pointer"
        >
          <TicketCard ticket={ticket} />
        </div>
      ))}
    </div>
  )
}
```

### 2.2 工单列表为空问题修复

#### 根本原因分析

基于代码库分析，问题可能在于：

1. **Zammad用户映射** (`src/lib/zammad/user-mapping.ts`)
   ```typescript
   // 当前映射可能不正确
   export const USER_ZAMMAD_MAPPING: Record<string, number> = {
     'customer@test.com': 2,  // 需要验证此ID是否正确
     'staff@test.com': 3,
     'admin@test.com': 1
   }
   ```

2. **API数据获取逻辑**
   - 需要确认Zammad API返回的数据结构
   - 需要确认用户ID映射是否正确

#### 修复步骤

**步骤1：验证Zammad用户映射**

```typescript
// 添加到 src/lib/zammad/user-mapping.ts

export async function ensureCustomerMapping(email: string): Promise<number> {
  // 检查映射是否存在
  if (USER_ZAMMAD_MAPPING[email]) {
    console.log(`[Mapping] Found existing mapping: ${email} -> ${USER_ZAMMAD_MAPPING[email]}`)
    return USER_ZAMMAD_MAPPING[email]
  }

  // 从Zammad搜索用户
  try {
    const users = await fetch(`${process.env.ZAMMAD_URL}/api/v1/users/search?query=${email}`, {
      headers: {
        'Authorization': `Token token=${process.env.ZAMMAD_API_TOKEN}`,
      }
    }).then(r => r.json())

    if (users.length > 0) {
      const zammadId = users[0].id
      console.log(`[Mapping] Auto-discovered: ${email} -> ${zammadId}`)

      // 更新映射（仅在内存中，生产环境应保存到数据库）
      USER_ZAMMAD_MAPPING[email] = zammadId
      return zammadId
    }
  } catch (error) {
    console.error('[Mapping] Failed to search user:', error)
  }

  throw new Error(`No Zammad user found for ${email}`)
}
```

**步骤2：修复工单获取API**

```typescript
// src/app/api/tickets/route.ts (或创建 src/app/api/customer/tickets/route.ts)
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/utils/auth'
import { getUserZammadId, ensureCustomerMapping } from '@/lib/zammad/user-mapping'
import { successResponse, serverErrorResponse } from '@/lib/utils/api-response'

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()

    // 获取或自动发现Zammad用户ID
    let zammadUserId = getUserZammadId(user.email)

    if (!zammadUserId) {
      console.warn(`[API] No mapping for ${user.email}, attempting auto-discovery`)
      zammadUserId = await ensureCustomerMapping(user.email)
    }

    // 调用Zammad API获取工单
    const zammadUrl = process.env.ZAMMAD_URL
    const token = process.env.ZAMMAD_API_TOKEN

    const response = await fetch(
      `${zammadUrl}/api/v1/tickets/search?query=customer.id:${zammadUserId}&limit=100`,
      {
        headers: {
          'Authorization': `Token token=${token}`,
          'Content-Type': 'application/json',
        }
      }
    )

    if (!response.ok) {
      throw new Error(`Zammad API error: ${response.status}`)
    }

    const data = await response.json()
    const tickets = data.assets?.Ticket ? Object.values(data.assets.Ticket) : []

    console.log(`[API] Found ${tickets.length} tickets for customer ${user.email}`)

    return successResponse({
      tickets,
      total: tickets.length
    })

  } catch (error: any) {
    console.error('[API] Error fetching tickets:', error)
    return serverErrorResponse('Failed to fetch tickets', error.message)
  }
}
```

### 2.3 文件上传实现（基于现有API）

#### 当前状态

文件上传API已存在 (`src/app/api/files/upload/route.ts`)，但只返回Mock数据：

```typescript
// 当前代码
// TODO: Replace with real file storage when implemented
const mockFileId = `file_${Date.now()}_${Math.random().toString(36).substring(7)}`
const mockPublicUrl = `/uploads/${bucketName}/${fileName}`

return successResponse({
  id: mockFileId,
  bucket_name: bucketName,
  file_path: fileName,
  file_name: file.name,
  file_size: file.size,
  mime_type: file.type,
  url: mockPublicUrl,
}, 201)
```

#### 修复方案

**方案A：本地文件系统存储**（推荐用于开发/Demo）

```typescript
// src/app/api/files/upload/route.ts
import { NextRequest } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { requireAuth } from '@/lib/utils/auth'
import { successResponse, validationErrorResponse, serverErrorResponse } from '@/lib/utils/api-response'
import { FileUploadSchema } from '@/types/api.types'
import { prisma } from '@/lib/prisma'

const BUCKET_MAP = {
  message: process.env.STORAGE_BUCKET_MESSAGE_ATTACHMENTS || 'message-attachments',
  user_profile: process.env.STORAGE_BUCKET_AVATARS || 'avatars',
  ticket: process.env.STORAGE_BUCKET_TICKET_ATTACHMENTS || 'ticket-attachments',
}

// 允许的文件类型
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()

    // 解析表单数据
    const formData = await request.formData()
    const file = formData.get('file') as File
    const reference_type = formData.get('reference_type') as string
    const reference_id = formData.get('reference_id') as string | null

    if (!file) {
      return validationErrorResponse({ file: 'File is required' })
    }

    // 验证文件类型
    if (!ALLOWED_TYPES.includes(file.type)) {
      return validationErrorResponse({
        file: `File type not allowed. Allowed types: ${ALLOWED_TYPES.join(', ')}`
      })
    }

    // 验证文件大小
    if (file.size > MAX_FILE_SIZE) {
      return validationErrorResponse({
        file: `File size exceeds limit. Max size: ${MAX_FILE_SIZE / 1024 / 1024}MB`
      })
    }

    // 验证reference_type
    const validation = FileUploadSchema.safeParse({
      reference_type,
      reference_id: reference_id || undefined,
    })

    if (!validation.success) {
      return validationErrorResponse(validation.error.errors)
    }

    const bucketName = BUCKET_MAP[validation.data.reference_type]

    // 生成文件路径
    const fileExt = file.name.split('.').pop()
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(7)
    const fileName = `${user.id}/${timestamp}-${randomStr}.${fileExt}`

    // 创建上传目录
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', bucketName, user.id)
    await mkdir(uploadDir, { recursive: true })

    // 保存文件
    const filePath = path.join(uploadDir, `${timestamp}-${randomStr}.${fileExt}`)
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    // 生成公开URL
    const publicUrl = `/uploads/${bucketName}/${fileName}`

    // 保存文件元数据到数据库（需要先创建Prisma model）
    // TODO: 创建 FileMetadata model
    /*
    const fileRecord = await prisma.fileMetadata.create({
      data: {
        originalName: file.name,
        filename: `${timestamp}-${randomStr}.${fileExt}`,
        mimeType: file.type,
        size: file.size,
        uploadedBy: user.id,
        bucketName,
        filePath: fileName,
      }
    })
    */

    // 临时方案：不保存到数据库，直接返回
    const fileId = `file_${timestamp}_${randomStr}`

    console.log('[Upload] File saved:', {
      id: fileId,
      path: filePath,
      url: publicUrl,
      size: file.size
    })

    return successResponse(
      {
        id: fileId,
        bucket_name: bucketName,
        file_path: fileName,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        url: publicUrl,
      },
      201
    )
  } catch (error: any) {
    console.error('[Upload] Error:', error)
    if (error.message === 'Unauthorized') {
      return unauthorizedResponse()
    }
    return serverErrorResponse('Failed to upload file', error.message)
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
}
```

**需要添加的Prisma Model**:

```prisma
// prisma/schema.prisma

model FileMetadata {
  id           String   @id @default(uuid())
  originalName String
  filename     String
  mimeType     String
  size         Int
  uploadedBy   String
  bucketName   String
  filePath     String
  referenceType String?  // message, ticket, user_profile
  referenceId  String?
  createdAt    DateTime @default(now())

  @@index([uploadedBy])
  @@index([referenceType, referenceId])
  @@map("file_metadata")
}
```

**文件下载API**:

```typescript
// src/app/api/files/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'
import { requireAuth } from '@/lib/utils/auth'
import { errorResponse } from '@/lib/utils/api-response'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth()

    const fileId = params.id

    // TODO: 从数据库获取文件元数据
    // const fileRecord = await prisma.fileMetadata.findUnique({
    //   where: { id: fileId }
    // })

    // 临时方案：从文件ID推导路径（不安全，仅用于Demo）
    // 生产环境必须从数据库查询
    const uploadDir = path.join(process.cwd(), 'public', 'uploads')

    // 这里需要实际的文件查找逻辑
    // 暂时返回错误
    return errorResponse('File download not fully implemented', 501)

  } catch (error: any) {
    console.error('[Download] Error:', error)
    return errorResponse('Failed to download file', 500)
  }
}
```

#### 前端集成（基于现有组件模式）

```typescript
// src/components/file-upload.tsx (增强现有组件)
'use client'

import { useState, useRef, ChangeEvent } from 'react'
import { Upload, X, FileIcon, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface UploadedFile {
  id: string
  file_name: string
  file_size: number
  mime_type: string
  url: string
}

interface FileUploadProps {
  referenceType: 'message' | 'ticket' | 'user_profile'
  referenceId?: string
  maxFiles?: number
  maxSize?: number // bytes
  accept?: string
  onFilesChange?: (files: UploadedFile[]) => void
}

export function FileUpload({
  referenceType,
  referenceId,
  maxFiles = 5,
  maxSize = 5 * 1024 * 1024, // 5MB
  accept = 'image/*,.pdf,.doc,.docx,.txt',
  onFilesChange
}: FileUploadProps) {
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])

    if (files.length + selectedFiles.length > maxFiles) {
      toast.error(`最多只能上传 ${maxFiles} 个文件`)
      return
    }

    setUploading(true)

    try {
      const uploadedFiles: UploadedFile[] = []

      for (const file of selectedFiles) {
        // 验证文件大小
        if (file.size > maxSize) {
          toast.error(`${file.name} 超过大小限制 (${maxSize / 1024 / 1024}MB)`)
          continue
        }

        // 创建FormData
        const formData = new FormData()
        formData.append('file', file)
        formData.append('reference_type', referenceType)
        if (referenceId) {
          formData.append('reference_id', referenceId)
        }

        // 上传文件
        const response = await fetch('/api/files/upload', {
          method: 'POST',
          body: formData
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error?.message || '上传失败')
        }

        const data = await response.json()
        uploadedFiles.push(data.data)

        toast.success(`${file.name} 上传成功`)
      }

      const newFiles = [...files, ...uploadedFiles]
      setFiles(newFiles)
      onFilesChange?.(newFiles)

    } catch (error: any) {
      console.error('[Upload] Error:', error)
      toast.error(error.message || '上传失败')
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
    onFilesChange?.(newFiles)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accept}
          onChange={handleFileSelect}
          className="hidden"
          disabled={uploading || files.length >= maxFiles}
        />

        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={uploading || files.length >= maxFiles}
        >
          {uploading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              上传中...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              选择文件
            </>
          )}
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
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <FileIcon className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.file_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.file_size)}
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

**集成到工单创建页面**:

```typescript
// src/app/(customer)/my-tickets/create/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { FileUpload } from '@/components/file-upload'
import { toast } from 'sonner'

const ticketSchema = z.object({
  title: z.string().min(1, '请输入标题'),
  description: z.string().min(10, '请输入至少10个字符的描述'),
  priority: z.enum(['1', '2', '3']),
})

type TicketFormData = z.infer<typeof ticketSchema>

export default function CreateTicketPage() {
  const router = useRouter()
  const [attachments, setAttachments] = useState<any[]>([])
  const [submitting, setSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<TicketFormData>({
    resolver: zodResolver(ticketSchema)
  })

  const onSubmit = async (data: TicketFormData) => {
    setSubmitting(true)

    try {
      // 创建工单
      const response = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          attachments: attachments.map(f => f.url) // 传递文件URL
        })
      })

      if (!response.ok) {
        throw new Error('创建工单失败')
      }

      const result = await response.json()

      toast.success('工单创建成功')
      router.push(`/my-tickets/${result.data.id}`)

    } catch (error: any) {
      console.error('[CreateTicket] Error:', error)
      toast.error(error.message || '创建工单失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="container max-w-2xl py-8">
      <h1 className="text-3xl font-bold mb-6">创建工单</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* 标题 */}
        <div>
          <label className="block text-sm font-medium mb-2">
            标题 <span className="text-destructive">*</span>
          </label>
          <input
            {...register('title')}
            className="w-full px-3 py-2 border rounded-md"
            placeholder="简要描述您的问题"
          />
          {errors.title && (
            <p className="text-sm text-destructive mt-1">{errors.title.message}</p>
          )}
        </div>

        {/* 描述 */}
        <div>
          <label className="block text-sm font-medium mb-2">
            详细描述 <span className="text-destructive">*</span>
          </label>
          <textarea
            {...register('description')}
            rows={6}
            className="w-full px-3 py-2 border rounded-md"
            placeholder="请详细描述您遇到的问题"
          />
          {errors.description && (
            <p className="text-sm text-destructive mt-1">{errors.description.message}</p>
          )}
        </div>

        {/* 优先级 */}
        <div>
          <label className="block text-sm font-medium mb-2">
            优先级 <span className="text-destructive">*</span>
          </label>
          <select
            {...register('priority')}
            className="w-full px-3 py-2 border rounded-md"
          >
            <option value="1">低</option>
            <option value="2">中</option>
            <option value="3">高</option>
          </select>
        </div>

        {/* 附件上传 - ✅ 已实现 */}
        <div>
          <label className="block text-sm font-medium mb-2">
            附件
          </label>
          <FileUpload
            referenceType="ticket"
            maxFiles={5}
            onFilesChange={setAttachments}
          />
        </div>

        {/* 提交按钮 */}
        <div className="flex gap-3">
          <Button type="submit" disabled={submitting}>
            {submitting ? '提交中...' : '提交工单'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            取消
          </Button>
        </div>
      </form>
    </div>
  )
}
```

### 2.4 FAQ评分系统（前端集成）

API已完全实现，只需前端集成：

```typescript
// src/components/faq/faq-rating.tsx
'use client'

import { useState, useEffect } from 'react'
import { ThumbsUp, ThumbsDown, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface FaqRatingProps {
  articleId: number
}

interface RatingStats {
  total: number
  helpful: number
  notHelpful: number
  percentage: number
}

export function FaqRating({ articleId }: FaqRatingProps) {
  const [userRating, setUserRating] = useState<boolean | null>(null)
  const [stats, setStats] = useState<RatingStats>({
    total: 0,
    helpful: 0,
    notHelpful: 0,
    percentage: 0
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchRating()
  }, [articleId])

  const fetchRating = async () => {
    try {
      const response = await fetch(`/api/faq/${articleId}`)
      const data = await response.json()

      if (data.success && data.data.article) {
        const article = data.data.article

        // 计算统计
        const helpful = article.ratings?.filter((r: any) => r.isHelpful).length || 0
        const notHelpful = article.ratings?.filter((r: any) => !r.isHelpful).length || 0
        const total = helpful + notHelpful

        setStats({
          total,
          helpful,
          notHelpful,
          percentage: total > 0 ? Math.round((helpful / total) * 100) : 0
        })

        // 获取用户的评分（需要user ID比对）
        // TODO: 实现用户评分状态
      }
    } catch (error) {
      console.error('[Rating] Fetch error:', error)
    }
  }

  const handleRate = async (isHelpful: boolean) => {
    if (loading) return

    setLoading(true)

    try {
      const response = await fetch(`/api/faq/${articleId}/rating`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_helpful: isHelpful })
      })

      const data = await response.json()

      if (data.success) {
        setUserRating(isHelpful)
        toast.success('感谢您的反馈！')

        // 刷新统计
        await fetchRating()
      } else {
        throw new Error(data.error?.message || '评分失败')
      }
    } catch (error: any) {
      console.error('[Rating] Submit error:', error)
      toast.error(error.message || '评分失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border-t pt-6 mt-6">
      <p className="text-sm font-medium mb-3">这篇文章有帮助吗？</p>

      <div className="flex items-center gap-3">
        <Button
          variant={userRating === true ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleRate(true)}
          disabled={loading}
        >
          {loading && userRating === true ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <ThumbsUp className="w-4 h-4 mr-2" />
          )}
          有帮助 ({stats.helpful})
        </Button>

        <Button
          variant={userRating === false ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleRate(false)}
          disabled={loading}
        >
          {loading && userRating === false ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <ThumbsDown className="w-4 h-4 mr-2" />
          )}
          没帮助 ({stats.notHelpful})
        </Button>
      </div>

      {stats.total > 0 && (
        <p className="text-xs text-muted-foreground mt-3">
          {stats.percentage}% 的用户认为有帮助 (共 {stats.total} 人评价)
        </p>
      )}
    </div>
  )
}
```

**集成到FAQ详情页**:

```typescript
// src/app/(customer)/faq/[id]/page.tsx (需要创建)
'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { FaqRating } from '@/components/faq/faq-rating'
import ReactMarkdown from 'react-markdown'

export default function FaqDetailPage() {
  const params = useParams()
  const articleId = parseInt(params.id as string)

  const [article, setArticle] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchArticle()
  }, [articleId])

  const fetchArticle = async () => {
    try {
      const response = await fetch(`/api/faq/${articleId}`)
      const data = await response.json()

      if (data.success) {
        setArticle(data.data.article)
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div>加载中...</div>
  if (!article) return <div>文章未找到</div>

  return (
    <div className="container max-w-4xl py-8">
      <article className="prose prose-slate max-w-none">
        <h1>{article.translations[0]?.title}</h1>

        <ReactMarkdown>
          {article.translations[0]?.content || ''}
        </ReactMarkdown>
      </article>

      {/* FAQ评分组件 */}
      <FaqRating articleId={articleId} />
    </div>
  )
}
```

---

## 3. 数据库迁移方案

### 3.1 添加文件元数据表

```bash
# 1. 添加model到 prisma/schema.prisma
# (见上文 FileMetadata model)

# 2. 生成迁移
npx prisma migrate dev --name add_file_metadata

# 3. 生成Prisma Client
npx prisma generate
```

### 3.2 添加通知表

```prisma
// prisma/schema.prisma

model Notification {
  id        String   @id @default(uuid())
  userId    String
  type      String   // ticket_update, message_received, etc.
  title     String
  content   String?
  data      String   // JSON string
  isRead    Boolean  @default(false)
  readAt    DateTime?
  createdAt DateTime @default(now())

  @@index([userId, isRead])
  @@map("notifications")
}
```

---

## 4. 实施优先级（基于实际项目状态）

### 阶段1：紧急修复（2-3天）

#### 已存在API，只需修复前端
- [x] FAQ评分API ✅ 已实现
- [ ] FAQ评分UI集成 ⚠️ 待实现

#### 需要修复的Bug
- [ ] 工单路由修复（Line 173, 200）
- [ ] 工单列表为空问题（Zammad映射）
- [ ] SSE连接问题

### 阶段2：功能完善（1-2周）

#### 已有API骨架，需要实现逻辑
- [ ] 文件上传真实存储
- [ ] 文件下载功能

#### 需要创建的功能
- [ ] 工单详情页面
- [ ] 对话文件附件UI

### 阶段3：新增功能（2-3周）

- [ ] 通知中心
- [ ] 帮助引导
- [ ] 预约系统

---

## 5. 测试策略

### 5.1 单元测试（使用现有测试框架）

```typescript
// __tests__/api/faq-rating.test.ts
import { POST } from '@/app/api/faq/[id]/rating/route'
import { prisma } from '@/lib/prisma'

describe('/api/faq/[id]/rating', () => {
  it('should create new rating', async () => {
    const request = new NextRequest('http://localhost/api/faq/1/rating', {
      method: 'POST',
      body: JSON.stringify({ is_helpful: true })
    })

    const response = await POST(request, { params: { id: '1' } })
    const data = await response.json()

    expect(data.success).toBe(true)
    expect(data.data.rating.is_helpful).toBe(true)
  })
})
```

### 5.2 E2E测试（使用Playwright）

已在测试中使用Playwright，可继续使用：

```typescript
// e2e/customer-tickets.spec.ts
import { test, expect } from '@playwright/test'

test('customer can create ticket with attachments', async ({ page }) => {
  // 登录
  await page.goto('/login')
  await page.fill('[name="email"]', 'customer@test.com')
  await page.fill('[name="password"]', 'password123')
  await page.click('button[type="submit"]')

  // 创建工单
  await page.goto('/my-tickets/create')
  await page.fill('[name="title"]', 'Test Ticket')
  await page.fill('[name="description"]', 'Test description with more than 10 characters')

  // 上传文件
  const fileInput = await page.locator('input[type="file"]')
  await fileInput.setInputFiles('./test-files/test.pdf')

  // 等待上传完成
  await page.waitForSelector('text=/test.pdf/')

  // 提交
  await page.click('button[type="submit"]')

  // 验证
  await page.waitForURL(/\/my-tickets\/\d+/)
  await expect(page.locator('h1')).toContainText('Test Ticket')
})
```

---

## 6. 部署清单

### 6.1 环境变量验证

```bash
# 检查必需的环境变量
✅ DATABASE_URL
✅ ZAMMAD_URL
✅ ZAMMAD_API_TOKEN
⚠️ STORAGE_BUCKET_* (文件上传需要)
```

### 6.2 数据库迁移

```bash
# 1. 运行所有迁移
npx prisma migrate deploy

# 2. 生成Prisma Client
npx prisma generate

# 3. 验证数据库
npx prisma studio
```

### 6.3 文件上传目录准备

```bash
# 创建上传目录
mkdir -p public/uploads/ticket-attachments
mkdir -p public/uploads/message-attachments
mkdir -p public/uploads/avatars

# 设置权限（Linux/Mac）
chmod 755 public/uploads
chmod 755 public/uploads/*
```

---

## 7. 监控和日志

### 7.1 使用现有Logger

```typescript
// src/lib/utils/logger.ts 已存在
import { logger } from '@/lib/utils/logger'

// 使用示例
logger.info('File uploaded', {
  userId: user.id,
  fileSize: file.size,
  fileName: file.name
})

logger.error('Upload failed', {
  error: error.message,
  stack: error.stack
})
```

### 7.2 性能监控

```typescript
// 在关键API中添加性能日志
const startTime = Date.now()

// ... 执行操作

const duration = Date.now() - startTime
logger.info('Operation completed', {
  operation: 'file_upload',
  duration,
  userId: user.id
})
```

---

## 总结

本技术规范v2.0已完全对齐现有项目架构：

✅ **使用Prisma ORM** 而非原生SQL
✅ **使用SQLite** (可迁移PostgreSQL)
✅ **使用现有SSEManager** 不重新实现
✅ **基于现有API骨架** 完善实现
✅ **使用现有工具函数** (api-response, logger等)
✅ **遵循现有代码模式** (shadcn/ui, Zustand, etc)

**下一步**: 阅读 [`openspec/PROJECT-CONTEXT.md`](../../PROJECT-CONTEXT.md) 获取完整项目上下文。
