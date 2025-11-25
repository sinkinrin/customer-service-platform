/**
 * Conversation Detail Page - Customer View
 *
 * AI-first conversation with improved manual escalation to human agents
 */

'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
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
    addMessage,
  } = useConversation()

  // SSE connection for real-time updates - always enabled to receive transfer events
  const { state: sseState, isConnected, error: sseError } = useSSE({
    url: '/api/sse/conversations',
    enabled: true, // Always enabled to receive conversation_transferred events in AI mode
    onMessage: (event) => {
      console.log('[SSE] Received event:', event)

      // Only process events for this conversation
      if (event.conversationId !== conversationId) {
        return
      }

      // Handle conversation transferred event (customer side)
      if (event.type === 'conversation_transferred') {
        console.log('[SSE] Conversation transferred to human')
        setMode('human')
        fetchConversationById(conversationId)
        fetchMessages(conversationId)
        toast.success('已成功转接至人工客服')
      }

      // Handle new message - only in human mode to avoid conflicts with AI messages
      if (event.type === 'new_message' && mode === 'human') {
        setShowNewMessageNotification(true)
        setTimeout(() => setShowNewMessageNotification(false), 3000)
        // Use addMessage from SSE event data instead of re-fetching all messages
        if (event.data) {
          addMessage(event.data)
        }
      }

      // Handle conversation updated
      if (event.type === 'conversation_updated') {
        fetchConversationById(conversationId)
      }
    },
    onError: (error) => {
      console.error('[SSE] Error:', error)
    },
  })

  // Fetch conversation to determine mode and mark as read
  useEffect(() => {
    if (conversationId) {
      fetchConversationById(conversationId).then(async (conv) => {
        if (conv && conv.mode) {
          setMode(conv.mode as ConversationMode)

          // R3: Load persisted AI messages if in AI mode
          if (conv.mode === 'ai') {
            try {
              // FIX: Pass large limit to load all AI messages, not just first 50
              const response = await fetch(`/api/conversations/${conversationId}/messages?limit=1000`)
              const data = await response.json()

              if (data.success && data.data?.messages) {
                // Filter only AI mode messages and convert to aiMessages format
                // OpenSpec: API returns messages in descending order (newest first)
                // Reverse to ascending order (oldest first) for correct AI history display
                const aiModeMessages = data.data.messages
                  .filter((msg: any) => msg.metadata?.aiMode)
                  .reverse() // Reverse to get ascending order (oldest first)
                  .map((msg: any) => ({
                    role: msg.metadata?.role === 'ai' ? 'assistant' as const : 'user' as const,
                    content: msg.content,
                    timestamp: msg.created_at
                  }))

                if (aiModeMessages.length > 0) {
                  setAiMessages(aiModeMessages)
                  console.log('[R3] Loaded', aiModeMessages.length, 'persisted AI messages in ascending order')
                }
              }
            } catch (error) {
              console.error('[R3] Failed to load persisted AI messages:', error)
            }
          }
        }
      })

      // Mark conversation as read when entering
      fetch(`/api/conversations/${conversationId}/mark-read`, {
        method: 'POST',
      }).catch((error) => {
        console.error('Failed to mark conversation as read:', error)
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

      // R3: Persist user message to storage
      try {
        await fetch(`/api/conversations/${conversationId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content,
            message_type: 'text',
            metadata: { aiMode: true, role: 'customer' }
          }),
        })
      } catch (error) {
        console.error('[R3] Failed to persist user AI message:', error)
      }

      // Call AI API
      // R3: Fix history to include the message that was just typed
      // React state updates are async, so we must manually include newUserMessage
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          message: content,
          history: [...aiMessages, newUserMessage].map(msg => ({ role: msg.role, content: msg.content })),
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

      // R3: Persist AI response to storage
      try {
        await fetch(`/api/conversations/${conversationId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: data.data.message,
            message_type: 'text',
            metadata: { aiMode: true, role: 'ai' }
          }),
        })
      } catch (error) {
        console.error('[R3] Failed to persist AI response:', error)
      }

    } catch (error: any) {
      console.error('AI chat error:', error)

      // Provide helpful error messages based on error type
      if (error.message?.includes('FastGPT')) {
        toast.error('AI服务暂时不可用，请转人工客服获取帮助', {
          duration: 5000,
          action: {
            label: '转人工',
            onClick: () => setShowTransferDialog(true),
          },
        })
      } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
        toast.error('网络连接失败，请检查网络后重试')
      } else {
        toast.error('AI响应失败，请重试或转人工客服')
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

  // Switch back to AI mode
  const handleSwitchToAI = async () => {
    try {
      setIsTransferring(true)

      // Call switch-to-ai API
      const response = await fetch(`/api/conversations/${conversationId}/switch-to-ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to switch to AI mode')
      }

      // Update mode to AI
      setMode('ai')

      // Reset AI messages
      setAiMessages([])

      // Fetch updated conversation
      await fetchConversationById(conversationId)

      toast.success('已切换至AI助手')

    } catch (error) {
      console.error('Switch to AI error:', error)
      toast.error('切换失败，请重试')
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
          full_name: msg.role === 'user' ? '我' : 'AI助手',
          avatar_url: undefined,
          role: msg.role === 'user' ? ('customer' as const) : ('staff' as const),
        },
      }))
    : messages

  return (
    <div className="-mx-4 lg:mx-0 flex min-h-[calc(100vh-8rem)] flex-col bg-gradient-to-b from-background via-background to-muted/30">
      {/* SSE Connection Status - Only in human mode */}
      {mode === 'human' && sseState === 'error' && sseError && (
        <Alert variant="destructive" className="mx-auto mb-0 mt-2 w-full max-w-6xl rounded-lg px-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Real-time updates unavailable: {sseError.message}
          </AlertDescription>
        </Alert>
      )}

      {/* New Message Notification - Only in human mode */}
      {mode === 'human' && showNewMessageNotification && (
        <Alert className="mx-auto mb-0 mt-2 w-full max-w-6xl rounded-lg border-blue-200 bg-blue-50 px-4 dark:border-blue-800 dark:bg-blue-950">
          <AlertDescription className="text-blue-900 dark:text-blue-100">
            New message received - scroll down to view
          </AlertDescription>
        </Alert>
      )}

      {/* Header - Sticky Top */}
      <div className="sticky top-16 z-20 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:backdrop-blur">
        <div className="mx-auto w-full max-w-6xl px-4 pb-3 pt-4 lg:px-6">
          <ConversationHeader
            mode={mode}
            staffName={staffName}
            staffAvatar={staffAvatar}
            status={conversationStatus}
            isConnected={mode === 'human' && isConnected}
            sseState={sseState}
            onTransferToHuman={() => setShowTransferDialog(true)}
            onSwitchToAI={handleSwitchToAI}
            isTransferring={isTransferring}
            enableModeSwitching={true}
          />
        </div>
      </div>

      {/* Messages - Scrollable Middle Section */}
      <div className="flex-1 min-h-0 pb-4">
        <div className="mx-auto flex h-full w-full max-w-6xl px-2 py-4 sm:px-4">
          <div className="relative flex h-full w-full flex-col rounded-2xl border bg-card/90 shadow-md backdrop-blur-sm">
            <div className="relative flex-1 overflow-y-auto px-3 py-4 sm:px-5 sm:py-6 pb-28 sm:pb-32">
              <MessageList
                messages={displayMessages}
                isLoading={mode === 'ai' ? isAiLoading : isLoadingMessages}
                isTyping={mode === 'human' && isTyping}
                typingUser={mode === 'human' ? typingUser : null}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Input - Fixed Bottom */}
      {!isClosed && (
        <div className="fixed inset-x-0 bottom-0 z-30 bg-background/95 shadow-[0_-12px_28px_-14px_rgba(0,0,0,0.35)] backdrop-blur supports-[backdrop-filter]:backdrop-blur lg:left-64">
          <div className="mx-auto w-full max-w-6xl px-2 py-3 sm:px-4 pb-[env(safe-area-inset-bottom,12px)]">
            <MessageInput
              onSend={mode === 'ai' ? handleAIMessage : handleHumanMessage}
              isSending={mode === 'ai' ? isAiLoading : isSendingMessage}
              disabled={isClosed || isAiLoading}
              placeholder={
                mode === 'ai'
                  ? 'Ask the AI assistant...'
                  : conversationStatus === 'waiting'
                  ? 'Waiting for an agent...'
                  : 'Type a message...'
              }
            />
          </div>
        </div>
      )}

      {isClosed && (
        <div className="sticky bottom-0 z-20 border-t bg-muted p-4">
          <div className="mx-auto w-full max-w-4xl text-center">
            <p className="text-sm text-muted-foreground">
              Conversation is closed. Please start a new chat to continue.
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
