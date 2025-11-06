'use client'

import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Clock, AlertCircle, CheckCircle2, XCircle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import type { ZammadTicket } from '@/lib/stores/ticket-store'
import { useAuth } from '@/lib/hooks/use-auth'

interface TicketListProps {
  tickets: ZammadTicket[]
  isLoading?: boolean
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

export function TicketList({ tickets, isLoading }: TicketListProps) {
  const router = useRouter()
  const { user } = useAuth()

  // Determine the base path based on user role
  const getTicketDetailPath = (ticketId: number) => {
    if (user?.role === 'admin') {
      return `/admin/tickets/${ticketId}`
    } else if (user?.role === 'staff') {
      return `/staff/tickets/${ticketId}`
    } else {
      return `/my-tickets/${ticketId}`
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-3/4" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-1/3" />
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
          <p className="text-lg font-medium text-muted-foreground">No tickets found</p>
          <p className="text-sm text-muted-foreground mt-2">
            Try adjusting your search or filters
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {tickets.map((ticket) => (
        <Card
          key={ticket.id}
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => router.push(getTicketDetailPath(ticket.id))}
        >
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <CardTitle className="text-lg truncate">
                  #{ticket.number} - {ticket.title}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Customer: {ticket.customer}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2 ml-4">
                <Badge className={getStatusColor(ticket.state)}>
                  <span className="mr-1">{getStatusIcon(ticket.state)}</span>
                  {ticket.state}
                </Badge>
                <Badge variant={getPriorityColor(ticket.priority)}>
                  {ticket.priority}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div className="flex items-center gap-4">
                <span>Group: {ticket.group}</span>
                {ticket.owner_id && <span>Assigned</span>}
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>
                  {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

