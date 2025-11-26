'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, MessageSquare } from 'lucide-react'
import { TicketDetail } from '@/components/ticket/ticket-detail'
import { TicketActions } from '@/components/ticket/ticket-actions'
import { useTicket, type TicketArticle } from '@/lib/hooks/use-ticket'
import type { ZammadTicket } from '@/lib/stores/ticket-store'
import { format } from 'date-fns'
import { toast } from 'sonner'

export default function StaffTicketDetailPage() {
  const t = useTranslations('staff.tickets.detail')
  const tToast = useTranslations('toast.staff.tickets')
  const params = useParams()
  const router = useRouter()
  const ticketId = params.id as string

  const [ticket, setTicket] = useState<ZammadTicket | null>(null)
  const [articles, setArticles] = useState<TicketArticle[]>([])
  const { fetchTicketById, updateTicket, addArticle, fetchArticles, isLoading } = useTicket()

  useEffect(() => {
    loadTicket()
    loadArticles()
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

  const handleAddNote = async (note: string, internal: boolean) => {
    // Generate a temporary message ID
    const tempMessageId = `temp-${Date.now()}`

    const article = await addArticle(ticketId, tempMessageId, {
      subject: ticket?.title || 'Note',
      body: note,
      internal,
    })

    if (article) {
      setArticles([...articles, article])
      toast.success(tToast('noteAdded'))
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/staff/tickets')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('back')}
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{t('ticketNumber', { number: ticket.number })}</h1>
            <p className="text-sm text-muted-foreground">
              {t('created', { date: format(new Date(ticket.created_at), 'PPp') })}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Ticket Details and Articles */}
        <div className="lg:col-span-2 space-y-6">
          <TicketDetail ticket={ticket} />

          {/* Articles */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                {t('conversationCount', { count: articles.length })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {articles.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  {t('noArticles')}
                </p>
              ) : (
                <div className="space-y-4">
                  {articles.map((article, index) => (
                    <div key={article.id}>
                      {index > 0 && <Separator className="my-4" />}
                      <div className="space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium">{article.created_by}</p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(article.created_at), 'PPp')}
                            </p>
                          </div>
                          {article.internal && (
                            <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                              {t('internalBadge')}
                            </span>
                          )}
                        </div>
                        <div className="prose prose-sm max-w-none">
                          <p className="whitespace-pre-wrap">{article.body}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Actions */}
        <div className="lg:col-span-1">
          <TicketActions
            ticket={ticket}
            onUpdate={handleUpdate}
            onAddNote={handleAddNote}
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  )
}
