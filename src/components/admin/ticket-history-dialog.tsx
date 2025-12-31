'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ExternalLink, Ticket, Clock, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'
import { useTranslations } from 'next-intl'

interface TicketHistoryItem {
  id: number
  number: number
  title: string
  state: string
  priority: string
  created_at: string
  updated_at: string
}

interface TicketHistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string | number
  userName: string
  userEmail: string
}

const getStateColor = (state: string) => {
  const stateLower = state?.toLowerCase() || ''
  if (stateLower.includes('open') || stateLower.includes('new')) return 'bg-blue-500'
  if (stateLower.includes('pending')) return 'bg-yellow-500'
  if (stateLower.includes('closed')) return 'bg-gray-400'
  return 'bg-gray-400'
}

const getPriorityColor = (priority: string) => {
  if (priority?.includes('high') || priority?.includes('3')) return 'text-red-600'
  if (priority?.includes('low') || priority?.includes('1')) return 'text-gray-500'
  return 'text-blue-600'
}

export function TicketHistoryDialog({
  open,
  onOpenChange,
  userId,
  userName,
  userEmail,
}: TicketHistoryDialogProps) {
  const t = useTranslations('admin.users.ticketHistory')
  const tCommon = useTranslations('common')
  const [tickets, setTickets] = useState<TicketHistoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open && userId) {
      loadTickets()
    }
  }, [open, userId])

  const loadTickets = async () => {
    setLoading(true)
    setError(null)
    try {
      // Fetch tickets for this user by email
      const response = await fetch(`/api/tickets?customer_email=${encodeURIComponent(userEmail)}&limit=50`)
      if (response.ok) {
        const data = await response.json()
        setTickets(data.data?.tickets || [])
      } else {
        setError(t('loadError'))
      }
    } catch (err) {
      console.error('Failed to load ticket history:', err)
      setError(t('loadError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ticket className="h-5 w-5" />
            {t('title')}
          </DialogTitle>
          <DialogDescription>
            {t('description', { name: userName, email: userEmail })}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[400px] pr-4">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-4 border rounded-lg">
                  <Skeleton className="h-4 w-3/4 mb-2" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <AlertCircle className="h-8 w-8 mb-2" />
              <p>{error}</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={loadTickets}>
                {t('retry')}
              </Button>
            </div>
          ) : tickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Ticket className="h-8 w-8 mb-2" />
              <p>{t('noTickets')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">#{ticket.number}</span>
                        <Badge className={getStateColor(ticket.state)} variant="secondary">
                          {ticket.state}
                        </Badge>
                        <span className={`text-xs font-medium ${getPriorityColor(ticket.priority)}`}>
                          {ticket.priority}
                        </span>
                      </div>
                      <p className="text-sm truncate">{ticket.title}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>
                          {format(new Date(ticket.created_at), 'yyyy-MM-dd HH:mm')}
                        </span>
                      </div>
                    </div>
                    <Link href={`/admin/tickets/${ticket.id}`}>
                      <Button variant="ghost" size="sm">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="flex justify-between items-center pt-4 border-t">
          <span className="text-sm text-muted-foreground">
            {t('count', { count: tickets.length })}
          </span>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tCommon('close')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
