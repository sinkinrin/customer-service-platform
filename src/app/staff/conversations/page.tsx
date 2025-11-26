'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, MessageSquare, Clock, Filter, BellRing, User, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { useSSE } from '@/lib/hooks/use-sse'
import { cn } from '@/lib/utils'
import { Separator } from '@/components/ui/separator'
import { UnreadBadge } from '@/components/ui/unread-badge'

interface Conversation {
  id: string
  customer_id: string
  staff_id?: string
  status: 'waiting' | 'active' | 'closed'
  mode?: 'ai' | 'human'
  message_count: number
  staff_unread_count?: number // Staff's unread count
  customer_unread_count?: number // Customer's unread count
  created_at: string
  updated_at: string
  last_message_at?: string
  customer?: {
    id: string
    full_name: string
    email: string
  }
  staff?: {
    id: string
    full_name: string
  }
}

export default function StaffConversationsPage() {
  const router = useRouter()
  const t = useTranslations('staff.conversations')
  const tToast = useTranslations('toast.staff.conversations')
  const tCommon = useTranslations('common')

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const loadConversations = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') {
        params.append('status', statusFilter)
      }
      params.append('limit', '50')

      const response = await fetch(`/api/conversations?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch conversations')

      const data = await response.json()
      setConversations(data.data || [])
    } catch (error) {
      console.error('Failed to load conversations:', error)
      toast.error(tToast('loadError'))
    } finally {
      setLoading(false)
    }
  }, [statusFilter, tToast])

  useEffect(() => {
    loadConversations()
  }, [statusFilter, loadConversations])

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'waiting':
        return 'secondary'
      case 'active':
        return 'default'
      case 'closed':
        return 'outline'
      default:
        return 'default'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'waiting':
        return t('card.status.waiting')
      case 'active':
        return t('card.status.active')
      case 'closed':
        return t('card.status.closed')
      default:
        return status
    }
  }

  const conversationList = Array.isArray(conversations) ? conversations : []
  const filteredConversations = conversationList.filter((conv) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      conv.customer?.full_name?.toLowerCase().includes(query) ||
      conv.customer?.email?.toLowerCase().includes(query) ||
      conv.id.includes(query)
    )
  })

  const stats = {
    total: conversationList.length,
    waiting: conversationList.filter((c) => c.status === 'waiting').length,
    active: conversationList.filter((c) => c.status === 'active').length,
    closed: conversationList.filter((c) => c.status === 'closed').length,
  }

  const [highlightedConversationId, setHighlightedConversationId] = useState<string | null>(null)
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current)
      }
    }
  }, [])

  const { state: sseState, isConnected: sseConnected } = useSSE({
    url: '/api/sse/conversations',
    enabled: true,
    onMessage: (event) => {
      if (event.type === 'new_conversation_transferred') {
        const conversationId = event.conversationId
        if (!conversationId) {
          console.warn('[Staff] Received new_conversation_transferred event without conversationId')
          return
        }
        const customerName =
          event.data?.customer?.full_name || event.data?.customer?.email || 'Unknown customer'
        toast.custom(
          () => (
            <div className="pointer-events-auto w-full max-w-sm rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                  <BellRing className="h-5 w-5" />
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-semibold text-blue-900">{t('notification.newTransfer')}</p>
                  <p className="text-xs text-blue-800">
                    {customerName} | ID: {conversationId}
                  </p>
                  {event.data?.transferReason && (
                    <p className="text-xs text-muted-foreground">
                      {t('notification.transferReason', { reason: event.data.transferReason })}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ),
          { duration: 3000, id: `transfer-${conversationId}` }
        )

        setHighlightedConversationId(conversationId)
        if (highlightTimeoutRef.current) {
          clearTimeout(highlightTimeoutRef.current)
        }
        highlightTimeoutRef.current = setTimeout(() => {
          setHighlightedConversationId((current) =>
            current === conversationId ? null : current
          )
        }, 3000)

        loadConversations()
      }

      if (event.type === 'conversation_transferred') {
        loadConversations()
      }

      // Handle new message - reload conversations to update unread counts
      if (event.type === 'new_message') {
        console.log('[Staff] Received new_message event, reloading conversations')
        loadConversations()
      }
    },
    onError: (error) => {
      console.error('[SSE] Error:', error)
      toast.error(tToast('sseUnavailable'))
    },
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">{t('pageTitle')}</h1>
        <p className="text-muted-foreground mt-2">
          {t('pageDescription')}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('stats.total')}</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('stats.waiting')}</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.waiting}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('stats.active')}</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('stats.closed')}</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.closed}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>{t('filter.title')}</CardTitle>
          <CardDescription>{t('filter.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('filter.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-full md:w-48">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder={t('filter.statusPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('filter.allStatuses')}</SelectItem>
                  <SelectItem value="waiting">{t('card.status.waiting')}</SelectItem>
                  <SelectItem value="active">{t('card.status.active')}</SelectItem>
                  <SelectItem value="closed">{t('card.status.closed')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={loadConversations} variant="outline">
              {tCommon('actions.refresh')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Conversations Grid */}
      <div>
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold">{t('list.title')}</h2>
            <p className="text-sm text-muted-foreground">
              {t('list.subtitle', { count: filteredConversations.length })}
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Badge variant={sseConnected ? 'secondary' : 'destructive'}>
              {sseConnected ? t('sse.live') : t('sse.offline')}
            </Badge>
            {sseState === 'error' && (
              <span className="text-xs text-destructive">{t('sse.error')}</span>
            )}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block h-8 w-8 animate-spin motion-reduce:animate-none rounded-full border-4 border-solid border-current border-r-transparent" />
            <p className="mt-2 text-sm text-muted-foreground">{t('list.loading')}</p>
          </div>
        ) : filteredConversations.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium">{t('list.empty.title')}</p>
              <p className="text-sm text-muted-foreground mt-2">
                {searchQuery ? t('list.empty.filterSubtitle') : t('list.empty.subtitle')}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredConversations.map((conversation) => (
              <Card
                key={conversation.id}
                className={cn(
                  'cursor-pointer hover:shadow-md transition-all duration-200 hover:border-primary/50 relative',
                  highlightedConversationId === conversation.id &&
                    'bg-blue-50 dark:bg-blue-950 border-blue-500 shadow-lg ring-2 ring-blue-500/20'
                )}
                onClick={() => router.push(`/staff/conversations/${conversation.id}`)}
              >
                {/* Unread Badge - Top Right Corner */}
                {conversation.staff_unread_count && conversation.staff_unread_count > 0 && (
                  <div className="absolute top-3 right-3 z-10">
                    <UnreadBadge count={conversation.staff_unread_count} />
                  </div>
                )}

                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Avatar className="h-12 w-12">
                          <AvatarFallback className="bg-primary text-primary-foreground">
                            {conversation.customer?.full_name?.charAt(0) || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        {/* Red dot on avatar for unread messages */}
                        {conversation.staff_unread_count && conversation.staff_unread_count > 0 && (
                          <span className="absolute top-0 right-0 block h-3 w-3 rounded-full bg-red-500 ring-2 ring-background" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base font-semibold truncate">
                          {conversation.customer?.full_name || t('card.unknown')}
                        </CardTitle>
                        <CardDescription className="text-xs truncate">
                          {conversation.customer?.email || t('card.noEmail')}
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={getStatusBadgeVariant(conversation.status)}>
                        {getStatusLabel(conversation.status)}
                      </Badge>
                      {conversation.mode && (
                        <Badge variant={conversation.mode === 'ai' ? 'outline' : 'secondary'}>
                          {conversation.mode === 'ai' ? t('card.mode.ai') : t('card.mode.human')}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MessageSquare className="h-3 w-3" />
                      <span>{t('card.messageCount', { count: conversation.message_count || 0 })}</span>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {t('card.assignedStaff')}
                      </span>
                      <span className="font-medium truncate max-w-[120px]">
                        {conversation.staff?.full_name || (
                          <span className="text-muted-foreground">{t('card.unassigned')}</span>
                        )}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {t('card.lastActivity')}
                      </span>
                      <span className="font-medium">
                        {conversation.last_message_at
                          ? format(new Date(conversation.last_message_at), 'MM-dd HH:mm')
                          : t('card.noActivity')}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{t('card.createdTime')}</span>
                      <span className="font-medium">
                        {format(new Date(conversation.created_at), 'MM-dd HH:mm')}
                      </span>
                    </div>
                  </div>

                  <Separator />

                  <Button
                    className="w-full"
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation()
                      router.push(`/staff/conversations/${conversation.id}`)
                    }}
                  >
                    {t('card.viewButton')}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
