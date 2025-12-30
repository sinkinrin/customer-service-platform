'use client'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import type { ZammadTicket } from '@/lib/stores/ticket-store'
import { useTranslations } from 'next-intl'

interface TicketDetailProps {
  ticket: ZammadTicket
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

export function TicketDetail({ ticket }: TicketDetailProps) {
  const t = useTranslations('tickets.details')

  return (
    <Card className="p-4">
      {/* Compact Header */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold">{t('ticketNumber', { number: ticket.number })}</h2>
            <Badge className={getStatusColor(ticket.state)}>{ticket.state}</Badge>
            <Badge className={getPriorityColor(ticket.priority)}>{ticket.priority}</Badge>
          </div>
          <p className="text-muted-foreground mt-1 truncate">{ticket.title}</p>
        </div>
      </div>

      {/* Compact Meta Info Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 text-sm border-t pt-3">
        <div>
          <span className="text-muted-foreground">{t('customer')}:</span>
          <p className="font-medium truncate">{ticket.customer}</p>
        </div>
        {ticket.group && (
          <div>
            <span className="text-muted-foreground">{t('group')}:</span>
            <p className="font-medium truncate">{ticket.group}</p>
          </div>
        )}
        {ticket.owner_id && (
          <div>
            <span className="text-muted-foreground">{t('assignedTo')}:</span>
            <p className="font-medium truncate">{ticket.owner_name || `Staff #${ticket.owner_id}`}</p>
          </div>
        )}
        <div>
          <span className="text-muted-foreground">{t('created')}:</span>
          <p className="font-medium">{format(new Date(ticket.created_at), 'MM-dd HH:mm')}</p>
        </div>
        <div>
          <span className="text-muted-foreground">{t('lastUpdated')}:</span>
          <p className="font-medium">{format(new Date(ticket.updated_at), 'MM-dd HH:mm')}</p>
        </div>
      </div>
    </Card>
  )
}

