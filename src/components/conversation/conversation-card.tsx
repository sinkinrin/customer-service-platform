'use client'

/**
 * ConversationCard - Modern conversation list card component
 * 
 * Features:
 * - Compact horizontal layout with clear visual hierarchy
 * - Unread message indicator integrated into avatar
 * - Status and mode badges with semantic colors
 * - Hover effects and smooth transitions
 * - Responsive design
 */

import { format, formatDistanceToNow } from 'date-fns'
import { zhCN, enUS } from 'date-fns/locale'
import { 
  MessageSquare, 
  Clock, 
  Globe, 
  User, 
  Bot, 
  Headphones,
  ChevronRight,
  Sparkles
} from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { getRegionLabel, type RegionValue } from '@/lib/constants/regions'

export interface ConversationCardData {
  id: string
  status: 'waiting' | 'active' | 'closed' | string
  mode?: 'ai' | 'human' | string
  message_count?: number
  staff_unread_count?: number
  last_message_at?: string
  created_at: string
  customer?: {
    full_name?: string
    email?: string
    region?: string
  }
  staff?: {
    full_name?: string
    region?: string
  }
}

export interface ConversationCardProps {
  conversation: ConversationCardData
  onClick?: () => void
  isHighlighted?: boolean
  locale?: 'zh' | 'en'
  translations?: {
    status?: {
      waiting?: string
      active?: string
      closed?: string
    }
    mode?: {
      ai?: string
      human?: string
    }
    unknown?: string
    noEmail?: string
    unassigned?: string
    messages?: string
    lastActive?: string
    created?: string
    region?: string
    staff?: string
    viewConversation?: string
  }
}

const defaultTranslations = {
  status: {
    waiting: '等待中',
    active: '进行中',
    closed: '已关闭',
  },
  mode: {
    ai: 'AI',
    human: '人工',
  },
  unknown: '未知用户',
  noEmail: '无邮箱',
  unassigned: '未分配',
  messages: '条消息',
  lastActive: '最后活动',
  created: '创建于',
  region: '区域',
  staff: '客服',
  viewConversation: '查看对话',
}

export function ConversationCard({
  conversation,
  onClick,
  isHighlighted = false,
  locale = 'zh',
  translations = defaultTranslations,
}: ConversationCardProps) {
  const t = { ...defaultTranslations, ...translations }
  const dateLocale = locale === 'zh' ? zhCN : enUS
  
  const hasUnread = (conversation.staff_unread_count ?? 0) > 0
  const unreadCount = conversation.staff_unread_count ?? 0
  
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'waiting':
        return { 
          label: t.status?.waiting || '等待中', 
          className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800' 
        }
      case 'active':
        return { 
          label: t.status?.active || '进行中', 
          className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' 
        }
      case 'closed':
        return { 
          label: t.status?.closed || '已关闭', 
          className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700' 
        }
      default:
        return { 
          label: status, 
          className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' 
        }
    }
  }

  const getModeConfig = (mode?: string) => {
    if (mode === 'ai') {
      return {
        label: t.mode?.ai || 'AI',
        icon: Bot,
        className: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 border-violet-200 dark:border-violet-800'
      }
    }
    return {
      label: t.mode?.human || '人工',
      icon: Headphones,
      className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800'
    }
  }

  const statusConfig = getStatusConfig(conversation.status)
  const modeConfig = getModeConfig(conversation.mode)
  const ModeIcon = modeConfig.icon

  const formatRelativeTime = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: dateLocale })
    } catch {
      return '-'
    }
  }

  const formatDateTime = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'MM-dd HH:mm')
    } catch {
      return '-'
    }
  }

  const customerName = conversation.customer?.full_name || t.unknown
  const customerEmail = conversation.customer?.email || t.noEmail
  const customerInitial = customerName.charAt(0).toUpperCase()

  return (
    <div
      onClick={onClick}
      className={cn(
        'group relative rounded-xl border bg-card p-4 cursor-pointer',
        'transition-all duration-200 ease-out',
        'hover:shadow-lg hover:shadow-primary/5 hover:border-primary/30 hover:-translate-y-0.5',
        isHighlighted && 'ring-2 ring-primary/50 bg-primary/5 border-primary/50',
        hasUnread && 'border-l-4 border-l-red-500'
      )}
    >
      {/* Main Content */}
      <div className="flex items-start gap-4">
        {/* Avatar with unread indicator */}
        <div className="relative flex-shrink-0">
          <Avatar className={cn(
            'h-12 w-12 ring-2 ring-background',
            hasUnread && 'ring-red-500/50'
          )}>
            <AvatarFallback className={cn(
              'text-lg font-semibold',
              hasUnread 
                ? 'bg-gradient-to-br from-red-500 to-rose-600 text-white' 
                : 'bg-gradient-to-br from-primary to-primary/80 text-primary-foreground'
            )}>
              {customerInitial}
            </AvatarFallback>
          </Avatar>
          {/* Unread count badge */}
          {hasUnread && (
            <span className={cn(
              'absolute -top-1 -right-1 flex items-center justify-center',
              'min-w-[20px] h-5 px-1.5 rounded-full',
              'bg-red-500 text-white text-xs font-bold',
              'ring-2 ring-background',
              'animate-in zoom-in-50 duration-200'
            )}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>

        {/* Info Section */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Header: Name + Email */}
          <div>
            <div className="flex items-center gap-2">
              <h3 className={cn(
                'font-semibold truncate',
                hasUnread ? 'text-foreground' : 'text-foreground/90'
              )}>
                {customerName}
              </h3>
              {hasUnread && (
                <Sparkles className="h-4 w-4 text-red-500 flex-shrink-0" />
              )}
            </div>
            <p className="text-sm text-muted-foreground truncate">
              {customerEmail}
            </p>
          </div>

          {/* Badges Row */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge 
              variant="outline" 
              className={cn('text-xs font-medium border', statusConfig.className)}
            >
              {statusConfig.label}
            </Badge>
            <Badge 
              variant="outline" 
              className={cn('text-xs font-medium border flex items-center gap-1', modeConfig.className)}
            >
              <ModeIcon className="h-3 w-3" />
              {modeConfig.label}
            </Badge>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <MessageSquare className="h-3 w-3" />
              {conversation.message_count || 0} {t.messages}
            </span>
          </div>

          {/* Meta Info Grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            {/* Region */}
            {conversation.customer?.region && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Globe className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">
                  {getRegionLabel(conversation.customer.region as RegionValue, locale)}
                </span>
              </div>
            )}
            
            {/* Assigned Staff */}
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <User className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">
                {conversation.staff?.full_name || (
                  <span className="italic">{t.unassigned}</span>
                )}
              </span>
            </div>

            {/* Last Activity */}
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">
                {conversation.last_message_at 
                  ? formatRelativeTime(conversation.last_message_at)
                  : '-'
                }
              </span>
            </div>

            {/* Created Time */}
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <span className="truncate">
                {t.created} {formatDateTime(conversation.created_at)}
              </span>
            </div>
          </div>
        </div>

        {/* Right Arrow */}
        <div className="flex-shrink-0 self-center">
          <ChevronRight className={cn(
            'h-5 w-5 text-muted-foreground/50',
            'transition-transform duration-200',
            'group-hover:translate-x-1 group-hover:text-primary'
          )} />
        </div>
      </div>
    </div>
  )
}
