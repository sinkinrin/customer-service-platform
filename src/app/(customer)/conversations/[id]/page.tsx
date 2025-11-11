/**
 * Conversation Detail Page
 *
 * AI-first conversation with manual escalation to human agents
 */

'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useConversation } from '@/lib/hooks/use-conversation'
import { MessageList } from '@/components/conversation/message-list'
import { MessageInput } from '@/components/conversation/message-input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Loading } from '@/components/common/loading'
import { useSSE } from '@/lib/hooks/use-sse'
import { Wifi, WifiOff, AlertCircle, Bot, User } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

type ConversationMode = 'ai' | 'human'

export default function ConversationDetailPage() {
  const params = useParams()
  const conversationId = params.id as string
  const [showNewMessageNotification, setShowNewMessageNotification] = useState(false)
  const [mode, setMode] = useState<ConversationMode>('ai')
  const [aiMessages, setAiMessages] = useState<Array<{ role: 'user' | 'assistant', content: string }>>([])
  const [isAiLoading, setIsAiLoading] = useState(false)

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
  
  // Fetch conversation and messages only in human mode
  useEffect(() => {
    if (conversationId && mode === 'human') {
      fetchMessages(conversationId)
    }
  }, [conversationId, mode, fetchMessages])

  // Subscribe to real-time updates only in human mode
  useEffect(() => {
    if (conversationId && mode === 'human') {
      const unsubscribe = subscribeToConversation(conversationId)
      return unsubscribe
    }
  }, [conversationId, mode, subscribeToConversation])

  // Handle AI chat
  const handleAIMessage = async (content: string) => {
    try {
      setIsAiLoading(true)

      // Add user message to AI chat
      const newUserMessage = { role: 'user' as const, content }
      setAiMessages(prev => [...prev, newUserMessage])

      // Call AI API
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          message: content,
          history: aiMessages,
        }),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to get AI response')
      }

      // Add AI response to chat
      const aiResponse = { role: 'assistant' as const, content: data.data.message }
      setAiMessages(prev => [...prev, aiResponse])

    } catch (error) {
      console.error('AI chat error:', error)
      toast.error('Failed to get AI response')
    } finally {
      setIsAiLoading(false)
    }
  }

  // Handle human agent message
  const handleHumanMessage = async (
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

  // Transfer to human agent
  const handleTransferToHuman = async () => {
    try {
      setIsAiLoading(true)

      // Create conversation history summary
      const historySummary = aiMessages.map(msg =>
        `${msg.role === 'user' ? 'Customer' : 'AI'}: ${msg.content}`
      ).join('\n\n')

      // Create Zammad ticket with conversation history
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initial_message: `[AI Chat History]\n\n${historySummary}\n\n---\n\nCustomer requested human agent assistance.`,
        }),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to create ticket')
      }

      // Get the new ticket ID
      const newTicketId = data.data.id

      // Switch to human mode
      setMode('human')
      toast.success('Transferred to human agent')

      // Redirect to the new ticket conversation
      window.location.href = `/conversations/${newTicketId}`

    } catch (error) {
      console.error('Transfer error:', error)
      toast.error('Failed to transfer to human agent')
    } finally {
      setIsAiLoading(false)
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
  
  if (mode === 'human' && !activeConversation && isLoadingMessages) {
    return <Loading fullScreen text="Loading conversation..." />
  }

  const staffName = mode === 'ai' ? 'AI Assistant' : (activeConversation?.staff?.full_name || 'Waiting for assignment')
  const staffAvatar = mode === 'ai' ? undefined : activeConversation?.staff?.avatar_url
  const conversationStatus = mode === 'ai' ? 'active' : (activeConversation?.status || 'waiting')
  const isClosed = mode === 'human' && conversationStatus === 'closed'

  // Convert AI messages to display format
  const displayMessages = mode === 'ai'
    ? aiMessages.map((msg, idx) => ({
        id: `ai-${idx}`,
        conversation_id: conversationId,
        sender_id: msg.role === 'user' ? 'user' : 'ai',
        content: msg.content,
        message_type: 'text' as const,
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sender: {
          id: msg.role === 'user' ? 'user' : 'ai',
          full_name: msg.role === 'user' ? 'You' : 'AI Assistant',
          avatar_url: undefined,
          role: msg.role === 'user' ? 'customer' : 'staff',
        },
      }))
    : messages

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* SSE Connection Status - Only in human mode */}
      {mode === 'human' && sseState === 'error' && sseError && (
        <Alert variant="destructive" className="m-4 mb-0">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Real-time updates unavailable: {sseError.message}
          </AlertDescription>
        </Alert>
      )}

      {/* New Message Notification - Only in human mode */}
      {mode === 'human' && showNewMessageNotification && (
        <Alert className="m-4 mb-0 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <AlertDescription className="text-blue-900 dark:text-blue-100">
            New message received - scroll down to view
          </AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="border-b bg-background p-4">
        <div className="container max-w-4xl">
          <div className="flex items-center gap-4">
            {/* Mode Indicator */}
            <div className="flex items-center gap-2">
              {mode === 'ai' ? (
                <Bot className="h-5 w-5 text-blue-500" title="AI Chat" />
              ) : isConnected ? (
                <Wifi className="h-4 w-4 text-green-500" title="Connected" />
              ) : sseState === 'connecting' ? (
                <WifiOff className="h-4 w-4 text-yellow-500 animate-pulse" title="Connecting..." />
              ) : (
                <WifiOff className="h-4 w-4 text-gray-400" title="Disconnected" />
              )}
            </div>

            <Avatar className="h-10 w-10">
              <AvatarImage src={staffAvatar} alt={staffName} />
              <AvatarFallback>
                {mode === 'ai' ? <Bot className="h-5 w-5" /> : getInitials(staffName)}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <h2 className="font-semibold truncate">{staffName}</h2>
              <Badge variant={getStatusVariant(conversationStatus)} className="mt-1">
                {mode === 'ai' ? 'AI Chat' : conversationStatus}
              </Badge>
            </div>

            {/* Transfer to Human Button - Only in AI mode */}
            {mode === 'ai' && (
              <Button
                onClick={handleTransferToHuman}
                disabled={isAiLoading}
                variant="outline"
                size="sm"
              >
                <User className="h-4 w-4 mr-2" />
                转人工
              </Button>
            )}
          </div>
        </div>
      </div>
      
      {/* Messages */}
      <div className="flex-1 overflow-hidden">
        <div className="container max-w-4xl h-full">
          <MessageList
            messages={displayMessages}
            isLoading={mode === 'ai' ? isAiLoading : isLoadingMessages}
            isTyping={mode === 'human' && isTyping}
            typingUser={mode === 'human' ? typingUser : null}
          />
        </div>
      </div>

      {/* Input */}
      {!isClosed && (
        <div className="border-t">
          <div className="container max-w-4xl">
            <MessageInput
              onSend={mode === 'ai' ? handleAIMessage : handleHumanMessage}
              isSending={mode === 'ai' ? isAiLoading : isSendingMessage}
              disabled={isClosed || isAiLoading}
              placeholder={
                mode === 'ai'
                  ? 'Type a message to chat with AI...'
                  : conversationStatus === 'waiting'
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

