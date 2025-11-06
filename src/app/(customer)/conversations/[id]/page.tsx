/**
 * Conversation Detail Page
 * 
 * Displays a single conversation with messages and input
 */

'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useConversation } from '@/lib/hooks/use-conversation'
import { MessageList } from '@/components/conversation/message-list'
import { MessageInput } from '@/components/conversation/message-input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { toast } from 'sonner'
import { Loading } from '@/components/common/loading'
import { useSSE } from '@/lib/hooks/use-sse'
import { Wifi, WifiOff, AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function ConversationDetailPage() {
  const params = useParams()
  const conversationId = params.id as string
  const [showNewMessageNotification, setShowNewMessageNotification] = useState(false)

  const {
    activeConversation,
    messages,
    isLoadingMessages,
    isSendingMessage,
    isTyping,
    typingUser,
    fetchMessages,
    sendMessage,
    subscribeToConversation,
  } = useConversation()

  // SSE connection for real-time updates
  const { state: sseState, isConnected, error: sseError } = useSSE({
    url: '/api/sse/tickets',
    enabled: true,
    onMessage: (event) => {
      if (event.type === 'new_message' && event.ticketId === conversationId) {
        // Show notification
        setShowNewMessageNotification(true)
        setTimeout(() => setShowNewMessageNotification(false), 3000)

        // Refresh messages
        fetchMessages(conversationId)

        // Show toast
        toast.info('New message received')
      }
    },
    onError: (error) => {
      console.error('SSE error:', error)
    },
  })
  
  // Fetch conversation and messages
  useEffect(() => {
    if (conversationId) {
      fetchMessages(conversationId)
    }
  }, [conversationId, fetchMessages])
  
  // Subscribe to real-time updates
  useEffect(() => {
    if (conversationId) {
      const unsubscribe = subscribeToConversation(conversationId)
      return unsubscribe
    }
  }, [conversationId, subscribeToConversation])
  
  // Handle send message
  const handleSendMessage = async (
    content: string,
    messageType?: 'text' | 'image' | 'file',
    metadata?: Record<string, unknown>
  ) => {
    try {
      await sendMessage(conversationId, content, messageType, metadata)
    } catch (error) {
      console.error('Error sending message:', error)
      toast.error('Failed to send message')
    }
  }
  
  // Get user initials
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }
  
  // Get status variant
  const getStatusVariant = (status: string): 'default' | 'secondary' | 'outline' => {
    switch (status) {
      case 'waiting':
        return 'secondary'
      case 'active':
        return 'default'
      case 'closed':
        return 'outline'
      default:
        return 'outline'
    }
  }
  
  if (!activeConversation && isLoadingMessages) {
    return <Loading fullScreen text="Loading conversation..." />
  }
  
  const staffName = activeConversation?.staff?.full_name || 'Waiting for assignment'
  const staffAvatar = activeConversation?.staff?.avatar_url
  const conversationStatus = activeConversation?.status || 'waiting'
  const isClosed = conversationStatus === 'closed'
  
  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* SSE Connection Status */}
      {sseState === 'error' && sseError && (
        <Alert variant="destructive" className="m-4 mb-0">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Real-time updates unavailable: {sseError.message}
          </AlertDescription>
        </Alert>
      )}

      {/* New Message Notification */}
      {showNewMessageNotification && (
        <Alert className="m-4 mb-0 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <AlertDescription className="text-blue-900 dark:text-blue-100">
            New message received - scroll down to view
          </AlertDescription>
        </Alert>
      )}

      {/* Simplified Header */}
      <div className="border-b bg-background p-4">
        <div className="container max-w-4xl">
          <div className="flex items-center gap-4">
            {/* SSE Status Indicator */}
            <div className="flex items-center gap-2">
              {isConnected ? (
                <Wifi className="h-4 w-4 text-green-500" title="Connected" />
              ) : sseState === 'connecting' ? (
                <WifiOff className="h-4 w-4 text-yellow-500 animate-pulse" title="Connecting..." />
              ) : (
                <WifiOff className="h-4 w-4 text-gray-400" title="Disconnected" />
              )}
            </div>

            <Avatar className="h-10 w-10">
              <AvatarImage src={staffAvatar} alt={staffName} />
              <AvatarFallback>{getInitials(staffName)}</AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <h2 className="font-semibold truncate">{staffName}</h2>
              <Badge variant={getStatusVariant(conversationStatus)} className="mt-1">
                {conversationStatus}
              </Badge>
            </div>
          </div>
        </div>
      </div>
      
      {/* Messages */}
      <div className="flex-1 overflow-hidden">
        <div className="container max-w-4xl h-full">
          <MessageList
            messages={messages}
            isLoading={isLoadingMessages}
            isTyping={isTyping}
            typingUser={typingUser}
          />
        </div>
      </div>
      
      {/* Input */}
      {!isClosed && (
        <div className="border-t">
          <div className="container max-w-4xl">
            <MessageInput
              onSend={handleSendMessage}
              isSending={isSendingMessage}
              disabled={isClosed}
              placeholder={
                conversationStatus === 'waiting'
                  ? 'Send a message to start the conversation...'
                  : 'Type a message...'
              }
            />
          </div>
        </div>
      )}
      
      {isClosed && (
        <div className="border-t bg-muted p-4">
          <div className="container max-w-4xl text-center">
            <p className="text-sm text-muted-foreground">
              This conversation has been closed. Start a new conversation to continue.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

