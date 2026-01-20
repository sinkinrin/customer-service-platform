'use client'

import { useMemo } from 'react'
import DOMPurify from 'dompurify'
import { useTranslations } from 'next-intl'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Paperclip, Download } from 'lucide-react'
import type { TicketArticle, TicketArticleAttachment } from '@/lib/hooks/use-ticket'
import { cn } from '@/lib/utils'

interface ArticleContentProps {
  article: TicketArticle
  showAttachments?: boolean
  className?: string
  noBubbleStyle?: boolean // Skip sender-specific background in content
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
export function getSenderStyle(sender: string, t?: (key: string) => string): {
  bgColor: string
  borderColor: string
  label: string
  labelColor: string
} {
  const getLabel = (key: string, fallback: string) => t ? t(key) : fallback
  
  switch (sender) {
    case 'Customer':
      return {
        bgColor: 'bg-blue-50 dark:bg-blue-950',
        borderColor: 'border-blue-200 dark:border-blue-800',
        label: getLabel('senderLabels.customer', 'Customer'),
        labelColor: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      }
    case 'Agent':
      return {
        bgColor: 'bg-green-50 dark:bg-green-950',
        borderColor: 'border-green-200 dark:border-green-800',
        label: getLabel('senderLabels.agent', 'Support'),
        labelColor: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      }
    case 'System':
      return {
        bgColor: 'bg-gray-50 dark:bg-gray-900',
        borderColor: 'border-gray-200 dark:border-gray-700',
        label: getLabel('senderLabels.system', 'System'),
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
export function ArticleContent({ article, showAttachments = true, className, noBubbleStyle = false }: ArticleContentProps) {
  const t = useTranslations('tickets.details')
  
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

  const senderStyle = getSenderStyle(article.sender, t)

  return (
    <div className={cn('space-y-3', className)}>
      {/* 发送者标签 - 仅在非气泡模式显示 */}
      {!noBubbleStyle && (
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className={senderStyle.labelColor}>
            {senderStyle.label}
          </Badge>
          {article.internal && (
            <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
              {t('internalNote')}
            </Badge>
          )}
          <Badge variant="outline" className="text-xs">
            {article.type}
          </Badge>
        </div>
      )}

      {/* 正文内容 */}
      <div className={cn(
        !noBubbleStyle && 'rounded-lg border p-4',
        !noBubbleStyle && senderStyle.bgColor,
        !noBubbleStyle && senderStyle.borderColor
      )}>
        {sanitizedBody ? (
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
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {article.body}
          </p>
        )}
      </div>

      {/* 附件列表 */}
      {showAttachments && displayAttachments.length > 0 && (
        <TooltipProvider>
          <div className="flex flex-wrap gap-2">
            {displayAttachments.map((att) => (
              <Tooltip key={att.id}>
                <TooltipTrigger asChild>
                  <a
                    href={`/api/tickets/${article.ticket_id}/articles/${article.id}/attachments/${att.id}`}
                    download={att.filename}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm
                      bg-gray-100 dark:bg-gray-800 rounded-md
                      hover:bg-gray-200 dark:hover:bg-gray-700
                      transition-colors group"
                  >
                    <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="max-w-[200px] truncate text-foreground">{att.filename}</span>
                    <span className="text-xs text-muted-foreground">
                      ({formatFileSize(att.size)})
                    </span>
                    <Download className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground" />
                  </a>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[300px]">
                  <p className="break-all">{att.filename}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(att.size)}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </TooltipProvider>
      )}
    </div>
  )
}

/**
 * Article 卡片组件 - 聊天气泡风格展示
 * 
 * 样式区分根据查看者角色：
 * - Staff/Admin 视角：Customer 左对齐，Agent 右对齐
 * - Customer 视角：自己的消息右对齐，Staff/Admin 左对齐
 * - System: 居中，黄色背景
 */
interface ArticleCardProps {
  article: TicketArticle
  showMeta?: boolean
  viewerRole?: 'customer' | 'staff' | 'admin'
}

export function ArticleCard({ article, showMeta = true, viewerRole = 'staff' }: ArticleCardProps) {
  const t = useTranslations('tickets.details')
  const senderStyle = getSenderStyle(article.sender, t)
  const isCustomerSender = article.sender === 'Customer'
  const isSystem = article.sender === 'System'
  const isAgentSender = article.sender === 'Agent'
  
  // Determine if this message should be on the right ("my message")
  // - For customer viewer: customer messages are on the right
  // - For staff/admin viewer: agent messages are on the right
  const isMyMessage = viewerRole === 'customer' ? isCustomerSender : isAgentSender
  
  // System messages: centered, full width
  if (isSystem) {
    return (
      <div className="flex justify-center">
        <div className="max-w-[90%] bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg px-4 py-2">
          <div className="flex items-center justify-center gap-2 text-xs text-yellow-700 dark:text-yellow-300 mb-1">
            <Badge variant="outline" className={senderStyle.labelColor}>
              {senderStyle.label}
            </Badge>
            <time className="text-muted-foreground">
              {new Date(article.created_at).toLocaleString('zh-CN')}
            </time>
          </div>
          <p className="text-sm text-center text-yellow-800 dark:text-yellow-200">
            {article.body}
          </p>
        </div>
      </div>
    )
  }
  
  return (
    <div className={cn(
      'flex',
      isMyMessage ? 'justify-end' : 'justify-start'
    )}>
      <div className={cn(
        'max-w-[80%] space-y-1',
        isMyMessage ? 'items-end' : 'items-start'
      )}>
        {/* Header: sender info and time */}
        {showMeta && (
          <div className={cn(
            'flex flex-col gap-0.5 text-xs mb-1',
            isMyMessage ? 'items-end' : 'items-start'
          )}>
            <div className={cn(
              'flex items-center gap-2',
              isMyMessage ? 'flex-row-reverse' : 'flex-row'
            )}>
              <Badge variant="outline" className={senderStyle.labelColor}>
                {senderStyle.label}
              </Badge>
              <span className="text-muted-foreground font-medium">
                {article.from?.split('<')[0]?.trim() || article.created_by}
              </span>
              <time className="text-muted-foreground">
                {new Date(article.created_at).toLocaleString('zh-CN')}
              </time>
            </div>
            {/* Show full email on second line if available */}
            {article.from?.includes('<') && (
              <span className="text-muted-foreground/70 text-[10px]">
                {article.from.match(/<(.+)>/)?.[1] || ''}
              </span>
            )}
          </div>
        )}
        
        {/* Message bubble */}
        <div className={cn(
          'rounded-2xl px-4 py-3 shadow-sm',
          isMyMessage 
            ? 'bg-primary text-primary-foreground rounded-tr-sm' 
            : 'bg-gray-100 dark:bg-gray-800 rounded-tl-sm',
          article.internal && 'border-2 border-dashed border-yellow-400'
        )}>
          {article.internal && (
            <Badge className="mb-2 bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
              {t('internalNote')}
            </Badge>
          )}
          <ArticleContent 
            article={article} 
            showAttachments={true}
            noBubbleStyle={true}
            className={isMyMessage && !article.internal ? '[&_.prose]:text-primary-foreground [&_.prose_*]:text-primary-foreground' : ''}
          />
        </div>
      </div>
    </div>
  )
}
