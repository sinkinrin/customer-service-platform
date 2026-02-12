/**
 * AI Thinking Indicator Component
 *
 * Displays an animated indicator when AI is processing a response
 */

'use client'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Bot } from 'lucide-react'
import { useTranslations } from 'next-intl'

export function AIThinkingIndicator({ toolStatus }: { toolStatus?: string }) {
  const t = useTranslations('components.conversation.messageList')

  return (
    <div className="flex gap-3 px-2 mt-4">
      <Avatar className="h-9 w-9">
        <AvatarFallback className="bg-gradient-to-br from-violet-500 to-purple-600 text-white">
          <Bot className="h-4 w-4" />
        </AvatarFallback>
      </Avatar>
      <div className="flex flex-col items-start">
        <span className="text-xs text-muted-foreground mb-1 ml-1">
          {t('aiAssistant')}
        </span>
        <div className="px-4 py-3 rounded-2xl rounded-tl-md bg-muted/60">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5 items-center h-5">
              <span className="w-2 h-2 bg-violet-500/60 rounded-full animate-pulse" />
              <span className="w-2 h-2 bg-violet-500/60 rounded-full animate-pulse [animation-delay:150ms]" />
              <span className="w-2 h-2 bg-violet-500/60 rounded-full animate-pulse [animation-delay:300ms]" />
            </div>
            <span className="text-sm text-muted-foreground ml-1">
              {toolStatus ? `🔧 ${toolStatus}...` : t('aiThinking')}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
