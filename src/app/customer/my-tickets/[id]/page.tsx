'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Send, Loader2, Upload, X, CheckCircle } from 'lucide-react'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { ATTACHMENT_LIMITS, FILE_ACCEPT, formatFileSize } from '@/lib/constants/attachments'
import { useFileUpload } from '@/lib/hooks/use-file-upload'
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useTicket, type TicketArticle } from '@/lib/hooks/use-ticket'
import { ArticleCard } from '@/components/ticket/article-content'
import { TicketRating } from '@/components/ticket/ticket-rating'
import { TicketReopenButton } from '@/components/ticket/ticket-reopen-button'
import type { ZammadTicket } from '@/lib/stores/ticket-store'
import { useUnreadStore } from '@/lib/stores/unread-store'
import { useNotifications } from '@/lib/hooks/use-notifications'
import { format } from 'date-fns'
import { toast } from 'sonner'

export default function CustomerTicketDetailPage() {
  const params = useParams()
  const router = useRouter()
  const ticketId = params.id as string
  const t = useTranslations('customer.myTickets')
  const tDetail = useTranslations('customer.myTickets.detail')
  const tCommon = useTranslations('common')
  const tToast = useTranslations('toast.customer.tickets')
  const tBreadcrumb = useTranslations('nav.breadcrumb')

  const [ticket, setTicket] = useState<ZammadTicket | null>(null)
  const [articles, setArticles] = useState<TicketArticle[]>([])
  const [replyText, setReplyText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [closing, setClosing] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Use shared file upload hook
  const {
    uploadedFiles,
    isUploading,
    addFiles,
    removeFile: handleRemoveFile,
    clearFiles,
    getAttachmentIds,
    getFormId,
  } = useFileUpload({
    onError: (msg) => toast.error(msg),
  })

  const { fetchTicketById, fetchArticles, isLoading } = useTicket()
  const { markAsRead } = useUnreadStore()
  const { markTicketNotificationsAsRead } = useNotifications()

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      await addFiles(e.target.files)
    }
    // Reset input
    e.target.value = ''
  }

  useEffect(() => {
    loadTicket()
    loadArticles()
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
      // Get form_id from successfully uploaded files
      // Note: Only form_id is needed - Zammad retrieves attachments from UploadCache by form_id
      const formId = getFormId()

      // Call API with form_id (Zammad native API)
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
          ...(formId && { form_id: formId }),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || tToast('replyError'))
      }

      toast.success(tToast('replySent'))
      setReplyText('')
      clearFiles()
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
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden max-w-5xl mx-auto w-full px-4 py-6">
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
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden max-w-[1800px] mx-auto w-full">
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden w-full px-4 py-3">
        {/* Breadcrumb Navigation */}
        <Breadcrumb
          items={[
            { label: tBreadcrumb('myTickets'), href: '/customer/my-tickets' },
            { label: `#${ticket.number}` },
          ]}
          className="mb-2"
        />

        {/* Top Navigation Row - Standalone */}
        <div className="flex-shrink-0 mb-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/customer/my-tickets')}
            className="h-8 pl-0 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {tDetail('backToList')}
          </Button>
        </div>

        {/* Main Layout: Flex Row for Desktop */}
        <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0 overflow-hidden">

          {/* Left Column: Conversation (Flex-1) */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-background rounded-lg border shadow-sm">
            {/* Conversation Header (Minimal) */}
            <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/20 flex-shrink-0">
              <div className="flex items-center gap-2 text-sm font-medium">
                <span className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  {tDetail('conversationTitle')}
                </span>
                <span className="text-muted-foreground text-xs">({articles.length})</span>
              </div>
            </div>

            {/* Scrollable Messages */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-6">
              {articles.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <p>{tDetail('noMessages')}</p>
                </div>
              ) : (
                articles.map((article) => (
                  <ArticleCard key={article.id} article={article} viewerRole="customer" />
                ))
              )}

              {/* Auto-scroll anchor */}
              <div ref={messagesEndRef} />

              {/* Closed Ticket State within Message List */}
              {ticket.state === 'closed' && (
                <div className="pt-8 pb-4 space-y-4">
                  <div className="flex items-center justify-center">
                    <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                      Ticket Closed
                    </span>
                  </div>
                  <TicketRating
                    ticketId={parseInt(ticketId)}
                    isVisible={true}
                  />
                  <div className="flex justify-center">
                    <TicketReopenButton
                      ticketId={parseInt(ticketId)}
                      onSuccess={() => {
                        loadTicket()
                        loadArticles()
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Mobile-Only Sticky Reply Footer */}
            {ticket.state !== 'closed' && (
              <div className="lg:hidden flex-shrink-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pb-[env(safe-area-inset-bottom)]">
                <div className="p-2">
                  <div className="relative flex flex-col gap-2 rounded-lg border bg-background p-2 focus-within:ring-1 focus-within:ring-ring transition-all duration-200">
                    <Textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder={tDetail('replyPlaceholder')}
                      className="min-h-[40px] max-h-[200px] resize-none border-0 p-0 shadow-none focus-visible:ring-0 text-sm"
                      rows={1}
                      maxLength={2000}
                    />

                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-2">
                        <Input
                          id="reply-files-mobile"
                          type="file"
                          onChange={handleFileChange}
                          multiple
                          className="hidden"
                          accept={FILE_ACCEPT}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted"
                          onClick={() => document.getElementById('reply-files-mobile')?.click()}
                          disabled={uploadedFiles.length >= ATTACHMENT_LIMITS.MAX_COUNT}
                        >
                          <Upload className="h-4 w-4" />
                        </Button>
                        <span className="text-[10px] text-muted-foreground hidden sm:inline-block">
                          {uploadedFiles.length > 0 ? `${uploadedFiles.length}/${ATTACHMENT_LIMITS.MAX_COUNT}` : ''}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <Button
                          onClick={handleReply}
                          disabled={submitting || isUploading || !replyText.trim()}
                          size="sm"
                          className="h-7 px-3 text-xs"
                        >
                          {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : isUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                  {uploadedFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2 px-1">
                      {uploadedFiles.map((uploadedFile, index) => (
                        <div key={index} className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] max-w-[150px] border ${
                          uploadedFile.error ? 'bg-red-50 border-red-200' :
                          uploadedFile.uploading ? 'bg-yellow-50 border-yellow-200' :
                          'bg-green-50 border-green-200'
                        }`}>
                          {uploadedFile.uploading ? (
                            <Loader2 className="h-2 w-2 animate-spin text-yellow-600" />
                          ) : uploadedFile.error ? (
                            <X className="h-2 w-2 text-red-600" />
                          ) : (
                            <CheckCircle className="h-2 w-2 text-green-600" />
                          )}
                          <span className="truncate">{uploadedFile.file.name}</span>
                          <Button variant="ghost" size="icon" onClick={() => handleRemoveFile(index)} className="h-3 w-3 -mr-1 hover:text-destructive">
                            <X className="h-2 w-2" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Sidebar (Desktop Only) */}
          <div className="hidden lg:flex flex-col w-[420px] flex-shrink-0 gap-4 min-h-0 overflow-hidden">
            {/* Ticket Info Block (With Title & Actions) */}
            <Card className="flex-shrink-0 border-0 shadow-none bg-muted/30">
              <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <CardTitle className="text-lg font-bold text-foreground leading-tight line-clamp-2 break-words cursor-default">
                            {ticket.title}
                          </CardTitle>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-[350px]">
                          <p className="break-words">{ticket.title}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <p className="text-xs text-muted-foreground font-mono">#{ticket.number}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="space-y-4 text-sm">
                  {/* Control Row: Status + Close Button */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getStatusBadge(ticket.state)}
                      {getPriorityBadge(ticket.priority_id)}
                    </div>

                    {ticket.state !== 'closed' && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="h-7 text-xs border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-300 transition-colors" disabled={closing}>
                            {closing ? (
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            ) : (
                              <CheckCircle className="mr-1 h-3 w-3" />
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

                  <div className="pt-2 border-t"></div>

                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">{tDetail('assignedTo')}</p>
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                        {ticket.owner_name ? ticket.owner_name[0].toUpperCase() : 'U'}
                      </div>
                      <p className="truncate">
                        {ticket.owner_name || (ticket.owner_id ? `Staff #${ticket.owner_id}` : tDetail('unassigned'))}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">{tDetail('createdAt')}</p>
                      <p className="text-muted-foreground text-xs">{format(new Date(ticket.created_at), 'MM-dd HH:mm')}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">{tDetail('updatedAt')}</p>
                      <p className="text-muted-foreground text-xs">{format(new Date(ticket.updated_at), 'MM-dd HH:mm')}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Desktop Reply Area (In Sidebar - Compact) */}
            {ticket.state !== 'closed' && (
              <div className="flex-shrink-0 flex flex-col bg-background rounded-lg border shadow-sm p-3 w-full">
                <p className="text-xs font-medium mb-2 flex items-center gap-2 text-muted-foreground">
                  <Send className="h-3 w-3" />
                  Reply to Ticket
                </p>
                <div className="flex flex-col relative w-full gap-2">
                  <Textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={tDetail('replyPlaceholder')}
                    className="resize-none border-dashed focus-visible:ring-1 bg-muted/20 min-h-[100px]"
                    rows={4}
                    maxLength={2000}
                  />

                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Input
                        id="reply-files-desktop"
                        type="file"
                        onChange={handleFileChange}
                        multiple
                        className="hidden"
                        accept={FILE_ACCEPT}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 text-xs px-2"
                        onClick={() => document.getElementById('reply-files-desktop')?.click()}
                        disabled={uploadedFiles.length >= ATTACHMENT_LIMITS.MAX_COUNT}
                      >
                        <Upload className="h-3 w-3" />
                        {tDetail('attachFiles')}
                      </Button>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">{replyText.length}/2000</span>
                      <Button
                        onClick={handleReply}
                        disabled={submitting || isUploading || !replyText.trim()}
                        size="sm"
                        className="h-7 px-3 text-xs"
                      >
                        {submitting ? (
                          <>
                            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                            {tDetail('sending')}
                          </>
                        ) : isUploading ? (
                          <>
                            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                            {tCommon('uploading')}
                          </>
                        ) : (
                          <>
                            <Send className="mr-2 h-3 w-3" />
                            {tDetail('sendReply')}
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {uploadedFiles.length > 0 && (
                    <div className="flex flex-col gap-1 mt-2 p-2 bg-muted/50 rounded-md">
                      {uploadedFiles.map((uploadedFile, index) => (
                        <div key={index} className={`flex items-center justify-between text-xs p-1 rounded ${
                          uploadedFile.error ? 'bg-red-50' :
                          uploadedFile.uploading ? 'bg-yellow-50' :
                          'bg-green-50'
                        }`}>
                          <div className="flex items-center gap-2 truncate">
                            {uploadedFile.uploading ? (
                              <Loader2 className="h-3 w-3 animate-spin text-yellow-600" />
                            ) : uploadedFile.error ? (
                              <X className="h-3 w-3 text-red-600" />
                            ) : (
                              <CheckCircle className="h-3 w-3 text-green-600" />
                            )}
                            <span className="truncate max-w-[150px]">{uploadedFile.file.name}</span>
                            <span className="text-muted-foreground">({formatFileSize(uploadedFile.file.size)})</span>
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => handleRemoveFile(index)} className="h-4 w-4 hover:bg-background rounded-full">
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
