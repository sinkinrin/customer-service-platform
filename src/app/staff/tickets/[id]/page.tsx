'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ArrowLeft, MessageSquare, Bot } from 'lucide-react'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { TicketActions } from '@/components/ticket/ticket-actions'
import { ArticleCard } from '@/components/ticket/article-content'
import { RatingIndicator } from '@/components/ticket/ticket-rating'
import { AiAssistantPanel } from '@/components/staff/ai-assistant-panel'
import { useTicket, type TicketArticle } from '@/lib/hooks/use-ticket'
import type { ZammadTicket } from '@/lib/stores/ticket-store'
import { useUnreadStore } from '@/lib/stores/unread-store'
import { useNotifications } from '@/lib/hooks/use-notifications'
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
    className += 'bg-orange-500 text-white hover:bg-orange-500'
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
  const tBreadcrumb = useTranslations('nav.breadcrumb')
  const params = useParams()
  const router = useRouter()
  const ticketId = params.id as string

  const [ticket, setTicket] = useState<ZammadTicket | null>(null)
  const [articles, setArticles] = useState<TicketArticle[]>([])
  const [rating, setRating] = useState<'positive' | 'negative' | null>(null)
  const [showAiPanel, setShowAiPanel] = useState(false)
  const noteSetterRef = useRef<((text: string) => void) | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { fetchTicketById, updateTicket, addArticle, fetchArticles, isLoading } = useTicket()
  const { markAsRead } = useUnreadStore()
  const { markTicketNotificationsAsRead } = useNotifications()

  useEffect(() => {
    loadTicket()
    loadArticles()
    loadRating()
    // Mark ticket as read when viewing details
    const numericId = parseInt(ticketId, 10)
    if (!isNaN(numericId)) {
      markAsRead(numericId)
      markTicketNotificationsAsRead(numericId).catch(() => { })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId])

  // Auto-scroll to bottom when new articles arrive
  useEffect(() => {
    if (messagesEndRef.current && articles.length > 0) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [articles.length])

  // Listen for real-time ticket updates via SSE
  useEffect(() => {
    const numericId = parseInt(ticketId, 10)
    if (isNaN(numericId)) return

    const handleTicketUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{
        ticketId: number
        event: string
        data: Record<string, unknown>
      }>

      // Only refresh if this update is for the current ticket
      if (customEvent.detail.ticketId === numericId) {
        console.log('[TicketDetail] Received update for this ticket, refreshing...')
        loadTicket()
        loadArticles()
      }
    }

    window.addEventListener('ticket-update', handleTicketUpdate)
    return () => {
      window.removeEventListener('ticket-update', handleTicketUpdate)
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

  const loadRating = async () => {
    try {
      const res = await fetch(`/api/tickets/${ticketId}/rating`)
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.data) {
          setRating(data.data.rating as 'positive' | 'negative')
        }
      }
    } catch (error) {
      console.error('Failed to load rating:', error)
    }
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

  const handleAddNote = async (note: string, internal: boolean, _attachmentIds?: number[], replyType?: 'note' | 'email', formId?: string) => {
    // Generate a temporary message ID
    const tempMessageId = `temp-${Date.now()}`

    // Note: Only form_id is needed - Zammad retrieves attachments from UploadCache by form_id
    // The _attachmentIds parameter is kept for interface compatibility but not used
    const article = await addArticle(ticketId, tempMessageId, {
      subject: ticket?.title || 'Note',
      body: note,
      internal,
      form_id: formId,
      type: replyType || 'note',  // Use replyType to determine if email should be sent
    })

    if (article) {
      setArticles([...articles, article])
      toast.success(replyType === 'email' ? tToast('emailSent') : tToast('noteAdded'))
    }
  }

  const handleAiInsertReply = useCallback((text: string) => {
    if (noteSetterRef.current) {
      noteSetterRef.current(text)
    }
  }, [])

  const handleNoteRef = useCallback((setter: (text: string) => void) => {
    noteSetterRef.current = setter
  }, [])

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
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden gap-4">
      {/* Breadcrumb Navigation */}
      <Breadcrumb
        items={[
          { label: tBreadcrumb('tickets'), href: '/staff/tickets' },
          { label: `#${ticket.number}` },
        ]}
      />

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
            {rating && <RatingIndicator rating={rating} showLabel />}
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <p className="text-sm text-muted-foreground truncate max-w-full cursor-default">{ticket.title}</p>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[400px]">
                <p className="break-words">{ticket.title}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Button
          variant={showAiPanel ? "default" : "outline"}
          size="sm"
          className="gap-1.5 flex-shrink-0"
          onClick={() => setShowAiPanel(!showAiPanel)}
        >
          <Bot className="h-4 w-4" />
          <span className="hidden sm:inline">AI</span>
        </Button>
      </div>

      {/* Main Content - Fixed actions + scrollable conversation */}
      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0 overflow-hidden">
        {/* Mobile-Only Ticket Meta + Actions Summary */}
        <div className="lg:hidden flex-shrink-0">
          <Card className="p-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">{tDetails('customer')}:</span>
                <p className="font-medium truncate">{ticket.customer}</p>
              </div>
              <div>
                <span className="text-muted-foreground">{tDetails('group')}:</span>
                <p className="font-medium truncate">{ticket.group || '-'}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Left Column - Conversation */}
        <div className="flex flex-col flex-1 min-h-0 overflow-y-auto pr-2 gap-4 pb-6">
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

          {/* Articles - Scrollable */}
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
                    <ArticleCard key={article.id} article={article} viewerRole="staff" />
                  ))}
                  {/* Auto-scroll anchor */}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Actions + AI Panel */}
        <div className="flex-shrink-0 lg:w-[450px] flex flex-col gap-4 overflow-y-auto">
          <TicketActions
            ticket={ticket}
            onUpdate={handleUpdate}
            onAddNote={handleAddNote}
            isLoading={isLoading}
            onNoteRef={handleNoteRef}
          />

          {showAiPanel && (
            <div className="min-h-[400px]">
              <AiAssistantPanel
                ticketTitle={ticket.title}
                ticketState={ticket.state}
                ticketPriority={ticket.priority}
                customerName={ticket.customer}
                articles={articles.map(a => ({
                  id: a.id,
                  sender: a.sender,
                  body: a.body,
                  internal: a.internal,
                  created_at: a.created_at,
                }))}
                onInsertReply={handleAiInsertReply}
                onClose={() => setShowAiPanel(false)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
