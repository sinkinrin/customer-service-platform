'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Send, Loader2, Clock, Tag, Upload, X, CheckCircle } from 'lucide-react'
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
import { useTicket, type TicketArticle } from '@/lib/hooks/use-ticket'
import { ArticleCard } from '@/components/ticket/article-content'
import { TicketRating } from '@/components/ticket/ticket-rating'
import { TicketReopenButton } from '@/components/ticket/ticket-reopen-button'
import type { ZammadTicket } from '@/lib/stores/ticket-store'
import { useUnreadStore } from '@/lib/stores/unread-store'
import { format } from 'date-fns'
import { toast } from 'sonner'

export default function CustomerTicketDetailPage() {
  const params = useParams()
  const router = useRouter()
  const ticketId = params.id as string
  const t = useTranslations('customer.myTickets')
  const tDetail = useTranslations('customer.myTickets.detail')
  const tToast = useTranslations('toast.customer.tickets')

  const [ticket, setTicket] = useState<ZammadTicket | null>(null)
  const [articles, setArticles] = useState<TicketArticle[]>([])
  const [replyText, setReplyText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [closing, setClosing] = useState(false)

  const { fetchTicketById, fetchArticles, isLoading } = useTicket()
  const { markAsRead } = useUnreadStore()

  // Convert File to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => {
        // Remove data:*/*;base64, prefix
        const base64String = (reader.result as string).split(',')[1]
        resolve(base64String)
      }
      reader.onerror = (error) => reject(error)
    })
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])

    // Validate file count
    if (files.length + selectedFiles.length > 5) {
      toast.error(t('fileUpload.maxFiles'))
      return
    }

    // Validate file sizes (10MB per file)
    const invalidFiles = selectedFiles.filter(file => file.size > 10 * 1024 * 1024)
    if (invalidFiles.length > 0) {
      toast.error(t('fileUpload.fileTooLarge'))
      return
    }

    setFiles([...files, ...selectedFiles])
  }

  const handleRemoveFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index))
  }

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

  const handleCloseTicket = async () => {
    setClosing(true)
    try {
      const response = await fetch(`/api/tickets/${ticketId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          state: 'closed',
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || tToast('closeError'))
      }

      toast.success(tToast('closeSuccess'))
      await loadTicket()
      await loadArticles()
    } catch (error: any) {
      console.error('Failed to close ticket:', error)
      toast.error(error.message || tToast('closeError'))
    } finally {
      setClosing(false)
    }
  }

  const handleReply = async () => {
    if (!replyText.trim()) {
      toast.error(tToast('replyRequired'))
      return
    }

    setSubmitting(true)
    try {
      // Convert files to base64 attachments
      let attachments: { filename: string; data: string; 'mime-type': string }[] = []
      if (files.length > 0) {
        attachments = await Promise.all(
          files.map(async (file) => ({
            filename: file.name,
            data: await fileToBase64(file),
            'mime-type': file.type || 'application/octet-stream',
          }))
        )
      }

      // Call API with attachments
      const response = await fetch(`/api/tickets/${ticketId}/articles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject: `Re: ${ticket?.title || ''}`,
          body: replyText,
          type: 'web',
          internal: false,
          attachments: attachments.length > 0 ? attachments : undefined,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || tToast('replyError'))
      }

      toast.success(tToast('replySent'))
      setReplyText('')
      setFiles([])
      await loadArticles()
    } catch (error: any) {
      console.error('Failed to send reply:', error)
      toast.error(error.message || tToast('replyError'))
    } finally {
      setSubmitting(false)
    }
  }

  const getStatusBadge = (state: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline', label: string }> = {
      'new': { variant: 'default', label: t('statusLabels.new') },
      'open': { variant: 'default', label: t('statusLabels.open') },
      'pending': { variant: 'secondary', label: t('statusLabels.pending') },
      'closed': { variant: 'outline', label: t('statusLabels.closed') },
    }
    const config = variants[state] || { variant: 'default', label: state }
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  const getPriorityBadge = (priority: number) => {
    const variants: Record<number, { variant: 'default' | 'secondary' | 'destructive', label: string }> = {
      1: { variant: 'secondary', label: t('priorityLabels.1') },
      2: { variant: 'default', label: t('priorityLabels.2') },
      3: { variant: 'destructive', label: t('priorityLabels.3') },
      4: { variant: 'destructive', label: t('priorityLabels.4') },
    }
    const config = variants[priority] || { variant: 'default', label: String(priority) }
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  if (isLoading || !ticket) {
    return (
      <div className="container mx-auto py-6 max-w-5xl">
        <Skeleton className="h-8 w-64 mb-6" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-full mb-2" />
            <Skeleton className="h-4 w-3/4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.push('/customer/my-tickets')}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {tDetail('backToList')}
        </Button>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">{ticket.title}</h1>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Tag className="h-4 w-4" />
                {tDetail('ticketNumber')}: #{ticket.number}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {tDetail('createdAt')}: {format(new Date(ticket.created_at), 'yyyy-MM-dd HH:mm')}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge(ticket.state)}
            {getPriorityBadge(ticket.priority_id)}
            {/* Close Ticket Button - only show if not already closed */}
            {ticket.state !== 'closed' && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" disabled={closing}>
                    {closing ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle className="mr-2 h-4 w-4" />
                    )}
                    {tDetail('closeTicket')}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{tDetail('closeDialog.title')}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {tDetail('closeDialog.description')}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{tDetail('closeDialog.cancel')}</AlertDialogCancel>
                    <AlertDialogAction onClick={handleCloseTicket}>
                      {tDetail('closeDialog.confirm')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </div>

      {/* Ticket Details */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{tDetail('infoTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{tDetail('status')}</p>
              <div className="mt-1">{getStatusBadge(ticket.state)}</div>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{tDetail('priority')}</p>
              <div className="mt-1">{getPriorityBadge(ticket.priority_id)}</div>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{tDetail('assignedTo')}</p>
              <p className="mt-1">
                {ticket.owner_name || (ticket.owner_id ? `Staff #${ticket.owner_id}` : tDetail('unassigned'))}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{tDetail('createdAt')}</p>
              <p className="mt-1">{format(new Date(ticket.created_at), 'yyyy-MM-dd HH:mm:ss')}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{tDetail('updatedAt')}</p>
              <p className="mt-1">{format(new Date(ticket.updated_at), 'yyyy-MM-dd HH:mm:ss')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Articles/Conversation History */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            {tDetail('conversationTitle')}
          </CardTitle>
          <CardDescription>
            {tDetail('messageCount', { count: articles.length })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {articles.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">{tDetail('noMessages')}</p>
          ) : (
            <div className="space-y-4">
              {articles.map((article) => (
                <ArticleCard key={article.id} article={article} viewerRole="customer" />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reply Section - Only show if ticket is not closed */}
      {ticket.state !== 'closed' && (
        <Card>
          <CardHeader>
            <CardTitle>{tDetail('addReply')}</CardTitle>
            <CardDescription>
              {tDetail('replyDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder={tDetail('replyPlaceholder')}
                rows={6}
                maxLength={2000}
              />

              {/* File Upload Section */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    id="reply-files"
                    type="file"
                    onChange={handleFileChange}
                    multiple
                    className="hidden"
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('reply-files')?.click()}
                    disabled={files.length >= 5}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {tDetail('attachFiles')}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {tDetail('maxFiles', { max: 5 })} • Max 10MB per file
                  </span>
                </div>

                {/* File List */}
                {files.length > 0 && (
                  <div className="space-y-2">
                    {files.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 bg-muted rounded-md"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <Upload className="h-4 w-4 flex-shrink-0" />
                          <span className="text-sm truncate">{file.name}</span>
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            ({(file.size / 1024).toFixed(1)} KB)
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveFile(index)}
                          className="h-6 w-6 p-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {tDetail('characterCount', { count: replyText.length, max: 2000 })}
                </p>
                <Button
                  onClick={handleReply}
                  disabled={submitting || !replyText.trim()}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {tDetail('sending')}
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      {tDetail('sendReply')}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Closed ticket message and rating section */}
      {ticket.state === 'closed' && (
        <div className="space-y-4">
          {/* Rating component */}
          <TicketRating 
            ticketId={parseInt(ticketId)} 
            isVisible={true} 
          />
          
          {/* Reopen option */}
          <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  {tDetail('closedMessage')}
                </p>
                <TicketReopenButton 
                  ticketId={parseInt(ticketId)} 
                  onSuccess={() => {
                    loadTicket()
                    loadArticles()
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

