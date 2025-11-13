/**
 * Conversation Detail Page - Customer View
 *
 * AI-first conversation with improved manual escalation to human agents
 */

'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useConversation } from '@/lib/hooks/use-conversation'
import { MessageList } from '@/components/conversation/message-list'
import { MessageInput } from '@/components/conversation/message-input'
import { ConversationHeader } from '@/components/conversation/conversation-header'
import { TransferDialog } from '@/components/conversation/transfer-dialog'
import { toast } from 'sonner'
import { Loading } from '@/components/common/loading'
import { useSSE } from '@/lib/hooks/use-sse'
import { AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

type ConversationMode = 'ai' | 'human'

export default function ConversationDetailPage() {
  const params = useParams()
  const router = useRouter()
  const conversationId = params.id as string

  const [showNewMessageNotification, setShowNewMessageNotification] = useState(false)
  const [mode, setMode] = useState<ConversationMode>('ai')
  const [aiMessages, setAiMessages] = useState<Array<{ role: 'user' | 'assistant', content: string, timestamp: string }>>([])
  const [isAiLoading, setIsAiLoading] = useState(false)
  const [showTransferDialog, setShowTransferDialog] = useState(false)
  const [isTransferring, setIsTransferring] = useState(false)

  const {
    activeConversation,
    messages,
    isLoadingMessages,
    isSendingMessage,
    isTyping,
    typingUser,
    fetchMessages,
    fetchConversationById,
    sendMessage,
    subscribeToConversation,
  } = useConversation()

  // SSE connection for real-time updates
  const { state: sseState, isConnected, error: sseError } = useSSE({
    url: '/api/sse/conversations',
    enabled: mode === 'human',
    onMessage: (event) => {
      console.log('[SSE] Received event:', event)

      // Handle conversation transferred event (customer side)
      if (event.type === 'conversation_transferred' && event.conversationId === conversationId) {
        console.log('[SSE] Conversation transferred to human')
        setMode('human')
        fetchConversationById(conversationId)
        fetchMessages(conversationId)
        toast.success('已成功转接至人工客服')
      }

      // Handle new message
      if (event.type === 'new_message' && event.conversationId === conversationId) {
        setShowNewMessageNotification(true)
        setTimeout(() => setShowNewMessageNotification(false), 3000)
        fetchMessages(conversationId)
      }

      // Handle conversation updated
      if (event.type === 'conversation_updated' && event.conversationId === conversationId) {
        fetchConversationById(conversationId)
      }
    },
    onError: (error) => {
      console.error('[SSE] Error:', error)
    },
  })

  // Fetch conversation to determine mode
  useEffect(() => {
    if (conversationId) {
      fetchConversationById(conversationId).then((conv) => {
        if (conv && conv.mode) {
          setMode(conv.mode as ConversationMode)
        }
      })
    }
  }, [conversationId, fetchConversationById])

  // Fetch messages only in human mode
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
      const newUserMessage = {
        role: 'user' as const,
        content,
        timestamp: new Date().toISOString()
      }
      setAiMessages(prev => [...prev, newUserMessage])

      // Call AI API
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          message: content,
          history: aiMessages.map(msg => ({ role: msg.role, content: msg.content })),
        }),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to get AI response')
      }

      // Add AI response to chat
      const aiResponse = {
        role: 'assistant' as const,
        content: data.data.message,
        timestamp: new Date().toISOString()
      }
      setAiMessages(prev => [...prev, aiResponse])

    } catch (error: any) {
      console.error('AI chat error:', error)

      // Provide helpful error messages based on error type
      if (error.message?.includes('FastGPT')) {
        toast.error('AI服务暂时不可用,请转人工客服获取帮助', {
          duration: 5000,
          action: {
            label: '转人工',
            onClick: () => setShowTransferDialog(true),
          },
        })
      } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
        toast.error('网络连接失败,请检查网络后重试')
      } else {
        toast.error('AI响应失败,请重试或转人工客服')
      }
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

  // Transfer to human agent - New implementation
  const handleTransferToHuman = async (reason?: string) => {
    try {
      setIsTransferring(true)

      // Prepare AI history
      const aiHistory = aiMessages.map(msg => ({
        role: msg.role === 'user' ? 'customer' as const : 'ai' as const,
        content: msg.content,
        timestamp: msg.timestamp
      }))

      // Call transfer API
      const response = await fetch(`/api/conversations/${conversationId}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aiHistory: aiHistory.length > 0 ? aiHistory : undefined,
          reason: reason || undefined,
        }),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to transfer conversation')
      }

      // Close dialog
      setShowTransferDialog(false)

      // Update mode to human
      setMode('human')

      // Clear AI messages
      setAiMessages([])

      // Fetch conversation and messages
      await fetchConversationById(conversationId)
      await fetchMessages(conversationId)

      toast.success('已成功转接至人工客服')

    } catch (error) {
      console.error('Transfer error:', error)
      toast.error('转接失败，请重试')
    } finally {
      setIsTransferring(false)
    }
  }

  if (mode === 'human' && !activeConversation && isLoadingMessages) {
    return <Loading fullScreen text="Loading conversation..." />
  }

  const staffName = activeConversation?.staff?.full_name
  const staffAvatar = activeConversation?.staff?.avatar_url
  const conversationStatus = mode === 'human' ? (activeConversation?.status || 'waiting') : 'active'
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
        created_at: msg.timestamp,
        updated_at: msg.timestamp,
        sender: {
          id: msg.role === 'user' ? 'user' : 'ai',
          full_name: msg.role === 'user' ? 'You' : 'AI Assistant',
          avatar_url: undefined,
          role: msg.role === 'user' ? ('customer' as const) : ('staff' as const),
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
      <ConversationHeader
        mode={mode}
        staffName={staffName}
        staffAvatar={staffAvatar}
        status={conversationStatus}
        isConnected={mode === 'human' && isConnected}
        sseState={sseState}
        onTransferToHuman={() => setShowTransferDialog(true)}
        isTransferring={isTransferring}
      />

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

      {/* Input - Fixed at bottom */}
      {!isClosed && (
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

      {/* Transfer Dialog */}
      <TransferDialog
        open={showTransferDialog}
        onOpenChange={setShowTransferDialog}
        onConfirm={handleTransferToHuman}
        isTransferring={isTransferring}
      />
    </div>
  )
}
