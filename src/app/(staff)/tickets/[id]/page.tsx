'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
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

export default function TicketDetailPage() {
  const params = useParams()
  const router = useRouter()
  const conversationId = params.id as string
  
  const [ticket, setTicket] = useState<ZammadTicket | null>(null)
  const [articles, setArticles] = useState<TicketArticle[]>([])
  const { fetchTicketByConversationId, updateTicket, addArticle, fetchArticles, isLoading } = useTicket()

  useEffect(() => {
    loadTicket()
    loadArticles()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId])

  const loadTicket = async () => {
    const data = await fetchTicketByConversationId(conversationId)
    if (data) {
      setTicket(data)
    }
  }

  const loadArticles = async () => {
    const data = await fetchArticles(conversationId)
    setArticles(data)
  }

  const handleUpdate = async (updates: {
    state?: string
    priority?: string
    owner_id?: number
  }) => {
    const updated = await updateTicket(conversationId, updates)
    if (updated) {
      setTicket(updated)
    }
  }

  const handleAddNote = async (note: string, internal: boolean) => {
    // Generate a temporary message ID (in real app, this would come from creating a message first)
    const tempMessageId = `temp-${Date.now()}`
    
    const article = await addArticle(conversationId, tempMessageId, {
      subject: ticket?.title || 'Note',
      body: note,
      internal,
    })
    
    if (article) {
      setArticles([...articles, article])
    }
  }

  if (isLoading && !ticket) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-64" />
            <Skeleton className="h-96" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-64" />
          </div>
        </div>
      </div>
    )
  }

  if (!ticket) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <MessageSquare className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold mb-2">Ticket Not Found</h2>
        <p className="text-muted-foreground mb-6">
          This conversation does not have an associated ticket yet.
        </p>
        <Button onClick={() => router.push('/staff/tickets')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Tickets
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/staff/tickets')}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <h1 className="text-3xl font-bold">Ticket Details</h1>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Ticket Info and Articles */}
        <div className="lg:col-span-2 space-y-6">
          <TicketDetail ticket={ticket} />

          {/* Articles/Conversation History */}
          <Card>
            <CardHeader>
              <CardTitle>Conversation History</CardTitle>
            </CardHeader>
            <CardContent>
              {articles.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No articles yet. Add a note to start the conversation.
                </p>
              ) : (
                <div className="space-y-4">
                  {articles.map((article, index) => (
                    <div key={article.id}>
                      {index > 0 && <Separator className="my-4" />}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">{article.subject}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(article.created_at), 'PPp')}
                          </p>
                        </div>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {article.body}
                        </p>
                        {article.internal && (
                          <p className="text-xs text-yellow-600 dark:text-yellow-400">
                            Internal Note
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Actions */}
        <div className="space-y-6">
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

