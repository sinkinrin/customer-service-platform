'use client'

import { useMemo } from 'react'
import DOMPurify from 'dompurify'
import { Badge } from '@/components/ui/badge'
import { Paperclip, Download } from 'lucide-react'
import type { TicketArticle, TicketArticleAttachment } from '@/lib/hooks/use-ticket'
import { cn } from '@/lib/utils'

interface ArticleContentProps {
  article: TicketArticle
  showAttachments?: boolean
  className?: string
}

/**
 * 格式化文件大小
 */
function formatFileSize(sizeStr: string): string {
  const bytes = parseInt(sizeStr, 10)
  if (isNaN(bytes)) return sizeStr
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * 获取发送者类型的样式
 */
export function getSenderStyle(sender: string): {
  bgColor: string
  borderColor: string
  label: string
  labelColor: string
} {
  switch (sender) {
    case 'Customer':
      return {
        bgColor: 'bg-blue-50 dark:bg-blue-950',
        borderColor: 'border-blue-200 dark:border-blue-800',
        label: '客户',
        labelColor: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      }
    case 'Agent':
      return {
        bgColor: 'bg-green-50 dark:bg-green-950',
        borderColor: 'border-green-200 dark:border-green-800',
        label: '客服',
        labelColor: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      }
    case 'System':
      return {
        bgColor: 'bg-gray-50 dark:bg-gray-900',
        borderColor: 'border-gray-200 dark:border-gray-700',
        label: '系统',
        labelColor: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
      }
    default:
      return {
        bgColor: '',
        borderColor: 'border-gray-200 dark:border-gray-700',
        label: sender,
        labelColor: 'bg-gray-100 text-gray-800',
      }
  }
}

/**
 * 过滤掉内联附件（如邮件正文中的图片）
 */
function filterInlineAttachments(attachments: TicketArticleAttachment[]): TicketArticleAttachment[] {
  return attachments.filter(att => {
    // 过滤掉 content-alternative 类型的附件（如 message.html）
    if (att.preferences?.['content-alternative']) return false
    // 过滤掉内联图片（通常有 Content-ID）
    // 保留其他附件
    return true
  })
}

/**
 * Article 内容渲染组件
 * 
 * 功能：
 * 1. 根据 content_type 安全渲染 HTML 或纯文本
 * 2. 显示发送者类型标签
 * 3. 显示附件列表和下载链接
 */
export function ArticleContent({ article, showAttachments = true, className }: ArticleContentProps) {
  // 安全处理 HTML 内容
  const sanitizedBody = useMemo(() => {
    if (article.content_type === 'text/html' || article.content_type?.includes('html')) {
      // 配置 DOMPurify 允许的标签和属性
      return DOMPurify.sanitize(article.body, {
        ALLOWED_TAGS: [
          'p', 'br', 'div', 'span', 'strong', 'b', 'em', 'i', 'u', 's',
          'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
          'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
          'a', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
          'hr', 'sub', 'sup',
        ],
        ALLOWED_ATTR: [
          'href', 'src', 'alt', 'title', 'class', 'style',
          'target', 'rel', 'width', 'height',
          'data-signature', 'data-signature-id',
        ],
        // 允许 target="_blank" 但添加安全属性
        ADD_ATTR: ['target'],
        // 转换所有链接为安全链接
        FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input'],
      })
    }
    return null
  }, [article.body, article.content_type])

  // 过滤附件
  const displayAttachments = useMemo(() => {
    if (!article.attachments || article.attachments.length === 0) return []
    return filterInlineAttachments(article.attachments)
  }, [article.attachments])

  const senderStyle = getSenderStyle(article.sender)

  return (
    <div className={cn('space-y-3', className)}>
      {/* 发送者标签 */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className={senderStyle.labelColor}>
          {senderStyle.label}
        </Badge>
        {article.internal && (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
            内部备注
          </Badge>
        )}
        <Badge variant="outline" className="text-xs">
          {article.type}
        </Badge>
      </div>

      {/* 正文内容 */}
      <div className={cn(
        'rounded-lg border p-4',
        senderStyle.bgColor,
        senderStyle.borderColor
      )}>
        {sanitizedBody ? (
          // HTML 内容
          <div
            className="prose prose-sm max-w-none dark:prose-invert
              prose-p:my-2 prose-p:leading-relaxed
              prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline
              prose-img:max-w-full prose-img:h-auto
              prose-blockquote:border-l-4 prose-blockquote:border-gray-300 prose-blockquote:pl-4 prose-blockquote:italic
              prose-pre:bg-gray-100 prose-pre:dark:bg-gray-800 prose-pre:p-2 prose-pre:rounded
              [&_[data-signature]]:text-gray-500 [&_[data-signature]]:text-sm [&_[data-signature]]:mt-4 [&_[data-signature]]:pt-4 [&_[data-signature]]:border-t"
            dangerouslySetInnerHTML={{ __html: sanitizedBody }}
          />
        ) : (
          // 纯文本内容
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {article.body}
          </p>
        )}
      </div>

      {/* 附件列表 */}
      {showAttachments && displayAttachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {displayAttachments.map((att) => (
            <a
              key={att.id}
              href={`/api/files/${att.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm 
                bg-gray-100 dark:bg-gray-800 rounded-md 
                hover:bg-gray-200 dark:hover:bg-gray-700 
                transition-colors group"
            >
              <Paperclip className="h-3.5 w-3.5 text-gray-500" />
              <span className="max-w-[200px] truncate">{att.filename}</span>
              <span className="text-xs text-gray-500">
                ({formatFileSize(att.size)})
              </span>
              <Download className="h-3.5 w-3.5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Article 卡片组件 - 完整的 article 展示
 */
interface ArticleCardProps {
  article: TicketArticle
  showMeta?: boolean
}

export function ArticleCard({ article, showMeta = true }: ArticleCardProps) {
  const senderStyle = getSenderStyle(article.sender)
  
  return (
    <div className="space-y-2">
      {showMeta && (
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="font-medium truncate">{article.from || article.created_by}</p>
            {article.to && (
              <p className="text-xs text-muted-foreground truncate">
                收件人: {article.to}
              </p>
            )}
            {article.subject && (
              <p className="text-sm text-muted-foreground truncate">
                {article.subject}
              </p>
            )}
          </div>
          <time className="text-xs text-muted-foreground whitespace-nowrap">
            {new Date(article.created_at).toLocaleString('zh-CN')}
          </time>
        </div>
      )}
      <ArticleContent article={article} />
    </div>
  )
}
