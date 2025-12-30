'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, MessageSquare } from 'lucide-react'
import { TicketActions } from '@/components/ticket/ticket-actions'
import { ArticleCard } from '@/components/ticket/article-content'
import { useTicket, type TicketArticle } from '@/lib/hooks/use-ticket'
import type { ZammadTicket } from '@/lib/stores/ticket-store'
import { useUnreadStore } from '@/lib/stores/unread-store'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'

// Compact status badge component
function TicketStatusBadge({ state }: { state?: string }) {
  if (!state) return null
  const stateLower = state.toLowerCase()
  
  let className = 'text-xs '
  if (stateLower === 'new') {
    className += 'bg-green-500 text-white hover:bg-green-500'
  } else if (stateLower === 'open') {
    className += 'bg-blue-500 text-white hover:bg-blue-500'
  } else if (stateLower === 'pending reminder') {
    className += 'bg-amber-400 text-gray-900 hover:bg-amber-400'
  } else if (stateLower === 'pending close') {
    className += 'bg-emerald-500 text-white hover:bg-emerald-500'
  } else if (stateLower === 'closed') {
    className += 'bg-gray-400 text-white hover:bg-gray-400'
  } else {
    className += 'bg-gray-400 text-white hover:bg-gray-400'
  }
  
  return <Badge className={className}>{state}</Badge>
}

// Compact priority badge component
function TicketPriorityBadge({ priority }: { priority?: string }) {
  if (!priority) return null
  const priorityLower = priority.toLowerCase()
  
  let className = 'text-xs '
  if (priorityLower === '1 low') {
    className += 'bg-indigo-200 text-gray-800 hover:bg-indigo-200'
  } else if (priorityLower === '2 normal') {
    className += 'bg-indigo-500 text-white hover:bg-indigo-500'
  } else if (priorityLower === '3 high') {
    className += 'bg-red-500 text-white hover:bg-red-500'
  } else {
    className += 'bg-indigo-500 text-white hover:bg-indigo-500'
  }
  
  return <Badge className={className}>{priority}</Badge>
}

export default function StaffTicketDetailPage() {
  const t = useTranslations('staff.tickets.detail')
  const tDetails = useTranslations('tickets.details')
  const tToast = useTranslations('toast.staff.tickets')
  const params = useParams()
  const router = useRouter()
  const ticketId = params.id as string

  const [ticket, setTicket] = useState<ZammadTicket | null>(null)
  const [articles, setArticles] = useState<TicketArticle[]>([])
  const { fetchTicketById, updateTicket, addArticle, fetchArticles, isLoading } = useTicket()
  const { markAsRead } = useUnreadStore()

  useEffect(() => {
    loadTicket()
    loadArticles()
    // Mark ticket as read when viewing details
    const numericId = parseInt(ticketId, 10)
    if (!isNaN(numericId)) {
      markAsRead(numericId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId])

  const loadTicket = async () => {
    const data = await fetchTicketById(ticketId)
    if (data) {
      setTicket(data)
    }
  }

  const loadArticles = async () => {
    const data = await fetchArticles(ticketId)
    setArticles(data)
  }

  const handleUpdate = async (updates: {
    state?: string
    priority?: string
    owner_id?: number
  }) => {
    const updated = await updateTicket(ticketId, updates)
    if (updated) {
      setTicket(updated)
      toast.success(tToast('updateSuccess'))
    }
  }

  const handleAddNote = async (note: string, internal: boolean, attachments?: Array<{filename: string; data: string; 'mime-type': string}>, replyType?: 'note' | 'email') => {
    // Generate a temporary message ID
    const tempMessageId = `temp-${Date.now()}`

    const article = await addArticle(ticketId, tempMessageId, {
      subject: ticket?.title || 'Note',
      body: note,
      internal,
      attachments,
      type: replyType || 'note',  // Use replyType to determine if email should be sent
    })

    if (article) {
      setArticles([...articles, article])
      toast.success(replyType === 'email' ? tToast('emailSent') : tToast('noteAdded'))
    }
  }

  if (isLoading && !ticket) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!ticket) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">{t('ticketNotFound')}</p>
        <Button
          variant="outline"
          onClick={() => router.push('/staff/tickets')}
          className="mt-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('backToTickets')}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Compact Header with Back Button and Ticket Info */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/staff/tickets')}
          className="h-8 w-8"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold">{t('ticketNumber', { number: ticket.number })}</h1>
            <TicketStatusBadge state={ticket.state} />
            <TicketPriorityBadge priority={ticket.priority} />
          </div>
          <p className="text-sm text-muted-foreground truncate">{ticket.title}</p>
        </div>
      </div>

      {/* Main Content - Optimized Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Left Column - Conversation (Primary Focus) */}
        <div className="lg:col-span-3 space-y-4">
          {/* Compact Ticket Meta Info */}
          <Card className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">{tDetails('customer')}:</span>
                <p className="font-medium truncate">{ticket.customer}</p>
              </div>
              <div>
                <span className="text-muted-foreground">{tDetails('group')}:</span>
                <p className="font-medium truncate">{ticket.group || '-'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">{tDetails('created')}:</span>
                <p className="font-medium">{format(new Date(ticket.created_at), 'MM-dd HH:mm')}</p>
              </div>
              <div>
                <span className="text-muted-foreground">{tDetails('lastUpdated')}:</span>
                <p className="font-medium">{format(new Date(ticket.updated_at), 'MM-dd HH:mm')}</p>
              </div>
            </div>
          </Card>

          {/* Articles - Main Content Area */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquare className="h-4 w-4" />
                {t('conversationCount', { count: articles.length })}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {articles.length === 0 ? (
                <p className="text-muted-foreground text-center py-6">
                  {t('noArticles')}
                </p>
              ) : (
                <div className="space-y-4">
                  {articles.map((article) => (
                    <ArticleCard key={article.id} article={article} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Actions (Narrower) */}
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-20">
            <TicketActions
              ticket={ticket}
              onUpdate={handleUpdate}
              onAddNote={handleAddNote}
              isLoading={isLoading}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
