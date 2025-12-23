'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, MessageSquare, Trash2, UserPlus, Activity } from 'lucide-react'
import { TicketDetail } from '@/components/ticket/ticket-detail'
import { TicketActions } from '@/components/ticket/ticket-actions'
import { ArticleCard } from '@/components/ticket/article-content'
import { TicketAssignDialog } from '@/components/admin/ticket-assign-dialog'
import { useTicket, type TicketArticle } from '@/lib/hooks/use-ticket'
import type { ZammadTicket } from '@/lib/stores/ticket-store'
import { format } from 'date-fns'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

export default function AdminTicketDetailPage() {
  const t = useTranslations('admin.ticketDetail')
  const tToast = useTranslations('toast.admin.ticketDetail')
  const params = useParams()
  const router = useRouter()
  const ticketId = params.id as string

  const [ticket, setTicket] = useState<ZammadTicket | null>(null)
  const [articles, setArticles] = useState<TicketArticle[]>([])
  const [deleting, setDeleting] = useState(false)
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
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
      toast.success(internal ? tToast('noteAdded') : tToast('replyAdded'))
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const response = await fetch(`/api/tickets/${ticketId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete ticket')
      }

      toast.success(tToast('deleteSuccess'))
      router.push('/admin/tickets')
    } catch (error) {
      console.error('Delete ticket error:', error)
      toast.error(tToast('deleteError'))
    } finally {
      setDeleting(false)
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
        <p className="text-muted-foreground">{t('notFound')}</p>
        <Button
          variant="outline"
          onClick={() => router.push('/admin/tickets')}
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
            onClick={() => router.push('/admin/tickets')}
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
        <div className="flex gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={deleting}>
                <Trash2 className="h-4 w-4 mr-2" />
                {t('deleteButton')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('deleteDialog.title')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('deleteDialog.description')}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('deleteDialog.cancel')}</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                  {t('deleteDialog.delete')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* AI Summary Placeholder */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800">
        <CardContent className="py-3">
          <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
            <Activity className="h-4 w-4" />
            <span className="font-medium">AI Summary:</span>
            <span className="text-muted-foreground italic">Coming soon - AI will summarize this conversation</span>
          </div>
        </CardContent>
      </Card>

      {/* Main Content - Conversation focused layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Conversation (Main Focus) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Conversation */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <MessageSquare className="h-5 w-5" />
                {t('conversation', { count: articles.length })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {articles.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
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

        {/* Right Column - Ticket Info & Actions (Sticky Sidebar) */}
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-20 space-y-4">
            {/* Compact Ticket Info */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Ticket Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Customer:</span>
                  <p className="font-medium">{ticket.customer}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Assigned To:</span>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="font-medium">
                      {ticket.owner_name || (ticket.owner_id ? `Staff #${ticket.owner_id}` : 'Unassigned')}
                    </p>
                    <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => setAssignDialogOpen(true)}>
                      <UserPlus className="h-3 w-3 mr-1" />
                      {ticket.owner_id ? 'Reassign' : 'Assign'}
                    </Button>
                  </div>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-muted-foreground text-xs">Created</span>
                    <p className="text-xs">{format(new Date(ticket.created_at), 'MM-dd HH:mm')}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Updated</span>
                    <p className="text-xs">{format(new Date(ticket.updated_at), 'MM-dd HH:mm')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Ticket Actions */}
            <TicketActions
              ticket={ticket}
              onUpdate={handleUpdate}
              onAddNote={handleAddNote}
              isLoading={isLoading}
            />
          </div>
        </div>
      </div>

      {/* Assign Dialog */}
      <TicketAssignDialog
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        ticket={ticket ? {
          id: ticket.id,
          number: ticket.number,
          title: ticket.title,
          owner_id: ticket.owner_id
        } : null}
        onSuccess={loadTicket}
      />
    </div>
  )
}

