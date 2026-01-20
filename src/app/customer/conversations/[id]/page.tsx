/**
 * Conversation Detail Page - Customer View
 *
 * AI-only conversation mode (human agent transfer removed)
 */

'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { MessageList } from '@/components/conversation/message-list'
import { MessageInput } from '@/components/conversation/message-input'
import { ConversationHeader } from '@/components/conversation/conversation-header'
import { toast } from 'sonner'
import { Loading } from '@/components/common/loading'
import { useTranslations } from 'next-intl'

export default function ConversationDetailPage() {
  const t = useTranslations('customer.conversations.detail')
  const tPlaceholders = useTranslations('customer.conversations.placeholders')
  const tToast = useTranslations('toast.customer.conversations')

  const params = useParams()
  const conversationId = params.id as string

  const [aiMessages, setAiMessages] = useState<Array<{ role: 'user' | 'assistant', content: string, timestamp: string }>>([])
  const [isAiLoading, setIsAiLoading] = useState(false)
  const [isInitialLoading, setIsInitialLoading] = useState(true)

  // Load existing AI messages on mount
  useEffect(() => {
    if (conversationId) {
      const loadMessages = async () => {
        try {
          setIsInitialLoading(true)
          const response = await fetch(`/api/conversations/${conversationId}/messages?limit=1000`)
          const data = await response.json()

          if (data.success && data.data?.messages) {
            const aiModeMessages = data.data.messages
              .filter((msg: any) => msg.metadata?.aiMode)
              .reverse()
              .map((msg: any) => ({
                role: msg.metadata?.role === 'ai' ? 'assistant' as const : 'user' as const,
                content: msg.content,
                timestamp: msg.created_at
              }))

            if (aiModeMessages.length > 0) {
              setAiMessages(aiModeMessages)
            }
          }
        } catch (error) {
          console.error('Failed to load AI messages:', error)
        } finally {
          setIsInitialLoading(false)
        }
      }

      loadMessages()

      // Mark conversation as read
      fetch(`/api/conversations/${conversationId}/mark-read`, {
        method: 'POST',
      }).catch((error) => {
        console.error('Failed to mark conversation as read:', error)
      })
    }
  }, [conversationId])

  // Handle AI chat with duplicate prevention
  const handleAIMessage = async (content: string) => {
    // Prevent duplicate submissions
    if (isAiLoading) return

    try {
      setIsAiLoading(true)

      // Trim and validate content
      const trimmedContent = content.trim()
      if (!trimmedContent) return

      const newUserMessage = {
        role: 'user' as const,
        content: trimmedContent,
        timestamp: new Date().toISOString()
      }
      setAiMessages(prev => [...prev, newUserMessage])

      // Persist user message
      try {
        await fetch(`/api/conversations/${conversationId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: trimmedContent,
            message_type: 'text',
            metadata: { aiMode: true, role: 'customer' }
          }),
        })
      } catch (error) {
        console.error('Failed to persist user AI message:', error)
      }

      // Get AI response - use current aiMessages state (not including newUserMessage to avoid duplication)
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          message: trimmedContent,
          history: aiMessages.map(msg => ({ role: msg.role, content: msg.content })),
        }),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to get AI response')
      }

      const aiResponse = {
        role: 'assistant' as const,
        content: data.data.message,
        timestamp: new Date().toISOString()
      }
      setAiMessages(prev => [...prev, aiResponse])

      // Persist AI response
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
        console.error('Failed to persist AI response:', error)
      }

    } catch (error: any) {
      console.error('AI chat error:', error)

      if (error.message?.includes('FastGPT')) {
        toast.error(tToast('aiUnavailable'))
      } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
        toast.error(tToast('networkError'))
      } else {
        toast.error(tToast('aiError'))
      }
    } finally {
      setIsAiLoading(false)
    }
  }

  if (isInitialLoading) {
    return <Loading fullScreen text={t('loadingText')} />
  }

  // Convert AI messages to display format
  const displayMessages = aiMessages.map((msg, idx) => ({
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
      full_name: msg.role === 'user' ? t('me') : t('aiAssistant'),
      avatar_url: undefined,
      role: msg.role === 'user' ? ('customer' as const) : ('staff' as const),
    },
  }))

  return (
    <div className="flex flex-col bg-gradient-to-b from-background to-muted/20 flex-1 min-h-0 overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b bg-background/80 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4">
          <ConversationHeader mode="ai" currentConversationId={conversationId} />
        </div>
      </div>

      {/* Messages - Scrollable area */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        <div className="max-w-4xl mx-auto px-4">
          <MessageList
            messages={displayMessages}
            isLoading={false}
            isTyping={false}
            typingUser={null}
            isAiLoading={isAiLoading}
          />
        </div>
      </div>

      {/* Input Area - Fixed at bottom */}
      <div className="flex-shrink-0 bg-gradient-to-t from-background via-background to-background/80 pt-2 pb-4">
        <div className="max-w-4xl mx-auto px-4">
          <MessageInput
            onSend={handleAIMessage}
            isSending={isAiLoading}
            disabled={isAiLoading}
            placeholder={tPlaceholders('aiMode')}
          />
          <p className="text-[11px] text-muted-foreground/60 text-center mt-2 pb-[env(safe-area-inset-bottom)]">
            {t('aiDisclaimer')}
          </p>
        </div>
      </div>
    </div>
  )
}
