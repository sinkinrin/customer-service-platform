/**
 * Conversation Header Component
 *
 * AI-only mode header (human agent transfer removed)
 */

'use client'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Bot } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'

interface ConversationHeaderProps {
  mode?: 'ai'
}

export function ConversationHeader({ mode = 'ai' }: ConversationHeaderProps) {
  const t = useTranslations('components.conversation.header')
  const displayName = t('aiAssistant')

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
    </div>
  )
}
