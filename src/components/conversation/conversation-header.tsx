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

interface ConversationHeaderProps {
  mode: 'ai' | 'human'
  staffName?: string
  staffAvatar?: string
  status?: string
  isConnected?: boolean
  sseState?: 'connecting' | 'connected' | 'error' | 'disconnected'
  onTransferToHuman?: () => void
  isTransferring?: boolean
}

export function ConversationHeader({
  mode,
  staffName,
  staffAvatar,
  status = 'active',
  isConnected = false,
  sseState = 'disconnected',
  onTransferToHuman,
  isTransferring = false,
}: ConversationHeaderProps) {
  const displayName = mode === 'ai' ? 'AI Assistant' : (staffName || 'Waiting for assignment')

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

  const getModeLabel = (mode: 'ai' | 'human') => {
    return mode === 'ai' ? 'AI 对话' : '人工客服'
  }

  return (
    <div className="border-b bg-background">
      <div className="container max-w-4xl p-4">
        <div className="flex items-center gap-4">
          {/* Connection/Mode Indicator */}
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

          {/* Avatar */}
          <Avatar className="h-10 w-10">
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
                className={mode === 'ai' ? 'bg-blue-500 hover:bg-blue-600' : 'bg-green-500 hover:bg-green-600'}
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

          {/* Transfer to Human Button - Only in AI mode */}
          {mode === 'ai' && onTransferToHuman && (
            <Button
              onClick={onTransferToHuman}
              disabled={isTransferring}
              variant="outline"
              size="sm"
            >
              <User className="h-4 w-4 mr-2" />
              {isTransferring ? '转接中...' : '转人工'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
