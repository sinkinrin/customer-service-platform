/**
 * Conversation Header Component
 *
 * AI-only mode header with new conversation button
 */

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Bot, Plus, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

interface ConversationHeaderProps {
  mode?: 'ai'
  currentConversationId?: string
}

export function ConversationHeader({ mode: _mode = 'ai', currentConversationId }: ConversationHeaderProps) {
  const t = useTranslations('components.conversation.header')
  const tToast = useTranslations('toast.customer.conversations')
  const router = useRouter()
  const [isCreating, setIsCreating] = useState(false)

  const displayName = t('aiAssistant')

  const handleNewConversation = async () => {
    if (isCreating) return

    try {
      setIsCreating(true)

      // Close current conversation if exists
      if (currentConversationId) {
        await fetch(`/api/conversations/${currentConversationId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'closed' }),
        })
      }

      // Create new conversation
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      if (!response.ok) {
        throw new Error('Failed to create conversation')
      }

      const data = await response.json()

      if (data.success && data.data?.id) {
        router.push(`/customer/conversations/${data.data.id}`)
      } else {
        throw new Error('Invalid response')
      }
    } catch (error) {
      console.error('Failed to create new conversation:', error)
      toast.error(tToast('startError'))
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="flex items-center gap-4 py-3">
      {/* Avatar */}
      <div className="relative">
        <Avatar className="h-11 w-11">
          <AvatarFallback className={cn(
            "text-sm font-medium",
            "bg-gradient-to-br from-violet-500 to-purple-600 text-white"
          )}>
            <Bot className="h-5 w-5" />
          </AvatarFallback>
        </Avatar>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-foreground truncate">{displayName}</h2>
          <span className={cn(
            "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
            "bg-violet-500/10 text-violet-600 dark:text-violet-400"
          )}>
            {t('aiMode')}
          </span>
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">
          {t('aiDescription')}
        </p>
      </div>

      {/* New Conversation Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleNewConversation}
        disabled={isCreating}
        className="shrink-0"
      >
        {isCreating ? (
          <>
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            {t('buttons.creatingNew')}
          </>
        ) : (
          <>
            <Plus className="h-4 w-4 mr-1.5" />
            {t('buttons.newConversation')}
          </>
        )}
      </Button>
    </div>
  )
}
