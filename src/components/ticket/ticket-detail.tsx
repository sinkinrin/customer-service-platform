'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { User, Calendar, Clock, Tag } from 'lucide-react'
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
  // Open (进行中) - Bright Blue
  if (stateLower === 'open' || stateLower === 'new') {
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
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-2xl">
              {t('ticketNumber', { number: ticket.number })}
            </CardTitle>
            <p className="text-lg text-muted-foreground mt-2">
              {ticket.title}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 ml-4">
            <Badge className={getStatusColor(ticket.state)}>
              {ticket.state}
            </Badge>
            <Badge className={getPriorityColor(ticket.priority)}>
              {ticket.priority}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <Separator />

          {/* Customer Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <User className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">{t('customer')}</p>
                <p className="text-sm text-muted-foreground">{ticket.customer}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Tag className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">{t('group')}</p>
                <p className="text-sm text-muted-foreground">{ticket.group}</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Timestamps */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">{t('created')}</p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(ticket.created_at), 'PPpp')}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">{t('lastUpdated')}</p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(ticket.updated_at), 'PPpp')}
                </p>
              </div>
            </div>
          </div>

          {ticket.owner_id && (
            <>
              <Separator />
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">{t('assignedTo')}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('ownerId', { id: ticket.owner_id })}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

