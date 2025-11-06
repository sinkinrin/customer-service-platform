/**
 * Message List Component
 * 
 * Displays a list of messages in a conversation with auto-scroll
 */

'use client'

import { useEffect, useRef } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { FileText, Download } from 'lucide-react'
import { type Message } from '@/lib/stores/conversation-store'
import { useAuthStore } from '@/lib/stores/auth-store'

interface MessageListProps {
  messages: Message[]
  isLoading?: boolean
  isTyping?: boolean
  typingUser?: string | null
}

export function MessageList({
  messages,
  isLoading = false,
  isTyping = false,
  typingUser = null,
}: MessageListProps) {
  const { user } = useAuthStore()
    const bottomRef = useRef<HTMLDivElement>(null)
  
  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages.length])
  
  // Format timestamp
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    
    // Less than 1 minute
    if (diff < 60000) {
      return 'Just now'
    }
    
    // Less than 1 hour
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000)
      return `${minutes}m ago`
    }
    
    // Less than 24 hours
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000)
      return `${hours}h ago`
    }
    
    // Show date
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
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
  const renderMessageContent = (message: Message) => {
    if (message.message_type === 'text') {
      return <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
    }
    
    if (message.message_type === 'image' && message.metadata?.file_url) {
      return (
        <div className="space-y-2">
          <img
            src={message.metadata.file_url}
            alt={message.metadata.file_name || 'Image'}
            className="max-w-sm rounded-lg border"
          />
          {message.content && (
            <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
          )}
        </div>
      )
    }
    
    if (message.message_type === 'file' && message.metadata?.file_url) {
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg max-w-sm">
            <FileText className="h-8 w-8 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {message.metadata.file_name || 'File'}
              </p>
              {message.metadata.file_size && (
                <p className="text-xs text-muted-foreground">
                  {(message.metadata.file_size / 1024).toFixed(1)} KB
                </p>
              )}
            </div>
            <a
              href={message.metadata.file_url}
              download={message.metadata.file_name}
              className="p-2 hover:bg-background rounded-md transition-colors"
            >
              <Download className="h-4 w-4" />
            </a>
          </div>
          {message.content && (
            <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
          )}
        </div>
      )
    }
    
    return <p className="text-sm text-muted-foreground">Unsupported message type</p>
  }
  
  if (isLoading && messages.length === 0) {
    return (
      <div className="flex-1 p-4 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-16 w-full max-w-md" />
            </div>
          </div>
        ))}
      </div>
    )
  }
  
  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-2">
          <p className="text-muted-foreground">No messages yet</p>
          <p className="text-sm text-muted-foreground">
            Start the conversation by sending a message
          </p>
        </div>
      </div>
    )
  }
  
  return (
    <ScrollArea className="flex-1 p-4">
      <div className="space-y-4">
        {messages.map((message) => {
          const isOwnMessage = message.sender_id === user?.id
          const senderName = message.sender?.full_name || 'Unknown'
          const senderRole = message.sender?.role || 'customer'
          
          return (
            <div
              key={message.id}
              className={`flex gap-3 ${isOwnMessage ? 'flex-row-reverse' : ''}`}
            >
              <Avatar className="h-10 w-10">
                <AvatarImage src={message.sender?.avatar_url} alt={senderName} />
                <AvatarFallback>{getInitials(senderName)}</AvatarFallback>
              </Avatar>
              
              <div className={`flex-1 space-y-1 ${isOwnMessage ? 'items-end' : ''}`}>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{senderName}</span>
                  {senderRole === 'staff' && (
                    <Badge variant="secondary" className="text-xs">
                      Staff
                    </Badge>
                  )}
                  {senderRole === 'admin' && (
                    <Badge variant="default" className="text-xs">
                      Admin
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {formatTime(message.created_at)}
                  </span>
                </div>
                
                <div
                  className={`inline-block p-3 rounded-lg ${
                    isOwnMessage
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  {renderMessageContent(message)}
                </div>
              </div>
            </div>
          )
        })}
        
        {isTyping && typingUser && (
          <div className="flex gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback>{getInitials(typingUser)}</AvatarFallback>
            </Avatar>
            <div className="flex items-center gap-1 p-3 bg-muted rounded-lg">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:0.2s]" />
                <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          </div>
        )}
        
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  )
}

