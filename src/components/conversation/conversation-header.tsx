/**
 * Conversation Header Component
 *
 * Minimalist header with essential information
 */

'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Bot, User, ArrowLeftRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'

interface ConversationHeaderProps {
  mode: 'ai' | 'human'
  staffName?: string
  staffAvatar?: string
  status?: string
  isConnected?: boolean
  sseState?: 'connecting' | 'connected' | 'error' | 'disconnected'
  onTransferToHuman?: () => void
  onSwitchToAI?: () => void
  isTransferring?: boolean
  enableModeSwitching?: boolean
}

export function ConversationHeader({
  mode,
  staffName,
  staffAvatar,
  status = 'active',
  isConnected = false,
  sseState = 'disconnected',
  onTransferToHuman,
  onSwitchToAI,
  isTransferring = false,
  enableModeSwitching = false,
}: ConversationHeaderProps) {
  const t = useTranslations('components.conversation.header')
  const displayName = mode === 'ai' ? t('aiAssistant') : (staffName || t('waitingAssignment'))

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'waiting':
        return t('status.waiting')
      case 'active':
        return t('status.active')
      case 'closed':
        return t('status.closed')
      default:
        return status
    }
  }

  return (
    <div className="flex items-center gap-4 py-3">
      {/* Avatar with status indicator */}
      <div className="relative">
        <Avatar className="h-11 w-11">
          <AvatarImage src={staffAvatar} alt={displayName} />
          <AvatarFallback className={cn(
            "text-sm font-medium",
            mode === 'ai'
              ? "bg-gradient-to-br from-violet-500 to-purple-600 text-white"
              : "bg-gradient-to-br from-emerald-500 to-teal-600 text-white"
          )}>
            {mode === 'ai' ? <Bot className="h-5 w-5" /> : getInitials(displayName)}
          </AvatarFallback>
        </Avatar>

        {/* Status dot */}
        {mode === 'human' && (
          <span className={cn(
            "absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-background",
            isConnected
              ? "bg-emerald-500"
              : sseState === 'connecting'
              ? "bg-amber-500 animate-pulse"
              : "bg-slate-300"
          )} />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-foreground truncate">{displayName}</h2>
          <span className={cn(
            "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
            mode === 'ai'
              ? "bg-violet-500/10 text-violet-600 dark:text-violet-400"
              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          )}>
            {mode === 'ai' ? t('aiMode') : t('humanMode')}
          </span>
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">
          {mode === 'ai' ? (
            t('aiDescription')
          ) : (
            <>
              {getStatusLabel(status)}
              {isConnected && <span className="text-emerald-500 ml-1">·</span>}
              {isConnected && <span className="text-emerald-500 ml-1">{t('online')}</span>}
            </>
          )}
        </p>
      </div>

      {/* Mode switch button */}
      {enableModeSwitching && (
        <>
          {mode === 'ai' && onTransferToHuman && (
            <Button
              onClick={onTransferToHuman}
              disabled={isTransferring}
              variant="outline"
              size="sm"
              className={cn(
                "h-9 px-4 rounded-full gap-2",
                "border-emerald-200 dark:border-emerald-800",
                "hover:bg-emerald-50 hover:border-emerald-300",
                "dark:hover:bg-emerald-950 dark:hover:border-emerald-700",
                "text-emerald-600 dark:text-emerald-400",
                "transition-colors"
              )}
            >
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">
                {isTransferring ? t('buttons.transferring') : t('buttons.switchToHuman')}
              </span>
            </Button>
          )}
          {mode === 'human' && onSwitchToAI && (
            <Button
              onClick={onSwitchToAI}
              disabled={isTransferring}
              variant="outline"
              size="sm"
              className={cn(
                "h-9 px-4 rounded-full gap-2",
                "border-violet-200 dark:border-violet-800",
                "hover:bg-violet-50 hover:border-violet-300",
                "dark:hover:bg-violet-950 dark:hover:border-violet-700",
                "text-violet-600 dark:text-violet-400",
                "transition-colors"
              )}
            >
              <Bot className="h-4 w-4" />
              <span className="hidden sm:inline">
                {isTransferring ? t('buttons.switchingToAI') : t('buttons.switchToAI')}
              </span>
            </Button>
          )}
        </>
      )}

      {/* Legacy: Transfer to Human Button (for non-switching mode) */}
      {!enableModeSwitching && mode === 'ai' && onTransferToHuman && (
        <Button
          onClick={onTransferToHuman}
          disabled={isTransferring}
          variant="outline"
          size="sm"
          className={cn(
            "h-9 px-4 rounded-full gap-2",
            "border-emerald-200 dark:border-emerald-800",
            "hover:bg-emerald-50 hover:border-emerald-300",
            "dark:hover:bg-emerald-950 dark:hover:border-emerald-700",
            "text-emerald-600 dark:text-emerald-400",
            "transition-colors"
          )}
        >
          <ArrowLeftRight className="h-4 w-4" />
          <span className="hidden sm:inline">
            {isTransferring ? t('buttons.transferring') : t('buttons.transferToHuman')}
          </span>
        </Button>
      )}
    </div>
  )
}
