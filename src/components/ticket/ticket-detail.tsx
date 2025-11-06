'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { User, Calendar, Clock, Tag } from 'lucide-react'
import { format } from 'date-fns'
import type { ZammadTicket } from '@/lib/stores/ticket-store'

interface TicketDetailProps {
  ticket: ZammadTicket
}

const getStatusColor = (state: string | undefined) => {
  if (!state) {
    return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
  }
  const stateLower = state.toLowerCase()
  if (stateLower.includes('new') || stateLower.includes('open')) {
    return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
  }
  if (stateLower.includes('pending')) {
    return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
  }
  if (stateLower.includes('closed')) {
    return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
  }
  return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
}

const getPriorityColor = (priority: string | undefined) => {
  if (!priority) {
    return 'secondary'
  }
  const priorityLower = priority.toLowerCase()
  if (priorityLower.includes('urgent') || priorityLower === '1 low') {
    return 'destructive'
  }
  if (priorityLower.includes('high') || priorityLower === '2 normal') {
    return 'default'
  }
  return 'secondary'
}

export function TicketDetail({ ticket }: TicketDetailProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-2xl">
              Ticket #{ticket.number}
            </CardTitle>
            <p className="text-lg text-muted-foreground mt-2">
              {ticket.title}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 ml-4">
            <Badge className={getStatusColor(ticket.state)}>
              {ticket.state}
            </Badge>
            <Badge variant={getPriorityColor(ticket.priority)}>
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
                <p className="text-sm font-medium">Customer</p>
                <p className="text-sm text-muted-foreground">{ticket.customer}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Tag className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Group</p>
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
                <p className="text-sm font-medium">Created</p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(ticket.created_at), 'PPpp')}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Last Updated</p>
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
                  <p className="text-sm font-medium">Assigned To</p>
                  <p className="text-sm text-muted-foreground">
                    Owner ID: {ticket.owner_id}
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

