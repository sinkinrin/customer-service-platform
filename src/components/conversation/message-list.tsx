/**
 * Message List Component
 *
 * Minimalist design with elegant aesthetics (AI-only mode)
 */

'use client'

import React, { useEffect, useRef, useMemo } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { FileText, Download, Bot } from 'lucide-react'
import { type Message } from '@/lib/stores/conversation-store'
import { cn } from '@/lib/utils'
import { SystemMessage } from './system-message'
import { MarkdownMessage } from './markdown-message'
import { AIThinkingIndicator } from './ai-thinking-indicator'
import { useTranslations } from 'next-intl'

interface MessageListProps {
  messages: Message[]
  isLoading?: boolean
  isTyping?: boolean
  typingUser?: string | null
  isAiLoading?: boolean
  aiToolStatus?: string
  renderMessageActions?: (message: Message) => React.ReactNode | null
}

export function MessageList({
  messages,
  isLoading = false,
  isAiLoading = false,
  aiToolStatus,
  renderMessageActions,
}: MessageListProps) {
  const t = useTranslations('components.conversation.messageList')
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive or AI is loading
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end', inline: 'nearest' })
    }
  }, [messages.length, isAiLoading])

  // Group consecutive messages from the same sender
  const groupedMessages = useMemo(() => {
    const groups: { messages: Message[]; isFirst: boolean; isLast: boolean }[] = []

    messages.forEach((msg, idx) => {
      const prevMsg = messages[idx - 1]
      const nextMsg = messages[idx + 1]
      const isSameSenderAsPrev = prevMsg && prevMsg.sender_id === msg.sender_id &&
        prevMsg.message_type !== 'system' && msg.message_type !== 'system'
      const isSameSenderAsNext = nextMsg && nextMsg.sender_id === msg.sender_id &&
        nextMsg.message_type !== 'system' && msg.message_type !== 'system'

      groups.push({
        messages: [msg],
        isFirst: !isSameSenderAsPrev,
        isLast: !isSameSenderAsNext
      })
    })

    return groups
  }, [messages])

  // Format timestamp elegantly
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()

    if (diff < 60000) return t('justNow')
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000)
      return `${minutes}m`
    }
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000)
      return `${hours}h`
    }

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  }

  // Get user initials for avatar fallback
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  // Render message content based on type
  const renderMessageContent = (message: Message, isCustomer: boolean, isAI: boolean) => {
    if (message.message_type === 'text') {
      // Use Markdown rendering for AI messages
      if (isAI) {
        return (
          <MarkdownMessage
            content={message.content}
            className="text-foreground"
          />
        )
      }
      return (
        <p className={cn(
          "text-[15px] leading-relaxed whitespace-pre-wrap break-words",
          isCustomer ? "text-white" : "text-foreground"
        )}>
          {message.content}
        </p>
      )
    }

    if (message.message_type === 'image' && message.metadata?.file_url) {
      return (
        <div className="space-y-2">
          <img
            src={message.metadata.file_url}
            alt={message.metadata.file_name || 'Image'}
            className="max-w-[280px] rounded-xl"
          />
          {message.content && (
            <p className={cn(
              "text-[15px] leading-relaxed whitespace-pre-wrap break-words",
              isCustomer ? "text-white" : "text-foreground"
            )}>
              {message.content}
            </p>
          )}
        </div>
      )
    }

    if (message.message_type === 'file' && message.metadata?.file_url) {
      return (
        <div className="space-y-2">
          <a
            href={message.metadata.file_url}
            download={message.metadata.file_name}
            className={cn(
              "flex items-center gap-3 p-3 rounded-xl transition-colors",
              isCustomer
                ? "bg-white/10 hover:bg-white/20"
                : "bg-muted hover:bg-muted/80"
            )}
          >
            <div className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center",
              isCustomer ? "bg-white/20" : "bg-primary/10"
            )}>
              <FileText className={cn(
                "h-5 w-5",
                isCustomer ? "text-white" : "text-primary"
              )} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn(
                "text-sm font-medium truncate",
                isCustomer ? "text-white" : "text-foreground"
              )}>
                {message.metadata.file_name || 'File'}
              </p>
              {message.metadata.file_size && (
                <p className={cn(
                  "text-xs",
                  isCustomer ? "text-white/70" : "text-muted-foreground"
                )}>
                  {(message.metadata.file_size / 1024).toFixed(1)} KB
                </p>
              )}
            </div>
            <Download className={cn(
              "h-4 w-4 flex-shrink-0",
              isCustomer ? "text-white/70" : "text-muted-foreground"
            )} />
          </a>
          {message.content && (
            <p className={cn(
              "text-[15px] leading-relaxed whitespace-pre-wrap break-words",
              isCustomer ? "text-white" : "text-foreground"
            )}>
              {message.content}
            </p>
          )}
        </div>
      )
    }

    return (
      <p className={cn(
        "text-sm",
        isCustomer ? "text-white/70" : "text-muted-foreground"
      )}>
        {t('unsupportedType')}
      </p>
    )
  }

  if (isLoading && messages.length === 0) {
    return (
      <div className="flex-1 p-6 space-y-8">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className={cn(
              "flex gap-3",
              i % 2 === 0 ? "justify-end" : "justify-start"
            )}
          >
            {i % 2 !== 0 && <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />}
            <Skeleton className={cn(
              "h-14 rounded-2xl",
              i % 2 === 0 ? "w-48" : "w-56"
            )} />
            {i % 2 === 0 && <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />}
          </div>
        ))}
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 min-h-[300px]">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
            <Bot className="w-8 h-8 text-primary/50" />
          </div>
          <div className="space-y-1">
            <p className="text-foreground/80 font-medium">{t('noMessages')}</p>
            <p className="text-sm text-muted-foreground">
              {t('noMessagesHint')}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-1 py-4">
      {groupedMessages.map((group) => {
        const message = group.messages[0]

        // Handle system messages
        if (message.message_type === 'system' || message.sender?.role === 'system') {
          return (
            <div key={message.id} className="py-2">
              <SystemMessage
                content={message.content}
                type="info"
                timestamp={message.created_at}
              />
            </div>
          )
        }

        // Regular messages
        const senderName = message.sender?.full_name || 'Unknown'
        const senderRole = message.sender?.role || 'customer'
        const isCustomerMessage = senderRole === 'customer'
        const isAI = message.sender_id === 'ai'

        return (
          <div
            key={message.id}
            className={cn(
              "flex gap-3 px-2",
              isCustomerMessage ? 'justify-end' : 'justify-start',
              group.isFirst ? 'mt-4' : 'mt-0.5'
            )}
          >
            {/* Avatar - only show for first message in group */}
            {!isCustomerMessage && (
              <div className="w-9 flex-shrink-0">
                {group.isFirst && (
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={message.sender?.avatar_url} alt={senderName} />
                    <AvatarFallback className={cn(
                      "text-xs font-medium",
                      isAI
                        ? "bg-gradient-to-br from-violet-500 to-purple-600 text-white"
                        : "bg-gradient-to-br from-slate-100 to-slate-200 text-slate-600"
                    )}>
                      {isAI ? <Bot className="h-4 w-4" /> : getInitials(senderName)}
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            )}

            <div className={cn(
              "flex flex-col max-w-[75%] sm:max-w-[70%]",
              isCustomerMessage ? 'items-end' : 'items-start'
            )}>
              {/* Sender name - only show for first message in group */}
              {group.isFirst && !isCustomerMessage && (
                <span className="text-xs text-muted-foreground mb-1 ml-1">
                  {senderName}
                </span>
              )}

              {/* Message bubble */}
              <div
                className={cn(
                  "px-4 py-2.5 rounded-2xl",
                  isCustomerMessage
                    ? cn(
                      "bg-primary text-primary-foreground",
                      group.isFirst && "rounded-tr-md",
                      !group.isFirst && !group.isLast && "rounded-r-md",
                      group.isLast && !group.isFirst && "rounded-tr-md"
                    )
                    : cn(
                      "bg-muted/60",
                      group.isFirst && "rounded-tl-md",
                      !group.isFirst && !group.isLast && "rounded-l-md",
                      group.isLast && !group.isFirst && "rounded-tl-md"
                    )
                )}
              >
                {renderMessageContent(message, isCustomerMessage, isAI)}
                {/* Mid-stream tool status: show inline in the last AI message */}
                {isAI && !isAiLoading && aiToolStatus &&
                  message === messages[messages.length - 1] && (
                    <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-muted-foreground/10">
                      <span className="w-1.5 h-1.5 bg-violet-500/60 rounded-full animate-pulse" />
                      <span className="w-1.5 h-1.5 bg-violet-500/60 rounded-full animate-pulse [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 bg-violet-500/60 rounded-full animate-pulse [animation-delay:300ms]" />
                      <span className="text-xs text-muted-foreground">
                        🔧 {aiToolStatus}...
                      </span>
                    </div>
                  )}
              </div>

              {/* Message actions (e.g., thumbs up/down for AI messages) */}
              {renderMessageActions && renderMessageActions(message)}

              {/* Timestamp - only show for last message in group */}
              {group.isLast && (
                <span className={cn(
                  "text-[11px] text-muted-foreground/60 mt-1",
                  isCustomerMessage ? "mr-1" : "ml-1"
                )}>
                  {formatTime(message.created_at)}
                </span>
              )}
            </div>

            {/* Customer avatar - only show for first message in group */}
            {isCustomerMessage && (
              <div className="w-9 flex-shrink-0">
                {group.isFirst && (
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={message.sender?.avatar_url} alt={senderName} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium">
                      {getInitials(senderName)}
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* AI Thinking indicator */}
      {isAiLoading && <AIThinkingIndicator toolStatus={aiToolStatus} />}

      <div ref={bottomRef} className="h-4" />
    </div>
  )
}
