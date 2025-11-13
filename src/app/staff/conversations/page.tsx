'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, MessageSquare, Clock, Filter, BellRing } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { useSSE } from '@/lib/hooks/use-sse'
import { cn } from '@/lib/utils'

interface Conversation {
  id: string
  customer_id: string
  staff_id?: string
  status: 'waiting' | 'active' | 'closed'
  message_count: number
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
      toast.error('Failed to load conversations')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

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
        return 'Waiting'
      case 'active':
        return 'Active'
      case 'closed':
        return 'Closed'
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
                  <p className="text-sm font-semibold text-blue-900">新的转人工对话</p>
                  <p className="text-xs text-blue-800">
                    {customerName} | ID: {conversationId}
                  </p>
                  {event.data?.transferReason && (
                    <p className="text-xs text-muted-foreground">
                      原因：{event.data.transferReason}
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
    },
    onError: (error) => {
      console.error('[SSE] Error:', error)
      toast.error('Real-time updates unavailable')
    },
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Conversations</h1>
        <p className="text-muted-foreground mt-2">
          Manage customer conversations and provide support
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Waiting</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.waiting}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Closed</CardTitle>
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
          <CardTitle>Filter Conversations</CardTitle>
          <CardDescription>Search and filter conversations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by customer name, email, or ID..."
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
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="waiting">Waiting</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={loadConversations} variant="outline">
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Conversations Table */}
      <Card>
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Conversations List</CardTitle>
            <CardDescription>
              {filteredConversations.length} conversation(s) found
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Badge variant={sseConnected ? 'secondary' : 'destructive'}>
              {sseConnected ? '实时更新' : '实时中断'}
            </Badge>
            {sseState === 'error' && (
              <span className="text-xs text-destructive">连接异常</span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent" />
              <p className="mt-2 text-sm text-muted-foreground">Loading conversations...</p>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium">No conversations found</p>
              <p className="text-sm text-muted-foreground mt-2">
                {searchQuery ? 'Try adjusting your search criteria' : 'No conversations available'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Messages</TableHead>
                  <TableHead>Staff</TableHead>
                  <TableHead>Last Activity</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredConversations.map((conversation) => (
                  <TableRow
                    key={conversation.id}
                    className={cn(
                      'cursor-pointer hover:bg-muted/50 transition',
                      highlightedConversationId === conversation.id &&
                        'bg-blue-50 border border-blue-200'
                    )}
                    onClick={() => router.push(`/staff/conversations/${conversation.id}`)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            {conversation.customer?.full_name?.charAt(0) || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">
                            {conversation.customer?.full_name || 'Unknown'}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {conversation.customer?.email || 'No email'}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(conversation.status)}>
                        {getStatusLabel(conversation.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>{conversation.message_count}</TableCell>
                    <TableCell>
                      {conversation.staff?.full_name || (
                        <span className="text-muted-foreground">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {conversation.last_message_at
                        ? format(new Date(conversation.last_message_at), 'MMM d, HH:mm')
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {format(new Date(conversation.created_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation()
                          router.push(`/staff/conversations/${conversation.id}`)
                        }}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
