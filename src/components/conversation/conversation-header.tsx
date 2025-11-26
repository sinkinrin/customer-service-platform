/**
 * Conversation Header Component
 *
 * Displays conversation mode, status, and transfer button
 */

'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Bot, User, Wifi, WifiOff } from 'lucide-react'
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
  onSwitchToAI?: () => void // New: Switch back to AI mode
  isTransferring?: boolean
  enableModeSwitching?: boolean // New: Enable bidirectional switching
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

  const getModeVariant = (mode: 'ai' | 'human'): 'default' | 'secondary' => {
    return mode === 'ai' ? 'default' : 'secondary'
  }

  const getModeLabel = (mode: 'ai' | 'human') =>
    mode === 'ai' ? t('aiMode') : t('humanMode')

  return (
    <div className="border-b bg-gradient-to-r from-primary/5 via-background to-background">
      <div className="container max-w-4xl p-4">
        <div className="flex items-center gap-4">
          {/* Connection/Mode Indicator */}
          <div className="flex items-center gap-2">
            {mode === 'ai' ? (
              <Bot className="h-5 w-5 text-blue-500" aria-label={t('ariaLabels.aiChat')} />
            ) : isConnected ? (
              <Wifi className="h-4 w-4 text-green-500" aria-label={t('ariaLabels.connected')} />
            ) : sseState === 'connecting' ? (
              <WifiOff className="h-4 w-4 text-yellow-500 animate-pulse motion-reduce:animate-none" aria-label={t('ariaLabels.connecting')} />
            ) : (
              <WifiOff className="h-4 w-4 text-gray-400" aria-label={t('ariaLabels.disconnected')} />
            )}
          </div>

          {/* Avatar */}
          <Avatar className="h-11 w-11 shadow-sm ring-1 ring-border/60">
            <AvatarImage src={staffAvatar} alt={displayName} />
            <AvatarFallback>
              {mode === 'ai' ? <Bot className="h-5 w-5" /> : getInitials(displayName)}
            </AvatarFallback>
          </Avatar>

          {/* Name and Status */}
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold truncate">{displayName}</h2>
            <div className="flex gap-2 mt-1">
              <Badge
                variant={getModeVariant(mode)}
                className={cn(
                  "shadow-sm",
                  mode === 'ai'
                    ? 'bg-blue-500 hover:bg-blue-600'
                    : 'bg-green-500 hover:bg-green-600'
                )}
              >
                {getModeLabel(mode)}
              </Badge>
              {mode === 'human' && (
                <Badge variant={getStatusVariant(status)}>
                  {status}
                </Badge>
              )}
            </div>
          </div>

          {/* Mode Switching Buttons */}
          {enableModeSwitching && (
            <>
              {mode === 'ai' && onTransferToHuman && (
                <Button
                  onClick={onTransferToHuman}
                  disabled={isTransferring}
                  variant="outline"
                  size="sm"
                >
                  <User className="h-4 w-4 mr-2" />
                  {isTransferring ? t('buttons.transferring') : t('buttons.switchToHuman')}
                </Button>
              )}
              {mode === 'human' && onSwitchToAI && (
                <Button
                  onClick={onSwitchToAI}
                  disabled={isTransferring}
                  variant="outline"
                  size="sm"
                >
                  <Bot className="h-4 w-4 mr-2" />
                  {isTransferring ? t('buttons.switchingToAI') : t('buttons.switchToAI')}
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
            >
              <User className="h-4 w-4 mr-2" />
              {isTransferring ? t('buttons.transferring') : t('buttons.transferToHuman')}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
