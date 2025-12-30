'use client'

import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Clock, AlertCircle, CheckCircle2, XCircle, UserPlus } from 'lucide-react'
import { format } from 'date-fns'
import type { ZammadTicket } from '@/lib/stores/ticket-store'
import { useAuth } from '@/lib/hooks/use-auth'
import { useTranslations } from 'next-intl'
import { useUnreadStore } from '@/lib/stores/unread-store'
import { cn } from '@/lib/utils'

interface TicketListProps {
  tickets: ZammadTicket[]
  isLoading?: boolean
  onAssign?: (ticket: { id: number; number: string; title: string; owner_id?: number | null }) => void
}

const getStatusIcon = (state: string | undefined) => {
  if (!state) {
    return <AlertCircle className="h-4 w-4" />
  }
  const stateLower = state.toLowerCase()
  if (stateLower.includes('new') || stateLower.includes('open')) {
    return <AlertCircle className="h-4 w-4" />
  }
  if (stateLower.includes('pending')) {
    return <Clock className="h-4 w-4" />
  }
  if (stateLower.includes('closed')) {
    return <XCircle className="h-4 w-4" />
  }
  return <CheckCircle2 className="h-4 w-4" />
}

const getStatusColor = (state: string | undefined) => {
  if (!state) {
    return 'bg-[#9CA3AF] text-white'
  }
  const stateLower = state.toLowerCase()
  // New (新建) - Bright Green for attention
  if (stateLower === 'new') {
    return 'bg-[#22C55E] text-white'
  }
  // Open (进行中) - Bright Blue
  if (stateLower === 'open') {
    return 'bg-[#3B82F6] text-white'
  }
  // Pending Reminder (等待提醒) - Amber Yellow
  if (stateLower === 'pending reminder') {
    return 'bg-[#FBBF24] text-gray-900'
  }
  // Pending Close (待关闭) - Light Cyan-Green
  if (stateLower === 'pending close') {
    return 'bg-[#10B981] text-white'
  }
  // Closed (已关闭) - Neutral Gray
  if (stateLower === 'closed') {
    return 'bg-[#9CA3AF] text-white'
  }
  // Default fallback
  return 'bg-[#9CA3AF] text-white'
}

const getPriorityColor = (priority: string | undefined) => {
  if (!priority) {
    return 'bg-[#6366F1] text-white'
  }
  const priorityLower = priority.toLowerCase()
  // Low (低) - Light Blue-Gray
  if (priorityLower === '1 low') {
    return 'bg-[#A5B4FC] text-gray-800'
  }
  // Normal (普通) - Neutral Blue-Gray
  if (priorityLower === '2 normal') {
    return 'bg-[#6366F1] text-white'
  }
  // High (高) - Bright Red
  if (priorityLower === '3 high') {
    return 'bg-[#EF4444] text-white'
  }
  // Default fallback
  return 'bg-[#6366F1] text-white'
}

export function TicketList({ tickets, isLoading, onAssign }: TicketListProps) {
  const router = useRouter()
  const { user } = useAuth()
  const t = useTranslations('tickets')
  const tCommon = useTranslations('common.status')
  const { unreadTickets, unreadCounts } = useUnreadStore()

  // Determine the base path based on user role
  const getTicketDetailPath = (ticketId: number) => {
    if (user?.role === 'admin') {
      return `/admin/tickets/${ticketId}`
    } else if (user?.role === 'staff') {
      return `/staff/tickets/${ticketId}`
    } else {
      return `/customer/my-tickets/${ticketId}`
    }
  }

  const handleAssignClick = (e: React.MouseEvent, ticket: ZammadTicket) => {
    e.stopPropagation() // Prevent card click
    if (onAssign) {
      onAssign({
        id: ticket.id,
        number: ticket.number,
        title: ticket.title,
        owner_id: ticket.owner_id,
      })
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4 min-h-[1000px]">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
          <Card key={i} className="min-h-[132px]">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
                <div className="flex flex-col items-end gap-2 ml-4">
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-6 w-16" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-40" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (tickets.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium text-muted-foreground">{t('empty.noTicketsFound')}</p>
          <p className="text-sm text-muted-foreground mt-2">
            {t('empty.adjustFilters')}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4 min-h-[1000px]">
      {tickets.map((ticket) => {
        const isUnread = unreadTickets.includes(ticket.id)
        const unreadCount = unreadCounts[ticket.id] || 0
        
        return (
        <Card
          key={ticket.id}
          className={cn(
            "cursor-pointer hover:shadow-md transition-shadow",
            isUnread && "border-l-4 border-l-blue-500 bg-blue-50/50"
          )}
          onClick={() => router.push(getTicketDetailPath(ticket.id))}
        >
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <CardTitle className={cn("text-lg truncate", isUnread && "font-bold")}>
                  #{ticket.number} - {ticket.title}
                  {unreadCount > 0 && (
                    <Badge className="ml-2 bg-red-500 text-white text-xs">
                      {unreadCount} new
                    </Badge>
                  )}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('details.customer')}: {ticket.customer}
                </p>
                {/* Assignment Status Badge */}
                <div className="mt-2">
                  {ticket.owner_id ? (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      ✓ Assigned to: {ticket.owner_name || `Staff #${ticket.owner_id}`}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                      ⚠ Unassigned
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2 ml-4">
                <Badge className={getStatusColor(ticket.state)}>
                  <span className="mr-1">{getStatusIcon(ticket.state)}</span>
                  {ticket.state}
                </Badge>
                <Badge className={getPriorityColor(ticket.priority)}>
                  {ticket.priority}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div className="flex items-center gap-4">
                {ticket.group && <span>{t('details.group')}: {ticket.group}</span>}
              </div>
              <div className="flex items-center gap-4">
                {user?.role === 'admin' && onAssign && (
                  <Button
                    size="sm"
                    variant={ticket.owner_id ? "outline" : "default"}
                    onClick={(e) => handleAssignClick(e, ticket)}
                    className="gap-1"
                  >
                    <UserPlus className="h-4 w-4" />
                    {ticket.owner_id
                      ? (ticket.owner_name || `Staff #${ticket.owner_id}`)
                      : t('actions.assign')}
                  </Button>
                )}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span className="text-xs">
                      {format(new Date(ticket.created_at), 'yyyy-MM-dd HH:mm')}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span className="text-xs">
                      {format(new Date(ticket.updated_at), 'yyyy-MM-dd HH:mm')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        )
      })}
    </div>
  )
}


