/**
 * Staff Conversation Detail Page
 *
 * Allows staff to view and respond to customer conversations,
 * including AI conversation history after transfer to human
 */

'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useConversation } from '@/lib/hooks/use-conversation'
import { MessageList } from '@/components/conversation/message-list'
import { MessageInput } from '@/components/conversation/message-input'
import { toast } from 'sonner'
import { Loading } from '@/components/common/loading'
import { AlertCircle, ArrowLeft, User, Mail, Clock, MessageSquare } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { format } from 'date-fns'

export default function StaffConversationDetailPage() {
  const params = useParams()
  const router = useRouter()
  const conversationId = params.id as string
  const t = useTranslations('staff.conversations.detail')
  const tToast = useTranslations('toast.staff.conversations')

  const [showNewMessageNotification, setShowNewMessageNotification] = useState(false)

  const {
    activeConversation,
    messages,
    isLoadingMessages,
    isSendingMessage,
    isTyping,
    typingUser,
    fetchMessages,
    fetchConversationById,
    sendMessage,
    subscribeToConversation,
    addMessage,
    sseConnected,
    sseError,
  } = useConversation()

  // SSE is now managed by useConversation hook
  // Use sseConnected and sseError from the hook instead of creating a duplicate connection
  const isConnected = sseConnected

  // Fetch conversation and messages, and mark as read
  useEffect(() => {
    if (conversationId) {
      fetchConversationById(conversationId)
      fetchMessages(conversationId)

      // Mark conversation as read when entering
      fetch(`/api/conversations/${conversationId}/mark-read`, {
        method: 'POST',
      }).catch((error) => {
        console.error('Failed to mark conversation as read:', error)
      })
    }
  }, [conversationId, fetchConversationById, fetchMessages])

  // Subscribe to real-time updates
  useEffect(() => {
    if (conversationId) {
      const unsubscribe = subscribeToConversation(conversationId)
      return unsubscribe
    }
  }, [conversationId, subscribeToConversation])

  // Handle sending message
  const handleSendMessage = async (
    content: string,
    messageType?: 'text' | 'image' | 'file',
    metadata?: Record<string, unknown>
  ) => {
    try {
      await sendMessage(conversationId, content, messageType, metadata)
    } catch (error) {
      console.error('Error sending message:', error)
      toast.error(tToast('sendError'))
    }
  }

  // Handle close conversation
  const handleCloseConversation = async () => {
    try {
      const response = await fetch(`/api/conversations/${conversationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'closed' }),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to close conversation')
      }

      toast.success(tToast('closeSuccess'))
      await fetchConversationById(conversationId)
    } catch (error) {
      console.error('Close conversation error:', error)
      toast.error(tToast('closeError'))
    }
  }

  if (!activeConversation && isLoadingMessages) {
    return <Loading fullScreen text="Loading conversation..." />
  }

  if (!activeConversation) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] space-y-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-2xl font-bold">{t('notFound.title')}</h2>
        <p className="text-muted-foreground">{t('notFound.description')}</p>
        <Button onClick={() => router.push('/staff/conversations')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('notFound.backButton')}
        </Button>
      </div>
    )
  }

  const customer = activeConversation.customer
  const conversationStatus = activeConversation.status || 'active'
  const isClosed = conversationStatus === 'closed'
  const conversationMode = activeConversation.mode || 'ai'
  const transferredAt = activeConversation.transferred_at
  const transferReason = activeConversation.transfer_reason

  // Get status badge variant
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'waiting':
        return 'secondary'
      case 'active':
        return 'default'
      case 'closed':
        return 'outline'
      default:
        return 'default'
    }
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex">
      {/* Main Conversation Area - 70% */}
      <div className="flex-1 flex flex-col border-r">
        {/* SSE Connection Status */}
        {sseError && (
          <Alert variant="destructive" className="m-4 mb-0 rounded-lg">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {t('sseError', { message: sseError.message })}
            </AlertDescription>
          </Alert>
        )}

        {/* New Message Notification */}
        {showNewMessageNotification && (
          <Alert className="m-4 mb-0 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800 rounded-lg">
            <AlertDescription className="text-blue-900 dark:text-blue-100">
              {t('newMessageNotification')}
            </AlertDescription>
          </Alert>
        )}

        {/* Header - Sticky */}
        <div className="sticky top-0 z-10 border-b bg-background shadow-sm">
          <div className="p-4">
            <div className="container max-w-5xl mx-auto px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push('/staff/conversations')}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    {t('header.backButton')}
                  </Button>
                  <div>
                    <h1 className="text-xl font-bold">
                      {t('header.title', { name: customer?.full_name || t('header.titleFallback') })}
                    </h1>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={getStatusBadgeVariant(conversationStatus)}>
                        {conversationStatus}
                      </Badge>
                      <Badge variant={conversationMode === 'ai' ? 'default' : 'secondary'}>
                        {conversationMode === 'ai' ? t('details.modeAI') : t('details.modeHuman')}
                      </Badge>
                      {isConnected && (
                        <Badge variant="outline" className="text-green-600 border-green-600">
                          {t('header.connected')}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                {!isClosed && (
                  <Button variant="destructive" size="sm" onClick={handleCloseConversation}>
                    {t('header.closeButton')}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Messages - Scrollable with explicit min-height */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
          <div className="container max-w-5xl mx-auto px-4 py-4">
            <MessageList
              messages={messages}
              isLoading={isLoadingMessages}
              isTyping={isTyping}
              typingUser={typingUser}
            />
          </div>
        </div>

        {/* Input - Sticky Bottom */}
        {!isClosed && (
          <div className="sticky bottom-0 z-10 bg-background border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
            <div className="container max-w-5xl mx-auto px-4 py-3">
              <MessageInput
                onSend={handleSendMessage}
                isSending={isSendingMessage}
                disabled={isClosed}
                placeholder={t('input.placeholder')}
              />
            </div>
          </div>
        )}

        {isClosed && (
          <div className="sticky bottom-0 z-10 border-t bg-muted p-4">
            <div className="container max-w-4xl text-center">
              <p className="text-sm text-muted-foreground">
                {t('closed.message')}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Customer Info Sidebar - Fixed width, internal scroll */}
      <div className="hidden lg:flex w-96 bg-muted/30 flex-col">
        <div className="overflow-y-auto p-6 space-y-6">
        {/* Customer Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {t('customer.title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {customer?.full_name?.charAt(0) || 'C'}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold">{customer?.full_name || t('customer.unknown')}</p>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {customer?.email || t('customer.noEmail')}
                </p>
              </div>
            </div>
            <Separator />
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('customer.customerId')}</span>
                <span className="font-mono">{customer?.id || 'N/A'}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Conversation Details Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              {t('details.title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('details.status')}</span>
              <Badge variant={getStatusBadgeVariant(conversationStatus)}>
                {conversationStatus === 'waiting' ? t('details.statusWaiting') : conversationStatus === 'active' ? t('details.statusActive') : t('details.statusClosed')}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('details.mode')}</span>
              <Badge variant={conversationMode === 'ai' ? 'default' : 'secondary'}>
                {conversationMode === 'ai' ? t('details.modeAI') : t('details.modeHuman')}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('details.messageCount')}</span>
              <span>{messages.length}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('details.createdTime')}</span>
              <span>{format(new Date(activeConversation.created_at), 'MM-dd HH:mm')}</span>
            </div>
            {activeConversation.updated_at && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('details.updatedTime')}</span>
                <span>{format(new Date(activeConversation.updated_at), 'MM-dd HH:mm')}</span>
              </div>
            )}
            {transferredAt && (
              <>
                <Separator />
                <div className="flex items-start justify-between">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {t('details.transferredTime')}
                  </span>
                  <span>{format(new Date(transferredAt), 'MM-dd HH:mm')}</span>
                </div>
                {transferReason && (
                  <div className="bg-muted p-2 rounded-md">
                    <p className="text-xs text-muted-foreground mb-1">{t('details.transferReason')}</p>
                    <p className="text-sm">{transferReason}</p>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions Card */}
        <Card>
          <CardHeader>
            <CardTitle>{t('quickActions.title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start" disabled>
              {t('quickActions.viewHistory')}
            </Button>
            <Button variant="outline" className="w-full justify-start" disabled>
              {t('quickActions.createTicket')}
            </Button>
            <Button variant="outline" className="w-full justify-start" disabled>
              {t('quickActions.addNote')}
            </Button>
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
  )
}
