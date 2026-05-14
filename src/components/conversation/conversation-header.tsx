/**
 * Conversation Header Component
 *
 * AI-only mode header with new conversation button
 */

'use client'

import { useRouter } from 'next/navigation'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Bot, Plus, History } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'
import { DRAFT_CONVERSATION_ID } from '@/lib/constants/conversation'

interface ConversationHeaderProps {
  mode?: 'ai'
  currentConversationId?: string
  basePath?: string
  onOpenHistory?: () => void
  onNewConversation?: () => void
}

export function ConversationHeader({ mode: _mode = 'ai', currentConversationId: _currentConversationId, basePath = '/customer/conversations', onOpenHistory, onNewConversation }: ConversationHeaderProps) {
  const t = useTranslations('components.conversation.header')
  const router = useRouter()
  const normalizedBasePath = basePath.replace(/\/$/, '')

  const displayName = t('aiAssistant')

  const handleNewConversation = () => {
    onNewConversation?.()
    router.push(`${normalizedBasePath}/${DRAFT_CONVERSATION_ID}`)
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
          <span className="hidden sm:inline text-muted-foreground/60"> · {t('newTopicTip')}</span>
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Button
          variant="outline"
          size="icon"
          onClick={onOpenHistory}
          aria-label={t('buttons.history')}
        >
          <History className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleNewConversation}
          className="shrink-0"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          {t('buttons.newConversation')}
        </Button>
      </div>
    </div>
  )
}
