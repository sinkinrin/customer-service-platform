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
  if (!state) return 'bg-gray-400 text-white'
  const stateLower = state.toLowerCase()
  if (stateLower === 'new') return 'bg-green-500 text-white'
  if (stateLower === 'open') return 'bg-blue-500 text-white'
  if (stateLower === 'pending reminder') return 'bg-amber-400 text-gray-900'
  if (stateLower === 'pending close') return 'bg-orange-500 text-white'
  if (stateLower === 'closed') return 'bg-gray-400 text-white'
  if (stateLower === 'merged') return 'bg-violet-500 text-white'
  return 'bg-gray-400 text-white'
}

const getPriorityColor = (priority: string | undefined) => {
  if (!priority) return 'bg-indigo-500 text-white'
  const priorityLower = priority.toLowerCase()
  if (priorityLower === '1 low') return 'bg-indigo-300 text-gray-800'
  if (priorityLower === '2 normal') return 'bg-indigo-500 text-white'
  if (priorityLower === '3 high') return 'bg-red-500 text-white'
  return 'bg-indigo-500 text-white'
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
        {/* owner_id=1 is Zammad system user, treat as unassigned */}
        {ticket.owner_id && ticket.owner_id !== 1 && (
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

